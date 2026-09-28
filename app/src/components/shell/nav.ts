import type { Role } from "@/lib/contracts/domain";

export type IconName = "shield" | "sparkle" | "wallet" | "file" | "layout" | "list" | "banknote" | "plug" | "history" | "inbox" | "clipboard" | "flask";
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match?: string; // path prefix for active state
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}
export interface Module {
  label: string;
  href: string;
  icon: IconName;
  title: string; // sidebar module title
  groups: NavGroup[];
}

export const MODULES: Record<Role, Module[]> = {
  employee: [
    {
      label: "Benefits",
      href: "/employee/benefits",
      icon: "shield",
      title: "Benefits",
      groups: [
        { label: "My benefits", items: [
          { href: "/employee/benefits", label: "Benefits", icon: "shield" },
          { href: "/employee/life-events", label: "Life events", icon: "sparkle", match: "/employee/life-events|/employee/cases" },
        ] },
        { label: "Pay", items: [{ href: "/employee/pay", label: "Pay", icon: "wallet" }] },
        { label: "Records", items: [{ href: "/employee/documents", label: "Documents", icon: "file" }] },
      ],
    },
  ],
  hr_admin: [
    {
      label: "Benefits admin",
      href: "/admin",
      icon: "shield",
      title: "Benefits admin",
      groups: [
        { label: "Life events", items: [
          { href: "/admin", label: "Overview", icon: "layout", match: "^/admin$" },
          { href: "/admin/qle", label: "Life events", icon: "list", match: "/admin/qle" },
        ] },
        { label: "Payroll", items: [{ href: "/admin/payroll", label: "Payroll changes", icon: "banknote" }] },
        { label: "Operations", items: [
          { href: "/admin/integrations", label: "Integrations", icon: "plug" },
          { href: "/admin/audit", label: "Audit", icon: "history" },
        ] },
      ],
    },
  ],
  broker: [
    { label: "Assigned tasks", href: "/broker/tasks", icon: "clipboard", title: "Broker", groups: [{ label: "Assigned", items: [{ href: "/broker/tasks", label: "Tasks", icon: "clipboard", match: "/broker/tasks" }] }] },
  ],
  carrier_operator: [
    { label: "Simulators", href: "/demo/integrations", icon: "plug", title: "External systems", groups: [{ label: "Simulated", items: [{ href: "/demo/integrations", label: "Carrier inbox", icon: "inbox" }] }] },
  ],
  cobra_admin: [
    { label: "Simulators", href: "/demo/integrations", icon: "plug", title: "External systems", groups: [{ label: "Simulated", items: [{ href: "/demo/integrations", label: "Referral inbox", icon: "inbox" }] }] },
  ],
  demo_operator: [
    {
      label: "Simulators",
      href: "/demo/integrations",
      icon: "plug",
      title: "External systems",
      groups: [
        { label: "Simulated", items: [
          { href: "/demo/integrations", label: "Simulators", icon: "inbox" },
          { href: "/demo/fixtures", label: "Fixtures", icon: "flask" },
        ] },
      ],
    },
  ],
};
