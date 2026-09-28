"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateText, EmptyState, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { COBRA } from "./labels";
import type { PlanOption } from "./ObservationSheet";
import { ActionError, ReasonSheet, useSimAction, Why } from "./sim-kit";
import { SimTag } from "./SimFrame";
import type { CobraRow } from "./types";

const ROUTE: Record<string, string> = {
  verified_address_on_file: "Verified address on file",
  contact_verification_needed: "Contact verification needed",
};

type SheetTarget = { kind: "info" | "notice"; r: CobraRow };

export function CobraSim({ rows, plans, isAdmin }: { rows: CobraRow[]; plans: PlanOption[]; isAdmin: boolean }) {
  const action = useSimAction();
  const [open, setOpen] = useState<string | null>(rows[0]?.id ?? null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const planName = (id: string) => plans.find((p) => p.id === id)?.shortName ?? id;

  return (
    <div className="flex flex-col gap-5">
      <ActionError action={action} />
      <Section
        title={
          <span className="flex items-center gap-2">
            Referral inbox <SimTag>COBRA administrator</SimTag>
          </span>
        }
        description="Minimal continuation referrals sent by Nexa HR. Receipt is not a notice, an election or a payment; those stay with the administrator."
        bodyClassName=""
      >
        {rows.length ? (
          <Table label="COBRA referrals">
            <THead>
              <tr>
                <Th>
                  <span className="sr-only">Expand</span>
                </Th>
                <Th>Case</Th>
                <Th>Beneficiary</Th>
                <Th>Qualifying event</Th>
                <Th>Coverage loss date</Th>
                <Th>Plans</Th>
                <Th>Contact route</Th>
                <Th>State</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={isOpen ? "bg-canvas" : "hover:bg-canvas"}>
                      <Td className="w-10 pr-0">
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : r.id)}
                          aria-expanded={isOpen}
                          aria-controls={`ref-${r.id}`}
                          aria-label={`${isOpen ? "Close" : "Open"} referral for ${r.beneficiaryName}`}
                          className="grid size-8 place-items-center rounded-[8px] border border-line bg-surface hover:bg-fill"
                        >
                          {isOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap">{r.caseNumber}</Td>
                      <Td>{r.beneficiaryName}</Td>
                      <Td>
                        {r.qualifyingEvent}
                        <p className="text-xs text-muted">
                          Event <DateText date={r.eventDate} />
                        </p>
                      </Td>
                      <Td>
                        <DateText date={r.coverageLossDate} />
                      </Td>
                      <Td>{r.plans.map((p) => planName(p.planId)).join(", ")}</Td>
                      <Td>{r.contactRoute ? ROUTE[r.contactRoute] : <span className="text-muted">Not chosen yet</span>}</Td>
                      <Td>
                        <StatusPill tone={COBRA[r.state].tone}>{COBRA[r.state].label}</StatusPill>
                      </Td>
                    </tr>
                    {isOpen ? (
                      <tr id={`ref-${r.id}`}>
                        <td colSpan={8} className="border-b border-divider bg-canvas px-4 py-4">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-4">
                              <p className="text-sm font-medium text-ink">Administrator actions</p>
                              <ReferralActions r={r} action={action} onSheet={setSheet} />
                              {r.noticeRef ? (
                                <p className="text-[13px] text-ink-2">
                                  Notice reference <span className="font-mono text-xs">{r.noticeRef}</span>. {r.noticeStatus}
                                </p>
                              ) : null}
                              {r.infoRequested ? <p className="text-[13px] text-ink-2">Last information request: {r.infoRequested}</p> : null}
                              <div className="border-t border-divider pt-3">
                                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                                  <Lock className="size-3.5 text-muted" aria-hidden />
                                  Beneficiary contact <SimTag>Synthetic</SimTag>
                                </p>
                                {isAdmin && r.private ? (
                                  <dl className="mt-2 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
                                    <div>
                                      <dt className="text-muted">Mailing address</dt>
                                      <dd className="text-ink">{r.private.mailingAddress}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-muted">Email</dt>
                                      <dd className="text-ink">{r.private.email}</dd>
                                    </div>
                                  </dl>
                                ) : (
                                  <p className="mt-1 text-[13px] text-muted">Visible to the COBRA administrator only. Sign in as the administrator to see it.</p>
                                )}
                              </div>
                            </div>
                            <div className="rounded-[10px] border border-line bg-surface p-4">
                              <p className="text-sm font-medium text-ink">History</p>
                              {r.history.length ? (
                                <ol className="mt-2 flex flex-col">
                                  {r.history
                                    .slice()
                                    .reverse()
                                    .map((h, i) => (
                                      <li key={i} className="flex flex-col gap-0.5 border-b border-divider py-2 last:border-b-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <StatusPill tone={COBRA[h.state].tone}>{COBRA[h.state].label}</StatusPill>
                                          <DateText time={h.at} className="text-xs text-muted" />
                                        </div>
                                        <p className="text-[13px] text-ink-2">{h.note}</p>
                                      </li>
                                    ))}
                                </ol>
                              ) : (
                                <p className="mt-2 text-[13px] text-muted">No history yet.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Inbox />} title="No referrals">
            A referral arrives here after HR sends it from a divorce case. Loss of outside coverage never creates a Nexa COBRA referral.
          </EmptyState>
        )}
      </Section>

      <ReasonSheet
        open={sheet?.kind === "info"}
        onClose={() => setSheet(null)}
        title="Request missing information"
        intro="HR gets a task to supply the missing referral field and resend. The referral returns to HR until then."
        label="What is missing"
        placeholder="For example: confirm the beneficiary's mailing address."
        confirmLabel="Send request"
        pendingLabel="Sending…"
        submit={(text, key) => action.run(`info:${sheet!.r.id}`, { type: "ops.cobra", referralId: sheet!.r.id, action: "request_info", note: text }, key)}
      />
      <ReasonSheet
        open={sheet?.kind === "notice"}
        onClose={() => setSheet(null)}
        title="Record notice status"
        intro="Records that the administrator issued its election notice (simulated). Election and payment stay with the administrator."
        label="Notice reference"
        hint="Leave empty to use a generated reference."
        placeholder="For example: NTC-2026-0142"
        optional
        maxLength={120}
        confirmLabel="Record notice"
        pendingLabel="Recording…"
        submit={(text, key) => action.run(`notice:${sheet!.r.id}`, { type: "ops.cobra", referralId: sheet!.r.id, action: "notice", note: text || undefined }, key)}
      />
    </div>
  );
}

function ReferralActions({ r, action, onSheet }: { r: CobraRow; action: ReturnType<typeof useSimAction>; onSheet: (t: SheetTarget) => void }) {
  if (r.state === "review_needed" || r.state === "referral_ready" || r.state === "not_applicable") {
    return <Why>HR has not sent this referral yet. Actions unlock when it arrives.</Why>;
  }
  const received = r.state === "received" || r.state === "notice_tracked";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {received ? null : (
          <Button size="sm" onClick={() => void action.run(`ack:${r.id}`, { type: "ops.cobra", referralId: r.id, action: "acknowledge" })} pending={action.isBusy(`ack:${r.id}`)} pendingLabel="Acknowledging…">
            Acknowledge receipt
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onSheet({ kind: "info", r })}>
          Request missing information…
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSheet({ kind: "notice", r })} disabled={!received} aria-describedby={received ? undefined : `notice-why-${r.id}`}>
          Record notice status…
        </Button>
      </div>
      {received ? (
        <p className="text-xs text-muted">Receipt acknowledged <DateText time={r.receivedAt ?? null} />.</p>
      ) : (
        <Why id={`notice-why-${r.id}`}>Acknowledge receipt before recording a notice.</Why>
      )}
    </div>
  );
}
