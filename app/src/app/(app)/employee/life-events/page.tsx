import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DateText, EmptyState, PageHeader, Section, StatusPill, Table, TableFooter, Td, Th, THead } from "@/components/ui/primitives";
import { requireSession } from "@/server/guard";
import { employeeCasesView } from "@/server/views";

export default async function LifeEventsPage() {
  const { user, scenarioId } = await requireSession(["employee"]);
  const rows = await employeeCasesView(user, scenarioId);
  const drafts = rows.filter((r) => r.status === "draft").length;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Life events"
        crumbs={[{ label: "Benefits", href: "/employee/benefits" }, { label: "Life events" }]}
        description="Report a change like a birth, divorce or lost coverage, and track each request until coverage and pay match."
        actions={
          <ButtonLink href="/employee/life-events/new">
            <Plus className="size-4" aria-hidden /> Report a life event
          </ButtonLink>
        }
      />
      <Section title="My requests" description={drafts ? `${drafts} draft${drafts > 1 ? "s" : ""} not yet submitted. Drafts are saved on the server.` : undefined} bodyClassName="">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Sparkles aria-hidden />}
            title="No life events reported"
            action={
              <ButtonLink href="/employee/life-events/new">
                <Plus className="size-4" aria-hidden /> Report a life event
              </ButtonLink>
            }
          >
            When something changes in your family or other coverage, report it here. Most changes must be requested within 30 days.
          </EmptyState>
        ) : (
          <>
            <Table label="My life event requests">
              <THead>
                <tr>
                  <Th>Request</Th>
                  <Th>Event</Th>
                  <Th>Status</Th>
                  <Th>Received</Th>
                  <Th>Last updated</Th>
                  <Th align="right">Action</Th>
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas">
                    <Td className="tabular">
                      <Link href={r.href} className="text-primary hover:underline">
                        {r.caseNumber}
                      </Link>
                    </Td>
                    <Td>{r.event}</Td>
                    <Td>
                      <StatusPill tone={r.statusLabel.tone}>{r.statusLabel.label}</StatusPill>
                    </Td>
                    <Td>{r.receivedAt ? <DateText time={r.receivedAt} /> : <span className="text-muted">Not submitted</span>}</Td>
                    <Td>
                      <DateText time={r.updatedAt} />
                    </Td>
                    <Td align="right">
                      <ButtonLink href={r.href} variant="outline" size="sm">
                        {r.status === "draft" ? "Continue draft" : "Track request"}
                      </ButtonLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <TableFooter>
              <span>
                {rows.length} request{rows.length === 1 ? "" : "s"}
              </span>
            </TableFooter>
          </>
        )}
      </Section>
    </div>
  );
}
