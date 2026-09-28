import type { ReactNode } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Banner, DateText, LabelValue, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { CostTable, ForecastBlock } from "@/components/employee/CostSummary";
import { BENEFIT_LABEL, EVIDENCE_STATUS, isAddition, LINE_ACTION, TIER_LABEL } from "@/components/employee/labels";
import { ReviewSubmit } from "@/components/employee/ReviewSubmit";
import { TimingBanner } from "@/components/employee/TimingBanner";
import { WizardHeader } from "@/components/employee/WizardHeader";
import { loadWizardCase } from "@/components/employee/server";
import { fmtDate } from "@/lib/dates";

const DIRECTION: Record<string, string> = {
  remove_from_nexa: "Remove my former spouse from Nexa's plan",
  lost_outside_coverage: "I lost coverage under their plan",
  both: "Both",
  not_sure: "Not sure",
};
const ORDER: Record<string, string> = { none: "No order about coverage", order_exists: "There is an order", not_sure: "Not sure" };
const yesNo = (b: boolean | undefined) => (b === undefined ? "Not answered" : b ? "Yes" : "No");

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params;
  const { mode } = await searchParams;
  const v = await loadWizardCase(id);
  const ev = v.evaluation;
  const f = v.case.facts;
  const code = v.case.eventCode;
  const people = [...v.household.map((p) => ({ id: p.id, name: p.name })), ...(f.children ?? []).map((k) => ({ id: k.personId, name: `${k.firstName || "New child"} ${k.lastName}`.trim() }))];
  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.name ?? "Unknown person";
  const planName = (pid: string) => v.plans.find((p) => p.id === pid)?.shortName ?? pid;

  const before = [...new Set(v.currentElections.flatMap((e) => e.covered))];
  const added = [...new Set(ev.proposedLines.filter((l) => l.action === "add").map((l) => nameOf(l.personId)))];
  const removed = [...new Set(ev.proposedLines.filter((l) => l.action === "terminate").map((l) => nameOf(l.personId)))];
  const after = [...before.filter((n) => !removed.includes(n)), ...added.filter((n) => !before.includes(n))];

  const intake = ev.checks.find((k) => k.id === "intake");
  const open = ev.checks.filter((k) => (k.result === "needs_information" || k.result === "needs_review") && k.id !== "intake" && !k.resolvedBy);
  const future = ev.timing.status === "future_event" ? ev.timing.message : null;
  const files = v.evidence;

  const facts: { label: string; value: ReactNode }[] = [];
  if (isAddition(code)) {
    (f.children ?? []).forEach((k, i) =>
      facts.push({ label: `Child ${i + 1}`, value: `${`${k.firstName} ${k.lastName}`.trim() || "Name not entered"} · born ${fmtDate(k.dob)}${k.ssnStatus === "pending" ? " · SSN not issued yet" : ""}` }),
    );
    if (code !== "birth") facts.push({ label: code === "adoption" ? "Date of adoption" : "Date of placement", value: fmtDate(f.eventDate) });
  } else if (code === "divorce") {
    facts.push({ label: "Which applies", value: f.direction ? DIRECTION[f.direction] : "Not answered" });
    if (f.direction === "remove_from_nexa" || f.direction === "both") {
      facts.push({ label: "Divorce is final", value: yesNo(f.divorceFinal) });
      facts.push({ label: "Final on", value: fmtDate(f.eventDate) });
      facts.push({ label: "Former spouse", value: f.formerSpousePersonId ? nameOf(f.formerSpousePersonId) : "Not chosen" });
      facts.push({ label: "Court order about children", value: f.childCoverageOrder ? ORDER[f.childCoverageOrder] : "Not answered" });
      facts.push({ label: "Mailing address known", value: yesNo(f.formerSpouseContactKnown) });
    }
  } else if (code === "loss_of_other_coverage") {
    facts.push({ label: "Who lost coverage", value: (f.lostCoveragePersonIds ?? []).map(nameOf).join(", ") || "Not chosen" });
    facts.push({ label: "Why it ended", value: f.lossReason ? (v.lossReasons[f.lossReason] ?? f.lossReason) : "Not answered" });
    facts.push({ label: "Coverage ends", value: f.coverageEndUnknown ? "Not known yet — HR will help verify" : fmtDate(f.coverageEndDate) });
    facts.push({ label: "Last day worked", value: fmtDate(f.lastWorkday) });
    if (f.priorEmployer) facts.push({ label: "Employer", value: f.priorEmployer });
    facts.push({ label: "Other coverage remains", value: yesNo(f.otherCoverageRemains) });
    facts.push({ label: "Had the prior coverage", value: yesNo(f.priorCoverageConfirmed) });
  } else {
    facts.push({ label: "When it happened", value: fmtDate(f.eventDate) });
    facts.push({ label: "What happened", value: f.explanation || "Not described" });
  }
  if (f.residenceStateChanged) facts.push({ label: "Moved to", value: f.residenceStateChanged });

  const edit = (step: string) => (
    <ButtonLink href={`/employee/life-events/${id}/${step}`} variant="ghost" size="sm">
      <Pencil className="size-3.5" aria-hidden /> Edit
    </ButtonLink>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <WizardHeader caseId={id} caseNumber={v.case.caseNumber} eventLabel={v.case.eventLabel} step={3} statusLabel={v.case.statusLabel} description="Check everything before you send it. You get a receipt with your request number right away." />
      <TimingBanner timing={ev.timing} caseId={id} showReviewAction={false} />

      <Section title="What happened" actions={edit("details")}>
        <LabelValue items={facts} cols={3} />
      </Section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Covered people now">
          <p className="text-sm text-ink">{before.join(", ") || "No one is covered today."}</p>
        </Section>
        <Section title="Covered people after the change" actions={edit("options")}>
          <p className="text-sm text-ink">{after.join(", ") || "No change requested yet."}</p>
          {added.length || removed.length ? (
            <p className="mt-1 text-[13px] text-muted">
              {added.length ? `Adding ${added.join(", ")}. ` : ""}
              {removed.length ? `Removing ${removed.join(", ")}.` : ""}
            </p>
          ) : null}
        </Section>
      </div>

      <Section title="Plans and requested dates" description="Dates follow Nexa's rules. The insurance provider's record confirms them later." bodyClassName="">
        {ev.proposedLines.length ? (
          <Table label="Requested changes">
            <THead>
              <tr>
                <Th>Person</Th>
                <Th>Benefit</Th>
                <Th>Change</Th>
                <Th>Plan</Th>
                <Th>Coverage level</Th>
                <Th>Requested date</Th>
              </tr>
            </THead>
            <tbody>
              {ev.proposedLines.map((l, i) => (
                <tr key={i}>
                  <Td className="whitespace-nowrap">{nameOf(l.personId)}</Td>
                  <Td>{BENEFIT_LABEL[l.benefit]}</Td>
                  <Td>{LINE_ACTION[l.action]}</Td>
                  <Td>{planName(l.planId)}</Td>
                  <Td>{TIER_LABEL[l.tierAfter]}</Td>
                  <Td className="whitespace-nowrap">{l.action === "terminate" ? <>Ends <DateText date={l.endDate} /></> : l.startDate ? <>Starts <DateText date={l.startDate} /></> : <span className="text-muted">Set when the date is known</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">{ev.assistedReview ? "HR confirms which changes and dates apply after reviewing your request." : "No benefit change chosen yet."}</p>
        )}
      </Section>

      <Section title="Your contribution" description="Per semi-monthly paycheck. Estimates only." bodyClassName="">
        <CostTable costs={ev.costs} planName={planName} totalBefore={ev.totalBeforeCents} totalAfter={ev.totalAfterCents} />
        <div className="border-t border-divider px-5 py-4">
          <ForecastBlock totalBefore={ev.totalBeforeCents} totalAfter={ev.totalAfterCents} forecast={ev.adjustmentForecast} />
        </div>
      </Section>

      <Section title="Documents" actions={edit("evidence")}>
        {files.length ? (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">{file.fileName}</span>
                <StatusPill tone={EVIDENCE_STATUS[file.status].tone}>{EVIDENCE_STATUS[file.status].label}</StatusPill>
              </li>
            ))}
          </ul>
        ) : null}
        {v.case.evidencePendingNote ? <p className={`text-sm text-ink-2 ${files.length ? "mt-3" : ""}`}>Document to follow: “{v.case.evidencePendingNote.replace(/[.!?]\s*$/, "")}.” Nexa aims to follow up within 5 calendar days.</p> : null}
        {!files.length && !v.case.evidencePendingNote ? <p className="text-sm text-muted">No document added. You can still submit; HR may ask for one.</p> : null}
      </Section>

      {open.length ? (
        <Section title="What HR will check" description="These do not stop you from submitting. HR follows up if anything is needed.">
          <ul className="space-y-3">
            {open.map((k) => (
              <li key={k.id} className="flex items-start gap-3 text-sm">
                <StatusPill tone={k.result === "needs_information" ? "amber" : "blue"} className="mt-0.5">
                  {k.result === "needs_information" ? "Needs information" : "HR review"}
                </StatusPill>
                <span>
                  <span className="block text-ink">{k.label}</span>
                  <span className="block text-[13px] text-muted">{k.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {v.case.status === "needs_information" ? (
        <Banner
          tone="warning"
          title="This request is already with HR"
          action={
            <ButtonLink href={`/employee/cases/${id}#requests`} variant="outline" size="sm">
              Reply to HR
            </ButtonLink>
          }
        >
          HR asked for more information. Send your reply from the request tracker; your saved changes are included.
        </Banner>
      ) : (
        <Section title={ev.assistedReview || mode === "review" || ev.timing.status === "late" || intake?.result !== "passed" ? "Send to HR for review" : "Submit your request"}>
          <ReviewSubmit
            caseId={id}
            version={v.case.version}
            sensitive={v.case.sensitive}
            intakePassed={intake?.result === "passed"}
            missing={ev.missingFacts}
            late={ev.timing.status === "late"}
            futureMessage={future}
            reviewMode={mode === "review"}
            assisted={ev.assistedReview}
            explanation={f.explanation ?? ""}
          />
        </Section>
      )}

      <div className="border-t border-divider pt-4">
        <ButtonLink href={`/employee/life-events/${id}/options`} variant="ghost">
          <ArrowLeft className="size-4" aria-hidden /> Back to benefit changes
        </ButtonLink>
      </div>
    </div>
  );
}
