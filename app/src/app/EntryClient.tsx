"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Briefcase, Building2, HeartHandshake, Plug, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScenarioId = "birth" | "divorce" | "loss";

const ENTRIES = [
  { userId: "u_maya", title: "Employee", who: "Continue as Maya", detail: "Maya Shah · Senior Product Designer at Nexa", icon: UserRound, primary: true },
  { userId: "u_daniel", title: "HR administrator", who: "Continue as Daniel", detail: "Daniel Brooks · HR and payroll administrator", icon: Building2, primary: true },
  { userId: "u_ops", title: "Integration demo", who: "Open the simulators", detail: "Demo operator · carrier, payroll, COBRA, email, clock", icon: Plug, primary: false },
];
const MORE = [
  { userId: "u_priya", who: "Priya Patel", detail: "Broker · assigned tasks only", icon: Briefcase },
  { userId: "u_carrier", who: "Carrier operator", detail: "Simulated carrier inbox only", icon: ShieldCheck },
  { userId: "u_cobra", who: "Continuation administrator", detail: "Assigned COBRA referrals only", icon: HeartHandshake },
];

export function EntryClient({ scenarios, currentScenario, currentUser }: { scenarios: { id: ScenarioId; title: string; start: string; summary: string }[]; currentScenario: ScenarioId; currentUser: string | null }) {
  const [scenario, setScenario] = useState<ScenarioId>(currentScenario);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function enter(userId: string) {
    setPending(userId);
    setError(null);
    try {
      const res = await fetch("/api/session/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, scenarioId: scenario }) });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.message);
      router.push(body.redirect);
    } catch (e) {
      setError((e as Error).message || "We could not start the demo session. Try again.");
      setPending(null);
    }
  }

  return (
    <>
      <section className="mt-8" aria-labelledby="scenario-h">
        <h2 id="scenario-h" className="text-base font-medium">
          Scenario
        </h2>
        <p className="mt-1 text-sm text-muted">Three separate synthetic households. Switching keeps each scenario&apos;s records and clock.</p>
        <div role="radiogroup" aria-labelledby="scenario-h" className="mt-3 grid gap-3 md:grid-cols-3">
          {scenarios.map((s) => {
            const sel = s.id === scenario;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setScenario(s.id)}
                className={`rounded-[12px] border bg-surface p-4 text-left transition-colors ${sel ? "border-success ring-1 ring-success" : "border-line hover:bg-fill"}`}
              >
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <p className="tabular mt-0.5 text-xs text-muted">Starts {new Date(`${s.start}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="mt-2 text-[13px] text-ink-2">{s.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="roles-h">
        <h2 id="roles-h" className="text-base font-medium">
          Choose a demo session
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {ENTRIES.map((e) => (
            <div key={e.userId} className="flex flex-col rounded-[12px] border border-line p-5">
              <e.icon className="size-5 text-primary" aria-hidden strokeWidth={1.75} />
              <p className="mt-3 text-base font-medium">{e.title}</p>
              <p className="mt-1 flex-1 text-[13px] text-muted">{e.detail}</p>
              <Button className="mt-4 self-start" variant={e.primary ? "primary" : "secondary"} onClick={() => enter(e.userId)} pending={pending === e.userId} pendingLabel="Opening…">
                {e.who} <ArrowRight className="size-4" aria-hidden />
              </Button>
              {currentUser === e.userId ? <p className="mt-2 text-xs text-muted">Your current session</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[12px] border border-line">
          <p className="border-b border-divider px-5 py-3 text-sm font-medium">Restricted roles</p>
          <ul className="divide-y divide-divider">
            {MORE.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <m.icon className="size-4 text-muted" aria-hidden strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{m.who}</p>
                  <p className="text-xs text-muted">{m.detail}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => enter(m.userId)} pending={pending === m.userId}>
                  Continue
                </Button>
              </li>
            ))}
          </ul>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {error}
          </p>
        ) : null}
      </section>
    </>
  );
}
