import { ArrowRight } from "lucide-react";
import type { HrCaseView } from "@/server/views";
import { plan, RATE_VERSION, TIER_LABEL } from "@/server/config/plans";
import {
  DateText,
  EmptyState,
  Money,
  Section,
  Table,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import { ACTION, BENEFIT } from "../labels";
import { lineDate, nameLookup } from "./shared";

/** Change summary: before/after people, plans, levels, dates and money per paycheck. */
export function SummarySection({ v }: { v: HrCaseView }) {
  const ev = v.evaluation;
  const nameOf = nameLookup(v);
  if (!ev || !ev.proposedLines.length) {
    return (
      <Section id="summary" title="Change summary" bodyClassName="">
        <EmptyState title="No coverage change proposed yet">
          The rules have not produced a coverage change for this request. Check
          the missing facts under Checks, or record a decision.
        </EmptyState>
      </Section>
    );
  }
  const people = (benefit: string) => {
    const current = new Set(
      v.currentElections.find((e) => e.benefit === benefit)?.covered ?? [],
    );
    const lines = ev.proposedLines.filter((l) => l.benefit === benefit);
    const ended = new Set(
      lines
        .filter((l) => l.action === "terminate")
        .map((l) => nameOf(l.personId)),
    );
    const added = new Set(
      lines.filter((l) => l.action === "add").map((l) => nameOf(l.personId)),
    );
    // Works before and after the host elections are replaced.
    const before = [...new Set([...current, ...ended])].filter(
      (n) => !added.has(n),
    );
    const after = [...before.filter((n) => !ended.has(n)), ...added];
    return { before, after, ended, added };
  };
  const diff = ev.totalAfterCents - ev.totalBeforeCents;
  const fc = ev.adjustmentForecast;

  return (
    <Section
      id="summary"
      title="Change summary"
      description={`Employee cost per semi-monthly paycheck, from rate table ${RATE_VERSION}.`}
      bodyClassName=""
    >
      <Table label="Before and after by benefit">
        <THead>
          <tr>
            <Th>Benefit</Th>
            <Th>Before</Th>
            <Th className="w-8" />
            <Th>After</Th>
            <Th align="right">Cost before</Th>
            <Th align="right">Cost after</Th>
            <Th align="right">Difference</Th>
            <Th>Effective</Th>
          </tr>
        </THead>
        <tbody>
          {ev.costs.map((c) => {
            const p = people(c.benefit);
            return (
              <tr key={c.benefit}>
                <Td className="font-medium">{BENEFIT[c.benefit]}</Td>
                <Td>
                  <p className="text-ink">
                    {plan(c.planBefore).shortName} · {TIER_LABEL[c.tierBefore]}
                  </p>
                  <p className="text-[13px] text-muted">
                    {p.before.join(", ") || "No one"}
                  </p>
                </Td>
                <Td className="text-muted">
                  <ArrowRight className="size-4" aria-label="changes to" />
                </Td>
                <Td>
                  <p className="text-ink">
                    {plan(c.planAfter).shortName} · {TIER_LABEL[c.tierAfter]}
                  </p>
                  <p className="text-[13px] text-muted">
                    {p.after.map((n, i) => (
                      <span key={n}>
                        {i ? ", " : ""}
                        {p.added.has(n) ? (
                          <span className="text-success-text">{n} (added)</span>
                        ) : (
                          n
                        )}
                      </span>
                    ))}
                    {p.ended.size ? (
                      <span className="text-danger-text">
                        {p.after.length ? " · " : ""}
                        {[...p.ended].join(", ")} ends
                      </span>
                    ) : null}
                  </p>
                </Td>
                <Td align="right">
                  <Money cents={c.beforeCents} />
                </Td>
                <Td align="right">
                  <Money cents={c.afterCents} />
                </Td>
                <Td align="right">
                  <Money cents={c.afterCents - c.beforeCents} sign />
                </Td>
                <Td className="whitespace-nowrap">
                  <DateText date={c.effectiveDate} />
                </Td>
              </tr>
            );
          })}
          <tr className="bg-canvas">
            <Td className="font-medium">Total per paycheck</Td>
            <Td />
            <Td />
            <Td />
            <Td align="right" className="font-medium">
              <Money cents={ev.totalBeforeCents} />
            </Td>
            <Td align="right" className="font-medium">
              <Money cents={ev.totalAfterCents} />
            </Td>
            <Td align="right" className="font-medium">
              <Money cents={diff} sign />
            </Td>
            <Td />
          </tr>
        </tbody>
      </Table>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_minmax(280px,380px)]">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium text-ink">
            Coverage lines in this version
          </h3>
          <ul className="divide-y divide-divider rounded-[8px] border border-line text-[13px]">
            {ev.proposedLines.map((l, i) => (
              <li
                key={i}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 px-3 py-2"
              >
                <span className="truncate text-ink">{nameOf(l.personId)}</span>
                <span className="text-ink-2">
                  {BENEFIT[l.benefit]} · {ACTION[l.action]}
                </span>
                <span className="truncate text-muted">
                  {plan(l.planId).shortName} · {TIER_LABEL[l.tierAfter]}
                </span>
                <span className="tabular whitespace-nowrap text-ink">
                  {lineDate(l)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium text-ink">
            Adjustment forecast
          </h3>
          {fc ? (
            <dl className="rounded-[8px] border border-line px-3 py-2.5 text-[13px]">
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">Target paycheck</dt>
                <dd className="tabular text-ink">
                  <DateText date={fc.targetPayday} />
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">One-time adjustment</dt>
                <dd>
                  <Money cents={fc.adjustmentCents} sign />
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">New total per paycheck</dt>
                <dd>
                  <Money cents={ev.totalAfterCents} />
                </dd>
              </div>
              <p className="mt-1.5 border-t border-divider pt-2 text-muted">
                {fc.basis}
              </p>
              {fc.forecastAssumesScheduled ? (
                <p className="mt-1 text-warning-text">
                  Assumes an earlier scheduled run posts as planned.
                </p>
              ) : null}
            </dl>
          ) : (
            <p className="text-[13px] text-muted">
              No payroll forecast yet. It appears once dates and plans are
              known.
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            A forecast is not a deduction. Pay changes only after carrier
            confirmation and an authorized payroll instruction.
          </p>
        </div>
      </div>
    </Section>
  );
}
