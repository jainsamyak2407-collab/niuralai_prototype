import { AlertTriangle, Clock, Download } from "lucide-react";
import type { HrCaseView } from "@/server/views";
import { plan } from "@/server/config/plans";
import { buttonClass } from "@/components/ui/button";
import {
  Banner,
  DateText,
  LabelValue,
  Money,
  Section,
  StatusPill,
  Table,
  Tag,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import {
  AuthorizePayrollButton,
  CobraSendButton,
  DeliveryInquiryButton,
  LineActions,
  PayrollCorrectionButton,
  ResolveTaskButton,
  SendBatchButton,
  CobraNoticeButton,
} from "../ExecutionActions";
import { Edi834Button } from "../Edi834Button";
import {
  BENEFIT,
  COBRA,
  COVERAGE,
  DELIVERY,
  MANUAL_TASK_KINDS,
  MEMBER_RESULT,
  PAYROLL,
  ROUTE,
  TASK_KIND,
  displayOwner,
} from "../labels";
import { lineDate, lineFailed } from "./shared";

// Execution after approval: coverage lines, carrier transactions, payroll, COBRA,
// tasks and documents. Every state shown is a stored record, never a guess.

export function CoverageSection({ v }: { v: HrCaseView }) {
  const unknownBatches = [
    ...new Map(
      v.txns
        .filter((t) => t.batch?.transport === "unknown")
        .map((t) => [t.batch!.id, t.batch!]),
    ).values(),
  ];
  return (
    <Section
      id="coverage"
      title="Carrier delivery and coverage"
      actions={
        <span className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          Next nightly batch: <DateText time={v.nextBatchAt} />
          <SendBatchButton records={v.queuedRecords} />
        </span>
      }
      bodyClassName=""
    >
      {unknownBatches.map((b) => (
        <div key={b.id} className="border-b border-divider px-5 py-3">
          <Banner
            tone="warning"
            title={`Delivery unknown for ${b.id}`}
            action={<DeliveryInquiryButton batchId={b.id} />}
          >
            We sent the file but have no transport receipt. Resending is
            blocked: a blind resend could duplicate an enrollment or
            termination. Ask the carrier and record the answer first.
          </Banner>
        </div>
      ))}
      {v.lines.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">
          Nothing sent yet. After approval, each person and benefit becomes a
          line here with its delivery, the carrier&apos;s record and the
          coverage result.
        </p>
      ) : (
        <Table label="Coverage lines">
          <THead>
            <tr>
              <Th className="min-w-[190px]">Line</Th>
              <Th className="min-w-[210px]">Requested</Th>
              <Th>Carrier record</Th>
              <Th>Delivery</Th>
              <Th>Coverage</Th>
              <Th align="right" className="relative">
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {v.lines.map((l) => {
              const failed = lineFailed(v, l);
              const cov = COVERAGE[l.coverageState];
              return (
                <tr key={l.id} className="align-top">
                  <Td className="align-top!">
                    <p className="text-ink">{l.person}</p>
                    <p className="text-[13px] text-muted">
                      {BENEFIT[l.benefit]} ·{" "}
                      {l.action === "terminate"
                        ? "End coverage"
                        : l.action === "add"
                          ? "Add coverage"
                          : "Change level"}{" "}
                      · {ROUTE[l.route]}
                    </p>
                  </Td>
                  <Td className="align-top!">
                    <p className="text-ink">
                      {l.planName} · {l.tierLabel}
                    </p>
                    <p className="tabular text-[13px] text-ink-2">
                      {lineDate(l)}
                    </p>
                  </Td>
                  <Td className="align-top!">
                    {l.observed ? (
                      <>
                        <p
                          className={
                            l.mismatch ? "text-danger-text" : "text-ink"
                          }
                        >
                          {l.observed.planName} · {l.observed.tierLabel}
                        </p>
                        <p
                          className={`tabular text-[13px] ${l.mismatch ? "text-danger-text" : "text-ink-2"}`}
                        >
                          {lineDate({
                            action: l.action,
                            startDate: l.observed.startDate,
                            endDate: l.observed.endDate,
                          })}
                        </p>
                        <p className="text-xs text-muted">
                          {l.observed.sourceRef} ·{" "}
                          <DateText time={l.observed.observedAt} />
                        </p>
                      </>
                    ) : (
                      <span className="text-[13px] text-muted">
                        No carrier record yet
                      </span>
                    )}
                  </Td>
                  <Td className="align-top!">
                    {l.delivery ? (
                      <StatusPill tone={DELIVERY[l.delivery].tone}>
                        {DELIVERY[l.delivery].label}
                      </StatusPill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {l.memberResult ? (
                      <p className="mt-1 text-xs text-muted">
                        Member:{" "}
                        {MEMBER_RESULT[l.memberResult].label.toLowerCase()}
                        {l.memberReason ? ` (${l.memberReason})` : ""}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="align-top!">
                    <StatusPill tone={cov.tone}>{cov.label}</StatusPill>
                  </Td>
                  <Td align="right" className="align-top!">
                    {failed ? (
                      <LineActions
                        caseId={v.case.id}
                        lineId={l.id}
                        label={`${l.person} · ${BENEFIT[l.benefit]} · ${l.planName} ${l.tierLabel} · ${lineDate(l)}`}
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {v.lines.some((l) => l.mismatch) ? (
        <ul className="flex flex-col gap-2 border-b border-divider px-5 py-3">
          {v.lines
            .filter((l) => l.mismatch)
            .map((l) => (
              <li
                key={l.id}
                className="flex items-start gap-2 text-sm text-danger-text"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-danger"
                  aria-hidden
                />
                <span>
                  {l.mismatch!.message}{" "}
                  <span className="text-muted">
                    Both values are kept. Completion and the payroll change for
                    this benefit are paused.
                  </span>
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      {v.txns.length ? (
        <div className="px-5 pt-4 pb-5">
          <h3 className="mb-2 text-sm font-medium text-ink">
            Carrier transactions
          </h3>
          <div className="overflow-hidden rounded-[8px] border border-line">
            <Table label="Carrier transactions">
              <THead>
                <tr>
                  <Th>Transaction</Th>
                  <Th>Change</Th>
                  <Th>Route</Th>
                  <Th>Batch or reference</Th>
                  <Th>Delivery</Th>
                  <Th align="right">Attempts</Th>
                  <Th>Sent</Th>
                </tr>
              </THead>
              <tbody>
                {v.txns.map((t) => (
                  <tr key={t.id} className={t.superseded ? "text-muted" : ""}>
                    <Td>
                      <p className="tabular">{t.id}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {t.superseded ? <Tag>Superseded</Tag> : null}
                        {t.correctionOf ? (
                          <Tag>Correction of {t.correctionOf}</Tag>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <p>
                        {t.summary.member} · {BENEFIT[t.order.benefit]}
                      </p>
                      <p className="text-xs text-muted">
                        {t.summary.action} · {t.summary.plan} {t.summary.level}{" "}
                        · {t.summary.date}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{ROUTE[t.route]}</Td>
                    <Td>
                      {t.batch ? (
                        <>
                          <p className="tabular">{t.batch.id}</p>
                          <Edi834Button batchId={t.batch.id} />
                          <a
                            href={`/api/documents/edi_834?batchId=${encodeURIComponent(t.batch.id)}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="size-3" aria-hidden />
                            .edi file
                          </a>
                        </>
                      ) : t.apiReference ? (
                        <span className="tabular text-xs whitespace-nowrap">
                          {t.apiReference}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusPill tone={DELIVERY[t.delivery].tone}>
                        {DELIVERY[t.delivery].label}
                      </StatusPill>
                    </Td>
                    <Td align="right">
                      <span
                        title={
                          t.attempts.map((a) => a.outcome).join("\n") ||
                          undefined
                        }
                      >
                        {t.attempts.length}
                      </span>
                    </Td>
                    <Td>
                      {t.sentAt ? (
                        <DateText time={t.sentAt} />
                      ) : (
                        <span className="text-muted">Not sent</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Illustrative 834 — not carrier-certified. A transport receipt is not
            a coverage result; only the carrier&apos;s record confirms coverage.
          </p>
        </div>
      ) : null}
    </Section>
  );
}

export function PayrollSection({ v }: { v: HrCaseView }) {
  return (
    <Section
      id="payroll"
      title="Payroll"
      description="Scheduled is not posted. A payslip changes only when the pay run posts and matches."
      bodyClassName=""
    >
      {v.instructions.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">
          No payroll instruction yet. Instructions are created after approval,
          when the carrier record matches. Posted payslips are never edited.
        </p>
      ) : (
        <Table label="Payroll instructions">
          <THead>
            <tr>
              <Th>Benefit</Th>
              <Th align="right">Previous</Th>
              <Th align="right">New recurring</Th>
              <Th align="right">Adjustment</Th>
              <Th>Target paycheck</Th>
              <Th>State</Th>
              <Th align="right" className="relative">
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {v.instructions.map((i) => (
              <tr key={i.id} className="align-top">
                <Td className="align-top!">
                  <p>{BENEFIT[i.benefit]}</p>
                  <p className="tabular text-xs text-muted">
                    {i.id}
                    {i.correctionOf ? ` · correction of ${i.correctionOf}` : ""}
                  </p>
                </Td>
                <Td align="right" className="align-top!">
                  <Money cents={i.previousRecurringCents} />
                </Td>
                <Td align="right" className="align-top!">
                  <Money cents={i.newRecurringCents} />
                </Td>
                <Td align="right" className="max-w-[320px] align-top!">
                  <Money cents={i.adjustmentCents} sign />
                  <p className="mt-0.5 text-left text-xs font-normal text-muted">
                    {i.adjustmentBasis}
                  </p>
                </Td>
                <Td className="align-top!">
                  <DateText date={i.payday} />
                  <p className="text-xs text-muted">
                    Run {i.runStatus === "posted" ? "posted" : "scheduled"}
                  </p>
                </Td>
                <Td className="align-top!">
                  <StatusPill tone={PAYROLL[i.state].tone}>
                    {PAYROLL[i.state].label}
                  </StatusPill>
                  {i.state === "mismatch" ? (
                    <p className="mt-1 text-xs text-danger-text">
                      Posted{" "}
                      <Money
                        cents={
                          (i.postedCents ?? 0) + (i.postedAdjustmentCents ?? 0)
                        }
                      />
                      , expected <Money cents={i.totalCents} />
                    </p>
                  ) : null}
                  {i.authorizedBy ? (
                    <p className="mt-1 text-xs text-muted">
                      Authorized <DateText time={i.authorizedAt ?? null} />
                    </p>
                  ) : null}
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
                      postedCents={
                        (i.postedCents ?? 0) + (i.postedAdjustmentCents ?? 0)
                      }
                    />
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}

export function CobraSection({ v }: { v: HrCaseView }) {
  const r = v.cobra;
  if (!r) return null;
  const st = COBRA[r.state];
  const unverified = !["received", "notice_tracked"].includes(r.state);
  const sendable = ["review_needed", "referral_ready"].includes(r.state);
  const disabledReason =
    v.case.status !== "approved"
      ? "Approve the removal first. The referral task stays open and owned until it is sent."
      : null;
  return (
    <Section
      id="cobra"
      title="Continuation (COBRA) referral"
      description="The administrator owns notices, elections and premiums. Private contact details stay with the administrator."
      actions={<StatusPill tone={st.tone}>{st.label}</StatusPill>}
    >
      <LabelValue
        cols={4}
        items={[
          { label: "Beneficiary", value: r.beneficiaryName },
          { label: "Qualifying event", value: r.qualifyingEvent },
          { label: "Event date", value: <DateText date={r.eventDate} /> },
          {
            label: "Coverage loss date",
            value: <DateText date={r.coverageLossDate} />,
          },
          {
            label: "Plans",
            value: r.plans.map((p) => plan(p.planId).shortName).join(", "),
          },
          {
            label: "Contact route",
            value: r.contactRoute
              ? r.contactRoute === "verified_address_on_file"
                ? "Verified address on file"
                : "Contact verification needed"
              : r.contactOnFile
                ? "Not chosen (address on file)"
                : "Not chosen (no address on file)",
          },
          {
            label: "Notice deadline",
            value: unverified ? (
              <span className="text-warning-text">
                Deadline needs verification
              </span>
            ) : (
              (r.noticeStatus ?? "Tracked by the administrator")
            ),
          },
          {
            label: "Sent / received",
            value: (
              <span className="tabular">
                {r.sentAt ? <DateText time={r.sentAt} /> : "Not sent"} /{" "}
                {r.receivedAt ? <DateText time={r.receivedAt} /> : "No receipt"}
              </span>
            ),
          },
        ]}
      />
      {r.infoRequested ? (
        <Banner
          tone="warning"
          className="mt-4"
          title="The administrator asked for information"
        >
          {r.infoRequested}
        </Banner>
      ) : null}
      {sendable ? (
        <div className="mt-4 border-t border-divider pt-4">
          <CobraSendButton
            referralId={r.id}
            beneficiary={r.beneficiaryName}
            contactOnFile={r.contactOnFile}
            disabledReason={disabledReason}
          />
        </div>
      ) : null}
      {r.notice ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
          <div className="text-[13px]">
            {r.noticeSent ? (
              <>
                <p className="text-ink">
                  Election notice sent to {r.beneficiaryName} ({r.noticeSent.to}) on <DateText time={r.noticeSent.at} />.
                </p>
                <p className="text-muted">Election is due by <DateText date={r.notice.electBy} />. The administrator tracks the election and premiums.</p>
              </>
            ) : (
              <>
                <p className="text-ink">The administrator acknowledged the referral{r.receivedAt ? <> on <DateText time={r.receivedAt} /></> : null}. The election notice is ready to send.</p>
                <p className="text-muted">It goes to {r.beneficiaryName} at {r.notice.to}. The employee never sees it.</p>
              </>
            )}
          </div>
          <CobraNoticeButton referralId={r.id} beneficiary={r.beneficiaryName} notice={r.notice} sentAt={r.noticeSent?.at} />
        </div>
      ) : null}
      {r.history.length ? (
        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer text-primary">
            Referral history ({r.history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {r.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular w-48 shrink-0 text-muted">
                  <DateText time={h.at} />
                </span>
                <span className="text-ink-2">
                  {COBRA[h.state].label}: {h.note}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}

export function TasksSection({ v }: { v: HrCaseView }) {
  const open = v.tasks.filter((t) => t.status === "open");
  const closed = v.tasks.filter((t) => t.status !== "open");
  return (
    <Section
      id="tasks"
      title="Open tasks"
      description="Every open item has an owner, a backup and a due time. Silence is never treated as an answer."
      bodyClassName=""
    >
      {open.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">
          No open tasks. Nothing is waiting on anyone for this case.
        </p>
      ) : (
        <Table label="Open tasks">
          <THead>
            <tr>
              <Th>Task</Th>
              <Th>Owner</Th>
              <Th>Backup</Th>
              <Th>Due</Th>
              <Th align="right" className="relative">
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {open.map((t) => {
              const overdue = !!t.dueAt && t.dueAt < v.now;
              return (
                <tr key={t.id} className="align-top">
                  <Td className="align-top!">
                    <p className="text-ink">{t.title}</p>
                    <p className="text-[13px] text-muted">
                      {TASK_KIND[t.kind]}
                      {t.blocking ? " · blocks completion" : ""} ·{" "}
                      {t.nextAction}
                    </p>
                  </Td>
                  <Td className="align-top!">{displayOwner(t.ownerName)}</Td>
                  <Td className="align-top! text-ink-2">
                    {displayOwner(t.backupName)}
                  </Td>
                  <Td className="align-top!">
                    {t.dueAt ? (
                      <DateText
                        time={t.dueAt}
                        className={overdue ? "text-danger-text" : ""}
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {overdue ? (
                      <p className="text-xs text-danger-text">Overdue</p>
                    ) : null}
                  </Td>
                  <Td align="right" className="align-top!">
                    {MANUAL_TASK_KINDS.includes(t.kind) ? (
                      <ResolveTaskButton taskId={t.id} title={t.title} />
                    ) : (
                      <span className="text-xs text-muted">
                        Closes when its record resolves
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {closed.length ? (
        <details className="px-5 py-3 text-[13px]">
          <summary className="cursor-pointer text-primary">
            Closed tasks ({closed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {closed.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-x-3">
                <span className="text-ink">{t.title}</span>
                <span className="text-muted">
                  {t.status === "done" ? "Resolved" : "Cancelled"}{" "}
                  <DateText time={t.resolvedAt ?? null} />
                  {t.resolution ? ` · ${t.resolution}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}

export function DocumentsCard({ v }: { v: HrCaseView }) {
  const q = `caseId=${encodeURIComponent(v.case.id)}`;
  const docs = [
    {
      kind: "receipt",
      label: "Election receipt",
      ready: !!v.case.receipt,
      when: "after submission",
    },
    {
      kind: "approval",
      label: "Approved election summary",
      ready: !!v.case.activeApproval,
      when: "after approval",
    },
    {
      kind: "carrier_result",
      label: "Carrier result summary",
      ready: v.observations.length > 0,
      when: "after the carrier responds",
    },
    {
      kind: "payroll_statement",
      label: "Payroll change statement",
      ready: v.instructions.length > 0,
      when: "after a payroll instruction exists",
    },
  ];
  return (
    <Section
      id="documents"
      title="Documents"
      description="Generated from stored records and labeled synthetic."
    >
      <ul className="flex flex-wrap gap-2">
        {docs.map((d) =>
          d.ready ? (
            <li key={d.kind}>
              <a
                href={`/api/documents/${d.kind}?${q}`}
                className={buttonClass("outline", "sm")}
              >
                <Download className="size-4" aria-hidden />
                {d.label}
              </a>
            </li>
          ) : (
            <li
              key={d.kind}
              className="flex h-8 items-center gap-1.5 rounded-[8px] border border-dashed border-line px-3 text-[13px] text-muted"
            >
              <Clock className="size-3.5" aria-hidden />
              {d.label} · available {d.when}
            </li>
          ),
        )}
      </ul>
    </Section>
  );
}
