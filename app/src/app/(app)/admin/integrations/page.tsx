import { Edi834Button } from "@/components/hr/Edi834Button";
import { SendBatchButton } from "@/components/hr/ExecutionActions";
import { BatchPayload } from "@/components/demo/BatchPayload";
import { fmtDateTime } from "@/lib/dates";
import { Download, FileStack } from "lucide-react";
import { requireSession } from "@/server/guard";
import { hrIntegrationsView } from "@/server/views";
import {
  Banner,
  DateText,
  EmptyState,
  LabelValue,
  PageHeader,
  Section,
  StatusPill,
  Table,
  Tag,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import {
  BENEFIT,
  DELIVERY,
  MEMBER_RESULT,
  ROUTE,
} from "@/components/hr/labels";
import type { Tone } from "@/components/ui/primitives";

const TRANSPORT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting receipt", tone: "gray" },
  received: { label: "Received", tone: "green" },
  unknown: { label: "Unknown — inquiry needed", tone: "amber" },
  not_received: { label: "Not received", tone: "red" },
};
const VALIDATION: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "gray" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export default async function AdminIntegrationsPage() {
  const { user, scenarioId } = await requireSession(["hr_admin"]);
  const v = await hrIntegrationsView(user, scenarioId);
  const batches = v.batches.slice().reverse();
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Integrations"
        crumbs={[
          { label: "Benefits admin", href: "/admin" },
          { label: "Integrations" },
        ]}
        description="Carrier routes, the next batch file and everything sent. Carrier, payroll and COBRA systems are simulated."
      />
      <Banner className="mb-4" title={v.label}>
        Files follow the 834 shape for demonstration only and are not certified
        by any carrier. The external-system simulators are operated from the
        demo operator&apos;s console at /demo/integrations, which HR cannot
        open.
      </Banner>

      <div className="flex flex-col gap-4">
        <Section
          title="Next batch · EDI 834"
          description={`Generated as soon as HR approves a change. Runs automatically every night at 10:00 PM ET (next: ${fmtDateTime(v.nextBatchAt)}). Nothing reaches the carrier until the batch runs.`}
          actions={<SendBatchButton records={v.pending.length} />}
          bodyClassName=""
        >
          {v.pending.length === 0 ? (
            <EmptyState icon={<FileStack />} title={v.awaitingApproval.length ? "Nothing approved yet" : "No changes waiting"}>
              {v.awaitingApproval.length ? (
                <>
                  Approve a case and its 834 records appear here with the generated file. Waiting for your approval:{" "}
                  {v.awaitingApproval.map((c, i) => (
                    <span key={c.id}>
                      {i ? ", " : ""}
                      <a href={`/admin/qle/${c.id}`} className="text-primary hover:underline">
                        {c.caseNumber}
                      </a>{" "}
                      ({c.event}, {c.employeeName}
                      {c.aiMatch !== null ? `, AI match ${c.aiMatch}%` : ""})
                    </span>
                  ))}
                  .
                </>
              ) : (
                "When HR approves a medical change, its 834 record appears here and the file for the next batch is generated. Dental and vision changes go to the carrier API right after approval (listed below)."
              )}
            </EmptyState>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:divide-x lg:divide-divider">
              <Table label="Records waiting for the next batch">
                <THead>
                  <tr>
                    <Th>Case</Th>
                    <Th>Record</Th>
                    <Th>Approved</Th>
                  </tr>
                </THead>
                <tbody>
                  {v.pending.map((t) => (
                    <tr key={t.id}>
                      <Td className="whitespace-nowrap">
                        <a href={`/admin/qle/${t.caseId}`} className="text-primary hover:underline">
                          {t.caseNumber}
                        </a>
                      </Td>
                      <Td>
                        <p>
                          {t.summary.member} · {BENEFIT[t.benefit]}
                        </p>
                        <p className="text-xs text-muted">
                          {t.summary.action} · {t.summary.plan} {t.summary.level} · {t.summary.date}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap">{t.approvedAt ? <DateText time={t.approvedAt} /> : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="border-t border-divider p-4 lg:border-t-0">
                <BatchPayload batchId="pending" title={`Generated file · ${v.pending.length} record${v.pending.length === 1 ? "" : "s"} · not sent yet`} label="Illustrative 834 — not carrier-certified. Draft for the next batch; control numbers are final when the batch runs" />
              </div>
            </div>
          )}
        </Section>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section title="Carriers and routes" bodyClassName="">
            <Table label="Carriers">
              <THead>
                <tr>
                  <Th>Carrier</Th>
                  <Th>Group</Th>
                  <Th>Benefits</Th>
                  <Th>Route</Th>
                </tr>
              </THead>
              <tbody>
                {v.carriers.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      {c.name}
                      <p className="text-xs text-muted">Simulated</p>
                    </Td>
                    <Td className="tabular whitespace-nowrap">
                      {c.groupNumber}
                    </Td>
                    <Td>{c.benefits.map((b) => BENEFIT[b]).join(", ")}</Td>
                    <Td>
                      {c.route === "edi_834"
                        ? "834 file, nightly batch"
                        : "Carrier API, per change"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
          <Section title="Delivery settings" bodyClassName="px-5 py-4">
            <LabelValue
              cols={2}
              items={[
                {
                  label: "Next nightly batch",
                  value: <DateText time={v.nextBatchAt} />,
                },
                { label: "Business time", value: <DateText time={v.now} /> },
                { label: "Storage mode", value: v.store.mode },
                {
                  label: "Durable",
                  value: v.store.durable
                    ? "Yes, survives refresh and redeploy"
                    : "No, in-memory for this server only",
                },
              ]}
            />
          </Section>
        </div>

        <Section
          title="834 batches"
          description="Newest first. A transport receipt is not a coverage result."
          bodyClassName=""
        >
          {batches.length === 0 ? (
            <EmptyState icon={<FileStack />} title="No files sent yet">
              Approved changes for 834 carriers go out in the nightly batch
              shown above.
            </EmptyState>
          ) : (
            <Table label="834 batches">
              <THead>
                <tr>
                  <Th>Batch</Th>
                  <Th>Control number</Th>
                  <Th align="right">Records</Th>
                  <Th>Payload hash</Th>
                  <Th>Transport</Th>
                  <Th>File validation</Th>
                  <Th>Sent</Th>
                  <Th>Downloads</Th>
                </tr>
              </THead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="align-top">
                    <Td className="align-top!">
                      <p className="tabular">{b.id}</p>
                      <p className="text-xs text-muted">
                        {b.txns
                          .map((t) => t.caseNumber)
                          .filter((x, i, a) => a.indexOf(x) === i)
                          .join(", ")}
                      </p>
                    </Td>
                    <Td className="tabular align-top!">{b.controlNumber}</Td>
                    <Td align="right" className="align-top!">
                      {b.recordCount}
                    </Td>
                    <Td className="align-top!">
                      <span
                        className="tabular text-xs text-ink-2"
                        title={b.payloadHash}
                      >
                        {b.payloadHash.slice(0, 12)}…
                      </span>
                    </Td>
                    <Td className="align-top!">
                      <StatusPill tone={TRANSPORT[b.transport].tone}>
                        {TRANSPORT[b.transport].label}
                      </StatusPill>
                      {b.attempts.length > 1 ? (
                        <p className="mt-1 text-xs text-muted">
                          {b.attempts.length} attempts
                        </p>
                      ) : null}
                    </Td>
                    <Td className="align-top!">
                      <StatusPill tone={VALIDATION[b.fileValidation].tone}>
                        {VALIDATION[b.fileValidation].label}
                      </StatusPill>
                      {b.fileReason ? (
                        <p className="mt-1 text-xs text-danger-text">
                          {b.fileReason}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="align-top!">
                      <DateText time={b.sentAt} />
                    </Td>
                    <Td className="align-top!">
                      <div className="flex flex-col gap-1">
                        <Edi834Button batchId={b.id} />
                        <a
                          href={`/api/documents/edi_834?batchId=${encodeURIComponent(b.id)}`}
                          className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                        >
                          <Download className="size-3.5" aria-hidden />
                          .edi file
                        </a>
                        <a
                          href={`/api/documents/edi_summary?batchId=${encodeURIComponent(b.id)}`}
                          className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                        >
                          <Download className="size-3.5" aria-hidden />
                          Readable summary
                        </a>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>

        <Section
          title="API transactions"
          description="Dental and vision changes go to the carrier API one change at a time."
          bodyClassName=""
        >
          {v.apiTxns.length === 0 ? (
            <EmptyState title="No API calls yet">
              API changes appear here after approval, with the carrier&apos;s
              reference once it replies.
            </EmptyState>
          ) : (
            <Table label="API transactions">
              <THead>
                <tr>
                  <Th>Transaction</Th>
                  <Th>Case</Th>
                  <Th>Change</Th>
                  <Th>Delivery</Th>
                  <Th>Member result</Th>
                  <Th>Reference</Th>
                  <Th>Sent</Th>
                </tr>
              </THead>
              <tbody>
                {v.apiTxns.map((t) => (
                  <tr key={t.id}>
                    <Td className="tabular">{t.id}</Td>
                    <Td className="tabular">{t.caseNumber}</Td>
                    <Td>
                      <p>{t.summary.member}</p>
                      <p className="text-xs text-muted">
                        {t.summary.action} · {t.summary.plan} {t.summary.level}{" "}
                        · {t.summary.date}
                      </p>
                    </Td>
                    <Td>
                      <StatusPill tone={DELIVERY[t.delivery].tone}>
                        {DELIVERY[t.delivery].label}
                      </StatusPill>
                    </Td>
                    <Td>
                      <StatusPill tone={MEMBER_RESULT[t.memberResult].tone}>
                        {MEMBER_RESULT[t.memberResult].label}
                      </StatusPill>
                    </Td>
                    <Td>
                      {t.apiReference ? (
                        <Tag>{t.apiReference}</Tag>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      {t.sentAt ? (
                        <DateText time={t.sentAt} />
                      ) : (
                        <span className="text-muted">Not sent</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        <p className="text-xs text-muted">
          Routes: {Object.values(ROUTE).join(" · ")}. Broker portal submissions
          are recorded by the assigned broker; no portal login is automated.
        </p>
      </div>
    </div>
  );
}
