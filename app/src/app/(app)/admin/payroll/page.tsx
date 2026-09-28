import Link from "next/link";
import { Banknote, CalendarClock } from "lucide-react";
import { requireSession } from "@/server/guard";
import { hrPayrollView } from "@/server/views";
import {
  Banner,
  DateText,
  EmptyState,
  Money,
  PageHeader,
  Section,
  StatusPill,
  Table,
  TableFooter,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import {
  AuthorizePayrollButton,
  PayrollCorrectionButton,
} from "@/components/hr/ExecutionActions";
import {
  BENEFIT,
  PAYROLL,
  TASK_KIND,
  displayOwner,
} from "@/components/hr/labels";

export default async function AdminPayrollPage() {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const v = await hrPayrollView(user, scenarioId);
  const instructions = v.instructions
    .slice()
    .sort(
      (a, b) =>
        a.payday.localeCompare(b.payday) ||
        a.caseNumber.localeCompare(b.caseNumber),
    );
  const runs = v.runs.slice().sort((a, b) => a.payday.localeCompare(b.payday));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Payroll changes"
        crumbs={[
          { label: "Benefits admin", href: "/admin" },
          { label: "Payroll changes" },
        ]}
        description={
          <>
            Benefit deduction changes from approved life events. Business time{" "}
            <DateText time={v.now} />.
          </>
        }
      />
      <Banner className="mb-4" title="Scheduled is not posted">
        An instruction waits for the carrier&apos;s matching record and HR
        authorization, then goes on its target run. A payslip changes only when
        that run posts and the posted amount matches. Posted payslips are never
        edited; differences are corrected on a later run.
      </Banner>

      <div className="flex flex-col gap-4">
        <Section title="Approved instructions" bodyClassName="">
          {instructions.length === 0 ? (
            <EmptyState icon={<Banknote />} title="No payroll instructions yet">
              Instructions appear after a life event is approved and the carrier
              confirms the change.
            </EmptyState>
          ) : (
            <Table label="Payroll instructions">
              <THead>
                <tr>
                  <Th>Case</Th>
                  <Th>Benefit</Th>
                  <Th align="right">Previous</Th>
                  <Th align="right">New</Th>
                  <Th align="right">Adjustment</Th>
                  <Th align="right">Total on payday</Th>
                  <Th>Target payday</Th>
                  <Th>State</Th>
                  <Th align="right" className="relative">
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {instructions.map((i) => {
                  const posted =
                    (i.postedCents ?? 0) + (i.postedAdjustmentCents ?? 0);
                  return (
                    <tr key={i.id} className="align-top">
                      <Td className="align-top!">
                        <Link
                          href={`/admin/qle/${i.caseId}#payroll`}
                          className="tabular text-primary hover:underline"
                        >
                          {i.caseNumber}
                        </Link>
                        <p className="text-[13px] text-ink-2">
                          {i.employeeName}
                        </p>
                      </Td>
                      <Td className="align-top!">
                        {BENEFIT[i.benefit]}
                        {i.correctionOf ? (
                          <p className="text-xs text-muted">
                            Correction of {i.correctionOf}
                          </p>
                        ) : null}
                      </Td>
                      <Td align="right" className="align-top!">
                        <Money cents={i.previousRecurringCents} />
                      </Td>
                      <Td align="right" className="align-top!">
                        <Money cents={i.newRecurringCents} />
                      </Td>
                      <Td align="right" className="max-w-[300px] align-top!">
                        <Money cents={i.adjustmentCents} sign />
                        <p className="mt-0.5 text-left text-xs text-muted">
                          {i.adjustmentBasis}
                        </p>
                      </Td>
                      <Td align="right" className="align-top!">
                        <Money cents={i.totalCents} />
                        {i.state === "mismatch" ? (
                          <p className="text-xs text-danger-text">
                            Posted <Money cents={posted} />
                          </p>
                        ) : null}
                      </Td>
                      <Td className="align-top!">
                        <DateText date={i.payday} />
                        <p className="text-xs text-muted">
                          Cutoff <DateText time={i.cutoffAt} />
                        </p>
                      </Td>
                      <Td className="align-top!">
                        <StatusPill tone={PAYROLL[i.state].tone}>
                          {PAYROLL[i.state].label}
                        </StatusPill>
                      </Td>
                      <Td align="right" className="align-top!">
                        {i.state === "approval_needed" ? (
                          <AuthorizePayrollButton
                            instructionId={i.id}
                            benefit={BENEFIT[i.benefit]}
                            adjustmentCents={i.adjustmentCents}
                            payday={i.payday}
                          />
                        ) : null}
                        {i.state === "mismatch" ? (
                          <PayrollCorrectionButton
                            instructionId={i.id}
                            expectedCents={i.totalCents}
                            postedCents={posted}
                          />
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Section
            title="Pay runs"
            description="Simulated host payroll. Totals are the posted benefit deductions only."
            bodyClassName=""
          >
            <Table label="Pay runs">
              <THead>
                <tr>
                  <Th>Payday</Th>
                  <Th>Period</Th>
                  <Th>Status</Th>
                  <Th align="right">Benefit deductions</Th>
                </tr>
              </THead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">
                      <DateText date={r.payday} />
                    </Td>
                    <Td className="tabular whitespace-nowrap text-ink-2">
                      <DateText date={r.periodStart} /> –{" "}
                      <DateText date={r.periodEnd} />
                    </Td>
                    <Td>
                      {r.status === "posted" ? (
                        <StatusPill tone="green">Posted</StatusPill>
                      ) : (
                        <StatusPill tone="gray">Scheduled</StatusPill>
                      )}
                    </Td>
                    <Td align="right">
                      {r.status === "posted" ? (
                        <Money cents={r.totalCents} />
                      ) : (
                        <span className="text-muted">Not posted</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span>
                {runs.filter((r) => r.status === "posted").length} posted ·{" "}
                {runs.filter((r) => r.status === "scheduled").length} scheduled
              </span>
              <span>Paydays: the 15th and the last business day</span>
            </TableFooter>
          </Section>

          <Section title="Open payroll tasks" bodyClassName="">
            {v.tasks.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title="No open payroll tasks"
              >
                Authorizations and posted-amount differences appear here with an
                owner and a due time.
              </EmptyState>
            ) : (
              <Table label="Open payroll tasks">
                <THead>
                  <tr>
                    <Th>Task</Th>
                    <Th>Owner</Th>
                    <Th>Due</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.tasks.map((t) => {
                    const overdue = !!t.dueAt && t.dueAt < v.now;
                    return (
                      <tr key={t.id}>
                        <Td>
                          <Link
                            href={`/admin/qle/${t.caseId}#payroll`}
                            className="text-primary hover:underline"
                          >
                            {t.title}
                          </Link>
                          <p className="text-[13px] text-muted">
                            {TASK_KIND[t.kind]}
                          </p>
                        </Td>
                        <Td>
                          {displayOwner(t.ownerName)}
                          <p className="text-xs text-muted">
                            Backup {displayOwner(t.backupName)}
                          </p>
                        </Td>
                        <Td>
                          <DateText
                            time={t.dueAt}
                            className={overdue ? "text-danger-text" : ""}
                          />
                          {overdue ? (
                            <p className="text-xs text-danger-text">Overdue</p>
                          ) : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
