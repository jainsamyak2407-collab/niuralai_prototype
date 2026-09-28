import { z } from "zod";
import { USERS } from "@/server/config/identities";
import { cookieOptions, getSession, SESSION_COOKIE, signSession } from "@/server/session";
import { homeFor } from "@/server/guard";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Only predefined synthetic identities can be selected. Role and employer come from
// the server-side user record, never from the request.
const body = z.object({ userId: z.enum(USERS.map((u) => u.id) as [string, ...string[]]), scenarioId: z.enum(["birth", "divorce", "loss"]).optional() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, code: "unknown_identity", message: "Choose one of the demo identities." }, { status: 400 });
  const current = await getSession();
  const scenario = parsed.data.scenarioId ?? current?.scenarioId ?? "birth";
  const user = USERS.find((u) => u.id === parsed.data.userId)!;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(user.id, scenario), cookieOptions);
  return Response.json({ ok: true, redirect: homeFor(user.role), user: { id: user.id, name: user.name, role: user.role } });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true, redirect: "/" });
}
