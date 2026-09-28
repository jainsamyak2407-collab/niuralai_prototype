"use client";

import { type FocusEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import type { ChildFacts, EventCode, EventFacts, LossReason, TimingResult } from "@/lib/contracts/domain";
import { Button, ButtonLink } from "@/components/ui/button";
import { CommandError, type CommandResponse, Field, inputClass, textareaClass, useCommand } from "@/components/ui/client";
import { Banner, Section, Tag } from "@/components/ui/primitives";
import { isValidDate } from "@/lib/dates";
import { CheckRow, OptionCards, YesNo } from "./controls";
import { TimingBanner } from "./TimingBanner";
import { isAddition } from "./labels";
import { cmd, saveError, useCaseCommand } from "./useCaseCommand";

export interface HouseholdPerson {
  id: string;
  name: string;
  relationship: "self" | "spouse" | "former_spouse" | "child";
}

interface Props {
  caseId: string;
  version: number;
  eventCode: EventCode;
  facts: EventFacts;
  household: HouseholdPerson[];
  coveredNames: string[];
  lossReasons: Record<string, string>;
  timing: TimingResult;
  lastName: string;
}

type Errors = Record<string, string>;
const MEDICAID = "__medicaid";

function newChild(lastName: string): ChildFacts {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return { personId: `p_child_${rand}`, firstName: "", lastName, dob: null, ssnStatus: "pending" };
}

/** Only the keys the updateDraft schema accepts (it is strict). */
function toPatch(code: EventCode, f: EventFacts) {
  const p: Record<string, unknown> = {
    residenceStateChanged: f.residenceStateChanged ? f.residenceStateChanged.toUpperCase() : null,
    explanation: f.explanation ?? "",
  };
  if (isAddition(code)) {
    p.children = (f.children ?? []).map((k) => ({ personId: k.personId, firstName: k.firstName.trim(), lastName: k.lastName.trim(), dob: isValidDate(k.dob) ? k.dob : null, ssnStatus: k.ssnStatus }));
    if (code !== "birth") {
      p.eventDate = isValidDate(f.eventDate) ? f.eventDate : null;
      p.adoptionKind = code === "adoption" ? "adoption" : "placement";
    }
  } else if (code === "divorce") {
    if (f.direction) p.direction = f.direction;
    if (f.divorceFinal !== undefined) p.divorceFinal = f.divorceFinal;
    p.eventDate = isValidDate(f.eventDate) ? f.eventDate : null;
    if (f.formerSpousePersonId) p.formerSpousePersonId = f.formerSpousePersonId;
    if (f.childCoverageOrder) p.childCoverageOrder = f.childCoverageOrder;
    if (f.formerSpouseContactKnown !== undefined) p.formerSpouseContactKnown = f.formerSpouseContactKnown;
  } else if (code === "loss_of_other_coverage") {
    p.lostCoveragePersonIds = f.lostCoveragePersonIds ?? [];
    if (f.lossReason) p.lossReason = f.lossReason;
    p.priorEmployer = f.priorEmployer ?? "";
    p.priorCarrier = f.priorCarrier ?? "";
    p.lastWorkday = isValidDate(f.lastWorkday) ? f.lastWorkday : null;
    p.coverageEndDate = f.coverageEndUnknown ? null : isValidDate(f.coverageEndDate) ? f.coverageEndDate : null;
    p.coverageEndUnknown = !!f.coverageEndUnknown;
    if (f.otherCoverageRemains !== undefined) p.otherCoverageRemains = f.otherCoverageRemains;
    if (f.priorCoverageConfirmed !== undefined) p.priorCoverageConfirmed = f.priorCoverageConfirmed;
  } else {
    p.eventDate = isValidDate(f.eventDate) ? f.eventDate : null;
  }
  return p;
}

/** Map server field paths ("facts.children.0.dob") to form keys ("child.0.dob"). */
function mapServerErrors(fe?: Record<string, string>): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fe ?? {})) {
    const key = k.replace(/^facts\./, "").replace(/^children\.(\d+)\./, "child.$1.");
    out[key] = v;
  }
  return out;
}

export function DetailsForm({ caseId, version, eventCode, facts, household, coveredNames, lossReasons, timing, lastName }: Props) {
  const router = useRouter();
  const { run, pending } = useCaseCommand(version);
  const { send } = useCommand();
  const [code, setCode] = useState<EventCode>(eventCode);
  const [f, setF] = useState<EventFacts>(() => ({
    ...facts,
    children: isAddition(eventCode) ? (facts.children?.length ? facts.children : [newChild(lastName)]) : facts.children,
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [badDates, setBadDates] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [medicaid, setMedicaid] = useState(false);
  const [moved, setMoved] = useState(!!facts.residenceStateChanged);
  const [starting, setStarting] = useState<EventCode | null>(null);
  const lastAction = useRef<"quiet" | "draft" | "continue">("quiet");
  const saved = useRef(JSON.stringify({ code: eventCode, p: toPatch(eventCode, { ...facts, children: isAddition(eventCode) ? (facts.children ?? []) : facts.children }) }));

  const set = (patch: Partial<EventFacts>) => setF((x) => ({ ...x, ...patch }));
  const clearErr = (...keys: string[]) => setErrors((e) => (keys.some((k) => e[k]) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));
  const addition = isAddition(code);
  const assisted = !addition && code !== "divorce" && code !== "loss_of_other_coverage";
  const late = timing.status === "late";
  const dirty = JSON.stringify({ code, p: toPatch(code, f) }) !== saved.current;

  const people = useMemo(() => {
    const covered = new Set(coveredNames);
    return household.map((p) => ({ ...p, covered: covered.has(p.name) }));
  }, [household, coveredNames]);
  const spouses = people.filter((p) => p.relationship === "spouse" || p.relationship === "former_spouse");
  const lossPeople = people.filter((p) => !(p.relationship === "self" && p.covered));

  // ---- validation ----
  function formatErrors(): Errors {
    const e: Errors = {};
    for (const k of badDates) e[k] = "Enter a valid date.";
    const checkDate = (key: string, v: string | null | undefined) => {
      if (v && (!isValidDate(v) || v < "1900-01-01" || v > "2100-12-31")) e[key] = "Enter a valid date.";
    };
    (f.children ?? []).forEach((k, i) => checkDate(`child.${i}.dob`, k.dob));
    checkDate("eventDate", f.eventDate);
    checkDate("lastWorkday", f.lastWorkday);
    if (!f.coverageEndUnknown) checkDate("coverageEndDate", f.coverageEndDate);
    if (moved && f.residenceStateChanged && !/^[A-Za-z]{2}$/.test(f.residenceStateChanged)) e.residenceStateChanged = "Enter a two-letter state code, like NJ.";
    return e;
  }

  function requiredErrors(): Errors {
    const e: Errors = {};
    if (addition) {
      (f.children ?? []).forEach((k, i) => {
        if (!k.firstName.trim()) e[`child.${i}.firstName`] = "Enter a first name.";
        if (!k.dob) e[`child.${i}.dob`] = "Enter a valid date.";
      });
      if (code !== "birth" && !f.eventDate) e.eventDate = "Enter a valid date.";
    } else if (code === "divorce") {
      if (!f.direction) e.direction = "Choose the option that fits.";
      if (f.direction === "remove_from_nexa" || f.direction === "both") {
        if (f.divorceFinal === undefined) e.divorceFinal = "Choose yes or no.";
        if (f.divorceFinal && !f.eventDate) e.eventDate = "Enter a valid date.";
        if (!f.formerSpousePersonId) e.formerSpousePersonId = "Choose your former spouse.";
        if (!f.childCoverageOrder) e.childCoverageOrder = "Choose the option that fits.";
        if (f.formerSpouseContactKnown === undefined) e.formerSpouseContactKnown = "Choose yes or no.";
      }
    } else if (code === "loss_of_other_coverage") {
      if (!f.lostCoveragePersonIds?.length) e.lostCoveragePersonIds = "Choose at least one person.";
      if (!f.lossReason) e.lossReason = medicaid ? "Medicaid and CHIP use a separate request. Start it below." : "Choose why the coverage ended.";
      if (!f.coverageEndUnknown && !f.coverageEndDate) e.coverageEndDate = "Enter the coverage end date, or tick that you don't know it.";
      if (f.otherCoverageRemains === undefined) e.otherCoverageRemains = "Choose yes or no.";
      if (f.priorCoverageConfirmed === undefined) e.priorCoverageConfirmed = "Choose yes or no.";
    } else {
      if (code !== "not_sure" && !f.eventDate) e.eventDate = "Enter a valid date.";
      if (!f.explanation?.trim()) e.explanation = code === "not_sure" ? "Describe what changed so HR can help." : "Tell us what happened.";
    }
    if (moved && !f.residenceStateChanged) e.residenceStateChanged = "Enter a two-letter state code, like NJ.";
    return e;
  }

  // ---- save ----
  async function save(mode: "quiet" | "draft" | "continue") {
    lastAction.current = mode;
    const fe = formatErrors();
    const req = mode === "continue" ? requiredErrors() : {};
    const all = { ...req, ...fe };
    // A quiet autosave only adds format errors; it never clears errors from an explicit attempt.
    setErrors((prev) => (mode === "quiet" ? { ...prev, ...fe } : all));
    if (Object.keys(fe).length || (mode === "continue" && Object.keys(all).length)) {
      if (mode !== "quiet") {
        const first = Object.keys(all)[0];
        document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] textarea`)?.focus();
      }
      return false;
    }
    const snapshot = JSON.stringify({ code, p: toPatch(code, f) });
    if (snapshot !== saved.current) {
      const patch = toPatch(code, f);
      const codeChanged = code !== JSON.parse(saved.current).code;
      const res = await run((v) => cmd({ type: "case.updateDraft", caseId, expectedVersion: v, ...(codeChanged ? { eventCode: code } : {}), facts: patch as never }), { successToast: false });
      if (!res.ok) {
        setResult(saveError(res));
        setErrors((e) => ({ ...e, ...mapServerErrors(res.fieldErrors) }));
        return false;
      }
      saved.current = snapshot;
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    }
    setResult(null);
    if (mode === "draft") setSavedAt((s) => s ?? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    if (mode === "continue") router.push(`/employee/life-events/${caseId}/evidence`);
    return true;
  }

  function onBlur(e: FocusEvent<HTMLFormElement>) {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.dataset.save || (e.target as HTMLElement).dataset.save) return; // an explicit save button handles it
    if (dirty) void save("quiet");
  }

  function dateBlur(key: string) {
    return (e: FocusEvent<HTMLInputElement>) => {
      const bad = e.target.validity.badInput;
      setBadDates((s) => {
        const n = new Set(s);
        if (bad) n.add(key);
        else n.delete(key);
        return n;
      });
      if (bad) setErrors((x) => ({ ...x, [key]: "Enter a valid date." }));
    };
  }

  async function startOther(target: EventCode) {
    setStarting(target);
    await save("quiet");
    const res = await send(cmd({ type: "case.createDraft", eventCode: target }), { successToast: false });
    if (res.ok && res.entityId) {
      router.push(`/employee/life-events/${res.entityId}/details`);
      return;
    }
    setStarting(null);
    setResult(res);
  }

  const err = (k: string) => errors[k] ?? null;
  const children = f.children ?? [];
  const setChild = (i: number, patch: Partial<ChildFacts>) => set({ children: children.map((k, j) => (j === i ? { ...k, ...patch } : k)) });

  const removing = code === "divorce" && (f.direction === "remove_from_nexa" || f.direction === "both");
  const namedSpouse = removing && f.formerSpousePersonId ? people.find((p) => p.id === f.formerSpousePersonId) : undefined;
  const spouseNotCovered = !!namedSpouse && !namedSpouse.covered;
  const blockContinue =
    code === "divorce" && f.direction === "lost_outside_coverage"
      ? "Start the loss-of-coverage request to continue. This request does not apply."
      : spouseNotCovered && f.direction === "remove_from_nexa"
        ? `${namedSpouse?.name} is not on your Nexa plan, so there is no one to remove.`
        : null;

  return (
    <form
      noValidate
      onBlur={onBlur}
      onSubmit={(e) => {
        e.preventDefault();
        void save("continue");
      }}
      className="space-y-5"
    >
      <TimingBanner timing={timing} caseId={caseId} onSaveDraft={() => save("draft")} savePending={pending && lastAction.current === "draft"} />

      {/* ---------- Birth / adoption / placement ---------- */}
      {addition && code !== "birth" ? (
        <Section title="Adoption or placement" description="Coverage starts on the date of adoption or placement, for each child.">
          <div className="space-y-5">
            <OptionCards
              name="adoptionKind"
              legend="What happened?"
              required
              value={code === "adoption" ? "adoption" : "placement"}
              onChange={(v) => setCode(v === "adoption" ? "adoption" : "placement_for_adoption")}
              options={[
                { value: "adoption", label: "The adoption is final", description: "Use the date of the adoption." },
                { value: "placement", label: "A child was placed with me for adoption", description: "Use the placement date. A later adoption decree does not enroll the child twice." },
              ]}
              hint={code !== eventCode ? "Changing this clears your benefit choices. Your deadline and coverage dates are recalculated when you save." : undefined}
            />
            <div data-field="eventDate" className="max-w-xs">
              <Field label={code === "adoption" ? "Date of adoption" : "Date of placement"} required error={err("eventDate")}>
                {(a) => <input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={f.eventDate ?? ""} onChange={(e) => (set({ eventDate: e.target.value || null }), clearErr("eventDate"))} onBlur={dateBlur("eventDate")} />}
              </Field>
            </div>
          </div>
        </Section>
      ) : null}

      {addition ? (
        <Section
          title={children.length > 1 ? "Your children" : "Your child"}
          description="Each child is recorded separately, even twins with the same birthday. Missing details like an SSN can follow later."
          bodyClassName="divide-y divide-divider"
        >
          {children.map((k, i) => (
            <fieldset key={k.personId} className="px-5 py-4">
              <legend className="sr-only">Child {i + 1}</legend>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Child {i + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ children: children.filter((_, j) => j !== i) })}
                  disabled={children.length === 1}
                  title={children.length === 1 ? "A request needs at least one child." : undefined}
                  aria-label={`Remove child ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px]">
                <div data-field={`child.${i}.firstName`}>
                  <Field label="First name" required error={err(`child.${i}.firstName`)} hint="A temporary name is fine.">
                    {(a) => <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={k.firstName} maxLength={60} autoComplete="off" onChange={(e) => (setChild(i, { firstName: e.target.value }), clearErr(`child.${i}.firstName`))} />}
                  </Field>
                </div>
                <div data-field={`child.${i}.lastName`}>
                  <Field label="Last name" error={err(`child.${i}.lastName`)}>
                    {(a) => <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={k.lastName} maxLength={60} autoComplete="off" onChange={(e) => setChild(i, { lastName: e.target.value })} />}
                  </Field>
                </div>
                <div data-field={`child.${i}.dob`}>
                  <Field label="Date of birth" required error={err(`child.${i}.dob`)}>
                    {(a) => <input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={k.dob ?? ""} onChange={(e) => (setChild(i, { dob: e.target.value || null }), clearErr(`child.${i}.dob`))} onBlur={dateBlur(`child.${i}.dob`)} />}
                  </Field>
                </div>
              </div>
              <div className="mt-3">
                <CheckRow checked={k.ssnStatus === "pending"} onChange={(v) => setChild(i, { ssnStatus: v ? "pending" : "on_file" })} label="Social Security number not issued yet" description="You can add it later in your secure profile. We never invent a value." />
              </div>
            </fieldset>
          ))}
          <div className="px-5 py-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => set({ children: [...children, newChild(lastName)] })} disabled={children.length >= 6}>
              <Plus className="size-4" aria-hidden /> Add another child
            </Button>
          </div>
        </Section>
      ) : null}

      {/* ---------- Divorce ---------- */}
      {code === "divorce" ? (
        <>
          <Section title="Which applies to you?">
            <div data-field="direction">
              <OptionCards
                name="direction"
                legend="Are you removing your former spouse from Nexa's plan, or did you lose coverage under their plan?"
                required
                error={err("direction")}
                value={f.direction}
                onChange={(v) => (set({ direction: v }), clearErr("direction"))}
                options={[
                  { value: "remove_from_nexa", label: "Remove my former spouse from Nexa's plan", description: "They are on your Nexa coverage today." },
                  { value: "lost_outside_coverage", label: "I lost coverage under their plan", description: "You or your children were covered by your former spouse's plan." },
                  { value: "both", label: "Both of these", description: "We handle the removal here and your lost coverage in a linked request." },
                  { value: "not_sure", label: "I'm not sure", description: "HR will help confirm whose plan is affected." },
                ]}
              />
            </div>
            {f.direction === "lost_outside_coverage" || f.direction === "both" ? (
              <Banner
                className="mt-4"
                title={f.direction === "both" ? "Your lost coverage needs its own request" : "This is a loss of other coverage"}
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => startOther("loss_of_other_coverage")} pending={starting === "loss_of_other_coverage"} pendingLabel="Starting…">
                    Start a loss-of-coverage request
                  </Button>
                }
              >
                {f.direction === "both"
                  ? "Lost coverage uses different rules and dates. Finish the removal here, then complete the linked request."
                  : "Losing coverage under a former spouse's plan follows the loss-of-coverage rules, with its own dates. Nothing on your Nexa plan ends because of this answer."}
              </Banner>
            ) : null}
          </Section>

          {f.direction === "remove_from_nexa" || f.direction === "both" ? (
            <Section title="About the divorce" description="Coverage for your former spouse ends on the last day of the month the divorce became final. Everyone else stays covered.">
              <div className="space-y-5">
                <div data-field="divorceFinal">
                  <YesNo name="divorceFinal" legend="Is the divorce final?" required value={f.divorceFinal} error={err("divorceFinal")} onChange={(v) => (set({ divorceFinal: v }), clearErr("divorceFinal"))} hint={f.divorceFinal === false ? "A divorce that is not final does not change coverage. Save your draft and submit after it is final." : undefined} />
                </div>
                {f.divorceFinal ? (
                  <div data-field="eventDate" className="max-w-xs">
                    <Field label="Date the divorce became final" required error={err("eventDate")}>
                      {(a) => <input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={f.eventDate ?? ""} onChange={(e) => (set({ eventDate: e.target.value || null }), clearErr("eventDate"))} onBlur={dateBlur("eventDate")} />}
                    </Field>
                  </div>
                ) : null}
                <div data-field="formerSpousePersonId" className="max-w-sm">
                  <Field label="Former spouse" required error={err("formerSpousePersonId")}>
                    {(a) => (
                      <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={f.formerSpousePersonId ?? ""} onChange={(e) => (set({ formerSpousePersonId: e.target.value || undefined }), clearErr("formerSpousePersonId"))}>
                        <option value="">Choose a person</option>
                        {spouses.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.covered ? " (on your Nexa coverage)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                {spouseNotCovered && namedSpouse ? (
                  <Banner tone="warning" title={`${namedSpouse.name} is not on your Nexa plan`}>
                    Your Nexa coverage today does not include {namedSpouse.name}, so nothing ends and your deduction stays the same. If you lost coverage under their plan, choose
                    &ldquo;I lost coverage under their plan&rdquo; above. If you think your coverage list is wrong, ask Emma or contact HR.
                  </Banner>
                ) : null}
                <div data-field="childCoverageOrder">
                  <OptionCards
                    name="childCoverageOrder"
                    legend="Does a court order say who must cover your children?"
                    required
                    cols={3}
                    error={err("childCoverageOrder")}
                    value={f.childCoverageOrder}
                    onChange={(v) => (set({ childCoverageOrder: v }), clearErr("childCoverageOrder"))}
                    options={[
                      { value: "none", label: "No order about coverage" },
                      { value: "order_exists", label: "Yes, there is an order" },
                      { value: "not_sure", label: "I'm not sure" },
                    ]}
                    hint="Your children stay covered either way. An order only means HR confirms the details first."
                  />
                </div>
                <div data-field="formerSpouseContactKnown">
                  <YesNo
                    name="formerSpouseContactKnown"
                    legend="Do you know your former spouse's current mailing address?"
                    required
                    value={f.formerSpouseContactKnown}
                    error={err("formerSpouseContactKnown")}
                    onChange={(v) => (set({ formerSpouseContactKnown: v }), clearErr("formerSpouseContactKnown"))}
                    hint="We only ask whether it is known. Nexa's continuation administrator contacts them directly; you never deliver their notice, and their details stay private."
                  />
                </div>
              </div>
            </Section>
          ) : null}
        </>
      ) : null}

      {/* ---------- Loss of other coverage ---------- */}
      {code === "loss_of_other_coverage" ? (
        <>
          <Section title="Who lost coverage" description="We ask who lost coverage before deciding who can be added.">
            <div className="space-y-5">
              <fieldset data-field="lostCoveragePersonIds" aria-describedby={err("lostCoveragePersonIds") ? "lost-error" : undefined}>
                <legend className="mb-2 text-sm text-ink">
                  People who lost the other coverage<span className="ml-0.5 text-danger" aria-hidden>*</span>
                </legend>
                <div className="space-y-2.5">
                  {lossPeople.map((p) => (
                    <CheckRow
                      key={p.id}
                      checked={(f.lostCoveragePersonIds ?? []).includes(p.id)}
                      onChange={(v) => (set({ lostCoveragePersonIds: v ? [...(f.lostCoveragePersonIds ?? []), p.id] : (f.lostCoveragePersonIds ?? []).filter((x) => x !== p.id) }), clearErr("lostCoveragePersonIds"))}
                      label={
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {p.name} <span className="text-muted capitalize">· {p.relationship === "self" ? "you" : p.relationship.replace("_", " ")}</span>
                          {p.covered ? <Tag>Already on your Nexa plan</Tag> : null}
                        </span>
                      }
                    />
                  ))}
                </div>
                {err("lostCoveragePersonIds") ? (
                  <p id="lost-error" className="mt-1.5 text-xs text-danger-text">
                    {err("lostCoveragePersonIds")}
                  </p>
                ) : null}
              </fieldset>
              <div data-field="lossReason" className="max-w-md">
                <Field label="Why did the coverage end?" required error={err("lossReason")}>
                  {(a) => (
                    <select
                      id={a.id}
                      aria-describedby={a.describedBy}
                      aria-invalid={a.invalid}
                      className={inputClass(a.invalid)}
                      value={medicaid ? MEDICAID : (f.lossReason ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMedicaid(v === MEDICAID);
                        set({ lossReason: v && v !== MEDICAID ? (v as LossReason) : undefined });
                        clearErr("lossReason");
                      }}
                    >
                      <option value="">Choose a reason</option>
                      {Object.entries(lossReasons).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                      <option value={MEDICAID}>Medicaid or CHIP coverage ended</option>
                    </select>
                  )}
                </Field>
              </div>
              {medicaid ? (
                <Banner
                  title="Medicaid and CHIP use a separate request"
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={() => startOther("medicaid_chip_loss")} pending={starting === "medicaid_chip_loss"} pendingLabel="Starting…">
                      Start a Medicaid or CHIP request
                    </Button>
                  }
                >
                  Losing Medicaid or CHIP eligibility has its own 60-day window and rules, so it is reported separately.
                </Banner>
              ) : null}
            </div>
          </Section>

          <Section title="Dates" description="The coverage end date sets your deadline and when Nexa coverage can start.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div data-field="lastWorkday">
                <Field label="Last day worked (if a job ended)" error={err("lastWorkday")} hint="Kept separately. It is not used as the coverage end date.">
                  {(a) => <input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={f.lastWorkday ?? ""} onChange={(e) => (set({ lastWorkday: e.target.value || null }), clearErr("lastWorkday"))} onBlur={dateBlur("lastWorkday")} />}
                </Field>
              </div>
              <div data-field="coverageEndDate">
                <Field label="Date the health coverage ends" required={!f.coverageEndUnknown} error={err("coverageEndDate")} hint="Use the date health coverage ends, which may be different from the last day worked. If you do not know it, ask HR to help verify it.">
                  {(a) => (
                    <input
                      id={a.id}
                      type="date"
                      aria-describedby={a.describedBy}
                      aria-invalid={a.invalid}
                      disabled={!!f.coverageEndUnknown}
                      className={`${inputClass(a.invalid)} disabled:bg-fill disabled:text-muted`}
                      value={f.coverageEndUnknown ? "" : (f.coverageEndDate ?? "")}
                      onChange={(e) => (set({ coverageEndDate: e.target.value || null }), clearErr("coverageEndDate"))}
                      onBlur={dateBlur("coverageEndDate")}
                    />
                  )}
                </Field>
                <div className="mt-2.5">
                  <CheckRow checked={!!f.coverageEndUnknown} onChange={(v) => (set({ coverageEndUnknown: v, coverageEndDate: v ? null : f.coverageEndDate }), clearErr("coverageEndDate"))} label="I don't know the coverage end date" description="HR will help verify it. Your deadline appears once the date is known." />
                </div>
              </div>
            </div>
          </Section>

          <Section title="About the other coverage">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Employer that provided it (optional)">
                  {(a) => <input id={a.id} aria-describedby={a.describedBy} className={inputClass()} value={f.priorEmployer ?? ""} maxLength={120} onChange={(e) => set({ priorEmployer: e.target.value })} />}
                </Field>
                <Field label="Insurance company (optional)">
                  {(a) => <input id={a.id} aria-describedby={a.describedBy} className={inputClass()} value={f.priorCarrier ?? ""} maxLength={120} onChange={(e) => set({ priorCarrier: e.target.value })} />}
                </Field>
              </div>
              <div data-field="priorCoverageConfirmed">
                <YesNo
                  name="priorCoverageConfirmed"
                  legend="Did the people you chose actually have this coverage before it ended?"
                  required
                  value={f.priorCoverageConfirmed}
                  error={err("priorCoverageConfirmed")}
                  onChange={(v) => (set({ priorCoverageConfirmed: v }), clearErr("priorCoverageConfirmed"))}
                  hint={f.priorCoverageConfirmed === false ? "Then this is not a loss of coverage. HR will review other options with you." : undefined}
                />
              </div>
              <div data-field="otherCoverageRemains">
                <YesNo name="otherCoverageRemains" legend="Does anyone who lost coverage still have other health coverage?" required value={f.otherCoverageRemains} error={err("otherCoverageRemains")} onChange={(v) => (set({ otherCoverageRemains: v }), clearErr("otherCoverageRemains"))} hint={f.otherCoverageRemains ? "HR reviews how the remaining coverage affects this request." : undefined} />
              </div>
            </div>
          </Section>
        </>
      ) : null}

      {/* ---------- Assisted review and "not sure" ---------- */}
      {assisted ? (
        <Section title="What happened" description={code === "not_sure" ? "Describe the change in your own words. HR will choose the right request with you." : "HR reviews this kind of change with you and confirms which benefit changes are available."}>
          <div className="space-y-5">
            <div data-field="eventDate" className="max-w-xs">
              <Field label={code === "not_sure" ? "When did it happen? (if known)" : "When did it happen?"} required={code !== "not_sure"} error={err("eventDate")}>
                {(a) => <input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} className={inputClass(a.invalid)} value={f.eventDate ?? ""} onChange={(e) => (set({ eventDate: e.target.value || null }), clearErr("eventDate"))} onBlur={dateBlur("eventDate")} />}
              </Field>
            </div>
            <div data-field="explanation">
              <Field label={code === "not_sure" ? "What changed?" : "Tell HR what happened"} required error={err("explanation")} hint="Share only what HR needs to know. Do not include medical details or diagnoses.">
                {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={4} maxLength={2000} value={f.explanation ?? ""} onChange={(e) => (set({ explanation: e.target.value }), clearErr("explanation"))} />}
              </Field>
            </div>
          </div>
        </Section>
      ) : null}

      {/* ---------- All events ---------- */}
      <Section title={assisted ? "Anything else" : "Anything else HR should know"}>
        <div className="space-y-5">
          <div data-field="residenceStateChanged">
            <CheckRow
              checked={moved}
              onChange={(v) => {
                setMoved(v);
                set({ residenceStateChanged: v ? (f.residenceStateChanged ?? "") : null });
                clearErr("residenceStateChanged");
              }}
              label="I moved to another state"
              description="A move can change which rules apply. HR reviews it before anything is sent."
            />
            {moved ? (
              <div className="mt-3 max-w-[200px]">
                <Field label="New state" required error={err("residenceStateChanged")} hint="Two letters, like NJ.">
                  {(a) => <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={`${inputClass(a.invalid)} uppercase`} maxLength={2} value={f.residenceStateChanged ?? ""} onChange={(e) => (set({ residenceStateChanged: e.target.value.toUpperCase() }), clearErr("residenceStateChanged"))} />}
                </Field>
              </div>
            ) : null}
          </div>
          {!assisted ? (
            <div data-field="explanation">
              <Field label={late ? "Explain what happened" : "Note for HR (optional)"} required={late} error={err("explanation")} hint={late ? "Needed to send a late request to HR for review." : "Required only if you send a late request to HR for review."}>
                {(a) => <textarea id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} className={textareaClass(a.invalid)} rows={3} maxLength={2000} value={f.explanation ?? ""} onChange={(e) => (set({ explanation: e.target.value }), clearErr("explanation"))} />}
              </Field>
            </div>
          ) : null}
        </div>
      </Section>

      {result ? <CommandError result={result} onRetry={() => save(lastAction.current === "quiet" ? "draft" : lastAction.current)} /> : null}

      <FormFooter>
        <ButtonLink href="/employee/life-events" variant="ghost">
          Back to life events
        </ButtonLink>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SaveState pending={pending} dirty={dirty} savedAt={savedAt} />
          <Button type="button" variant="outline" data-save="1" onClick={() => save("draft")} pending={pending && lastAction.current === "draft"} pendingLabel="Saving…">
            Save draft
          </Button>
          <Button type="submit" data-save="1" disabled={!!blockContinue} title={blockContinue ?? undefined} pending={pending && lastAction.current === "continue"} pendingLabel="Saving…">
            Save and continue <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </FormFooter>
      {blockContinue ? <p className="-mt-3 text-right text-xs text-muted">{blockContinue}</p> : null}
    </form>
  );
}

export function FormFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">{children}</div>;
}

function SaveState({ pending, dirty, savedAt }: { pending: boolean; dirty: boolean; savedAt: string | null }) {
  return (
    <span className="text-xs text-muted" aria-live="polite">
      {pending ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved at ${savedAt}` : "All changes saved"}
    </span>
  );
}
