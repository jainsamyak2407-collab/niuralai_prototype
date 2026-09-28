import { AppShell } from "@/components/shell/AppShell";
import { requireSession } from "@/server/guard";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
