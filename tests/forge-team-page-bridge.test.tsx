import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeTeamPageBridge from "../src/components/agent-team-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { getForgeTeamPageData, type ForgeTeamPageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function createTeamPageData(pmName: string): ForgeTeamPageData {
  return getForgeTeamPageData({
    ...forgeSnapshotFixture,
    agents: forgeSnapshotFixture.agents.map((agent) =>
      agent.role === "pm" ? { ...agent, name: pmName } : agent
    )
  });
}

describe("forge team page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial team page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeTeamPageBridge
        initialData={createTeamPageData("产品经理 Agent")}
        showNavigation
        enableLiveSync
      />
    );

    expect(screen.getByRole("heading", { name: /团队配置/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/产品经理 Agent/i).length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the team page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "team",
              contractVersion: "2026-03-15.phase-1",
              page: createTeamPageData("产品经理 Agent（事件刷新）")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeTeamPageBridge
        initialData={createTeamPageData("产品经理 Agent")}
        showNavigation
        enableLiveSync
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));

    dispatchForgePageContractRefresh(["team"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/产品经理 Agent（事件刷新）/i).length).toBeGreaterThan(0);
    });
  });
});
