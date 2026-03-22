import fs from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { ForgeDashboardSnapshot } from "../packages/core/src/types";
import AgentTeamPage from "../src/components/agent-team-page";
import {
  FORGE_PAGE_CONTRACT_REFRESH_EVENT,
  type ForgePageContractRefreshDetail
} from "../src/lib/forge-page-refresh-events";

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

const snapshot = {
  activeProjectId: "retail-support",
  projects: [
    {
      id: "retail-support",
      name: "零售客服副驾驶",
      sector: "智能客服 / 零售",
      owner: "Iris",
      status: "active",
      lastRun: "8 分钟前",
      progress: 72,
      riskNote: "支付失败回归链路待补齐"
    }
  ],
  projectTemplates: [],
  projectProfiles: [],
  workflowStates: [
    {
      projectId: "retail-support",
      currentStage: "方案与任务包",
      state: "blocked",
      blockers: ["PRD 草案待补齐"],
      lastTransitionAt: "今天 09:30",
      updatedBy: "system"
    }
  ],
  workflowTransitions: [
    {
      id: "transition-retail-intake",
      projectId: "retail-support",
      stage: "方案与任务包",
      state: "blocked",
      updatedBy: "产品经理 Agent",
      blockers: ["PRD 草案待补齐"],
      createdAt: "今天 09:30"
    }
  ],
  assets: [],
  promptTemplates: [],
  prdDocuments: [],
  projectAssetLinks: [],
  tasks: [],
  commands: [],
  commandHooks: [],
  commandExecutions: [],
  policyDecisions: [],
  runs: [],
  runEvents: [],
  runners: [
    {
      id: "runner-local-main",
      name: "本地主执行器",
      status: "healthy",
      summary: "本地执行主流程。",
      workspacePath: "/tmp/forge/test",
      capabilities: ["文件写入"],
      detectedCapabilities: ["文件写入"],
      detectedCapabilityDetails: [],
      probeStatus: "healthy",
      probeSummary: "可用",
      currentRunId: null,
      lastHeartbeat: "今天 09:30",
      lastProbeAt: "今天 09:28"
    },
    {
      id: "runner-reviewer",
      name: "代码评审执行器",
      status: "healthy",
      summary: "负责规则审查与评审。",
      workspacePath: "/tmp/forge/test",
      capabilities: ["补丁评审"],
      detectedCapabilities: ["补丁评审"],
      detectedCapabilityDetails: [],
      probeStatus: "healthy",
      probeSummary: "可用",
      currentRunId: null,
      lastHeartbeat: "今天 09:29",
      lastProbeAt: "今天 09:28"
    }
  ],
  deliveryGate: [],
  agents: [
    {
      id: "agent-pm",
      name: "产品经理 Agent",
      role: "pm",
      runnerId: "runner-local-main",
      persona: "范围收口、结果导向、强调验收标准",
      systemPrompt: "先收口范围，再输出结构化 PRD。",
      responsibilities: ["澄清需求", "输出 PRD", "锁定验收标准"],
      skillIds: ["skill-prd"],
      sopIds: ["sop-intake"],
      knowledgeSources: ["产品需求手册"],
      promptTemplateId: "prompt-pm",
      policyId: "policy-product",
      permissionProfileId: "perm-readonly",
      ownerMode: "human-approved"
    },
    {
      id: "agent-architect",
      name: "架构师 Agent",
      role: "architect",
      runnerId: "runner-local-main",
      persona: "优先划清系统边界，避免隐性耦合。",
      systemPrompt: "你是架构师 Agent，优先给出边界、依赖和风险判断。",
      responsibilities: ["推荐技术方案", "拆分模块", "评估风险"],
      skillIds: ["skill-architecture"],
      sopIds: ["sop-architecture"],
      knowledgeSources: ["架构决策记录"],
      promptTemplateId: "prompt-architect",
      policyId: "policy-architecture",
      permissionProfileId: "perm-readonly",
      ownerMode: "review-required"
    },
    {
      id: "agent-design",
      name: "设计系统 Agent",
      role: "design",
      runnerId: "runner-local-main",
      persona: "结构优先，界面统一，不允许组件失控。",
      systemPrompt: "你是设计系统 Agent，负责约束页面结构和组件规范。",
      responsibilities: ["约束页面结构", "定义组件边界", "做 UI 审查"],
      skillIds: ["skill-design-system"],
      sopIds: ["sop-ui-spec"],
      knowledgeSources: ["设计系统规范"],
      promptTemplateId: "prompt-design",
      policyId: "policy-design",
      permissionProfileId: "perm-readonly",
      ownerMode: "review-required"
    },
    {
      id: "agent-dev",
      name: "研发 Agent",
      role: "engineer",
      runnerId: "runner-local-main",
      persona: "直接、严谨、最小实现优先",
      systemPrompt: "严格按 TaskPack 输出最小实现，不擅自加需求。",
      responsibilities: ["生成补丁", "实现模块", "修复回归问题"],
      skillIds: ["skill-code"],
      sopIds: ["sop-taskpack-execution"],
      knowledgeSources: ["代码规范"],
      promptTemplateId: "prompt-dev",
      policyId: "policy-engineering",
      permissionProfileId: "perm-execution",
      ownerMode: "auto-execute"
    },
    {
      id: "agent-qa",
      name: "测试 Agent",
      role: "qa",
      runnerId: "runner-reviewer",
      persona: "失败优先，强依赖门禁和回归。",
      systemPrompt: "你是测试 Agent，优先找失败路径和阻塞项。",
      responsibilities: ["生成测试清单", "执行门禁", "定位失败原因"],
      skillIds: ["skill-playwright"],
      sopIds: ["sop-test-gate"],
      knowledgeSources: ["回归用例库"],
      promptTemplateId: "prompt-qa",
      policyId: "policy-quality",
      permissionProfileId: "perm-execution",
      ownerMode: "auto-execute"
    },
    {
      id: "agent-release",
      name: "发布 Agent",
      role: "release",
      runnerId: "runner-reviewer",
      persona: "发布谨慎，交付说明必须完整。",
      systemPrompt: "你是发布 Agent，只在门禁通过后整理发布说明。",
      responsibilities: ["整理发布说明", "确认可交付状态", "输出变更摘要"],
      skillIds: ["skill-release"],
      sopIds: ["sop-release"],
      knowledgeSources: ["发布清单"],
      promptTemplateId: "prompt-release",
      policyId: "policy-release",
      permissionProfileId: "perm-review",
      ownerMode: "review-required"
    },
    {
      id: "agent-knowledge",
      name: "知识沉淀 Agent",
      role: "knowledge",
      runnerId: "runner-reviewer",
      departmentLabel: "运营支持",
      persona: "优先复用，沉淀比临时解释更重要。",
      systemPrompt: "你是知识沉淀 Agent，负责提炼模板和最佳实践。",
      responsibilities: ["抽取模板", "记录踩坑经验", "归档最佳实践"],
      skillIds: ["skill-archive"],
      sopIds: ["sop-knowledge"],
      knowledgeSources: ["知识卡模板"],
      promptTemplateId: "prompt-knowledge",
      policyId: "policy-knowledge",
      permissionProfileId: "perm-readonly",
      ownerMode: "human-approved"
    },
    {
      id: "agent-service-strategy",
      name: "项目牧羊人 Agent",
      role: "pm",
      runnerId: "runner-local-main",
      departmentLabel: "项目管理",
      persona: "跨团队推进意识强、节奏感敏锐，擅长把需求、依赖、风险和责任人收成可执行的项目节奏。",
      systemPrompt: "你是项目牧羊人 Agent，负责跨团队节奏推进与风险升级。",
      responsibilities: ["梳理里程碑", "协调交接", "升级阻塞", "维护项目状态说明"],
      skillIds: ["skill-prd"],
      sopIds: ["sop-intake"],
      knowledgeSources: ["项目章程模板"],
      promptTemplateId: "prompt-pm",
      policyId: "policy-product",
      permissionProfileId: "perm-collaborator",
      ownerMode: "human-approved"
    },
    {
      id: "agent-ux",
      name: "体验架构 Agent",
      role: "design",
      runnerId: "runner-local-main",
      departmentLabel: "产品与方案",
      persona: "结构先行、基础扎实，擅长把信息架构、页面骨架和状态系统搭成开发可落地的体验基础。",
      systemPrompt: "你是体验架构 Agent，负责信息架构、页面骨架和状态系统设计。",
      responsibilities: ["设计页面骨架", "补齐关键状态", "定义交互边界"],
      skillIds: ["skill-design-system"],
      sopIds: ["sop-ui-spec"],
      knowledgeSources: ["体验架构基线规范"],
      promptTemplateId: "prompt-design",
      policyId: "policy-design",
      permissionProfileId: "perm-collaborator",
      ownerMode: "review-required"
    },
    {
      id: "agent-frontend",
      name: "前端开发 Agent",
      role: "engineer",
      runnerId: "runner-local-main",
      departmentLabel: "技术研发",
      persona: "关注实现质量和页面可维护性，擅长把设计与任务包快速落成结构清晰、状态完整的前端结果。",
      systemPrompt: "你是前端开发 Agent，负责把设计说明和任务包落实成前端实现。",
      responsibilities: ["实现页面", "处理状态", "整理前端实现说明"],
      skillIds: ["skill-code"],
      sopIds: ["sop-taskpack-execution"],
      knowledgeSources: ["前端组件资产库"],
      promptTemplateId: "prompt-dev",
      policyId: "policy-engineering",
      permissionProfileId: "perm-execution",
      ownerMode: "auto-execute"
    },
    {
      id: "agent-qa-automation",
      name: "现实校验 Agent",
      role: "qa",
      runnerId: "runner-reviewer",
      departmentLabel: "技术研发",
      persona: "证据优先、默认怀疑，擅长用截图、回归结果和失败归因阻止幻想式通过。",
      systemPrompt: "你是现实校验 Agent，负责用证据验证功能、页面和交付结果。",
      responsibilities: ["沉淀自动化用例", "执行回归截图", "输出失败归因"],
      skillIds: ["skill-playwright"],
      sopIds: ["sop-test-gate"],
      knowledgeSources: ["证据化验收标准"],
      promptTemplateId: "prompt-qa",
      policyId: "policy-quality",
      permissionProfileId: "perm-execution",
      ownerMode: "auto-execute"
    },
    {
      id: "agent-knowledge-ops",
      name: "流程优化 Agent",
      role: "knowledge",
      runnerId: "runner-reviewer",
      departmentLabel: "运营支持",
      persona: "系统性强、关注瓶颈和交接质量，擅长把一次性交付流程整理成可重复、可优化的工作方式。",
      systemPrompt: "你是流程优化 Agent，负责识别阻塞、提炼标准动作并回写优化建议。",
      responsibilities: ["识别阻塞", "整理标准动作", "沉淀流程资产", "回写优化建议"],
      skillIds: ["skill-archive"],
      sopIds: ["sop-knowledge"],
      knowledgeSources: ["流程优化手册"],
      promptTemplateId: "prompt-knowledge",
      policyId: "policy-knowledge",
      permissionProfileId: "perm-collaborator",
      ownerMode: "human-approved"
    }
  ],
  skills: [
    {
      id: "skill-prd",
      name: "PRD 结构化生成",
      category: "product",
      ownerRole: "pm",
      summary: "输出标准 PRD 草案。",
      usageGuide: "先补齐范围和验收标准，再生成 PRD。"
    },
    {
      id: "skill-code",
      name: "任务包代码生成",
      category: "engineering",
      ownerRole: "engineer",
      summary: "基于 TaskPack 生成补丁。",
      usageGuide: "TaskPack ready 后再进入执行。"
    }
  ],
  sops: [
    {
      id: "sop-intake",
      name: "需求接入 SOP",
      stage: "项目接入",
      ownerRole: "pm",
      summary: "确认范围、负责人和模板。",
      checklist: ["确认行业场景", "锁定负责人"]
    },
    {
      id: "sop-taskpack-execution",
      name: "TaskPack 执行 SOP",
      stage: "开发执行",
      ownerRole: "engineer",
      summary: "基于 TaskPack 执行补丁交付。",
      checklist: ["先读 TaskPack", "再输出补丁"]
    }
  ],
  teamTemplates: [
    {
      id: "team-standard-delivery",
      name: "标准交付团队",
      summary: "覆盖需求、研发、测试和发布的标准编制。",
      agentIds: [
        "agent-pm",
        "agent-architect",
        "agent-design",
        "agent-dev",
        "agent-qa",
        "agent-release",
        "agent-knowledge"
      ],
      leadAgentId: "agent-pm"
    },
    {
      id: "team-lean-validation",
      name: "最小验证团队",
      summary: "先完成需求、研发、测试和发布，适合快速验证 DEMO。",
      agentIds: ["agent-pm", "agent-dev", "agent-qa", "agent-release", "agent-knowledge"],
      leadAgentId: "agent-pm"
    },
    {
      id: "team-design-sprint",
      name: "设计冲刺团队",
      summary: "以需求、原型、设计和研发为主，适合快速出方案和界面。",
      agentIds: ["agent-pm", "agent-architect", "agent-design", "agent-dev"],
      leadAgentId: "agent-pm"
    }
  ],
  artifacts: [
    {
      id: "artifact-prd",
      projectId: "retail-support",
      type: "prd",
      title: "零售客服副驾驶 PRD 草案",
      ownerAgentId: "agent-pm",
      status: "draft",
      updatedAt: "今天 09:30"
    }
  ],
  artifactReviews: []
} satisfies ForgeDashboardSnapshot;

describe("Agent team page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes the project takeover overview and keeps AI employee page focused on team configuration", () => {
    const snapshotWithTakeover = {
      ...snapshot,
      tasks: [
        {
          id: "task-prd",
          projectId: "retail-support",
          stage: "方案与任务包",
          title: "补齐零售客服副驾驶 PRD 草稿",
          ownerAgentId: "agent-pm",
          status: "in-progress",
          priority: "P0",
          category: "handoff",
          summary: "先收口项目范围和验收标准。"
        },
        {
          id: "task-regression",
          projectId: "retail-support",
          stage: "测试验证",
          title: "处理 Playwright 支付失败回归",
          ownerAgentId: "agent-qa",
          status: "blocked",
          priority: "P1",
          category: "review",
          summary: "支付失败回归链路待补齐。"
        }
      ],
      ceoExecutionStatusLabel: "已接线",
      ceoExecutionStatusSummary: "NanoClaw CEO 总控已就绪，可继续接管当前主项目。"
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithTakeover} showNavigation />);

    expect(screen.queryByLabelText("项目接管概览")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI 项目接管/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/关键接棒/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/当前围绕 零售客服副驾驶 配置并调度 AI 员工/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /团队配置/i })).toBeInTheDocument();
  });

  it("keeps employee lists top-aligned instead of stretching with the detail pane", () => {
    const css = fs.readFileSync(
      resolve(process.cwd(), "src/components/agent-team-page.module.css"),
      "utf8"
    );

    expect(css).toContain(".employeePoolList");
    expect(css).toContain("align-content: start;");
    expect(css).not.toContain(
      ".employeeListPanel .employeePoolList {\n  max-height: none;\n  min-height: 0;\n  height: 100%;"
    );
  });

  it("persists the selected category and employee detail tab across remounts", () => {
    const { container, unmount } = render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getByRole("button", { name: /^能力$/i }));

    expect(screen.getByRole("button", { name: /员工管理.*成员与状态/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^能力$/i })).toHaveAttribute("aria-pressed", "true");

    unmount();

    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    expect(screen.getByRole("button", { name: /员工管理.*成员与状态/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^能力$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists the selected skill configuration tab across remounts", () => {
    const { unmount } = render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));

    expect(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^技能组合$/i })).toHaveAttribute("aria-pressed", "true");

    unmount();

    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    expect(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^技能组合$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists nested skill configuration state across remounts", () => {
    const { unmount } = render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^自定义组包$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^开发工具$/i }));
    fireEvent.click(screen.getByRole("button", { name: /收起当前技能包/i }));

    unmount();

    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    expect(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^自定义组包$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^开发工具$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /展开当前技能包/i })).toBeInTheDocument();
  });

  it("keeps the selected agent continuous from team configuration into employee management", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    const employeePoolSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(employeePoolSection).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /选择岗位 后端研发/i }));
    fireEvent.click(
      within(employeePoolSection as HTMLElement).getByRole("button", { name: /研发 Agent/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));

    expect(screen.getByRole("heading", { level: 3, name: /^研发 Agent$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^技术研发$/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    expect(screen.getByRole("button", { name: /^技术研发$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /研发 Agent/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    expect(screen.getByRole("button", { name: /^技术研发$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /研发 Agent/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists the selected agent and builder role across remounts", () => {
    const { unmount } = render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /选择岗位 后端研发/i }));
    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /研发 Agent/i })[0]);

    unmount();

    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    expect(screen.getByRole("button", { name: /员工管理.*成员与状态/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("heading", { level: 3, name: /^研发 Agent$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i }));
    expect(screen.getByRole("button", { name: /选择岗位 后端研发/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("hydrates team configuration and equipped packs from persisted workbench state", () => {
    const snapshotWithWorkbench = {
      ...snapshot,
      teamWorkbenchState: {
        selectedTemplateId: "team-design-sprint",
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-qa",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {
          "agent-pm": ["skill-prd"]
        },
        manualKnowledgeSourcesByAgentId: {
          "agent-pm": ["产品需求手册"]
        },
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {
          "agent-pm": [{ source: "preset", id: "pack-AI智能" }]
        },
        managedAgents: snapshot.agents,
        orgDepartments: [{ label: "管理层" }, { label: "平台工程" }, { label: "运营支持" }],
        orgChartMembers: [
          {
            id: "agent-pm",
            name: "产品经理 Agent",
            role: "pm",
            departmentLabel: "管理层"
          },
          {
            id: "agent-dev",
            name: "研发 Agent",
            role: "engineer",
            departmentLabel: "平台工程"
          },
          {
            id: "agent-knowledge",
            name: "知识沉淀 Agent",
            role: "knowledge",
            departmentLabel: "运营支持"
          }
        ],
        customAbilityPacks: [
          {
            id: "custom-pack-demo",
            name: "演示技能包",
            line: "开发工具",
            category: "通用",
            summary: "演示用技能组合。",
            skillIds: ["skill-code"],
            updatedAt: "刚刚"
          }
        ]
      }
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithWorkbench} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i }));
    expect(screen.getByRole("button", { name: /^设计冲刺团队$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const uiDesignCard = screen.getByRole("button", { name: /选择岗位 UI设计/i });
    expect(within(uiDesignCard).getByText(/测试工程师\s*·\s*Owl/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    const platformEngineeringDepartment = screen.getByRole("region", { name: /部门 平台工程/i });
    expect(
      within(platformEngineeringDepartment).getByText(/工程负责人\s*·\s*Tiger/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    expect(screen.getByText("AI智能技能包")).toBeInTheDocument();
  });

  it("renders team configuration templates from snapshot data instead of a hardcoded rail", () => {
    const snapshotWithBackendTemplates = {
      ...snapshot,
      teamTemplates: [
        {
          id: "team-standard-delivery",
          name: "标准交付团队",
          summary: "覆盖需求、研发、测试和发布的标准编制。",
          agentIds: ["agent-pm", "agent-dev"],
          leadAgentId: "agent-pm"
        },
        {
          id: "team-backend-validation",
          name: "后端最小验证团队",
          summary: "仅保留需求、研发和测试，适合接口打通验证。",
          agentIds: ["agent-pm", "agent-dev", "agent-qa"],
          leadAgentId: "agent-pm"
        }
      ]
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithBackendTemplates} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i }));

    expect(screen.getByRole("button", { name: /^后端最小验证团队$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^设计冲刺团队$/i })).not.toBeInTheDocument();
  });

  it("shows the NanoClaw CEO backend summary on the project shepherd runtime panel", () => {
    const snapshotWithNanoCeo = {
      ...snapshot,
      ceoExecutionBackendLabel: "NanoClaw",
      ceoExecutionRoleLabel: "项目牧羊人 Agent",
      ceoExecutionModeLabel: "单 runtime / 多员工 profile 调度",
      ceoExecutionStatusLabel: "已接线",
      ceoExecutionStatusSummary: "NanoClaw CEO 总控已就绪，可继续接管 Forge 执行链。"
    };

    render(<AgentTeamPage snapshot={snapshotWithNanoCeo} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /项目牧羊人 Agent/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^运行$/i }));

    expect(screen.getByText(/执行后端/i)).toBeInTheDocument();
    expect(screen.getByText(/^NanoClaw$/i)).toBeInTheDocument();
    expect(screen.getByText(/总控角色/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^项目牧羊人 Agent$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/执行模式/i)).toBeInTheDocument();
    expect(screen.getByText(/单 runtime \/ 多员工 profile 调度/i)).toBeInTheDocument();
    expect(screen.getByText(/后端状态/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^已接线$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NanoClaw CEO 总控已就绪/i).length).toBeGreaterThan(0);
  });

  it("hydrates skill catalog overrides and hidden skill ids from persisted workbench state", () => {
    const snapshotWithSkillWorkbench = {
      ...snapshot,
      teamWorkbenchState: {
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [{ label: "管理层" }, { label: "产品与方案" }, { label: "技术研发" }, { label: "运营支持" }],
        orgChartMembers: [],
        skillCatalogOverrides: {
          "skill-prd": {
            name: "PRD 结构化生成",
            summary: "补强需求摘要、范围边界与验收标准。",
            line: "AI智能",
            category: "规划"
          }
        },
        hiddenSkillIds: ["skill-archive"],
        customAbilityPacks: []
      }
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithSkillWorkbench} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));

    expect(screen.getAllByText(/PRD 结构化生成/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/归档复盘/i)).not.toBeInTheDocument();
  });

  it("hydrates persisted workbench ui context from the backend snapshot", () => {
    const snapshotWithWorkbenchUi = {
      ...snapshot,
      teamWorkbenchState: {
        selectedTemplateId: "team-standard-delivery",
        activeCategory: "templates",
        employeeDetailTab: "ability",
        abilityTemplateTab: "custom",
        selectedAgentId: "agent-design",
        selectedBuilderRole: "design",
        selectedPoolAgentId: "agent-design",
        selectedPoolDepartment: "产品与方案",
        selectedManagementDepartment: "产品与方案",
        selectedTemplateDepartment: "产品与方案",
        selectedGovernanceDepartment: "产品与方案",
        selectedAbilityLine: "内容创作",
        selectedRecommendedPackId: null,
        selectedCustomPackId: "custom-pack-demo",
        isCurrentPackListCollapsed: true,
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [
          { label: "管理层" },
          { label: "产品与方案" },
          { label: "技术研发" },
          { label: "运营支持" }
        ],
        orgChartMembers: [],
        customAbilityPacks: [
          {
            id: "custom-pack-demo",
            name: "演示技能包",
            line: "内容创作",
            category: "创意",
            summary: "演示用技能组合。",
            skillIds: ["skill-design-system"],
            updatedAt: "刚刚"
          }
        ]
      }
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithWorkbenchUi} showNavigation />);

    expect(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^自定义组包$/i })).toHaveAttribute("aria-pressed", "true");
    const templateEmployeeSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(templateEmployeeSection).not.toBeNull();
    expect(
      within(templateEmployeeSection as HTMLElement).getByRole("button", { name: /设计系统 Agent/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("current-pack-list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /展开当前技能包/i })).toBeInTheDocument();
  });

  it("hydrates governance overrides from persisted workbench state", () => {
    const snapshotWithGovernanceWorkbench = {
      ...snapshot,
      teamWorkbenchState: {
        selectedTemplateId: "team-standard-delivery",
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents.map((agent) =>
          agent.id === "agent-pm"
            ? { ...agent, permissionProfileId: "perm-review" }
            : agent
        ),
        orgDepartments: [{ label: "管理层" }, { label: "产品与方案" }, { label: "技术研发" }, { label: "运营支持" }],
        orgChartMembers: [],
        customAbilityPacks: [],
        governanceOverridesByAgentId: {
          "agent-pm": {
            enabled: ["project.advance"],
            disabled: ["team.configure"]
          }
        }
      }
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithGovernanceWorkbench} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    expect(screen.getByRole("button", { name: /L2 协作者/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/^例外权限$/i)).toBeInTheDocument();
    expect(screen.getByText(/放开 · 推进项目节点/i)).toBeInTheDocument();
    expect(screen.getByText(/收紧 · 调整团队配置/i)).toBeInTheDocument();
  });

  it("saves the workbench state after binding an employee to a workflow node", async () => {
    vi.useFakeTimers();
    const saveTeamWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        selectedTemplateId: "team-design-sprint",
        roleAssignments: {
          pm: "agent-qa",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [{ label: "管理层" }, { label: "产品与方案" }, { label: "技术研发" }, { label: "运营支持" }],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    });

    render(
      <AgentTeamPage
        saveTeamWorkbenchState={saveTeamWorkbenchState}
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i }));
    fireEvent.click(screen.getByRole("button", { name: /^设计冲刺团队$/i }));
    fireEvent.click(screen.getByRole("button", { name: /测试 Agent/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveTeamWorkbenchState).toHaveBeenCalled();
    expect(saveTeamWorkbenchState.mock.calls.at(-1)?.[0].selectedTemplateId).toBe(
      "team-design-sprint"
    );
    expect(saveTeamWorkbenchState.mock.calls.at(-1)?.[0].roleAssignments.pm).toBe("agent-qa");
    expect(saveTeamWorkbenchState.mock.calls.at(-1)?.[0].equippedPackByAgentId["agent-qa"]).toEqual([
      { source: "preset", id: "pack-AI智能" }
    ]);

    vi.useRealTimers();
  });

  it("keeps the clicked workflow node selected even when the assigned employee has a different role", () => {
    const snapshotWithCrossRoleAssignment = {
      ...snapshot,
      teamWorkbenchState: {
        selectedTemplateId: "team-standard-delivery",
        selectedBuilderRole: "pm",
        roleAssignments: {
          pm: "agent-architect",
          architect: "agent-service-strategy",
          design: "agent-ux",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [
          { label: "项目管理" },
          { label: "产品与方案" },
          { label: "技术研发" },
          { label: "运营支持" }
        ],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    } satisfies ForgeDashboardSnapshot;

    render(<AgentTeamPage snapshot={snapshotWithCrossRoleAssignment} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i }));
    fireEvent.click(screen.getByRole("button", { name: /选择岗位 需求确认/i }));

    expect(screen.getByRole("button", { name: /选择岗位 需求确认/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /选择岗位 项目原型/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("saves governance level and exception overrides through the workbench state", async () => {
    vi.useFakeTimers();
    const saveTeamWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        selectedTemplateId: "team-standard-delivery",
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents.map((agent) =>
          agent.id === "agent-pm"
            ? { ...agent, permissionProfileId: "perm-admin" }
            : agent
        ),
        orgDepartments: [
          { label: "管理层" },
          { label: "产品与方案" },
          { label: "技术研发" },
          { label: "运营支持" }
        ],
        orgChartMembers: [],
        governanceOverridesByAgentId: {
          "agent-pm": {
            enabled: [],
            disabled: ["governance.permissions"]
          }
        },
        customAbilityPacks: []
      }
    });

    render(
      <AgentTeamPage
        saveTeamWorkbenchState={saveTeamWorkbenchState}
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    fireEvent.click(screen.getByRole("button", { name: /L4 管理者/i }));
    fireEvent.click(screen.getByRole("button", { name: /禁用修改权限/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveTeamWorkbenchState).toHaveBeenCalled();
    const persistedState = saveTeamWorkbenchState.mock.calls.at(-1)?.[0];
    expect(
      persistedState?.managedAgents.find((agent: { id: string }) => agent.id === "agent-pm")
        ?.permissionProfileId
    ).toBe("perm-admin");
    expect(persistedState?.governanceOverridesByAgentId?.["agent-pm"]).toEqual({
      enabled: [],
      disabled: ["governance.permissions"]
    });

    vi.useRealTimers();
  });

  it("saves org chart state after editing departments", async () => {
    vi.useFakeTimers();
    const saveTeamWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [{ label: "管理层" }, { label: "产品策略" }, { label: "技术研发" }, { label: "运营支持" }],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    });

    render(
      <AgentTeamPage
        saveTeamWorkbenchState={saveTeamWorkbenchState}
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    fireEvent.click(screen.getByRole("button", { name: /^编辑部门$/i }));
    const departmentDialog = screen.getByRole("dialog", { name: /编辑部门/i });
    fireEvent.click(within(departmentDialog).getByRole("button", { name: /^产品与方案$/i }));
    fireEvent.change(within(departmentDialog).getByPlaceholderText(/请输入部门名称/i), {
      target: { value: "产品策略" }
    });
    fireEvent.click(within(departmentDialog).getByRole("button", { name: /保存修改/i }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveTeamWorkbenchState).toHaveBeenCalled();
    const persistedState = saveTeamWorkbenchState.mock.calls.at(-1)?.[0];
    expect(persistedState?.orgDepartments).toEqual(
      expect.arrayContaining([{ label: "产品策略" }])
    );
    expect(
      persistedState?.managedAgents.find((agent: { id: string }) => agent.id === "agent-design")
        ?.departmentLabel
    ).toBe("产品策略");

    vi.useRealTimers();
  });

  it("saves moved org members back into managed agents and org chart state", async () => {
    vi.useFakeTimers();
    const saveTeamWorkbenchState = vi.fn().mockResolvedValue({
      state: {
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        managedAgents: snapshot.agents,
        orgDepartments: [{ label: "管理层" }, { label: "产品与方案" }, { label: "技术研发" }, { label: "运营支持" }],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    });

    render(
      <AgentTeamPage
        saveTeamWorkbenchState={saveTeamWorkbenchState}
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));

    const designEmployeeCard = screen.getByRole("button", { name: /选择员工 设计系统 Agent/i });
    const operationsDepartment = screen.getByRole("region", { name: /部门 运营支持/i });
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, value: string) {
        this.data[type] = value;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      }
    };

    fireEvent.dragStart(designEmployeeCard, { dataTransfer });
    fireEvent.drop(operationsDepartment, { dataTransfer });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveTeamWorkbenchState).toHaveBeenCalled();
    const persistedState = saveTeamWorkbenchState.mock.calls.at(-1)?.[0];
    expect(
      persistedState?.orgChartMembers.find((member: { id: string }) => member.id === "agent-design")
        ?.departmentLabel
    ).toBe("运营支持");
    expect(
      persistedState?.managedAgents.find((agent: { id: string }) => agent.id === "agent-design")
        ?.departmentLabel
    ).toBe("运营支持");

    vi.useRealTimers();
  });

  it("allows dropping an org member onto another member card inside the target department", async () => {
    vi.useFakeTimers();
    const saveTeamWorkbenchState = vi.fn().mockResolvedValue({
      state: snapshot.teamWorkbenchState ?? null
    });

    render(
      <AgentTeamPage
        saveTeamWorkbenchState={saveTeamWorkbenchState}
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));

    const designEmployeeCard = screen.getByRole("button", { name: /选择员工 设计系统 Agent/i });
    const targetEmployeeCard = screen.getByRole("button", { name: /选择员工 流程优化 Agent/i });
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, value: string) {
        this.data[type] = value;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      }
    };

    fireEvent.dragStart(designEmployeeCard, { dataTransfer });
    fireEvent.dragOver(targetEmployeeCard, { dataTransfer });
    fireEvent.drop(targetEmployeeCard, { dataTransfer });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveTeamWorkbenchState).toHaveBeenCalled();
    const persistedState = saveTeamWorkbenchState.mock.calls.at(-1)?.[0];
    expect(
      persistedState?.orgChartMembers.find((member: { id: string }) => member.id === "agent-design")
        ?.departmentLabel
    ).toBe("运营支持");

    vi.useRealTimers();
  });

  it("keeps the selected agent continuous from org chart into employee, skill and governance views", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    fireEvent.click(screen.getByRole("button", { name: /选择员工 设计系统 Agent/i }));

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    expect(screen.getByRole("heading", { level: 3, name: /^设计系统 Agent$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    const skillEmployeeSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(skillEmployeeSection).not.toBeNull();
    expect(
      within(skillEmployeeSection as HTMLElement).getByRole("button", { name: /设计系统 Agent/i })
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    const governanceEmployeeSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(governanceEmployeeSection).not.toBeNull();
    expect(
      within(governanceEmployeeSection as HTMLElement).getByRole("button", { name: /设计系统 Agent/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("surfaces extended real-world demo agents across org chart and employee management", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    expect(screen.getByText(/项目负责人\s*·\s*Lion/i)).toBeInTheDocument();
    expect(screen.getByText(/体验负责人\s*·\s*Cat/i)).toBeInTheDocument();
    expect(screen.getByText(/前端负责人\s*·\s*Dog/i)).toBeInTheDocument();
    expect(screen.getByText(/质量负责人\s*·\s*Monkey/i)).toBeInTheDocument();
    expect(screen.getByText(/流程沉淀\s*·\s*Duck/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    expect(screen.getAllByText(/^项目经理$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^体验设计师$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^前端工程师$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^测试开发工程师$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^流程运营专员$/i).length).toBeGreaterThan(0);
  });

  it("migrates legacy management roles into project and product departments", () => {
    const managedAgents = [
      ...snapshot.agents.map((agent) =>
        agent.id === "agent-service-strategy"
          ? { ...agent, departmentLabel: "管理层" }
          : agent
      ),
      {
        id: "agent-discovery",
        name: "需求洞察 Agent",
        role: "pm" as const,
        runnerId: "runner-local-main",
        departmentLabel: "管理层",
        persona: "先拆需求，再进方案。",
        systemPrompt: "负责把模糊诉求收成清晰需求。",
        responsibilities: ["拆解需求", "补齐边界"],
        skillIds: ["skill-prd"],
        sopIds: ["sop-intake"],
        knowledgeSources: ["需求访谈清单"],
        promptTemplateId: "prompt-pm",
        policyId: "policy-product",
        permissionProfileId: "perm-collaborator",
        ownerMode: "human-approved" as const
      }
    ];

    const snapshotWithLegacyManagement = {
      ...snapshot,
      agents: managedAgents,
      teamWorkbenchState: {
        managedAgents,
        orgDepartments: [
          { label: "管理层" },
          { label: "产品与方案" },
          { label: "技术研发" },
          { label: "运营支持" }
        ],
        orgChartMembers: []
      }
    };

    render(
      <AgentTeamPage
        snapshot={snapshotWithLegacyManagement}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    const projectManagementDepartment = screen.getByRole("region", { name: /部门 项目管理/i });
    const productDepartment = screen.getByRole("region", { name: /部门 产品与方案/i });

    expect(within(projectManagementDepartment).getByText(/^项目经理$/i)).toBeInTheDocument();
    expect(within(projectManagementDepartment).queryByText(/^需求分析师$/i)).not.toBeInTheDocument();
    expect(within(productDepartment).getByText(/^需求分析师$/i)).toBeInTheDocument();
  });

  it("renders the workforce page as a team configuration center", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    expect(screen.getByRole("button", { name: /组织架构.*团队树状图/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /团队配置.*模板与岗位绑定/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /员工管理.*成员与状态/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /权限管理.*分级与审计/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /自动化.*后续开放/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /团队配置/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /员工列表/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /组建团队/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^选择团队$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^新建团队$/i })).toBeInTheDocument();
    const teamBuilderFlow = screen.getByTestId("team-builder-flow");
    expect(teamBuilderFlow).toHaveAttribute("data-layout", "wrapped");
    expect(within(teamBuilderFlow).queryAllByText(/下一棒：/i)).toHaveLength(0);
    expect(screen.queryAllByText(/^缺岗$/i)).toHaveLength(0);
    expect(screen.queryAllByText(/^已配置$/i)).toHaveLength(0);
    expect(screen.queryAllByText(/^岗位已配齐$/i)).toHaveLength(0);
    expect(screen.queryAllByText(/^缺岗 \d+$/i)).toHaveLength(0);
    expect(screen.queryByText(/^预设方案$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^可用成员$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^当前团队$/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /将当前员工绑定到/i })).toHaveLength(0);
    expect(screen.getByRole("button", { name: /标准交付团队/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /最小验证团队/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /设计冲刺团队/i })).toBeInTheDocument();
    expect(within(teamBuilderFlow).getAllByText(/需求确认/i).length).toBeGreaterThan(0);
    expect(within(teamBuilderFlow).getByText(/后端研发/i)).toBeInTheDocument();
    expect(screen.queryByText(/^01$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^02$/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索员工/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/从模板开始，为每个岗位绑定员工并检查交接链/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/覆盖需求、原型、设计、研发、测试和发布的完整交付团队/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/先完成需求、研发、测试和发布，适合快速验证 DEMO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/以需求、原型、设计和研发为主，适合快速出方案和界面/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/当前选中员工/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /岗位配置/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /绑定到当前岗位/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /清空岗位/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/编制概览/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/缺岗岗位/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /团队模板/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /默认交接链/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^新建团队$/i }));
    expect(screen.getByText(/^自定义团队$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /标准交付团队/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^选择团队$/i }));
    expect(screen.getByRole("button", { name: /标准交付团队/i })).toBeInTheDocument();

    const employeePoolSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(employeePoolSection).not.toBeNull();
    expect(within(employeePoolSection as HTMLElement).getByText(/^产品总监$/i)).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByText(/产品负责人\s*·\s*Elephant/i)).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByText(/^后端工程师$/i)).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^全部$/i })).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^项目管理$/i })).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^产品与方案$/i })).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^技术研发$/i })).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^运营支持$/i })).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getAllByText(/^L1$/i).length).toBeGreaterThan(0);
    expect(within(employeePoolSection as HTMLElement).getAllByText(/^L3$/i).length).toBeGreaterThan(0);
    expect(within(employeePoolSection as HTMLElement).queryByText(/待确认/i)).not.toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).queryByText(/待命/i)).not.toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).queryByText(/处理中/i)).not.toBeInTheDocument();

    fireEvent.click(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^产品与方案$/i }));
    expect(within(employeePoolSection as HTMLElement).getByText(/^技术架构师$/i)).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).getByText(/^UI设计师$/i)).toBeInTheDocument();
    expect(within(employeePoolSection as HTMLElement).queryByText(/^后端工程师$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /选择岗位 UI设计/i }));
    fireEvent.click(within(employeePoolSection as HTMLElement).getByRole("button", { name: /^产品与方案$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);
    const designerCard = screen.getByRole("button", { name: /选择岗位 UI设计/i });
    expect(within(designerCard).getByText(/产品总监\s*·\s*Elephant/i)).toBeInTheDocument();
    expect(within(designerCard).queryAllByText(/下一棒：/i)).toHaveLength(0);
    expect(within(designerCard).queryAllByText(/^已配置$/i)).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /将当前员工绑定到/i })).toHaveLength(0);

    const engineerCard = screen.getByRole("button", { name: /选择岗位 后端研发/i });
    expect(within(engineerCard).getByText(/后端工程师\s*·\s*Tiger/i)).toBeInTheDocument();
    fireEvent.click(engineerCard);
    expect(engineerCard).toHaveAttribute("aria-pressed", "true");

    expect(screen.queryByRole("heading", { name: /最近一轮执行与提醒/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/自动化方式/i)).not.toBeInTheDocument();

    expect(screen.getByRole("navigation", { name: /主模块/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AI员工/i })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText(/^控制台$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/员工详情/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /指派任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /调用/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /暂停/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /员工总览/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /任务协作/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /组织架构.*团队树状图/i }));
    expect(screen.getByRole("heading", { level: 2, name: /组织架构/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /组织架构图/i })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: /AI 公司组织树/i })).toBeInTheDocument();
    expect(screen.queryByText(/AI 员工组织架构/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^团队结构$/i, { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByText(/^CEO$/i)).toBeInTheDocument();
    expect(screen.getByText(/^openclaw$/i)).toBeInTheDocument();
    expect(screen.getByText(/^项目经理$/i)).toBeInTheDocument();
    expect(screen.getByText(/^前端工程师$/i)).toBeInTheDocument();
    expect(screen.getByText(/^测试开发工程师$/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /部门 项目管理/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /部门 产品与方案/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /部门 技术研发/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /部门 运营支持/i })).toBeInTheDocument();
    expect(screen.getByText(/^产品与方案$/i).closest("article")).toBeNull();
    const ceoCard = screen.getByText(/^CEO$/i).closest("article");
    expect(ceoCard).not.toBeNull();
    expect(ceoCard?.className).not.toMatch(/orgTreeRootCard/i);
    expect(screen.getByRole("button", { name: /^编辑部门$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新增员工/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/请输入部门名称/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/员工名称/i)).not.toBeInTheDocument();
    expect(screen.getByText(/产品负责人\s*·\s*Elephant/i)).toBeInTheDocument();
    expect(screen.getByText(/架构负责人\s*·\s*Eagle/i)).toBeInTheDocument();
    expect(screen.getByText(/设计负责人\s*·\s*Rabbit/i)).toBeInTheDocument();
    expect(screen.getByText(/测试负责人\s*·\s*Owl/i)).toBeInTheDocument();
    expect(screen.getByText(/发布负责人\s*·\s*Horse/i)).toBeInTheDocument();
    expect(screen.getByText(/知识沉淀\s*·\s*Panda/i)).toBeInTheDocument();
    expect(screen.queryByText(/待绑定员工/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/缺岗/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^编辑部门$/i }));
    const departmentDialog = screen.getByRole("dialog", { name: /编辑部门/i });
    expect(departmentDialog).toBeInTheDocument();
    fireEvent.click(within(departmentDialog).getByRole("button", { name: /^产品与方案$/i }));
    fireEvent.change(within(departmentDialog).getByPlaceholderText(/请输入部门名称/i), {
      target: { value: "产品策略" }
    });
    fireEvent.click(within(departmentDialog).getByRole("button", { name: /保存修改/i }));
    expect(screen.getByRole("region", { name: /部门 产品策略/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /部门 产品与方案/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^编辑部门$/i }));
    const addDepartmentDialog = screen.getByRole("dialog", { name: /编辑部门/i });
    fireEvent.click(within(addDepartmentDialog).getByRole("button", { name: /\+ 新增部门/i }));
    fireEvent.change(within(addDepartmentDialog).getByPlaceholderText(/请输入部门名称/i), {
      target: { value: "增长运营" }
    });
    fireEvent.click(within(addDepartmentDialog).getByRole("button", { name: /确认新增/i }));
    expect(screen.getByRole("region", { name: /部门 增长运营/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^编辑部门$/i }));
    const deleteDepartmentDialog = screen.getByRole("dialog", { name: /编辑部门/i });
    fireEvent.click(within(deleteDepartmentDialog).getByRole("button", { name: /^增长运营$/i }));

    fireEvent.click(screen.getByRole("button", { name: /新增员工/i }));
    expect(screen.getByRole("dialog", { name: /新增员工/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/员工名称/i), {
      target: { value: "增长运营 Agent" }
    });
    fireEvent.change(screen.getByLabelText(/员工角色/i), {
      target: { value: "knowledge" }
    });
    fireEvent.change(screen.getByLabelText(/所属部门/i), {
      target: { value: "增长运营" }
    });
    fireEvent.click(screen.getByRole("button", { name: /确认新增员工/i }));

    const growthDepartment = screen.getByRole("region", { name: /部门 增长运营/i });
    expect(
      within(growthDepartment).getByRole("button", { name: /选择员工 增长运营 Agent/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^编辑部门$/i }));
    const confirmDeleteDialog = screen.getByRole("dialog", { name: /编辑部门/i });
    fireEvent.click(within(confirmDeleteDialog).getByRole("button", { name: /^增长运营$/i }));
    fireEvent.click(within(confirmDeleteDialog).getByRole("button", { name: /删除部门/i }));
    const deleteDepartmentConfirmDialog = screen.getByRole("dialog", { name: /确认删除部门/i });
    fireEvent.click(within(deleteDepartmentConfirmDialog).getByRole("button", { name: /确认删除/i }));
    expect(screen.queryByRole("region", { name: /部门 增长运营/i })).not.toBeInTheDocument();
    const managementDepartment = screen.getByRole("region", { name: /部门 项目管理/i });
    expect(within(managementDepartment).getByText(/^增长运营$/i)).toBeInTheDocument();

    const operationsDepartment = screen.getByRole("region", { name: /部门 运营支持/i });
    const engineeringDepartment = screen.getByRole("region", { name: /部门 技术研发/i });
    expect(within(engineeringDepartment).getByText(/工程负责人\s*·\s*Tiger/i)).toBeInTheDocument();
    expect(within(engineeringDepartment).getByText(/测试负责人\s*·\s*Owl/i)).toBeInTheDocument();
    expect(within(engineeringDepartment).getByText(/发布负责人\s*·\s*Horse/i)).toBeInTheDocument();
    const designCard = screen.getByRole("button", { name: /选择员工 设计系统 Agent/i }).closest("article");
    expect(designCard).not.toBeNull();
    fireEvent.dragStart(designCard as HTMLElement, {
      dataTransfer: {
        setData: () => {}
      }
    });
    fireEvent.dragOver(operationsDepartment, {
      dataTransfer: {
        getData: () => "agent-design"
      }
    });
    fireEvent.drop(operationsDepartment, {
      dataTransfer: {
        getData: () => "agent-design"
      }
    });
    expect(within(operationsDepartment).getByText(/设计负责人\s*·\s*Rabbit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    expect(screen.getByRole("heading", { name: /员工管理/i })).toBeInTheDocument();
    expect(screen.queryByText(/^当前员工$/i, { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Agent/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^项目管理$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^技术研发$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^基础$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^能力$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^运行$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^全部$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^项目管理$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^技术研发$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /L3/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /L2/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /新增员工/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /复制员工/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /删除员工/i })).toBeInTheDocument();
    expect(screen.getAllByText(/研发 Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^角色$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^部门$/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /研发 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /编辑基础/i }));
    const basicDialog = screen.getByRole("dialog", { name: /编辑基础/i });
    expect(within(basicDialog).getByRole("combobox", { name: /模型选项/i })).toBeInTheDocument();
    expect(within(basicDialog).getByRole("option", { name: /代码评审执行器/i })).toBeInTheDocument();
    fireEvent.change(within(basicDialog).getByLabelText(/员工名称/i), {
      target: { value: "产品经理 Agent Plus" }
    });
    fireEvent.change(within(basicDialog).getByRole("combobox", { name: /模型选项/i }), {
      target: { value: "runner-reviewer" }
    });
    fireEvent.click(within(basicDialog).getByRole("button", { name: /保存基础/i }));
    expect(screen.getAllByText(/产品经理 Agent Plus/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /新增员工/i }));
    fireEvent.change(screen.getByLabelText(/^员工名称$/i), {
      target: { value: "运营助手 Agent" }
    });
    fireEvent.change(screen.getByLabelText(/^员工角色$/i), {
      target: { value: "knowledge" }
    });
    fireEvent.click(screen.getByRole("button", { name: /确认新增/i }));
    expect(screen.getAllByText(/运营助手 Agent/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /复制员工/i }));
    expect(screen.getAllByText(/运营助手 Agent 副本/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /删除员工/i }));
    const deleteEmployeeConfirmDialog = screen.getByRole("dialog", { name: /确认删除员工/i });
    fireEvent.click(within(deleteEmployeeConfirmDialog).getByRole("button", { name: /确认删除/i }));
    expect(screen.queryByRole("button", { name: /运营助手 Agent 副本/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent Plus/i })[0]);
    expect(screen.getByRole("heading", { level: 3, name: /产品经理 Agent Plus/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^能力$/i }));
    expect(screen.getByRole("button", { name: /^能力$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /编辑能力/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Prompt 模板/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/技能包/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/知识来源/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /打开能力文档/i }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/forge/agents/agent-dev/markdown?section=ability"),
      "_blank",
      "noopener,noreferrer"
    );

    fireEvent.click(screen.getByRole("button", { name: /^运行$/i }));
    expect(screen.getAllByText(/运行方式/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/权限配置/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/治理策略/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /编辑运行/i }));
    const runtimeDialog = screen.getByRole("dialog", { name: /编辑运行/i });
    fireEvent.change(within(runtimeDialog).getByLabelText(/运行方式/i), {
      target: { value: "auto-execute" }
    });
    fireEvent.click(within(runtimeDialog).getByRole("button", { name: /保存运行/i }));
    expect(screen.getByText(/自动执行/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    expect(screen.getByRole("heading", { name: /技能配置/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^已装技能$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^技能库$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^技能组合$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^自定义组包$/i })).toBeInTheDocument();
    const templateEmployeeSection = screen.getByRole("heading", { name: /员工列表/i }).closest("section");
    expect(templateEmployeeSection).not.toBeNull();
    expect(within(templateEmployeeSection as HTMLElement).getByRole("button", { name: /^全部$/i })).toBeInTheDocument();
    expect(within(templateEmployeeSection as HTMLElement).getByRole("button", { name: /^技术研发$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));
    expect(screen.queryByRole("button", { name: /^AI智能$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^开发工具$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/开发工具技能包/i)).toBeInTheDocument();
    expect(screen.queryByText(/任务包代码生成/i)).not.toBeInTheDocument();
    const engineeringPack = screen.getByRole("button", { name: /切换技能组合 开发工具技能包/i });
    expect(engineeringPack).not.toBeNull();
    fireEvent.click(engineeringPack);
    expect(
      engineeringPack.closest("article")?.querySelector('[data-icon-kind="pack"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-icon-kind="skill"]')).not.toBeNull();
    expect(screen.getAllByText(/任务包代码生成/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/基于 TaskPack 生成补丁/i)).toBeInTheDocument();
    fireEvent.click(engineeringPack);
    expect(screen.queryByText(/任务包代码生成/i)).not.toBeInTheDocument();
    fireEvent.click(within(templateEmployeeSection as HTMLElement).getByRole("button", { name: /^技术研发$/i }));
    expect(within(templateEmployeeSection as HTMLElement).getAllByRole("button", { name: /Agent/i }).length).toBeGreaterThan(0);
    expect(within(templateEmployeeSection as HTMLElement).queryByText(/项目牧羊人 Agent/i)).not.toBeInTheDocument();

    fireEvent.click(within(templateEmployeeSection as HTMLElement).getByRole("button", { name: /^全部$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /前端开发 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /装备开发工具技能包/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));
    fireEvent.click(screen.getByRole("button", { name: /装备AI智能技能包/i }));
    fireEvent.click(screen.getByRole("button", { name: /^已装技能$/i }));
    expect(screen.getByText(/已装技能包/i)).toBeInTheDocument();
    expect(screen.getByText(/开发工具技能包/i)).toBeInTheDocument();
    expect(screen.getAllByText(/AI智能技能包/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/单个技能/i)).toBeInTheDocument();
    expect(screen.getAllByText(/任务包代码生成/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/单独增添 Skill/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /移除开发工具技能包/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /移除AI智能技能包/i })).toBeInTheDocument();

    const equippedPack = screen.getByRole("button", { name: /切换已装技能包 开发工具技能包/i });
    fireEvent.click(equippedPack);
    expect(screen.getAllByText(/任务包代码生成/i).length).toBeGreaterThan(0);
    const equippedPackCard = equippedPack.closest("article");
    expect(equippedPackCard).not.toBeNull();
    expect(
      within(equippedPackCard as HTMLElement).getByRole("button", { name: /移除任务包代码生成/i })
    ).toBeInTheDocument();
    fireEvent.click(
      within(equippedPackCard as HTMLElement).getByRole("button", { name: /移除任务包代码生成/i })
    );
    expect(within(equippedPackCard as HTMLElement).getAllByText(/已停用/i).length).toBeGreaterThan(0);
    expect(within(equippedPackCard as HTMLElement).queryByText(/点击激活可恢复/i)).not.toBeInTheDocument();
    expect(
      within(equippedPackCard as HTMLElement).getByRole("button", { name: /激活任务包代码生成/i })
    ).toBeInTheDocument();
    fireEvent.click(
      within(equippedPackCard as HTMLElement).getByRole("button", { name: /激活任务包代码生成/i })
    );
    expect(
      within(equippedPackCard as HTMLElement).getByRole("button", { name: /移除任务包代码生成/i })
    ).toBeInTheDocument();
    const collaborationPack = screen.getByRole("button", { name: /切换已装技能包 AI智能技能包/i });
    fireEvent.click(collaborationPack);
    expect(screen.getAllByText(/PRD 结构化生成/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));
    expect(screen.getAllByRole("button", { name: /^全部$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^AI智能\s*1$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^开发工具\s*1$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/PRD 结构化生成/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/任务包代码生成/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^自定义组包$/i }));
    expect(screen.getByRole("heading", { name: /当前技能包/i })).toBeInTheDocument();
    expect(screen.getAllByText(/预设/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /新建技能包/i })).toBeInTheDocument();
    expect(screen.getByTestId("current-pack-list")).toHaveAttribute("data-layout", "wrapped");
    fireEvent.click(screen.getByRole("button", { name: /收起当前技能包/i }));
    expect(screen.queryByTestId("current-pack-list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /展开当前技能包/i }));
    expect(screen.getByTestId("current-pack-list")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /技能包编辑器/i })).toBeInTheDocument();
    expect(screen.getByText(/可选 skill/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^AI智能技能包/i }));
    const selectedSkillsPanel = screen
      .getByRole("heading", { name: /当前选中的 skill/i })
      .closest("section");
    expect(selectedSkillsPanel).not.toBeNull();
    expect(
      within(selectedSkillsPanel as HTMLElement).getByText(/PRD 结构化生成/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^开发工具$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /新建技能包/i }));
    const customPackDialog = screen.getByRole("dialog", { name: /编辑技能包/i });
    expect(within(customPackDialog).getByLabelText(/技能分类/i)).toBeInTheDocument();
    fireEvent.change(within(customPackDialog).getByLabelText(/技能包名称/i), {
      target: { value: "增长运营组合" }
    });
    fireEvent.change(within(customPackDialog).getByLabelText(/技能分类/i), {
      target: { value: "运营" }
    });
    fireEvent.click(within(customPackDialog).getByRole("button", { name: /保存修改/i }));
    fireEvent.click(screen.getByRole("button", { name: /加入PRD 结构化生成/i }));
    expect(screen.getAllByText(/增长运营组合/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^增长运营组合/i }));
    expect(screen.queryByRole("dialog", { name: /编辑技能包/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /编辑技能包增长运营组合/i }));
    const reopenPackDialog = screen.getByRole("dialog", { name: /编辑技能包/i });
    fireEvent.click(within(reopenPackDialog).getByRole("button", { name: /删除技能包/i }));
    const deletePackConfirmDialog = screen.getByRole("dialog", { name: /确认删除技能包/i });
    fireEvent.click(within(deletePackConfirmDialog).getByRole("button", { name: /确认删除/i }));
    expect(screen.queryByRole("button", { name: /编辑技能包增长运营组合/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /新建技能包/i }));
    const syncedPackDialog = screen.getByRole("dialog", { name: /编辑技能包/i });
    fireEvent.change(within(syncedPackDialog).getByLabelText(/技能包名称/i), {
      target: { value: "研发效率组合" }
    });
    fireEvent.change(within(syncedPackDialog).getByLabelText(/业务线/i), {
      target: { value: "效率提升" }
    });
    fireEvent.change(within(syncedPackDialog).getByLabelText(/技能分类/i), {
      target: { value: "效率" }
    });
    fireEvent.click(within(syncedPackDialog).getByRole("button", { name: /保存修改/i }));
    fireEvent.click(screen.getByRole("button", { name: /加入PRD 结构化生成/i }));

    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));
    const syncedPackCard = screen.getByRole("button", { name: /切换技能组合 研发效率组合/i });
    expect(syncedPackCard).toBeInTheDocument();
    fireEvent.click(syncedPackCard);
    expect(screen.getAllByText(/PRD 结构化生成/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^自定义组包$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^研发效率组合/i }));
    fireEvent.click(screen.getByRole("button", { name: /编辑技能包研发效率组合/i }));
    const syncedReopenDialog = screen.getByRole("dialog", { name: /编辑技能包/i });
    fireEvent.change(within(syncedReopenDialog).getByLabelText(/技能包名称/i), {
      target: { value: "研发交付增强包" }
    });
    fireEvent.change(within(syncedReopenDialog).getByLabelText(/业务线/i), {
      target: { value: "开发工具" }
    });
    fireEvent.change(within(syncedReopenDialog).getByLabelText(/技能分类/i), {
      target: { value: "研发协作" }
    });
    fireEvent.click(within(syncedReopenDialog).getByRole("button", { name: /保存修改/i }));
    fireEvent.click(screen.getByRole("button", { name: /加入任务包代码生成/i }));

    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));
    const renamedPackCard = screen.getByRole("button", { name: /切换技能组合 研发交付增强包/i });
    expect(renamedPackCard).toBeInTheDocument();
    fireEvent.click(renamedPackCard);
    expect(screen.getAllByText(/PRD 结构化生成/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/任务包代码生成/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /自动化.*后续开放/i }));
    expect(screen.getByRole("heading", { name: /^自动化$/i })).toBeInTheDocument();
    expect(screen.getByText(/MVP 阶段暂未开放/i)).toBeInTheDocument();
    expect(screen.queryByText(/默认升级到 产品经理 Agent/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    expect(screen.getByRole("heading", { name: /权限管理/i })).toBeInTheDocument();
    const levelSection = screen.getByRole("heading", { name: /权限等级/i }).closest("section");
    expect(levelSection).not.toBeNull();
    expect(within(levelSection as HTMLElement).getByRole("button", { name: /L1 观察者/i })).toBeInTheDocument();
    expect(within(levelSection as HTMLElement).getByRole("button", { name: /L2 协作者/i })).toBeInTheDocument();
    expect(within(levelSection as HTMLElement).getByRole("button", { name: /L3 执行者/i })).toBeInTheDocument();
    expect(within(levelSection as HTMLElement).getByRole("button", { name: /L4 管理者/i })).toBeInTheDocument();
    expect(screen.getByText(/项目协作/i)).toBeInTheDocument();
    expect(screen.getByText(/技能与员工/i)).toBeInTheDocument();
    expect(screen.getByText(/治理与放行/i)).toBeInTheDocument();
    expect(screen.getAllByText(/查看项目/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/下载技能/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/修改权限/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/当前项目/i)).not.toBeInTheDocument();
    fireEvent.click(within(levelSection as HTMLElement).getByRole("button", { name: /L4 管理者/i }));
    expect(within(levelSection as HTMLElement).getByRole("button", { name: /L4 管理者/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/当前为管理者权限/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /禁用修改权限/i }));
    expect(screen.getByText(/收紧 · 修改权限/i)).toBeInTheDocument();

    expect(screen.queryByText(/Agent 训练中心/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Agent Registry/i)).not.toBeInTheDocument();
    openSpy.mockRestore();
  }, 15000);

  it("supports downloading a skill from GitHub from the skill library", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          downloadPath: "/tmp/demo-downloads/forge-skills/SkillDeck-20260314.zip"
        }
      })
    } as Response);

    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));
    fireEvent.click(screen.getByRole("button", { name: /下载技能/i }));

    const dialog = screen.getByRole("dialog", { name: /下载技能/i });
    fireEvent.change(within(dialog).getByLabelText(/GitHub 链接/i), {
      target: { value: "https://github.com/crossoverJie/SkillDeck" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /确认下载/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/forge/skills/import",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await within(dialog).findByText(/已下载到/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/forge-skills\/SkillDeck-20260314\.zip/i)).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("hydrates without mismatch when saved team tabs differ from defaults", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    window.localStorage.setItem("forge-agent-team-active-category", "orgChart");
    window.localStorage.setItem("forge-agent-team-employee-tab", "runtime");

    const originalWindow = global.window;
    // Simulate server rendering without browser globals so we exercise the SSR default state.
    // @ts-expect-error - test-only override to emulate a server render.
    delete global.window;
    const serverMarkup = renderToString(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );
    global.window = originalWindow;

    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | null = null;

    await act(async () => {
      root = hydrateRoot(
        container,
        <AgentTeamPage
          snapshot={snapshot}
          showNavigation
        />
      );
      await Promise.resolve();
    });

    expect(
      errorSpy.mock.calls.some(
        ([message]) => typeof message === "string" && message.includes("Hydration failed")
      )
    ).toBe(false);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /组织架构/i })).toHaveAttribute("aria-pressed", "true");
    });

    await act(async () => {
      root?.unmount();
    });
    container.remove();
    errorSpy.mockRestore();
  });

  it("opens skill detail dialog to edit and uninstall a skill", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));

    fireEvent.click(screen.getByRole("button", { name: /装备任务包代码生成/i }));
    expect(screen.queryByRole("dialog", { name: /技能详情/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看技能详情 PRD 结构化生成/i }));

    const dialog = screen.getByRole("dialog", { name: /技能详情/i });
    expect(dialog.parentElement?.className).toContain("centeredOverlay");
    expect(within(dialog).getByDisplayValue(/PRD 结构化生成/i)).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(/输出标准 PRD 草案/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/类别标签/i)).toHaveValue("AI智能");
    expect(within(dialog).getByLabelText(/技能分类/i)).toHaveValue("规划");

    fireEvent.change(within(dialog).getByLabelText(/技能名称/i), {
      target: { value: "PRD 标准化整理" }
    });
    fireEvent.change(within(dialog).getByLabelText(/技能介绍/i), {
      target: { value: "输出结构化 PRD、验收标准与风险说明。" }
    });
    fireEvent.change(within(dialog).getByLabelText(/类别标签/i), {
      target: { value: "内容创作" }
    });
    expect(within(dialog).getByLabelText(/技能分类/i)).toHaveValue("文案策划");
    fireEvent.change(within(dialog).getByLabelText(/技能分类/i), {
      target: { value: "视觉内容" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存修改/i }));

    expect(screen.getAllByText(/PRD 标准化整理/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/输出结构化 PRD、验收标准与风险说明。/i)).toBeInTheDocument();
    expect(screen.getByText(/视觉内容/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看技能详情 PRD 标准化整理/i }));
    const reopenDialog = screen.getByRole("dialog", { name: /技能详情/i });
    expect(within(reopenDialog).getByLabelText(/类别标签/i)).toHaveValue("内容创作");
    expect(within(reopenDialog).getByLabelText(/技能分类/i)).toHaveValue("视觉内容");
    fireEvent.click(within(reopenDialog).getByRole("button", { name: /卸载技能/i }));

    expect(screen.queryByRole("button", { name: /查看技能详情 PRD 标准化整理/i })).not.toBeInTheDocument();
  });

  it("shows lightweight feedback for key team and governance actions", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /选择岗位 UI设计/i }));
    fireEvent.click(screen.getByRole("button", { name: /^产品与方案$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);

    expect(screen.getByRole("status")).toHaveTextContent("已将 产品总监 · Elephant 绑定到 UI设计");

    fireEvent.click(screen.getByRole("button", { name: /权限管理.*分级与审计/i }));
    fireEvent.click(screen.getByRole("button", { name: /L4 管理者/i }));

    expect(screen.getByRole("status")).toHaveTextContent("权限等级已切换为 L4");
  });

  it("keeps the employee list stable when switching skill tabs", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));

    const employeeList = screen.getByTestId("template-employee-pool-list");
    const selectedEmployee = within(employeeList).getByRole("button", {
      name: /产品经理 Agent.*产品总监.*Elephant/i
    });

    employeeList.scrollTop = 96;
    fireEvent.scroll(employeeList);

    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能组合$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^已装技能$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));

    const nextEmployeeList = screen.getByTestId("template-employee-pool-list");
    const nextSelectedEmployee = within(nextEmployeeList).getByRole("button", {
      name: /产品经理 Agent.*产品总监.*Elephant/i
    });

    expect(nextEmployeeList).toBe(employeeList);
    expect(nextEmployeeList.scrollTop).toBe(96);
    expect(nextSelectedEmployee).toBe(selectedEmployee);
  });

  it("saves ability settings through the real team api client and announces refresh", async () => {
    const saveAgentProfile = vi.fn().mockResolvedValue({
      agent: {
        id: "agent-pm",
        name: "产品经理 Agent",
        persona: "你是更强调范围收口和验收标准的产品经理 Agent。",
        promptTemplateId: "prompt-prd-rag",
        skillIds: ["skill-prd", "skill-code"],
        systemPrompt: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。",
        knowledgeSources: ["产品手册", "行业案例库"]
      }
    });
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    const snapshotWithPrompts = {
      ...snapshot,
      promptTemplates: [
        {
          id: "prompt-pm",
          title: "产品经理标准模板",
          scenario: "项目接入",
          summary: "默认产品经理 Prompt 模板。",
          template: "default",
          variables: [],
          version: "v1",
          useCount: 2,
          lastUsedAt: "今天 09:00"
        },
        {
          id: "prompt-prd-rag",
          title: "客服 PRD 模板",
          scenario: "需求澄清",
          summary: "适用于客服和知识库项目。",
          template: "prd-rag",
          variables: [],
          version: "v2",
          useCount: 5,
          lastUsedAt: "今天 09:10"
        }
      ]
    };

    render(<AgentTeamPage saveAgentProfile={saveAgentProfile} showNavigation snapshot={snapshotWithPrompts} />);

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^能力$/i }));
    fireEvent.click(screen.getByRole("button", { name: /编辑能力/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑能力/i });
    fireEvent.change(within(dialog).getByLabelText(/人格设定/i), {
      target: { value: "你是更强调范围收口和验收标准的产品经理 Agent。" }
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /Prompt 模板/i }), {
      target: { value: "prompt-prd-rag" }
    });
    fireEvent.change(within(dialog).getByLabelText(/技能包/i), {
      target: { value: "skill-prd\nskill-code" }
    });
    fireEvent.change(within(dialog).getByLabelText(/知识来源/i), {
      target: { value: "产品手册\n行业案例库" }
    });
    fireEvent.change(within(dialog).getByLabelText(/默认提示词/i), {
      target: { value: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存能力/i }));

    await waitFor(() => {
      expect(saveAgentProfile).toHaveBeenCalledWith({
        agentId: "agent-pm",
        ownerMode: "human-approved",
        persona: "你是更强调范围收口和验收标准的产品经理 Agent。",
        policyId: "policy-product",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-prd-rag",
        skillIds: ["skill-prd", "skill-code"],
        systemPrompt: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。",
        knowledgeSources: ["产品手册", "行业案例库"]
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("已保存 产品总监 · Elephant 的能力配置");
    });
    expectLastRefreshEventToInclude(dispatchEventSpy, "team");
    expectLastRefreshEventToInclude(dispatchEventSpy, "home");
  });

  it("preserves equipped skill packs when saving manual ability fields", async () => {
    const saveAgentProfile = vi.fn().mockResolvedValue({
      agent: {
        id: "agent-pm",
        name: "产品经理 Agent",
        ownerMode: "human-approved",
        persona: "你是更强调范围收口和验收标准的产品经理 Agent。",
        policyId: "policy-product",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。",
        knowledgeSources: ["产品手册"]
      }
    });
    const snapshotWithWorkbench = {
      ...snapshot,
      teamWorkbenchState: {
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-dev",
          qa: "agent-qa",
          release: "agent-release",
          knowledge: "agent-knowledge"
        },
        manualSkillIdsByAgentId: {
          "agent-pm": ["skill-prd"]
        },
        manualKnowledgeSourcesByAgentId: {
          "agent-pm": ["产品手册"]
        },
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {
          "agent-pm": [{ source: "preset", id: "pack-AI智能" }]
        },
        managedAgents: snapshot.agents,
        orgDepartments: [
          { label: "管理层" },
          { label: "产品与方案" },
          { label: "技术研发" },
          { label: "运营支持" }
        ],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    } satisfies ForgeDashboardSnapshot;

    render(
      <AgentTeamPage saveAgentProfile={saveAgentProfile} snapshot={snapshotWithWorkbench} showNavigation />
    );

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^能力$/i }));
    fireEvent.click(screen.getByRole("button", { name: /编辑能力/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑能力/i });
    fireEvent.change(within(dialog).getByLabelText(/人格设定/i), {
      target: { value: "你是更强调范围收口和验收标准的产品经理 Agent。" }
    });
    fireEvent.change(within(dialog).getByLabelText(/默认提示词/i), {
      target: { value: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存能力/i }));

    await waitFor(() => {
      expect(saveAgentProfile).toHaveBeenCalledWith({
        agentId: "agent-pm",
        ownerMode: "human-approved",
        persona: "你是更强调范围收口和验收标准的产品经理 Agent。",
        policyId: "policy-product",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "你是负责需求澄清、PRD 输出与验收对齐的产品经理 Agent。",
        knowledgeSources: ["产品手册"]
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^已装技能$/i }));

    expect(screen.getByText("AI智能技能包")).toBeInTheDocument();
  });

  it("saves runtime settings through the real team api client and announces refresh", async () => {
    const saveAgentProfile = vi.fn().mockResolvedValue({
      agent: {
        id: "agent-pm",
        name: "产品经理 Agent",
        ownerMode: "review-required",
        persona: "范围收口、结果导向、强调验收标准",
        policyId: "policy-product-strict",
        permissionProfileId: "perm-review",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "先收口范围，再输出结构化 PRD。",
        knowledgeSources: ["产品需求手册"]
      }
    });
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    render(<AgentTeamPage saveAgentProfile={saveAgentProfile} showNavigation snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^运行$/i }));
    fireEvent.click(screen.getByRole("button", { name: /编辑运行/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑运行/i });
    fireEvent.change(within(dialog).getByLabelText(/运行方式/i), {
      target: { value: "review-required" }
    });
    fireEvent.change(within(dialog).getByLabelText(/权限配置/i), {
      target: { value: "perm-review" }
    });
    fireEvent.change(within(dialog).getByLabelText(/治理策略/i), {
      target: { value: "policy-product-strict" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存运行/i }));

    await waitFor(() => {
      expect(saveAgentProfile).toHaveBeenCalledWith({
        agentId: "agent-pm",
        ownerMode: "review-required",
        persona: "范围收口、结果导向、强调验收标准",
        policyId: "policy-product-strict",
        permissionProfileId: "perm-review",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "先收口范围，再输出结构化 PRD。",
        knowledgeSources: ["产品需求手册"]
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("已保存 产品总监 · Elephant 的运行配置");
    });
    expectLastRefreshEventToInclude(dispatchEventSpy, "team");
    expectLastRefreshEventToInclude(dispatchEventSpy, "home");
  });

  it("saves basic settings through the real team api client and announces refresh", async () => {
    const saveAgentProfile = vi.fn().mockResolvedValue({
      agent: {
        id: "agent-pm",
        name: "产品策略 Agent",
        role: "architect",
        runnerId: "runner-reviewer",
        departmentLabel: "产品与方案",
        ownerMode: "human-approved",
        persona: "范围收口、结果导向、强调验收标准",
        policyId: "policy-product",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "先收口范围，再输出结构化 PRD。",
        knowledgeSources: ["产品需求手册"]
      }
    });
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    render(<AgentTeamPage saveAgentProfile={saveAgentProfile} showNavigation snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /产品经理 Agent/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^基础$/i }));
    fireEvent.click(screen.getByRole("button", { name: /编辑基础/i }));

    const dialog = screen.getByRole("dialog", { name: /编辑基础/i });
    fireEvent.change(within(dialog).getByLabelText(/员工名称/i), {
      target: { value: "产品策略 Agent" }
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /员工角色/i }), {
      target: { value: "architect" }
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /所属部门/i }), {
      target: { value: "产品与方案" }
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /模型选项/i }), {
      target: { value: "runner-reviewer" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /保存基础/i }));

    await waitFor(() => {
      expect(saveAgentProfile).toHaveBeenCalledWith({
        agentId: "agent-pm",
        name: "产品策略 Agent",
        role: "architect",
        runnerId: "runner-reviewer",
        departmentLabel: "产品与方案",
        ownerMode: "human-approved",
        persona: "范围收口、结果导向、强调验收标准",
        policyId: "policy-product",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-pm",
        skillIds: ["skill-prd"],
        systemPrompt: "先收口范围，再输出结构化 PRD。",
        knowledgeSources: ["产品需求手册"]
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("已保存 产品总监 · Elephant 的基础信息");
    });
    expect(screen.getAllByText(/产品策略 Agent/i).length).toBeGreaterThan(0);
    expectLastRefreshEventToInclude(dispatchEventSpy, "team");
    expectLastRefreshEventToInclude(dispatchEventSpy, "home");
  });

  it("shows lightweight feedback for employee and skill actions", () => {
    render(
      <AgentTeamPage
        snapshot={snapshot}
        showNavigation
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getByRole("button", { name: /新增员工/i }));
    fireEvent.change(screen.getByLabelText(/^员工名称$/i), {
      target: { value: "运营助手 Agent" }
    });
    fireEvent.change(screen.getByLabelText(/^员工角色$/i), {
      target: { value: "knowledge" }
    });
    fireEvent.click(screen.getByRole("button", { name: /确认新增/i }));

    expect(screen.getByRole("status")).toHaveTextContent("已新增员工 运营助手 · 运营助手");

    fireEvent.click(screen.getByRole("button", { name: /技能配置.*Skill \/ 装备/i }));
    fireEvent.click(screen.getByRole("button", { name: /^技能库$/i }));
    fireEvent.click(screen.getByRole("button", { name: /装备任务包代码生成/i }));

    expect(screen.getByRole("status")).toHaveTextContent("已装备技能 任务包代码生成");
  });
});
