import { type EmmaApiResult, emmaRequest } from "@/lib/contracts/ai";
import { askEmma } from "@/server/ai/emma";
import { aiLog, type Ctx } from "@/server/domain/ctx";
import { sessionFor } from "@/server/docs/http";
import { mutate } from "@/server/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/emma {question, caseId?, page?} → EmmaApiResult.
// Grounded, cited, schema-validated. Never changes records; the AI activity entry holds
// metadata only (no question or prompt text).

function fail(status: number, message: string): Response {
  const body: EmmaApiResult = { ok: false, mode: "fallback", model: null, response: null, message };
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const auth = await sessionFor();
  if ("error" in auth) return fail(401, "Your demo session ended. Choose a role to continue.");
  const { user, scenarioId } = auth.session;
  const parsed = emmaRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "Ask a question between 2 and 600 characters.");
  const q = parsed.data;
  if (q.caseId && !/^[\w-]{1,80}$/.test(q.caseId)) return fail(400, "That request reference is not valid.");

  let out;
  try {
    out = await askEmma(user, scenarioId, q);
  } catch {
    return fail(503, "Emma is unavailable right now. Your request and forms still work. Try again, or ask HR.");
  }
  // Record the activity; an audit-log failure never hides the answer.
  await mutate(scenarioId, (s) => {
    const ctx: Ctx = { s, actor: user, real: new Date().toISOString() };
    aiLog(ctx, {
      caseId: out.caseId,
      kind: out.logKind,
      label: out.logKind === "emma_answer" ? "Emma answered a question" : "Emma AI unavailable",
      detail: out.logDetail,
      model: out.result.mode === "model" ? out.result.model : null,
    });
  }).catch(() => null);
  return Response.json(out.result, { headers: { "cache-control": "no-store" } });
}
