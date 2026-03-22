import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeArtifactsPageBridge from "../src/components/forge-artifacts-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { getForgeArtifactsPageData, type ForgeArtifactsPageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function createArtifactsPageData(prdTitle: string): ForgeArtifactsPageData {
  return getForgeArtifactsPageData({
    ...forgeSnapshotFixture,
    prdDocuments: forgeSnapshotFixture.prdDocuments.map((document) =>
      document.projectId === forgeSnapshotFixture.activeProjectId
        ? { ...document, title: prdTitle }
        : document
    )
  });
}

describe("forge artifacts page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial artifacts page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeArtifactsPageBridge
        initialData={createArtifactsPageData("零售客服副驾驶 PRD 草案")}
        showNavigation
        enableLiveSync
      />
    );

    expect(screen.getAllByText(/零售客服副驾驶 PRD 草案/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getAllByText(/零售客服副驾驶 PRD 草案/i).length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the artifacts page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "artifacts",
              contractVersion: "2026-03-15.phase-1",
              page: createArtifactsPageData("零售客服副驾驶 PRD 草案（事件刷新）")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeArtifactsPageBridge
        initialData={createArtifactsPageData("零售客服副驾驶 PRD 草案")}
        showNavigation
        enableLiveSync
      />
    );

    dispatchForgePageContractRefresh(["artifacts"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/零售客服副驾驶 PRD 草案（事件刷新）/i).length).toBeGreaterThan(0);
    });
  });
});
