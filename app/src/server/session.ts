import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { DemoUser, ScenarioId } from "@/lib/contracts/domain";
import { SCENARIO_IDS } from "@/lib/contracts/domain";
import { userById } from "@/server/config/identities";

// Signed demo session. The server chooses the identity from a fixed list of synthetic
// users and signs it; role and employer always come from the server-side user record,
// never from the browser. Demo access is not production identity security.

export const SESSION_COOKIE = "qle_demo_session";

function key(): Buffer {
  const secret = process.env.DEMO_SESSION_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Session signing is not configured.");
  // Domain-separated derivation so the storage key is never used directly.
  return createHmac("sha256", "qle-demo-session-v1").update(secret).digest();
}

export interface Session {
  user: DemoUser;
  scenarioId: ScenarioId;
}

export function signSession(userId: string, scenarioId: ScenarioId): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, s: scenarioId, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", key()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", key()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; s: ScenarioId; t: number };
    const user = userById(data.u);
    if (!user || !SCENARIO_IDS.includes(data.s)) return null;
    if (Date.now() - data.t > 1000 * 60 * 60 * 24 * 7) return null;
    return { user, scenarioId: data.s };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 };
