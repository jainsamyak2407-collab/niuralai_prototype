"use client";

import { useState } from "react";
import { FileCode2 } from "lucide-react";
import { Sheet } from "@/components/ui/client";
import { BatchPayload } from "@/components/demo/BatchPayload";

/** Opens the batch's EDI 834 file: the same file the carrier receives. */
export function Edi834Button({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <FileCode2 className="size-3" aria-hidden />
        View 834 file
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`EDI 834 file · ${batchId}`} width={760}>
        {open ? <BatchPayload batchId={batchId} label="Illustrative 834 — not carrier-certified. This is the file the carrier received" tall /> : null}
      </Sheet>
    </>
  );
}
