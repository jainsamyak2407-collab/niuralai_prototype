import { z } from "zod";
import { cookies } from "next/headers";
import { userById } from "@/server/config/identities";
import { resetScenario } from "@/server/demo-reset";
import { homeFor } from "@/server/guard";
import { cookieOptions, getSession, SESSION_COOKIE, signSession } from "@/server/session";

export const dynamic = "force-dynamic";

const scenario = z.enum(["birth", "divorce", "loss"]);
const body = z.object({
  scenarios: z.array(scenario).min(1).max(3),
  autopilot: z.boolean(),
  openScenario: scenario,
  // Any demo identity can already be chosen on the entry page, so switching here grants nothing new.
  continueAs: z.enum(["keep", "u_maya", "u_daniel", "u_ops"]),
});

const TITLE = { birth: "Birth", divorce: "Divorce", loss: "Loss of other coverage" } as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Choose a role first." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, message: "Choose at least one scenario to reset." }, { status: 400 });
  const { scenarios, autopilot, openScenario, continueAs } = parsed.data;
  const done: string[] = [];
  try {
    for (const id of [...new Set(scenarios)]) {
      await resetScenario(id, { autopilot, by: session.user.name });
      done.push(TITLE[id]);
    }
  } catch {
    const partial = done.length ? ` ${done.join(", ")} ${done.length > 1 ? "were" : "was"} reset.` : "";
    return Response.json({ ok: false, message: `We could not finish the reset.${partial} Try again.` }, { status: 503 });
  }
  const user = continueAs === "keep" ? session.user : userById(continueAs)!;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(user.id, openScenario), cookieOptions);
  return Response.json({
    ok: true,
    message: `${done.join(", ")} reset. Autopilot ${autopilot ? "on" : "off"}. Opening ${TITLE[openScenario]} as ${user.name}.`,
    redirect: homeFor(user.role),
  });
}
