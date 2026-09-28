import type { DocumentKind } from "@/lib/contracts/documents";
import { DomainError } from "@/server/domain/ctx";
import { apiError, fileResponse, sessionFor } from "@/server/docs/http";
import { benefitsGuide, contributions, electionRules, payrollPolicy, planSummary } from "@/server/docs/plans";
import { acaHistory, approvalSummary, carrierResult, cobraReferral, type DocFile, edi834, ediSummary, electionStatement, payrollStatement, payslipDoc, receipt } from "@/server/docs/records";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/documents/{kind}?caseId=&batchId=&runId=&referralId=
// Every file is generated on request from the same config and state the app uses and is
// labeled SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT. Roles are enforced server-side.

const PLAN_DOCS: Partial<Record<DocumentKind, [() => Promise<Uint8Array>, string]>> = {
  doc_benefits_guide: [benefitsGuide, "nexa-benefits-guide.pdf"],
  doc_election_rules: [electionRules, "nexa-election-rules.pdf"],
  doc_contributions: [contributions, "nexa-contribution-schedule.pdf"],
  doc_payroll_policy: [payrollPolicy, "nexa-payroll-policy.pdf"],
  doc_medical_standard: [() => planSummary("doc_medical_standard"), "aetna-standard-medical-illustrative.pdf"],
  doc_medical_plus: [() => planSummary("doc_medical_plus"), "aetna-plus-medical-illustrative.pdf"],
  doc_dental_vision: [() => planSummary("doc_dental_vision"), "nexa-dental-vision-illustrative.pdf"],
};

const planCache = new Map<string, Promise<Uint8Array>>();

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await sessionFor();
  if ("error" in auth) return auth.error;
  const { user, scenarioId } = auth.session;
  const { kind } = await params;
  const q = new URL(req.url).searchParams;
  const id = (k: string) => {
    const v = q.get(k);
    return v && /^[\w-]{1,80}$/.test(v) ? v : null;
  };
  const inline = q.get("inline") === "1";
  try {
    const plan = PLAN_DOCS[kind as DocumentKind];
    if (plan) {
      const [make, fileName] = plan;
      let bytes = planCache.get(kind);
      if (!bytes) {
        bytes = make();
        planCache.set(kind, bytes);
        bytes.catch(() => planCache.delete(kind));
      }
      return fileResponse(await bytes, "application/pdf", fileName, inline ? "inline" : "attachment");
    }
    let f: DocFile;
    switch (kind as DocumentKind) {
      case "doc_election_statement":
        f = await electionStatement(user, scenarioId);
        break;
      case "receipt":
        f = await receipt(user, scenarioId, id("caseId"));
        break;
      case "approval":
        f = await approvalSummary(user, scenarioId, id("caseId"));
        break;
      case "carrier_result":
        f = await carrierResult(user, scenarioId, id("caseId"));
        break;
      case "payroll_statement":
        f = await payrollStatement(user, scenarioId, id("caseId"));
        break;
      case "edi_834":
        f = await edi834(user, scenarioId, id("batchId"));
        break;
      case "edi_summary":
        f = await ediSummary(user, scenarioId, id("batchId"));
        break;
      case "payslip":
        f = await payslipDoc(user, scenarioId, id("runId"));
        break;
      case "cobra_referral":
        f = await cobraReferral(user, scenarioId, id("referralId"));
        break;
      case "aca_history":
        f = await acaHistory(user, scenarioId);
        break;
      default:
        return apiError(404, "document_not_found", "We could not find that document.");
    }
    return fileResponse(f.bytes, f.contentType, f.fileName, inline && f.contentType === "application/pdf" ? "inline" : "attachment");
  } catch (e) {
    if (e instanceof DomainError) return apiError(e.status, e.code, e.message, e.nextAction);
    console.error("document generation failed", kind, (e as Error).name);
    return apiError(500, "document_failed", "We could not generate this document. Try again.", "Try again.");
  }
}
