import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import ForgeAssetsPage from "../src/components/forge-assets-page";
import { getForgeAssetsPageData } from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";
import type { ForgeAssetsPageData } from "../src/components/forge-assets-page.types";

function getLibraryStageForTestAsset(
  title: string,
  managementGroup:
    | "启动资产"
    | "执行资产"
    | "规则资产"
    | "证据资产"
    | "知识资产",
) {
  if (/派工|接入|起盘|协作写作/i.test(title)) {
    return "立项起盘";
  }

  if (/原型|绘图/i.test(title)) {
    return "原型设计";
  }

  if (/方案|任务包|需求/i.test(title)) {
    return "需求方案";
  }

  if (/测试|回归|验证|验收|交付|部署|发布|备份|恢复|隔离/i.test(title)) {
    return "测试发布";
  }

  if (/复盘|归档|案例/i.test(title)) {
    return "复盘沉淀";
  }

  switch (managementGroup) {
    case "启动资产":
      return "立项起盘";
    case "执行资产":
      return "开发联调";
    case "证据资产":
    case "知识资产":
      return "复盘沉淀";
    default:
      return "需求方案";
  }
}

function createKnowledgeAsset(
  title: string,
  managementGroup:
    | "启动资产"
    | "执行资产"
    | "规则资产"
    | "证据资产"
    | "知识资产",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `kb-asset-${title}`,
    title,
    managementGroup,
    libraryStage: getLibraryStageForTestAsset(title, managementGroup),
    typeLabel:
      managementGroup === "启动资产"
        ? "启动模板"
        : managementGroup === "执行资产"
          ? "通用模块"
          : managementGroup === "规则资产"
            ? "共享规范"
            : managementGroup === "证据资产"
              ? "共享案例"
              : "共享资料",
    summary: `${title} 的摘要`,
    detailSummary: `${title} 的详细说明`,
    contentPreview: [
      `# ${title}`,
      "",
      "## 使用方式",
      "- 先复制到项目上下文",
      "- 再按当前任务补充约束",
      "",
      "```text",
      "asset: true",
      "```",
    ].join("\n"),
    sceneLabel: getLibraryStageForTestAsset(title, managementGroup),
    sourceLabel: "共享资产 / 通用模块",
    callableLabel: "在项目里按需挂载",
    updatedAt: "2026-03-16T08:00:00.000Z",
    sourcePath: `20-共享资产SharedAssets/02-通用模块/${title}.md`,
    sourceNoteType: "knowledge-note",
    markdownBody: [
      `# ${title}`,
      "",
      "## 使用方式",
      "- 先复制到项目上下文",
      "- 再按当前任务补充约束",
      "",
      "```text",
      "asset: true",
      "```",
    ].join("\n"),
    assetEnabled: true,
    assetGroupValue: managementGroup,
    assetLabelValue: null,
    tags: ["forge", "kb"],
    detailNotes: [`来源：${title}`],
    projectUsage: [],
    usageCount: 0,
    openUri: `obsidian://open?vault=forge-knowledge-vault&file=${encodeURIComponent(title)}.md`,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function createKnowledgeRecommendation(
  title: string,
  managementGroup:
    | "启动资产"
    | "执行资产"
    | "规则资产"
    | "证据资产"
    | "知识资产",
  priority: "required" | "recommended" | "reference",
) {
  return {
    id: `kb-asset-${title}`,
    title,
    sourceKind: "knowledge-asset",
    managementGroup,
    priority,
    summary: `${title} 的摘要`,
    reason: `${title} 适合当前项目复用。`,
    usageGuide: `先打开 ${title} 再决定是否挂到项目。`,
    linked: false,
    score: priority === "required" ? 95 : priority === "recommended" ? 82 : 68,
    stageTags: [],
    sectorTags: [],
    relation: null,
  };
}

function createKnowledgeDrivenAssetsPageData() {
  const base = getForgeAssetsPageData(forgeSnapshotFixture, {
    provider: "obsidian",
    vaultName: "forge-knowledge-vault",
    vaultPath: "/tmp/demo/forge-knowledge-vault",
    cliStatus: "ready",
    cliSummary: "知识库连接器已接通，可同步最近打开与知识目录。",
    syncMode: "cli-assisted",
    syncedAt: "2026-03-16T08:00:00.000Z",
    summary: "知识库已接通。",
    noteCount: 4,
    canvasCount: 0,
    topFolders: [{ name: "20-共享资产SharedAssets", noteCount: 4 }],
    recentNotes: [],
    notes: [],
  });

  return {
    ...base,
    knowledgeAssets: [
      createKnowledgeAsset("开发并行派工模板（D0）v2.1", "启动资产"),
      createKnowledgeAsset("外部采集工具基线-v1", "执行资产"),
      createKnowledgeAsset("原型冻结与增量实现门禁 v1", "规则资产"),
    ],
    assetRecommendations: {
      project: {
        id: "retail-support",
        name: "零售客服副驾驶",
        sector: "智能客服 / 零售",
      },
      stage: "测试验证",
      taskPack: null,
      query: null,
      managementGroups: ["启动资产", "执行资产", "规则资产", "证据资产", "知识资产"],
      requiredItems: [
        createKnowledgeRecommendation("开发并行派工模板（D0）v2.1", "启动资产", "required"),
      ],
      recommendedItems: [
        createKnowledgeRecommendation("外部采集工具基线-v1", "执行资产", "recommended"),
      ],
      referenceItems: [],
      total: 2,
      items: [
        createKnowledgeRecommendation("开发并行派工模板（D0）v2.1", "启动资产", "required"),
        createKnowledgeRecommendation("外部采集工具基线-v1", "执行资产", "recommended"),
      ],
    },
  };
}

function createAssetsPageDataWithReusableModules(): ForgeAssetsPageData {
  const base = createKnowledgeDrivenAssetsPageData() as ForgeAssetsPageData;

  return {
    ...base,
    reusableModules: {
      project: {
        id: "retail-support",
        name: "零售客服副驾驶",
        sector: "智能客服 / 零售",
      },
      taskPack: null,
      total: 2,
      linkedCount: 1,
      recommendedCount: 2,
      categories: ["auth", "communication"],
      linkedItems: [
        {
          componentId: "component-chat-panel",
          title: "对话工作台组件",
          relation: "recommended",
          reason: "当前客服副驾驶已经把它作为会话主面板。",
        },
      ],
      usageSignals: [
        {
          componentId: "component-chat-panel",
          title: "对话工作台组件",
          status: "ready",
          statusLabel: "已复用",
          usageCount: 3,
          successCount: 2,
          blockedCount: 0,
          runningCount: 0,
          lastRunId: "run-chat-panel",
          lastRunTitle: "对话工作台装配",
          lastRunState: "completed",
          lastFailureSummary: null,
        },
        {
          componentId: "component-auth-email",
          title: "邮箱登录组件",
          status: "candidate",
          statusLabel: "待接入",
          usageCount: 1,
          successCount: 0,
          blockedCount: 0,
          runningCount: 0,
          lastRunId: null,
          lastRunTitle: null,
          lastRunState: null,
          lastFailureSummary: null,
        },
      ],
      assemblySuggestions: [
        {
          componentId: "component-auth-email",
          title: "邮箱登录组件",
          score: 92,
          reason: "当前项目需要基础鉴权能力，优先复用现成登录模块。",
        },
        {
          componentId: "component-chat-panel",
          title: "对话工作台组件",
          score: 88,
          reason: "当前项目会话主链路适合直接复用对话工作台。",
        },
      ],
      items: [
        {
          id: "component-auth-email",
          title: "邮箱登录组件",
          category: "auth",
          summary: "支持邮箱验证码、登录态校验和基础风控埋点。",
          sourceType: "internal",
          sourceRef: "forge://components/auth/email-login",
          tags: ["登录", "鉴权", "验证码"],
          recommendedSectors: ["智能客服", "RAG", "运营自动化"],
          usageGuide: "优先用于需要邮箱登录和会话保持的项目，接入前先确认用户体系。",
          assemblyContract: {
            deliveryMode: "workspace-package",
            sourceLocator: "packages/modules/auth-email-login",
            importPath: "@forge-modules/auth-email-login",
            installCommand: "pnpm --filter app add @forge-modules/auth-email-login",
            peerDeps: ["react", "next"],
            requiredEnv: ["AUTH_API_BASE_URL", "AUTH_SESSION_SECRET"],
            setupSteps: [
              "把登录页路由挂到应用入口。",
              "接通验证码发送 API 和会话校验接口。",
              "把鉴权守卫接到需要登录的页面。",
            ],
            smokeTestCommand: "pnpm test -- auth-email-login.smoke",
            ownedPaths: ["src/modules/auth", "src/app/(auth)"],
          },
        },
        {
          id: "component-chat-panel",
          title: "对话工作台组件",
          category: "communication",
          summary: "支持多轮会话、快捷回复、转人工和消息状态流。",
          sourceType: "github",
          sourceRef: "github://forge-components/chat-panel",
          tags: ["聊天", "对话", "转人工"],
          recommendedSectors: ["智能客服"],
          usageGuide: "适用于客服和助手类项目，建议和检索增强 Skill、人工接管策略一起装配。",
          assemblyContract: {
            deliveryMode: "npm-package",
            sourceLocator: "@forge-components/chat-panel",
            importPath: "@forge-components/chat-panel",
            installCommand: "pnpm add @forge-components/chat-panel",
            peerDeps: ["react", "react-dom"],
            requiredEnv: ["CHAT_STREAM_ENDPOINT"],
            setupSteps: [
              "接入会话流式接口。",
              "绑定快捷回复与人工接管动作。",
            ],
            smokeTestCommand: "pnpm test -- chat-panel.smoke",
            ownedPaths: ["src/modules/chat", "src/app/(workspace)/chat"],
          },
        },
      ],
    },
  };
}

function createAssetsPageDataWithMaterialAssets(): ForgeAssetsPageData {
  const base = createKnowledgeDrivenAssetsPageData() as ForgeAssetsPageData;

  return {
    ...base,
    materialAssets: [
      {
        id: "material-external-flowbite-dashboard",
        title: "Flowbite 仪表盘 UI Kit",
        typeLabel: "设计效果图",
        summary: "可直接复用的深色管理后台 Figma UI Kit，适合工作台和资产页改造。",
        relativePath: "external/flowbite-dashboard-ui-kit",
        sourceLabel: "外部精选 / Flowbite",
        modifiedAt: "2026-03-18T10:00:00.000Z",
        openUri: "https://github.com/themesberg/tailwind-figma-ui-kit",
        previewSrc: "/forge/material-assets/curated/flowbite-dashboard-ui-kit.png",
        actionLabel: "打开来源",
        sourceKind: "external",
      },
      {
        id: "material-home-hero",
        title: "零售客服副驾驶首页高保真稿",
        typeLabel: "设计效果图",
        summary: "用于首页主视觉和工作台氛围确认的高保真效果图。",
        relativePath: "99-附件Attachments/设计稿/零售客服副驾驶-首页高保真稿.png",
        sourceLabel: "99-附件Attachments / 设计稿",
        modifiedAt: "2026-03-16T09:30:00.000Z",
        openUri:
          "obsidian://open?vault=forge-knowledge-vault&file=99-%E9%99%84%E4%BB%B6Attachments%2F%E8%AE%BE%E8%AE%A1%E7%A8%BF%2F%E9%9B%B6%E5%94%AE%E5%AE%A2%E6%9C%8D%E5%89%AF%E9%A9%BE%E9%A9%B6-%E9%A6%96%E9%A1%B5%E9%AB%98%E4%BF%9D%E7%9C%9F%E7%A8%BF.png",
        previewSrc:
          "/api/forge/knowledge-base/material?relativePath=99-%E9%99%84%E4%BB%B6Attachments%2F%E8%AE%BE%E8%AE%A1%E7%A8%BF%2F%E9%9B%B6%E5%94%AE%E5%AE%A2%E6%9C%8D%E5%89%AF%E9%A9%BE%E9%A9%B6-%E9%A6%96%E9%A1%B5%E9%AB%98%E4%BF%9D%E7%9C%9F%E7%A8%BF.png",
        actionLabel: "在知识库中打开",
        sourceKind: "obsidian",
      },
      {
        id: "material-prototype-workbench",
        title: "项目工作台原型图",
        typeLabel: "原型图",
        summary: "用于确认多栏工作台布局和文档交互的原型稿。",
        relativePath: "99-附件Attachments/原型图/项目工作台-交互原型.png",
        sourceLabel: "99-附件Attachments / 原型图",
        modifiedAt: "2026-03-15T19:12:00.000Z",
        openUri:
          "obsidian://open?vault=forge-knowledge-vault&file=99-%E9%99%84%E4%BB%B6Attachments%2F%E5%8E%9F%E5%9E%8B%E5%9B%BE%2F%E9%A1%B9%E7%9B%AE%E5%B7%A5%E4%BD%9C%E5%8F%B0-%E4%BA%A4%E4%BA%92%E5%8E%9F%E5%9E%8B.png",
        previewSrc:
          "/api/forge/knowledge-base/material?relativePath=99-%E9%99%84%E4%BB%B6Attachments%2F%E5%8E%9F%E5%9E%8B%E5%9B%BE%2F%E9%A1%B9%E7%9B%AE%E5%B7%A5%E4%BD%9C%E5%8F%B0-%E4%BA%A4%E4%BA%92%E5%8E%9F%E5%9E%8B.png",
        actionLabel: "在知识库中打开",
        sourceKind: "obsidian",
      },
    ],
  };
}

describe("Forge assets page", () => {
  it("removes the header bar and sidebar promo copy", () => {
    render(<ForgeAssetsPage showNavigation data={createKnowledgeDrivenAssetsPageData() as any} />);

    expect(screen.queryByText(/^控制台$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /回到项目管理/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /查看 AI 员工/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /资产管理页负责沉淀和复用，不承担一线推进。重点看模板、组件、历史交付物和知识库。/i,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /登记资产/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/当前项目推荐/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/在这里挑可复用资产，再回到项目页推进。/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/资产页签/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/看当前项目怎么拆资产，再决定哪些该真正挂到项目里。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/按项目阶段整理模板、规范、案例和经验。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/优先复用现成实现，再只写项目自己的胶水层。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Obsidian 文件树与阅读视图。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /资产总览/i }),
    ).toBeInTheDocument();
    const assetGroups = screen.getByRole("region", { name: /资产分组/i });
    expect(
      within(assetGroups).getByRole("button", { name: /^知识类资产/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^代码类资产/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^知识库/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^立项起盘/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^开发联调/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^工作台界面/i }),
    ).not.toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^基础能力/i }),
    ).not.toBeInTheDocument();
  });

  it("uses knowledge-base-derived assets instead of snapshot mock assets", () => {
    render(<ForgeAssetsPage showNavigation data={createKnowledgeDrivenAssetsPageData() as any} />);

    expect(
      screen.getByRole("heading", { name: /资料列表/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /资料详情/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^当前资料$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /开发并行派工模板/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /知识库问答模板/i }),
    ).not.toBeInTheDocument();
    const detailPanel = screen
      .getByRole("link", { name: /在知识库中打开 开发并行派工模板（D0）v2\.1/i })
      .closest("article");
    expect(detailPanel).not.toBeNull();
    expect(
      within(detailPanel as HTMLElement).getAllByText(
        "开发并行派工模板（D0）v2.1",
      ),
    ).toHaveLength(1);
    expect(
      screen.queryByText(/开发并行派工模板（D0）v2.1 的详细说明/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Obsidian 兼容预览/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/当前笔记/i)).not.toBeInTheDocument();
    expect(screen.getByText(/使用方式/i)).toBeInTheDocument();
    expect(screen.getByText(/先复制到项目上下文/i)).toBeInTheDocument();
    expect(screen.queryByText(/^适用场景$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^资料来源$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^更新时间$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /项目引用/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/暂无项目引用/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/笔记类型：template/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/维护人：技术总监-CTO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/可供调用/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /编辑资料/i }).closest("[data-action-alignment]"),
    ).toHaveAttribute("data-action-alignment", "center");
    expect(
      screen.queryByRole("heading", { name: /当前项目资产策略/i }),
    ).not.toBeInTheDocument();

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /开发联调/i }),
    );

    expect(
      screen.getByRole("button", { name: /外部采集工具基线-v1/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/外部采集工具基线-v1 的详细说明/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /邮箱登录组件/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("filters the active knowledge asset section and sorts by usage", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={
          {
            ...createKnowledgeDrivenAssetsPageData(),
            knowledgeAssets: [
              createKnowledgeAsset("开发并行派工模板（D0）v2.1", "启动资产", {
                usageCount: 2,
              }),
              createKnowledgeAsset("多人协作Web系统稳定交付清单-v1", "启动资产", {
                usageCount: 1,
              }),
              createKnowledgeAsset("外部采集工具基线-v1", "执行资产"),
            ],
          } as any
        }
      />,
    );

    const libraryPanel = screen
      .getByRole("heading", { name: /资料列表/i })
      .closest("article");

    expect(libraryPanel).not.toBeNull();

    fireEvent.click(
      within(screen.getByRole("region", { name: /资产分组/i })).getByRole(
        "button",
        { name: /测试发布/i },
      ),
    );

    fireEvent.change(
      within(libraryPanel as HTMLElement).getByRole("combobox", {
        name: /排序方式/i,
      }),
      {
        target: { value: "usage" },
      },
    );

    const sortedRows = within(libraryPanel as HTMLElement).getAllByRole(
      "button",
    );
    expect(sortedRows[0]).toHaveTextContent(/多人协作Web系统稳定交付清单-v1/i);

    fireEvent.change(
      within(libraryPanel as HTMLElement).getByRole("searchbox", {
        name: /搜索资料/i,
      }),
      {
        target: { value: "稳定交付" },
      },
    );

    expect(
      within(libraryPanel as HTMLElement).getByRole("button", {
        name: /多人协作Web系统稳定交付清单-v1/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(libraryPanel as HTMLElement).queryByRole("button", {
        name: /开发并行派工模板/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows linked projects and workbench links for extracted assets", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={
          {
            ...createKnowledgeDrivenAssetsPageData(),
            knowledgeAssets: [
              createKnowledgeAsset("开发并行派工模板（D0）v2.1", "启动资产", {
                projectUsage: [
                  {
                    projectId: "retail-support",
                    projectName: "零售客服副驾驶",
                    relation: "default",
                    reason: "当前项目已把这张共享模板作为默认起盘资产。",
                    usageGuide: "新项目起盘时先复制这张模板，再补齐项目约束。",
                  },
                ],
                usageCount: 1,
              }),
            ],
          } as any
        }
      />,
    );

    const detailPanel = screen
      .getByRole("heading", { name: /开发并行派工模板（D0）v2\.1/i })
      .closest("article");

    expect(detailPanel).not.toBeNull();
    expect(
      within(detailPanel as HTMLElement).getByRole("heading", {
        name: /项目引用/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(detailPanel as HTMLElement).getByText(/零售客服副驾驶/i),
    ).toBeInTheDocument();
    expect(
      within(detailPanel as HTMLElement).getByText(/默认关联/i),
    ).toBeInTheDocument();
    expect(
      within(detailPanel as HTMLElement).getByText(
        /当前项目已把这张共享模板作为默认起盘资产/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(detailPanel as HTMLElement).getByRole("link", {
        name: /进入 零售客服副驾驶 项目工作台/i,
      }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/projects?projectId=retail-support"),
    );
  });

  it("renders reusable modules as a separate high-frequency library tab", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createAssetsPageDataWithReusableModules()}
      />,
    );

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });
    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^代码类资产/i }),
    );
    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^基础能力/i }),
    );

    expect(
      screen.getByRole("heading", { name: /复用模块列表/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /邮箱登录组件/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/优先用于需要邮箱登录和会话保持的项目/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/安装命令/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pnpm --filter app add @forge-modules\/auth-email-login/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/所需环境变量/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/AUTH_API_BASE_URL/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/接入步骤/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/把登录页路由挂到应用入口/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/冒烟命令/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pnpm test -- auth-email-login.smoke/i),
    ).toBeInTheDocument();
  });

  it("renders image materials in a dedicated first-level asset section", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createAssetsPageDataWithMaterialAssets()}
      />,
    );

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    );
    expect(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).getByRole("button", { name: /^设计效果图/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^原型图/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^设计效果图/i }),
    );

    expect(
      screen.getByRole("heading", { name: /素材列表/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /零售客服副驾驶首页高保真稿/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /零售客服副驾驶首页高保真稿/i }),
    );
    expect(
      screen.getByRole("img", { name: /零售客服副驾驶首页高保真稿/i }),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("/api/forge/knowledge-base/material?relativePath="),
    );
    expect(
      screen.getByRole("link", {
        name: /在知识库中打开 零售客服副驾驶首页高保真稿/i,
      }),
    ).toHaveAttribute("href", expect.stringContaining("obsidian://open"));
    expect(
      screen.queryByRole("button", { name: /项目工作台原型图/i }),
    ).not.toBeInTheDocument();
  });

  it("renders curated external materials with a preview image and source link", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createAssetsPageDataWithMaterialAssets()}
      />,
    );

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    );
    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^设计效果图/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Flowbite 仪表盘 UI Kit/i }),
    );

    expect(
      screen.getByRole("img", { name: /Flowbite 仪表盘 UI Kit/i }),
    ).toHaveAttribute("src", "/forge/material-assets/curated/flowbite-dashboard-ui-kit.png");
    expect(
      screen.getByRole("link", { name: /打开来源 Flowbite 仪表盘 UI Kit/i }),
    ).toHaveAttribute("href", "https://github.com/themesberg/tailwind-figma-ui-kit");
  });

  it("uses first-level accordion groups for knowledge assets, material assets and code assets", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createAssetsPageDataWithMaterialAssets()}
      />,
    );

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });

    expect(
      within(assetGroups).getByRole("button", { name: /^知识类资产/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).queryByRole("button", { name: /^工作台界面/i }),
    ).not.toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^设计效果图/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    );

    expect(
      within(assetGroups).getByRole("button", { name: /^素材类资产/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).getByRole("button", { name: /^设计效果图/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^原型图/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^工作台界面/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(assetGroups).getByRole("button", { name: /^代码类资产/i }),
    );

    expect(
      within(assetGroups).getByRole("button", { name: /^代码类资产/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).getByRole("button", { name: /^工作台界面/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^业务流程/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^集成连接/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).getByRole("button", { name: /^基础能力/i }),
    ).toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^立项起盘/i }),
    ).not.toBeInTheDocument();
    expect(
      within(assetGroups).queryByRole("button", { name: /^设计效果图/i }),
    ).not.toBeInTheDocument();
  });

  it("collapses the expanded primary asset group when clicked again", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createAssetsPageDataWithReusableModules()}
      />,
    );

    const assetGroups = screen.getByRole("region", { name: /资产分组/i });
    const knowledgeButton = within(assetGroups).getByRole("button", {
      name: /^知识类资产$/i,
    });

    expect(knowledgeButton).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).getByRole("button", { name: /^立项起盘/i }),
    ).toBeInTheDocument();

    fireEvent.click(knowledgeButton);

    expect(knowledgeButton).toHaveAttribute("aria-expanded", "false");
    expect(
      within(assetGroups).queryByRole("button", { name: /^立项起盘/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(knowledgeButton);

    expect(knowledgeButton).toHaveAttribute("aria-expanded", "true");
    expect(
      within(assetGroups).getByRole("button", { name: /^立项起盘/i }),
    ).toBeInTheDocument();
  });

  it("saves edited asset metadata back to obsidian frontmatter", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            sourcePath:
              "20-共享资产SharedAssets/02-通用模块/开发并行派工模板（D0）v2.1.md",
            asset: true,
            assetGroup: "启动资产",
            assetLabel: "共享启动模板",
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <ForgeAssetsPage
        showNavigation
        data={createKnowledgeDrivenAssetsPageData() as any}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /编辑资料/i }));
    fireEvent.change(screen.getByLabelText(/资产标签/i), {
      target: { value: "共享启动模板" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^保存到知识库$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/forge/assets/metadata", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourcePath:
            "20-共享资产SharedAssets/02-通用模块/开发并行派工模板（D0）v2.1.md",
          asset: true,
          assetGroup: "启动资产",
          assetLabel: "共享启动模板",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /已同步到知识库/i,
      );
    });
  });

  it("saves edited markdown body back to obsidian", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            sourcePath:
              "20-共享资产SharedAssets/02-通用模块/开发并行派工模板（D0）v2.1.md",
            body: "# 开发并行派工模板（D0）v2.1\n\n新的正文内容",
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <ForgeAssetsPage
        showNavigation
        data={createKnowledgeDrivenAssetsPageData() as any}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /编辑资料/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /编辑 Markdown 正文/i }), {
      target: { value: "# 开发并行派工模板（D0）v2.1\n\n新的正文内容" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^保存到知识库$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/forge/assets/content", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourcePath:
            "20-共享资产SharedAssets/02-通用模块/开发并行派工模板（D0）v2.1.md",
          body: "# 开发并行派工模板（D0）v2.1\n\n新的正文内容",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/已同步到知识库/i);
    });
  });

  it("uses a tall reading layout for the asset detail preview", () => {
    render(
      <ForgeAssetsPage
        showNavigation
        data={createKnowledgeDrivenAssetsPageData() as any}
      />,
    );

    expect(screen.getByTestId("asset-detail-layout")).toHaveAttribute(
      "data-detail-layout",
      "expanded",
    );
    expect(screen.getByTestId("asset-preview-body")).toHaveAttribute(
      "data-preview-density",
      "roomy",
    );
  });

  it("shows a pie-chart dashboard in overview and uses planning metrics when material and code assets are empty", () => {
    const base = createKnowledgeDrivenAssetsPageData() as ForgeAssetsPageData;

    render(
      <ForgeAssetsPage
        showNavigation
        data={{
          ...base,
          materialAssets: [],
          reusableModules: {
            ...base.reusableModules,
            total: 0,
            categories: [],
            recommendedCount: 0,
            linkedCount: 0,
            linkedItems: [],
            usageSignals: [],
            assemblySuggestions: [],
            items: [],
          },
        }}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("region", { name: /资产分组/i })).getByRole(
        "button",
        { name: /资产总览/i },
      ),
    );

    expect(
      screen.getByRole("heading", { name: /资产总览仪表盘/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("asset-dashboard-layout")).toHaveAttribute(
      "data-dashboard-density",
      "donut-readable",
    );
    expect(
      screen.getByRole("heading", { name: /知识类资产/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /素材类资产/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /代码类资产/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /资产版图/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /知识类资产阶段/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /素材类资产分类/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /代码类资产分类/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/规划态/i)).toHaveLength(2);
    expect(screen.getAllByTestId("asset-donut-chart")).toHaveLength(3);
    expect(screen.getByTestId("asset-count-list-knowledge")).toHaveAttribute(
      "data-count-density",
      "two-column",
    );
    expect(screen.getByTestId("asset-count-list-material")).toHaveAttribute(
      "data-count-density",
      "single-column",
    );
    expect(screen.getByTestId("asset-count-list-code")).toHaveAttribute(
      "data-count-density",
      "two-column",
    );
    expect(
      screen.queryByRole("heading", { name: /接入优先级/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /必带资产/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /AI 推荐/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /背景参考/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /查看 开发联调 资产/i }),
    );

    const activeSidebarButton = within(
      screen.getByRole("region", { name: /资产分组/i }),
    )
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("开发联调"));

    expect(activeSidebarButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: /外部采集工具基线-v1/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /资产总览仪表盘/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an obsidian-style workspace in the dedicated knowledge base asset group", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            relativePath:
              "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
            body: "# 知识库同步方案\n\n## 实施步骤\n- 把 Obsidian KB v2 同步到 Forge 资产页。\n- 目录按真实层级读取。",
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <ForgeAssetsPage
        showNavigation
        data={getForgeAssetsPageData(forgeSnapshotFixture, {
          provider: "obsidian",
          vaultName: "forge-knowledge-vault",
          vaultPath: "/tmp/demo/forge-knowledge-vault",
          cliStatus: "disabled",
          cliSummary: "知识库连接器已发现，但当前尚未启用。",
          syncMode: "filesystem",
          syncedAt: "2026-03-15T16:55:00.000Z",
          summary: "CLI 未启用，当前按 vault 文件直读同步。",
          noteCount: 2,
          canvasCount: 1,
          topFolders: [{ name: "10-项目Projects", noteCount: 1 }],
          recentNotes: [
            {
              id: "kb-note-sync-plan",
              title: "知识库同步方案",
              relativePath:
                "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
              folder: "10-项目Projects",
              excerpt: "把 Obsidian KB v2 同步到 Forge 资产页。",
              tags: ["forge", "obsidian"],
              modifiedAt: "2026-03-15T16:50:00.000Z",
              wordCount: 15,
              isRecent: true,
              openUri:
                "obsidian://open?vault=forge-knowledge-vault&file=10-%E9%A1%B9%E7%9B%AEProjects%2FDemo%2FNOTE-2026-03-15-%E7%9F%A5%E8%AF%86%E5%BA%93%E5%90%8C%E6%AD%A5%E6%96%B9%E6%A1%88.md",
            },
          ],
          notes: [
            {
              id: "kb-note-sync-plan",
              title: "知识库同步方案",
              relativePath:
                "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
              folder: "10-项目Projects",
              excerpt: "把 Obsidian KB v2 同步到 Forge 资产页。",
              tags: ["forge", "obsidian"],
              modifiedAt: "2026-03-15T16:50:00.000Z",
              wordCount: 15,
              isRecent: true,
              openUri:
                "obsidian://open?vault=forge-knowledge-vault&file=10-%E9%A1%B9%E7%9B%AEProjects%2FDemo%2FNOTE-2026-03-15-%E7%9F%A5%E8%AF%86%E5%BA%93%E5%90%8C%E6%AD%A5%E6%96%B9%E6%A1%88.md",
            },
            {
              id: "kb-note-handoff",
              title: "经验速记",
              relativePath: "00-Agent协作Agent-OS/经验库/INBOX-经验速记.md",
              folder: "00-Agent协作Agent-OS",
              excerpt: "记录知识库沉淀的流程约束。",
              tags: ["ops", "knowledge"],
              modifiedAt: "2026-03-15T16:40:00.000Z",
              wordCount: 12,
              isRecent: false,
              openUri:
                "obsidian://open?vault=forge-knowledge-vault&file=00-Agent%E5%8D%8F%E4%BD%9CAgent-OS%2F%E7%BB%8F%E9%AA%8C%E5%BA%93%2FINBOX-%E7%BB%8F%E9%AA%8C%E9%80%9F%E8%AE%B0.md",
            },
            {
              id: "kb-note-readme",
              title: "README",
              relativePath: "README.md",
              folder: "",
              excerpt: "知识库根目录说明。",
              tags: ["index"],
              modifiedAt: "2026-03-15T16:30:00.000Z",
              wordCount: 8,
              isRecent: false,
              openUri:
                "obsidian://open?vault=forge-knowledge-vault&file=README.md",
            },
          ],
        }) as any}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("region", { name: /资产分组/i })).getByRole(
        "button",
        { name: /^知识库/i },
      ),
    );

    const workspace = screen.getByRole("region", { name: /知识库工作区/i });

    expect(workspace).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Obsidian 工作区/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Vault$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/同步模式/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最近同步/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/知识规模/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/篇笔记/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/CLI 未启用，当前按 vault 文件直读同步。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/知识库连接器已发现，但当前尚未启用。/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /搜索知识库/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tree", { name: /知识库目录/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /10-项目Projects/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /10-项目Projects/i }),
    ).toHaveAttribute("style", expect.stringContaining("--tree-depth: 0"));
    expect(
      screen.getByRole("treeitem", { name: /00-Agent协作Agent-OS/i }),
    ).toHaveAttribute("style", expect.stringContaining("--tree-depth: 0"));
    expect(
      screen.getByRole("treeitem", { name: /Demo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /知识库同步方案/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /经验库/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /根目录/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("treeitem", { name: /^README$/i }),
    ).toHaveAttribute("style", expect.stringContaining("--tree-depth: 0"));
    expect(screen.queryByText(/^导航$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^文件树$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^预览$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^当前笔记$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/10-项目Projects/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: /资料列表/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /资料详情/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/forge/knowledge-base/note?relativePath=10-%E9%A1%B9%E7%9B%AEProjects%2FDemo%2FNOTE-2026-03-15-%E7%9F%A5%E8%AF%86%E5%BA%93%E5%90%8C%E6%AD%A5%E6%96%B9%E6%A1%88.md",
        ),
      );
      expect(
        screen.getByRole("heading", { name: /知识库同步方案/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/实施步骤/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(/把 Obsidian KB v2 同步到 Forge 资产页。/i),
      ).toHaveLength(1);
      expect(screen.getByText(/目录按真实层级读取。/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /在知识库中打开 知识库同步方案/i }),
      ).toHaveAttribute("href", expect.stringContaining("obsidian://open"));
    });
  });

  it("edits and saves the selected knowledge note back to obsidian", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);

        if (!init && url.includes("/api/forge/knowledge-base/note?")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                relativePath:
                  "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
                body: "# 知识库同步方案\n\n原始正文",
              },
            }),
            { status: 200 },
          );
        }

        if (init?.method === "POST" && url === "/api/forge/knowledge-base/note") {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                relativePath:
                  "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
                body: "# 知识库同步方案\n\n改过的正文",
              },
            }),
            { status: 200 },
          );
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
    );

    render(
      <ForgeAssetsPage
        showNavigation
        data={getForgeAssetsPageData(forgeSnapshotFixture, {
          provider: "obsidian",
          vaultName: "forge-knowledge-vault",
          vaultPath: "/tmp/demo/forge-knowledge-vault",
          cliStatus: "ready",
          cliSummary: "知识库连接器已接通，可同步最近打开与知识目录。",
          syncMode: "cli-assisted",
          syncedAt: "2026-03-15T16:55:00.000Z",
          summary: "CLI 已接通，当前按需读取笔记正文。",
          noteCount: 1,
          canvasCount: 0,
          topFolders: [{ name: "10-项目Projects", noteCount: 1 }],
          recentNotes: [],
          notes: [
            {
              id: "kb-note-sync-plan",
              title: "知识库同步方案",
              relativePath:
                "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
              folder: "10-项目Projects",
              excerpt: "把 Obsidian KB v2 同步到 Forge 资产页。",
              tags: ["forge", "obsidian"],
              modifiedAt: "2026-03-15T16:50:00.000Z",
              wordCount: 15,
              isRecent: true,
              openUri:
                "obsidian://open?vault=forge-knowledge-vault&file=10-%E9%A1%B9%E7%9B%AEProjects%2FDemo%2FNOTE-2026-03-15-%E7%9F%A5%E8%AF%86%E5%BA%93%E5%90%8C%E6%AD%A5%E6%96%B9%E6%A1%88.md",
            },
          ],
        }) as any}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("region", { name: /资产分组/i })).getByRole(
        "button",
        { name: /^知识库/i },
      ),
    );

    await waitFor(() => {
      expect(screen.getByText(/原始正文/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /编辑当前笔记/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /编辑知识库 Markdown 正文/i }), {
      target: { value: "# 知识库同步方案\n\n改过的正文" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存到知识库/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/forge/knowledge-base/note", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          relativePath:
            "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
          body: "# 知识库同步方案\n\n改过的正文",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/已同步到知识库/i);
      expect(screen.getByText(/改过的正文/i)).toBeInTheDocument();
    });
  });
});
