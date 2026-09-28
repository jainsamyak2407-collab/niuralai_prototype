import { ArrowLeft, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/primitives";
import { EvidenceList } from "@/components/employee/EvidenceList";
import { EvidencePending } from "@/components/employee/EvidencePending";
import { EvidenceUploader } from "@/components/employee/EvidenceUploader";
import { DemoDocuments } from "@/components/employee/DemoDocuments";
import { WizardHeader } from "@/components/employee/WizardHeader";
import { loadWizardCase } from "@/components/employee/server";

const WHAT: Record<string, string> = {
  birth: "A hospital record or birth certificate showing your child's name and date of birth.",
  adoption: "The adoption decree or court summary showing the adoption date.",
  placement_for_adoption: "The placement agreement showing the date the child was placed with you.",
  divorce: "The divorce decree or a court summary showing the date it became final.",
  loss_of_other_coverage: "A letter from the other plan or employer that names who was covered and the date coverage ends.",
};

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await loadWizardCase(id);
  const files = v.evidence.filter((f) => !f.taskId);
  const check = v.evaluation.checks.find((k) => k.id === "evidence");
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <WizardHeader caseId={id} caseNumber={v.case.caseNumber} eventLabel={v.case.eventLabel} step={1} statusLabel={v.case.statusLabel} description="Add a document that shows what happened. You confirm what we read from it before HR sees it." />

      <Section title="Upload a document" description={WHAT[v.case.eventCode] ?? "Any document that shows what changed and when. HR will tell you if something else is needed."}>
        <EvidenceUploader caseId={id} />
        <DemoDocuments eventCode={v.case.eventCode} />
      </Section>

      <Section title="Your documents" description={check ? check.reason : undefined}>
        <EvidenceList caseId={id} version={v.case.version} files={files} emptyText="No documents yet. Upload one above, or tell us it is not available yet." />
      </Section>

      <Section title="Don't have it yet?">
        <EvidencePending caseId={id} version={v.case.version} note={v.case.evidencePendingNote} />
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t border-divider pt-4 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink href={`/employee/life-events/${id}/details`} variant="ghost">
          <ArrowLeft className="size-4" aria-hidden /> Back to what happened
        </ButtonLink>
        <ButtonLink href={`/employee/life-events/${id}/options`}>
          Continue to benefit changes <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}
