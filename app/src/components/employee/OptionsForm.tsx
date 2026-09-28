"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText } from "lucide-react";
import type { Benefit, ElectionChoice, Tier } from "@/lib/contracts/domain";
import { Button, ButtonLink } from "@/components/ui/button";
import { CommandError, type CommandResponse } from "@/components/ui/client";
import { Money, Section, Tag } from "@/components/ui/primitives";
import { AskEmmaButton } from "@/components/emma/EmmaDock";
import { BENEFIT_LABEL, TIER_LABEL } from "./labels";
import { CheckRow, OptionCards } from "./controls";
import { cmd, saveError, useCaseCommand } from "./useCaseCommand";

export interface PlanInfo {
  id: string;
  benefit: Benefit;
  name: string;
  shortName: string;
  network: string;
  terms: { label: string; value: string }[];
  limitations: string[];
  docId: string;
  employeeCents: Record<Tier, number>;
}
export interface PersonInfo {
  id: string;
  name: string;
  relationship: "self" | "spouse" | "former_spouse" | "child";
}
export interface CurrentInfo {
  benefit: Benefit;
  planId: string;
  tier: Tier;
  coveredIds: string[];
}

type Priority = "lower_paycheck" | "lower_care_cost" | "provider_access";
const BENEFITS: Benefit[] = ["medical", "dental", "vision"];

function tierAfter(current: CurrentInfo | undefined, choice: ElectionChoice, people: PersonInfo[]): Tier {
  const rel = (id: string) => people.find((p) => p.id === id)?.relationship ?? "child";
  const covered = new Set(current?.coveredIds ?? []);
  for (const id of choice.addPersonIds) covered.add(id);
  for (const id of choice.removePersonIds) covered.delete(id);
  const rels = [...covered].map(rel);
  const spouse = rels.includes("spouse");
  const child = rels.includes("child");
  return spouse && child ? "FAM" : spouse ? "ES" : child ? "EC" : "EE";
}

const deductible = (p: PlanInfo) => Number(p.terms.find((t) => t.label === "Deductible")?.value.match(/\$([\d,]+)/)?.[1].replace(/,/g, "") ?? Infinity);

export function OptionsForm({
  caseId,
  version,
  initial,
  initialPriority,
  plans,
  current,
  people,
  permittedPersonIds,
  permittedPlanIds,
  hasSavedElections,
  defaultAdd,
  summary,
}: {
  caseId: string;
  version: number;
  initial: ElectionChoice[];
  initialPriority: Priority | null;
  plans: PlanInfo[];
  current: CurrentInfo[];
  people: PersonInfo[];
  permittedPersonIds: string[];
  permittedPlanIds: Record<Benefit, string[]>;
  hasSavedElections: boolean;
  defaultAdd: string[];
  summary?: ReactNode;
}) {
  const router = useRouter();
  const { run, pending } = useCaseCommand(version);
  const [choices, setChoices] = useState<Record<Benefit, ElectionChoice>>(() => Object.fromEntries(BENEFITS.map((b) => [b, initial.find((e) => e.benefit === b) ?? { benefit: b, planId: permittedPlanIds[b][0] ?? "", addPersonIds: [], removePersonIds: [], enroll: false }])) as Record<Benefit, ElectionChoice>);
  const [priority, setPriority] = useState<Priority | null>(initialPriority);
  const [error, setError] = useState<CommandResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  const saved = useRef(JSON.stringify({ c: choices, priority, s: hasSavedElections }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = JSON.stringify({ c: choices, priority, s: true });
  const dirty = snapshot !== saved.current;

  const cur = (b: Benefit) => current.find((c) => c.benefit === b);
  const addable = permittedPersonIds.filter((id) => people.some((p) => p.id === id));
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "New child";

  async function save(): Promise<boolean> {
    const snap = JSON.stringify({ c: choices, priority, s: true });
    if (snap === saved.current) return true;
    const elections = BENEFITS.map((b) => choices[b]).filter((e) => e.planId);
    const res = await run((v) => cmd({ type: "case.setElections", caseId, expectedVersion: v, elections, priority }));
    if (!res.ok) {
      setError(saveError(res));
      return false;
    }
    saved.current = snap;
    setError(null);
    return true;
  }

  // Autosave shortly after each change so the cost comparison below stays current.
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  async function next() {
    const enrolled = BENEFITS.filter((b) => choices[b].enroll);
    if (!enrolled.length) return setFormError("Choose at least one benefit to change, or go back if nothing needs to change.");
    const empty = enrolled.find((b) => !choices[b].addPersonIds.length && choices[b].planId === cur(b)?.planId);
    if (empty) return setFormError(`Choose who to add to ${BENEFIT_LABEL[empty].toLowerCase()}, or turn that change off.`);
    setFormError(null);
    setGoing(true);
    if (timer.current) clearTimeout(timer.current);
    const ok = await save();
    if (ok) router.push(`/employee/life-events/${caseId}/review`);
    else setGoing(false);
  }

  const update = (b: Benefit, patch: Partial<ElectionChoice>) => {
    setFormError(null);
    setChoices((c) => ({ ...c, [b]: { ...c[b], ...patch } }));
  };

  const medPlans = plans.filter((p) => p.benefit === "medical" && permittedPlanIds.medical.includes(p.id));
  const medTier = tierAfter(cur("medical"), choices.medical, people);
  const cheapest = medPlans.reduce<PlanInfo | null>((a, p) => (!a || p.employeeCents[medTier] < a.employeeCents[medTier] ? p : a), null);
  const lowestDeductible = medPlans.reduce<PlanInfo | null>((a, p) => (!a || deductible(p) < deductible(a) ? p : a), null);
  const match = priority === "lower_paycheck" ? cheapest?.id : priority === "lower_care_cost" ? lowestDeductible?.id : null;

  return (
    <div className="space-y-5">
      <Section title="What matters most to you?" description="Optional. It only highlights a plan; it never changes what you can choose. We never ask about diagnoses or medical history.">
        <OptionCards
          name="priority"
          legend="Your preference"
          cols={3}
          value={priority ?? undefined}
          onChange={(v) => setPriority(v)}
          options={[
            { value: "lower_paycheck", label: "Lower paycheck deduction", description: "Pay less from each paycheck." },
            { value: "lower_care_cost", label: "Lower cost when using care", description: "A lower deductible and out-of-pocket maximum." },
            { value: "provider_access", label: "Checking provider access", description: "Keep seeing the providers you use." },
          ]}
        />
        {priority ? (
          <button type="button" onClick={() => setPriority(null)} className="mt-2 text-[13px] text-primary hover:underline">
            Clear preference
          </button>
        ) : null}
        {priority === "provider_access" ? <p className="mt-2 text-[13px] text-muted">Both plans list the same illustrative network. We cannot confirm whether a provider is in network; check with the insurance provider before you choose.</p> : null}
      </Section>

      {BENEFITS.map((b) => {
        const c = choices[b];
        const now = cur(b);
        const tier = tierAfter(now, c, people);
        const options = plans.filter((p) => p.benefit === b && permittedPlanIds[b].includes(p.id));
        return (
          <Section
            key={b}
            title={BENEFIT_LABEL[b]}
            description={now ? `Now: ${plans.find((p) => p.id === now.planId)?.shortName} · ${TIER_LABEL[now.tier]}` : "You are not enrolled in this benefit today."}
            actions={b === "medical" ? <AskEmmaButton question="Compare the two medical plans for my choices">Explain with Emma</AskEmmaButton> : null}
          >
            <div className="space-y-4">
              <CheckRow checked={c.enroll} onChange={(v) => update(b, { enroll: v, addPersonIds: v && !c.addPersonIds.length ? defaultAdd : c.addPersonIds })} label={`Change my ${BENEFIT_LABEL[b].toLowerCase()} coverage`} description={c.enroll ? undefined : `No change: your ${BENEFIT_LABEL[b].toLowerCase()} stays as it is today.`} />
              {c.enroll ? (
                <>
                  <fieldset>
                    <legend className="mb-2 text-sm text-ink">Who to add</legend>
                    {addable.length ? (
                      <div className="space-y-2">
                        {addable.map((id) => (
                          <CheckRow key={id} checked={c.addPersonIds.includes(id)} onChange={(v) => update(b, { addPersonIds: v ? [...c.addPersonIds, id] : c.addPersonIds.filter((x) => x !== id) })} label={name(id)} description={people.find((p) => p.id === id)?.relationship === "spouse" ? "Spouse" : "Child"} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted">No one else can be added through this request.</p>
                    )}
                  </fieldset>
                  {options.length > 1 ? (
                    <fieldset>
                      <legend className="mb-2 text-sm text-ink">Choose a plan</legend>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {options.map((p) => (
                          <PlanCard key={p.id} plan={p} tier={tier} selected={c.planId === p.id} current={now?.planId === p.id} matches={match === p.id} onSelect={() => update(b, { planId: p.id })} name={`plan-${b}`} />
                        ))}
                      </div>
                    </fieldset>
                  ) : options[0] ? (
                    <PlanCard plan={options[0]} tier={tier} selected current={now?.planId === options[0].id} matches={false} name={`plan-${b}`} />
                  ) : null}
                </>
              ) : null}
            </div>
          </Section>
        );
      })}

      {summary}

      {formError ? (
        <p role="alert" className="text-sm text-danger-text">
          {formError}
        </p>
      ) : null}
      {error ? <CommandError result={error} onRetry={() => void save()} /> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink href={`/employee/life-events/${caseId}/evidence`} variant="ghost">
          <ArrowLeft className="size-4" aria-hidden /> Back to documents
        </ButtonLink>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs text-muted" aria-live="polite">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "Choices saved"}
          </span>
          <Button onClick={next} pending={going} pendingLabel="Saving…">
            Continue to review <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, tier, selected, current, matches, onSelect, name }: { plan: PlanInfo; tier: Tier; selected: boolean; current: boolean; matches: boolean; onSelect?: () => void; name: string }) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        {onSelect ? (
          <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-success bg-success" : "border-line"}`}>
            {selected ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base text-ink">
            {plan.shortName}
            <Tag>Illustrative</Tag>
            {current ? <Tag>Current plan</Tag> : null}
            {matches ? <Tag className="bg-success-soft text-success-text">Matches your preference</Tag> : null}
          </p>
          <p className="mt-2 text-lg text-ink">
            <Money cents={plan.employeeCents[tier]} />
            <span className="ml-1 text-[13px] text-muted">per paycheck · {TIER_LABEL[tier]}</span>
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-divider pt-3 text-[13px] sm:grid-cols-2">
        {plan.terms.map((t) => (
          <div key={t.label} className="min-w-0">
            <dt className="text-muted">{t.label}</dt>
            <dd className="text-ink">{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[13px] text-muted">{plan.network}</p>
      <a href={`/api/documents/${plan.docId}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
        <FileText className="size-3.5" aria-hidden /> Plan summary (source document)
      </a>
    </>
  );
  if (!onSelect) return <div className="rounded-[10px] border border-line bg-surface p-4">{body}</div>;
  return (
    <label className={`block cursor-pointer rounded-[10px] border bg-surface p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${selected ? "border-success ring-1 ring-success" : "border-line hover:border-tint-2"}`}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" aria-label={`${plan.shortName}, per paycheck`} />
      {body}
    </label>
  );
}
