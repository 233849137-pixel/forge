import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getControlPlaneSnapshotForAI } from "../packages/ai/src";
import { ensureForgeDatabase } from "../packages/db/src";
import { loadDashboardSnapshot } from "../packages/db/src";
import { FORGE_LOCAL_FALLBACK_MODEL_OPTION } from "../packages/model-gateway/src";
import {
  getArtifactsSummaryBlock,
  getExecutionStatusBlock,
  getProjectOverviewBlock,
  getReadinessBlock
} from "../src/server/forge-block-data";
import { getForgePageContext, getForgeStablePageContract } from "../src/server/forge-page-data";
import * as forgeRealSkills from "../src/server/forge-real-skills";
import { updateModelProviderSettingsForAI } from "../packages/ai/src";

describe("forge page data", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds a unified server page context from snapshot and control-plane data", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.snapshot.activeProjectId).toBeTruthy();
      expect(context.controlPlane.project?.id).toBe(context.snapshot.activeProjectId);
      expect(context.controlPlane.runtimeSummary).toBeDefined();
      expect(Array.isArray(context.controlPlane.remediationQueue)).toBe(true);
      expect(context.blocks.projectOverview.activeProjectId).toBe(context.snapshot.activeProjectId);
      expect(context.blocks.executionStatus.remediationQueueCount).toBe(
        context.controlPlane.remediationQueue.length
      );
      expect(context.blocks.readiness.statusLabel).toBe(context.controlPlane.readiness.statusLabel);
      expect(context.pages.home.activeProjectId).toBe(context.snapshot.activeProjectId);
      expect("artifacts" in context.pages.home).toBe(false);
      expect(context.pages.projects.runEvents).toBe(context.snapshot.runEvents);
      expect(context.pages.projects.deliveryGate).toBe(context.snapshot.deliveryGate);
      expect(Array.isArray(context.pages.projects.availableModelOptions)).toBe(true);
      expect(context.pages.team.runners).toBe(context.snapshot.runners);
      expect(context.pages.team.teamTemplates).toBe(context.snapshot.teamTemplates);
      expect(context.pages.artifacts.artifacts).toBe(context.snapshot.artifacts);
      expect(context.pages.artifacts.commands).toBe(context.snapshot.commands);
      expect(context.pages.assets.knowledgeAssets).toEqual(expect.any(Array));
      expect("snapshot" in context.pages.execution).toBe(false);
      expect(context.pages.execution.metrics.totalRuns).toBe(context.snapshot.runs.length);
      expect(context.pages.execution.metrics.blockedRuns).toBe(
        context.snapshot.runs.filter((run) => run.state === "blocked").length
      );
      expect(context.pages.execution.localContext.items.some((item) => item.label === "外部执行准备度")).toBe(true);
      expect(context.pages.governance.snapshot).toBe(context.snapshot);
      expect(context.pages.governance.approvalHandoffSummary).toBe(
        context.controlPlane.approvalHandoff?.summary
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds the home page contract without invoking real-skill hydration", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      const hydrateSpy = vi.spyOn(forgeRealSkills, "hydrateSnapshotWithRealSkills").mockImplementation(() => {
        throw new Error("real skills unavailable");
      });

      const contract = getForgeStablePageContract("home", dbPath);

      expect(contract.view).toBe("home");
      expect(contract.contractVersion).toBeTruthy();
      expect(contract.page.activeProjectId).toBeTruthy();
      expect(contract.page.projects.length).toBeGreaterThan(0);
      expect(contract.page.agents.length).toBeGreaterThan(0);
      expect(contract.page.projectTemplates.length).toBeGreaterThan(0);
      expect(contract.page.dataMode).toBe("local");
      expect(contract.page.dataModeLabel).toBe("本地模式");
      expect(contract.page.dataModeSummary).toContain("本地项目数据");
      expect(hydrateSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes obsidian kb v2 data in the assets page contract when a vault is configured", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");
    const vaultPath = join(directory, "forge-knowledge-vault");
    const cliPath = join(directory, "obsidian-cli");

    try {
      mkdirSync(join(vaultPath, ".obsidian"), { recursive: true });
      mkdirSync(join(vaultPath, "10-项目Projects"), { recursive: true });
      writeFileSync(
        join(vaultPath, ".obsidian", "workspace.json"),
        JSON.stringify({ lastOpenFiles: ["10-项目Projects/NOTE-知识库同步.md"] })
      );
      writeFileSync(
        join(vaultPath, "10-项目Projects", "NOTE-知识库同步.md"),
        "# 知识库同步\n\n把 Obsidian 知识库资料同步到资产页。 #forge\n"
      );
      mkdirSync(join(vaultPath, "20-共享资产SharedAssets", "02-通用模块"), { recursive: true });
      writeFileSync(
        join(vaultPath, "20-共享资产SharedAssets", "02-通用模块", "开发并行派工模板-D0-v1.md"),
        [
          "---",
          "asset: true",
          "asset_group: 启动资产",
          "asset_label: 启动模板",
          "type: template",
          "updated: 2026-03-16",
          "---",
          "",
          "# 开发并行派工模板（D0）v2.1",
          "",
          "项目起盘时直接复用这张模板卡。",
          ""
        ].join("\n")
      );
      writeFileSync(
        join(vaultPath, "20-共享资产SharedAssets", "02-通用模块", "原型冻结与增量实现门禁-v1.md"),
        [
          "---",
          "asset: true",
          "asset_group: 规则资产",
          "asset_label: 共享规范",
          "type: guideline",
          "updated: 2026-03-16",
          "---",
          "",
          "# 原型冻结与增量实现门禁 v1",
          "",
          "原型冻结后只能做增量实现。",
          ""
        ].join("\n")
      );
      writeFileSync(
        join(vaultPath, "20-共享资产SharedAssets", "02-通用模块", "README.md"),
        "# 02-通用模块\n\n这里只是目录说明，不应被当作资产。\n"
      );
      writeFileSync(
        cliPath,
        [
          "#!/bin/sh",
          'if [ "$1" = "--help" ] || [ "$1" = "help" ]; then',
          '  echo "Obsidian CLI"',
          '  echo ""',
          '  echo "Usage: obsidian <command> [options]"',
          "  exit 0",
          "fi",
          'if [ "$1" = "recents" ]; then',
          '  echo "10-项目Projects/NOTE-知识库同步.md"',
          "  exit 0",
          "fi",
          "exit 0"
        ].join("\n")
      );
      chmodSync(cliPath, 0o755);

      vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);
      vi.stubEnv("FORGE_OBSIDIAN_CLI_BIN", cliPath);
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.pages.assets.knowledgeBase.vaultName).toBe("Knowledge Vault");
      expect(context.pages.assets.knowledgeBase.vaultPath).toBe("");
      expect(context.pages.assets.knowledgeBase.noteCount).toBe(4);
      expect(context.pages.assets.knowledgeBase.canvasCount).toBe(0);
      expect(context.pages.assets.knowledgeBase.syncedAt).toBeTruthy();
      expect(context.pages.assets.knowledgeBase.cliStatus).toBe("ready");
      expect(context.pages.assets.knowledgeBase.summary).toContain("知识库连接");
      expect(context.pages.assets.knowledgeBase.cliSummary).toContain("知识库连接器");
      expect(context.pages.assets.knowledgeBase.recentNotes).toHaveLength(4);
      expect(context.pages.assets.knowledgeBase.recentNotes[0]?.title).toBe("知识库同步");
      expect(context.pages.assets.knowledgeBase.notes).toHaveLength(4);
      expect(context.pages.assets.knowledgeBase.topFolders).toEqual(
        expect.arrayContaining([
          { name: "10-项目Projects", noteCount: 1 },
          { name: "20-共享资产SharedAssets", noteCount: 3 }
        ])
      );
      expect(context.pages.assets.knowledgeAssets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "开发并行派工模板（D0）v2.1",
            managementGroup: "启动资产",
            contentPreview: expect.stringContaining("项目起盘时直接复用这张模板卡")
          }),
          expect.objectContaining({
            title: "原型冻结与增量实现门禁 v1",
            managementGroup: "规则资产",
            contentPreview: expect.stringContaining("原型冻结后只能做增量实现")
          })
        ])
      );
      expect(context.pages.assets.knowledgeAssets).toHaveLength(2);
      expect(
        context.pages.assets.knowledgeAssets.some((asset) => asset.title === "README")
      ).toBe(false);
      expect(context.pages.assets.assetRecommendations.project?.id).toBe("retail-support");
      expect(context.pages.assets.assetRecommendations.managementGroups).toEqual(
        expect.arrayContaining(["启动资产", "执行资产", "规则资产", "证据资产", "知识资产"])
      );
      expect(context.pages.assets.reusableModules.project?.id).toBe("retail-support");
      expect(context.pages.assets.reusableModules.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "邮箱登录组件",
            assemblyContract: expect.objectContaining({
              importPath: "@forge-modules/auth-email-login",
              installCommand:
                "pnpm --filter app add @forge-modules/auth-email-login",
            }),
          }),
        ]),
      );
      expect(
        context.pages.assets.assetRecommendations.requiredItems.some(
          (item) => item.title === "开发并行派工模板（D0）v2.1"
        )
      ).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("only includes explicit design and prototype images as material assets", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");
    const vaultPath = join(directory, "forge-knowledge-vault");

    try {
      mkdirSync(join(vaultPath, "99-附件Attachments", "原型图"), { recursive: true });
      mkdirSync(join(vaultPath, "99-附件Attachments", "推特文章"), { recursive: true });
      writeFileSync(
        join(vaultPath, "99-附件Attachments", "原型图", "项目工作台-交互原型.png"),
        "png",
      );
      writeFileSync(
        join(vaultPath, "99-附件Attachments", "推特文章", "01-封面-工作系统.svg"),
        "<svg></svg>",
      );

      vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.pages.assets.materialAssets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "项目工作台-交互原型",
            typeLabel: "原型图",
            relativePath: "99-附件Attachments/原型图/项目工作台-交互原型.png",
          }),
          expect.objectContaining({
            title: "Flowbite 仪表盘 UI Kit",
            sourceLabel: "外部精选 / Flowbite",
            previewSrc: "/forge/material-assets/curated/flowbite-dashboard-ui-kit.png",
          }),
        ]),
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes referenced local visual attachments as material assets and ignores test variants", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");
    const vaultPath = join(directory, "forge-knowledge-vault");

    try {
      mkdirSync(join(vaultPath, "99-附件Attachments", "推特文章-AI工作系统"), {
        recursive: true,
      });
      mkdirSync(
        join(vaultPath, "99-附件Attachments", "推特文章-AI工作系统", "nano-banana-pro", "style-tests"),
        { recursive: true },
      );
      mkdirSync(
        join(vaultPath, "10-项目Projects", "02-自媒体创作", "10-图文创作"),
        { recursive: true },
      );

      writeFileSync(
        join(vaultPath, "99-附件Attachments", "推特文章-AI工作系统", "01-封面-从对话到系统.svg"),
        "<svg></svg>",
      );
      writeFileSync(
        join(
          vaultPath,
          "99-附件Attachments",
          "推特文章-AI工作系统",
          "02-对比-用户vs主人-banana-pro.png",
        ),
        "png",
      );
      writeFileSync(
        join(vaultPath, "99-附件Attachments", "推特文章-AI工作系统", "03-架构-共享层与业务线.svg"),
        "<svg></svg>",
      );
      writeFileSync(
        join(vaultPath, "99-附件Attachments", "推特文章-AI工作系统", "test-nb.png"),
        "png",
      );
      writeFileSync(
        join(
          vaultPath,
          "99-附件Attachments",
          "推特文章-AI工作系统",
          "nano-banana-pro",
          "style-tests",
          "02-compare-style-1-liquid-glass-bento.png",
        ),
        "png",
      );
      writeFileSync(
        join(
          vaultPath,
          "10-项目Projects",
          "02-自媒体创作",
          "10-图文创作",
          "ART-2026-02-12-Obsidian-AI工作系统推特长文.md",
        ),
        [
          "# AI工作系统推特长文",
          "",
          "![[99-附件Attachments/推特文章-AI工作系统/01-封面-从对话到系统.svg]]",
          "![[99-附件Attachments/推特文章-AI工作系统/02-对比-用户vs主人-banana-pro.png]]",
          "![[99-附件Attachments/推特文章-AI工作系统/03-架构-共享层与业务线.svg]]",
        ].join("\n"),
      );

      vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.pages.assets.materialAssets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "01-封面-从对话到系统",
            relativePath: "99-附件Attachments/推特文章-AI工作系统/01-封面-从对话到系统.svg",
            typeLabel: "设计效果图",
          }),
          expect.objectContaining({
            title: "02-对比-用户vs主人-banana-pro",
            relativePath:
              "99-附件Attachments/推特文章-AI工作系统/02-对比-用户vs主人-banana-pro.png",
            typeLabel: "设计效果图",
          }),
          expect.objectContaining({
            title: "03-架构-共享层与业务线",
            relativePath: "99-附件Attachments/推特文章-AI工作系统/03-架构-共享层与业务线.svg",
            typeLabel: "图片素材",
          }),
        ]),
      );
      expect(
        context.pages.assets.materialAssets.some((item) => item.title === "test-nb"),
      ).toBe(false);
      expect(
        context.pages.assets.materialAssets.some((item) =>
          item.title.includes("compare-style-1-liquid-glass-bento"),
        ),
      ).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("does not use external execution providers as workbench model options", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      vi.stubEnv("FORGE_ENGINEER_EXEC_COMMAND", 'openclaw run --project "{projectId}"');
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_REVIEW_EXEC_COMMAND", 'openclaw run-review --project "{projectId}"');
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Gemini 2.5 Pro");
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.pages.projects.availableModelOptions).toEqual([
        FORGE_LOCAL_FALLBACK_MODEL_OPTION
      ]);
      expect(context.pages.projects.externalExecutionSummary).toContain("已配置");
      expect(
        context.pages.projects.agentContextPreviewByProjectId?.["retail-support"]?.["后端研发"]?.tools.length
      ).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes NanoClaw CEO health in the team page contract when the global backend is configured", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);
      const previewEntry = Object.values(context.pages.team.agentContextPreviewByAgentId ?? {}).find(Boolean);

      expect(context.pages.team.ceoExecutionBackendLabel).toBe("NanoClaw");
      expect(context.pages.team.ceoExecutionStatusLabel).toBe("已接线");
      expect(context.pages.team.ceoExecutionStatusSummary).toContain("NanoClaw CEO 总控已就绪");
      expect(previewEntry?.projectContext.projectId).toBe("retail-support");
      expect(previewEntry?.tools.length).toBeGreaterThan(0);
      expect(previewEntry?.paths.workspaceRoot).toContain("retail-support");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("marks the team page NanoClaw CEO health as degraded when the healthcheck fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
      vi.stubEnv("FORGE_NANO_HEALTHCHECK_COMMAND", 'node -e "process.exit(7)"');
      ensureForgeDatabase(dbPath);

      const context = getForgePageContext(dbPath);

      expect(context.pages.team.ceoExecutionBackendLabel).toBe("NanoClaw");
      expect(context.pages.team.ceoExecutionStatusLabel).toBe("异常");
      expect(context.pages.team.ceoExecutionStatusSummary).toContain("健康检查失败");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes locally configured kimi models in the projects page contract", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "kimi",
          enabled: true,
          apiKey: "sk-kimi-local-123456",
          modelPriority: ["kimi-k2.5", "kimi-thinking-preview"]
        },
        dbPath
      );

      const context = getForgePageContext(dbPath);

      expect(context.pages.projects.availableModelOptions).toEqual(
        expect.arrayContaining(["kimi-k2.5", "kimi-thinking-preview"])
      );
      expect(context.pages.projects.modelProviderSummary).toContain("Moonshot Kimi");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes configured local models from multiple providers in the projects page contract", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-123456",
          modelPriority: ["gpt-5.4", "gpt-4.1-mini"]
        },
        dbPath
      );
      updateModelProviderSettingsForAI(
        {
          providerId: "anthropic",
          enabled: true,
          apiKey: "sk-ant-local-123456",
          modelPriority: ["claude-sonnet-4-5"]
        },
        dbPath
      );

      const context = getForgePageContext(dbPath);

      expect(context.pages.projects.availableModelOptions).toEqual(
        expect.arrayContaining(["gpt-5.4", "gpt-4.1-mini", "claude-sonnet-4-5"])
      );
      expect(context.pages.projects.availableModelOptions).not.toContain("GPT-5.4");
      expect(context.pages.projects.modelProviderSummary).toContain("OpenAI");
      expect(context.pages.projects.modelProviderSummary).toContain("Anthropic Claude");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("includes configured kimi coding models in the projects page contract", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "kimi-coding",
          enabled: true,
          apiKey: "sk-kimi-coding-local-123456",
          modelPriority: ["k2p5"]
        },
        dbPath
      );

      const context = getForgePageContext(dbPath);

      expect(context.pages.projects.availableModelOptions).toEqual(expect.arrayContaining(["k2p5"]));
      expect(context.pages.projects.modelProviderSummary).toContain("Kimi Coding");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("hides providers with a known error state from the workbench model options", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "kimi",
          enabled: true,
          apiKey: "sk-kimi-local-123456",
          modelPriority: ["kimi-k2.5"]
        },
        dbPath
      );
      updateModelProviderSettingsForAI(
        {
          providerId: "kimi-coding",
          enabled: true,
          apiKey: "sk-kimi-coding-local-123456",
          modelPriority: ["k2p5"]
        },
        dbPath
      );

      const { recordModelProviderConnectionResult } = await import("../packages/db/src");
      recordModelProviderConnectionResult(
        "kimi",
        {
          status: "error",
          testedAt: "2026-03-15T08:00:00.000Z",
          message: "Invalid Authentication"
        },
        dbPath
      );
      recordModelProviderConnectionResult(
        "kimi-coding",
        {
          status: "success",
          testedAt: "2026-03-15T08:01:00.000Z",
          message: "Kimi Coding 连接成功，可用于工作台模型调用。"
        },
        dbPath
      );

      const context = getForgePageContext(dbPath);

      expect(context.pages.projects.availableModelOptions).toEqual(["k2p5"]);
      expect(context.pages.projects.modelProviderSummary).toContain("Kimi Coding");
      expect(context.pages.projects.modelProviderSummary).not.toContain("Moonshot Kimi");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds a reusable project overview block", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      const snapshot = loadDashboardSnapshot(dbPath);

      const block = getProjectOverviewBlock(snapshot);

      expect(block.totalProjects).toBeGreaterThan(0);
      expect(block.activeProjectId).toBe(snapshot.activeProjectId);
      expect(block.activeProject?.id).toBe(snapshot.activeProjectId);
      expect(block.items[0]?.taskCount).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds a reusable execution status block", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      const snapshot = loadDashboardSnapshot(dbPath);
      const controlPlane = getControlPlaneSnapshotForAI(
        { projectId: snapshot.activeProjectId ?? undefined },
        dbPath
      );

      const block = getExecutionStatusBlock(controlPlane);

      expect(block.externalExecutionSummary).toBeTruthy();
      expect(block.executionBackendSummary).toBeTruthy();
      expect(block.bridgeExecutionSummary).toBeTruthy();
      expect(block.remediationQueueCount).toBe(controlPlane.remediationQueue.length);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds a reusable readiness block", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      const snapshot = loadDashboardSnapshot(dbPath);
      const controlPlane = getControlPlaneSnapshotForAI(
        { projectId: snapshot.activeProjectId ?? undefined },
        dbPath
      );

      const block = getReadinessBlock(controlPlane);

      expect(block.statusLabel).toBe(controlPlane.readiness.statusLabel);
      expect(block.releaseGateOverallLabel).toBe(controlPlane.releaseGate.overallLabel);
      expect(block.blockingTaskCount).toBe(controlPlane.blockingTasks.length);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds a reusable artifacts summary block", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-page-data-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      const snapshot = loadDashboardSnapshot(dbPath);

      const block = getArtifactsSummaryBlock(snapshot);

      expect(block.totalArtifacts).toBe(snapshot.artifacts.length);
      expect(block.projectArtifactCount).toBeGreaterThan(0);
      expect(block.byStatus.ready).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(block.byType)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
