import Link from "next/link";
import { ArrowRight, CheckCircle2, Inbox } from "lucide-react";
import { requireSession } from "@/server/guard";
import { hrOverviewView, type QueueTab } from "@/server/views";
import {
  DateText,
  EmptyState,
  PageHeader,
  Section,
  StatusPill,
  Table,
  Tag,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import { TASK_KIND, displayOwner } from "@/components/hr/labels";

const QUEUES: { id: QueueTab; label: string; hint: string }[] = [
  {
    id: "action",
    label: "Needs my action",
    hint: "Decisions, reviews and issues owned by HR",
  },
  {
    id: "employee",
    label: "Waiting for employee",
    hint: "Information requests with a due date",
  },
  {
    id: "carrier",
    label: "Waiting for carrier",
    hint: "Approved, carrier record not yet matched",
  },
  {
    id: "payroll",
    label: "Payroll issues",
    hint: "Authorization needed or posted amount differs",
  },
  {
    id: "continuation",
    label: "Continuation handoffs",
    hint: "COBRA referrals not yet acknowledged",
  },
];

export default async function AdminOverviewPage() {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const v = await hrOverviewView(user, scenarioId);
  const ns = v.northStar;
  const int = v.integration;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Overview"
        crumbs={[{ label: "Benefits admin" }]}
        description={
          <>
            Business time <DateText time={v.now} />. Work is ordered by risk,
            then by the next due time.
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Needs your action"
            actions={
              <Link
                href="/admin/qle?tab=action"
                className="text-sm text-primary hover:underline"
              >
                Open queue
              </Link>
            }
            bodyClassName=""
          >
            {v.needsAction.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title="Nothing needs you right now"
              >
                New requests, reviews and provider issues appear here as soon as
                they need HR.
              </EmptyState>
            ) : (
              <Table label="Cases that need HR">
                <THead>
                  <tr>
                    <Th>Case</Th>
                    <Th>Event</Th>
                    <Th>Risk</Th>
                    <Th>Next action</Th>
                    <Th>Deadline</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.needsAction.map((r) => (
                    <tr key={r.id} className="hover:bg-canvas">
                      <Td>
                        <Link
                          href={`/admin/qle/${r.id}`}
                          className="whitespace-nowrap text-primary hover:underline"
                        >
                          {r.caseNumber}
                        </Link>
                        <p className="text-[13px] text-ink-2">
                          {r.employeeName}
                          {r.background ? (
                            <span className="text-muted"> · background</span>
                          ) : null}
                        </p>
                      </Td>
                      <Td>{r.event}</Td>
                      <Td>
                        <StatusPill
                          tone={
                            r.risk === "high"
                              ? "red"
                              : r.risk === "medium"
                                ? "amber"
                                : "green"
                          }
                        >
                          {r.riskReason}
                        </StatusPill>
                      </Td>
                      <Td className="max-w-[280px] text-ink-2">
                        {r.nextAction}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {r.deadline ? (
                          <DateText date={r.deadline} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>

          <Section
            title="Due soon"
            description="Open tasks across every case, earliest first. Each has an owner and a backup."
            bodyClassName=""
          >
            {v.dueSoon.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title="No open tasks with a due time"
              />
            ) : (
              <Table label="Tasks due soon">
                <THead>
                  <tr>
                    <Th>Task</Th>
                    <Th>Case</Th>
                    <Th>Owner</Th>
                    <Th>Due</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.dueSoon.map((t) => (
                    <tr key={t.id}>
                      <Td>
                        <p className="text-ink">{t.title}</p>
                        <p className="text-[13px] text-muted">
                          {TASK_KIND[t.kind]}
                        </p>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/qle/${t.caseId}`}
                          className="tabular whitespace-nowrap text-primary hover:underline"
                        >
                          {t.caseNumber}
                        </Link>
                      </Td>
                      <Td>{displayOwner(t.ownerName)}</Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                          <DateText
                            time={t.dueAt}
                            className={t.overdue ? "text-danger-text" : ""}
                          />
                          {t.overdue ? (
                            <StatusPill tone="red">Overdue</StatusPill>
                          ) : null}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Queues" bodyClassName="">
            <ul className="divide-y divide-divider">
              {QUEUES.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/admin/qle?tab=${q.id}`}
                    className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink group-hover:text-primary">
                        {q.label}
                      </span>
                      <span className="block text-xs text-muted">{q.hint}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Tag className="tabular">{v.counts[q.id]}</Tag>
                      <ArrowRight
                        className="size-4 text-muted group-hover:text-primary"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Integration health"
            actions={
              <Link
                href="/admin/integrations"
                className="text-sm text-primary hover:underline"
              >
                Integrations
              </Link>
            }
            bodyClassName="px-5 py-3"
          >
            <dl className="divide-y divide-divider text-sm">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Changes queued for the next file</dt>
                <dd className="tabular text-ink">{int.queued}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Files with unknown delivery</dt>
                <dd>
                  {int.unknown ? (
                    <StatusPill tone="amber">
                      {int.unknown} need an inquiry
                    </StatusPill>
                  ) : (
                    <span className="tabular text-ink">0</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Awaiting a carrier result</dt>
                <dd className="tabular text-ink">{int.awaiting}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">Next nightly batch</dt>
                <dd className="text-right whitespace-nowrap text-ink">
                  <DateText time={int.nextBatchAt} />
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Completion (demo cohort)" bodyClassName="px-5 py-4">
            <p className="text-sm text-ink">
              <span className="tabular text-[18px] font-medium">
                {ns.completed}
              </span>{" "}
              <span className="text-ink-2">of</span>{" "}
              <span className="tabular text-[18px] font-medium">{ns.due}</span>{" "}
              <span className="text-ink-2">
                eligible live-scenario cases completed
              </span>
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Declined {ns.declined} · Withdrawn {ns.withdrawn} (reported
              separately, not counted as completed)
            </p>
            <p className="mt-3 border-t border-divider pt-3 text-xs text-muted">
              {ns.note}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
