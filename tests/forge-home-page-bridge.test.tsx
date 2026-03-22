import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeHomePageBridge from "../src/components/forge-home-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { getForgeHomePageData, type ForgeHomePageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

function createHomePageData(activeProjectName: string): ForgeHomePageData {
  return getForgeHomePageData({
    ...forgeSnapshotFixture,
    projects: forgeSnapshotFixture.projects.map((project) =>
      project.id === forgeSnapshotFixture.activeProjectId
        ? { ...project, name: activeProjectName }
        : project
    )
  });
}

describe("forge home page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial home page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeHomePageBridge
        initialData={createHomePageData("零售客服副驾驶")}
        showNavigation
        enableLiveSync
      />
    );

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the home page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "home",
              contractVersion: "2026-03-15.phase-1",
              page: createHomePageData("零售客服副驾驶（事件刷新）")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeHomePageBridge
        initialData={createHomePageData("零售客服副驾驶")}
        showNavigation
        enableLiveSync
      />
    );

    dispatchForgePageContractRefresh(["home"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/零售客服副驾驶（事件刷新）/i).length).toBeGreaterThan(0);
    });
  });
});
