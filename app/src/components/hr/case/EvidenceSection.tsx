import { ConfidenceBlock } from "@/components/ui/confidence";
import { AlertTriangle, ExternalLink, FileText } from "lucide-react";
import type { HrCaseView } from "@/server/views";
import { ownerName } from "@/server/config/identities";
import { addDays } from "@/lib/dates";
import {
  DateText,
  EmptyState,
  Section,
  StatusPill,
  Table,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import { RequestInfoButton } from "../CaseActions";
import { EvidenceActions } from "../EvidenceActions";
import { EVIDENCE_STATUS, READ_MODE } from "../labels";
import { canDecide, firstName } from "./shared";

function size(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

const CHOICE: Record<"document" | "form" | "custom", string> = {
  document: "document value",
  form: "form value",
  custom: "a corrected value",
};

/** Evidence: authorized preview link beside proposed and confirmed facts. No scores. */
export function EvidenceSection({
  v,
  suggestedItems,
}: {
  v: HrCaseView;
  suggestedItems: string[];
}) {
  const files = v.evidence;
  const who = firstName(v.case.employeeName);
  const actionable = !["declined", "withdrawn"].includes(v.case.status);
  const requests = v.tasks.filter((t) => t.kind === "information_request");
  const requestList = requests.length ? (
    <div className="border-b border-divider px-5 py-4">
      <h3 className="mb-2 text-sm font-medium text-ink">
        Information requests
      </h3>
      <ul className="flex flex-col gap-2">
        {requests.map((t) => (
          <li
            key={t.id}
            className="rounded-[8px] border border-line px-3 py-2.5 text-[13px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink">{(t.items ?? [t.title]).join("; ")}</p>
              {t.status === "open" ? (
                <StatusPill tone={t.dueAt && t.dueAt < v.now ? "red" : "amber"}>
                  Waiting for {who} · due <DateText time={t.dueAt} />
                </StatusPill>
              ) : t.response ? (
                <StatusPill tone="green">Answered</StatusPill>
              ) : (
                <StatusPill tone="gray">
                  {t.status === "done" ? "Closed" : "Cancelled"}
                </StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-muted">Reason (internal): {t.reason}</p>
            {t.response ? (
              <div className="mt-2 rounded-[6px] bg-fill px-2.5 py-2 text-ink-2">
                <p>
                  {who} replied <DateText time={t.response.at} />: “
                  {t.response.message}”
                </p>
                {t.response.fileIds.length ? (
                  <p className="mt-0.5 text-muted">
                    {t.response.fileIds.length} file(s) attached, listed below.
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  return (
    <Section
      id="evidence"
      title="Evidence"
      description="Facts read from a document are proposals until the employee confirms them. Accepting a file does not certify it is authentic."
      bodyClassName=""
    >
      {requestList}
      {files.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No documents yet"
          action={
            actionable && canDecide(v.case.status) ? (
              <RequestInfoButton
                caseId={v.case.id}
                version={v.case.version}
                defaultDue={addDays(v.today, 5)}
                suggestedItems={suggestedItems}
                firstName={who}
              />
            ) : undefined
          }
        >
          {v.case.evidencePendingNote
            ? `${who} said: “${v.case.evidencePendingNote}”`
            : `${who} has not uploaded a document for this request.`}{" "}
          Ask for the exact document if the check needs it.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-divider">
          {files.map((f) => {
            const st = EVIDENCE_STATUS[f.status];
            const openConflict = f.proposedFacts.some(
              (p) => p.conflictWith && !p.confirmed,
            );
            const reviewable =
              actionable &&
              !f.reviewedBy &&
              f.status !== "rejected" &&
              !["uploading", "reading"].includes(f.status);
            return (
              <li key={f.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/evidence/${f.id}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {f.fileName}
                          <ExternalLink
                            className="size-3.5"
                            aria-label="opens in a new tab"
                          />
                        </a>
                        <StatusPill
                          tone={
                            f.reviewedBy && f.status !== "rejected"
                              ? "green"
                              : st.tone
                          }
                        >
                          {f.reviewedBy && f.status !== "rejected"
                            ? "Accepted as evidence"
                            : st.label}
                        </StatusPill>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {f.documentType ?? "Document type not identified"} ·{" "}
                        {f.readMode ? READ_MODE[f.readMode] : "Not read"} ·{" "}
                        {size(f.sizeBytes)} · uploaded{" "}
                        <DateText time={f.uploadedAt} />
                      </p>
                      <ConfidenceBlock score={f.confidence} summary={f.confidenceSummary} />
                      {f.readNote ? (
                        <p className="mt-1 text-[13px] text-ink-2">
                          {f.readNote}
                        </p>
                      ) : null}
                      {f.reviewedBy ? (
                        <p className="mt-1 text-[13px] text-muted">
                          {f.status === "rejected"
                            ? "Not accepted"
                            : "Accepted"}{" "}
                          by {ownerName(f.reviewedBy)},{" "}
                          <DateText time={f.reviewedAt ?? null} />
                          {f.rejectionReason ? `: ${f.rejectionReason}` : ""}
                        </p>
                      ) : f.status === "rejected" && f.rejectionReason ? (
                        <p className="mt-1 text-[13px] text-danger-text">
                          Not accepted: {f.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {reviewable ? (
                    <EvidenceActions
                      caseId={v.case.id}
                      version={v.case.version}
                      fileId={f.id}
                      fileName={f.fileName}
                      hasOpenConflict={openConflict}
                    />
                  ) : null}
                </div>

                {f.proposedFacts.length ? (
                  <div className="mt-3 overflow-hidden rounded-[8px] border border-line">
                    <Table label={`Facts from ${f.fileName}`}>
                      <THead>
                        <tr>
                          <Th>Fact</Th>
                          <Th>From the document</Th>
                          <Th>From the form</Th>
                          <Th>Confirmed</Th>
                        </tr>
                      </THead>
                      <tbody>
                        {f.proposedFacts.map((p, i) => (
                          <tr key={i} className="[&:last-child>td]:border-b-0">
                            <Td>{p.label}</Td>
                            <Td>
                              <p className="tabular text-ink">{p.value}</p>
                              <p className="text-xs text-muted">
                                {p.page
                                  ? `Page ${p.page}`
                                  : "Page not identified"}
                                {p.quote ? ` · “${p.quote}”` : ""}
                              </p>
                            </Td>
                            <Td>
                              {p.conflictWith ? (
                                <span className="inline-flex items-center gap-1.5 text-warning-text">
                                  <AlertTriangle
                                    className="size-3.5 text-warning"
                                    aria-hidden
                                  />
                                  <span className="tabular">
                                    {p.conflictWith.formValue}
                                  </span>
                                  <span className="text-xs">(differs)</span>
                                </span>
                              ) : (
                                <span className="text-muted">
                                  Same or not asked
                                </span>
                              )}
                            </Td>
                            <Td>
                              {p.confirmed ? (
                                <>
                                  <p className="tabular text-ink">
                                    {p.confirmed.value}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {ownerName(p.confirmed.by)} chose the{" "}
                                    {CHOICE[p.confirmed.choice]},{" "}
                                    <DateText time={p.confirmed.at} />
                                  </p>
                                </>
                              ) : (
                                <StatusPill tone="amber">
                                  Not confirmed
                                </StatusPill>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
