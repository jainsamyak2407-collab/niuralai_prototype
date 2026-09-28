import { getSession } from "@/server/session";
import { employeeView, hrCaseView } from "@/server/views";
import { DomainError } from "@/server/domain/ctx";

export const dynamic = "force-dynamic";

// Role-filtered case projection. Employees get the employee view (no internal notes,
// no private former-spouse data); HR gets its employer's cases only.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Choose a role first." }, { status: 401 });
  const { id } = await params;
  try {
    if (session.user.role === "employee") return Response.json({ ok: true, view: await employeeView(session.user, session.scenarioId, id) });
    if (session.user.role === "hr_admin") return Response.json({ ok: true, view: await hrCaseView(session.user, session.scenarioId, id) });
    return Response.json({ ok: false, message: "Your role cannot open cases." }, { status: 403 });
  } catch (e) {
    if (e instanceof DomainError) return Response.json({ ok: false, code: e.code, message: e.message }, { status: e.status });
    return Response.json({ ok: false, message: "Something went wrong." }, { status: 500 });
  }
}
