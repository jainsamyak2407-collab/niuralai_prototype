import { CalendarDays, FileText, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Banner, DateText, Money, PageHeader, Section, StatusPill, Table, Td, Th, THead } from "@/components/ui/primitives";
import { requireSession } from "@/server/guard";
import { employeeBenefitsView, benefitLabel } from "@/server/views";
import { fmtDateLong } from "@/lib/dates";

export default async function BenefitsPage() {
  const { user, scenarioId } = await requireSession(["employee"]);
  const v = await employeeBenefitsView(user, scenarioId);
  const total = v.current.reduce((a, e) => a + e.employeeCents, 0);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Benefits"
        description="Your confirmed elections at Nexa. Proposed changes stay separate until the insurance provider confirms them."
        actions={
          <ButtonLink href="/employee/life-events/new">
            <Plus className="size-4" aria-hidden /> Report a life event
          </ButtonLink>
        }
      />
      {v.pending.length ? (
        <div className="mb-5 space-y-2">
          {v.pending.map((p) => (
            <Banner
              key={p.id}
              tone="warning"
              title={`${p.event} — ${p.statusLabel.label}`}
              action={
                <ButtonLink href={p.href} variant="outline" size="sm">
                  {p.status === "draft" ? "Continue draft" : "Track request"}
                </ButtonLink>
              }
            >
              {p.caseNumber}. Pending change, not current coverage.
              {p.totalAfterCents !== null && p.totalBeforeCents !== p.totalAfterCents ? (
                <>
                  {" "}Proposed regular deduction <Money cents={p.totalBeforeCents ?? 0} /> → <Money cents={p.totalAfterCents} /> per paycheck.
                </>
              ) : null}
            </Banner>
          ))}
        </div>
      ) : null}
      <Section title="Current coverage" description="Amounts are per semi-monthly paycheck (24 a year). Rates are illustrative Nexa configuration." actions={<span className="text-sm text-muted">You pay <Money cents={total} className="text-ink" /></span>} bodyClassName="">
        <Table label="Current coverage">
          <THead>
            <tr>
              <Th>Benefit</Th>
              <Th>Plan</Th>
              <Th>Coverage level</Th>
              <Th>Covered people</Th>
              <Th>Covered since</Th>
              <Th align="right">You pay</Th>
              <Th align="right">Nexa pays</Th>
              <Th>Plan summary</Th>
            </tr>
          </THead>
          <tbody>
            {v.current.map((e) => (
              <tr key={e.id}>
                <Td>{benefitLabel[e.benefit]}</Td>
                <Td>{e.planName}</Td>
                <Td>
                  <StatusPill tone="green">{e.tierLabel}</StatusPill>
                </Td>
                <Td>{e.covered.join(", ")}</Td>
                <Td>
                  <DateText date={e.effectiveFrom} />
                </Td>
                <Td align="right">
                  <Money cents={e.employeeCents} />
                </Td>
                <Td align="right">
                  <Money cents={e.employerCents} />
                </Td>
                <Td>
                  <a href={`/api/documents/${e.docId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <FileText className="size-4" aria-hidden /> Download
                  </a>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      {v.future.length ? (
        <Section title="Confirmed future changes" className="mt-5" bodyClassName="">
          <Table label="Confirmed future changes">
            <THead>
              <tr>
                <Th>Benefit</Th>
                <Th>Plan</Th>
                <Th>Coverage level</Th>
                <Th>Covered people</Th>
                <Th>Starts</Th>
                <Th align="right">You pay</Th>
              </tr>
            </THead>
            <tbody>
              {v.future.map((e) => (
                <tr key={e.id}>
                  <Td>{benefitLabel[e.benefit]}</Td>
                  <Td>{e.planName}</Td>
                  <Td>{e.tierLabel}</Td>
                  <Td>{e.covered.join(", ")}</Td>
                  <Td>
                    <StatusPill tone="blue">Confirmed from {fmtDateLong(e.effectiveFrom)}</StatusPill>
                  </Td>
                  <Td align="right">
                    <Money cents={e.employeeCents} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section title="Household">
          <ul className="divide-y divide-divider">
            {v.household.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0">
                <span>{p.name}</span>
                <span className="text-muted capitalize">{p.relationship.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Next open enrollment">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line">
              <CalendarDays className="size-4 text-warning" aria-hidden />
            </span>
            <div className="text-sm">
              <p className="text-ink">
                {fmtDateLong(v.openEnrollment.window.from)} – {fmtDateLong(v.openEnrollment.window.to, true)}
              </p>
              <p className="mt-0.5 text-muted">Changes made then start {fmtDateLong(v.openEnrollment.coverageStarts, true)}. For a life event now, use Report a life event.</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
