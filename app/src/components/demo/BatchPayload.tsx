"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileCode2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { Why } from "./sim-kit";

type State = { kind: "loading" } | { kind: "ok"; text: string } | { kind: "missing" } | { kind: "error" };

/** Read-only preview of the illustrative 834 generated from the batch's change orders. */
export function BatchPayload({ batchId, label }: { batchId: string; label: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const href = `/api/documents/edi_834?batchId=${encodeURIComponent(batchId)}`;

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (res.status === 404) return setState({ kind: "missing" });
      if (!res.ok) return setState({ kind: "error" });
      setState({ kind: "ok", text: await res.text() });
    } catch {
      setState({ kind: "error" });
    }
  }, [href]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <FileCode2 className="size-4 text-muted" aria-hidden />
          Payload preview
        </p>
        {state.kind === "ok" ? (
          <a href={href} download={`${batchId}.edi`} className={buttonClass("outline", "sm")}>
            <Download className="size-3.5" aria-hidden />
            Download .edi
          </a>
        ) : null}
      </div>
      <p className="text-xs text-muted">{label}. Read-only; generated from the same change orders as the member table.</p>
      {state.kind === "loading" ? (
        <div className="flex flex-col gap-1.5 rounded-[8px] border border-line p-3" aria-label="Loading payload">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i % 2 ? "w-3/4" : "w-full"}`} />
          ))}
        </div>
      ) : state.kind === "ok" ? (
        <pre tabIndex={0} aria-label={`834 payload for ${batchId}`} className="max-h-64 overflow-auto rounded-[8px] border border-line bg-canvas p-3 font-mono text-[11px] leading-5 whitespace-pre text-ink-2">
          {state.text}
        </pre>
      ) : state.kind === "missing" ? (
        <div className="rounded-[8px] border border-dashed border-line p-3">
          <Why>The payload file is not available for this batch yet, so there is nothing to download. The decoded member table below comes from the same change orders.</Why>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-[8px] border border-danger/30 bg-danger-soft p-3 text-sm">
          <span className="text-ink">We could not load the payload preview.</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
