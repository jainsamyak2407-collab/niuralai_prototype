import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { EvidenceFile, QleCase } from "@/lib/contracts/domain";
import { fmtDateLong } from "@/lib/dates";
import { readDocument, readNoteFor, statusFor, toProposedFacts } from "@/server/ai/evidence";
import { aiLog, audit, type Ctx, DomainError, nextId, now } from "@/server/domain/ctx";
import { apiError, sessionFor } from "@/server/docs/http";
import { cleanUploadName, declaredMismatch, MAX_UPLOAD_BYTES, pdfHasActiveContent, sniffType } from "@/server/docs/sniff";
import { mutate } from "@/server/runner";
import { getStore } from "@/server/store/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/qle/cases/{caseId}/evidence — multipart `file` (+ optional `taskId`).
// Employee only, own case. Type is decided from the bytes; the filename is never trusted.
// Stored privately at {scenarioId}/{caseId}/{fileId}. Reading proposes facts that the
// employee confirms with `case.confirmFact`; a conflict never overwrites the form.

const FILE_LIMIT_PER_CASE = 20;

function employeeFile(f: EvidenceFile) {
  return {
    id: f.id,
    caseId: f.caseId,
    taskId: f.taskId ?? null,
    fileName: f.fileName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    uploadedAt: f.uploadedAt,
    status: f.status,
    readMode: f.readMode,
    documentType: f.documentType,
    proposedFacts: f.proposedFacts,
    readNote: f.readNote,
  };
}

function messageFor(f: EvidenceFile, answersRequest: boolean): string {
  const tail = answersRequest ? " It is attached to HR's request; send your reply to finish." : "";
  if (f.status === "unreadable") return `We could not read this file. Upload a clearer copy of the exact document, or tell us it is not available yet.${tail}`;
  if (f.readMode === "manual") return `Your document was saved. AI reading is unavailable, so HR will read it (manual review).${tail}`;
  const conflict = f.proposedFacts.find((p) => p.conflictWith);
  if (conflict) {
    const form = conflict.conflictWith!.formValue.split(", ").map((v) => fmtDateLong(v, true)).join(" and ");
    return `The document shows ${fmtDateLong(conflict.value, true)}; your form shows ${form}. Please confirm which is correct.${tail}`;
  }
  if (f.status === "needs_confirmation") return `${f.readMode === "fixture_hash" ? "We matched a synthetic sample file (hash match)." : "We read your document."} Check each value and confirm it.${tail}`;
  return `Your document was saved for HR review.${tail}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await sessionFor(["employee"]);
  if ("error" in auth) return auth.error;
  const { session } = auth;
  const { id: caseId } = await params;
  if (!/^[\w-]{1,80}$/.test(caseId)) return apiError(404, "case_not_found", "We could not find that request.");

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 256 * 1024) return apiError(413, "file_too_large", "This file is larger than 10 MB. Upload a smaller copy.", "Upload a PDF, JPEG or PNG up to 10 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "invalid_upload", "We could not read the upload. Choose the file again.", "Choose the file again.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return apiError(400, "file_required", "Choose a file to upload.", "Choose a PDF, JPEG or PNG.", { fieldErrors: { file: "Choose a file to upload." } });
  const rawTask = form.get("taskId");
  const taskId = typeof rawTask === "string" && rawTask.trim() ? rawTask.trim() : null;
  if (taskId && !/^[\w-]{1,80}$/.test(taskId)) return apiError(404, "task_not_found", "We could not find that request from HR.");

  if (file.size === 0) return apiError(422, "file_empty", "This file is empty. Choose the file again.", "Choose a PDF, JPEG or PNG.", { fieldErrors: { file: "This file is empty." } });
  if (file.size > MAX_UPLOAD_BYTES) return apiError(413, "file_too_large", "This file is larger than 10 MB. Upload a smaller copy.", "Upload a PDF, JPEG or PNG up to 10 MB.", { fieldErrors: { file: "Files can be up to 10 MB." } });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return apiError(415, "unsupported_type", "This file type is not supported. Upload a PDF, JPEG or PNG.", "Upload a PDF, JPEG or PNG.", { fieldErrors: { file: "Upload a PDF, JPEG or PNG." } });
  if (declaredMismatch(file.type, type)) return apiError(415, "type_mismatch", "The file's contents do not match its type. Upload the original PDF, JPEG or PNG.", "Upload the original file.", { fieldErrors: { file: "The file's contents do not match its type." } });
  if (type === "application/pdf" && pdfHasActiveContent(bytes)) return apiError(422, "active_content", "This PDF contains scripts or embedded files. Upload a plain PDF, JPEG or PNG.", "Save or scan the document as a plain PDF and upload it again.", { fieldErrors: { file: "This PDF contains scripts or embedded files." } });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = cleanUploadName(file.name);
  const { user, scenarioId } = session;
  const store = getStore();

  // 1) Authorize against fresh state and record the file (status "reading").
  let created: { file: EvidenceFile; eventCode: QleCase["eventCode"]; duplicate: boolean };
  try {
    created = await mutate(scenarioId, (s) => {
      const c = s.cases.find((x) => x.id === caseId && x.employeeId === user.personId);
      if (!c) throw new DomainError(404, "case_not_found", "We could not find that request.");
      if (taskId) {
        const t = s.tasks.find((x) => x.id === taskId && x.caseId === c.id && x.kind === "information_request");
        if (!t) throw new DomainError(404, "task_not_found", "We could not find that request from HR.");
        if (t.status !== "open") throw new DomainError(409, "task_closed", "HR's request is already answered. Upload the document from your request page instead.", "Open the case tracker.");
      } else if (!["draft", "needs_information"].includes(c.status)) {
        throw new DomainError(409, "not_editable", "This request is with HR. You can add documents when HR asks for them.", "Open the case tracker.");
      }
      const dup = s.evidence.find((e) => e.caseId === c.id && e.sha256 === sha256 && e.status !== "rejected");
      if (dup) return { file: dup, eventCode: c.eventCode, duplicate: true };
      if (s.evidence.filter((e) => e.caseId === c.id).length >= FILE_LIMIT_PER_CASE) throw new DomainError(422, "too_many_files", "This request already has 20 files. Ask HR which document is still needed.", "Contact HR.");
      const ctx: Ctx = { s, actor: user, real: new Date().toISOString() };
      const fileId = nextId(s, "ev");
      const f: EvidenceFile = {
        id: fileId,
        caseId: c.id,
        ...(taskId ? { taskId } : {}),
        fileName,
        mimeType: type,
        sizeBytes: bytes.byteLength,
        sha256,
        // Unique per upload: case and file ids restart after a scenario reset, and the
        // private bucket never overwrites an existing object.
        storagePath: `${scenarioId}/${c.id}/${fileId}-${randomUUID()}`,
        uploadedBy: user.id,
        uploadedAt: now(ctx),
        status: "reading",
        readMode: null,
        documentType: null,
        proposedFacts: [],
        readNote: null,
      };
      s.evidence.push(f);
      audit(ctx, { caseId: c.id, type: "evidence.uploaded", summary: `Employee uploaded ${fileName} (${type}, ${bytes.byteLength} bytes, sha256 ${sha256.slice(0, 12)}…). Type checked from file contents. Malware scanning is not configured in this demo.`, employeeSummary: "You uploaded a document.", data: { fileId, sizeBytes: bytes.byteLength, taskId } });
      return { file: f, eventCode: c.eventCode, duplicate: false };
    });
  } catch (e) {
    if (e instanceof DomainError) return apiError(e.status, e.code, e.message, e.nextAction);
    return apiError(503, "store_unavailable", "We could not save your file. Try again.", "Try again.");
  }
  if (created.duplicate) {
    return Response.json({ ok: true, duplicate: true, message: "This document is already uploaded to your request.", file: employeeFile(created.file) }, { status: 200 });
  }

  // 2) Store the bytes privately. On failure, remove the record so nothing dangles.
  const fileId = created.file.id;
  try {
    await store.putFile(created.file.storagePath, bytes, type);
  } catch {
    await mutate(scenarioId, (s) => {
      s.evidence = s.evidence.filter((e) => e.id !== fileId);
      audit({ s, actor: user, real: new Date().toISOString() }, { caseId, type: "evidence.upload_failed", summary: `Storage of ${fileName} failed; the record was removed.` });
    }).catch(() => null);
    return apiError(503, "store_unavailable", "We could not save your file. Try again.", "Try again.");
  }

  // 3) Read (model → fixture hash → manual). Never blocks the form on AI.
  const read = await readDocument(bytes, sha256, type, created.eventCode);

  // 4) Record the result against the latest form values.
  try {
    const file = await mutate(scenarioId, (s) => {
      const f = s.evidence.find((e) => e.id === fileId);
      const c = s.cases.find((x) => x.id === caseId);
      if (!f || !c) throw new DomainError(404, "file_not_found", "We could not find that document.");
      const ctx: Ctx = { s, actor: user, real: new Date().toISOString() };
      const facts = read.extraction ? toProposedFacts(read.extraction, c) : [];
      f.readMode = read.mode;
      f.proposedFacts = facts;
      f.documentType = read.extraction?.documentType ?? null;
      f.status = statusFor(read.extraction, facts);
      f.readNote = readNoteFor(read, c, facts);
      const conflicts = facts.filter((p) => p.conflictWith).length;
      const toConfirm = facts.filter((p) => p.field !== "documentType").length;
      if (read.mode !== "model") {
        aiLog(ctx, { caseId: c.id, kind: "model_unavailable", label: "AI reading unavailable", detail: `AI reading was not used (${read.failure ?? "unavailable"}). ${read.mode === "fixture_hash" ? "Used synthetic fixture parsing (hash match)." : "Sent to manual review: HR will read this document."}`, model: read.model });
      }
      if (read.mode !== "manual") {
        aiLog(ctx, {
          caseId: c.id,
          kind: "document_read",
          label: read.mode === "model" ? "Document read" : "Document read (synthetic fixture parsing)",
          detail: f.status === "unreadable" ? `${fileId} could not be read. A clearer copy of the exact document is needed.` : `${fileId} read as "${f.documentType}".${read.extraction?.uncertainFields.includes("embedded_instructions") ? " Embedded instructions were treated as data." : ""}`,
          model: read.mode === "model" ? read.model : null,
        });
        if (toConfirm) aiLog(ctx, { caseId: c.id, kind: "facts_proposed", label: "Facts proposed", detail: `${toConfirm} value${toConfirm === 1 ? "" : "s"} proposed for the employee to confirm${conflicts ? `; ${conflicts} differ${conflicts === 1 ? "s" : ""} from the form (form kept)` : ""}.`, model: read.mode === "model" ? read.model : null });
      }
      audit(ctx, {
        caseId: c.id,
        type: "evidence.read",
        summary: `${f.fileName}: ${f.status.replaceAll("_", " ")} (${read.mode === "model" ? `AI reading, ${read.model}` : read.mode === "fixture_hash" ? `synthetic fixture parsing, hash match ${read.fixtureId}` : "manual review"}).${conflicts ? ` ${conflicts} document value(s) differ from the form; both kept.` : ""}`,
        employeeSummary: f.status === "unreadable" ? "We could not read your document." : f.status === "needs_confirmation" ? "Your document was read. Confirm the values." : "Your document is waiting for HR review.",
        data: { fileId, readMode: read.mode, status: f.status, conflicts },
      });
      return f;
    });
    return Response.json({ ok: true, message: messageFor(file, !!taskId), file: employeeFile(file) }, { status: 201 });
  } catch (e) {
    if (e instanceof DomainError) return apiError(e.status, e.code, e.message, e.nextAction);
    return apiError(503, "save_failed", "Your file was saved, but we could not record the reading. HR can still review it. Refresh to see it.", "Refresh the page.");
  }
}
