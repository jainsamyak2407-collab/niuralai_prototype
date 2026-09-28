import Image from "next/image";
import { EntryClient } from "./EntryClient";
import { getSession } from "@/server/session";
import { SCENARIO_META } from "@/server/domain/seed";

export const dynamic = "force-dynamic";

// Compact product entry: purpose, role entries and scenario selection. Not a marketing page.
export default async function Entry() {
  const session = await getSession();
  const scenarios = (Object.keys(SCENARIO_META) as (keyof typeof SCENARIO_META)[]).map((id) => ({ id, ...SCENARIO_META[id] }));
  return (
    <div className="flex min-h-dvh flex-col bg-backdrop">
      <header className="flex h-[60px] items-center gap-3 bg-surface px-4">
        <Image src="/niural-logo.svg" alt="Niural AI" width={89} height={24} priority />
        <span className="h-6 w-px bg-line" aria-hidden />
        <span className="text-sm text-ink">Life events</span>
        <span className="ml-auto rounded-full border border-line px-2.5 py-1 text-xs text-muted">Synthetic data · Demo environment</span>
      </header>
      <div className="flex flex-1 px-3 pt-3">
        <main id="main" className="flex-1 rounded-t-[16px] bg-surface px-6 py-10">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-[22px] font-medium text-ink">Qualifying life events for Nexa</h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-2">
              One case from the employee&apos;s request through HR&apos;s decision, the carrier&apos;s record and the posted payroll. The right people get the right coverage dates and the right deductions, with a named owner whenever something goes wrong.
            </p>
            <EntryClient scenarios={scenarios} currentScenario={session?.scenarioId ?? "birth"} currentUser={session?.user.id ?? null} />
            <p className="mt-10 max-w-3xl text-xs text-muted">
              Demo sessions pick from predefined fictional identities; the server signs the session and decides the role. This is not production sign-in. Carrier delivery, payroll runs, COBRA administration and email are simulated and labeled. All people, documents, rates and plans are synthetic and not valid for enrollment.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
