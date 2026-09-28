"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { ConfirmModal, inputClass, useToast } from "@/components/ui/client";

type ScenarioId = "birth" | "divorce" | "loss";
const SCENARIOS: { id: ScenarioId; title: string; hint: string }[] = [
  { id: "birth", title: "Birth", hint: "Sep 27 · Maya employee-only, Ava born Sep 1" },
  { id: "divorce", title: "Divorce", hint: "Sep 28 · Maya, Arjun and Leela on family coverage" },
  { id: "loss", title: "Loss of other coverage", hint: "Oct 31 · Arjun's other coverage ends Oct 31" },
];
const PEOPLE = [
  { id: "keep", label: "My current role" },
  { id: "u_maya", label: "Maya Shah (employee)" },
  { id: "u_daniel", label: "Daniel Brooks (HR)" },
  { id: "u_ops", label: "Demo operator (simulators)" },
] as const;

/** Top-bar demo reset: choose scenarios, autopilot, and where to land afterwards. */
export function DemoReset({ scenarioId }: { scenarioId: ScenarioId }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ScenarioId[]>([scenarioId]);
  const [autopilot, setAutopilot] = useState(true);
  const [openScenario, setOpenScenario] = useState<ScenarioId>(scenarioId);
  const [continueAs, setContinueAs] = useState<(typeof PEOPLE)[number]["id"]>("keep");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setPicked([scenarioId]);
    setOpenScenario(scenarioId);
    setError(null);
    setOpen(true);
  }
  function toggle(id: ScenarioId) {
    setError(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function submit() {
    if (!picked.length) {
      setError("Choose at least one scenario to reset.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarios: picked, autopilot, openScenario, continueAs }) });
      const body = (await res.json().catch(() => ({ ok: false, message: "We could not reach the server. Try again." }))) as { ok: boolean; message: string; redirect?: string };
      if (!body.ok) {
        setError(body.message);
        return;
      }
      setOpen(false);
      toast({ tone: "success", text: body.message });
      router.push(body.redirect ?? "/");
      router.refresh();
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const errId = `${uid}-error`;
  return (
    <>
      <button type="button" onClick={show} className="flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-ink hover:bg-fill">
        <RotateCcw className="size-4 text-muted" aria-hidden />
        <span className="hidden whitespace-nowrap lg:inline">Reset demo</span>
        <span className="sr-only lg:hidden">Reset demo</span>
      </button>
      <ConfirmModal open={open} title="Reset the demo" confirmLabel={pending ? "Resetting…" : "Reset"} tone="destructive" pending={pending} onCancel={() => setOpen(false)} onConfirm={() => void submit()}>
        <div className="flex flex-col gap-5">
          <fieldset aria-describedby={error ? errId : undefined}>
            <legend className="mb-2 text-sm text-ink">Scenarios to reset</legend>
            <div className="flex flex-col gap-1">
              {SCENARIOS.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-[8px] px-2 py-1.5 hover:bg-fill">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-sm text-ink">
                      {s.title}
                      {s.id === scenarioId ? <span className="ml-2 text-xs text-muted">Current</span> : null}
                    </span>
                    <span className="block text-xs text-muted">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <button type="button" className="mt-1 px-2 text-[13px] text-primary hover:underline" onClick={() => (setPicked(SCENARIOS.map((s) => s.id)), setError(null))}>
              Select all three
            </button>
            {error ? (
              <p id={errId} role="alert" className="mt-2 text-xs text-danger-text">
                {error}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm text-ink">Autopilot</legend>
            <div className="flex flex-col gap-1">
              {[
                { v: true, t: "On", d: "Simulated carrier, payroll and COBRA answer at once. HR still approves and sends the batch." },
                { v: false, t: "Off", d: "Every simulated answer waits for a click in the simulators." },
              ].map((o) => (
                <label key={o.t} className="flex cursor-pointer items-start gap-3 rounded-[8px] px-2 py-1.5 hover:bg-fill">
                  <input type="radio" name={`${uid}-autopilot`} checked={autopilot === o.v} onChange={() => setAutopilot(o.v)} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-sm text-ink">{o.t}</span>
                    <span className="block text-xs text-muted">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              Then open
              <select className={inputClass()} value={openScenario} onChange={(e) => setOpenScenario(e.target.value as ScenarioId)}>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              As
              <select className={inputClass()} value={continueAs} onChange={(e) => setContinueAs(e.target.value as (typeof PEOPLE)[number]["id"])}>
                {PEOPLE.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">Only the chosen scenarios&apos; synthetic records and clocks go back to the start. Earlier revisions stay in storage history.</p>
        </div>
      </ConfirmModal>
    </>
  );
}
