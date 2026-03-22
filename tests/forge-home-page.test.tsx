import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgeHomePage from "../src/components/forge-home-page";
import { getRelativeTimeSortValue } from "../src/components/forge-console-utils";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

describe("Forge home page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    routerPush.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the dashboard as a dense portfolio decision desk", () => {
    render(
      <ForgeHomePage
        snapshot={forgeSnapshotFixture}
        createWorkbenchProject={vi.fn()}
        showNavigation
      />
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-content-layout", "full-bleed");
    expect(screen.queryByRole("region", { name: /项目组合决策/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^仪表盘$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /项目操盘台/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^项目总览$/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/来源筛选与搜索会叠加生效，先收紧事项来源，再进入具体项目动作。/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^项目动态$/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^今日重点$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /刷新项目/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /刷新汇报/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新建项目/i })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /搜索项目/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /排序规则/i })).toBeInTheDocument();
    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByRole("button", { name: /进行中 2/i })).toBeInTheDocument();
    expect(within(projectRegion).getByRole("button", { name: /已完成 0/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /全部项目/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /异常项目/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /我关注的项目/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^合作企业$/i)).toBeInTheDocument();
    expect(screen.getByText(/^项目名$/i)).toBeInTheDocument();
    expect(screen.getByText(/^阶段$/i)).toBeInTheDocument();
    expect(screen.getByText(/^计划$/i)).toBeInTheDocument();
    expect(screen.getByText(/^交付时间$/i)).toBeInTheDocument();
    expect(screen.getByText(/^编辑$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^进度$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^备注$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/左侧按事项来源切首页内容/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /进入项目管理/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/首页定位/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /风险与提醒/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/控制台 \/ 仪表盘/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /查看项目池/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开协作中心/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/项目摘要/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/当前阶段 DEMO测试/i)).not.toBeInTheDocument();
  });

  it("creates a new project from the home page dialog and jumps into project management", async () => {
    const createWorkbenchProject = vi.fn().mockResolvedValue({
      activeProjectId: "home-retail-demo",
      project: {
        id: "home-retail-demo",
        name: "首页零售客服副驾驶"
      }
    });
    const snapshotWithTeamTemplates = {
      ...forgeSnapshotFixture,
      teamTemplates: [
        {
          id: "team-standard-delivery",
          name: "标准交付团队",
          summary: "覆盖需求、方案、设计、研发、测试、发布和沉淀的完整研发编制。",
          agentIds: ["agent-pm", "agent-architect", "agent-design", "agent-dev", "agent-qa"],
          leadAgentId: "agent-pm"
        },
        {
          id: "team-lean-validation",
          name: "最小验证团队",
          summary: "先完成需求、研发、测试和发布，适合快速验证 DEMO。",
          agentIds: ["agent-pm", "agent-dev", "agent-qa"],
          leadAgentId: "agent-pm"
        },
        {
          id: "team-design-sprint",
          name: "设计冲刺团队",
          summary: "以需求、原型、设计和研发为主，适合快速出方案和界面。",
          agentIds: ["agent-pm", "agent-architect", "agent-design", "agent-dev"],
          leadAgentId: "agent-pm"
        }
      ]
    };

    render(
      <ForgeHomePage
        snapshot={snapshotWithTeamTemplates}
        createWorkbenchProject={createWorkbenchProject}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建项目/i }));

    const dialog = screen.getByRole("dialog", { name: /新建项目/i });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /客户需求/i }), {
      target: {
        value: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。"
      }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /企业名称/i }), {
      target: { value: "百川零售" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /项目名称/i }), {
      target: { value: "首页零售客服副驾驶" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /所属行业/i }), {
      target: { value: "智能客服 / 零售" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /项目类型/i }), {
      target: { value: "客服副驾驶" }
    });
    expect(within(dialog).getByRole("option", { name: /标准交付团队/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /最小验证团队/i })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("combobox", { name: /AI团队/i }), {
      target: { value: "team-design-sprint" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /负责人/i }), {
      target: { value: "Iris" }
    });
    fireEvent.change(within(dialog).getByLabelText(/交付时间/i), {
      target: { value: "2026-03-22" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /备注/i }), {
      target: { value: "周六演示优先展示订单查询与支付失败闭环。" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /创建项目/i }));

    await waitFor(() => {
      expect(createWorkbenchProject).toHaveBeenCalledWith({
        requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
        enterpriseName: "百川零售",
        name: "首页零售客服副驾驶",
        sector: "智能客服 / 零售",
        projectType: "客服副驾驶",
        teamTemplateId: "team-design-sprint",
        owner: "Iris",
        deliveryDate: "2026-03-22",
        note: "周六演示优先展示订单查询与支付失败闭环。"
      });
    });

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/projects?projectId=home-retail-demo");
    });
    expect(screen.getByRole("status")).toHaveTextContent(/已创建项目，正在进入项目管理/i);
  });

  it("uses open-source-friendly generic placeholders in the create project dialog", () => {
    const createWorkbenchProject = vi.fn();

    render(
      <ForgeHomePage
        snapshot={forgeSnapshotFixture}
        createWorkbenchProject={createWorkbenchProject}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建项目/i }));

    const dialog = screen.getByRole("dialog", { name: /新建项目/i });

    expect(within(dialog).getByPlaceholderText(/企业知识助手，支持问答、检索和工单处理/i)).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(/示例企业/i)).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(/项目负责人/i)).toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText(/零售客服副驾驶/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText(/^例如：Iris$/i)).not.toBeInTheDocument();
  });

  it("shows project rows with enterprise, name, stage, plan, delivery time, and edit action", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/百川零售/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/测试验证/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/修复 Playwright 失败并重新回归/i)).toBeInTheDocument();
    expect(within(projectRegion).getAllByText(/^\d{2}-\d{2}$/i).length).toBeGreaterThan(0);
    expect(within(projectRegion).queryByText(/^\d{4}-\d{2}-\d{2}$/i)).not.toBeInTheDocument();
    expect(within(projectRegion).getByRole("button", { name: /编辑 零售客服副驾驶/i })).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/^72%$/i)).not.toBeInTheDocument();
    expect(within(projectRegion).queryByText(/请 测试 Agent 先解除阻塞，再继续推进/i)).not.toBeInTheDocument();
  });

  it("shows the current data mode in the 项目总览 header when page data provides it", () => {
    render(
      <ForgeHomePage
        data={{
          ...forgeSnapshotFixture,
          dataMode: "demo",
          dataModeLabel: "示例模式",
          dataModeSummary: "当前展示仓库内置示例数据，适合首次体验。"
        }}
      />
    );

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });

    expect(within(projectRegion).getByText("示例模式")).toBeInTheDocument();
    expect(within(projectRegion).getByText(/当前展示仓库内置示例数据/i)).toBeInTheDocument();
  });

  it("centers the edit column header and action cell", () => {
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-home-page.module.css"),
      "utf8"
    );

    expect(stylesheet).toMatch(/\.projectOpsHead th:last-child\s*\{[^}]*text-align:\s*center;/s);
    expect(stylesheet).toMatch(/\.projectOpsEdit\s*\{[^}]*text-align:\s*center;[^}]*vertical-align:\s*middle/s);
  });

  it("uses completion copy in the plan column for completed projects", () => {
    const completedSnapshot = {
      ...forgeSnapshotFixture,
      projects: forgeSnapshotFixture.projects.map((project, index) =>
        index === 0 ? { ...project, progress: 100 } : project
      ),
      workflowStates: forgeSnapshotFixture.workflowStates.map((workflow, index) =>
        index === 0 ? { ...workflow, currentStage: "归档复用", blockers: [] } : workflow
      )
    };

    render(<ForgeHomePage snapshot={completedSnapshot} />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/已完成该项目并沉淀归档/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/项目已完成，无需继续推进/i)).not.toBeInTheDocument();
  });

  it("normalizes fallback relative time labels into explicit dates", () => {
    const snapshotWithFallbackTime = {
      ...forgeSnapshotFixture,
      projects: forgeSnapshotFixture.projects.map((project, index) =>
        index === 0 ? { ...project, lastRun: "刚刚" } : project
      ),
      workflowStates: forgeSnapshotFixture.workflowStates.map((workflow, index) =>
        index === 0 ? { ...workflow, lastTransitionAt: "刚刚" } : workflow
      )
    };

    render(<ForgeHomePage snapshot={snapshotWithFallbackTime} />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getAllByText(/^\d{2}-\d{2}$/i).length).toBeGreaterThan(0);
    expect(within(projectRegion).queryByText(/^\d{4}-\d{2}-\d{2}$/i)).not.toBeInTheDocument();
    expect(within(projectRegion).queryByText(/^刚刚$/i)).not.toBeInTheDocument();
  });

  it("normalizes relative update times into a stable sort value", () => {
    const now = new Date("2026-03-15T11:20:00+08:00");
    const ordered = ["今天 09:40", "刚刚", "今天 11:10", "1 小时前"].sort(
      (left, right) => getRelativeTimeSortValue(right, now) - getRelativeTimeSortValue(left, now)
    );

    expect(ordered).toEqual(["刚刚", "今天 11:10", "今天 09:40", "1 小时前"]);
  });

  it("defaults to all projects without preselecting a source stage", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const sourceRegion = screen.getByRole("region", { name: /事项来源/i });
    const pressedButtons = within(sourceRegion)
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/修复 Playwright 失败并重新回归/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/补齐热更新架构说明/i)).toBeInTheDocument();
    expect(pressedButtons).toHaveLength(0);
  });

  it("shows a source-stage sidebar that filters the project desk", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const sourceRegion = screen.getByRole("region", { name: /事项来源/i });
    expect(within(sourceRegion).getByRole("button", { name: /需求确认/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /项目原型/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /UI设计/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /后端研发/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /DEMO测试/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /内测调优/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /交付发布/i })).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /已完成/i })).toBeInTheDocument();

    const prototypeButton = within(sourceRegion).getByRole("button", { name: /项目原型/i });
    fireEvent.click(prototypeButton);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/补齐热更新架构说明/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/零售客服副驾驶/i)).not.toBeInTheDocument();

    const demoButton = within(sourceRegion).getByRole("button", { name: /DEMO测试/i });
    fireEvent.click(demoButton);

    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/诊所知识助手/i)).not.toBeInTheDocument();
  });

  it("lets the same source-stage button clear the filter back to all projects", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const sourceRegion = screen.getByRole("region", { name: /事项来源/i });
    const prototypeButton = within(sourceRegion).getByRole("button", { name: /项目原型/i });

    fireEvent.click(prototypeButton);
    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/零售客服副驾驶/i)).not.toBeInTheDocument();

    fireEvent.click(prototypeButton);
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();
    expect(within(sourceRegion).getByRole("button", { name: /项目原型/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("filters projects from the search box", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const searchInput = screen.getByRole("searchbox", { name: /搜索项目/i });
    fireEvent.change(searchInput, { target: { value: "诊所" } });

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/零售客服副驾驶/i)).not.toBeInTheDocument();
  });

  it("lets the search toolbar switch project sorting rules", () => {
    const sortableSnapshot = {
      ...forgeSnapshotFixture,
      projects: [
        ...forgeSnapshotFixture.projects,
        {
          id: "knowledge-base",
          name: "企业知识底座",
          requirement: "帮我搭建一个企业知识底座，用于客服和内部问答。",
          enterpriseName: "星河企业",
          sector: "企业知识库",
          projectType: "知识底座",
          owner: "Rin",
          deliveryDate: "2026-03-20",
          note: "优先补齐检索结构和首批知识文档。",
          status: "active" as const,
          lastRun: "30 分钟前",
          progress: 95,
          riskNote: ""
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates,
        {
          projectId: "knowledge-base",
          currentStage: "开发执行",
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 08:50",
          updatedBy: "system"
        }
      ]
    };

    render(<ForgeHomePage snapshot={sortableSnapshot} showNavigation />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    const getProjectOrder = () =>
      within(projectRegion)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByRole("link").textContent)
        .filter((value): value is string => Boolean(value));

    expect(getProjectOrder()).toEqual(["零售客服副驾驶", "诊所知识助手", "企业知识底座"]);

    fireEvent.change(screen.getByRole("combobox", { name: /排序规则/i }), {
      target: { value: "progress" }
    });
    expect(getProjectOrder()).toEqual(["企业知识底座", "零售客服副驾驶", "诊所知识助手"]);

    fireEvent.change(screen.getByRole("combobox", { name: /排序规则/i }), {
      target: { value: "delivery" }
    });
    expect(getProjectOrder()).toEqual(["企业知识底座", "零售客服副驾驶", "诊所知识助手"]);

    fireEvent.change(screen.getByRole("combobox", { name: /排序规则/i }), {
      target: { value: "recent" }
    });
    expect(getProjectOrder()).toEqual(["零售客服副驾驶", "诊所知识助手", "企业知识底座"]);
  });

  it("lets the summary progress chips filter in-progress and completed projects", () => {
    const snapshotWithCompleted = {
      ...forgeSnapshotFixture,
      projects: [
        ...forgeSnapshotFixture.projects,
        {
          id: "archive-center",
          name: "合同归档中心",
          requirement: "帮律所做一个合同归档与检索中心。",
          enterpriseName: "衡川律所",
          sector: "法务协作",
          projectType: "归档平台",
          owner: "Yuna",
          deliveryDate: "2026-03-18",
          note: "归档流转和检索演示已完成。",
          status: "done" as const,
          lastRun: "昨天 18:20",
          progress: 100,
          riskNote: ""
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates,
        {
          projectId: "archive-center",
          currentStage: "归档复用",
          state: "done" as const,
          blockers: [],
          lastTransitionAt: "昨天 18:20",
          updatedBy: "system"
        }
      ]
    };

    render(<ForgeHomePage snapshot={snapshotWithCompleted} showNavigation />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(screen.getByRole("button", { name: /进行中 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /已完成 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /已完成 1/i }));
    expect(within(projectRegion).getByText(/合同归档中心/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/零售客服副驾驶/i)).not.toBeInTheDocument();
    expect(within(projectRegion).queryByText(/诊所知识助手/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /进行中 2/i }));
    expect(within(projectRegion).getByText(/零售客服副驾驶/i)).toBeInTheDocument();
    expect(within(projectRegion).getByText(/诊所知识助手/i)).toBeInTheDocument();
    expect(within(projectRegion).queryByText(/合同归档中心/i)).not.toBeInTheDocument();
  });

  it("uses a dedicated completed tone for archived project stage badges", () => {
    const componentSource = readFileSync(
      resolve(process.cwd(), "src/components/forge-home-page.tsx"),
      "utf8"
    );
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-home-page.module.css"),
      "utf8"
    );

    expect(componentSource).toMatch(/isCompletedProjectStage\(project\.stage\)\s*\?\s*styles\.stageBadgeDone/s);
    expect(stylesheet).toMatch(/\.stageBadgeDone\s*\{/);
  });

  it("keeps source-stage filtering active while searching", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const sourceRegion = screen.getByRole("region", { name: /事项来源/i });
    fireEvent.click(within(sourceRegion).getByRole("button", { name: /项目原型/i }));

    const searchInput = screen.getByRole("searchbox", { name: /搜索项目/i });
    fireEvent.change(searchInput, { target: { value: "零售" } });

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    expect(within(projectRegion).queryByText(/零售客服副驾驶/i)).not.toBeInTheDocument();
    expect(within(projectRegion).queryByText(/诊所知识助手/i)).not.toBeInTheDocument();
    expect(within(projectRegion).getByText(/当前来源阶段还没有可展示的项目/i)).toBeInTheDocument();
  });

  it("shows a project activity panel instead of repeating project details", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const actionRegion = screen.getByRole("region", { name: /项目动态/i });
    expect(within(actionRegion).queryByText(/当前计划/i)).not.toBeInTheDocument();
    expect(within(actionRegion).queryByText(/下一步动作/i)).not.toBeInTheDocument();
    expect(within(actionRegion).queryByText(/相关事项/i)).not.toBeInTheDocument();
    expect(within(actionRegion).getByText(/待补料/i)).toBeInTheDocument();
    expect(within(actionRegion).getByText(/待确认/i)).toBeInTheDocument();
    expect(within(actionRegion).getByRole("link", { name: /进入 零售客服副驾驶 项目工作台/i })).toBeInTheDocument();
    expect(within(actionRegion).getByRole("link", { name: /进入 诊所知识助手 项目工作台/i })).toBeInTheDocument();
  });

  it("offers direct action links from the project activity panel into the matching project node", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const actionRegion = screen.getByRole("region", { name: /项目动态/i });
    const retailLink = within(actionRegion).getByRole("link", {
      name: /进入 零售客服副驾驶 项目工作台/i
    });
    const clinicLink = within(actionRegion).getByRole("link", {
      name: /进入 诊所知识助手 项目工作台/i
    });

    expect(retailLink).toHaveAttribute(
      "href",
      expect.stringContaining("/projects?projectId=retail-support")
    );
    expect(retailLink).toHaveAttribute("href", expect.stringContaining("node=DEMO%E6%B5%8B%E8%AF%95"));
    expect(clinicLink).toHaveAttribute(
      "href",
      expect.stringContaining("/projects?projectId=clinic-rag")
    );
    expect(clinicLink).toHaveAttribute(
      "href",
      expect.stringContaining("node=%E9%A1%B9%E7%9B%AE%E5%8E%9F%E5%9E%8B")
    );
  });

  it("renders each project name as a detail link into the matching project workbench", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const projectRegion = screen.getByRole("region", { name: /项目操盘台/i });
    const retailLink = within(projectRegion).getByRole("link", { name: /^零售客服副驾驶$/i });
    const clinicLink = within(projectRegion).getByRole("link", { name: /^诊所知识助手$/i });

    expect(retailLink).toHaveAttribute(
      "href",
      expect.stringContaining("/projects?projectId=retail-support")
    );
    expect(retailLink).toHaveAttribute("href", expect.stringContaining("node=DEMO%E6%B5%8B%E8%AF%95"));
    expect(clinicLink).toHaveAttribute(
      "href",
      expect.stringContaining("/projects?projectId=clinic-rag")
    );
    expect(clinicLink).toHaveAttribute(
      "href",
      expect.stringContaining("node=%E9%A1%B9%E7%9B%AE%E5%8E%9F%E5%9E%8B")
    );
  });

  it("keeps the project activity panel fixed when the source-stage filter changes", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const actionRegion = screen.getByRole("region", { name: /项目动态/i });
    expect(within(actionRegion).getByRole("link", { name: /进入 零售客服副驾驶 项目工作台/i })).toBeInTheDocument();
    expect(within(actionRegion).getByRole("link", { name: /进入 诊所知识助手 项目工作台/i })).toBeInTheDocument();

    const sourceRegion = screen.getByRole("region", { name: /事项来源/i });
    fireEvent.click(within(sourceRegion).getByRole("button", { name: /项目原型/i }));

    expect(within(actionRegion).getByRole("link", { name: /进入 零售客服副驾驶 项目工作台/i })).toBeInTheDocument();
    expect(within(actionRegion).getByRole("link", { name: /进入 诊所知识助手 项目工作台/i })).toBeInTheDocument();
  });

  it("uses the same dialog width class for creating and editing projects", () => {
    const componentSource = readFileSync(
      resolve(process.cwd(), "src/components/forge-home-page.tsx"),
      "utf8"
    );
    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/forge-home-page.module.css"),
      "utf8"
    );

    expect(componentSource).toMatch(/ariaLabel="新建项目"[\s\S]*dialogClassName=\{styles\.projectDialog\}/);
    expect(componentSource).toMatch(/ariaLabel="编辑项目"[\s\S]*dialogClassName=\{styles\.projectDialog\}/);
    expect(stylesheet).toMatch(/\.projectDialog\s*\{[^}]*width:\s*min\(920px,\s*calc\(100vw - 48px\)\);/s);
  });

  it("opens an edit dialog from the project list and saves project information", async () => {
    const updateWorkbenchProject = vi.fn().mockResolvedValue({
      activeProjectId: "retail-support",
      project: {
        id: "retail-support",
        name: "零售客服副驾驶 Pro"
      }
    });

    render(
      <ForgeHomePage
        snapshot={forgeSnapshotFixture}
        updateWorkbenchProject={updateWorkbenchProject}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /编辑 零售客服副驾驶/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑项目/i });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /客户需求/i }), {
      target: { value: "升级零售客服副驾驶，强化订单查询与支付异常闭环。" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /企业名称/i }), {
      target: { value: "百川零售集团" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /项目名称/i }), {
      target: { value: "零售客服副驾驶 Pro" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /所属行业/i }), {
      target: { value: "零售电商" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /项目类型/i }), {
      target: { value: "智能客服中台" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /负责人/i }), {
      target: { value: "Ariel" }
    });
    fireEvent.change(within(dialog).getByLabelText(/交付时间/i), {
      target: { value: "2026-03-28" }
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /备注/i }), {
      target: { value: "补充支付失败回访话术与演示账号。" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存项目/i }));

    await waitFor(() => {
      expect(updateWorkbenchProject).toHaveBeenCalledWith({
        projectId: "retail-support",
        requirement: "升级零售客服副驾驶，强化订单查询与支付异常闭环。",
        enterpriseName: "百川零售集团",
        name: "零售客服副驾驶 Pro",
        sector: "零售电商",
        projectType: "智能客服中台",
        teamTemplateId: "team-standard",
        owner: "Ariel",
        deliveryDate: "2026-03-28",
        note: "补充支付失败回访话术与演示账号。"
      });
    });

    expect(screen.getByRole("status")).toHaveTextContent(/已更新项目信息/i);
  });

  it("supports deleting a project from the edit dialog", async () => {
    const deleteWorkbenchProject = vi.fn().mockResolvedValue({
      deletedProjectId: "retail-support",
      activeProjectId: "clinic-rag"
    });

    render(
      <ForgeHomePage
        deleteWorkbenchProject={deleteWorkbenchProject}
        snapshot={forgeSnapshotFixture}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /编辑 零售客服副驾驶/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑项目/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /删除项目/i }));

    const confirmDialog = screen.getByRole("dialog", { name: /确认删除项目/i });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: /确认删除/i }));

    await waitFor(() => {
      expect(deleteWorkbenchProject).toHaveBeenCalledWith("retail-support");
    });

    expect(screen.getByRole("status")).toHaveTextContent(/已删除项目/i);
  });

  it("shows lightweight feedback when refreshing the project list", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /刷新项目/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/项目列表已刷新/i);
  });

  it("does not expose live report refresh on the OSS-safe home page by default", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.queryByRole("button", { name: /刷新汇报/i })).not.toBeInTheDocument();
  });

  it("calls the PM work report endpoint when live report mode is explicitly enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          projectId: "portfolio",
          projectName: "全部项目",
          summary: "已通过 OpenClaw PM 生成项目工作汇报。",
          report:
            "已汇总 2 个项目：零售客服副驾驶当前卡在测试验证；诊所知识助手正在推进方案与任务包。"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeHomePage enableLiveAiWorkReport showNavigation snapshot={forgeSnapshotFixture} />);

    fireEvent.click(screen.getByRole("button", { name: /刷新汇报/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/forge/ai-work-report",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        })
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      scope: "portfolio",
      triggeredBy: "Forge Home · AI工作汇报"
    });

    const actionRegion = screen.getByRole("region", { name: /项目动态/i });
    expect(within(actionRegion).getByText(/已汇总 2 个项目/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/已通过 OpenClaw PM 生成项目工作汇报。/i);
  });
});
