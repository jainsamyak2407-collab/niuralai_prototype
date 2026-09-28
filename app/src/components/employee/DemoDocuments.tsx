import { Download } from "lucide-react";
import type { EventCode } from "@/lib/contracts/domain";
import { DEMO_SET, type DemoEvent, SYNTHETIC_LABEL } from "@/lib/contracts/documents";
import { StatusPill } from "@/components/ui/primitives";

const EVENT_TO_DEMO: Partial<Record<EventCode, DemoEvent>> = {
  birth: "birth",
  adoption: "birth",
  placement_for_adoption: "birth",
  divorce: "divorce",
  loss_of_other_coverage: "loss",
};

/** Demo-only helper: synthetic sample files for this event, to download and then upload above. */
export function DemoDocuments({ eventCode, only }: { eventCode: EventCode; only?: "happy" | "problem" }) {
  const set = EVENT_TO_DEMO[eventCode];
  if (!set) return null;
  const docs = DEMO_SET[set].filter((d) => !only || d.kind === only);
  return (
    <div className="mt-4 rounded-[10px] border border-dashed border-line bg-canvas">
      <div className="border-b border-divider px-4 py-2.5">
        <p className="text-sm text-ink">Demo documents</p>
        <p className="text-xs text-muted">{SYNTHETIC_LABEL}. Download one, then upload it here. We read the file&apos;s contents, not its name.</p>
      </div>
      <ul className="divide-y divide-divider">
        {docs.map((d) => (
          <li key={d.fixtureId} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-ink">{d.label}</p>
                <StatusPill tone={d.kind === "happy" ? "green" : "amber"}>{d.kind === "happy" ? "Happy path" : "Problem document"}</StatusPill>
              </div>
              <p className="mt-0.5 text-xs text-muted">{d.whatHappens}</p>
            </div>
            <a href={`/api/fixtures/${d.fixtureId}`} download className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink hover:bg-fill">
              <Download className="size-4" aria-hidden /> Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
