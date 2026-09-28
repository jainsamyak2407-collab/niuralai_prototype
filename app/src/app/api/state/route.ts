import { getSession } from "@/server/session";
import { getStore } from "@/server/store/store";

export const dynamic = "force-dynamic";

// Lightweight revision probe for cross-screen updates (short polling + refetch on focus).
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  try {
    const s = await getStore().load(session.scenarioId);
    return Response.json({ ok: true, rev: s.rev, now: s.clock.businessNow, unread: s.outbox.filter((n) => n.recipientUserId === session.user.id && !n.readAt).length });
  } catch {
    return Response.json({ ok: false, message: "Saved data is unavailable." }, { status: 503 });
  }
}
