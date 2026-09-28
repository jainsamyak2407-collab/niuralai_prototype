"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, X } from "lucide-react";
import { StatusPill } from "@/components/ui/primitives";
import { fmtBytes } from "./labels";

export const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png"];

interface LocalItem {
  id: string;
  name: string;
  size: number;
  phase: "uploading" | "reading" | "rejected" | "error";
  message?: string;
}

interface UploadBody {
  ok: boolean;
  message?: string;
  file?: { id: string; status: string };
}

function upload(url: string, form: FormData, onSent: () => void): Promise<{ status: number; body: UploadBody | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onload = onSent;
    xhr.onload = () => {
      let body: UploadBody | null = null;
      try {
        body = JSON.parse(xhr.responseText) as UploadBody;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => resolve({ status: 0, body: null });
    xhr.send(form);
  });
}

/**
 * Evidence upload (PDF, JPEG, PNG up to 10 MB). Client checks are a convenience; the
 * server validates type, content and ownership again. Uploading and reading are shown as
 * separate states; the final state comes from the server's record.
 */
export function EvidenceUploader({ caseId, taskId, compact = false }: { caseId: string; taskId?: string; compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [drag, setDrag] = useState(false);
  const pendingFiles = useRef(new Map<string, File>());
  const patch = (id: string, p: Partial<LocalItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function handle(files: FileList | File[] | null, retryId?: string) {
    for (const file of Array.from(files ?? [])) {
      const id = retryId ?? `${Date.now()}-${Math.random()}`;
      if (retryId) setItems((xs) => xs.filter((x) => x.id !== retryId));
      const base = { id, name: file.name, size: file.size };
      if (!TYPES.includes(file.type)) {
        setItems((xs) => [...xs, { ...base, phase: "rejected", message: "Use a PDF, JPEG or PNG file." }]);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setItems((xs) => [...xs, { ...base, phase: "rejected", message: "This file is larger than 10 MB." }]);
        continue;
      }
      setItems((xs) => [...xs, { ...base, phase: "uploading" }]);
      pendingFiles.current.set(id, file);
      const form = new FormData();
      form.append("file", file);
      if (taskId) form.append("taskId", taskId);
      const { status, body } = await upload(`/api/qle/cases/${caseId}/evidence`, form, () => patch(id, { phase: "reading" }));
      if (status === 404 || status === 405 || status === 501) {
        patch(id, { phase: "error", message: "Document upload is not available yet. Choose “I don't have this document yet” and add it later." });
      } else if (status === 0) {
        patch(id, { phase: "error", message: "We could not reach the server. Your answers are still here. Try again." });
      } else if (!body?.ok) {
        patch(id, { phase: status === 415 || status === 413 || status === 422 ? "rejected" : "error", message: body?.message ?? "We could not upload this file. Try again." });
      } else {
        setItems((xs) => xs.filter((x) => x.id !== id));
        pendingFiles.current.delete(id);
        router.refresh();
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={`flex flex-col items-start gap-3 rounded-[10px] border border-dashed px-4 sm:flex-row sm:items-center ${compact ? "py-3" : "py-5"} ${drag ? "border-primary bg-tint-4" : "border-line bg-canvas"}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-primary">
          <FileUp className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-ink">Drag a file here, or choose one</p>
          <p className="text-[13px] text-muted">PDF, JPEG or PNG · up to 10 MB · Malware scanning is not configured in this demo.</p>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3.5 text-sm text-ink hover:bg-fill has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          Choose file
          <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => handle(e.target.files)} />
        </label>
      </div>
      {items.length ? (
        <ul className="space-y-2" aria-live="polite">
          {items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 rounded-[8px] border border-line px-3 py-2.5 text-sm">
              {x.phase === "uploading" || x.phase === "reading" ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted" aria-hidden /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">
                  {x.name} <span className="text-muted">· {fmtBytes(x.size)}</span>
                </p>
                {x.message ? <p className="text-[13px] text-danger-text">{x.message}</p> : null}
              </div>
              <StatusPill tone={x.phase === "rejected" || x.phase === "error" ? "red" : "blue"}>{x.phase === "uploading" ? "Uploading" : x.phase === "reading" ? "Reading" : x.phase === "rejected" ? "File rejected" : "Not uploaded"}</StatusPill>
              {x.phase === "error" && pendingFiles.current.has(x.id) ? (
                <button type="button" onClick={() => handle([pendingFiles.current.get(x.id)!], x.id)} className="text-[13px] text-primary hover:underline">
                  Try again
                </button>
              ) : null}
              {x.phase === "rejected" || x.phase === "error" ? (
                <button type="button" onClick={() => (pendingFiles.current.delete(x.id), setItems((xs) => xs.filter((y) => y.id !== x.id)))} className="grid size-6 place-items-center rounded-full text-muted hover:bg-fill" aria-label={`Dismiss ${x.name}`}>
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
