import type { CostLine, PayrollForecast } from "@/lib/contracts/domain";
import { DateText, Money, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/dates";
import { BENEFIT_LABEL, TIER_LABEL } from "./labels";

/** Before/after contribution per paycheck, computed by the rules engine from saved choices. */
export function CostTable({ costs, planName, totalBefore, totalAfter }: { costs: CostLine[]; planName: (id: string) => string; totalBefore: number; totalAfter: number }) {
  return (
    <Table label="Contribution per paycheck, before and after">
      <THead>
        <tr>
          <Th>Benefit</Th>
          <Th>Now</Th>
          <Th>After the change</Th>
          <Th>Starts</Th>
          <Th align="right">Now</Th>
          <Th align="right">After</Th>
          <Th align="right">Change</Th>
        </tr>
      </THead>
      <tbody>
        {costs.map((c) => (
          <tr key={c.benefit}>
            <Td>{BENEFIT_LABEL[c.benefit]}</Td>
            <Td>{c.planBefore ? `${planName(c.planBefore)} · ${TIER_LABEL[c.tierBefore]}` : <span className="text-muted">Not enrolled</span>}</Td>
            <Td>{c.planAfter === c.planBefore && c.tierAfter === c.tierBefore ? <span className="text-muted">No change</span> : `${planName(c.planAfter)} · ${TIER_LABEL[c.tierAfter]}`}</Td>
            <Td>{c.effectiveDate ? <DateText date={c.effectiveDate} /> : <span className="text-muted">—</span>}</Td>
            <Td align="right">
              <Money cents={c.beforeCents} />
            </Td>
            <Td align="right">
              <Money cents={c.afterCents} />
            </Td>
            <Td align="right">{c.afterCents === c.beforeCents ? <span className="text-muted">—</span> : <Money cents={c.afterCents - c.beforeCents} sign />}</Td>
          </tr>
        ))}
        <tr className="bg-canvas">
          <Td className="font-medium whitespace-nowrap">Total per paycheck</Td>
          <Td />
          <Td />
          <Td />
          <Td align="right" className="font-medium">
            <Money cents={totalBefore} />
          </Td>
          <Td align="right" className="font-medium">
            <Money cents={totalAfter} />
          </Td>
          <Td align="right" className="font-medium">
            {totalAfter === totalBefore ? <span className="text-muted">—</span> : <Money cents={totalAfter - totalBefore} sign />}
          </Td>
        </tr>
      </tbody>
    </Table>
  );
}

/** Payroll estimate. Never an issued deduction. */
export function ForecastBlock({ totalBefore, totalAfter, forecast }: { totalBefore: number; totalAfter: number; forecast: PayrollForecast | null }) {
  if (totalBefore === totalAfter && !forecast) {
    return <p className="text-sm text-ink">No change to your regular deduction.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="gray">Estimate</StatusPill>
        {forecast?.forecastAssumesScheduled ? <StatusPill tone="amber">Forecast — assumes the scheduled deduction posts</StatusPill> : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-[13px] text-muted">Regular deduction per paycheck</dt>
          <dd className="mt-0.5 text-ink">
            {totalBefore === totalAfter ? (
              "No change to your regular deduction."
            ) : (
              <>
                <Money cents={totalBefore} /> → <Money cents={totalAfter} />
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Estimated one-time adjustment</dt>
          <dd className="mt-0.5 text-ink">{forecast && forecast.adjustmentCents !== 0 ? <Money cents={forecast.adjustmentCents} sign /> : "None expected"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Affected paycheck</dt>
          <dd className="mt-0.5 text-ink">{forecast ? `${fmtDate(forecast.targetPayday)} (if approved in time)` : "Set after approval"}</dd>
        </div>
      </dl>
      {forecast?.basis ? <p className="text-[13px] text-muted">How we estimated it: {forecast.basis}</p> : null}
      <p className="text-[13px] text-muted">An estimate is not a deduction. Your pay changes only after HR approves, the insurance provider confirms the coverage, and payroll posts it. Take-home pay is not predicted.</p>
    </div>
  );
}
