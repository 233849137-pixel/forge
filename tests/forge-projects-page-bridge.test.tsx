import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeProjectsPageBridge from "../src/components/forge-projects-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { getForgeProjectsPageData, type ForgeProjectsPageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function createProjectsPageData(activeProjectName: string): ForgeProjectsPageData {
  return getForgeProjectsPageData({
    ...forgeSnapshotFixture,
    projects: forgeSnapshotFixture.projects.map((project) =>
      project.id === forgeSnapshotFixture.activeProjectId
        ? { ...project, name: activeProjectName }
        : project
    )
  });
}

describe("forge projects page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial projects page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeProjectsPageBridge
        initialData={createProjectsPageData("零售客服副驾驶")}
        showNavigation
        enableLiveSync
      />
    );

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    expect(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the projects page again when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "projects",
              contractVersion: "2026-03-15.phase-1",
              page: createProjectsPageData("零售客服副驾驶（事件刷新）")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeProjectsPageBridge
        initialData={createProjectsPageData("零售客服副驾驶")}
        showNavigation
        enableLiveSync
      />
    );

    dispatchForgePageContractRefresh(["projects"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /零售客服副驾驶（事件刷新）/i })
      ).toBeInTheDocument();
    });
  });
});
