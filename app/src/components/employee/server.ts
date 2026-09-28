import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/server/guard";
import { DomainError } from "@/server/domain/ctx";
import { employeeView } from "@/server/views";

/** Load the signed-in employee's case, or show 404 when it is not theirs. */
export async function loadEmployeeCase(caseId: string) {
  const { user, scenarioId } = await requireSession(["employee"]);
  try {
    return await employeeView(user, scenarioId, caseId);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }
}

/** Wizard pages only edit open drafts; anything already with HR goes to the tracker. */
export async function loadWizardCase(caseId: string) {
  const v = await loadEmployeeCase(caseId);
  if (!["draft", "needs_information"].includes(v.case.status)) redirect(`/employee/cases/${caseId}`);
  return v;
}
