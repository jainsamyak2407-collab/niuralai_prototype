import { describe, expect, it } from "vitest";
import { resetScenario } from "@/server/demo-reset";
import { freshStore, ok, state } from "./helpers";

describe("demo reset", () => {
  it("reseeds only the chosen scenario and sets autopilot", async () => {
    freshStore(true);
    await ok("u_maya", "birth", { type: "case.createDraft", eventCode: "birth" });
    await ok("u_maya", "loss", { type: "case.createDraft", eventCode: "loss_of_other_coverage" });
    const before = await state("birth");
    await resetScenario("birth", { autopilot: false, by: "Test" });
    const after = await state("birth");
    expect(after.rev).toBe(before.rev + 1);
    expect(after.cases.some((c) => c.status === "draft")).toBe(false);
    expect(after.autopilot).toBe(false);
    expect((await state("loss")).cases.some((c) => c.status === "draft")).toBe(true);
  });
});
