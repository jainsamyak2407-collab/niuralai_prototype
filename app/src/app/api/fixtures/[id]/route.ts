import { apiError, fileResponse, sessionFor } from "@/server/docs/http";
import { fixtureById } from "@/server/fixtures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Synthetic evidence fixtures for the demo. Deterministic bytes, so an upload of an
// unchanged fixture can be hash-matched when AI reading is unavailable.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await sessionFor(["employee", "demo_operator"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!/^fx_[a-z_]+$/.test(id)) return apiError(404, "fixture_not_found", "We could not find that sample file.");
  let f;
  try {
    f = await fixtureById(id);
  } catch {
    return apiError(500, "fixture_failed", "We could not generate that sample file. Try again.", "Try again.");
  }
  if (!f) return apiError(404, "fixture_not_found", "We could not find that sample file.");
  return fileResponse(f.bytes, f.contentType, f.fileName, "attachment", { "x-fixture-sha256": f.sha256, "x-synthetic": "SYNTHETIC DEMO - NOT VALID FOR ENROLLMENT" });
}
