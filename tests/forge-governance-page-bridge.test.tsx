import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgeGovernancePageData } from "../src/server/forge-page-dtos";
import ForgeGovernancePageBridge from "../src/components/forge-governance-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function createGovernancePageData(externalExecutionSummary: string): ForgeGovernancePageData {
  return {
    snapshot: forgeSnapshotFixture,
    externalExecutionSummary,
    approvalHandoffSummary: "规则审查已完成，等待产品负责人确认。"
  };
}

describe("forge governance page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial governance page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeGovernancePageBridge
        initialData={createGovernancePageData("已配置 2 条外部模型执行契约。")}
        showNavigation
        enableLiveSync
      />
    );

    expect(screen.getAllByText(/已配置 2 条外部模型执行契约。/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getAllByText(/已配置 2 条外部模型执行契约。/i).length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the governance page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "governance",
              contractVersion: "2026-03-15.phase-1",
              page: createGovernancePageData("已配置 4 条外部模型执行契约。")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeGovernancePageBridge
        initialData={createGovernancePageData("已配置 2 条外部模型执行契约。")}
        showNavigation
        enableLiveSync
      />
    );

    dispatchForgePageContractRefresh(["governance"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
