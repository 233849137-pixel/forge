import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeAssetsPageBridge from "../src/components/forge-assets-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";
import { getForgeAssetsPageData, type ForgeAssetsPageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function createAssetsPageData(assetTitle: string): ForgeAssetsPageData {
  const base = getForgeAssetsPageData(forgeSnapshotFixture, {
    provider: "obsidian",
    vaultName: "forge-knowledge-vault",
    vaultPath: "/tmp/demo/forge-knowledge-vault",
    cliStatus: "ready",
    cliSummary: "Obsidian CLI 已接通。",
    syncMode: "cli-assisted",
    syncedAt: "2026-03-16T08:00:00.000Z",
    summary: "知识库已接通。",
    noteCount: 1,
    canvasCount: 0,
    topFolders: [{ name: "20-共享资产SharedAssets", noteCount: 1 }],
    recentNotes: [],
    notes: []
  });

  return {
    ...base,
    knowledgeAssets: [
      {
        id: `kb-asset-${assetTitle}`,
        title: assetTitle,
        managementGroup: "启动资产",
        typeLabel: "启动模板",
        summary: `${assetTitle} 的摘要`,
        detailSummary: `${assetTitle} 的详细说明`,
        contentPreview: `# ${assetTitle}\n\n## 使用方式\n- 先在项目里挂载\n- 再补充约束\n`,
        markdownBody: `# ${assetTitle}\n\n## 使用方式\n- 先在项目里挂载\n- 再补充约束\n`,
        sceneLabel: "启动资产",
        sourceLabel: "共享资产 / 通用模块",
        callableLabel: "在项目里按需挂载",
        updatedAt: "2026-03-16T08:00:00.000Z",
        sourcePath: `20-共享资产SharedAssets/02-通用模块/${assetTitle}.md`,
        sourceNoteType: "template",
        assetEnabled: true,
        assetGroupValue: "启动资产",
        assetLabelValue: null,
        tags: ["forge"],
        detailNotes: [],
        projectUsage: [],
        usageCount: 0,
        openUri: `obsidian://open?vault=forge-knowledge-vault&file=${encodeURIComponent(assetTitle)}.md`
      }
    ],
    assetRecommendations: {
      project: null,
      stage: null,
      taskPack: null,
      query: null,
      managementGroups: ["启动资产", "执行资产", "规则资产", "证据资产", "知识资产"],
      requiredItems: [],
      recommendedItems: [],
      referenceItems: [],
      total: 0,
      items: []
    }
  } as ForgeAssetsPageData;
}

describe("forge assets page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial assets page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeAssetsPageBridge
        initialData={createAssetsPageData("开发并行派工模板（D0）v2.1")}
        showNavigation
        enableLiveSync
      />
    );

    const libraryPanel = screen.getByRole("heading", { name: /资料列表/i }).closest("article");

    expect(libraryPanel).not.toBeNull();
    expect(
      within(libraryPanel as HTMLElement).getByRole("button", {
        name: /开发并行派工模板（D0）v2.1/i
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        within(libraryPanel as HTMLElement).getByRole("button", {
          name: /开发并行派工模板（D0）v2.1/i
        })
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the assets page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "assets",
              contractVersion: "2026-03-15.phase-1",
              page: createAssetsPageData("开发并行派工模板（D0）v2.1（事件刷新）")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeAssetsPageBridge
        initialData={createAssetsPageData("开发并行派工模板（D0）v2.1")}
        showNavigation
        enableLiveSync
      />
    );

    const libraryPanel = screen.getByRole("heading", { name: /资料列表/i }).closest("article");

    expect(libraryPanel).not.toBeNull();

    dispatchForgePageContractRefresh(["assets"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        within(libraryPanel as HTMLElement).getByRole("button", {
          name: /开发并行派工模板（D0）v2.1（事件刷新）/i
        })
      ).toBeInTheDocument();
    });
  });
});
