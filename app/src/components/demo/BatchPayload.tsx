"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileCode2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { explain834 } from "@/lib/edi834-explain";
import { Why } from "./sim-kit";

type State = { kind: "loading" } | { kind: "ok"; text: string } | { kind: "missing" } | { kind: "error" };

/** The batch's illustrative 834 file: line-by-line reading, raw file and download. Used by HR and the carrier. */
export function BatchPayload({ batchId, label, tall = false, title }: { batchId: string; label: string; tall?: boolean; title?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [view, setView] = useState<"read" | "raw">("read");
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

  // The download carries a label line before the payload; the payload starts at ISA.
  const payload = useMemo(() => (state.kind === "ok" ? state.text.slice(Math.max(0, state.text.indexOf("ISA*"))).trim() : ""), [state]);
  const lines = useMemo(() => explain834(payload), [payload]);
  const height = tall ? "max-h-[60vh]" : "max-h-72";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <FileCode2 className="size-4 text-muted" aria-hidden />
          {title ?? `EDI 834 file · ${batchId}`}
        </p>
        {state.kind === "ok" ? (
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="File view" className="flex rounded-[8px] border border-line p-0.5">
              {(["read", "raw"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-[6px] px-2.5 py-1 text-xs ${view === k ? "bg-primary-soft text-primary-strong" : "text-muted hover:text-ink"}`}>
                  {k === "read" ? "Line by line" : "Raw file"}
                </button>
              ))}
            </div>
            <a href={href} download={`${batchId}.edi`} className={buttonClass("outline", "sm")}>
              <Download className="size-3.5" aria-hidden />
              Download .edi
            </a>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted">{label}. X12 5010 (005010X220A1) layout, generated from the same change orders as the member table.</p>
      {state.kind === "loading" ? (
        <div className="flex flex-col gap-1.5 rounded-[8px] border border-line p-3" aria-label="Loading file">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i % 2 ? "w-3/4" : "w-full"}`} />
          ))}
        </div>
      ) : state.kind === "ok" ? (
        view === "raw" ? (
          <pre tabIndex={0} aria-label={`834 file for ${batchId}`} className={`${height} overflow-auto rounded-[8px] border border-line bg-canvas p-3 font-mono text-[11px] leading-5 whitespace-pre text-ink-2`}>
            {payload}
          </pre>
        ) : (
          <div tabIndex={0} aria-label={`834 file for ${batchId}, line by line`} className={`${height} overflow-auto rounded-[8px] border border-line`}>
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-fill text-muted">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Segment</th>
                  <th className="px-3 py-1.5 font-medium">What it says</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className={`border-t border-divider ${l.segment.startsWith("INS*") ? "bg-tint-4" : ""}`}>
                    <td className={`px-3 py-1 font-mono whitespace-pre text-ink-2 ${l.member && !l.segment.startsWith("INS*") ? "pl-6" : ""}`}>{l.segment}</td>
                    <td className="px-3 py-1 text-ink">{l.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : state.kind === "missing" ? (
        <div className="rounded-[8px] border border-dashed border-line p-3">
          <Why>The file is not available for this batch yet. The decoded member table comes from the same change orders.</Why>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-[8px] border border-danger/30 bg-danger-soft p-3 text-sm">
          <span className="text-ink">We could not load the 834 file.</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
