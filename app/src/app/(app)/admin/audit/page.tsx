import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Lock,
} from "lucide-react";
import { requireSession } from "@/server/guard";
import { auditView } from "@/server/views";
import { buttonClass } from "@/components/ui/button";
import {
  DateText,
  EmptyState,
  PageHeader,
  Section,
  StatusPill,
  Table,
  TableFooter,
  Tag,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import { BENEFIT, humanize } from "@/components/hr/labels";

const TABS = [
  { id: "events", label: "Audit log" },
  { id: "ai", label: "AI activity" },
  { id: "history", label: "History for reporting" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const PAGE = 25;

const AI_KIND: Record<string, string> = {
  rule_check: "Rule check",
  reconciliation_check: "Reconciliation check",
};

function Pager({
  tab,
  page,
  pages,
  total,
}: {
  tab: TabId;
  page: number;
  pages: number;
  total: number;
}) {
  const link = (p: number) => `/admin/audit?tab=${tab}&page=${p}`;
  const btn = "grid size-8 place-items-center rounded-[8px] border border-line";
  return (
    <TableFooter>
      <span>
        {total} row{total === 1 ? "" : "s"}
      </span>
      <span className="flex items-center gap-3">
        <span className="tabular">
          Page {page} of {pages}
        </span>
        {page > 1 ? (
          <Link
            href={link(page - 1)}
            className={`${btn} text-ink hover:bg-fill`}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={`${btn} text-muted opacity-50`} aria-hidden>
            <ChevronLeft className="size-4" />
          </span>
        )}
        {page < pages ? (
          <Link
            href={link(page + 1)}
            className={`${btn} text-ink hover:bg-fill`}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={`${btn} text-muted opacity-50`} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </span>
    </TableFooter>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const sp = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === sp.tab)?.id ?? "events";
  const v = await auditView(user, scenarioId);
  const rows =
    tab === "events"
      ? v.events.length
      : tab === "ai"
        ? v.ai.length
        : v.acaHistory.length;
  const pages = Math.max(1, Math.ceil(rows / PAGE));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1),
  );
  const slice = <T,>(xs: T[]) => xs.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Audit"
        crumbs={[
          { label: "Benefits admin", href: "/admin" },
          { label: "Audit" },
        ]}
        description="Append-only record of what happened, who did it and when, in business time."
        actions={
          tab === "history" ? (
            <a
              href="/api/documents/aca_history"
              className={buttonClass("outline")}
            >
              <Download className="size-4" aria-hidden />
              Download CSV
            </a>
          ) : undefined
        }
      />
      <nav
        aria-label="Audit views"
        className="mb-4 flex flex-wrap gap-x-6 border-b border-divider"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/audit?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-sm ${t.id === tab ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            <Tag>
              {t.id === "events"
                ? v.events.length
                : t.id === "ai"
                  ? v.ai.length
                  : v.acaHistory.length}
            </Tag>
          </Link>
        ))}
      </nav>

      {tab === "events" ? (
        <Section
          title="Audit log"
          description="Newest first. Internal events are never shown to employees."
          bodyClassName=""
        >
          {v.events.length === 0 ? (
            <EmptyState icon={<History />} title="No events yet" />
          ) : (
            <>
              <Table label="Audit log">
                <THead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Case</Th>
                    <Th>Actor</Th>
                    <Th>Type</Th>
                    <Th className="w-[44%]">Summary</Th>
                    <Th>Visibility</Th>
                  </tr>
                </THead>
                <tbody>
                  {slice(v.events).map((a) => (
                    <tr key={a.id} className="align-top">
                      <Td className="align-top! whitespace-nowrap">
                        <DateText time={a.at} />
                      </Td>
                      <Td className="align-top!">
                        {a.caseId && a.caseNumber ? (
                          <Link
                            href={`/admin/qle/${a.caseId}#timeline`}
                            className="tabular whitespace-nowrap text-primary hover:underline"
                          >
                            {a.caseNumber}
                          </Link>
                        ) : (
                          <span className="text-muted">System</span>
                        )}
                      </Td>
                      <Td className="align-top!">{a.actorName}</Td>
                      <Td className="align-top! text-[13px] text-ink-2">
                        {humanize(a.type)}
                      </Td>
                      <Td className="align-top! text-ink-2">{a.summary}</Td>
                      <Td className="align-top!">
                        {a.visibility === "internal" ? (
                          <Tag className="gap-1">
                            <Lock className="size-3" aria-hidden />
                            Internal
                          </Tag>
                        ) : (
                          <StatusPill tone="blue">Employee sees</StatusPill>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager tab={tab} page={page} pages={pages} total={rows} />
            </>
          )}
        </Section>
      ) : null}

      {tab === "ai" ? (
        <Section
          title="AI activity"
          description="Deterministic rule and reconciliation work is labeled separately from model output. The AI match score is a deterministic prototype rule, not a number from the model."
          bodyClassName=""
        >
          {v.ai.length === 0 ? (
            <EmptyState title="No AI activity yet">
              Document reads, rule checks and Emma answers appear here as they
              happen.
            </EmptyState>
          ) : (
            <>
              <Table label="AI activity">
                <THead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Kind</Th>
                    <Th>Model</Th>
                    <Th className="w-[50%]">What happened</Th>
                  </tr>
                </THead>
                <tbody>
                  {slice(v.ai).map((a) => (
                    <tr key={a.id} className="align-top">
                      <Td className="align-top! whitespace-nowrap">
                        <DateText time={a.at} />
                      </Td>
                      <Td className="align-top!">
                        {AI_KIND[a.kind] ?? humanize(a.kind)}
                      </Td>
                      <Td className="align-top!">
                        {a.model ? (
                          <Tag>{a.model}</Tag>
                        ) : (
                          <span className="text-muted">Deterministic</span>
                        )}
                      </Td>
                      <Td className="align-top!">
                        <p className="text-ink">{a.label}</p>
                        <p className="text-[13px] text-muted">{a.detail}</p>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager tab={tab} page={page} pages={pages} total={rows} />
            </>
          )}
        </Section>
      ) : null}

      {tab === "history" ? (
        <Section
          title="History for reporting"
          description="Coverage periods by person and benefit, kept for year-end reporting. This is a record, not a filing, and it makes no compliance claim."
          bodyClassName=""
        >
          {v.acaHistory.length === 0 ? (
            <EmptyState title="No coverage history yet" />
          ) : (
            <>
              <Table label="History for reporting">
                <THead>
                  <tr>
                    <Th>Employee ref</Th>
                    <Th>Benefit</Th>
                    <Th>Plan</Th>
                    <Th>Coverage level</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Case</Th>
                    <Th>Contribution ref</Th>
                  </tr>
                </THead>
                <tbody>
                  {slice(v.acaHistory).map((h, i) => (
                    <tr key={i} className={h.superseded ? "text-ink-2" : ""}>
                      <Td className="tabular">{h.employeeRef}</Td>
                      <Td>{BENEFIT[h.benefit]}</Td>
                      <Td>{h.plan}</Td>
                      <Td>{h.tier}</Td>
                      <Td>
                        <DateText date={h.coverageFrom} />
                      </Td>
                      <Td>
                        {h.coverageTo ? (
                          <DateText date={h.coverageTo} />
                        ) : (
                          <span className="text-muted">Open</span>
                        )}
                      </Td>
                      <Td className="tabular">
                        {h.caseRef ?? (
                          <span className="text-muted">Host record</span>
                        )}
                      </Td>
                      <Td className="tabular text-xs text-muted">
                        {h.contributionRef}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager tab={tab} page={page} pages={pages} total={rows} />
            </>
          )}
        </Section>
      ) : null}
    </div>
  );
}
