import {
  Building2,
  CalendarCheck,
  ChartLine,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  Headset,
  History,
  ArrowLeftRight,
  Puzzle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Receipt,
  Banknote,
  type LucideIcon,
} from "lucide-react";

const MODULES: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "People", icon: Users },
  { label: "Payments", icon: Banknote, active: true },
  { label: "Niural Pay", icon: Shield },
  { label: "Organization", icon: Building2 },
  { label: "Niural Insights", icon: ChartLine },
  { label: "Integrations", icon: Puzzle },
];

const SIDEBAR: { group?: string; items: { label: string; icon: LucideIcon; active?: boolean }[] }[] = [
  {
    items: [
      { label: "Payroll", icon: Receipt },
      { label: "Payroll Readiness", icon: ClipboardCheck, active: true },
      { label: "Invoices", icon: FileText },
    ],
  },
  { group: "Configuration", items: [{ label: "Payroll Schedule", icon: CalendarCheck }] },
  {
    group: "History",
    items: [
      { label: "Transactions", icon: ArrowLeftRight },
      { label: "Payroll History", icon: History },
    ],
  },
];

function RoundIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-line text-ink hover:bg-fill"
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[60px] shrink-0 items-center gap-3 bg-surface px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="niural-logo.svg" alt="Niural" className="h-6 w-auto" />
        <span className="h-6 w-px bg-divider" aria-hidden />
        <nav aria-label="Modules" className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {MODULES.map(({ label, icon: Icon, active }) => (
            <a
              key={label}
              href="#"
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm ${
                active ? "bg-primary-soft text-primary-strong" : "text-ink hover:bg-fill"
              }`}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-sm lg:flex"
          >
            <Wallet className="size-4 text-success" strokeWidth={1.75} />
            <span className="tabular text-success-text">USD 28,043.34</span>
            <ChevronsUpDown className="size-3.5 text-muted" />
          </button>
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-primary lg:flex"
          >
            <Sparkles className="size-4" strokeWidth={1.75} />
            Niural AI
          </button>
          <RoundIcon icon={Search} label="Search" />
          <RoundIcon icon={Headset} label="Support" />
          <span className="h-6 w-px bg-divider" aria-hidden />
          <span
            className="grid size-9 place-items-center rounded-full bg-accent-pink text-sm font-medium text-white"
            aria-label="Signed in as Alex Carter"
          >
            AC
          </span>
        </div>
      </header>
      <div className="h-3 shrink-0 bg-backdrop" aria-hidden />
      <div className="mx-3 flex min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-surface">
        <aside className="hidden w-[232px] shrink-0 flex-col bg-gradient-to-b from-sidebar-top via-sidebar-mid to-surface px-4 py-6 md:flex">
          <p className="px-2 text-lg font-semibold">Payments</p>
          <p className="mt-1 px-2 text-xs text-muted">Northwind Group · 6 entities</p>
          <nav aria-label="Payments" className="mt-6 flex flex-1 flex-col gap-6">
            {SIDEBAR.map((section, i) => (
              <div key={section.group ?? i}>
                {section.group && (
                  <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted">
                    {section.group}
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {section.items.map(({ label, icon: Icon, active }) => (
                    <li key={label}>
                      <a
                        href="#"
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${
                          active
                            ? "border border-primary-soft bg-surface text-primary-strong"
                            : "border border-transparent text-ink hover:bg-surface/60"
                        }`}
                      >
                        <Icon className="size-4" strokeWidth={1.75} />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-auto">
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted">
                Configurations
              </p>
              <a href="#" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm">
                <Settings className="size-4" strokeWidth={1.75} />
                Settings
              </a>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
