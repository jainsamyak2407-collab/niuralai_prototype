import { CheckCircle2, Circle, FileText, SearchX } from "lucide-react";
import { requireSession } from "@/server/guard";
import { brokerTaskView } from "@/server/views";
import { DomainError } from "@/server/domain/ctx";
import { TIER_LABEL } from "@/server/config/plans";
import { fmtDate } from "@/lib/dates";
import { businessNow } from "@/components/broker/businessNow";
import {
  RecordResultForm,
  RecordSubmissionForm,
} from "@/components/broker/BrokerActions";
import { ButtonLink } from "@/components/ui/button";
import {
  Banner,
  DateText,
  EmptyState,
  LabelValue,
  PageHeader,
  Section,
  StatusPill,
} from "@/components/ui/primitives";

type View = Awaited<ReturnType<typeof brokerTaskView>>;

export default async function BrokerTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, scenarioId } = await requireSession(["broker"]);
  const { id } = await params;
  let v: View;
  try {
    v = await brokerTaskView(user, scenarioId, id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) {
      return (
        <div className="mx-auto max-w-7xl">
          <Section title="Task not found" bodyClassName="">
            <EmptyState
              icon={<SearchX />}
              title="We could not find that assigned task"
              action={
                <ButtonLink href="/broker/tasks" variant="outline">
                  Back to tasks
                </ButtonLink>
              }
            >
              You can open only tasks assigned to you in this scenario.
            </EmptyState>
          </Section>
        </div>
      );
    }
    throw e;
  }
  const now = await businessNow(scenarioId);
  const t = v.task;
  const b = t.broker;
  const submitted = !!b.submissionRef;
  const verified = !!b.result;
  const overdue = t.status === "open" && !!t.dueAt && t.dueAt < now;
  const steps = [
    {
      label:
        b.checklist[0] ??
        "Sign in to the carrier portal with your own credentials",
      done: submitted,
    },
    {
      label: b.checklist[1] ?? "Enter only the fields in the packet",
      done: submitted,
    },
    {
      label: b.checklist[2] ?? "Record the portal submission reference",
      done: submitted,
    },
    {
      label:
        b.checklist[3] ??
        "Record the carrier's verified result with its source",
      done: verified,
    },
  ];
  const packetValue = (label: string, value: string) => {
    if (!value) return "—";
    if (label === "Coverage level" && value in TIER_LABEL)
      return TIER_LABEL[value as keyof typeof TIER_LABEL];
    if (label === "Relationship")
      return (
        (
          {
            self: "Employee (subscriber)",
            spouse: "Spouse",
            former_spouse: "Former spouse",
            child: "Child",
          } as Record<string, string>
        )[value] ?? value
      );
    if (label === "Plan")
      return v.plans.find((p) => p.id === value)?.name ?? value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fmtDate(value);
    return value;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t.title}
        crumbs={[
          { label: "Broker" },
          { label: "Tasks", href: "/broker/tasks" },
          { label: v.caseNumber },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{v.caseNumber}</span>
            {verified ? (
              <StatusPill tone="green">Result recorded</StatusPill>
            ) : submitted ? (
              <StatusPill tone="blue">Submitted, not verified</StatusPill>
            ) : (
              <StatusPill tone="amber">Not submitted</StatusPill>
            )}
            {t.status !== "open" ? (
              <StatusPill tone="gray">Closed</StatusPill>
            ) : overdue ? (
              <StatusPill tone="red">Overdue</StatusPill>
            ) : null}
          </span>
        }
      />

      <Banner className="mb-4" title="No portal login is automated">
        Sign in to the carrier portal yourself. This page records what you did
        and what the carrier shows; it never acts in the portal for you.
      </Banner>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Issue">
            <LabelValue
              cols={3}
              items={[
                { label: "Reason", value: t.reason },
                { label: "Next action", value: t.nextAction },
                {
                  label: "Due",
                  value: (
                    <DateText
                      time={t.dueAt}
                      className={overdue ? "text-danger-text" : ""}
                    />
                  ),
                },
                { label: "Owner", value: t.ownerName },
                { label: "Backup", value: t.backupName },
                {
                  label: "Submission reference",
                  value: b.submissionRef ? (
                    <span className="tabular">{b.submissionRef}</span>
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  ),
                },
              ]}
            />
          </Section>

          <Section
            title="Minimum packet"
            description="Enter only these fields in the portal. Other case details are not shared with you."
          >
            <LabelValue
              cols={3}
              items={b.packet.map((p) => ({
                label: p.label,
                value: (
                  <span className="tabular">
                    {packetValue(p.label, p.value)}
                  </span>
                ),
              }))}
            />
          </Section>

          <Section
            title="1. Record portal submission"
            description="Submitted means sent through the portal. It does not mean the carrier made the change."
          >
            {submitted ? (
              <p className="flex items-start gap-2 text-sm text-ink">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
                <span>
                  Submitted as{" "}
                  <span className="tabular">{b.submissionRef}</span>
                  {b.submittedAt ? (
                    <>
                      {" on "}
                      <DateText time={b.submittedAt} />
                    </>
                  ) : null}
                  . Coverage is not verified until you record the carrier&apos;s
                  result.
                </span>
              </p>
            ) : t.status === "open" ? (
              <RecordSubmissionForm taskId={t.id} />
            ) : (
              <p className="text-sm text-muted">This task is closed.</p>
            )}
          </Section>

          <Section
            title="2. Record carrier result"
            description="What the carrier record shows, with its source and who verified it."
          >
            {verified ? (
              <LabelValue
                cols={3}
                items={[
                  { label: "Source", value: b.result!.sourceRef },
                  { label: "Verified by", value: b.result!.verifier },
                  {
                    label: "Recorded",
                    value: <DateText time={b.result!.at} />,
                  },
                  {
                    label: "Plan",
                    value:
                      v.plans.find((p) => p.id === b.result!.planId)?.name ??
                      b.result!.planId,
                  },
                  {
                    label: "Coverage level",
                    value: TIER_LABEL[b.result!.tier],
                  },
                  {
                    label: "Dates",
                    value: (
                      <span className="tabular">
                        {[
                          b.result!.startDate
                            ? `Starts ${fmtDate(b.result!.startDate)}`
                            : null,
                          b.result!.endDate
                            ? `Ends ${fmtDate(b.result!.endDate)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ),
                  },
                ]}
              />
            ) : !submitted ? (
              <p className="text-sm text-muted">
                Record the portal submission first. The carrier result comes
                after the carrier processes it.
              </p>
            ) : t.status === "open" ? (
              <RecordResultForm
                taskId={t.id}
                plans={v.plans}
                defaults={{
                  planId: v.order.planId,
                  tier: v.order.tier,
                  startDate: v.order.startDate,
                  endDate: v.order.endDate,
                }}
              />
            ) : (
              <p className="text-sm text-muted">This task is closed.</p>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Checklist" bodyClassName="px-5 py-3">
            <ol className="flex flex-col gap-2.5 text-sm">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  {s.done ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-label="done"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 size-4 shrink-0 text-muted"
                      aria-label="to do"
                    />
                  )}
                  <span className={s.done ? "text-ink-2" : "text-ink"}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
          <Section
            title="Permitted evidence"
            description="Names only. HR shares a file through the secure channel if the carrier asks for it."
            bodyClassName="px-5 py-3"
          >
            {v.permittedEvidence.length === 0 ? (
              <p className="text-sm text-muted">
                No evidence is shared for this task.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {v.permittedEvidence.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-ink">
                    <FileText className="size-4 text-muted" aria-hidden />
                    {e.documentType}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
