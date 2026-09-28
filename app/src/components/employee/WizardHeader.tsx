import { PageHeader, StatusPill, Stepper, type Tone } from "@/components/ui/primitives";
import { WIZARD_STEPS } from "./labels";

/** Page header and five-stage stepper shared by every wizard page. */
export function WizardHeader({ caseId, caseNumber, eventLabel, step, statusLabel, description }: { caseId: string; caseNumber: string; eventLabel: string; step: number; statusLabel: { label: string; tone: Tone }; description?: string }) {
  return (
    <>
      <PageHeader
        title={eventLabel}
        crumbs={[{ label: "Life events", href: "/employee/life-events" }, { label: caseNumber }]}
        description={description}
        actions={<StatusPill tone={statusLabel.tone}>{statusLabel.label}</StatusPill>}
      />
      <Stepper steps={WIZARD_STEPS(caseId)} current={step} />
    </>
  );
}
