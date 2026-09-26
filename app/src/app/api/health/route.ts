// Checks that the runtime keys work. Returns pass or fail only, never key values.
export const dynamic = "force-dynamic";

async function check(run: () => Promise<Response>) {
  try {
    const res = await run();
    return res.ok ? "ok" : `http ${res.status}`;
  } catch (error) {
    return `error ${(error as Error).message}`;
  }
}

export async function GET() {
  const env = process.env;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const [supabaseSecret, supabasePublishable, anthropic] = await Promise.all([
    check(() =>
      fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: env.SUPABASE_SECRET_KEY ?? "", Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
      }),
    ),
    check(() =>
      fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      }),
    ),
    check(() =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.APP_ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }),
      }),
    ),
  ]);
  const ok = [supabaseSecret, supabasePublishable, anthropic].every((r) => r === "ok");
  return Response.json({ ok, supabaseSecret, supabasePublishable, anthropic, model: env.AI_MODEL }, { status: ok ? 200 : 503 });
}
