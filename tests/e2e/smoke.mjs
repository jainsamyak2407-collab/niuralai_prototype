// Permission smoke checks against the live QLE demo API (read-only: every command it sends
// is expected to be rejected before it changes anything).
//
// Usage (repo root):
//   NODE_USE_ENV_PROXY=1 node tests/e2e/smoke.mjs [baseUrl]
// Default base URL: https://niuralai-prototype.vercel.app
// NODE_USE_ENV_PROXY=1 is only needed where outbound HTTPS goes through HTTPS_PROXY.

const BASE = (process.argv[2] || process.env.QLE_BASE_URL || "https://niuralai-prototype.vercel.app").replace(/\/$/, "");
const ORBIT_CASE = "case_bg_birth_4"; // seeded Orbit Labs (other employer) case in the birth scenario

let failures = 0;
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function signIn(userId, scenarioId = "birth") {
  const res = await fetch(`${BASE}/api/session/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, scenarioId }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  return { status: res.status, cookie, body: await res.json().catch(() => null) };
}

async function call(path, { cookie, method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const key = () => `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// 1. Unknown identity is rejected; no cookie is issued.
{
  const r = await signIn("u_attacker");
  check("unknown identity rejected", r.status === 400 && !r.cookie.startsWith("qle_demo_session="), `status ${r.status}, code ${r.body?.code}`);
}
// 1b. Browser cannot pick a role or employer: extra fields are ignored, role comes from the server.
{
  const res = await fetch(`${BASE}/api/session/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "u_maya", role: "hr_admin", employerId: "emp_orbit" }),
  });
  const j = await res.json().catch(() => null);
  check("client-supplied role ignored at sign-in", res.status === 200 && j?.user?.role === "employee", `role ${j?.user?.role}`);
}

// 2. No session: commands and case reads are refused.
{
  const r = await call("/api/command", { method: "POST", body: { type: "hr.approve", caseId: "case_b416", expectedVersion: 1, revisionNo: 1, idempotencyKey: key() } });
  check("no session -> command 401", r.status === 401, `status ${r.status}`);
  const c = await call(`/api/qle/cases/${ORBIT_CASE}`);
  check("no session -> case read 401", c.status === 401, `status ${c.status}`);
}

// 3. Employee cannot run HR or operator commands.
const maya = await signIn("u_maya", "birth");
check("Maya sign-in", maya.status === 200 && maya.cookie.startsWith("qle_demo_session="), `status ${maya.status}`);
for (const cmd of [
  { type: "hr.approve", caseId: "case_b416", expectedVersion: 1, revisionNo: 1 },
  { type: "hr.authorizePayroll", instructionId: "does_not_matter" },
  { type: "hr.sendCobraReferral", referralId: "does_not_matter", contactRoute: "verified_address_on_file" },
  { type: "ops.clock", advance: "plus_hour" },
  { type: "ops.reset", confirmScenario: "birth" },
]) {
  const r = await call("/api/command", { cookie: maya.cookie, method: "POST", body: { ...cmd, idempotencyKey: key() } });
  check(`employee -> ${cmd.type} forbidden`, r.status === 403, `status ${r.status}, code ${r.json?.code}`);
}
// 3b. Employee cannot read another employee's / employer's case.
{
  const r = await call(`/api/qle/cases/${ORBIT_CASE}`, { cookie: maya.cookie });
  check("employee -> other employer case not readable", r.status === 404 || r.status === 403, `status ${r.status}`);
}

// 4. HR cannot read another employer's case (Orbit Labs) and gets 404, not 403 (no existence leak).
const daniel = await signIn("u_daniel", "birth");
check("Daniel sign-in", daniel.status === 200, `status ${daniel.status}`);
{
  const r = await call(`/api/qle/cases/${ORBIT_CASE}`, { cookie: daniel.cookie });
  check("HR -> other employer case 404", r.status === 404, `status ${r.status}, code ${r.json?.code}`);
  const cmd = await call("/api/command", { cookie: daniel.cookie, method: "POST", body: { type: "hr.addNote", caseId: ORBIT_CASE, note: "smoke check", idempotencyKey: key() } });
  check("HR -> command on other employer case refused", cmd.status === 404 || cmd.status === 403, `status ${cmd.status}, code ${cmd.json?.code}`);
  const ops = await call("/api/command", { cookie: daniel.cookie, method: "POST", body: { type: "ops.reset", confirmScenario: "birth", idempotencyKey: key() } });
  check("HR -> ops.reset forbidden", ops.status === 403, `status ${ops.status}`);
}

// 5. Restricted roles cannot open cases.
for (const u of ["u_carrier", "u_cobra", "u_priya"]) {
  const s = await signIn(u, "birth");
  const r = await call(`/api/qle/cases/case_b416`, { cookie: s.cookie });
  check(`${u} -> case read refused`, r.status === 403 || r.status === 404, `status ${r.status}`);
}

// 6. Tampered cookie is not accepted.
{
  const tampered = maya.cookie.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  const r = await call(`/api/qle/cases/${ORBIT_CASE}`, { cookie: tampered });
  check("tampered session cookie rejected", r.status === 401, `status ${r.status}`);
}

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
