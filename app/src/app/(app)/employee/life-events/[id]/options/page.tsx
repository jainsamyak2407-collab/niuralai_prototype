import { ArrowLeft, UserMinus, Users } from "lucide-react";
import type { Benefit, ElectionChoice } from "@/lib/contracts/domain";
import { ButtonLink } from "@/components/ui/button";
import { Banner, DateText, Money, Section, Table, Td, Th, THead } from "@/components/ui/primitives";
import { AskEmmaButton } from "@/components/emma/EmmaDock";
import { ContinueWithElections } from "@/components/employee/ContinueWithElections";
import { CostTable, ForecastBlock } from "@/components/employee/CostSummary";
import { BENEFIT_LABEL, isAddition } from "@/components/employee/labels";
import { type CurrentInfo, OptionsForm, type PersonInfo } from "@/components/employee/OptionsForm";
import { WizardHeader } from "@/components/employee/WizardHeader";
import { loadWizardCase } from "@/components/employee/server";
import { addDays, fmtDateLong } from "@/lib/dates";

const BENEFITS: Benefit[] = ["medical", "dental", "vision"];

export default async function OptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await loadWizardCase(id);
  const ev = v.evaluation;
  const code = v.case.eventCode;
  const f = v.case.facts;
  const nameToId = new Map(v.household.map((p) => [p.name, p.id]));
  const current: CurrentInfo[] = v.currentElections.map((e) => ({ benefit: e.benefit, planId: e.planId, tier: e.tier, coveredIds: e.covered.map((n) => nameToId.get(n)).filter((x): x is string => !!x) }));
  const people: PersonInfo[] = [
    ...v.household.map((p) => ({ id: p.id, name: p.name, relationship: p.relationship })),
    ...(f.children ?? []).map((k) => ({ id: k.personId, name: `${k.firstName || "New child"} ${k.lastName}`.trim(), relationship: "child" as const })),
  ];
  const planName = (pid: string) => v.plans.find((p) => p.id === pid)?.shortName ?? pid;
  const addition = isAddition(code);
  const removal = code === "divorce" && f.direction === "remove_from_nexa";
  const canPropose = !ev.assistedReview && !(code === "divorce" && f.direction !== "remove_from_nexa");
  const cur = (b: Benefit) => current.find((c) => c.benefit === b);
  const kids = (f.children ?? []).map((k) => k.personId);

  // Same defaults the rules engine uses when nothing is saved yet.
  const defaults: ElectionChoice[] = BENEFITS.map((b) => {
    const planId = cur(b)?.planId ?? ev.permittedPlanIds[b][0] ?? "";
    if (addition) return { benefit: b, planId, addPersonIds: b === "medical" ? kids : [], removePersonIds: [], enroll: b === "medical" };
    if (removal) {
      const rm = ev.permittedPersonIds.filter((pid) => cur(b)?.coveredIds.includes(pid));
      return { benefit: b, planId, addPersonIds: [], removePersonIds: rm, enroll: rm.length > 0 };
    }
    return { benefit: b, planId, addPersonIds: ev.permittedPersonIds, removePersonIds: [], enroll: ev.permittedPersonIds.length > 0 };
  });
  const initial = v.case.elections.length ? v.case.elections : defaults;
  const back = (
    <ButtonLink href={`/employee/life-events/${id}/evidence`} variant="ghost">
      <ArrowLeft className="size-4" aria-hidden /> Back to documents
    </ButtonLink>
  );
  const header = <WizardHeader caseId={id} caseNumber={v.case.caseNumber} eventLabel={v.case.eventLabel} step={2} statusLabel={v.case.statusLabel} description={removal ? "See who leaves, who stays and how your contribution changes." : "Choose the changes this event allows. Only the people and plans you can change are shown."} />;
  const payEstimate = (
    <Section title="Pay estimate" description="Calculated by Nexa's payroll policy from your saved choices.">
      <ForecastBlock totalBefore={ev.totalBeforeCents} totalAfter={ev.totalAfterCents} forecast={ev.adjustmentForecast} />
    </Section>
  );

  if (!canPropose) {
    const why = ev.assistedReview
      ? "HR reviews this kind of change with you. You don't need to choose plans now. HR confirms which changes are available and contacts you about next steps."
      : f.direction === "lost_outside_coverage"
        ? "Losing coverage under a former spouse's plan is handled as a loss-of-coverage request. Go back to start it; nothing changes on your Nexa plan here."
        : f.direction === "both"
          ? "HR will confirm the removal and link your loss-of-coverage request so each change keeps its own dates."
          : "HR will help confirm whose plan is affected before any change is made.";
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        {header}
        <Banner title="HR confirms the available changes">{why}</Banner>
        <Section title="Your current coverage" description="This stays in place until an authorized decision is recorded." bodyClassName="">
          <Table label="Current coverage">
            <THead>
              <tr>
                <Th>Benefit</Th>
                <Th>Plan</Th>
                <Th>Coverage level</Th>
                <Th>Covered people</Th>
                <Th align="right">You pay per paycheck</Th>
              </tr>
            </THead>
            <tbody>
              {v.currentElections.map((e) => (
                <tr key={e.id}>
                  <Td>{BENEFIT_LABEL[e.benefit]}</Td>
                  <Td>{e.planName}</Td>
                  <Td>{e.tierLabel}</Td>
                  <Td>{e.covered.join(", ")}</Td>
                  <Td align="right">
                    <Money cents={e.employeeCents} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">
          {back}
          <ContinueWithElections caseId={id} version={v.case.version} elections={null} href={`/employee/life-events/${id}/review?mode=review`} label="Continue to review" />
        </div>
      </div>
    );
  }

  if (removal) {
    const leaving = ev.permittedPersonIds;
    const end = ev.proposedLines.find((l) => l.action === "terminate")?.endDate ?? null;
    const coveredNow = [...new Set(current.flatMap((c) => c.coveredIds))];
    const staying = coveredNow.filter((pid) => !leaving.includes(pid));
    const nameOf = (pid: string) => people.find((p) => p.id === pid)?.name ?? "Unknown";
    const leavingBenefits = BENEFITS.filter((b) => leaving.some((pid) => cur(b)?.coveredIds.includes(pid)));
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        {header}
        {leaving.length === 0 ? (
          <Banner tone="warning" title="No one to remove from Nexa's plan">
            {f.formerSpousePersonId ? nameOf(f.formerSpousePersonId) : "Your former spouse"} is not on your Nexa coverage today, so nothing ends and your deduction stays the same. Go back to the details step to
            change your answer.
          </Banner>
        ) : null}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Section title="Who leaves">
            <ul className="space-y-3">
              {leaving.map((pid) => (
                <li key={pid} className="flex items-start gap-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
                    <UserMinus className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-ink">{nameOf(pid)}</span>
                    <span className="block text-[13px] text-muted">
                      {leavingBenefits.map((b) => BENEFIT_LABEL[b]).join(", ")} · coverage ends {end ? <DateText date={end} /> : "on the last day of the month the divorce became final"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Who stays covered">
            <ul className="space-y-3">
              {staying.map((pid) => (
                <li key={pid} className="flex items-center gap-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
                    <Users className="size-4" aria-hidden />
                  </span>
                  <span className="text-ink">{nameOf(pid)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted">Everyone else keeps the same plans. This event does not allow cancelling other coverage or switching plans.</p>
          </Section>
        </div>
        <Section title="Cost impact" description={end ? `The remaining coverage level applies from ${fmtDateLong(addDays(end, 1), true)}.` : "The remaining coverage level applies from the first day after coverage ends."} bodyClassName="" actions={<AskEmmaButton question="How does removing my former spouse change my paycheck?">Explain with Emma</AskEmmaButton>}>
          <CostTable costs={ev.costs} planName={planName} totalBefore={ev.totalBeforeCents} totalAfter={ev.totalAfterCents} />
        </Section>
        {payEstimate}
        <Banner title="Continuation coverage">Your former spouse may be able to keep coverage through continuation (COBRA). Nexa&apos;s administrator contacts them directly; their choices and details stay private.</Banner>
        <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">
          {back}
          <ContinueWithElections caseId={id} version={v.case.version} elections={v.case.elections.length ? null : defaults} href={`/employee/life-events/${id}/review`} label="Continue to review" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {header}
      <OptionsForm
        caseId={id}
        version={v.case.version}
        initial={initial}
        initialPriorities={v.case.preferences.priorities ?? (v.case.preferences.priority ? [v.case.preferences.priority] : [])}
        plans={v.plans}
        current={current}
        people={people}
        permittedPersonIds={ev.permittedPersonIds}
        permittedPlanIds={ev.permittedPlanIds}
        hasSavedElections={v.case.elections.length > 0}
        defaultAdd={addition ? kids.filter((k) => ev.permittedPersonIds.includes(k)) : ev.permittedPersonIds}
        summary={
          <>
            <Section title="Cost comparison" description="Your contribution per semi-monthly paycheck (24 a year). Rates are illustrative Nexa configuration." bodyClassName="">
              <CostTable costs={ev.costs} planName={planName} totalBefore={ev.totalBeforeCents} totalAfter={ev.totalAfterCents} />
            </Section>
            {payEstimate}
          </>
        }
      />
    </div>
  );
}
