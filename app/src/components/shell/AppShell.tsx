import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Session } from "@/server/session";
import { MODULES } from "./nav";
import { NavIcon } from "./icons";
import { AccountMenu, EmmaButton, LiveRefresh, NotificationsMenu, ScenarioChip, Sidebar, TopNav } from "./ShellClient";
import { EmmaDock, EmmaProvider } from "@/components/emma/EmmaDock";
import { loadState } from "@/server/views";
import { SCENARIO_META } from "@/server/domain/seed";

// Host shell: white top bar (logo, module pills, scenario chip, AI pill, icon buttons,
// avatar), a thin #A78BFF strip, then a white rounded workspace with the lavender
// sidebar. This simulates the trusted host boundary: the QLE module is embedded here.
export async function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const modules = MODULES[session.user.role];
  const s = await loadState(session.scenarioId);
  const emma = session.user.role === "employee" || session.user.role === "hr_admin";
  return (
    <EmmaProvider enabled={emma}>
      <div className="flex min-h-dvh flex-col bg-backdrop">
        <header className="flex h-[60px] shrink-0 items-center gap-3 bg-surface px-4">
          <Link href="/" className="flex items-center gap-2 pr-3" aria-label="Demo entry">
            <Image src="/niural-logo.svg" alt="Niural AI" width={89} height={24} priority />
          </Link>
          <span className="h-6 w-px bg-line" aria-hidden />
          <TopNav modules={modules.map((m) => ({ label: m.label, href: m.href, icon: m.icon }))} />
          <div className="ml-auto flex items-center gap-2">
            <ScenarioChip scenarioId={session.scenarioId} title={SCENARIO_META[session.scenarioId].title} now={s.clock.businessNow} />
            {emma ? <EmmaButton /> : null}
            <NotificationsMenu />
            <span className="mx-1 h-6 w-px bg-line" aria-hidden />
            <AccountMenu name={session.user.name} email={session.user.email} title={session.user.title} role={session.user.role} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 px-3 pt-3">
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-t-[16px] bg-surface">
            <Sidebar module={modules[0]} />
            <main id="main" className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
              {children}
            </main>
            {emma ? <EmmaDock role={session.user.role} /> : null}
          </div>
        </div>
        <LiveRefresh />
      </div>
    </EmmaProvider>
  );
}

export { NavIcon };
