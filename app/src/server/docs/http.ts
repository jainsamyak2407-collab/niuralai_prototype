import type { Role } from "@/lib/contracts/domain";
import { getSession, type Session } from "@/server/session";

// Shared response helpers for the backend-owned routes. Plain messages, safe codes,
// no stack traces or secret values.

export function apiError(status: number, code: string, message: string, nextAction?: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, code, message, ...(nextAction ? { nextAction } : {}), ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export async function sessionFor(roles?: Role[]): Promise<{ session: Session } | { error: Response }> {
  const session = await getSession();
  if (!session) return { error: apiError(401, "unauthenticated", "Your demo session ended. Choose a role to continue.", "Sign in again from the start page.") };
  if (roles && !roles.includes(session.user.role)) return { error: apiError(403, "forbidden", "Your role cannot open this.", "Switch to a role that has access.") };
  return { session };
}

/** ASCII-safe download filename. Never derived from user text without cleaning. */
export function safeFileName(name: string, fallback = "document"): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 100);
  return cleaned || fallback;
}

export function fileResponse(bytes: Uint8Array, contentType: string, fileName: string, disposition: "inline" | "attachment" = "attachment", extra: Record<string, string> = {}) {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${disposition}; filename="${safeFileName(fileName)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}
