import { createHash } from "node:crypto";
import type { CarrierBatch, CarrierTxn, ChangeOrder } from "@/lib/contracts/domain";
import { fmtDate } from "@/lib/dates";
import { plan, TIER_LABEL } from "@/server/config/plans";

// Illustrative 834 — not carrier-certified. A documented demo subset: ISA/GS/ST
// envelopes with control numbers, a BGN header, sponsor and payer N1 loops, one member
// loop per change order (INS, REF, NM1, DMG, HD, DTP) and SE/GE/IEA counts.
// No evidence or PDFs are ever packed into the payload.

export const EDI_LABEL = "Illustrative 834 — not carrier-certified";
const MAINT: Record<ChangeOrder["action"], string> = { add: "021", terminate: "024", tier_change: "001" };
const REL: Record<string, string> = { self: "18", spouse: "01", former_spouse: "01", child: "19" };
const LEVEL = { EE: "EMP", ES: "ESP", EC: "ECH", FAM: "FAM" } as const;
const d8 = (d: string | null) => (d ? d.replaceAll("-", "") : "");

export function build834(batch: Pick<CarrierBatch, "id" | "controlNumber" | "sentAt">, orders: ChangeOrder[]): string {
  const ctl = batch.controlNumber.padStart(9, "0");
  const date = batch.sentAt.slice(0, 10).replaceAll("-", "");
  const segs: string[] = [];
  segs.push(`ST*834*0001*005010X220A1`);
  segs.push(`BGN*00*${batch.id}*${date}*2200****2`);
  segs.push(`N1*P5*NEXA DEMO SPONSOR*FI*000000000`);
  segs.push(`N1*IN*AETNA-LABELED DEMO CARRIER*FI*000000000`);
  for (const o of orders) {
    const subscriber = o.relationship === "self" ? "Y" : "N";
    const [first, ...rest] = o.memberName.split(" ");
    segs.push(`INS*${subscriber}*${REL[o.relationship] ?? "19"}*${MAINT[o.action]}*XN*A***FT`);
    segs.push(`REF*0F*${o.subscriberId}`);
    segs.push(`REF*1L*${o.groupNumber}`);
    segs.push(`REF*ZZ*${o.operationKey}`);
    segs.push(`NM1*IL*1*${rest.join(" ").toUpperCase() || "UNKNOWN"}*${(first ?? "").toUpperCase()}`);
    if (o.dob) segs.push(`DMG*D8*${d8(o.dob)}`);
    segs.push(`HD*${MAINT[o.action]}**HLT*${o.planId.toUpperCase()}*${LEVEL[o.tier]}`);
    if (o.action === "terminate") segs.push(`DTP*349*D8*${d8(o.endDate)}`);
    else segs.push(`DTP*348*D8*${d8(o.startDate)}`);
  }
  segs.push(`SE*${segs.length + 1}*0001`);
  const body = segs.map((s) => `${s}~`).join("\n");
  return [
    `ISA*00*          *00*          *ZZ*NEXADEMO       *ZZ*AETNADEMO      *${date.slice(2)}*2200*^*00501*${ctl}*0*T*:~`,
    `GS*BE*NEXADEMO*AETNADEMO*${date}*2200*${Number(ctl)}*X*005010X220A1~`,
    body,
    `GE*1*${Number(ctl)}~`,
    `IEA*1*${ctl}~`,
  ].join("\n");
}

export function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Validates only the subset this demo implements. */
export function validate834(payload: string, expectedMembers: number): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const segs = payload.split("~").map((s) => s.trim()).filter(Boolean);
  const isa = segs.find((s) => s.startsWith("ISA"))?.split("*");
  const iea = segs.find((s) => s.startsWith("IEA"))?.split("*");
  if (!isa || !iea || isa[13] !== iea[2]) errors.push("ISA/IEA control numbers do not match.");
  const stIdx = segs.findIndex((s) => s.startsWith("ST*"));
  const seIdx = segs.findIndex((s) => s.startsWith("SE*"));
  const count = Number(segs[seIdx]?.split("*")[1]);
  if (count !== seIdx - stIdx + 1) errors.push(`SE count ${count} does not match ${seIdx - stIdx + 1} segments.`);
  const members = segs.filter((s) => s.startsWith("INS*")).length;
  if (members !== expectedMembers) errors.push(`Member loops ${members} ≠ change orders ${expectedMembers}.`);
  const hd = segs.filter((s) => s.startsWith("HD*")).length;
  const dtp = segs.filter((s) => s.startsWith("DTP*")).length;
  if (hd !== members || dtp !== members) errors.push("Each member loop needs one HD and one coverage date.");
  if (segs.some((s) => /DTP\*34[89]\*D8\*$/.test(s))) errors.push("A coverage date is missing.");
  return { ok: errors.length === 0, errors };
}

export function decodeOrder(o: ChangeOrder) {
  return {
    member: o.memberName,
    relationship: o.relationship,
    action: o.action === "add" ? "Add member" : o.action === "terminate" ? "End coverage" : "Change coverage level",
    plan: plan(o.planId).shortName,
    level: TIER_LABEL[o.tier],
    date: o.action === "terminate" ? `Ends ${fmtDate(o.endDate)}` : `Starts ${fmtDate(o.startDate)}`,
    operationKey: o.operationKey,
  };
}

export function txnSummaryLine(t: CarrierTxn): string {
  const d = decodeOrder(t.order);
  return `${d.member} — ${d.action}, ${d.plan} (${d.level}), ${d.date}`;
}
