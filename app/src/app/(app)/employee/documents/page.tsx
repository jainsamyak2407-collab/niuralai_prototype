import Link from "next/link";
import { Download, FileText, FolderOpen, Receipt, Upload } from "lucide-react";
import { DateText, EmptyState, PageHeader, Section, StatusPill, Table, Tag, Td, Th, THead } from "@/components/ui/primitives";
import { EVIDENCE_STATUS, fmtBytes } from "@/components/employee/labels";
import { requireSession } from "@/server/guard";
import { employeeDocumentsView } from "@/server/views";

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-primary hover:underline" aria-label={label}>
      <Download className="size-4" aria-hidden /> Download
    </a>
  );
}

export default async function DocumentsPage() {
  const { user, scenarioId } = await requireSession(["employee"]);
  const v = await employeeDocumentsView(user, scenarioId);
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Documents" crumbs={[{ label: "Benefits", href: "/employee/benefits" }, { label: "Documents" }]} description="Plan documents, your receipts, the files you uploaded and your payslips. Every download is marked synthetic demo data." />

      <Section title="Plan documents" description="Illustrative Nexa plan terms. Not verified insurance products." bodyClassName="">
        <Table label="Plan documents">
          <THead>
            <tr>
              <Th>Document</Th>
              <Th>Type</Th>
              <Th align="right">File</Th>
            </tr>
          </THead>
          <tbody>
            {v.plans.map((d) => (
              <tr key={d.id}>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="size-4 text-muted" aria-hidden /> {d.title}
                  </span>
                </Td>
                <Td>
                  <Tag>{d.kind}</Tag>
                </Td>
                <Td align="right">
                  <DocLink href={`/api/documents/${d.id}`} label={`Download ${d.title}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Receipts" description="Proof of when each request was received, and the approval summary once HR approves." bodyClassName="">
        {v.receipts.length ? (
          <Table label="Receipts">
            <THead>
              <tr>
                <Th>Request</Th>
                <Th>Event</Th>
                <Th>Received</Th>
                <Th align="right">Receipt</Th>
                <Th align="right">Approval summary</Th>
              </tr>
            </THead>
            <tbody>
              {v.receipts.map((r) => (
                <tr key={r.caseId}>
                  <Td className="tabular">
                    <Link href={`/employee/cases/${r.caseId}`} className="text-primary hover:underline">
                      {r.caseNumber}
                    </Link>
                  </Td>
                  <Td>{r.event}</Td>
                  <Td>
                    <DateText time={r.receivedAt} />
                  </Td>
                  <Td align="right">
                    <DocLink href={`/api/documents/receipt?caseId=${r.caseId}`} label={`Download receipt for ${r.caseNumber}`} />
                  </Td>
                  <Td align="right">{r.approved ? <DocLink href={`/api/documents/approval?caseId=${r.caseId}`} label={`Download approval summary for ${r.caseNumber}`} /> : <span className="text-muted">After approval</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Receipt aria-hidden />} title="No receipts yet">
            You get a receipt as soon as you submit a life event request.
          </EmptyState>
        )}
      </Section>

      <Section title="My uploaded documents" description="Only you and Nexa HR can open these files." bodyClassName="">
        {v.evidence.length ? (
          <Table label="My uploaded documents">
            <THead>
              <tr>
                <Th>File</Th>
                <Th>Request</Th>
                <Th>Uploaded</Th>
                <Th>Status</Th>
                <Th align="right">File</Th>
              </tr>
            </THead>
            <tbody>
              {v.evidence.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <span className="block max-w-72 truncate">{e.fileName}</span>
                    <span className="text-xs text-muted">
                      {e.documentType ?? "Document"} · {fmtBytes(e.sizeBytes)}
                    </span>
                  </Td>
                  <Td className="tabular">{e.caseNumber}</Td>
                  <Td>
                    <DateText time={e.uploadedAt} />
                  </Td>
                  <Td>
                    <StatusPill tone={EVIDENCE_STATUS[e.status].tone}>{EVIDENCE_STATUS[e.status].label}</StatusPill>
                  </Td>
                  <Td align="right">
                    <a href={`/api/evidence/${e.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline" aria-label={`Open ${e.fileName}`}>
                      Open
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Upload aria-hidden />} title="No uploaded documents">
            Documents you add to a life event request appear here.
          </EmptyState>
        )}
      </Section>

      <Section title="Payslips" description="Posted simulated payslips. Withholding lines are illustrative." bodyClassName="">
        {v.payslips.length ? (
          <Table label="Payslips">
            <THead>
              <tr>
                <Th>Payday</Th>
                <Th align="right">File</Th>
              </tr>
            </THead>
            <tbody>
              {v.payslips
                .slice()
                .sort((a, b) => b.payday.localeCompare(a.payday))
                .map((p) => (
                  <tr key={p.runId}>
                    <Td>
                      <DateText date={p.payday} />
                    </Td>
                    <Td align="right">
                      <DocLink href={`/api/documents/payslip?runId=${p.runId}`} label={`Download payslip for ${p.payday}`} />
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FolderOpen aria-hidden />} title="No payslips yet">
            Payslips appear after payroll posts a pay run.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
