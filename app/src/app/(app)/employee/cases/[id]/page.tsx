import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Circle, CircleDot, Download, FileText, Inbox } from "lucide-react";
import type { MilestoneState } from "@/server/views";
import { ButtonLink } from "@/components/ui/button";
import { Banner, Card, DateText, EmptyState, LabelValue, Money, PageHeader, Section, StatusPill, Stepper, Table, Td, Th, THead, type Tone } from "@/components/ui/primitives";
import { ForecastBlock } from "@/components/employee/CostSummary";
import { EvidenceList } from "@/components/employee/EvidenceList";
import { EvidenceUploader } from "@/components/employee/EvidenceUploader";
import { DemoDocuments } from "@/components/employee/DemoDocuments";
import { BENEFIT_LABEL, COVERAGE_STATE, EVIDENCE_STATUS, LINE_ACTION, PAYROLL_STATE, WIZARD_STEPS } from "@/components/employee/labels";
import { InfoReply, ReceivedBanner, UrgentSupport, WithdrawAction } from "@/components/employee/TrackerActions";
import { loadEmployeeCase } from "@/components/employee/server";
import { fmtDate, fmtDateLong, fmtDateTime } from "@/lib/dates";

const M_STATE: Record<MilestoneState, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "green" },
  current: { label: "In progress", tone: "blue" },
  attention: { label: "Needs attention", tone: "amber" },
  upcoming: { label: "Not started", tone: "gray" },
};

function MilestoneIcon({ state }: { state: MilestoneState }) {
  if (state === "done") return <CheckCircle2 className="size-5 text-success" aria-hidden />;
  if (state === "attention") return <AlertTriangle className="size-5 text-warning" aria-hidden />;
  if (state === "current") return <CircleDot className="size-5 text-primary" aria-hidden />;
  return <Circle className="size-5 text-line" aria-hidden />;
}

export default async function CaseTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await loadEmployeeCase(id);
  const c = v.case;
  if (c.status === "draft") redirect(`/employee/life-events/${id}/details`);
  const terminal = c.status === "declined" || c.status === "withdrawn";
  const complete = !!c.completedAt;
  const openReqs = v.requests.filter((r) => r.status === "open");
  const sent = v.milestones.some((m) => m.key === "sent" && m.state === "done");
  const focus = v.milestones.find((m) => m.state === "attention") ?? v.milestones.find((m) => m.state === "current");

  // Prominent next action.
  let next: { title: string; body: string; due?: string | null; owner?: string; href?: string; cta?: string; tone: "action" | "wait" | "done" };
  if (openReqs.length) {
    const r = openReqs[0];
    next = { title: "HR needs information from you", body: r.items.join("; "), due: r.dueAt, owner: "You", href: "#requests", cta: "Reply to HR", tone: "action" };
  } else if (v.myTasks.length) {
    const t = v.myTasks[0];
    next = { title: t.title.replace(/\s*\(restricted\)\s*$/i, ""), body: t.nextAction, due: t.dueAt, owner: "You", tone: "action" };
  } else if (complete) {
    next = { title: "Complete", body: "Coverage and pay match the approved change. Nothing else is needed.", tone: "done" };
  } else {
    next = { title: "No action needed from you right now", body: focus?.explanation ?? "We will update you as each step finishes.", owner: focus?.owner, tone: "wait" };
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title={`${c.eventLabel} · ${c.caseNumber}`}
        crumbs={[{ label: "Life events", href: "/employee/life-events" }, { label: c.caseNumber }]}
        actions={
          <>
            <StatusPill tone={c.statusLabel.tone}>{c.statusLabel.label}</StatusPill>
            {c.receipt ? (
              <a href={`/api/documents/receipt?caseId=${id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink hover:bg-fill">
                <Download className="size-4" aria-hidden /> Receipt
              </a>
            ) : null}
            {!terminal && !complete ? <WithdrawAction caseId={id} version={c.version} caseNumber={c.caseNumber} sent={sent} /> : null}
          </>
        }
      />
      {!terminal ? <Stepper steps={WIZARD_STEPS(id)} current={complete ? 5 : 4} /> : null}

      <ReceivedBanner caseId={id} />

      {c.status === "declined" && c.decision ? (
        <Banner tone="error" title="Decision recorded: not approved">
          <p>{c.decision.reason}</p>
          <p className="mt-1 text-[13px] text-muted">
            Source: {c.decision.source} · recorded {fmtDateTime(c.decision.at)}
          </p>
          <p className="mt-2">How to ask for a review: {c.decision.reviewRoute}</p>
        </Banner>
      ) : null}
      {c.status === "withdrawn" && c.decision ? (
        <Banner title="You withdrew this request">
          <p>
            Withdrawn {fmtDateTime(c.decision.at)}. Reason: {c.decision.reason}
          </p>
          {c.decision.reviewRoute !== "None" ? <p className="mt-1">{c.decision.reviewRoute}</p> : <p className="mt-1">Your current coverage did not change. You can report a new life event at any time.</p>}
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {!terminal ? (
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <span className={`grid size-11 shrink-0 place-items-center rounded-full border ${next.tone === "action" ? "border-warning/50 text-warning" : next.tone === "done" ? "border-success/40 text-success" : "border-line text-primary"}`}>
                {next.tone === "action" ? <AlertTriangle className="size-5" aria-hidden /> : next.tone === "done" ? <CheckCircle2 className="size-5" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Next step</p>
                <h2 className="text-lg font-medium text-ink">{next.title}</h2>
                <p className="mt-1 text-sm text-ink-2">{next.body}</p>
                <p className="mt-1.5 text-[13px] text-muted">
                  {next.owner ? `Owner: ${next.owner}` : null}
                  {next.due ? <span className="text-warning-text">{`${next.owner ? " · " : ""}Due ${fmtDateTime(next.due)}`}</span> : null}
                </p>
              </div>
              {next.href ? (
                <ButtonLink href={next.href}>
                  {next.cta} <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              ) : null}
            </Card>
          ) : null}

          {v.requests.length ? (
            <Section id="requests" title="Requests from HR" description="HR asks for exactly what is missing. Your original request and answers are kept.">
              <div className="space-y-5">
                {v.requests.map((r) => {
                  const files = v.evidence.filter((f) => f.taskId === r.id);
                  return (
                    <article key={r.id} className="rounded-[10px] border border-line">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3">
                        <p className="text-sm font-medium text-ink">{r.title}</p>
                        <div className="flex items-center gap-2">
                          {r.dueAt ? <span className="text-[13px] text-warning-text">Due {fmtDateTime(r.dueAt)}</span> : null}
                          <StatusPill tone={r.status === "open" ? "amber" : "green"}>{r.status === "open" ? "Waiting for you" : "Replied"}</StatusPill>
                        </div>
                      </header>
                      <div className="space-y-3 px-4 py-3 text-sm">
                        {r.message ? <p className="text-ink">{r.message}</p> : null}
                        <div>
                          <p className="text-[13px] font-medium text-ink">What HR needs</p>
                          <ul className="mt-1 list-disc pl-5 text-ink-2">
                            {r.items.map((it) => (
                              <li key={it}>{it}</li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-[13px] text-muted">Why: {r.reason}</p>
                        {files.length ? <EvidenceList caseId={id} version={c.version} files={files} /> : null}
                        {r.status === "open" ? (
                          <InfoReply caseId={id} version={c.version} taskId={r.id} uploader={<><EvidenceUploader caseId={id} taskId={r.id} compact /><DemoDocuments eventCode={c.eventCode} only="happy" /></>} />
                        ) : r.response ? (
                          <p className="rounded-[8px] bg-fill px-3 py-2 text-ink-2">
                            You replied {fmtDateTime(r.response.at)}: “{r.response.message}”
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <Section title="Progress" description="Each step shows who owns it. Coverage is confirmed by the insurance provider's record, not by approval alone.">
            <ol className="relative">
              {v.milestones.map((m, i) => (
                <li key={m.key} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < v.milestones.length - 1 ? <span className="absolute top-6 bottom-0 left-[9.5px] w-px bg-divider" aria-hidden /> : null}
                  <span className="relative z-10 bg-surface">
                    <MilestoneIcon state={m.state} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${m.state === "upcoming" ? "text-muted" : "text-ink"}`}>{m.label}</p>
                      <StatusPill tone={M_STATE[m.state].tone}>{M_STATE[m.state].label}</StatusPill>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-2">{m.explanation}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {m.at ? `${fmtDateTime(m.at)} · ` : ""}Owner: {m.owner}
                      {m.action ? (
                        <>
                          {" · "}
                          <a href={m.action === "Reply to HR" ? "#requests" : `/employee/life-events/${id}/details`} className="text-primary hover:underline">
                            {m.action}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Coverage" description="Per person and benefit, as confirmed by the insurance provider." bodyClassName="">
            {v.lines.length ? (
              <Table label="Coverage changes">
                <THead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Benefit</Th>
                    <Th>Change</Th>
                    <Th>Plan</Th>
                    <Th>Level</Th>
                    <Th>Dates</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.lines.map((l) => {
                    const st = COVERAGE_STATE[l.coverageState];
                    return (
                      <tr key={l.id}>
                        <Td className="whitespace-nowrap">{l.person}</Td>
                        <Td>{BENEFIT_LABEL[l.benefit]}</Td>
                        <Td className="whitespace-nowrap">{LINE_ACTION[l.action]}</Td>
                        <Td className="whitespace-nowrap">{l.planName}</Td>
                        <Td className="whitespace-nowrap">{l.tierLabel}</Td>
                        <Td className="whitespace-nowrap">{l.action === "terminate" ? <>Ends <DateText date={l.endDate} /></> : <>Starts <DateText date={l.startDate} /></>}</Td>
                        <Td>
                          <StatusPill tone={st.tone}>{l.coverageState === "confirmed_future" && l.startDate ? `Confirmed from ${fmtDateLong(l.startDate)}` : st.label}</StatusPill>
                          {l.safeNote ? <p className="mt-1 max-w-56 text-xs text-muted">{l.safeNote}</p> : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState icon={<Inbox aria-hidden />} title="No coverage changes yet">
                {terminal ? "No coverage changes were made for this request." : "Coverage lines appear after HR approves your request. Your current coverage stays in place until then."}
              </EmptyState>
            )}
          </Section>

          <Section title="Pay" description="Benefit deductions per semi-monthly paycheck." bodyClassName="">
            {v.payroll.length ? (
              <Table label="Payroll changes">
                <THead>
                  <tr>
                    <Th>Benefit</Th>
                    <Th align="right">Previous</Th>
                    <Th align="right">New regular</Th>
                    <Th align="right">One-time adjustment</Th>
                    <Th align="right">On that paycheck</Th>
                    <Th>Paycheck</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.payroll.map((p) => (
                    <tr key={p.benefit}>
                      <Td>{BENEFIT_LABEL[p.benefit]}</Td>
                      <Td align="right">
                        <Money cents={p.previousCents} />
                      </Td>
                      <Td align="right">
                        <Money cents={p.newCents} />
                      </Td>
                      <Td align="right">{p.adjustmentCents ? <Money cents={p.adjustmentCents} sign /> : <span className="text-muted">None</span>}</Td>
                      <Td align="right">
                        <Money cents={p.newCents + p.adjustmentCents} />
                      </Td>
                      <Td>
                        <DateText date={p.payday} />
                      </Td>
                      <Td>
                        <StatusPill tone={PAYROLL_STATE[p.state].tone}>{PAYROLL_STATE[p.state].label}</StatusPill>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : terminal ? (
              <p className="px-5 py-4 text-sm text-muted">No pay change for this request.</p>
            ) : (
              <div className="px-5 py-4">
                <ForecastBlock totalBefore={v.evaluation.totalBeforeCents} totalAfter={v.evaluation.totalAfterCents} forecast={v.evaluation.adjustmentForecast} />
              </div>
            )}
          </Section>

          {v.continuation ? (
            <Section title="Continuation coverage">
              <p className="text-sm text-ink">{v.continuation.label}</p>
              <p className="mt-1 text-[13px] text-muted">{v.continuation.note}</p>
            </Section>
          ) : null}

          <Section title="History">
            {v.timeline.length ? (
              <ol className="space-y-2.5">
                {v.timeline.map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-4">
                    <span className="w-52 shrink-0 text-[13px] text-muted tabular">{fmtDateTime(t.at)}</span>
                    <span className="text-ink">{t.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No updates yet.</p>
            )}
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Receipt">
            {c.receipt ? (
              <>
                <LabelValue
                  cols={2}
                  items={[
                    { label: "Request", value: <span className="tabular">{c.receipt.caseNumber}</span> },
                    { label: "Revision", value: c.receipt.revisionNo },
                    { label: "Received", value: fmtDateTime(c.receipt.receivedAt) },
                    { label: "Type", value: c.receipt.kind === "review_request" ? "Review request" : "Election request" },
                  ]}
                />
                <div className="mt-4 flex flex-col gap-2">
                  <a href={`/api/documents/receipt?caseId=${id}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <FileText className="size-4" aria-hidden /> Download receipt
                  </a>
                  {c.status === "approved" ? (
                    <a href={`/api/documents/approval?caseId=${id}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <FileText className="size-4" aria-hidden /> Download approval summary
                    </a>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-muted">The receipt shows when we received your request. It is separate from whether documents are complete.</p>
              </>
            ) : (
              <p className="text-sm text-muted">No receipt yet.</p>
            )}
          </Section>

          <Section title="Documents">
            {v.evidence.length ? (
              <ul className="space-y-2">
                {v.evidence.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={`/api/evidence/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-primary hover:underline">
                      {f.fileName}
                    </a>
                    <StatusPill tone={EVIDENCE_STATUS[f.status].tone}>{EVIDENCE_STATUS[f.status].label}</StatusPill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{c.evidencePendingNote ? `To follow: “${c.evidencePendingNote}”` : "No documents uploaded."}</p>
            )}
            {c.evidencePendingNote && v.evidence.length === 0 ? <p className="mt-2 text-xs text-muted">Nexa aims to follow up within 5 calendar days. That is an administrative target, not a legal guarantee.</p> : null}
          </Section>

          {!terminal && !complete ? (
            <Section title="Need care before this is confirmed?">
              <UrgentSupport caseId={id} />
            </Section>
          ) : null}

          {v.evaluation.timing.deadline && !terminal ? (
            <p className="px-1 text-xs text-muted">
              {v.evaluation.timing.label}: deadline {fmtDate(v.evaluation.timing.deadline)} (rule {v.evaluation.timing.ruleId} v{v.evaluation.timing.ruleVersion}).
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
