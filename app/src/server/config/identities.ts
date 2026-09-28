import type { DemoUser } from "@/lib/contracts/domain";

// Predefined synthetic demo identities. The demo selector can choose only these.
// Demo access is not production identity security.
export const PARTNER_ID = "partner_demo_platform";
export const NEXA = { id: "emp_nexa", name: "Nexa", tz: "America/New_York", sponsor: "Private employer", funding: "Fully insured", policyState: "NY" };
export const ORBIT = { id: "emp_orbit", name: "Orbit Labs" };

export const USERS: DemoUser[] = [
  { id: "u_maya", name: "Maya Shah", email: "maya@nexa.example", role: "employee", title: "Senior Product Designer, Nexa", partnerId: PARTNER_ID, employerId: NEXA.id, personId: "p_maya" },
  { id: "u_daniel", name: "Daniel Brooks", email: "daniel@nexa.example", role: "hr_admin", title: "HR and payroll administrator, Nexa", partnerId: PARTNER_ID, employerId: NEXA.id },
  { id: "u_priya", name: "Priya Patel", email: "priya@broker.example", role: "broker", title: "Benefits broker (assigned tasks only)", partnerId: PARTNER_ID, employerId: null },
  { id: "u_carrier", name: "Carrier operator", email: "carrier@demo.example", role: "carrier_operator", title: "Simulated carrier inbox", partnerId: PARTNER_ID, employerId: null },
  { id: "u_cobra", name: "Continuation administrator", email: "cobra@demo.example", role: "cobra_admin", title: "Simulated COBRA administrator (assigned referrals only)", partnerId: PARTNER_ID, employerId: null },
  { id: "u_ops", name: "Demo operator", email: "ops@demo.example", role: "demo_operator", title: "Runs the external-system simulators", partnerId: PARTNER_ID, employerId: null },
];

// Accountable people who appear as owners but have no demo sign-in.
export const OWNERS: Record<string, { name: string; role: string }> = {
  u_daniel: { name: "Daniel Brooks", role: "HR and payroll administrator" },
  u_rosa: { name: "Rosa Alvarez", role: "HR backup" },
  u_priya: { name: "Priya Patel", role: "Broker" },
  u_maya: { name: "Maya Shah", role: "Employee" },
  u_partner_ops: { name: "Platform operations queue", role: "Partner escalation" },
  u_specialist: { name: "Benefits specialist (synthetic)", role: "Plan administrator review" },
  u_cobra: { name: "Continuation administrator", role: "COBRA TPA (simulated)" },
  u_carrier: { name: "Carrier operator", role: "Carrier (simulated)" },
  u_payroll: { name: "Payroll simulator", role: "Host payroll (simulated)" },
  system: { name: "System", role: "Automated" },
  system_rules: { name: "Rules engine (straight-through)", role: "Automated policy" },
  u_bg_employee: { name: "Employee (background case)", role: "Employee" },
  u_orbit_hr: { name: "Orbit Labs HR", role: "Other employer" },
};

export function userById(id: string): DemoUser | undefined {
  return USERS.find((u) => u.id === id);
}
export function ownerName(id: string): string {
  return OWNERS[id]?.name ?? userById(id)?.name ?? id;
}
