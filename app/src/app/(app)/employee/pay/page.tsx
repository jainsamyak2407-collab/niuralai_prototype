import Link from "next/link";
import { Download, Receipt, Wallet } from "lucide-react";
import { Banner, Card, DateText, EmptyState, Money, PageHeader, Section, StatusPill, Table, TableFooter, Tag, Td, Th, THead } from "@/components/ui/primitives";
import { BENEFIT_LABEL, PAYROLL_STATE } from "@/components/employee/labels";
import { requireSession } from "@/server/guard";
import { employeePayView } from "@/server/views";
import { fmtDate, fmtDateTime } from "@/lib/dates";

export default async function PayPage() {
  const { user, scenarioId } = await requireSession(["employee"]);
  const v = await employeePayView(user, scenarioId);
  const latest = v.payslips[0] ?? null;
  const recurringNow = v.upcoming[0]?.benefitLines.reduce((a, l) => a + l.recurringCents, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Pay" crumbs={[{ label: "Benefits", href: "/employee/benefits" }, { label: "Pay" }]} description="Posted payslips, upcoming payroll and any benefit changes that affect your deductions." />
      <Banner title="How these numbers work">
        {v.fixtureNote} Future take-home pay is not predicted. Estimates from open requests are never shown as a deduction.
      </Banner>

      <Section title="Upcoming payroll" description="Your regular benefit deductions and any approved change scheduled for a paycheck." bodyClassName="">
        {v.upcoming.length ? (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            {v.upcoming.map((r) => {
              const regular = r.benefitLines.reduce((a, l) => a + l.recurringCents, 0);
              const change = r.instructions;
              const total = change.length ? regular + change.reduce((a, i) => a + (i.newCents - i.previousCents) + i.adjustmentCents, 0) : regular;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base text-ink">Paycheck {fmtDate(r.payday)}</p>
                    {change.length ? <StatusPill tone={PAYROLL_STATE[change[0].state].tone}>{PAYROLL_STATE[change[0].state].label}</StatusPill> : <Tag>Regular</Tag>}
                  </div>
                  <p className="mt-1 text-[13px] text-warning-text">Cutoff: {fmtDateTime(r.cutoffAt)}</p>
                  <dl className="mt-3 space-y-1.5 border-t border-divider pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Pay period</dt>
                      <dd className="tabular text-ink">
                        {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Benefit deductions</dt>
                      <dd className="text-ink">
                        <Money cents={total} />
                      </dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Wallet aria-hidden />} title="No upcoming payroll">
            Paychecks appear here once the next pay run is scheduled.
          </EmptyState>
        )}
      </Section>

      <Section title="Approved scheduled changes" description="Changes that payroll will apply. They appear only after HR approval and a matching insurance record." bodyClassName="">
        {v.scheduledChanges.length ? (
          <Table label="Approved scheduled changes">
            <THead>
              <tr>
                <Th>Request</Th>
                <Th>Benefit</Th>
                <Th align="right">Previous regular</Th>
                <Th align="right">New regular</Th>
                <Th align="right">One-time adjustment</Th>
                <Th align="right">Total benefit deduction</Th>
                <Th>Effective from</Th>
                <Th>Target paycheck</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {v.scheduledChanges.map((i) => (
                <tr key={i.id}>
                  <Td className="tabular">{i.caseNumber}</Td>
                  <Td>{BENEFIT_LABEL[i.benefit]}</Td>
                  <Td align="right">
                    <Money cents={i.previousCents} />
                  </Td>
                  <Td align="right">
                    <Money cents={i.newCents} />
                  </Td>
                  <Td align="right">{i.adjustmentCents ? <Money cents={i.adjustmentCents} sign /> : <span className="text-muted">None</span>}</Td>
                  <Td align="right">
                    <Money cents={i.newCents + i.adjustmentCents} />
                  </Td>
                  <Td>
                    <DateText date={i.effectiveFrom} />
                  </Td>
                  <Td>
                    <DateText date={i.payday} />
                  </Td>
                  <Td>
                    <StatusPill tone={PAYROLL_STATE[i.state].tone}>{PAYROLL_STATE[i.state].label}</StatusPill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">No approved changes are scheduled. Your regular benefit deduction is <Money cents={recurringNow} className="text-ink" /> per paycheck.</p>
        )}
      </Section>

      {v.proposals.length ? (
        <Section title="Proposed changes from open requests" description="Proposed — not a deduction. These update as you compare plans and change only after approval and insurance confirmation." bodyClassName="">
          <Table label="Proposed changes">
            <THead>
              <tr>
                <Th>Request</Th>
                <Th>Event</Th>
                <Th align="right">Regular now</Th>
                <Th align="right">Proposed regular</Th>
                <Th align="right">Estimated adjustment</Th>
                <Th>Estimated paycheck</Th>
                <Th>Label</Th>
              </tr>
            </THead>
            <tbody>
              {v.proposals.map((p) => (
                <tr key={p.caseId}>
                  <Td className="tabular">
                    <Link href={p.status === "draft" ? `/employee/life-events/${p.caseId}/options` : `/employee/cases/${p.caseId}`} className="text-primary hover:underline">
                      {p.caseNumber}
                    </Link>
                  </Td>
                  <Td>{p.event}</Td>
                  <Td align="right">
                    <Money cents={p.totalBeforeCents} />
                  </Td>
                  <Td align="right">{p.totalAfterCents === p.totalBeforeCents ? <span className="text-muted">No change</span> : <Money cents={p.totalAfterCents} />}</Td>
                  <Td align="right">{p.forecast?.adjustmentCents ? <Money cents={p.forecast.adjustmentCents} sign /> : <span className="text-muted">None</span>}</Td>
                  <Td>{p.forecast ? <DateText date={p.forecast.targetPayday} /> : <span className="text-muted">After approval</span>}</Td>
                  <Td>
                    <StatusPill tone="gray">Proposed — not a deduction</StatusPill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : null}

      <Section
        title="Latest payslip"
        description={latest ? `Pay period ${fmtDate(latest.periodStart)} – ${fmtDate(latest.periodEnd)} · paid ${fmtDate(latest.payday)}` : undefined}
        actions={
          latest ? (
            <>
              <Tag>Posted simulated payslip</Tag>
              <a href={`/api/documents/payslip?runId=${latest.runId}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Download className="size-4" aria-hidden /> Download
              </a>
            </>
          ) : null
        }
        bodyClassName=""
      >
        {latest ? (
          <>
            {latest.insufficientWages ? (
              <div className="px-5 pt-4">
                <Banner tone="warning" title="Deductions exceed pay for this period">
                  Payroll reviews an installment or another way to collect. Net pay is never forced below zero.
                </Banner>
              </div>
            ) : null}
            <Table label="Latest posted payslip">
              <THead>
                <tr>
                  <Th>Line</Th>
                  <Th align="right">Regular</Th>
                  <Th align="right">Adjustment</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </THead>
              <tbody>
                <tr>
                  <Td>Gross pay</Td>
                  <Td />
                  <Td />
                  <Td align="right">
                    <Money cents={latest.grossCents} />
                  </Td>
                </tr>
                {latest.benefits.map((b) => (
                  <tr key={b.benefit}>
                    <Td className="pl-8">{BENEFIT_LABEL[b.benefit]} (pre-tax)</Td>
                    <Td align="right">
                      <Money cents={b.recurringCents} />
                    </Td>
                    <Td align="right">{b.adjustmentCents ? <Money cents={b.adjustmentCents} /> : <span className="text-muted">—</span>}</Td>
                    <Td align="right">
                      <Money cents={-(b.recurringCents + b.adjustmentCents)} />
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="pl-8">Retirement contribution (6%)</Td>
                  <Td />
                  <Td />
                  <Td align="right">
                    <Money cents={-latest.retirementCents} />
                  </Td>
                </tr>
                {latest.withholding.map((w) => (
                  <tr key={w.label}>
                    <Td className="pl-8">{w.label}</Td>
                    <Td />
                    <Td />
                    <Td align="right">
                      <Money cents={-w.cents} />
                    </Td>
                  </tr>
                ))}
                <tr className="bg-canvas">
                  <Td className="font-medium">Net pay</Td>
                  <Td />
                  <Td />
                  <Td align="right" className="font-medium">
                    <Money cents={latest.netCents} />
                  </Td>
                </tr>
              </tbody>
            </Table>
            <TableFooter>
              <span>
                Benefits <Money cents={latest.benefitTotalCents} className="text-ink" /> · Retirement <Money cents={latest.retirementCents} className="text-ink" /> · Withholding (illustrative) <Money cents={latest.taxTotalCents} className="text-ink" />
              </span>
              <span>Posted {fmtDateTime(latest.postedAt)}</span>
            </TableFooter>
          </>
        ) : (
          <EmptyState icon={<Receipt aria-hidden />} title="No posted payslips yet">
            A payslip appears here after payroll posts a pay run.
          </EmptyState>
        )}
      </Section>

      <Section title="Payslip history" bodyClassName="">
        {v.payslips.length ? (
          <>
            <Table label="Posted payslips">
              <THead>
                <tr>
                  <Th>Payday</Th>
                  <Th>Pay period</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Benefit deductions</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Payslip</Th>
                </tr>
              </THead>
              <tbody>
                {v.payslips.map((p) => (
                  <tr key={p.runId}>
                    <Td>
                      <DateText date={p.payday} />
                    </Td>
                    <Td className="tabular">
                      {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                    </Td>
                    <Td align="right">
                      <Money cents={p.grossCents} />
                    </Td>
                    <Td align="right">
                      <Money cents={p.benefitTotalCents} />
                    </Td>
                    <Td align="right">
                      <Money cents={p.netCents} />
                    </Td>
                    <Td align="right">
                      <a href={`/api/documents/payslip?runId=${p.runId}`} className="inline-flex items-center gap-1 text-primary hover:underline" aria-label={`Download payslip for ${fmtDate(p.payday)}`}>
                        <Download className="size-4" aria-hidden /> Download
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span>
                {v.payslips.length} posted payslip{v.payslips.length === 1 ? "" : "s"}. Posted payslips never change.
              </span>
            </TableFooter>
          </>
        ) : (
          <EmptyState icon={<Receipt aria-hidden />} title="No payslip history">
            Posted payslips will be listed here.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
