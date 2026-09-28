import { Download, FileText } from "lucide-react";
import { DEMO_SET, FIXTURES, SYNTHETIC_LABEL, type DocumentKind } from "@/lib/contracts/documents";
import { fmtDate } from "@/lib/dates";
import { buttonClass } from "@/components/ui/button";
import { Banner, PageHeader, Section, StatusPill, Table, Tag, Td, Th, THead } from "@/components/ui/primitives";
import { ScenarioSwitch } from "@/components/demo/ScenarioSwitch";
import { SimTag } from "@/components/demo/SimFrame";
import { requireSession } from "@/server/guard";
import { scenarioList } from "@/server/views";

export const metadata = { title: "Fixtures" };

const PLAN_DOCS: { kind: DocumentKind; title: string; about: string }[] = [
  { kind: "doc_benefits_guide", title: "Nexa benefits guide", about: "Plans, eligibility and how life events work at Nexa." },
  { kind: "doc_election_rules", title: "Election rules", about: "Request windows, start-date rules and review routes, with rule versions." },
  { kind: "doc_contributions", title: "Contribution schedule", about: "Employee cost per paycheck by plan and coverage level." },
  { kind: "doc_payroll_policy", title: "Payroll policy", about: "Cutoffs, catch-up and refund handling, and posted-payslip immutability." },
  { kind: "doc_medical_standard", title: "Standard medical summary", about: "Illustrative plan terms for Aetna-labeled Standard." },
  { kind: "doc_medical_plus", title: "Plus medical summary", about: "Illustrative plan terms for Aetna-labeled Plus." },
  { kind: "doc_dental_vision", title: "Dental and vision summaries", about: "Illustrative terms for the fictional Clearview plans." },
];

const SCENARIO_LABEL: Record<string, string> = { birth: "Birth", divorce: "Divorce", loss: "Loss of other coverage", any: "Any scenario" };

export default async function FixturesPage() {
  const { scenarioId } = await requireSession(["demo_operator"]);
  const scenarios = scenarioList();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Fixtures" crumbs={[{ label: "Simulators", href: "/demo/integrations" }, { label: "Fixtures" }]} description="Synthetic files for exercising evidence reading, review routes and the three demo scenarios." />
      <Banner tone="warning" title={SYNTHETIC_LABEL} className="mb-5">
        Every file here is generated from the demo&apos;s own configuration. Issuers are fictional; there are no government seals, signatures or real member IDs.
      </Banner>

      <div className="flex flex-col gap-5">
        <Section
          title={
            <span className="flex items-center gap-2">
              Scenario presets <SimTag />
            </span>
          }
          description="Three isolated snapshots of the same persona. Switching never resets or combines them; each keeps its own records and clock."
          bodyClassName=""
        >
          <Table label="Scenario presets">
            <THead>
              <tr>
                <Th>Scenario</Th>
                <Th>Clock starts</Th>
                <Th>Starting point</Th>
                <Th align="right">Fixtures</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className={s.id === scenarioId ? "bg-canvas" : ""}>
                  <Td>{s.title}</Td>
                  <Td className="tabular whitespace-nowrap">{fmtDate(s.start)}</Td>
                  <Td className="max-w-[520px] text-ink-2">{s.summary}</Td>
                  <Td align="right">{FIXTURES.filter((f) => f.scenario === s.id).length}</Td>
                  <Td>
                    <ScenarioSwitch id={s.id} title={s.title} current={s.id === scenarioId} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="Demo set: one happy path and one problem document per flow" description="Maya can download these herself on the Documents step of her request. The problem documents are ones the reading step surfaces for her and for HR." bodyClassName="">
          <Table label="Demo set">
            <THead>
              <tr>
                <Th>Flow</Th>
                <Th>Document</Th>
                <Th>Type</Th>
                <Th>What happens</Th>
                <Th>File</Th>
              </tr>
            </THead>
            <tbody>
              {(Object.keys(DEMO_SET) as (keyof typeof DEMO_SET)[]).flatMap((flow) =>
                DEMO_SET[flow].map((d) => (
                  <tr key={d.fixtureId}>
                    <Td className="capitalize">{flow === "loss" ? "Loss of other coverage" : flow}</Td>
                    <Td>{d.label}</Td>
                    <Td>
                      <StatusPill tone={d.kind === "happy" ? "green" : "amber"}>{d.kind === "happy" ? "Happy path" : "Problem document"}</StatusPill>
                    </Td>
                    <Td className="max-w-[420px] text-ink-2">{d.whatHappens}</Td>
                    <Td>
                      <a href={`/api/fixtures/${d.fixtureId}`} download className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download className="size-4" aria-hidden /> Download
                      </a>
                    </Td>
                  </tr>
                )),
              )}
            </tbody>
          </Table>
        </Section>

        <Section title="Evidence fixtures" description="Upload these as an employee to test how the product reads, confirms or routes each document." bodyClassName="">
          <Table label="Evidence fixtures">
            <THead>
              <tr>
                <Th>Fixture</Th>
                <Th>Scenario</Th>
                <Th>What it tests</Th>
                <Th>Expected behavior</Th>
                <Th>
                  <span className="sr-only">Download</span>
                </Th>
              </tr>
            </THead>
            <tbody>
              {FIXTURES.map((f) => (
                <tr key={f.id}>
                  <Td className="min-w-[220px]">
                    {f.title}
                    <p className="text-xs text-muted uppercase">{f.format}</p>
                  </Td>
                  <Td>
                    <Tag className="whitespace-nowrap">{SCENARIO_LABEL[f.scenario]}</Tag>
                  </Td>
                  <Td className="text-ink-2">{f.tests}</Td>
                  <Td className="max-w-[360px] text-ink-2">{f.expected}</Td>
                  <Td>
                    <a href={`/api/fixtures/${f.id}`} download className={buttonClass("outline", "sm")} aria-label={`Download ${f.title}`}>
                      <Download className="size-3.5" aria-hidden />
                      Download
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="Plan documents" description="Generated from the same plan and rule configuration the app calculates with. Figures are illustrative, not carrier pricing." bodyClassName="">
          <ul className="divide-y divide-divider">
            {PLAN_DOCS.map((d) => (
              <li key={d.kind} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{d.title}</p>
                  <p className="text-xs text-muted">{d.about}</p>
                </div>
                <a href={`/api/documents/${d.kind}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">
                  Open
                </a>
                <a href={`/api/documents/${d.kind}`} download className={buttonClass("outline", "sm")} aria-label={`Download ${d.title}`}>
                  <Download className="size-3.5" aria-hidden />
                  Download
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
