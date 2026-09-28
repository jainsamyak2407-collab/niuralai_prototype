import { getSession } from "@/server/session";
import { runCommand } from "@/server/runner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, code: "unauthenticated", message: "Your demo session ended. Choose a role to continue." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ ok: false, code: "invalid_json", message: "The request could not be read." }, { status: 400 });
  const out = await runCommand(session.user, session.scenarioId, body);
  return Response.json(out.body, { status: out.status });
}
