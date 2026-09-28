import { CarrierInbox } from "@/components/demo/CarrierInbox";
import { CobraSim } from "@/components/demo/CobraSim";
import { caseNumbers, carrierNames, personNames, planOptions } from "@/components/demo/data";
import { DemoControls } from "@/components/demo/DemoControls";
import { ROLE_LABEL } from "@/components/demo/labels";
import { ManualTasks } from "@/components/demo/ManualTasks";
import { PayrollSim } from "@/components/demo/PayrollSim";
import { SimBanner, type SimTabDef, SimTabs } from "@/components/demo/SimFrame";
import { PageHeader } from "@/components/ui/primitives";
import { requireSession } from "@/server/guard";
import { integrationsView } from "@/server/views";

export const metadata = { title: "External systems simulator" };

type TabId = "carrier" | "manual" | "payroll" | "cobra" | "controls";

export default async function IntegrationsSimulatorPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, scenarioId } = await requireSession(["demo_operator", "carrier_operator", "cobra_admin"]);
  const [{ tab: raw }, v] = await Promise.all([searchParams, integrationsView(user, scenarioId)]);

  // Only tabs the role can use. The view returns null for everything else.
  const tabs: (SimTabDef & { id: TabId })[] = [];
  if (v.carrier) {
    const open = v.carrier.queued.length + v.carrier.batches.filter((b) => b.transport !== "received" || b.fileValidation === "pending" || b.txns.some((t) => !t.superseded && (t.memberResult === "pending" || t.memberResult === "info_requested"))).length;
    tabs.push({ id: "carrier", label: "Carrier inbox", count: open });
  }
  if (v.manual) tabs.push({ id: "manual", label: "Broker and manual tasks", count: v.manual.filter((t) => t.status === "open").length });
  if (v.payroll) tabs.push({ id: "payroll", label: "Payroll simulator", count: v.payroll.instructions.filter((i) => i.state === "scheduled").length });
  if (v.cobra) tabs.push({ id: "cobra", label: "COBRA simulator", count: v.cobra.filter((r) => r.state === "sent").length });
  if (v.outbox) tabs.push({ id: "controls", label: "Email outbox and demo controls" });
  const tab: TabId = (tabs.find((t) => t.id === raw)?.id ?? tabs[0]?.id ?? "carrier") as TabId;

  const plans = planOptions();
  const needCases = tab === "controls" && v.outbox;
  const cases = needCases ? await caseNumbers(scenarioId) : {};
  const names = v.outbox || v.audit ? personNames([...(v.outbox ?? []).map((n) => n.recipientUserId), ...(v.audit ?? []).map((a) => a.actor)]) : {};

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={user.role === "cobra_admin" ? "Referral inbox" : user.role === "carrier_operator" ? "Carrier inbox" : "External systems simulator"}
        crumbs={[{ label: "Simulators" }, { label: tabs.find((t) => t.id === tab)?.label ?? "Simulator" }]}
      />
      <SimBanner scenarioTitle={v.scenario.title} now={v.now} roleLabel={ROLE_LABEL[user.role] ?? user.role} />
      {tabs.length > 1 ? <SimTabs tabs={tabs} active={tab} base="/demo/integrations" /> : null}

      {tab === "carrier" && v.carrier ? <CarrierInbox data={v.carrier} nextBatchAt={v.nextBatchAt} plans={plans} carriers={carrierNames()} /> : null}
      {tab === "manual" && v.manual ? <ManualTasks rows={v.manual} now={v.now} /> : null}
      {tab === "payroll" && v.payroll ? <PayrollSim data={v.payroll} /> : null}
      {tab === "cobra" && v.cobra ? <CobraSim rows={v.cobra} plans={plans} isAdmin={user.role === "cobra_admin"} /> : null}
      {tab === "controls" && v.outbox && v.audit && v.preset !== null ? (
        <DemoControls now={v.now} nextBatchAt={v.nextBatchAt} preset={v.preset} store={v.store} scenario={v.scenario} outbox={v.outbox} audit={v.audit} names={names} cases={cases} />
      ) : null}
    </div>
  );
}
