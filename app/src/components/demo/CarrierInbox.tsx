"use client";

import { Fragment, type ReactNode, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Inbox,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  DateText,
  EmptyState,
  Section,
  StatusPill,
  Table,
  Td,
  Th,
  THead,
  Tag,
} from "@/components/ui/primitives";
import { BatchPayload } from "./BatchPayload";
import {
  DELIVERY,
  FILE_VALIDATION,
  MEMBER_RESULT,
  RELATIONSHIP,
  TRANSPORT,
} from "./labels";
import { ObservationSheet, type PlanOption } from "./ObservationSheet";
import { ActionError, ReasonSheet, useSimAction, Why } from "./sim-kit";
import { SimTag, SplitTime } from "./SimFrame";
import type { BatchRow, CarrierData, TxnRow } from "./types";

type ReasonTarget =
  | { kind: "file_reject"; batchId: string }
  | { kind: "member_reject"; txn: TxnRow }
  | { kind: "member_info"; txn: TxnRow };
type ObsTarget = { txn: TxnRow; source: string };

export interface CarrierNames {
  [carrierId: string]: { name: string; groupNumber: string };
}

// Compact cell for the wide decoded-member tables.
function C({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-divider px-3 py-2.5 align-top text-[13px] ${className}`}
    >
      {children}
    </td>
  );
}
function H({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`h-10 border-b border-divider px-3 text-left text-[13px] font-normal whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function batchStatus(b: BatchRow): {
  label: string;
  tone: "green" | "amber" | "blue" | "red" | "gray";
} {
  if (b.transport === "unknown")
    return { label: "Delivery unknown", tone: "red" };
  if (b.transport === "not_received")
    return { label: "Not received, requeued", tone: "red" };
  if (b.transport === "pending")
    return { label: "Awaiting transport receipt", tone: "amber" };
  if (b.fileValidation === "rejected")
    return { label: "File rejected", tone: "red" };
  if (b.fileValidation === "pending")
    return { label: "Awaiting file validation", tone: "amber" };
  const live = b.txns.filter((t) => !t.superseded);
  if (
    live.some(
      (t) =>
        t.memberResult === "pending" || t.memberResult === "info_requested",
    )
  )
    return { label: "Processing members", tone: "blue" };
  if (live.some((t) => t.memberResult === "accepted" && !t.observations.length))
    return { label: "Result not published", tone: "blue" };
  if (live.some((t) => t.memberResult === "rejected"))
    return { label: "Partly rejected", tone: "red" };
  if (live.some((t) => t.observations.at(-1)?.outcome === "mismatch"))
    return { label: "Result mismatch", tone: "red" };
  return { label: "Results published", tone: "green" };
}

function needsWork(b: BatchRow) {
  return batchStatus(b).tone !== "green";
}

export function CarrierInbox({
  data,
  nextBatchAt,
  plans,
  carriers,
  showDraft = false,
}: {
  data: CarrierData;
  nextBatchAt: string;
  plans: PlanOption[];
  carriers: CarrierNames;
  showDraft?: boolean;
}) {
  const action = useSimAction();
  const openRecord = (t: CarrierData["batches"][number]["txns"][number]) => !t.superseded && t.delivery !== "record_rejected" && (t.memberResult === "pending" || (t.memberResult === "accepted" && !t.observations.length));
  const pendingAtCarrier =
    data.batches.filter((b) => (b.transport === "pending" || b.transport === "received") && b.fileValidation !== "rejected" && b.txns.some(openRecord)).length +
    data.apiRequests.filter((t) => !t.superseded && t.delivery === "acknowledged" && t.memberResult === "pending").length;
  // undefined = follow the newest batch that still needs work; null = operator closed all.
  const [picked, setOpen] = useState<string | null | undefined>(undefined);
  const open =
    picked === undefined ? (data.batches.find(needsWork)?.id ?? null) : picked;
  const [reason, setReason] = useState<ReasonTarget | null>(null);
  const [obs, setObs] = useState<ObsTarget | null>(null);

  const reasonCfg = reason
    ? reason.kind === "file_reject"
      ? {
          title: "Reject the whole file",
          intro:
            "A whole-file rejection means no record in this batch was processed. HR gets a task to fix the shared cause and resend every record in a new batch.",
          label: "Rejection reason",
          placeholder:
            "For example: ISA sender ID does not match the trading-partner setup.",
          confirm: "Reject file",
          pending: "Rejecting…",
          tone: "destructive" as const,
        }
      : reason.kind === "member_reject"
        ? {
            title: `Reject ${reason.txn.order.memberName}'s record`,
            intro:
              "Only this member record is rejected. Other records in the batch keep their own results.",
            label: "Rejection reason",
            placeholder: "For example: dependent date of birth not accepted.",
            confirm: "Reject record",
            pending: "Rejecting…",
            tone: "destructive" as const,
          }
        : {
            title: `Request information for ${reason.txn.order.memberName}`,
            intro:
              "HR gets a task to decide what is missing. The record stays open until you accept or reject it.",
            label: "What the carrier needs",
            placeholder:
              "For example: confirm the dependent's legal last name.",
            confirm: "Send request",
            pending: "Sending…",
            tone: "primary" as const,
          }
    : null;

  async function submitReason(text: string, key: string) {
    if (!reason) return { ok: false, message: "Nothing selected." };
    if (reason.kind === "file_reject")
      return action.run(
        `file:${reason.batchId}`,
        {
          type: "ops.batchValidation",
          batchId: reason.batchId,
          outcome: "rejected",
          reason: text,
        },
        key,
      );
    return action.run(
      `rec:${reason.txn.id}`,
      {
        type: "ops.memberResult",
        txnId: reason.txn.id,
        outcome:
          reason.kind === "member_reject" ? "rejected" : "info_requested",
        reason: text,
      },
      key,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ActionError
        action={action}
        scope={(id) =>
          !data.batches.some(
            (b) => id.includes(b.id) || b.txns.some((t) => id.includes(t.id)),
          )
        }
      />

      {/* Carrier: one click for everything that has arrived */}
      {pendingAtCarrier ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-primary/30 bg-tint-4 px-5 py-4">
          <div>
            <p className="text-sm text-ink">Waiting for the carrier: {pendingAtCarrier} item{pendingAtCarrier === 1 ? "" : "s"}</p>
            <p className="text-[13px] text-muted">834 files HR has sent and dental or vision API requests. Accepting confirms coverage; reconciliation then checks each record against the approved change.</p>
          </div>
          <Button onClick={() => void action.run("ca:all", { type: "ops.carrierAccept" })} pending={action.isBusy("ca:all")} pendingLabel="Processing…">
            Accept everything pending
          </Button>
        </div>
      ) : null}

      {/* Queue */}
      <Section
        title={
          <span className="flex items-center gap-2">
            Waiting for the next batch <SimTag />
          </span>
        }
        description={
          <>
            Nightly 834 route: cutoff 9:45 p.m., send 10:00 p.m. ET (fictional
            settings). Next scheduled send:{" "}
            <span className="tabular">{fmtDateTime(nextBatchAt)}</span>.
          </>
        }
        actions={
          <Button
            onClick={() =>
              void action.run("runBatch", { type: "ops.runBatch" })
            }
            pending={action.isBusy("runBatch")}
            pendingLabel="Sending batch…"
            disabled={!data.queued.length}
            aria-describedby={data.queued.length ? undefined : "run-why"}
          >
            <Send className="size-4" aria-hidden />
            Run next batch now
          </Button>
        }
        bodyClassName=""
      >
        <div
          className={`px-5 py-3 ${data.queued.length ? "border-b border-divider" : ""}`}
        >
          {data.queued.length ? (
            <Why>
              Runs the same server worker as the 10:00 p.m. nightly job. It
              sends every queued record in one illustrative 834 file.
            </Why>
          ) : (
            <Why id="run-why">
              Nothing is queued, so there is no batch to send. Approved medical
              changes wait here until the next batch.
            </Why>
          )}
        </div>
        {data.queued.length ? (
          <Table label="Queued changes">
            <THead>
              <tr>
                <Th>Case</Th>
                <Th>Member</Th>
                <Th>Action</Th>
                <Th>Plan and level</Th>
                <Th>Date</Th>
                <Th>Operation key</Th>
              </tr>
            </THead>
            <tbody>
              {data.queued.map((t) => (
                <tr key={t.id}>
                  <Td>{t.caseNumber}</Td>
                  <Td>
                    {t.summary.member}
                    <p className="text-xs text-muted">
                      {RELATIONSHIP[t.summary.relationship] ??
                        t.summary.relationship}
                    </p>
                  </Td>
                  <Td>
                    {t.summary.action}
                    {t.correctionOf ? (
                      <p className="text-xs text-muted">
                        Correction of {t.correctionOf}
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    {t.summary.plan} · {t.summary.level}
                  </Td>
                  <Td className="tabular">{t.summary.date}</Td>
                  <Td className="font-mono text-xs text-ink-2">
                    {t.summary.operationKey}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
        {showDraft && data.queued.length ? (
          <div className="border-t border-divider p-4">
            <BatchPayload batchId="pending" title={`Next batch file · ${data.queued.length} record${data.queued.length === 1 ? "" : "s"} · still at Nexa, not sent`} label="Illustrative 834 — not carrier-certified. The carrier receives this file when the batch runs" />
          </div>
        ) : null}
      </Section>

      {/* Batches */}
      <Section
        title={
          <span className="flex items-center gap-2">
            Received batches <SimTag>Simulated SFTP</SimTag>
          </span>
        }
        description={`${data.label}. Transport receipt, file validation, member result and coverage observation are separate stages. None of the first three is coverage.`}
        bodyClassName=""
      >
        {data.batches.length ? (
          <Table label="Carrier batches">
            <THead>
              <tr>
                <Th>Batch</Th>
                <Th>Group / carrier</Th>
                <Th>Route</Th>
                <Th align="right">Records</Th>
                <Th>Sent</Th>
                <Th>Transport</Th>
                <Th>File validation</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {data.batches.map((b) => {
                const isOpen = open === b.id;
                const st = batchStatus(b);
                const carrier = carriers[b.carrierId];
                return (
                  <Fragment key={b.id}>
                    <tr className={isOpen ? "bg-canvas" : "hover:bg-canvas"}>
                      <Td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : b.id)}
                          aria-expanded={isOpen}
                          aria-controls={`batch-${b.id}`}
                          className="flex items-start gap-2 text-left"
                        >
                          <span className="mt-0.5 grid size-6 place-items-center rounded-[6px] border border-line bg-surface">
                            {isOpen ? (
                              <ChevronDown className="size-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="size-3.5" aria-hidden />
                            )}
                          </span>
                          <span>
                            <span className="text-primary hover:underline">
                              {b.id}
                            </span>
                            <span className="block text-xs text-muted tabular">
                              Control {b.controlNumber}
                            </span>
                          </span>
                        </button>
                      </Td>
                      <Td>
                        {carrier?.groupNumber ?? b.carrierId}
                        <p className="text-xs text-muted">
                          {carrier?.name ?? "Simulated carrier"}
                        </p>
                      </Td>
                      <Td>
                        <Tag className="whitespace-nowrap">EDI 834</Tag>
                      </Td>
                      <Td align="right">{b.recordCount}</Td>
                      <Td className="whitespace-nowrap">
                        <SplitTime iso={b.sentAt} />
                      </Td>
                      <Td>
                        <StatusPill tone={TRANSPORT[b.transport].tone}>
                          {TRANSPORT[b.transport].label}
                        </StatusPill>
                      </Td>
                      <Td>
                        <StatusPill
                          tone={FILE_VALIDATION[b.fileValidation].tone}
                        >
                          {FILE_VALIDATION[b.fileValidation].label}
                        </StatusPill>
                      </Td>
                      <Td>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </Td>
                    </tr>
                    {isOpen ? (
                      <tr id={`batch-${b.id}`}>
                        <td
                          colSpan={9}
                          className="border-b border-divider bg-canvas px-4 py-4"
                        >
                          {/* w-0 + min-w-full: the wide payload never stretches the batch table. */}
                          <div className="w-0 min-w-full">
                            <BatchDetail
                              b={b}
                              action={action}
                              onReject={() =>
                                setReason({
                                  kind: "file_reject",
                                  batchId: b.id,
                                })
                              }
                              onReason={setReason}
                              onObserve={(txn) =>
                                setObs({
                                  txn,
                                  source: `834 result for ${b.id} (simulated carrier)`,
                                })
                              }
                              label={data.label}
                            />
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
          <EmptyState icon={<Inbox />} title="No batches received">
            Run the next batch after HR approves a medical change. Each batch
            appears here with its payload and member records.
          </EmptyState>
        )}
      </Section>

      {/* API requests */}
      <Section
        title={
          <span className="flex items-center gap-2">
            API requests <SimTag>Clearview API adapter</SimTag>
          </span>
        }
        description="Dental and vision go to a fictional carrier through a simulated API. A 202 reference means the request was received, not that anyone is covered."
        bodyClassName=""
      >
        {data.apiRequests.length ? (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse"
              aria-label="Simulated API requests"
            >
              <thead className="bg-fill text-ink">
                <tr>
                  <H>Reference</H>
                  <H>Member</H>
                  <H>Benefit</H>
                  <H>Request</H>
                  <H>Receipt</H>
                  <H>Member result</H>
                  <H>Observation</H>
                  <H>Actions</H>
                </tr>
              </thead>
              <tbody>
                {data.apiRequests.map((t) => (
                  <tr key={t.id}>
                    <C className="whitespace-nowrap">
                      <span className="font-mono text-xs">
                        {t.apiReference ?? "—"}
                      </span>
                      <p className="text-xs text-muted">{t.caseNumber}</p>
                    </C>
                    <C className="whitespace-nowrap">
                      {t.summary.member}
                      <p className="text-xs text-muted">
                        {RELATIONSHIP[t.summary.relationship] ??
                          t.summary.relationship}
                      </p>
                    </C>
                    <C className="capitalize">{t.order.benefit}</C>
                    <C>
                      {t.summary.action}
                      <p className="text-xs text-muted">
                        {t.summary.plan} · {t.summary.level} ·{" "}
                        <span className="tabular">{t.summary.date}</span>
                      </p>
                    </C>
                    <C>
                      {t.apiReference ? (
                        <StatusPill tone="blue">
                          202 received, not covered
                        </StatusPill>
                      ) : (
                        <StatusPill tone={DELIVERY[t.delivery].tone}>
                          {DELIVERY[t.delivery].label}
                        </StatusPill>
                      )}
                      {t.superseded ? (
                        <p className="mt-1 text-xs text-muted">
                          Superseded by a correction
                        </p>
                      ) : null}
                    </C>
                    <C>
                      <StatusPill tone={MEMBER_RESULT[t.memberResult].tone}>
                        {MEMBER_RESULT[t.memberResult].label}
                      </StatusPill>
                      {t.memberReason ? (
                        <p className="mt-1 max-w-[220px] text-xs text-muted">
                          {t.memberReason}
                        </p>
                      ) : null}
                    </C>
                    <C>
                      <Observations txn={t} />
                    </C>
                    <C>
                      <RecordActions
                        txn={t}
                        action={action}
                        onReason={setReason}
                        onObserve={() =>
                          setObs({
                            txn: t,
                            source: `API status ${t.apiReference ?? t.id} (simulated carrier)`,
                          })
                        }
                        extra={
                          (t.memberResult === "pending" ||
                            (t.memberResult === "accepted" &&
                              !t.observations.length)) &&
                          !t.superseded &&
                          t.delivery !== "record_rejected" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void action.run(`pubapi:${t.id}`, {
                                  type: "ops.publishAccepted",
                                  batchId: t.id,
                                })
                              }
                              pending={action.isBusy(`pubapi:${t.id}`)}
                              pendingLabel="Publishing…"
                            >
                              Publish (values from request)
                            </Button>
                          ) : null
                        }
                      />
                    </C>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Send />} title="No API requests">
            Approved dental or vision changes are sent here immediately and get
            a 202 reference. Coverage still waits for a published result.
          </EmptyState>
        )}
      </Section>

      {/* Roster */}
      <Section
        title={
          <span className="flex items-center gap-2">
            Carrier roster <SimTag>Carrier&apos;s own record</SimTag>
          </span>
        }
        description="The carrier's independent record. It changes only when the carrier publishes a result, never from what Nexa approved."
        bodyClassName=""
      >
        {data.roster.length ? (
          <Table label="Carrier roster">
            <THead>
              <tr>
                <Th>Member</Th>
                <Th>Benefit</Th>
                <Th>Plan</Th>
                <Th>Level</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Source</Th>
                <Th>Observed at</Th>
              </tr>
            </THead>
            <tbody>
              {data.roster.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{r.member}</Td>
                  <Td className="capitalize">{r.benefit}</Td>
                  <Td>{r.planName}</Td>
                  <Td>{r.tierLabel}</Td>
                  <Td className="whitespace-nowrap">
                    <DateText date={r.startDate} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.endDate ? (
                      <DateText date={r.endDate} />
                    ) : (
                      <span className="text-muted">Open</span>
                    )}
                  </Td>
                  <Td className="max-w-[260px] text-ink-2">{r.sourceRef}</Td>
                  <Td className="whitespace-nowrap">
                    <DateText time={r.observedAt} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Users />} title="No carrier records">
            The roster fills from seeded coverage and from results the carrier
            publishes.
          </EmptyState>
        )}
      </Section>

      {reasonCfg ? (
        <ReasonSheet
          open
          onClose={() => setReason(null)}
          title={reasonCfg.title}
          intro={reasonCfg.intro}
          label={reasonCfg.label}
          placeholder={reasonCfg.placeholder}
          confirmLabel={reasonCfg.confirm}
          pendingLabel={reasonCfg.pending}
          tone={reasonCfg.tone}
          submit={submitReason}
        />
      ) : null}
      {obs ? (
        <ObservationSheet
          txn={obs.txn}
          source={obs.source}
          plans={plans}
          onClose={() => setObs(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------- Batch detail ----------------

type StageState = "done" | "current" | "blocked" | "upcoming";
function StageIcon({ state }: { state: StageState }) {
  if (state === "done")
    return <CheckCircle2 className="size-4 text-success" aria-hidden />;
  if (state === "blocked")
    return <XCircle className="size-4 text-danger" aria-hidden />;
  if (state === "current")
    return <CircleDot className="size-4 text-warning" aria-hidden />;
  return <Circle className="size-4 text-muted" aria-hidden />;
}

function Stage({
  n,
  title,
  state,
  status,
  children,
}: {
  n: number;
  title: string;
  state: StageState;
  status: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 border-b border-divider py-3 last:border-b-0">
      <span className="mt-0.5">
        <StageIcon state={state} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink">
            <span className="text-muted tabular">{n}.</span> {title}
          </p>
          <div>{status}</div>
        </div>
        {children ? (
          <div className="mt-2 flex flex-col gap-2">{children}</div>
        ) : null}
      </div>
    </li>
  );
}

function BatchDetail({
  b,
  action,
  onReject,
  onReason,
  onObserve,
  label,
}: {
  b: BatchRow;
  action: ReturnType<typeof useSimAction>;
  onReject: () => void;
  onReason: (r: ReasonTarget) => void;
  onObserve: (t: TxnRow) => void;
  label: string;
}) {
  const live = b.txns.filter((t) => !t.superseded);
  const accepted = live.filter((t) => t.memberResult === "accepted").length;
  const rejected = live.filter((t) => t.memberResult === "rejected").length;
  const pendingCount = live.filter(
    (t) => t.memberResult === "pending" || t.memberResult === "info_requested",
  ).length;
  const published = live.filter((t) => t.observations.length).length;
  const publishable = live.some(
    (t) =>
      t.delivery !== "record_rejected" &&
      (t.memberResult === "pending" ||
        (t.memberResult === "accepted" && !t.observations.length)),
  );
  const transportState: StageState =
    b.transport === "received"
      ? "done"
      : b.transport === "pending"
        ? "current"
        : "blocked";
  const fileState: StageState =
    b.fileValidation === "accepted"
      ? "done"
      : b.fileValidation === "rejected"
        ? "blocked"
        : b.transport === "received"
          ? "current"
          : "upcoming";
  const fileOk = b.fileValidation === "accepted";
  const memberState: StageState = !fileOk
    ? "upcoming"
    : pendingCount
      ? "current"
      : rejected
        ? "blocked"
        : "done";
  const obsState: StageState = !fileOk
    ? "upcoming"
    : published === live.length && live.length
      ? "done"
      : accepted || pendingCount
        ? "current"
        : "upcoming";
  const fileWhy =
    b.transport === "pending"
      ? "Acknowledge transport first. A file cannot be validated before it is received."
      : b.transport === "unknown"
        ? "Delivery is unknown. HR must record a status inquiry before this file can move on."
        : b.transport === "not_received"
          ? "The carrier did not receive this file."
          : null;

  const canAccept = (b.transport === "pending" || b.transport === "received") && b.fileValidation !== "rejected" && publishable;
  return (
    <div className="flex flex-col gap-4">
      {canAccept ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-primary/30 bg-tint-4 px-4 py-3">
          <p className="text-[13px] text-ink">
            The carrier has this file. One click records the transport receipt, accepts the file and publishes the member results. Armed presets still apply.
          </p>
          <Button size="sm" onClick={() => void action.run(`ca:${b.id}`, { type: "ops.carrierAccept", batchId: b.id })} pending={action.isBusy(`ca:${b.id}`)} pendingLabel="Processing…">
            Receive and accept file
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[10px] border border-line bg-surface px-4">
          <ol aria-label={`Stages for ${b.id}`}>
            <Stage
              n={1}
              title="Transmitted"
              state="done"
              status={
                <DateText time={b.sentAt} className="text-[13px] text-muted" />
              }
            >
              <p className="text-xs text-muted">
                {b.attempts.map((a) => a.outcome).join(" · ")} · hash{" "}
                <span className="font-mono">{b.payloadHash.slice(0, 12)}…</span>
              </p>
            </Stage>
            <Stage
              n={2}
              title="Transport receipt"
              state={transportState}
              status={
                <StatusPill tone={TRANSPORT[b.transport].tone}>
                  {TRANSPORT[b.transport].label}
                </StatusPill>
              }
            >
              {b.transport === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void action.run(`tr:${b.id}`, {
                        type: "ops.batchTransport",
                        batchId: b.id,
                        outcome: "received",
                      })
                    }
                    pending={action.isBusy(`tr:${b.id}`)}
                    pendingLabel="Recording…"
                  >
                    Acknowledge transport
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void action.run(`tu:${b.id}`, {
                        type: "ops.batchTransport",
                        batchId: b.id,
                        outcome: "unknown",
                      })
                    }
                    pending={action.isBusy(`tu:${b.id}`)}
                    pendingLabel="Recording…"
                  >
                    Transport timed out
                  </Button>
                </div>
              ) : b.transport === "unknown" ? (
                <Why>
                  HR must record a status inquiry for an unknown delivery
                  (Benefits admin → Integrations). A blind resend could
                  duplicate changes, so nothing can be acknowledged here.
                </Why>
              ) : b.transport === "not_received" ? (
                <Why>
                  The status inquiry found the carrier did not receive this
                  file. The same records were requeued with the same operation
                  keys.
                </Why>
              ) : (
                <p className="text-xs text-muted">
                  A transport receipt is not a coverage result.
                </p>
              )}
            </Stage>
            <Stage
              n={3}
              title="File validation"
              state={fileState}
              status={
                <StatusPill tone={FILE_VALIDATION[b.fileValidation].tone}>
                  {FILE_VALIDATION[b.fileValidation].label}
                </StatusPill>
              }
            >
              {b.fileValidation === "pending" && b.transport === "received" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void action.run(`fv:${b.id}`, {
                        type: "ops.batchValidation",
                        batchId: b.id,
                        outcome: "accepted",
                      })
                    }
                    pending={action.isBusy(`fv:${b.id}`)}
                    pendingLabel="Accepting…"
                  >
                    Accept file validation
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onReject}
                    disabled={action.isBusy(`file:${b.id}`)}
                  >
                    Reject file…
                  </Button>
                </div>
              ) : b.fileValidation === "rejected" ? (
                <Why>
                  Rejected: {b.fileReason ?? "no reason given"}. Every record in
                  this file needs a resend in a new batch.
                </Why>
              ) : b.fileValidation === "accepted" ? (
                <p className="text-xs text-muted">
                  A 999-style acceptance is not active coverage. Each member
                  record still needs its own result.
                </p>
              ) : fileWhy ? (
                <Why>{fileWhy}</Why>
              ) : null}
            </Stage>
            <Stage
              n={4}
              title="Member results"
              state={memberState}
              status={
                <span className="text-[13px] text-muted tabular">
                  {accepted} accepted · {rejected} rejected · {pendingCount}{" "}
                  open
                </span>
              }
            >
              {!fileOk ? (
                <Why>
                  Record actions unlock after file validation is accepted.
                </Why>
              ) : (
                <p className="text-xs text-muted">
                  Accept, reject or request information per record in the table
                  below. Accepting a record does not post payroll.
                </p>
              )}
            </Stage>
            <Stage
              n={5}
              title="Coverage observations"
              state={obsState}
              status={
                <span className="text-[13px] text-muted tabular">
                  {published} of {live.length} published
                </span>
              }
            >
              {fileOk && publishable ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void action.run(`pub:${b.id}`, {
                          type: "ops.publishAccepted",
                          batchId: b.id,
                        })
                      }
                      pending={action.isBusy(`pub:${b.id}`)}
                      pendingLabel="Publishing…"
                    >
                      Publish observations for accepted records (values from
                      file)
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    Records still pending are accepted first. An armed failure
                    preset applies to this response.
                  </p>
                </div>
              ) : !fileOk ? (
                <Why>
                  Accept file validation first. An unsent or unvalidated change
                  cannot be confirmed.
                </Why>
              ) : (
                <p className="text-xs text-muted">
                  Every accepted record has a published result. Use a
                  record&apos;s own action to publish a different or late
                  result.
                </p>
              )}
            </Stage>
          </ol>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <BatchPayload batchId={b.id} label={label} />
        </div>
      </div>

      <ActionError
        action={action}
        scope={(id) =>
          id.includes(b.id) || b.txns.some((t) => id.includes(t.id))
        }
      />

      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table
          className="w-full border-collapse"
          aria-label={`Decoded members in ${b.id}`}
        >
          <thead className="bg-fill text-ink">
            <tr>
              <H>Member and relationship</H>
              <H>Action and date</H>
              <H>Plan and level</H>
              <H>Operation key</H>
              <H>Member result</H>
              <H>Observations</H>
              <H>Actions</H>
            </tr>
          </thead>
          <tbody>
            {b.txns.map((t) => (
              <tr key={t.id} className={t.superseded ? "text-muted" : ""}>
                <C className="whitespace-nowrap">
                  {t.summary.member}
                  <p className="text-xs text-muted">
                    {RELATIONSHIP[t.summary.relationship] ??
                      t.summary.relationship}{" "}
                    · {t.caseNumber}
                  </p>
                </C>
                <C>
                  {t.summary.action}
                  <p className="text-xs whitespace-nowrap text-muted tabular">
                    {t.summary.date}
                  </p>
                </C>
                <C>
                  {t.summary.plan}
                  <p className="text-xs text-muted">{t.summary.level}</p>
                </C>
                <C className="max-w-[150px] font-mono text-[11px] break-all text-ink-2">
                  {t.summary.operationKey}
                </C>
                <C>
                  <StatusPill tone={MEMBER_RESULT[t.memberResult].tone}>
                    {MEMBER_RESULT[t.memberResult].label}
                  </StatusPill>
                  {t.memberReason ? (
                    <p className="mt-1 max-w-[200px] text-xs text-muted">
                      {t.memberReason}
                    </p>
                  ) : null}
                  {t.superseded ? (
                    <p className="mt-1 text-xs text-muted">
                      Superseded by a correction
                    </p>
                  ) : null}
                </C>
                <C>
                  <Observations txn={t} />
                </C>
                <C className="min-w-[170px]">
                  <RecordActions
                    txn={t}
                    action={action}
                    gate={fileOk ? null : "Accept the file first."}
                    onReason={onReason}
                    onObserve={() => onObserve(t)}
                  />
                </C>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Observations({ txn }: { txn: TxnRow }) {
  if (!txn.observations.length)
    return <span className="text-xs text-muted">None published</span>;
  return (
    <ul className="flex flex-col gap-1.5">
      {txn.observations.map((o) => (
        <li key={o.id} className="text-xs">
          <StatusPill
            tone={
              o.outcome === "matched"
                ? "green"
                : o.outcome === "mismatch"
                  ? "red"
                  : "gray"
            }
          >
            {o.outcome === "matched"
              ? "Matched"
              : o.outcome === "mismatch"
                ? "Mismatch"
                : "Stale, ignored"}
          </StatusPill>
          <p className="mt-0.5 text-muted tabular">
            {o.startDate ? `Starts ${fmtDate(o.startDate)}` : ""}
            {o.startDate && o.endDate ? " · " : ""}
            {o.endDate ? `Ends ${fmtDate(o.endDate)}` : ""} · {o.tier}
          </p>
        </li>
      ))}
    </ul>
  );
}

function RecordActions({
  txn,
  action,
  gate = null,
  onReason,
  onObserve,
  extra,
}: {
  txn: TxnRow;
  action: ReturnType<typeof useSimAction>;
  gate?: string | null;
  onReason: (r: ReasonTarget) => void;
  onObserve: () => void;
  extra?: ReactNode;
}) {
  if (gate) return <Why>{gate}</Why>;
  if (txn.delivery === "file_rejected")
    return <Why>The whole file was rejected. HR resends this record.</Why>;
  const open =
    txn.memberResult === "pending" || txn.memberResult === "info_requested";
  if (open && txn.superseded)
    return <Why>Superseded by a correction. Work the newer record.</Why>;
  if (open) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void action.run(`acc:${txn.id}`, {
              type: "ops.memberResult",
              txnId: txn.id,
              outcome: "accepted",
            })
          }
          pending={action.isBusy(`acc:${txn.id}`)}
          pendingLabel="Accepting…"
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onReason({ kind: "member_reject", txn })}
        >
          Reject…
        </Button>
        {txn.memberResult === "pending" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReason({ kind: "member_info", txn })}
          >
            Request info…
          </Button>
        ) : null}
        {extra}
      </div>
    );
  }
  if (txn.memberResult === "accepted") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {extra}
        <Button size="sm" variant="outline" onClick={onObserve}>
          {txn.superseded
            ? "Publish late callback…"
            : txn.observations.length
              ? "Publish another result…"
              : "Publish coverage observation…"}
        </Button>
      </div>
    );
  }
  return <Why>Rejected. HR corrects this line or assigns the broker.</Why>;
}

