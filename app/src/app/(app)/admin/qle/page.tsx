import { displayOwner } from "@/components/hr/labels";
import Link from "next/link";
import { Inbox } from "lucide-react";
import {
  DateText,
  EmptyState,
  PageHeader,
  Section,
  StatusPill,
  Table,
  TableFooter,
  Td,
  Th,
  THead,
  Tag,
} from "@/components/ui/primitives";
import { requireSession } from "@/server/guard";
import { hrQueueView, type QueueTab } from "@/server/views";

const TABS: { id: QueueTab | "all"; label: string }[] = [
  { id: "action", label: "Needs my action" },
  { id: "employee", label: "Waiting for employee" },
  { id: "carrier", label: "Waiting for carrier" },
  { id: "payroll", label: "Payroll issues" },
  { id: "continuation", label: "Continuation handoffs" },
  { id: "all", label: "All cases" },
];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const { tab: raw } = await searchParams;
  const tab = (TABS.find((t) => t.id === raw)?.id ?? "action") as
    | QueueTab
    | "all";
  const v = await hrQueueView(user, scenarioId);
  const rows =
    tab === "all" ? v.rows : v.rows.filter((r) => r.tabs.includes(tab));
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Life events"
        crumbs={[
          { label: "Benefits admin", href: "/admin" },
          { label: "Life events" },
        ]}
        description="Sorted by risk, then the next due time. Documents open inside each case, not in this list."
      />
      <nav
        aria-label="Queues"
        className="mb-4 flex flex-wrap gap-x-6 border-b border-divider"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = t.id === "all" ? v.rows.length : v.counts[t.id];
          return (
            <Link
              key={t.id}
              href={`/admin/qle?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-sm ${active ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label}
              <Tag>{count}</Tag>
            </Link>
          );
        })}
      </nav>
      <Section title={TABS.find((t) => t.id === tab)!.label} bodyClassName="">
        {rows.length === 0 ? (
          <EmptyState icon={<Inbox />} title="Nothing here right now">
            New requests and issues appear in this queue as soon as they need
            someone.
          </EmptyState>
        ) : (
          <Table label="Cases">
            <THead>
              <tr>
                <Th>Case</Th>
                <Th>Employee</Th>
                <Th>Event</Th>
                <Th>Risk</Th>
                <Th align="right">Age</Th>
                <Th>Owner</Th>
                <Th>Next action</Th>
                <Th>Deadline</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <Td>
                    <Link
                      href={`/admin/qle/${r.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.caseNumber}
                    </Link>
                    {r.background ? (
                      <p className="text-[11px] text-muted">Background case</p>
                    ) : null}
                  </Td>
                  <Td>{r.employeeName}</Td>
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
                  <Td align="right">{r.ageDays}d</Td>
                  <Td>{displayOwner(r.owner)}</Td>
                  <Td className="max-w-[260px] text-ink-2">{r.nextAction}</Td>
                  <Td>
                    {r.deadline ? (
                      <DateText date={r.deadline} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusPill tone={r.status.tone}>
                      {r.status.label}
                    </StatusPill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <TableFooter>
          <span>
            {rows.length} case{rows.length === 1 ? "" : "s"} in this view
          </span>
          <span>
            Background cases are seeded context, separate from the live
            scenario.
          </span>
        </TableFooter>
      </Section>
    </div>
  );
}
