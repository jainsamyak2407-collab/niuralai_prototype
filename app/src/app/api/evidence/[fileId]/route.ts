import type { DemoUser, EvidenceFile, ScenarioState } from "@/lib/contracts/domain";
import { audit, type Ctx } from "@/server/domain/ctx";
import { apiError, fileResponse, sessionFor } from "@/server/docs/http";
import { mutate } from "@/server/runner";
import { getStore } from "@/server/store/store";
import { loadState } from "@/server/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/evidence/{fileId}[?download=1] — authorized preview of an uploaded document.
// Owner employee, HR of the same employer, or the broker assigned a task on the case once
// HR has reviewed the file. Every access is audited. Anyone else gets a 404.

function mayAccess(s: ScenarioState, user: DemoUser, f: EvidenceFile): boolean {
  const c = s.cases.find((x) => x.id === f.caseId);
  if (!c) return false;
  if (user.role === "employee") return c.employeeId === user.personId;
  if (user.role === "hr_admin") return c.employerId === user.employerId && c.status !== "draft";
  if (user.role === "broker") return !!f.reviewedBy && f.status === "accepted_for_review" && s.tasks.some((t) => t.caseId === c.id && t.kind === "broker_correction" && t.ownerId === user.id);
  return false;
}

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await sessionFor();
  if ("error" in auth) return auth.error;
  const { user, scenarioId } = auth.session;
  const { fileId } = await params;
  if (!/^[\w-]{1,80}$/.test(fileId)) return apiError(404, "file_not_found", "We could not find that document.");
  let state: ScenarioState;
  try {
    state = await loadState(scenarioId);
  } catch {
    return apiError(503, "store_unavailable", "We could not reach saved documents. Try again.", "Try again.");
  }
  const f = state.evidence.find((e) => e.id === fileId);
  if (!f || !mayAccess(state, user, f)) return apiError(404, "file_not_found", "We could not find that document.");

  const stored = await getStore().getFile(f.storagePath).catch(() => null);
  if (!stored) return apiError(404, "file_missing", "This document is no longer available. Ask the employee to upload it again.");

  // Access must be audited before the bytes leave the server.
  const download = new URL(req.url).searchParams.get("download") === "1";
  try {
    await mutate(scenarioId, (s) => {
      const ctx: Ctx = { s, actor: user, real: new Date().toISOString() };
      audit(ctx, { caseId: f.caseId, type: "file.accessed", summary: `${user.name} (${user.role.replace("_", " ")}) ${download ? "downloaded" : "opened"} ${f.fileName}.`, data: { fileId: f.id, role: user.role } });
    });
  } catch {
    return apiError(503, "audit_unavailable", "We could not record this access, so the document was not opened. Try again.", "Try again.");
  }
  return fileResponse(stored.bytes, f.mimeType, f.fileName, download ? "attachment" : "inline");
}
