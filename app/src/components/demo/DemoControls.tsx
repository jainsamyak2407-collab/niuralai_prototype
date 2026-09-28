"use client";

import { useId, useState } from "react";
import { History, Mail, RotateCcw, Zap } from "lucide-react";
import type { FailurePreset, ScenarioId } from "@/lib/contracts/domain";
import { fmtDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { ConfirmModal, Field, inputClass, textareaClass, useIntentKey } from "@/components/ui/client";
import { DateText, EmptyState, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { PRESETS, presetTitle, ROLE_LABEL } from "./labels";
import { ActionError, useSimAction, Why } from "./sim-kit";
import { SimTag } from "./SimFrame";
import type { AuditRow, OutboxRow } from "./types";

const CLOCK: { id: "plus_hour" | "next_batch" | "plus_day" | "next_payday"; label: string }[] = [
  { id: "plus_hour", label: "Advance 1 hour" },
  { id: "next_batch", label: "Advance to next batch (10:00 p.m.)" },
  { id: "plus_day", label: "Advance 1 day" },
  { id: "next_payday", label: "Advance to next payday" },
];

export function DemoControls({
  now,
  nextBatchAt,
  preset,
  autopilot,
  store,
  scenario,
  outbox,
  audit,
  names,
  cases,
}: {
  now: string;
  nextBatchAt: string;
  preset: FailurePreset;
  autopilot: boolean;
  store: { mode: string; durable: boolean };
  scenario: { id: ScenarioId; title: string };
  outbox: OutboxRow[];
  audit: AuditRow[];
  names: Record<string, string>;
  cases: Record<string, string>;
}) {
  const action = useSimAction();
  const [choice, setChoice] = useState<FailurePreset>(preset);
  const [clockMsg, setClockMsg] = useState<string | null>(null);
  const [rateNote, setRateNote] = useState("");
  const [rateErr, setRateErr] = useState<string | null>(null);
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const rateKey = useIntentKey();
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("all");
  const presetGroup = useId();

  async function advance(id: (typeof CLOCK)[number]["id"]) {
    setClockMsg(null);
    const res = await action.run(`clock:${id}`, { type: "ops.clock", advance: id });
    if (res.ok) setClockMsg(res.message);
  }

  async function publishRate() {
    const note = rateNote.trim();
    if (note.length < 5) {
      setRateErr("Describe the change in at least 5 characters, for example “Medical rates 2026.2”.");
      return;
    }
    setRateErr(null);
    setRateMsg(null);
    const res = await action.run("rate", { type: "ops.rateChange", note }, rateKey.key);
    if (res.ok) {
      rateKey.reset();
      setRateNote("");
      setRateMsg(res.message);
    }
  }

  async function confirmReset() {
    if (typed.trim().toLowerCase() !== scenario.id) {
      setTypedErr(`Type ${scenario.id} to confirm.`);
      return;
    }
    const res = await action.run("reset", { type: "ops.reset", confirmScenario: scenario.id });
    if (res.ok) {
      setResetOpen(false);
      setTyped("");
      setTypedErr(null);
      setClockMsg(null);
    }
  }

  const recipients = [...new Set(outbox.map((n) => n.recipientUserId))];
  const shown = recipient === "all" ? outbox : outbox.filter((n) => n.recipientUserId === recipient);

  return (
    <div className="flex flex-col gap-5">
      <ActionError action={action} scope={(id) => id !== "reset"} />
      {/* Autopilot */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Zap className="size-4 text-muted" aria-hidden />
            Autopilot
          </span>
        }
        description="After the carrier confirms coverage, payroll and COBRA follow on their own. HR approval, running the batch and the carrier's response stay as clicks."
        actions={<StatusPill tone={autopilot ? "green" : "gray"}>{autopilot ? "On" : "Off"}</StatusPill>}
      >
        <div className="grid grid-cols-1 gap-4 text-[13px] text-ink-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted">Runs on its own (simulated)</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Pay updates once the carrier confirms (HR approved them with the case)</li>
              <li>COBRA referral with an address on file, and its receipt</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Always a person</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>HR approval of every case, one by one or all 100% cases at once</li>
              <li>Running the batch now (otherwise it runs at 10:00 PM ET)</li>
              <li>The carrier receiving and accepting the file (Carrier inbox)</li>
              <li>A carrier mismatch, rejection or unknown delivery</li>
              <li>Retroactive payroll changes flagged for review</li>
              <li>Posting a pay run; a case completes once its paycheck posts</li>
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <Button size="sm" variant={autopilot ? "outline" : "primary"} onClick={() => void action.run("autopilot", { type: "ops.autopilot", on: !autopilot })} pending={action.isBusy("autopilot")} pendingLabel="Saving…">
            {autopilot ? "Turn off autopilot" : "Turn on autopilot"}
          </Button>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Clock */}
        <Section
          title={
            <span className="flex items-center gap-2">
              Business clock
            </span>
          }
          description="Server-owned demo time for this scenario. Advancing runs due jobs through the normal workflow; it cannot complete a case."
        >
          <dl className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[13px] text-muted">Now</dt>
              <dd className="tabular text-ink">{fmtDateTime(now)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted">Next nightly batch</dt>
              <dd className="tabular text-ink">{fmtDateTime(nextBatchAt)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {CLOCK.map((c) => (
              <Button key={c.id} variant="outline" size="sm" onClick={() => void advance(c.id)} pending={action.isBusy(`clock:${c.id}`)} pendingLabel="Running jobs…" disabled={action.anyBusy && !action.isBusy(`clock:${c.id}`)}>
                {c.label}
              </Button>
            ))}
          </div>
          {clockMsg ? (
            <div role="status" className="mt-4 rounded-[8px] border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink-2">
              <p className="mb-0.5 text-xs text-muted">Jobs that ran</p>
              {clockMsg}
            </div>
          ) : null}
        </Section>

        {/* Presets */}
        <Section
          title="Failure preset"
          description="Configures the next matching simulated response, then clears itself. A preset never completes a case."
          actions={<StatusPill tone={preset === "none" ? "gray" : "amber"}>{preset === "none" ? "None armed" : `Armed: ${presetTitle(preset)}`}</StatusPill>}
        >
          <fieldset aria-labelledby={`${presetGroup}-legend`}>
            <legend id={`${presetGroup}-legend`} className="sr-only">
              Failure preset
            </legend>
            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => (
                <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-2 ${choice === p.id ? "border-primary bg-surface" : "border-transparent hover:bg-fill"}`}>
                  <input type="radio" name={presetGroup} value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} className="mt-1 accent-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">
                      {p.title}
                      {preset === p.id && p.id !== "none" ? <span className="ml-2 text-xs text-muted">Armed</span> : null}
                    </span>
                    <span className="block text-xs text-muted">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void action.run("preset", { type: "ops.preset", preset: choice })} pending={action.isBusy("preset")} pendingLabel="Saving…" disabled={choice === preset} aria-describedby={choice === preset ? `${presetGroup}-why` : undefined}>
              {choice === "none" ? "Clear presets" : "Arm preset"}
            </Button>
            {choice === preset ? <Why id={`${presetGroup}-why`}>{preset === "none" ? "Choose a failure to arm." : "This preset is already armed."}</Why> : null}
          </div>
        </Section>

        {/* Rule or rate change */}
        <Section
          title={
            <span className="flex items-center gap-2">
              Publish a rule or rate change <SimTag />
            </span>
          }
          description="Simulates a new configuration version. Every open case gets an HR review task; approved decisions keep their frozen rule snapshot."
        >
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void publishRate();
            }}
          >
            <Field label="What changed" required error={rateErr} hint="Shown to HR on each review task.">
              {({ id, describedBy, invalid }) => (
                <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={textareaClass(invalid)} maxLength={300} value={rateNote} placeholder="For example: Medical employee rates 2026.2 effective Nov 1" onChange={(e) => setRateNote(e.target.value)} />
              )}
            </Field>
            <div>
              <Button size="sm" type="submit" variant="secondary" pending={action.isBusy("rate")} pendingLabel="Publishing…">
                Publish change
              </Button>
            </div>
            {rateMsg ? (
              <p role="status" className="rounded-[8px] border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink-2">
                {rateMsg}
              </p>
            ) : null}
          </form>
        </Section>

        {/* Scenario and storage */}
        <Section
          title={
            <span className="flex items-center gap-2">
              Scenario and storage
            </span>
          }
          description="Each scenario keeps its own records and clock. Switch scenarios from the chip in the top bar."
        >
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[13px] text-muted">Scenario</dt>
              <dd className="text-ink">{scenario.title}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted">Storage</dt>
              <dd className="flex flex-wrap items-center gap-2 text-ink">
                {store.mode}
                <StatusPill tone={store.durable ? "green" : "amber"}>{store.durable ? "Durable" : "Not durable"}</StatusPill>
              </dd>
            </div>
          </dl>
          {!store.durable ? <p className="mt-2 text-xs text-muted">Changes last only while this server runs.</p> : null}
          <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
            <div>
              <Button size="sm" variant="destructive" onClick={() => setResetOpen(true)}>
                <RotateCcw className="size-3.5" aria-hidden />
                Reset this scenario
              </Button>
            </div>
            <p className="text-xs text-muted">Reseeds only the {scenario.title.toLowerCase()} scenario&apos;s synthetic records. Other scenarios are untouched; earlier revisions stay in storage history.</p>
          </div>
        </Section>
      </div>

      {/* Outbox */}
      <Section
        title={
          <span className="flex items-center gap-2">
            Email outbox <SimTag>No real email is sent</SimTag>
          </span>
        }
        description="Rendered simulated inbox. Each recipient gets a different, minimal message."
        actions={
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Recipient
            <select className={`${inputClass()} h-8 w-auto`} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="all">All recipients ({outbox.length})</option>
              {recipients.map((id) => (
                <option key={id} value={id}>
                  {names[id] ?? id} ({outbox.filter((n) => n.recipientUserId === id).length})
                </option>
              ))}
            </select>
          </label>
        }
        bodyClassName=""
      >
        {shown.length ? (
          <Table label="Simulated outbox">
            <THead>
              <tr>
                <Th>Recipient</Th>
                <Th>Subject and preview</Th>
                <Th>Created</Th>
                <Th>Delivery</Th>
                <Th>Linked case</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <tbody>
              {shown.map((n) => (
                <tr key={n.id}>
                  <Td className="min-w-[170px]">
                    {names[n.recipientUserId] ?? n.recipientUserId}
                    <p className="text-xs text-muted">
                      {ROLE_LABEL[n.recipientRole] ?? n.recipientRole} · {n.recipientEmail}
                    </p>
                  </Td>
                  <Td className="max-w-[420px]">
                    <p className="text-ink">{n.subject}</p>
                    <p className="text-xs text-muted">{n.preview}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <DateText time={n.createdAt} />
                  </Td>
                  <Td>
                    <StatusPill tone={n.deliveryState === "simulated_bounced" ? "red" : "green"}>{n.deliveryState === "simulated_bounced" ? "Bounced (simulated)" : "Delivered (simulated)"}</StatusPill>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">{n.caseId ? (cases[n.caseId] ?? n.caseId) : <span className="text-muted">None</span>}</Td>
                  <Td>
                    {n.deliveryState === "simulated_bounced" ? (
                      <Why>HR has an alternate-contact task.</Why>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void action.run(`bounce:${n.id}`, { type: "ops.bounce", notificationId: n.id })} pending={action.isBusy(`bounce:${n.id}`)} pendingLabel="Bouncing…">
                        Simulate bounce
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Mail />} title="No messages yet">
            Messages appear when a case changes in a way the employee, HR, broker or administrator needs to know.
          </EmptyState>
        )}
      </Section>

      {/* Audit */}
      <Section
        title={
          <span className="flex items-center gap-2">
            Recent audit entries
          </span>
        }
        description="Last 25 entries for this scenario, newest first. Times are business time."
        bodyClassName=""
      >
        {audit.length ? (
          <Table label="Recent audit entries">
            <THead>
              <tr>
                <Th>Time</Th>
                <Th>Actor</Th>
                <Th>Event</Th>
                <Th>Summary</Th>
              </tr>
            </THead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap">
                    <DateText time={a.at} />
                  </Td>
                  <Td className="whitespace-nowrap">{names[a.actor] ?? a.actor}</Td>
                  <Td className="font-mono text-xs text-ink-2">{a.type}</Td>
                  <Td className="text-ink-2">{a.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<History />} title="No audit entries">
            Every command and job writes an entry here.
          </EmptyState>
        )}
      </Section>

      <ConfirmModal
        open={resetOpen}
        title={`Reset the ${scenario.title} scenario?`}
        confirmLabel={`Reset ${scenario.id}`}
        tone="destructive"
        pending={action.isBusy("reset")}
        onCancel={() => {
          setResetOpen(false);
          setTyped("");
          setTypedErr(null);
        }}
        onConfirm={() => void confirmReset()}
      >
        <div className="flex flex-col gap-3">
          <p>
            This reseeds only the {scenario.title.toLowerCase()} scenario&apos;s synthetic records: cases, carrier batches, payroll, referrals, outbox and its clock. The other two scenarios do not change. Earlier revisions stay in storage history.
          </p>
          <Field label={`Type ${scenario.id} to confirm`} required error={typedErr}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                autoComplete="off"
                className={inputClass(invalid)}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmReset();
                }}
              />
            )}
          </Field>
          <ActionError action={action} scope={(id) => id === "reset"} />
        </div>
      </ConfirmModal>
    </div>
  );
}
