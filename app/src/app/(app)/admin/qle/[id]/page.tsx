import Link from "next/link";
import { ChevronRight, SearchX } from "lucide-react";
import { requireSession } from "@/server/guard";
import { hrCaseView, type HrCaseView } from "@/server/views";
import { DomainError } from "@/server/domain/ctx";
import { plan, TIER_LABEL } from "@/server/config/plans";
import { ownerName } from "@/server/config/identities";
import { addDays, fmtDate } from "@/lib/dates";
import { ButtonLink } from "@/components/ui/button";
import {
  Banner,
  DateText,
  EmptyState,
  LabelValue,
  Section,
  StatusPill,
  Tag,
} from "@/components/ui/primitives";
import {
  ApproveButton,
  type ApprovalSummary,
  DecideButton,
  EscalateButton,
  RequestInfoButton,
} from "@/components/hr/CaseActions";
import { SectionNav } from "@/components/hr/SectionNav";
import { ACTION, BENEFIT, CHECK_RESULT } from "@/components/hr/labels";
import {
  blockingChecks,
  canDecide,
  firstName,
  lineDate,
  nameLookup,
} from "@/components/hr/case/shared";
import { SummarySection } from "@/components/hr/case/SummarySection";
import { ChecksSection } from "@/components/hr/case/ChecksSection";
import { EvidenceSection } from "@/components/hr/case/EvidenceSection";
import {
  CobraSection,
  CoverageSection,
  DocumentsCard,
  PayrollSection,
  TasksSection,
} from "@/components/hr/case/ExecutionSection";
import { TimelineSection } from "@/components/hr/case/TimelineSection";

const TIMING_LABEL: Record<string, string> = {
  within_window: "Within window",
  last_day: "Last day",
  late: "Late",
  future_event: "Future event",
  advance_request: "Advance request",
  unknown: "Needs a date",
};

export default async function HrCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const { id } = await params;
  let v: HrCaseView;
  try {
    v = await hrCaseView(user, scenarioId, id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) {
      return (
        <div className="mx-auto max-w-7xl">
          <Section title="Case not found" bodyClassName="">
            <EmptyState
              icon={<SearchX />}
              title="We could not find that case"
              action={
                <ButtonLink href="/admin/qle" variant="outline">
                  Back to life events
                </ButtonLink>
              }
            >
              It may belong to another scenario or employer, or it is still a
              draft the employee has not submitted.
            </EmptyState>
          </Section>
        </div>
      );
    }
    throw e;
  }

  const c = v.case;
  const who = firstName(c.employeeName);
  const nameOf = nameLookup(v);
  const decide = canDecide(c.status);
  const blockers = blockingChecks(v);
  const openInfo = v.tasks.filter(
    (t) => t.kind === "information_request" && t.status === "open",
  );
  const revisionNo = c.latestRevision?.revisionNo ?? 0;
  const ev = v.evaluation;
  const approvable =
    decide &&
    blockers.length === 0 &&
    openInfo.length === 0 &&
    !!ev?.proposedLines.length &&
    revisionNo > 0;
  const suggestedItems = blockers
    .filter((k) => k.result === "needs_information")
    .map((k) =>
      k.id === "evidence"
        ? `A document showing the ${c.eventLabel.toLowerCase()} date (for example, a decree or official notice)`
        : k.label,
    );
  const summary: ApprovalSummary = {
    revisionNo,
    lines: (ev?.proposedLines ?? []).map((l) => ({
      person: nameOf(l.personId),
      benefit: BENEFIT[l.benefit],
      action: ACTION[l.action],
      plan: plan(l.planId).shortName,
      tier: TIER_LABEL[l.tierAfter],
      date: lineDate(l),
    })),
    people: [
      ...new Set((ev?.proposedLines ?? []).map((l) => nameOf(l.personId))),
    ],
    totalBeforeCents: ev?.totalBeforeCents ?? 0,
    totalAfterCents: ev?.totalAfterCents ?? 0,
    targetPayday: ev?.adjustmentForecast?.targetPayday ?? null,
    adjustmentCents: ev?.adjustmentForecast?.adjustmentCents ?? null,
  };
  const timing = ev?.timing;
  const execAttention =
    v.lines.some((l) => l.coverageState === "mismatch") ||
    v.txns.some((t) => t.batch?.transport === "unknown");

  const nav = [
    { id: "summary", label: "Summary" },
    { id: "checks", label: "Checks", attention: decide && blockers.length > 0 },
    { id: "evidence", label: `Evidence (${v.evidence.length})` },
    { id: "coverage", label: "Delivery", attention: execAttention },
    {
      id: "payroll",
      label: "Payroll",
      attention: v.instructions.some((i) =>
        ["approval_needed", "mismatch"].includes(i.state),
      ),
    },
    ...(v.cobra
      ? [
          {
            id: "cobra",
            label: "COBRA",
            attention: ["review_needed", "referral_ready"].includes(
              v.cobra.state,
            ),
          },
        ]
      : []),
    {
      id: "tasks",
      label: `Tasks (${v.tasks.filter((t) => t.status === "open").length})`,
    },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <header className="mb-4">
        <nav
          aria-label="Breadcrumb"
          className="mb-1.5 flex items-center gap-1 text-[13px] text-muted"
        >
          <Link href="/admin" className="hover:text-primary">
            Benefits admin
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <Link href="/admin/qle" className="hover:text-primary">
            Life events
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span aria-current="page">{c.caseNumber}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[20px] font-medium leading-7 text-ink">
                {c.caseNumber} · {c.employeeName}
              </h1>
              <StatusPill tone={c.statusLabel.tone}>
                {c.statusLabel.label}
              </StatusPill>
              {c.background ? <Tag>Background case</Tag> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.eventLabel}
              {c.facts.eventDate ? ` on ${fmtDate(c.facts.eventDate)}` : ""} ·
              revision {revisionNo || "—"} · case version {c.version}
            </p>
          </div>
          {decide ? (
            <div className="flex flex-wrap items-center gap-2">
              <DecideButton caseId={c.id} version={c.version} firstName={who} />
              <EscalateButton caseId={c.id} version={c.version} />
              <RequestInfoButton
                caseId={c.id}
                version={c.version}
                defaultDue={addDays(v.today, 5)}
                suggestedItems={suggestedItems}
                firstName={who}
              />
              <ApproveButton
                caseId={c.id}
                version={c.version}
                summary={summary}
                blocked={!approvable}
                describedBy={!approvable ? "approval-state" : undefined}
              />
            </div>
          ) : null}
        </div>
      </header>

      {c.background ? (
        <Banner className="mb-4" title="Background case">
          Seeded queue context, separate from the live {scenarioId} scenario. It
          shows realistic workload; it is not part of the scenario&apos;s own
          records.
        </Banner>
      ) : null}

      {/* Decision state */}
      {decide ? (
        approvable ? (
          <div id="approval-state" className="mb-4">
            <Banner
              tone="success"
              title={`Revision ${revisionNo} is ready to approve`}
            >
              Every mandatory check is complete. Approval binds to this exact
              version and queues the carrier changes; it does not confirm
              coverage.
            </Banner>
          </div>
        ) : (
          <div id="approval-state" className="mb-4">
            <Banner
              tone="warning"
              title="Approval is blocked until these are complete"
            >
              <ul className="mt-1 flex flex-col gap-0.5">
                {blockers.map((k) => (
                  <li key={k.id}>
                    <a
                      href="#checks"
                      className="text-ink underline-offset-4 hover:underline"
                    >
                      {k.label}
                    </a>{" "}
                    — {CHECK_RESULT[k.result].label.toLowerCase()}. {k.reason}
                  </li>
                ))}
                {openInfo.map((t) => (
                  <li key={t.id}>
                    Information requested from {who}:{" "}
                    {(t.items ?? []).join("; ")}. Due{" "}
                    <DateText time={t.dueAt} />.
                  </li>
                ))}
                {!ev?.proposedLines.length ? (
                  <li>
                    No coverage change is proposed yet. Record a decision if the
                    request cannot proceed.
                  </li>
                ) : null}
              </ul>
            </Banner>
          </div>
        )
      ) : c.status === "approved" && c.activeApproval && v.lines.some((l) => l.coverageState === "mismatch" || l.memberResult === "rejected") ? (
        <Banner
          tone="error"
          className="mb-4"
          title="Provider issue: a carrier result does not match the approved change"
          action={
            <a href="#coverage" className="text-sm text-primary hover:underline">
              Go to delivery
            </a>
          }
        >
          {v.lines
            .filter((l) => l.coverageState === "mismatch" || l.memberResult === "rejected")
            .map((l) => l.mismatch?.message ?? `${l.person} (${l.benefit}): ${l.memberReason ?? "record rejected by the carrier"}`)
            .join(" ")}{" "}
          Other lines stay as they are. Approved revision {c.activeApproval.revisionNo} is unchanged.
        </Banner>
      ) : c.status === "approved" && c.activeApproval ? (
        <Banner
          className="mb-4"
          title={`Approved revision ${c.activeApproval.revisionNo}`}
        >
          Approved by {ownerName(c.activeApproval.actor)},{" "}
          <DateText time={c.activeApproval.at} />. Approval is not carrier
          acceptance; coverage is confirmed line by line below.
          {c.completedAt ? (
            <>
              {" "}
              Completed <DateText time={c.completedAt} />.
            </>
          ) : null}
        </Banner>
      ) : c.decision ? (
        <Banner
          tone={c.decision.kind === "declined" ? "error" : "info"}
          className="mb-4"
          title={c.decision.kind === "declined" ? "Declined" : "Withdrawn"}
        >
          {c.decision.reason} · Source: {c.decision.source} · Review route:{" "}
          {c.decision.reviewRoute} · <DateText time={c.decision.at} />
        </Banner>
      ) : null}

      <Section title="Case details" className="mb-4" bodyClassName="px-5 py-4">
        <LabelValue
          cols={4}
          items={[
            { label: "Employee", value: c.employeeName },
            {
              label: "Event",
              value: `${c.eventLabel}${c.facts.eventDate ? `, ${fmtDate(c.facts.eventDate)}` : ""}`,
            },
            {
              label: "Original receipt",
              value: c.receipt ? (
                <>
                  <DateText time={c.receipt.receivedAt} />
                  <span className="block text-xs text-muted">
                    Revision {c.receipt.revisionNo} ·{" "}
                    {c.receipt.kind === "review_request"
                      ? "review request"
                      : "election request"}{" "}
                    · never replaced
                  </span>
                </>
              ) : (
                "Not submitted"
              ),
            },
            {
              label: "Deadline",
              value: timing?.deadline ? (
                <>
                  <DateText
                    date={timing.deadline}
                    className={
                      timing.status === "late" ? "text-danger-text" : ""
                    }
                  />
                  <span className="block text-xs text-muted">
                    {timing.label} ·{" "}
                    {TIMING_LABEL[timing.status] ?? timing.status}
                  </span>
                </>
              ) : (
                <span className="text-muted">Needs an event date</span>
              ),
            },
            { label: "Owner", value: c.ownerName },
            { label: "Backup", value: c.backupName },
            {
              label: "Evidence",
              value: v.evidence.length
                ? `${v.evidence.length} file${v.evidence.length === 1 ? "" : "s"}, ${v.evidence.filter((f) => f.reviewedBy && f.status !== "rejected").length} accepted`
                : c.evidencePendingNote
                  ? "Pending — employee will send later"
                  : "None",
            },
            {
              label: "Review",
              value: c.specialistReview ? (
                <>
                  Specialist review
                  <span className="block text-xs text-muted">
                    {c.specialistReview.reason}
                  </span>
                </>
              ) : (
                "HR (Daniel Brooks)"
              ),
            },
          ]}
        />
      </Section>

      <SectionNav items={nav} />

      <div className="flex flex-col gap-4">
        <SummarySection v={v} />
        <ChecksSection v={v} />
        <EvidenceSection v={v} suggestedItems={suggestedItems} />
        <CoverageSection v={v} />
        <PayrollSection v={v} />
        <CobraSection v={v} />
        <TasksSection v={v} />
        <DocumentsCard v={v} />
        <TimelineSection v={v} />
      </div>
    </div>
  );
}
