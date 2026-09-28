import { ClipboardList } from "lucide-react";
import { Banner, DateText, EmptyState, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { SimTag } from "./SimFrame";
import type { ManualRow } from "./types";

// Read-only view of manual-route work. The broker works these in her own session.
export function ManualTasks({ rows, now }: { rows: ManualRow[]; now: string }) {
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="info" title="Priya Patel works these tasks in her own session">
        She signs in as the broker and opens Assigned tasks. Recording a portal submission means submitted only. Coverage stays unconfirmed until she records a verified carrier result with its source, verifier and time. Nobody logs in to a real insurance portal.
      </Banner>
      <Section
        title={
          <span className="flex items-center gap-2">
            Broker and manual tasks <SimTag>Manual route</SimTag>
          </span>
        }
        description="Lines HR assigned to the broker, for example after a carrier rejection."
        bodyClassName=""
      >
        {rows.length ? (
          <Table label="Manual route tasks">
            <THead>
              <tr>
                <Th>Task</Th>
                <Th>Owner</Th>
                <Th>Due</Th>
                <Th>Submission reference</Th>
                <Th>Result</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map((t) => {
                const overdue = t.status === "open" && !!t.dueAt && t.dueAt < now;
                return (
                  <tr key={t.id}>
                    <Td className="max-w-[360px]">{t.title}</Td>
                    <Td>{t.ownerName}</Td>
                    <Td>
                      {t.dueAt ? <DateText time={t.dueAt} /> : <span className="text-muted">—</span>}
                      {overdue ? <p className="text-xs text-warning-text">Overdue</p> : null}
                    </Td>
                    <Td>{t.submissionRef ? <span className="font-mono text-xs">{t.submissionRef}</span> : <span className="text-muted">Not submitted</span>}</Td>
                    <Td>
                      {t.verified ? (
                        <StatusPill tone="green">Verified result recorded</StatusPill>
                      ) : t.submissionRef ? (
                        <StatusPill tone="amber">Submitted, not verified</StatusPill>
                      ) : (
                        <StatusPill tone="gray">Waiting for submission</StatusPill>
                      )}
                    </Td>
                    <Td>
                      <StatusPill tone={t.status === "open" ? "blue" : t.status === "done" ? "green" : "gray"}>{t.status === "open" ? "Open" : t.status === "done" ? "Done" : "Cancelled"}</StatusPill>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<ClipboardList />} title="No manual tasks">
            A task appears when HR assigns a rejected or stalled line to the broker from the case page.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
