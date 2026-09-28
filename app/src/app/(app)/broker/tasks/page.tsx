import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireSession } from "@/server/guard";
import { brokerTasksView } from "@/server/views";
import { businessNow } from "@/components/broker/businessNow";
import {
  Banner,
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
} from "@/components/ui/primitives";

export default async function BrokerTasksPage() {
  const { user, scenarioId } = await requireSession(["broker"]);
  const [tasks, now] = await Promise.all([
    brokerTasksView(user, scenarioId),
    businessNow(scenarioId),
  ]);
  const open = tasks.filter((t) => t.status === "open");
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Assigned tasks"
        crumbs={[{ label: "Broker" }, { label: "Tasks" }]}
        description="Carrier corrections assigned to you. You see the minimum needed for each one, nothing else about the case."
      />
      <Banner
        className="mb-4"
        title="You submit through the carrier portal yourself"
      >
        No portal login is automated. Record the submission reference, then the
        carrier&apos;s verified result with its source.
      </Banner>
      <Section title="Tasks" bodyClassName="">
        {tasks.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title="No tasks assigned to you">
            When HR assigns a carrier correction to you, it appears here with
            its due date.
          </EmptyState>
        ) : (
          <Table label="Assigned tasks">
            <THead>
              <tr>
                <Th>Task</Th>
                <Th>Case</Th>
                <Th>Due</Th>
                <Th>Progress</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {tasks.map((t) => {
                const overdue =
                  t.status === "open" && !!t.dueAt && t.dueAt < now;
                return (
                  <tr key={t.id} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/broker/tasks/${t.id}`}
                        className="text-primary hover:underline"
                      >
                        {t.title}
                      </Link>
                    </Td>
                    <Td className="tabular">{t.caseNumber}</Td>
                    <Td>
                      <DateText
                        time={t.dueAt}
                        className={overdue ? "text-danger-text" : ""}
                      />
                    </Td>
                    <Td>
                      {t.verified ? (
                        <StatusPill tone="green">Result recorded</StatusPill>
                      ) : t.submitted ? (
                        <StatusPill tone="blue">
                          Submitted, not verified
                        </StatusPill>
                      ) : (
                        <StatusPill tone="amber">Not submitted</StatusPill>
                      )}
                    </Td>
                    <Td>
                      {t.status === "open" ? (
                        <StatusPill tone={overdue ? "red" : "blue"}>
                          {overdue ? "Overdue" : "Open"}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="gray">Closed</StatusPill>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <TableFooter>
          <span>
            {open.length} open · {tasks.length - open.length} closed
          </span>
          <span>Due times in Eastern Time (the employer&apos;s zone)</span>
        </TableFooter>
      </Section>
    </div>
  );
}
