import { getSession } from "@/server/session";
import { notificationsView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Choose a role first." }, { status: 401 });
  return Response.json({ ok: true, notifications: await notificationsView(session.user, session.scenarioId) });
}
