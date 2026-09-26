import { AppShell } from "@/components/shell/app-shell";
import { ReadinessDashboard } from "@/components/readiness/readiness-dashboard";

export default function Page() {
  return (
    <AppShell>
      <ReadinessDashboard />
    </AppShell>
  );
}
