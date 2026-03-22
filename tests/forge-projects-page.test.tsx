import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { act } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgeProjectsPage from "../src/components/forge-projects-page";
import type { SendForgeWorkbenchChatResult } from "../src/lib/forge-command-api";
import { getForgeProjectsPageData } from "../src/server/forge-page-dtos";
import * as forgeWorkspaceApi from "../src/lib/forge-workspace-api";
import {
  FORGE_PAGE_CONTRACT_REFRESH_EVENT,
  type ForgePageContractRefreshDetail
} from "../src/lib/forge-page-refresh-events";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function expectLastRefreshEventToInclude(
  dispatchEventSpy: ReturnType<typeof vi.spyOn>,
  view: string
) {
  const refreshEvent = dispatchEventSpy.mock.calls.at(-1)?.[0] as
    | CustomEvent<ForgePageContractRefreshDetail>
    | undefined;

  expect(refreshEvent?.type).toBe(FORGE_PAGE_CONTRACT_REFRESH_EVENT);
  expect(refreshEvent?.detail.views).toContain(view);
}

function getWorkflowNodeButton(nodeRegion: HTMLElement, label: string) {
  const button = within(nodeRegion)
    .getAllByRole("button")
    .find((item) => item.querySelector("strong")?.textContent === label);

  expect(button).toBeTruthy();

  return button as HTMLButtonElement;
}

function queryWorkflowNodeButton(nodeRegion: HTMLElement, label: string) {
  return (
    within(nodeRegion)
      .queryAllByRole("button")
      .find((item) => item.querySelector("strong")?.textContent === label) ?? null
  );
}

function getNextGeneratedDocumentLabel(resultRegion: HTMLElement) {
  return `结果 ${within(resultRegion).getAllByRole("tab").length + 1}`;
}

function buildRepeatedText(unit: string, count: number) {
  return unit.repeat(count);
}

function buildLawWorkbenchSnapshot() {
  return {
    ...forgeSnapshotFixture,
    activeProjectId: "law-case-platform",
    projects: forgeSnapshotFixture.projects.map((project) =>
      project.id === "retail-support"
        ? {
            ...project,
            id: "law-case-platform",
            name: "示例案件协作平台",
            requirement:
              "示例案件协作平台是一套面向律师团队的案件与非诉协作平台，覆盖案件管理、任务协作、文件归档与客户进度查询等核心能力。",
            enterpriseName: "示例律所",
            sector: "法律 / 案件管理",
            projectType: "OA系统",
            owner: "Iris",
            deliveryDate: "2026-03-21",
            note: "演示重点展示案件工作台、文件归档与客户进度。",
            progress: 74,
            riskNote: "演示口径与交付说明待最终确认"
          }
        : project
    ),
    projectProfiles: forgeSnapshotFixture.projectProfiles.map((profile) =>
      profile.projectId === "retail-support"
        ? {
            ...profile,
            projectId: "law-case-platform",
            workspacePath: "/tmp/forge/law-case-platform",
            dnaSummary: "绑定案件工作台、证据归档和客户进度演示链路。"
          }
        : profile
    ),
    workflowStates: forgeSnapshotFixture.workflowStates.map((item) =>
      item.projectId === "retail-support"
        ? {
            ...item,
            projectId: "law-case-platform",
            state: "current" as const,
            blockers: [],
            lastTransitionAt: "今天 14:20"
          }
        : item
    ),
    workflowTransitions: forgeSnapshotFixture.workflowTransitions.map((item) =>
      item.projectId === "retail-support"
        ? {
            ...item,
            projectId: "law-case-platform",
            blockers: [],
            createdAt: "今天 14:20"
          }
        : item
    ),
    prdDocuments: forgeSnapshotFixture.prdDocuments.map((document) =>
      document.projectId === "retail-support"
        ? {
            ...document,
            id: "prd-law",
            projectId: "law-case-platform",
            title: "示例案件协作平台 PRD 草案",
            content:
              "# 示例案件协作平台 PRD 草案\n\n## 核心目标\n- 建立统一的案件工作台与客户进度同步机制",
            createdAt: "今天 14:20"
          }
        : document
    ),
    components: [
      ...forgeSnapshotFixture.components,
      {
        id: "component-case-workbench",
        title: "案件工作台组件",
        category: "workspace",
        summary: "承载阶段轨道、案件任务、案件日志、基础信息和日程。",
        sourceType: "internal",
        sourceRef: "forge://components/case/workbench",
        tags: ["案件工作台", "阶段轨道", "案件任务"],
        recommendedSectors: ["法律", "案件管理"],
        usageGuide: "用于案件详情页的主工作台区域，接入前先对齐任务与日志模型。",
        assemblyContract: {
          deliveryMode: "workspace-package",
          sourceLocator: "packages/modules/case-workbench",
          importPath: "@forge-modules/case-workbench",
          installCommand: "pnpm --filter app add @forge-modules/case-workbench",
          peerDeps: ["react", "next"],
          requiredEnv: ["CASE_API_BASE_URL"],
          setupSteps: ["接通案件详情接口。", "同步任务、日志、文件和日程。"],
          smokeTestCommand: "pnpm test -- case-workbench.smoke",
          ownedPaths: ["src/modules/case-workbench", "src/app/cases/[id]"]
        }
      },
      {
        id: "component-client-progress",
        title: "客户进度查询组件",
        category: "client-progress",
        summary: "向委托人展示案件推进进度与最近更新。",
        sourceType: "internal",
        sourceRef: "forge://components/case/client-progress",
        tags: ["客户进度", "案件状态", "委托人"],
        recommendedSectors: ["法律", "案件管理"],
        usageGuide: "用于客户端查看案件当前阶段和最新进展。",
        assemblyContract: {
          deliveryMode: "workspace-package",
          sourceLocator: "packages/modules/client-progress",
          importPath: "@forge-modules/client-progress",
          installCommand: "pnpm --filter app add @forge-modules/client-progress",
          peerDeps: ["react", "next"],
          requiredEnv: ["CLIENT_PROGRESS_API_BASE_URL"],
          setupSteps: ["接通委托人进度查询接口。"],
          smokeTestCommand: "pnpm test -- client-progress.smoke",
          ownedPaths: ["src/modules/client-progress", "src/app/client-progress"]
        }
      }
    ],
    artifacts: [
      ...forgeSnapshotFixture.artifacts
        .filter((item) => item.projectId !== "retail-support")
        .concat([
          {
            id: "artifact-law-prd",
            projectId: "law-case-platform",
            type: "prd",
            title: "示例案件协作平台 PRD 草案",
            ownerAgentId: "agent-pm",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-architecture",
            projectId: "law-case-platform",
            type: "architecture-note",
            title: "示例案件协作平台 架构与流程说明",
            ownerAgentId: "agent-architect",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-ui-spec",
            projectId: "law-case-platform",
            type: "ui-spec",
            title: "示例案件协作平台 原型与交互规范",
            ownerAgentId: "agent-design",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-task-pack",
            projectId: "law-case-platform",
            type: "task-pack",
            title: "示例案件协作平台 首轮 TaskPack",
            ownerAgentId: "agent-pm",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-patch",
            projectId: "law-case-platform",
            type: "patch",
            title: "示例案件协作平台 主流程补丁",
            ownerAgentId: "agent-dev",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-demo-build",
            projectId: "law-case-platform",
            type: "demo-build",
            title: "示例案件协作平台 DEMO 构建",
            ownerAgentId: "agent-dev",
            status: "ready",
            updatedAt: "今天 14:20"
          },
          {
            id: "artifact-law-test-report",
            projectId: "law-case-platform",
            type: "test-report",
            title: "示例案件协作平台 主流程测试报告",
            ownerAgentId: "agent-qa",
            status: "ready",
            updatedAt: "今天 14:20"
          }
        ])
    ],
    artifactReviews: [
      ...forgeSnapshotFixture.artifactReviews.filter((item) => item.artifactId !== "artifact-demo-build"),
      {
        id: "review-law-demo-build",
        artifactId: "artifact-law-demo-build",
        reviewerAgentId: "agent-qa",
        decision: "pass" as const,
        summary: "案件工作台主流程已通过回归，可进入交付说明整理与演示彩排。",
        conditions: ["补充现场讲解口径", "确认客户进度页截图素材"],
        reviewedAt: "今天 14:20"
      }
    ],
    tasks: [
      ...forgeSnapshotFixture.tasks.filter((item) => item.projectId !== "retail-support"),
      {
        id: "task-law-qa-rehearsal",
        projectId: "law-case-platform",
        stage: "测试验证",
        title: "执行主流程回归与演示彩排",
        ownerAgentId: "agent-qa",
        status: "in-progress",
        priority: "P0",
        category: "qa",
        summary: "正在回归案件录入、任务协作、证据归档与客户进度查询四条演示主链。"
      },
      {
        id: "task-law-release",
        projectId: "law-case-platform",
        stage: "交付发布",
        title: "确认交付说明并准备现场演示",
        ownerAgentId: "agent-pm",
        status: "todo",
        priority: "P0",
        category: "release",
        summary: "等待演示口径最终确认后生成交付说明与发布摘要。"
      }
    ],
    runs: [
      ...forgeSnapshotFixture.runs.filter((item) => item.projectId !== "retail-support"),
      {
        id: "run-law-patch",
        projectId: "law-case-platform",
        taskPackId: "artifact-law-task-pack",
        linkedComponentIds: ["component-case-workbench", "component-client-progress"],
        title: "生成示例案件协作平台主流程补丁",
        executor: "Codex",
        cost: "¥0.00",
        state: "done" as const,
        outputMode: "workspace",
        outputChecks: [
          { name: "codex", status: "pass", summary: "案件台账、任务协作、文件归档主流程联调完成" },
          { name: "model-execution", status: "pass", summary: "已输出 Demo 所需补丁与界面联调说明" }
        ]
      },
      {
        id: "run-law-playwright",
        projectId: "law-case-platform",
        taskPackId: "artifact-law-task-pack",
        linkedComponentIds: ["component-case-workbench", "component-client-progress"],
        title: "示例案件协作平台主流程回归",
        executor: "Playwright",
        cost: "¥0.00",
        state: "done" as const,
        outputMode: "workspace",
        outputChecks: [
          {
            name: "playwright",
            status: "pass",
            summary: "案件录入、任务流转、证据归档、客户进度查询已完成回归"
          }
        ]
      }
    ],
    runEvents: forgeSnapshotFixture.runEvents.filter((item) => item.projectId !== "retail-support"),
    commandExecutions: forgeSnapshotFixture.commandExecutions.map((item) =>
      item.projectId === "retail-support"
        ? {
            ...item,
            projectId: "law-case-platform",
            status: "done" as const,
            summary: "主流程回归已通过，准备进入交付发布。"
          }
        : item
    )
  };
}

describe("Forge projects page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("caps the workspace file pane width when the file drawer is open", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-projects-page.module.css"),
      "utf8"
    );

    expect(stylesheet).toMatch(
      /\.workspaceGridFilePaneOpen\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.8fr\)\s+minmax\(0,\s*0\.96fr\)\s+clamp\(280px,\s*22vw,\s*320px\)/s
    );
  });

  it("defines a dedicated split layout for 项目总控 while keeping the workspace file pane hidden", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-projects-page.module.css"),
      "utf8"
    );
    const componentSource = readFileSync(
      resolve(process.cwd(), "src/components/forge-projects-page.tsx"),
      "utf8"
    );

    expect(stylesheet).toMatch(/\.projectOverviewWorkspace\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
    expect(stylesheet).toMatch(/\.projectOverviewSidebar\s*\{[^}]*grid-template-rows:/s);
    expect(componentSource).toMatch(/!isProjectOverviewActive\s*&&\s*selectedProject\s*\?/);
  });

  it("renders important logs as compact timeline rows instead of stacked cards", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-projects-page.module.css"),
      "utf8"
    );

    expect(stylesheet).toMatch(
      /\.projectOverviewLogItem\s*\{[^}]*grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)[^}]*background:\s*transparent;[^}]*border-bottom:/s
    );
    expect(stylesheet).toMatch(/\.projectOverviewLogSummary\s*\{[^}]*display:\s*flex;/s);
  });

  it("keeps workbench create-project placeholders generic for the open-source demo", () => {
    const componentSource = readFileSync(
      resolve(process.cwd(), "src/components/forge-projects-page.tsx"),
      "utf8"
    );

    expect(componentSource).toContain("例如：搭建一个企业知识助手，支持问答、检索和工单处理。");
    expect(componentSource).toContain("例如：项目负责人");
    expect(componentSource).not.toContain("例如：Iris");
    expect(componentSource).not.toContain("例如：帮我做一个零售客服副驾驶");
  });

  it("renders project control log timestamps as concrete time points instead of 刚刚", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T09:10:00+08:00"));

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          commandExecutions: [
            {
              ...forgeSnapshotFixture.commandExecutions[0],
              id: "command-execution-relative-log",
              createdAt: "刚刚",
              summary: "项目总控已更新风险结论。"
            }
          ]
        }}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目总控/i }));

    const logRegion = screen.getByRole("region", { name: /重要日志/i });
    expect(within(logRegion).queryByText(/^刚刚$/)).not.toBeInTheDocument();
    expect(within(logRegion).getByText("03-18 09:10")).toBeInTheDocument();
  });

  it("renders the project workbench with project selector, workflow nodes, chat, and result panel", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.getByRole("main")).toHaveAttribute("data-content-layout", "full-bleed");

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    expect(selectorRegion).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /工作节点/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /AI 对话/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /节点结果/i })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: /搜索项目/i })).not.toBeInTheDocument();
    expect(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新建项目/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /生成 PRD/i })).not.toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: /项目推进台/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /项目推进轨道/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /项目态势/i })).not.toBeInTheDocument();
  });

  it("shows the project manager workbench when selecting 项目总控 under 工作节点", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目总控/i }));

    expect(screen.getByRole("region", { name: /项目总控/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /AI 对话/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /重要日志/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /计划文档/i })).toBeInTheDocument();
    expect(screen.getByText(/^项目经理$/i)).toBeInTheDocument();
    expect(screen.getByText(/支付失败回归链路待补齐/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /零售客服副驾驶/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/项目经理 AI 对话/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^项目经理 Agent$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最近关键推进记录/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/项目经理只看关键变化、风险、决策和产出/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plan 文档与完成情况/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/进行中 0 · 已阻塞 0/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /节点结果/i })).not.toBeInTheDocument();
  });

  it("shows the current data mode in 项目总控 when page data provides it", () => {
    render(
      <ForgeProjectsPage
        data={getForgeProjectsPageData(forgeSnapshotFixture, undefined, [], {
          dataMode: "demo",
          dataModeLabel: "示例模式",
          dataModeSummary: "当前展示仓库内置示例数据，适合首次体验。"
        })}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目总控/i }));

    const overviewRegion = screen.getByRole("region", { name: /项目总控/i });
    expect(within(overviewRegion).getByText("示例模式")).toBeInTheDocument();
    expect(within(overviewRegion).getByText(/当前展示仓库内置示例数据/i)).toBeInTheDocument();
  });

  it("keeps 项目总控 chat header compact without repeating the project manager agent label", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目总控/i }));

    const aiRegion = screen.getByRole("region", { name: /AI 对话/i });
    expect(within(aiRegion).getByText(/^项目经理$/i)).toBeInTheDocument();
    expect(within(aiRegion).queryByText(/^项目经理 Agent$/i)).not.toBeInTheDocument();
    expect(within(aiRegion).queryByText(/项目经理 AI 对话/i)).not.toBeInTheDocument();
  });

  it("uses the same employee display labels as the team page for workbench owners", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(getWorkflowNodeButton(nodeRegion, "后端研发"));

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    expect(within(handoffRegion).getByText(/^后端工程师 · Tiger$/i)).toBeInTheDocument();
    expect(within(handoffRegion).queryByText(/^研发 Agent$/i)).not.toBeInTheDocument();
  });

  it("shows a compact context action for the active workflow node", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    expect(within(handoffRegion).getByText(/^AI 上下文$/i)).toBeInTheDocument();
    expect(within(handoffRegion).getByRole("button", { name: /查看 AI 上下文/i })).toBeInTheDocument();
    expect(within(handoffRegion).queryByText(/可用技能/i)).not.toBeInTheDocument();
    expect(within(handoffRegion).queryByText(/可用工具/i)).not.toBeInTheDocument();
    expect(within(handoffRegion).queryByText(/关键交付物/i)).not.toBeInTheDocument();
  });

  it("shows color-coded capability badges for the active employee tools", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(getWorkflowNodeButton(nodeRegion, "后端研发"));

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    fireEvent.click(within(handoffRegion).getByRole("button", { name: /查看 AI 上下文/i }));

    const dialog = screen.getByRole("dialog", { name: /AI 上下文详情/i });
    expect(within(dialog).getByText(/^读$/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/^写$/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/^执行$/i)).toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "项目原型"));
    fireEvent.click(within(handoffRegion).getByRole("button", { name: /查看 AI 上下文/i }));
    expect(within(screen.getByRole("dialog", { name: /AI 上下文详情/i })).getByText(/^审查$/i)).toBeInTheDocument();
  });

  it("opens a context dialog to show workspace paths and execution boundaries", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    expect(within(handoffRegion).queryByText(/工作区路径/i)).not.toBeInTheDocument();
    expect(within(handoffRegion).queryByText(/执行边界/i)).not.toBeInTheDocument();

    fireEvent.click(within(handoffRegion).getByRole("button", { name: /查看 AI 上下文/i }));

    const dialog = screen.getByRole("dialog", { name: /AI 上下文详情/i });
    expect(dialog.getAttribute("style")).toContain("1040px");
    expect(dialog.getAttribute("style")).toContain("100vw - 48px");
    expect(within(dialog).getByText(/工作区路径/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/执行边界/i)).toBeInTheDocument();
    expect(within(dialog).getByText("/tmp/forge/retail-support")).toBeInTheDocument();
    expect(within(dialog).getByText(/owner 模式/i)).toBeInTheDocument();
  });

  it("shows knowledge retrieval source details in the context dialog", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    fireEvent.click(within(handoffRegion).getByRole("button", { name: /查看 AI 上下文/i }));

    const dialog = screen.getByRole("dialog", { name: /AI 上下文详情/i });

    const knowledgeHeading = within(dialog).queryByText(/知识命中/i);

    if (knowledgeHeading) {
      expect(knowledgeHeading).toBeInTheDocument();
      expect(within(dialog).getAllByText(/来源：/i).length).toBeGreaterThan(0);
      expect(within(dialog).getAllByText(/命中：/i).length).toBeGreaterThan(0);
      return;
    }

    expect(within(dialog).getByText(/当前没有额外知识摘录/i)).toBeInTheDocument();
  });

  it("shows the assigned AI employee under each workflow node in the sidebar", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });

    expect(within(nodeRegion).getAllByText(/产品总监\s*·\s*Elephant/i).length).toBeGreaterThan(0);
    expect(within(nodeRegion).getByText(/后端工程师\s*·\s*Tiger/i)).toBeInTheDocument();
    expect(within(nodeRegion).getAllByText(/测试工程师\s*·\s*Owl/i).length).toBeGreaterThan(0);
  });

  it("reflects explicit team role assignments in the workflow sidebar and handoff summary", () => {
    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          teamWorkbenchState: {
            managedAgents: [],
            roleAssignments: {
              pm: "agent-pm",
              architect: "agent-architect",
              design: "agent-design",
              engineer: "agent-dev",
              qa: "agent-design",
              release: "agent-pm",
              knowledge: "agent-qa"
            },
            manualSkillIdsByAgentId: {},
            manualKnowledgeSourcesByAgentId: {},
            removedPackSkillIdsByAgentId: {},
            equippedPackByAgentId: {},
            orgDepartments: [],
            orgChartMembers: [],
            customAbilityPacks: []
          }
        }}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    expect(within(nodeRegion).getAllByText(/UI设计师\s*·\s*Rabbit/i).length).toBeGreaterThan(0);

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "DEMO测试"));

    const handoffRegion = screen.getByRole("region", { name: /当前节点摘要/i });
    expect(within(handoffRegion).getByText(/^UI设计师 · Rabbit$/i)).toBeInTheDocument();
  });

  it("uses the shared workbench composer controls inside 项目总控", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目总控/i }));

    const aiRegion = screen.getByRole("region", { name: /AI 对话/i });
    expect(within(aiRegion).getByRole("button", { name: /添加附件/i })).toBeInTheDocument();
    expect(within(aiRegion).getByRole("combobox", { name: /选择模型/i })).toBeInTheDocument();
    expect(within(aiRegion).getByRole("combobox", { name: /思考预算/i })).toBeInTheDocument();
    expect(within(aiRegion).getByRole("button", { name: /语音录入/i })).toBeInTheDocument();
    expect(within(aiRegion).getByRole("button", { name: /发送/i })).toBeInTheDocument();
    expect(within(aiRegion).queryByText(/你可以直接问：当前最大风险是什么/i)).not.toBeInTheDocument();
  });

  it("does not render selector shortcut actions even when project operations are available", () => {
    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture}
        createWorkbenchProject={vi.fn()}
        generateWorkbenchPrd={vi.fn()}
        showNavigation
      />
    );

    expect(screen.queryByRole("button", { name: /新建项目/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /生成 PRD/i })).not.toBeInTheDocument();
  });

  it("opens a project picker dialog for searching and switching projects", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    fireEvent.click(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i }));

    const dialog = screen.getByRole("dialog", { name: /选择项目/i });
    expect(within(dialog).getByRole("searchbox", { name: /搜索项目/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /零售客服副驾驶/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /诊所知识助手/i })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("searchbox", { name: /搜索项目/i }), {
      target: { value: "诊所" }
    });

    expect(within(dialog).queryByRole("button", { name: /零售客服副驾驶/i })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /诊所知识助手/i })).toBeInTheDocument();
  });

  it("honors initial navigation context when opening a project workbench", () => {
    render(
      <ForgeProjectsPage
        initialNode="项目原型"
        initialProjectId="clinic-rag"
        snapshot={forgeSnapshotFixture}
        showNavigation
      />
    );

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    expect(
      within(selectorRegion).getByRole("button", { name: /诊所知识助手/i })
    ).toHaveAttribute("aria-pressed", "true");

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    expect(getWorkflowNodeButton(nodeRegion, "项目原型")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    expect(within(chatRegion).getByText(/当前会话还没有内容/i)).toBeInTheDocument();
  });

  it("shows lightweight feedback for switching projects and managing tabs", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    fireEvent.click(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i }));

    const dialog = screen.getByRole("dialog", { name: /选择项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /诊所知识助手/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/已切换当前项目/i);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /新增会话标签/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/已新增会话标签/i);

    fireEvent.click(within(chatRegion).getByRole("button", { name: /删除会话标签 追问/i }));
    const deleteConversationDialog = screen.getByRole("dialog", { name: /确认删除会话标签/i });
    fireEvent.click(within(deleteConversationDialog).getByRole("button", { name: /^确认删除$/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/已删除会话标签/i);

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    const nextDocumentLabel = getNextGeneratedDocumentLabel(resultRegion);
    fireEvent.click(within(resultRegion).getByRole("button", { name: /新增文档标签/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/已新增文档标签/i);

    fireEvent.click(
      within(resultRegion).getByRole("button", {
        name: new RegExp(`删除文档标签 ${nextDocumentLabel}`)
      })
    );
    const deleteDocumentDialog = screen.getByRole("dialog", { name: /确认删除文档标签/i });
    fireEvent.click(within(deleteDocumentDialog).getByRole("button", { name: /^确认删除$/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/已删除文档标签/i);
  });

  it("hydrates seeded conversation and documents for demo-ready nodes", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(within(chatRegion).getByText(/已保留失败证据/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/登录态失效，主流程在支付确认页超时/i)).toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "UI设计"));

    expect(within(chatRegion).getByText(/退款失败流程原型与交互规范/i)).toBeInTheDocument();
    expect(
      within(resultRegion).getByRole("tab", { name: /退款失败流程原型与交互规范/i })
    ).toBeInTheDocument();
  });

  it("shows the matched AI employee instead of a hard-coded generic owner label", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });

    expect(screen.getAllByText("测试工程师 · Owl").length).toBeGreaterThan(0);
    expect(screen.queryByText("测试 Agent")).not.toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "UI设计"));

    expect(screen.getAllByText("UI设计师 · Rabbit").length).toBeGreaterThan(0);
    expect(screen.queryByText("体验架构 Agent")).not.toBeInTheDocument();
  });

  it("shows real AI document tabs for each seeded workflow node", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(within(resultRegion).getByRole("tab", { name: /测试门禁与回归记录/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(resultRegion).getByRole("tab", { name: /主流程回归验证/i })).toBeInTheDocument();
    expect(within(resultRegion).queryByRole("tab", { name: /^结果 1$/i })).not.toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "项目原型"));

    expect(within(resultRegion).getByRole("tab", { name: /退款失败流程架构说明/i })).toBeInTheDocument();
    expect(within(resultRegion).getByRole("tab", { name: /退款失败主流程 TaskPack/i })).toBeInTheDocument();
  });

  it("filters workbench nodes to the selected project's AI team", () => {
    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          projectProfiles: forgeSnapshotFixture.projectProfiles.map((profile) =>
            profile.projectId === "retail-support"
              ? {
                  ...profile,
                  teamTemplateId: "team-lean-validation",
                  teamTemplateTitle: "最小验证团队"
                }
              : profile
          ),
          teamTemplates: [
            {
              id: "team-standard-delivery",
              name: "标准交付团队",
              summary: "完整交付编制",
              agentIds: ["agent-pm", "agent-architect", "agent-design", "agent-dev", "agent-qa"],
              leadAgentId: "agent-pm"
            },
            {
              id: "team-lean-validation",
              name: "最小验证团队",
              summary: "先完成需求、研发、测试和发布",
              agentIds: ["agent-pm", "agent-dev", "agent-qa"],
              leadAgentId: "agent-pm"
            }
          ]
        }}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });

    expect(queryWorkflowNodeButton(nodeRegion, "需求确认")).toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "后端研发")).toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "DEMO测试")).toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "交付发布")).toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "项目原型")).not.toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "UI设计")).not.toBeInTheDocument();
    expect(queryWorkflowNodeButton(nodeRegion, "内测调优")).not.toBeInTheDocument();
  });

  it("hydrates persisted workbench conversations, documents, and drafts from snapshot state", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "DEMO测试",
                drafts: {
                  "DEMO测试": "继续补充保存后的测试口径"
                },
                nodePanels: {
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "demo-testing-conversation-saved",
                        label: "保存会话",
                        messages: [
                      {
                        id: "saved-message-1",
                        speaker: "测试 Agent",
                        role: "ai",
                        text: "这条消息来自已保存的项目工作台会话。",
                        time: "刚刚",
                        tokenUsage: {
                          inputTokens: 128,
                          outputTokens: 256,
                          totalTokens: 384
                        }
                      }
                    ]
                  }
                ],
                    activeConversationTabId: "demo-testing-conversation-saved",
                    documentTabs: [
                      {
                        id: "demo-testing-document-saved",
                        label: "保存结果",
                        document: {
                          title: "已保存的测试结论",
                          body: "# 已保存的测试结论\n\n这里是刷新后恢复的内容。",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "demo-testing-document-saved"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(within(chatRegion).getByText(/这条消息来自已保存的项目工作台会话/i)).toBeInTheDocument();
    expect(within(chatRegion).getByRole("tab", { name: /保存会话/i })).toBeInTheDocument();
    expect(within(resultRegion).getByRole("tab", { name: /保存结果/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/这里是刷新后恢复的内容/i)).toBeInTheDocument();
    expect(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i })).toHaveValue(
      "继续补充保存后的测试口径"
    );
    expect(within(chatRegion).getByRole("button", { name: /背景信息窗口占用/i })).toBeInTheDocument();
  });

  it("reveals the active conversation context usage when hovering the window indicator", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "DEMO测试",
                drafts: {},
                nodePanels: {
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "demo-testing-conversation-window",
                        label: "上下文窗口",
                        messages: [
                          {
                            id: "window-message-1",
                            speaker: "测试 Agent",
                            role: "ai",
                            text: buildRepeatedText("测", 1200),
                            time: "刚刚"
                          }
                        ]
                      }
                    ],
                    activeConversationTabId: "demo-testing-conversation-window",
                    documentTabs: [
                      {
                        id: "demo-testing-document-window",
                        label: "结果 1",
                        document: null
                      }
                    ],
                    activeDocumentTabId: "demo-testing-document-window"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const usageIndicator = within(chatRegion).getByRole("button", { name: /背景信息窗口占用/i });

    expect(within(chatRegion).queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(usageIndicator);

    const tooltip = within(chatRegion).getByRole("tooltip");
    expect(within(tooltip).getByText(/背景信息窗口/i)).toBeInTheDocument();
    expect(within(tooltip).getByText(/0% 已用|1% 已用/i)).toBeInTheDocument();
    expect(within(tooltip).getByText(/已用 1\.2k 标记，共 258k/i)).toBeInTheDocument();

    fireEvent.mouseLeave(usageIndicator);
    expect(within(chatRegion).queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("migrates legacy generic result tabs into seeded AI documents", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "需求确认",
                drafts: {},
                nodePanels: {
                  "需求确认": {
                    conversationTabs: [
                      {
                        id: "requirement-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "requirement-conversation-main",
                    documentTabs: [
                      {
                        id: "requirement-document-legacy",
                        label: "结果 1",
                        document: {
                          title: "零售客服副驾驶 PRD 草案",
                          body: "# 零售客服副驾驶 PRD 草案\n\n## 核心目标\n- 降低退款失败率",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "requirement-document-legacy"
                  },
                  "项目原型": {
                    conversationTabs: [
                      {
                        id: "prototype-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "prototype-conversation-main",
                    documentTabs: [
                      {
                        id: "prototype-document-legacy",
                        label: "结果 1",
                        document: {
                          title: "零售客服副驾驶 项目原型总览",
                          body: "# 零售客服副驾驶 项目原型总览",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "prototype-document-legacy"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(within(resultRegion).getByRole("tab", { name: /零售客服副驾驶 PRD 草案/i })).toBeInTheDocument();
    expect(within(resultRegion).queryByRole("tab", { name: /^结果 1$/i })).not.toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "项目原型"));

    expect(within(resultRegion).getByRole("tab", { name: /退款失败流程架构说明/i })).toBeInTheDocument();
    expect(
      within(resultRegion).getByRole("tab", { name: /退款失败流程原型与交互规范/i })
    ).toBeInTheDocument();
    expect(within(resultRegion).getByRole("tab", { name: /退款失败主流程 TaskPack/i })).toBeInTheDocument();
    expect(within(resultRegion).queryByRole("tab", { name: /^结果 1$/i })).not.toBeInTheDocument();
  });

  it("refreshes stale persisted workbench deliverables when a law project still holds the old runtime-evidence copy", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...buildLawWorkbenchSnapshot(),
            projectWorkbenchState: {
              "law-case-platform": {
                selectedNode: "后端研发",
                drafts: {},
                nodePanels: {
                  "后端研发": {
                    conversationTabs: [
                      {
                        id: "law-engineering-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "law-engineering-conversation-main",
                    documentTabs: [
                      {
                        id: "law-engineering-document-legacy",
                        label: "生成示例案件协作平台主流程补丁",
                        document: {
                          title: "生成示例案件协作平台主流程补丁",
                          body:
                            "# 生成示例案件协作平台主流程补丁\n\n## 执行器\n- Codex\n\n## Runtime 证据\n- codex: 案件台账、任务协作、文件归档主流程联调完成\n- model-execution: 已输出 Demo 所需补丁与界面联调说明\n\n## 关联任务包\n- 示例案件协作平台 首轮 TaskPack",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "law-engineering-document-legacy"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    expect(within(resultRegion).getByText(/当前状态/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/实现范围/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/## 执行器/i)).not.toBeInTheDocument();
    expect(within(resultRegion).getByText(/案件工作台组件/i)).toBeInTheDocument();
  });

  it("replaces stale persisted law deliverables across prototype, design, engineering, and demo nodes", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...buildLawWorkbenchSnapshot(),
            projectWorkbenchState: {
              "law-case-platform": {
                selectedNode: "后端研发",
                drafts: {},
                nodePanels: {
                  "项目原型": {
                    conversationTabs: [
                      {
                        id: "law-prototype-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "law-prototype-conversation-main",
                    documentTabs: [
                      {
                        id: "项目原型-architecture-note",
                        label: "示例案件协作平台 架构与流程说明",
                        document: {
                          title: "示例案件协作平台 架构与流程说明",
                          body:
                            "# 示例案件协作平台 架构与流程说明\n\n## 交付状态\n\n- 状态：ready\n\n- 关联 TaskPack：示例案件协作平台 首轮 TaskPack",
                          updatedAt: "今天 14:20"
                        }
                      },
                      {
                        id: "项目原型-ui-spec",
                        label: "示例案件协作平台 原型与交互规范",
                        document: {
                          title: "示例案件协作平台 原型与交互规范",
                          body:
                            "# 示例案件协作平台 原型与交互规范\n\n## 当前收口\n\n- 页面结构、关键交互和异常态说明已同步到项目原型阶段\n\n- 状态：ready",
                          updatedAt: "今天 14:20"
                        }
                      }
                    ],
                    activeDocumentTabId: "项目原型-architecture-note"
                  },
                  "UI设计": {
                    conversationTabs: [
                      {
                        id: "law-ui-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "law-ui-conversation-main",
                    documentTabs: [
                      {
                        id: "UI设计-ui-spec",
                        label: "示例案件协作平台 原型与交互规范",
                        document: {
                          title: "示例案件协作平台 原型与交互规范",
                          body:
                            "# 示例案件协作平台 原型与交互规范\n\n## 设计结论\n\n- 支持知识问答、订单查询和支付失败处理三条主路径\n\n- 已补齐主流程、异常态和转人工兜底\n\n- 交互规范已对齐到可研发的组件边界\n\n## UI设计工作台对话\n用户输入：你好",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "UI设计-ui-spec"
                  },
                  "后端研发": {
                    conversationTabs: [
                      {
                        id: "law-engineering-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "law-engineering-conversation-main",
                    documentTabs: [
                      {
                        id: "后端研发-patch-run",
                        label: "生成示例案件协作平台主流程补丁",
                        document: {
                          title: "生成示例案件协作平台主流程补丁",
                          body:
                            "# 生成示例案件协作平台主流程补丁\n\n## 执行器\n- Codex\n\n## Runtime 证据\n- codex: 案件台账、任务协作、文件归档主流程联调完成\n- model-execution: 已输出 Demo 所需补丁与界面联调说明\n\n## 关联任务包\n- 示例案件协作平台 首轮 TaskPack",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "后端研发-patch-run"
                  },
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "law-demo-conversation-main",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "law-demo-conversation-main",
                    documentTabs: [
                      {
                        id: "DEMO测试-test-report",
                        label: "示例案件协作平台 主流程测试报告",
                        document: {
                          title: "示例案件协作平台 主流程测试报告",
                          body:
                            "# 示例案件协作平台 主流程测试报告\n\n## 评审结论\n- 主流程已经通过回归，可进入交付说明整理与演示彩排。\n\n## 回归执行\n- 示例案件协作平台主流程回归\n- 执行器：Playwright\n\n## 下一步动作\n- 正在回归案件录入、任务协作、证据归档与客户进度查询四条演示主链。\n\n## DEMO测试工作台对话\n用户输入：你好",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "DEMO测试-test-report"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));
    expect(within(resultRegion).getAllByText(/模块划分/i).length).toBeGreaterThan(0);
    expect(within(resultRegion).getAllByText(/案件中心/i).length).toBeGreaterThan(0);
    expect(within(resultRegion).getAllByText(/接口边界/i).length).toBeGreaterThan(0);

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /UI设计/i }));
    expect(within(resultRegion).getByText(/页面清单/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/研发交接/i)).toBeInTheDocument();
    expect(within(resultRegion).getAllByText(/案件工作台/i).length).toBeGreaterThan(0);
    expect(within(resultRegion).queryByText(/知识问答、订单查询和支付失败处理/i)).not.toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /后端研发/i }));
    expect(within(resultRegion).getByText(/当前状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/Runtime 证据/i)).not.toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/DEMO测试工作台对话/i)).not.toBeInTheDocument();
  });

  it("restores the saved workflow node and active tabs after refresh", () => {
    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "UI设计",
                drafts: {
                  "UI设计": "继续完善已保存的设计稿说明"
                },
                nodePanels: {
                  "UI设计": {
                    conversationTabs: [
                      {
                        id: "ui-design-conversation-main",
                        label: "主会话",
                        messages: []
                      },
                      {
                        id: "ui-design-conversation-followup",
                        label: "设计追问",
                        messages: [
                          {
                            id: "saved-design-message",
                            speaker: "设计 Agent",
                            role: "ai",
                            text: "这里是 UI 设计追问会话的已保存内容。",
                            time: "刚刚"
                          }
                        ]
                      }
                    ],
                    activeConversationTabId: "ui-design-conversation-followup",
                    documentTabs: [
                      {
                        id: "ui-design-document-main",
                        label: "结果 1",
                        document: null
                      },
                      {
                        id: "ui-design-document-followup",
                        label: "设计定稿",
                        document: {
                          title: "已保存的 UI 设计定稿",
                          body: "# 已保存的 UI 设计定稿\n\n这是上次停留的结果标签。",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "ui-design-document-followup"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(getWorkflowNodeButton(nodeRegion, "UI设计")).toHaveAttribute("aria-pressed", "true");
    expect(within(chatRegion).getByRole("tab", { name: /设计追问/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(chatRegion).getByText(/UI 设计追问会话的已保存内容/i)).toBeInTheDocument();
    expect(within(resultRegion).getByRole("tab", { name: /设计定稿/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(resultRegion).getByText(/这是上次停留的结果标签/i)).toBeInTheDocument();
  });

  it("keeps document tabs independent for each workflow node", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const nextDocumentLabel = getNextGeneratedDocumentLabel(resultRegion);

    fireEvent.click(within(resultRegion).getByRole("button", { name: /新增文档标签/i }));
    expect(within(resultRegion).getByRole("tab", { name: new RegExp(nextDocumentLabel) })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /后端研发/i }));
    expect(
      within(resultRegion).queryByRole("tab", { name: new RegExp(nextDocumentLabel) })
    ).not.toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByRole("tab", { name: new RegExp(nextDocumentLabel) })).toBeInTheDocument();
  });

  it("supports editing the active markdown result document", async () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(
      within(resultRegion).getByText(/登录态失效，主流程在支付确认页超时/i),
    ).toBeInTheDocument();

    fireEvent.click(within(resultRegion).getByRole("button", { name: /编辑正文/i }));
    fireEvent.change(
      within(resultRegion).getByRole("textbox", { name: /编辑当前文档 Markdown/i }),
      {
        target: {
          value: "# DEMO 测试记录\n\n补充后的测试结果正文",
        },
      },
    );
    fireEvent.click(within(resultRegion).getByRole("button", { name: /保存正文/i }));

    expect(
      within(resultRegion).getByText(/补充后的测试结果正文/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/已更新当前文档/i);
  });

  it("opens a right-side workspace file list while keeping chat and document panes visible", async () => {
    const getWorkspaceTreeSpy = vi
      .spyOn(forgeWorkspaceApi, "getForgeWorkspaceFileTree")
      .mockResolvedValue({
        projectId: "retail-support",
        workspaceLabel: "retail-support",
        tree: [
          {
            id: "README.md",
            name: "README.md",
            path: "README.md",
            kind: "file",
            extension: ".md"
          },
          {
            id: "notes",
            name: "notes",
            path: "notes",
            kind: "directory",
            children: [
              {
                id: "notes/intake.md",
                name: "intake.md",
                path: "notes/intake.md",
                kind: "file",
                extension: ".md"
              }
            ]
          },
          {
            id: "context",
            name: "context",
            path: "context",
            kind: "directory",
            children: [
              {
                id: "context/project-dna.json",
                name: "project-dna.json",
                path: "context/project-dna.json",
                kind: "file",
                extension: ".json"
              }
            ]
          }
        ]
      });
    const getWorkspaceFileSpy = vi
      .spyOn(forgeWorkspaceApi, "getForgeWorkspaceFile")
      .mockResolvedValue({
        file: {
          projectId: "retail-support",
          path: "README.md",
          name: "README.md",
          body: "# 零售客服副驾驶\n\n工作区说明。",
          editable: true,
          language: "markdown",
          updatedAt: "刚刚"
        }
      });

    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.queryByRole("region", { name: /工作区文件/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /打开工作区文件/i }));

    const workspaceView = await screen.findByRole("region", { name: /工作区文件/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    expect(workspaceView).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /AI 对话/i })).toBeInTheDocument();
    expect(resultRegion).toBeInTheDocument();
    expect(within(workspaceView).getByRole("button", { name: /收起工作区文件/i })).toBeInTheDocument();
    expect(within(workspaceView).getByText(/^工作区文件$/i)).toBeInTheDocument();
    expect(within(workspaceView).queryByText(/文档结构/i)).not.toBeInTheDocument();
    expect(within(workspaceView).queryByText(/真实工作区/i)).not.toBeInTheDocument();
    expect(within(workspaceView).queryByText(/^文件树$/i)).not.toBeInTheDocument();
    expect(
      within(workspaceView).queryByText(/最右侧只保留真实文件结构，正文会在文档栏中查看和编辑/i)
    ).not.toBeInTheDocument();
    expect(
      await within(workspaceView).findByRole("button", { name: /^README\.md$/i }, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(
      await within(workspaceView).findByRole("button", { name: /^notes$/i }, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(
      await within(workspaceView).findByRole("button", { name: /^intake\.md$/i }, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(await within(resultRegion).findByText(/工作区说明/i, {}, { timeout: 3000 })).toBeInTheDocument();

    expect(getWorkspaceTreeSpy).toHaveBeenCalledWith("retail-support");
    expect(getWorkspaceFileSpy).toHaveBeenCalledWith("retail-support", "README.md");
  });

  it("supports editing markdown files from the workspace file list inside the document pane", async () => {
    vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFileTree").mockResolvedValue({
      projectId: "retail-support",
      workspaceLabel: "retail-support",
      tree: [
        {
          id: "README.md",
          name: "README.md",
          path: "README.md",
          kind: "file",
          extension: ".md"
        }
      ]
    });
    vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFile").mockResolvedValue({
      file: {
        projectId: "retail-support",
        path: "README.md",
        name: "README.md",
        body: "# 零售客服副驾驶\n\n工作区说明。",
        editable: true,
        language: "markdown",
        updatedAt: "刚刚"
      }
    });
    const saveWorkspaceFileSpy = vi
      .spyOn(forgeWorkspaceApi, "saveForgeWorkspaceFile")
      .mockResolvedValue({
        file: {
          projectId: "retail-support",
          path: "README.md",
          name: "README.md",
          body: "# 零售客服副驾驶\n\n更新后的工作区说明。",
          editable: true,
          language: "markdown",
          updatedAt: "刚刚"
        }
      });

    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /打开工作区文件/i }));

    const workspaceView = await screen.findByRole("region", { name: /工作区文件/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    await within(workspaceView).findByRole("button", { name: /^README\.md$/i }, { timeout: 3000 });
    await within(resultRegion).findByText(/工作区说明/i, {}, { timeout: 3000 });

    fireEvent.click(within(resultRegion).getByRole("button", { name: /编辑 Markdown/i }));
    fireEvent.change(within(resultRegion).getByRole("textbox", { name: /编辑工作区 Markdown/i }), {
      target: {
        value: "# 零售客服副驾驶\n\n更新后的工作区说明。"
      }
    });
    fireEvent.click(within(resultRegion).getByRole("button", { name: /保存 Markdown/i }));

    await waitFor(() => {
      expect(within(resultRegion).getByText(/更新后的工作区说明/i)).toBeInTheDocument();
    });

    expect(saveWorkspaceFileSpy).toHaveBeenCalledWith({
      projectId: "retail-support",
      path: "README.md",
      body: "# 零售客服副驾驶\n\n更新后的工作区说明。"
    });
    expect(screen.getByRole("status")).toHaveTextContent(/已保存工作区 Markdown/i);
  });

  it("does not expose the debug page action without an explicit workspace mapping", () => {
    render(<ForgeProjectsPage snapshot={buildLawWorkbenchSnapshot()} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));

    expect(screen.queryByRole("button", { name: /打开调试页/i })).not.toBeInTheDocument();
  });

  it("opens the configured debug page from the right-side workbench actions when the workspace is mapped through env", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubEnv(
      "NEXT_PUBLIC_FORGE_DEBUG_WORKSPACE_MAPPINGS",
      JSON.stringify({
        "/tmp/forge/law-case-platform": "http://localhost:4100/"
      })
    );

    render(<ForgeProjectsPage snapshot={buildLawWorkbenchSnapshot()} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));

    const debugButton = screen.getByRole("button", { name: /打开调试页/i });
    fireEvent.click(debugButton);

    expect(windowOpenSpy).toHaveBeenCalledWith("http://localhost:4100/", "_blank", "noopener,noreferrer");
  });

  it("restores the saved workspace drawer state and selected file after refresh", async () => {
    vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFileTree").mockResolvedValue({
      projectId: "retail-support",
      workspaceLabel: "retail-support",
      tree: [
        {
          id: "notes",
          name: "notes",
          path: "notes",
          kind: "directory",
          children: [
            {
              id: "notes/intake.md",
              name: "intake.md",
              path: "notes/intake.md",
              kind: "file",
              extension: ".md"
            }
          ]
        },
        {
          id: "README.md",
          name: "README.md",
          path: "README.md",
          kind: "file",
          extension: ".md"
        }
      ]
    });
    const getWorkspaceFileSpy = vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFile").mockResolvedValue({
      file: {
        projectId: "retail-support",
        path: "notes/intake.md",
        name: "intake.md",
        body: "# 项目接入\n\n- 已恢复工作区选中文件",
        editable: true,
        language: "markdown",
        updatedAt: "刚刚"
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "DEMO测试",
                workspaceView: {
                  isOpen: true,
                  selectedFilePath: "notes/intake.md",
                  expandedDirectories: ["notes"]
                },
                drafts: {},
                nodePanels: {
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "demo-testing-conversation-primary",
                        label: "主会话",
                        messages: []
                      }
                    ],
                    activeConversationTabId: "demo-testing-conversation-primary",
                    documentTabs: [
                      {
                        id: "demo-testing-document-primary",
                        label: "DEMO 测试记录",
                        document: {
                          title: "DEMO 测试记录",
                          body: "# DEMO 测试记录",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "demo-testing-document-primary"
                  }
                }
              }
            }
          } as any
        }
        showNavigation
      />
    );

    const workspaceView = await screen.findByRole("region", { name: /工作区文件/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(workspaceView).toBeInTheDocument();
    expect(await within(resultRegion).findByText(/已恢复工作区选中文件/i)).toBeInTheDocument();
    expect(getWorkspaceFileSpy).toHaveBeenCalledWith("retail-support", "notes/intake.md");
  });

  it("saves the workspace drawer state, selected file, and expanded directories in the project workbench state", async () => {
    vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFileTree").mockResolvedValue({
      projectId: "retail-support",
      workspaceLabel: "retail-support",
      tree: [
        {
          id: "notes",
          name: "notes",
          path: "notes",
          kind: "directory",
          children: [
            {
              id: "notes/intake.md",
              name: "intake.md",
              path: "notes/intake.md",
              kind: "file",
              extension: ".md"
            }
          ]
        },
        {
          id: "README.md",
          name: "README.md",
          path: "README.md",
          kind: "file",
          extension: ".md"
        }
      ]
    });
    vi.spyOn(forgeWorkspaceApi, "getForgeWorkspaceFile").mockResolvedValue({
      file: {
        projectId: "retail-support",
        path: "README.md",
        name: "README.md",
        body: "# 零售客服副驾驶\n\n工作区说明。",
        editable: true,
        language: "markdown",
        updatedAt: "刚刚"
      }
    });
    const saveProjectWorkbenchState = vi.fn().mockResolvedValue({ state: {} });

    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture as any}
        saveProjectWorkbenchState={saveProjectWorkbenchState as any}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /打开工作区文件/i }));
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    await within(resultRegion).findByText(/工作区说明/i, {}, { timeout: 3000 });

    await waitFor(() => {
      expect(saveProjectWorkbenchState).toHaveBeenCalled();
    });

    expect(saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].workspaceView).toEqual(
      expect.objectContaining({
        isOpen: true,
        selectedFilePath: "notes/intake.md",
        expandedDirectories: expect.arrayContaining(["notes"])
      })
    );
  });

  it("supports deleting chat and document tabs", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(chatRegion).getByRole("button", { name: /新增会话标签/i }));
    expect(within(chatRegion).getByRole("tab", { name: /会话 3/i })).toBeInTheDocument();

    expect(within(chatRegion).getByRole("tab", { name: /追问/i })).toBeInTheDocument();
    fireEvent.click(within(chatRegion).getByRole("button", { name: /删除会话标签 追问/i }));
    const deleteConversationDialog = screen.getByRole("dialog", { name: /确认删除会话标签/i });
    fireEvent.click(within(deleteConversationDialog).getByRole("button", { name: /^确认删除$/i }));
    expect(within(chatRegion).queryByRole("tab", { name: /追问/i })).not.toBeInTheDocument();

    const nextDocumentLabel = getNextGeneratedDocumentLabel(resultRegion);
    fireEvent.click(within(resultRegion).getByRole("button", { name: /新增文档标签/i }));
    expect(within(resultRegion).getByRole("tab", { name: new RegExp(nextDocumentLabel) })).toBeInTheDocument();
    fireEvent.click(
      within(resultRegion).getByRole("button", {
        name: new RegExp(`删除文档标签 ${nextDocumentLabel}`)
      })
    );
    const deleteDocumentDialog = screen.getByRole("dialog", { name: /确认删除文档标签/i });
    fireEvent.click(within(deleteDocumentDialog).getByRole("button", { name: /^确认删除$/i }));
    expect(
      within(resultRegion).queryByRole("tab", { name: new RegExp(nextDocumentLabel) })
    ).not.toBeInTheDocument();
  });

  it("supports renaming chat and document tabs with double click", async () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);
    const user = userEvent.setup();

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    await user.dblClick(within(chatRegion).getByRole("tab", { name: /追问/i }));
    const chatRenameInput = await within(chatRegion).findByRole("textbox", {
      name: /重命名会话标签/i
    });
    fireEvent.change(chatRenameInput, { target: { value: "跟进" } });
    fireEvent.keyDown(chatRenameInput, { key: "Enter", code: "Enter" });
    expect(within(chatRegion).getByRole("tab", { name: /跟进/i })).toBeInTheDocument();

    await user.dblClick(within(resultRegion).getByRole("tab", { name: /测试门禁与回归记录/i }));
    const documentRenameInput = await within(resultRegion).findByRole("textbox", {
      name: /重命名文档标签/i
    });
    fireEvent.change(documentRenameInput, { target: { value: "修订稿" } });
    fireEvent.blur(documentRenameInput);
    expect(within(resultRegion).getByRole("tab", { name: /修订稿/i })).toBeInTheDocument();
  });

  it("keeps the chat header minimal without project meta clutter", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });

    expect(within(chatRegion).queryByRole("heading", { name: /测试 Agent/i })).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/产品经理 Agent/i)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/^你$/)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/^AI$/)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/负责回归验证与阻塞归因/i)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/负责人：/i)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/当前阶段：/i)).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/刚刚/i)).not.toBeInTheDocument();
  });

  it("uses a minimal composer without quick action clutter", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });

    expect(within(chatRegion).queryByRole("button", { name: /继续推进/i })).not.toBeInTheDocument();
    expect(within(chatRegion).queryByRole("button", { name: /补充材料/i })).not.toBeInTheDocument();
    expect(within(chatRegion).queryByRole("button", { name: /重新生成/i })).not.toBeInTheDocument();
    expect(within(chatRegion).queryByText(/当前会话仅属于/i)).not.toBeInTheDocument();
    expect(within(chatRegion).getByRole("button", { name: /添加附件/i })).toBeInTheDocument();
    expect(within(chatRegion).getByRole("combobox", { name: /选择模型/i })).toBeInTheDocument();
    expect(within(chatRegion).getByRole("combobox", { name: /思考预算/i })).toBeInTheDocument();
    expect(within(chatRegion).getByRole("button", { name: /语音录入/i })).toBeInTheDocument();
    expect(within(chatRegion).getByRole("button", { name: /发送/i })).toBeInTheDocument();
  });

  it("sends a message into the active conversation without overwriting the current result tab", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补充一版退款失败的回归口径" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    expect(within(chatRegion).getByText(/补充一版退款失败的回归口径/i)).toBeInTheDocument();
    expect(within(chatRegion).getByText(/已根据你的输入更新当前节点结果/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/补充一版退款失败的回归口径/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/已更新当前会话/i);
  });

  it("saves the project workbench state after updating the active conversation", async () => {
    vi.useFakeTimers();
    const saveProjectWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        "retail-support": {
          drafts: {
            "DEMO测试": ""
          },
          nodePanels: {
            "DEMO测试": {
              conversationTabs: [
                {
                  id: "demo-testing-conversation-primary",
                  label: "主会话",
                  messages: [
                    {
                      id: "saved-human-message",
                      speaker: "你",
                      role: "human",
                      text: "补充一版退款失败的回归口径",
                      time: "刚刚"
                    },
                    {
                      id: "saved-ai-message",
                      speaker: "测试 Agent",
                      role: "ai",
                      text: "已根据你的输入更新当前节点结果，并补进零售客服副驾驶的DEMO测试上下文。当前采用 本机默认模型，思考预算 自动。",
                      time: "刚刚"
                    }
                  ]
                }
              ],
              activeConversationTabId: "demo-testing-conversation-primary",
              documentTabs: [
                {
                  id: "demo-testing-document-primary",
                  label: "结果 1",
                  document: {
                    title: "已保存结果",
                    body: "# 已保存结果",
                    updatedAt: "刚刚"
                  }
                }
              ],
              activeDocumentTabId: "demo-testing-document-primary"
            }
          }
        }
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture as any}
        saveProjectWorkbenchState={saveProjectWorkbenchState as any}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });

    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补充一版退款失败的回归口径" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveProjectWorkbenchState).toHaveBeenCalled();
    expect(saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].drafts["DEMO测试"]).toBe("");
    expect(
      saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].nodePanels["DEMO测试"]
        .conversationTabs[0].messages
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "补充一版退款失败的回归口径"
        }),
        expect.objectContaining({
          text: expect.stringContaining("已根据你的输入更新当前节点结果")
        })
      ])
    );

    vi.useRealTimers();
  });

  it("automatically compresses oversized conversation history before persisting it", async () => {
    vi.useFakeTimers();
    const saveProjectWorkbenchState = vi.fn().mockResolvedValue({
      state: {}
    });

    render(
      <ForgeProjectsPage
        snapshot={
          {
            ...forgeSnapshotFixture,
            projectWorkbenchState: {
              "retail-support": {
                selectedNode: "DEMO测试",
                drafts: {},
                nodePanels: {
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "demo-testing-conversation-oversized",
                        label: "超长会话",
                        messages: Array.from({ length: 18 }, (_, index) => ({
                          id: `oversized-message-${index + 1}`,
                          speaker: index % 2 === 0 ? "你" : "测试 Agent",
                          role: index % 2 === 0 ? "human" : "ai",
                          text: `第${String(index + 1).padStart(2, "0")}轮 ${buildRepeatedText("测", 18000)}`,
                          time: "刚刚"
                        }))
                      }
                    ],
                    activeConversationTabId: "demo-testing-conversation-oversized",
                    documentTabs: [
                      {
                        id: "demo-testing-document-oversized",
                        label: "结果 1",
                        document: null
                      }
                    ],
                    activeDocumentTabId: "demo-testing-document-oversized"
                  }
                }
              }
            }
          } as any
        }
        saveProjectWorkbenchState={saveProjectWorkbenchState as any}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    expect(within(chatRegion).getByText(/历史会话已自动压缩/i)).toBeInTheDocument();
    expect(within(chatRegion).getByRole("button", { name: /背景信息窗口占用/i })).toBeInTheDocument();

    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补一条新的上下文" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const persistedMessages =
      saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].nodePanels["DEMO测试"]
        .conversationTabs[0].messages ?? [];

    expect(persistedMessages.some((message: { text: string }) => /历史会话已自动压缩/i.test(message.text))).toBe(
      true
    );

    vi.useRealTimers();
  });

  it("saves the selected workflow node and active tabs in the project workbench state", async () => {
    vi.useFakeTimers();
    const saveProjectWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        "retail-support": {
          selectedNode: "UI设计",
          drafts: {
            "UI设计": ""
          },
          nodePanels: {
            "UI设计": {
              conversationTabs: [
                {
                  id: "UI设计-conversation-main",
                  label: "主会话",
                  messages: [
                    {
                      id: "seed-message",
                      speaker: "设计 Agent",
                      role: "ai",
                      text: "已输出《退款失败流程原型与交互规范》，关键页面结构和异常态交互都已经收口。",
                      time: "刚刚"
                    }
                  ]
                },
                {
                  id: "UI设计-conversation-followup",
                  label: "追问",
                  messages: []
                }
              ],
              activeConversationTabId: "UI设计-conversation-followup",
              documentTabs: [
                {
                  id: "UI设计-document-1",
                  label: "结果 1",
                  document: {
                    title: "退款失败流程原型与交互规范",
                    body: "# 退款失败流程原型与交互规范",
                    updatedAt: "刚刚"
                  }
                },
                {
                  id: "UI设计-document-2",
                  label: "结果 2",
                  document: null
                }
              ],
              activeDocumentTabId: "UI设计-document-2"
            }
          }
        }
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture as any}
        saveProjectWorkbenchState={saveProjectWorkbenchState as any}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "UI设计"));
    fireEvent.click(within(chatRegion).getByRole("tab", { name: /追问/i }));
    fireEvent.click(within(resultRegion).getByRole("button", { name: /新增文档标签/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveProjectWorkbenchState).toHaveBeenCalled();
    expect(saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].selectedNode).toBe(
      "UI设计"
    );
    expect(
      saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].nodePanels["UI设计"]
        .activeConversationTabId
    ).toBe("UI设计-conversation-followup");
    expect(
      saveProjectWorkbenchState.mock.calls.at(-1)?.[0]["retail-support"].nodePanels["UI设计"]
        .activeDocumentTabId
    ).toMatch(/^UI设计-document-/);

    vi.useRealTimers();
  });

  it("executes a real workbench command and announces page refresh", async () => {
    const executeWorkbenchCommand = vi.fn().mockResolvedValue({
      execution: {
        id: "command-execution-gate-run-new",
        commandId: "command-gate-run",
        status: "done",
        summary: "测试门禁已进入真实执行链。"
      }
    });
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["claude-sonnet-4-5", "gpt-5.4"]
        }}
        executeWorkbenchCommand={executeWorkbenchCommand}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.change(screen.getByRole("combobox", { name: /选择模型/i }), {
      target: { value: "claude-sonnet-4-5" }
    });
    fireEvent.change(screen.getByRole("combobox", { name: /思考预算/i }), {
      target: { value: "高" }
    });
    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补充一版退款失败的回归口径" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await waitFor(() => {
      expect(executeWorkbenchCommand).toHaveBeenCalledWith({
        commandId: "command-gate-run",
        projectId: "retail-support",
        extraNotes: "补充一版退款失败的回归口径",
        selectedModel: "claude-sonnet-4-5",
        thinkingBudget: "高",
        triggeredBy: "测试工程师 · Owl"
      });
    });

    expect(within(chatRegion).getByText(/补充一版退款失败的回归口径/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(within(chatRegion).getByText(/测试门禁已进入真实执行链。/i)).toBeInTheDocument();
      expect(within(resultRegion).getByText(/测试门禁已进入真实执行链。/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent(/已发起真实命令执行/i);
    expect(dispatchEventSpy).toHaveBeenCalled();
    expectLastRefreshEventToInclude(dispatchEventSpy, "team");
  });

  it("renders the returned kimi reply into the conversation and result document", async () => {
    const executeWorkbenchCommand = vi.fn().mockResolvedValue({
      execution: {
        id: "command-execution-gate-run-new",
        commandId: "command-gate-run",
        status: "done",
        summary: "测试门禁已进入真实执行链。"
      },
      modelExecution: {
        providerId: "kimi",
        providerLabel: "Moonshot Kimi",
        model: "kimi-k2.5",
        status: "success",
        summary: "Moonshot Kimi · kimi-k2.5",
        content: "Kimi 建议优先补测退款失败、优惠券回退和并发重复提交三个路径。"
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["kimi-k2.5", "claude-sonnet-4-5"]
        }}
        executeWorkbenchCommand={executeWorkbenchCommand}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.change(screen.getByRole("combobox", { name: /选择模型/i }), {
      target: { value: "kimi-k2.5" }
    });
    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补充一版退款失败的回归口径" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await waitFor(() => {
      expect(executeWorkbenchCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedModel: "kimi-k2.5"
        })
      );
    });

    expect(
      within(chatRegion).getByText(/Kimi 建议优先补测退款失败、优惠券回退和并发重复提交三个路径/i)
    ).toBeInTheDocument();
    expect(within(resultRegion).getByText(/模型回复：Moonshot Kimi · kimi-k2.5/i)).toBeInTheDocument();
    expect(
      within(resultRegion).getByText(/Kimi 建议优先补测退款失败、优惠券回退和并发重复提交三个路径/i)
    ).toBeInTheDocument();
  });

  it("renders the returned kimi coding reply into the conversation and result document", async () => {
    const executeWorkbenchCommand = vi.fn().mockResolvedValue({
      execution: {
        id: "command-execution-prd-generate-new",
        commandId: "command-prd-generate",
        status: "done",
        summary: "PRD 草案已进入真实执行链。"
      },
      modelExecution: {
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success",
        summary: "Kimi Coding · k2p5",
        content: "Kimi Coding 建议先修复退款失败幂等、优惠券回滚和支付超时三条主链路。"
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["k2p5", "kimi-k2.5"]
        }}
        executeWorkbenchCommand={executeWorkbenchCommand}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.change(screen.getByRole("combobox", { name: /选择模型/i }), {
      target: { value: "k2p5" }
    });
    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "补充退款失败的代码修复建议" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await waitFor(() => {
      expect(executeWorkbenchCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedModel: "k2p5"
        })
      );
    });

    expect(
      within(chatRegion).getByText(/Kimi Coding 建议先修复退款失败幂等、优惠券回滚和支付超时三条主链路/i)
    ).toBeInTheDocument();
    expect(within(resultRegion).getByText(/模型回复：Kimi Coding · k2p5/i)).toBeInTheDocument();
    expect(
      within(resultRegion).getByText(/Kimi Coding 建议先修复退款失败幂等、优惠券回滚和支付超时三条主链路/i)
    ).toBeInTheDocument();
  });

  it("uses pure workbench chat for normal conversation instead of executing the active node command", async () => {
    const sendWorkbenchChatMessage = vi.fn().mockResolvedValue({
      modelExecution: {
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success",
        summary: "Kimi Coding · k2p5",
        message: "Kimi Coding 已生成工作台回复。",
        content: "在的，我现在可以正常回复你。",
        tokenUsage: {
          inputTokens: 128,
          outputTokens: 256,
          totalTokens: 384
        }
      }
    });
    const executeWorkbenchCommand = vi.fn();

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["k2p5"]
        }}
        executeWorkbenchCommand={executeWorkbenchCommand}
        sendWorkbenchChatMessage={sendWorkbenchChatMessage}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "在吗" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    await waitFor(() => {
      expect(sendWorkbenchChatMessage).toHaveBeenCalledWith({
        projectId: "retail-support",
        prompt: "在吗",
        selectedModel: "k2p5",
        thinkingBudget: "自动",
        triggeredBy: "测试工程师 · Owl",
        workbenchNode: "DEMO测试"
      });
    });

    expect(executeWorkbenchCommand).not.toHaveBeenCalled();
    expect(within(chatRegion).getByText(/在的，我现在可以正常回复你/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/在的，我现在可以正常回复你/i)).not.toBeInTheDocument();
    expect(within(chatRegion).getByRole("button", { name: /背景信息窗口占用/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/已收到真实模型回复/i);
  });

  it("renders the user message immediately and disables repeat send while waiting for a real model reply", async () => {
    let resolveReply: ((value: SendForgeWorkbenchChatResult) => void) | null = null;
    const sendWorkbenchChatMessage = vi.fn(
      () =>
        new Promise<SendForgeWorkbenchChatResult>((resolve) => {
          resolveReply = resolve;
        })
    );

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["k2p5"]
        }}
        sendWorkbenchChatMessage={sendWorkbenchChatMessage}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    const composer = within(chatRegion).getByRole("textbox", { name: /继续输入内容/i });
    const sendButton = within(chatRegion).getByRole("button", { name: /发送/i });

    fireEvent.change(composer, {
      target: { value: "在吗" }
    });
    fireEvent.click(sendButton);

    expect(within(chatRegion).getByText(/^在吗$/i)).toBeInTheDocument();
    expect(within(chatRegion).getByText(/正在回复/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/正在等待模型回复/i)).not.toBeInTheDocument();
    expect(composer).toHaveValue("");
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(sendWorkbenchChatMessage).toHaveBeenCalledTimes(1);

    resolveReply?.({
      modelExecution: {
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success",
        summary: "Kimi Coding · k2p5",
        message: "Kimi Coding 已生成工作台回复。",
        content: "在的，我现在可以正常回复你。"
      }
    });

    await waitFor(() => {
      expect(within(chatRegion).getByText(/在的，我现在可以正常回复你/i)).toBeInTheDocument();
    });
    expect(within(chatRegion).queryByText(/正在回复/i)).not.toBeInTheDocument();
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/在的，我现在可以正常回复你/i)).not.toBeInTheDocument();
  });

  it("sends the active composer message when Enter is pressed", async () => {
    const executeWorkbenchCommand = vi.fn().mockResolvedValue({
      execution: {
        id: "command-execution-prd-generate-new",
        commandId: "command-prd-generate",
        status: "done",
        summary: "PRD 草案已进入真实执行链。"
      },
      modelExecution: {
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success",
        summary: "Kimi Coding · k2p5",
        content: "Kimi Coding 已收到你的消息。"
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["k2p5"]
        }}
        executeWorkbenchCommand={executeWorkbenchCommand}
        showNavigation
      />
    );

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const composer = within(chatRegion).getByRole("textbox", { name: /继续输入内容/i });

    fireEvent.change(composer, {
      target: { value: "请直接告诉我你现在能不能正常工作" }
    });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(executeWorkbenchCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          extraNotes: "请直接告诉我你现在能不能正常工作",
          selectedModel: "k2p5"
        })
      );
    });
  });

  it("renders workbench model options from the projects page contract when provided", () => {
    render(
      <ForgeProjectsPage
        snapshot={{
          ...forgeSnapshotFixture,
          availableModelOptions: ["gpt-5.4", "gemini-2.5-pro"],
          modelProviderSummary: "已在本机配置 2 个模型供应商：OpenAI / Google Gemini。"
        }}
        showNavigation
      />
    );

    expect(screen.getByRole("option", { name: /gpt-5\.4/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /gemini-2\.5-pro/i })).toBeInTheDocument();
    expect(screen.queryByText(/已在本机配置 2 个模型供应商/i)).not.toBeInTheDocument();
  });

  it("activates the selected project through the real project route and announces page refresh", async () => {
    const activateWorkbenchProject = vi.fn().mockResolvedValue({
      activeProjectId: "clinic-rag",
      project: {
        id: "clinic-rag",
        name: "诊所知识助手"
      }
    });
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture}
        activateWorkbenchProject={activateWorkbenchProject}
        showNavigation
      />
    );

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    fireEvent.click(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i }));

    const dialog = screen.getByRole("dialog", { name: /选择项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /诊所知识助手/i }));

    await waitFor(() => {
      expect(activateWorkbenchProject).toHaveBeenCalledWith("clinic-rag");
    });

    expect(screen.getByRole("status")).toHaveTextContent(/已切换当前项目/i);
    expect(dispatchEventSpy).toHaveBeenCalled();
    expectLastRefreshEventToInclude(dispatchEventSpy, "team");
  });

  it("keeps local workbench edits when switching away from a project and back", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    fireEvent.change(within(chatRegion).getByRole("textbox", { name: /继续输入内容/i }), {
      target: { value: "记录这次退款失败回归结论" }
    });
    fireEvent.click(within(chatRegion).getByRole("button", { name: /发送/i }));

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    fireEvent.click(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i }));

    let dialog = screen.getByRole("dialog", { name: /选择项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /诊所知识助手/i }));

    fireEvent.click(within(selectorRegion).getByRole("button", { name: /诊所知识助手/i }));
    dialog = screen.getByRole("dialog", { name: /选择项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /零售客服副驾驶/i }));

    expect(within(chatRegion).getByText(/记录这次退款失败回归结论/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).queryByText(/记录这次退款失败回归结论/i)).not.toBeInTheDocument();
  });

  it("renders seeded handoff and staged results for the retail delivery chain", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /需求确认/i }));
    expect(screen.getByText(/当前负责人/i)).toBeInTheDocument();
    expect(screen.getAllByText(/产品总监 · Elephant/i).length).toBeGreaterThan(0);
    expect(within(resultRegion).getByText(/降低退款失败率/i)).toBeInTheDocument();

    fireEvent.click(getWorkflowNodeButton(nodeRegion, "项目原型"));
    expect(within(resultRegion).getByRole("tab", { name: /退款失败流程架构说明/i })).toBeInTheDocument();
    expect(
      within(resultRegion).getByRole("tab", { name: /退款失败流程原型与交互规范/i })
    ).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /后端研发/i }));
    expect(within(resultRegion).getByRole("tab", { name: /生成退款失败补丁/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/Claude Code/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByText(/登录态失效，主流程在支付确认页超时/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/放行建议/i)).toBeInTheDocument();
  });

  it("renders formal workbench deliverables from runtime evidence, reviews, and tasks", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /后端研发/i }));
    expect(within(resultRegion).getByText(/当前状态/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/\$0.91/)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/邮箱登录组件/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/补齐 Demo 评审修改项/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByText(/门禁状态/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/Playwright：失败/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/补齐支付失败异常态/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/修复 Playwright 失败并重新回归/i)).toBeInTheDocument();
  });

  it("renders law case management deliverables with case-workbench language instead of retail support copy", () => {
    render(<ForgeProjectsPage snapshot={buildLawWorkbenchSnapshot()} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));
    expect(within(resultRegion).getAllByText(/案件中心/).length).toBeGreaterThan(0);
    expect(within(resultRegion).getAllByText(/案件日志/).length).toBeGreaterThan(0);

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /UI设计/i }));
    expect(within(resultRegion).getAllByText(/案件工作台/).length).toBeGreaterThan(0);
    expect(within(resultRegion).getAllByText(/客户进度查询/).length).toBeGreaterThan(0);
    expect(within(resultRegion).queryByText(/知识问答、订单查询和支付失败处理/i)).not.toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByText(/案件录入/)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/证据归档/)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));
    expect(within(resultRegion).getByText(/交付清单/)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/案件工作台阶段推进/)).toBeInTheDocument();
  });

  it("renders MetaGPT-style formal sections for requirement, prototype, and design deliverables", () => {
    render(<ForgeProjectsPage snapshot={buildLawWorkbenchSnapshot()} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /需求确认/i }));
    expect(within(resultRegion).getByText(/用户故事/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/验收标准/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));
    expect(within(resultRegion).getByText(/模块划分/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/接口边界/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/任务拆分/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /UI设计/i }));
    expect(within(resultRegion).getByText(/页面清单/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/交互规则/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/异常态/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/研发交接/i)).toBeInTheDocument();
  });

  it("renders formal sections for engineering, testing, and release deliverables", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /后端研发/i }));
    expect(within(resultRegion).getByText(/实现范围/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/关键改动/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/运行验证/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/风险与待补/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /DEMO测试/i }));
    expect(within(resultRegion).getByText(/测试结论/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/测试范围/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/整改建议/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/放行建议/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));
    expect(within(resultRegion).getByText(/交付清单/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/发布条件/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/已就绪项/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/发布结论/i)).toBeInTheDocument();
  });

  it("renders visual previews for prototype and UI design deliverables", () => {
    render(<ForgeProjectsPage snapshot={buildLawWorkbenchSnapshot()} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /项目原型/i }));
    expect(within(resultRegion).getByRole("region", { name: /原型预览/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/阶段轨道工作区/i)).toBeInTheDocument();

    fireEvent.click(within(nodeRegion).getByRole("button", { name: /UI设计/i }));
    expect(within(resultRegion).getByRole("region", { name: /设计稿预览/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/客户端进度页/i)).toBeInTheDocument();
  });

  it("keeps the workflow node rail minimal without secondary description copy", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });

    expect(
      within(nodeRegion).queryByText(/客户原始需求已整理成结构化 PRD，可直接进入后续节点讲解/i)
    ).not.toBeInTheDocument();
    expect(
      within(nodeRegion).queryByText(/研发执行已经产出补丁和 Demo 构建，可直接展示运行证据/i)
    ).not.toBeInTheDocument();
  });

  it("shows a one-click deploy action in the release node and routes it through release approval", async () => {
    const executeWorkbenchCommand = vi.fn().mockResolvedValue({
      execution: {
        id: "command-execution-release-approve",
        commandId: "command-release-approve",
        status: "done",
        summary: "交付已确认并生成演示预览地址。"
      }
    });

    render(
      <ForgeProjectsPage
        snapshot={forgeSnapshotFixture}
        executeWorkbenchCommand={executeWorkbenchCommand}
        showNavigation
      />
    );

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));

    fireEvent.click(screen.getByRole("button", { name: /一键部署/i }));

    await waitFor(() => {
      expect(executeWorkbenchCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          commandId: "command-release-approve",
          projectId: "retail-support"
        })
      );
    });

    expect(screen.getByRole("status")).toHaveTextContent(/交付已确认/i);
  });

  it("shows a formal release readiness deliverable when the selected node has no release artifact yet", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    expect(within(resultRegion).getByRole("tab", { name: /交付准备清单/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/Playwright 门禁失败/i)).toBeInTheDocument();
    expect(within(resultRegion).getByText(/修复 Playwright 失败并重新回归/i)).toBeInTheDocument();
  });

  it("keeps the deployment result visible after the project advances to archive stage", () => {
    const archivedSnapshot = {
      ...forgeSnapshotFixture,
      workflowStates: forgeSnapshotFixture.workflowStates.map((item) =>
        item.projectId === "retail-support"
          ? {
              ...item,
              currentStage: "归档复用" as const,
              state: "current" as const,
              blockers: []
            }
          : item
      )
    };

    render(<ForgeProjectsPage snapshot={archivedSnapshot} showNavigation />);

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    expect(within(selectorRegion).getByRole("button", { name: /已完成/i })).toBeInTheDocument();

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));

    expect(screen.getAllByText(/部署演示已完成，项目进入归档复用/i).length).toBeGreaterThan(0);

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });
    expect(within(resultRegion).getByRole("tab", { name: /部署结果/i })).toBeInTheDocument();
    expect(within(resultRegion).getByText(/交付链路已经闭环/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /一键部署/i })).not.toBeInTheDocument();
  });

  it("keeps result panel minimal without large header block", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const resultRegion = screen.getByRole("region", { name: /节点结果/i });

    expect(within(resultRegion).queryByText(/文档结果/i)).not.toBeInTheDocument();
    expect(within(resultRegion).queryByText(/最近更新：/i)).not.toBeInTheDocument();
    expect(within(resultRegion).queryByRole("heading", { name: /测试验证记录/i })).not.toBeInTheDocument();
    expect(within(resultRegion).queryByRole("heading", { name: /零售客服副驾驶 PRD 草案/i })).not.toBeInTheDocument();
  });

  it("keeps the workbench in fixed-height panels with internal scroll regions", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.getByTestId("project-workspace-grid")).toBeInTheDocument();
    expect(screen.getByTestId("project-chat-scroll")).toBeInTheDocument();
    expect(screen.getByTestId("project-document-scroll")).toBeInTheDocument();
  });

  it("collapses the left sidebar and keeps the workbench content available", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.getByTestId("sidebar-rail-toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /收起侧边栏/i }));

    expect(screen.getByRole("button", { name: /展开侧边栏/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /项目选择/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /工作节点/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /AI 对话/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /节点结果/i })).toBeInTheDocument();
  });

  it("resets the active workflow node when switching to another project", () => {
    render(<ForgeProjectsPage snapshot={forgeSnapshotFixture} showNavigation />);

    const nodeRegion = screen.getByRole("region", { name: /工作节点/i });
    fireEvent.click(within(nodeRegion).getByRole("button", { name: /交付发布/i }));

    const selectorRegion = screen.getByRole("region", { name: /项目选择/i });
    fireEvent.click(within(selectorRegion).getByRole("button", { name: /零售客服副驾驶/i }));
    const dialog = screen.getByRole("dialog", { name: /选择项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /诊所知识助手/i }));

    const chatRegion = screen.getByRole("region", { name: /AI 对话/i });
    expect(within(chatRegion).getByRole("tab", { name: /主会话/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(getWorkflowNodeButton(nodeRegion, "项目原型")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
