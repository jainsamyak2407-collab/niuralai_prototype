import { Banner } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { DetailsForm } from "@/components/employee/DetailsForm";
import { WizardHeader } from "@/components/employee/WizardHeader";
import { loadWizardCase } from "@/components/employee/server";

export default async function DetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await loadWizardCase(id);
  const me = v.household.find((p) => p.relationship === "self");
  const coveredNames = [...new Set(v.currentElections.flatMap((e) => e.covered))];
  return (
    <div className="mx-auto max-w-5xl">
      <WizardHeader caseId={id} caseNumber={v.case.caseNumber} eventLabel={v.case.eventLabel} step={0} statusLabel={v.case.statusLabel} description="Answer a few questions about what happened. Your answers save as you go." />
      {v.case.status === "needs_information" ? (
        <Banner
          tone="warning"
          className="mb-5"
          title="HR asked you for information"
          action={
            <ButtonLink href={`/employee/cases/${id}#requests`} variant="outline" size="sm">
              Open the request
            </ButtonLink>
          }
        >
          Changes you save here are added to your request as a new version. Reply to HR from your request tracker when you are done.
        </Banner>
      ) : null}
      <DetailsForm
        key={v.case.eventCode === "adoption" || v.case.eventCode === "placement_for_adoption" ? "adoption" : v.case.eventCode}
        caseId={id}
        version={v.case.version}
        eventCode={v.case.eventCode}
        facts={v.case.facts}
        household={v.household}
        coveredNames={coveredNames}
        lossReasons={v.lossReasons}
        timing={v.evaluation.timing}
        lastName={me?.name.split(" ").slice(1).join(" ") ?? ""}
      />
    </div>
  );
}
