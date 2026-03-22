import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchForgePageContract } from "../src/lib/forge-page-api";

describe("forge page api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads a stable execution page contract", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            view: "execution",
            contractVersion: "2026-03-15.phase-1",
            page: {
              metrics: { totalRuns: 2, runningRuns: 1, blockedRuns: 0 }
            }
          }
        }),
        { status: 200 }
      )
    );

    const contract = await fetchForgePageContract("execution");

    expect(contract.view).toBe("execution");
    expect(contract.contractVersion).toBe("2026-03-15.phase-1");
    expect(contract.page.metrics.totalRuns).toBe(2);
  });

  it("throws the backend message when the page contract request fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORGE_NOT_FOUND",
            message: "页面合同暂未稳定: governance"
          }
        }),
        { status: 404 }
      )
    );

    await expect(fetchForgePageContract("execution")).rejects.toThrow(
      "页面合同暂未稳定: governance"
    );
  });
});
