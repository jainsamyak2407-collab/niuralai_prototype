"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Baby, Briefcase, ChevronRight, HeartHandshake, Landmark, LifeBuoy, Loader2, Receipt, ShieldPlus, Users } from "lucide-react";
import type { EventCode } from "@/lib/contracts/domain";
import { Button } from "@/components/ui/button";
import { CommandError, type CommandResponse, useCommand } from "@/components/ui/client";
import { Tag } from "@/components/ui/primitives";
import { AskEmmaButton } from "@/components/emma/EmmaDock";
import { cmd } from "./useCaseCommand";

// Mirrors EventTile/EventChoice from server config (passed in as data).
export interface TileChoice {
  code: EventCode;
  label: string;
  hint?: string;
  handling: "deep" | "assisted";
  group?: string;
}
export interface Tile {
  id: string;
  title: string;
  description: string;
  choices: TileChoice[];
}

const ICON: Record<string, typeof Users> = { family: Users, other_coverage: ShieldPlus, work: Briefcase, dependent: HeartHandshake, plan_cost: Receipt, government: Landmark };

export function EventPicker({ tiles }: { tiles: Tile[] }) {
  const router = useRouter();
  const { send } = useCommand();
  // One intent key per event choice: a retry of the same choice never creates a second draft.
  const keys = useRef<Partial<Record<EventCode, string>>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<EventCode | null>(null);
  const [error, setError] = useState<CommandResponse | null>(null);
  const [lastCode, setLastCode] = useState<EventCode | null>(null);

  async function start(code: EventCode) {
    if (busy) return;
    const key = (keys.current[code] ??= typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    setLastCode(code);
    setBusy(code);
    setError(null);
    const res = await send(cmd({ type: "case.createDraft", eventCode: code }), { intentKey: key, successToast: false });
    if (res.ok && res.entityId) {
      delete keys.current[code];
      router.push(`/employee/life-events/${res.entityId}/details`);
      return;
    }
    setBusy(null);
    setError(res.ok ? { ok: false, message: "We could not start this request. Try again." } : res);
  }

  const tile = tiles.find((t) => t.id === open) ?? null;
  // Group "Welcome a child" choices together; ungrouped choices stand alone.
  const groups: { label: string | null; choices: TileChoice[] }[] = [];
  for (const c of tile?.choices ?? []) {
    const g = groups.find((x) => x.label && x.label === c.group);
    if (g) g.choices.push(c);
    else groups.push({ label: c.group ?? null, choices: [c] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-base font-medium text-ink">What changed?</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => {
            const Icon = ICON[t.id] ?? Users;
            const selected = open === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-expanded={selected}
                aria-controls="event-choices"
                onClick={() => setOpen(selected ? null : t.id)}
                className={`flex h-full flex-col items-start rounded-[12px] border bg-surface p-4 text-left transition-colors ${selected ? "border-success ring-1 ring-success" : "border-line hover:border-tint-2"}`}
              >
                <span className="grid size-10 place-items-center rounded-full border border-line text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="mt-3 text-base text-ink">{t.title}</span>
                <span className="mt-1 text-[13px] text-muted">{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tile ? (
        <section id="event-choices" aria-labelledby="event-choices-title" className="rounded-[12px] border border-line bg-surface">
          <div className="border-b border-divider px-5 py-3.5">
            <h2 id="event-choices-title" className="text-base font-medium text-ink">
              {tile.title}: choose what happened
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">Choices marked HR review are handled with you by HR, who confirms the available changes.</p>
          </div>
          <div className="divide-y divide-divider">
            {groups.map((g, gi) => (
              <div key={gi} className="px-5 py-3">
                {g.label ? <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{g.label}</p> : null}
                <ul className={g.label ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : ""}>
                  {g.choices.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => start(c.code)}
                        disabled={!!busy}
                        className={`group flex w-full items-center gap-3 text-left disabled:cursor-wait ${g.label ? "rounded-[8px] border border-line px-3 py-2.5 hover:border-tint-2 hover:bg-tint-4" : "rounded-[8px] px-2 py-2 -mx-2 hover:bg-fill"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
                            {c.label}
                            {c.handling === "assisted" ? <Tag>HR review</Tag> : null}
                          </span>
                          {c.hint ? <span className="block text-[13px] text-muted">{c.hint}</span> : null}
                        </span>
                        {busy === c.code ? <Loader2 className="size-4 animate-spin text-muted" aria-label="Starting" /> : <ChevronRight className="size-4 text-muted group-hover:text-primary" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <CommandError result={error} onRetry={lastCode ? () => start(lastCode) : undefined} /> : null}

      <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">Not sure which applies?</p>
          <p className="text-[13px] text-muted">Emma can explain the choices. HR can also help: describe what changed and HR will pick the right request with you.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AskEmmaButton question="Which life event should I choose?">Ask Emma</AskEmmaButton>
          <Button variant="secondary" onClick={() => start("not_sure")} pending={busy === "not_sure"} pendingLabel="Starting…" disabled={!!busy && busy !== "not_sure"}>
            Ask HR for help
          </Button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Baby className="size-3.5" aria-hidden /> Expecting a baby? Pregnancy alone is not a life event. You can prepare a birth request now and submit it after your child is born.
      </p>
    </div>
  );
}
