import type { HrCaseView } from "@/server/views";
import { AskEmmaButton } from "@/components/emma/EmmaDock";
import {
  DateText,
  EmptyState,
  Section,
  StatusPill,
  Table,
  Tag,
  Td,
  Th,
  THead,
} from "@/components/ui/primitives";
import { ownerName } from "@/server/config/identities";
import { CheckReviewButton } from "../CheckReview";
import { CHECK_RESULT } from "../labels";
import { canDecide } from "./shared";

function fmtInput(v: string | number | boolean | null): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

/** Rule checks: result, reason, source, rule id@version and inputs. */
export function ChecksSection({ v }: { v: HrCaseView }) {
  const checks = v.evaluation?.checks ?? [];
  const counts = checks.reduce<Record<string, number>>(
    (a, k) => (
      (a[k.resolvedBy ? "passed" : k.result] =
        (a[k.resolvedBy ? "passed" : k.result] ?? 0) + 1),
      a
    ),
    {},
  );
  const reviewable = canDecide(v.case.status);
  const summary = (
    ["passed", "needs_information", "needs_review", "not_applicable"] as const
  )
    .filter((r) => counts[r])
    .map((r) => `${counts[r]} ${CHECK_RESULT[r].label.toLowerCase()}`)
    .join(" · ");
  return (
    <Section
      id="checks"
      title="Checks"
      description={
        summary
          ? `${summary}. Rules decide; reviews document exceptions with a source.`
          : undefined
      }
      actions={
        <AskEmmaButton
          question={`Summarize ${v.case.caseNumber} and explain which checks still need review and why.`}
        >
          Explain with Emma
        </AskEmmaButton>
      }
      bodyClassName=""
    >
      {checks.length === 0 ? (
        <EmptyState title="No checks yet">
          Checks run when the request is submitted.
        </EmptyState>
      ) : (
        <Table label="Rule checks">
          <THead>
            <tr>
              <Th className="w-[22%]">Check</Th>
              <Th>Result</Th>
              <Th className="w-[38%]">Reason and source</Th>
              <Th>Inputs</Th>
              <Th align="right" className="relative">
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {checks.map((k) => {
              const open =
                k.blocking &&
                !(
                  k.result === "passed" ||
                  k.result === "not_applicable" ||
                  k.resolvedBy
                );
              const r = k.resolvedBy
                ? CHECK_RESULT[k.resolvedBy.outcome]
                : CHECK_RESULT[k.result];
              const inputs = Object.entries(k.inputs);
              return (
                <tr key={k.id} className="align-top!">
                  <Td className="align-top!">
                    <p className="text-ink">{k.label}</p>
                    <p className="tabular mt-0.5 text-xs text-muted">
                      {k.ruleId}@{k.ruleVersion}
                    </p>
                    {open ? (
                      <Tag className="mt-1.5">Blocks approval</Tag>
                    ) : null}
                  </Td>
                  <Td className="align-top!">
                    <StatusPill tone={r.tone}>{r.label}</StatusPill>
                    {k.resolvedBy ? (
                      <p className="mt-1 text-xs text-muted">
                        Reviewed (was{" "}
                        {CHECK_RESULT[k.result].label.toLowerCase()})
                      </p>
                    ) : null}
                  </Td>
                  <Td className="align-top!">
                    <p className="text-ink-2">{k.reason}</p>
                    <p className="mt-1 text-xs text-muted">
                      Source: {k.source}
                    </p>
                    {k.resolvedBy ? (
                      <div className="mt-2 rounded-[8px] bg-fill px-2.5 py-2 text-xs text-ink-2">
                        <p>
                          Reviewed by {k.resolvedBy.reviewer} (recorded by{" "}
                          {ownerName(k.resolvedBy.actor)},{" "}
                          <DateText time={k.resolvedBy.at} />)
                        </p>
                        <p className="mt-0.5">Reason: {k.resolvedBy.reason}</p>
                        <p className="mt-0.5">Source: {k.resolvedBy.source}</p>
                      </div>
                    ) : null}
                  </Td>
                  <Td className="align-top!">
                    {inputs.length ? (
                      <ul className="flex max-w-[260px] flex-wrap gap-1">
                        {inputs.map(([key, val]) => (
                          <li key={key}>
                            <Tag className="whitespace-nowrap">
                              <span className="text-muted">{key}:</span>&nbsp;
                              <span className="tabular">{fmtInput(val)}</span>
                            </Tag>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td align="right" className="align-top!">
                    {open && reviewable ? (
                      <CheckReviewButton
                        caseId={v.case.id}
                        version={v.case.version}
                        checkId={k.id}
                        checkLabel={k.label}
                        checkReason={k.reason}
                        reviewerDefault="Daniel Brooks"
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
