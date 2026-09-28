import Link from "next/link";
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { fmtDateTime } from "@/lib/dates";

// Server-safe chrome that marks every simulator surface as synthetic, so it can never be
// mistaken for a live carrier, payroll or COBRA connection.

/** Small "Simulated" tag for section headers and rows. */
export function SimTag({ children = "Simulated" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[5px] border border-dashed border-muted/50 bg-surface px-1.5 py-0.5 text-[11px] text-muted">
      <FlaskConical className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** Top-of-page banner: the simulator is synthetic and never reaches a real system. */
export function SimBanner({ scenarioTitle, now, roleLabel }: { scenarioTitle: string; now: string; roleLabel: string }) {
  return (
    <div role="note" aria-label="Synthetic simulator" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-dashed border-muted/40 bg-fill px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink">
        <FlaskConical className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">External systems simulator — synthetic</p>
        <p className="text-[13px] text-ink-2">Carrier, payroll, COBRA administrator and email are simulated. Nothing here reaches a real carrier, payroll provider or inbox.</p>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <div>
          <dt className="text-muted">Signed in as</dt>
          <dd className="text-ink">{roleLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">Scenario</dt>
          <dd className="text-ink">{scenarioTitle}</dd>
        </div>
        <div>
          <dt className="text-muted">Business time</dt>
          <dd className="tabular text-ink">{fmtDateTime(now)}</dd>
        </div>
      </dl>
    </div>
  );
}

export interface SimTabDef {
  id: string;
  label: string;
  count?: number;
}

/** Underline tabs driven by ?tab= links. */
export function SimTabs({ tabs, active, base }: { tabs: SimTabDef[]; active: string; base: string }) {
  return (
    <nav aria-label="Simulators" className="mb-5 flex flex-wrap gap-x-6 overflow-x-auto border-b border-divider">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={`${base}?tab=${t.id}`}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-sm whitespace-nowrap ${on ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.count ? <span className="rounded-[5px] bg-fill px-1.5 py-0.5 text-xs text-ink-2 tabular">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** "Sep 27, 2026" over "9:00 AM ET" so time columns stay narrow. */
export function SplitTime({ iso }: { iso: string }) {
  const full = fmtDateTime(iso);
  const cut = full.lastIndexOf(", ");
  return (
    <span className="tabular">
      {full.slice(0, cut)}
      <span className="block text-xs text-muted">{full.slice(cut + 2)}</span>
    </span>
  );
}
