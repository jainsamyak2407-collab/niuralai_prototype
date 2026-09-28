import { z } from "zod";
import { cookies } from "next/headers";
import { cookieOptions, getSession, SESSION_COOKIE, signSession } from "@/server/session";

export const dynamic = "force-dynamic";
const body = z.object({ scenarioId: z.enum(["birth", "divorce", "loss"]) });

// Switching scenarios never resets or combines them; each keeps its own records and clock.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Choose a role first." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, message: "Choose birth, divorce or loss." }, { status: 400 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(session.user.id, parsed.data.scenarioId), cookieOptions);
  return Response.json({ ok: true });
}
