import type { IntegrationsView } from "@/server/views";

// Row shapes derived from the lead's read model. Never redefined by hand.
export type CarrierData = NonNullable<IntegrationsView["carrier"]>;
export type TxnRow = CarrierData["queued"][number];
export type BatchRow = CarrierData["batches"][number];
export type RosterRow = CarrierData["roster"][number];
export type PayrollData = NonNullable<IntegrationsView["payroll"]>;
export type InstructionRow = PayrollData["instructions"][number];
export type RunRow = PayrollData["runs"][number];
export type CobraRow = NonNullable<IntegrationsView["cobra"]>[number];
export type ManualRow = NonNullable<IntegrationsView["manual"]>[number];
export type OutboxRow = NonNullable<IntegrationsView["outbox"]>[number];
export type AuditRow = NonNullable<IntegrationsView["audit"]>[number];
