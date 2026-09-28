import { redirect } from "next/navigation";
import type { Role } from "@/lib/contracts/domain";
import { getSession, type Session } from "@/server/session";

/** Page guard: no session → entry page; wrong role → the role's home. Server-side only. */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/");
  if (roles && !roles.includes(s.user.role)) redirect(homeFor(s.user.role));
  return s;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "employee":
      return "/employee/benefits";
    case "hr_admin":
      return "/admin";
    case "broker":
      return "/broker/tasks";
    default:
      return "/demo/integrations";
  }
}
