import React from "react";
import { render, screen, within } from "@testing-library/react";
import AppShell from "../src/components/app-shell";
import type { ForgeDashboardSnapshot } from "../packages/core/src/types";

const snapshot: ForgeDashboardSnapshot = {
  activeProjectId: "risk-project",
  projects: [
    {
      id: "custom-project",
      name: "本地支付修复台",
      sector: "支付修复 / 交付",
      owner: "Iris",
      status: "active",
      lastRun: "刚刚",
      progress: 48,
      riskNote: "回调补偿逻辑待验证"
    },
    {
      id: "risk-project",
      name: "诊所升级处置台",
      sector: "医疗问答 / 风险处理",
      owner: "Theo",
      status: "risk",
      lastRun: "12 分钟前",
      progress: 63,
      riskNote: "知识库热更新待确认"
    }
  ],
  projectTemplates: [
    {
      id: "template-rag-service",
      title: "知识库问答模板",
      sector: "RAG",
      summary: "适合知识库问答类项目",
      dnaSummary: "默认绑定 RAG 模板和知识库兜底约束。",
      defaultPromptIds: ["prompt-local"],
      defaultGateIds: ["gate-local"],
      constraints: ["必须定义知识库来源"]
    }
  ],
  projectProfiles: [
    {
      projectId: "custom-project",
      templateId: "template-rag-service",
      templateTitle: "知识库问答模板",
      workspacePath: "/tmp/forge/custom-project",
      dnaSummary: "本地支付修复模板",
      defaultPromptIds: ["prompt-local"],
      defaultGateIds: ["gate-local"],
      constraints: ["必须定义支付回退策略"],
      initializedAt: "刚刚"
    },
    {
      projectId: "risk-project",
      templateId: "template-rag-service",
      templateTitle: "知识库问答模板",
      workspacePath: "/tmp/forge/risk-project",
      dnaSummary: "默认绑定 RAG 模板和知识库兜底约束。",
      defaultPromptIds: ["prompt-local"],
      defaultGateIds: ["gate-local"],
      constraints: ["必须定义知识库来源"],
      initializedAt: "刚刚"
    }
  ],
  workflowStates: [
    {
      projectId: "custom-project",
      currentStage: "开发执行",
      state: "current",
      blockers: [],
      lastTransitionAt: "刚刚",
      updatedBy: "system"
    },
    {
      projectId: "risk-project",
      currentStage: "测试验证",
      state: "blocked",
      blockers: ["自动化测试 门禁失败"],
      lastTransitionAt: "刚刚",
      updatedBy: "system"
    }
  ],
  workflowTransitions: [
    {
      id: "transition-risk-project",
      projectId: "risk-project",
      stage: "测试验证",
      state: "blocked",
      updatedBy: "测试 Agent",
      blockers: ["自动化测试 门禁失败"],
      createdAt: "刚刚"
    }
  ],
  assets: [
    {
      id: "asset-local",
      title: "支付失败兜底模板",
      type: "template",
      summary: "包含失败态补偿和订单恢复"
    }
  ],
  promptTemplates: [
    {
      id: "prompt-local",
      title: "客服 PRD 草案模板",
      scenario: "智能客服",
      summary: "适合生成客服系统的需求草案",
      template:
        "请围绕 {{project_name}} 输出 PRD 草案，重点覆盖 {{risk_note}} 和 {{extra_notes}}。",
      variables: ["project_name", "risk_note", "extra_notes"],
      version: "v1.2",
      useCount: 7,
      lastUsedAt: "刚刚"
    }
  ],
  prdDocuments: [
    {
      id: "prd-other",
      projectId: "custom-project",
      templateId: "prompt-local",
      title: "本地支付修复台 PRD 草案",
      content: "# 本地支付修复台 PRD 草案\n\n## 核心目标\n- 修复支付回调",
      status: "draft",
      createdAt: "刚刚"
    },
    {
      id: "prd-local",
      projectId: "risk-project",
      templateId: "prompt-local",
      title: "诊所升级处置台 PRD 草案",
      content: "# 诊所升级处置台 PRD 草案\n\n## 核心目标\n- 提升知识库热更新的稳定性",
      status: "draft",
      createdAt: "刚刚"
    }
  ],
  projectAssetLinks: [],
  agents: [],
  skills: [],
  sops: [],
  teamTemplates: [],
  artifacts: [],
  artifactReviews: [],
  tasks: [],
  commands: [],
  commandHooks: [],
  commandExecutions: [],
  policyDecisions: [],
  runs: [
    {
      id: "run-local",
      projectId: "risk-project",
      title: "生成回调补丁",
      executor: "Codex",
      cost: "$0.91",
      state: "running"
    }
  ],
  runEvents: [
    {
      id: "run-event-local",
      runId: "run-local",
      projectId: "risk-project",
      type: "status",
      summary: "Codex 正在生成回调补丁。",
      failureCategory: null,
      createdAt: "刚刚"
    }
  ],
  runners: [
    {
      id: "runner-local",
      name: "本地主执行器",
      status: "busy",
      summary: "负责当前项目的本地补丁执行。",
      workspacePath: "/tmp/forge/risk-project",
      capabilities: ["Codex", "文件写入"],
      detectedCapabilities: ["Codex", "文件写入"],
      probeStatus: "healthy",
      probeSummary: "本地补丁执行能力正常。",
      currentRunId: "run-local",
      lastHeartbeat: "2026-03-08T12:00:00.000Z",
      lastProbeAt: "2026-03-08T11:59:00.000Z"
    }
  ],
  deliveryGate: [
    {
      id: "gate-local",
      name: "自动化测试",
      status: "fail"
    }
  ]
};

describe("Forge home shell", () => {
  it("keeps the home view focused on cockpit information instead of all operations", () => {
    render(<AppShell snapshot={snapshot} view="home" />);

    expect(
      screen.getByRole("heading", { name: /forge/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /节点轨道/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /当前节点工作台/i })).toBeInTheDocument();
    expect(screen.getAllByText(/项目接入/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/方案与任务包/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/开发执行/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/测试验证/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/交付发布/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/归档复用/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/当前项目：诊所升级处置台/i)).toBeInTheDocument();
    expect(screen.getByText(/下一步：修复失败项并重新运行验证/i)).toBeInTheDocument();
    expect(screen.getByText(/当前目标/i)).toBeInTheDocument();
    expect(screen.getByText(/下一动作/i)).toBeInTheDocument();
    expect(screen.getAllByText(/知识库问答模板/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\/tmp\/forge\/risk-project/i)).toBeInTheDocument();
    expect(screen.getByText(/风险与阻塞/i)).toBeInTheDocument();
    expect(screen.getByText(/最近执行/i)).toBeInTheDocument();

    expect(screen.queryByText(/当前项目集/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/快速建立项目/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prompt 模板库/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRD 生成/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最新 PRD 草案/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/推荐复用资产/i)).not.toBeInTheDocument();
  });

  it("renders intake controls on the intake page instead of the home page", () => {
    render(<AppShell snapshot={snapshot} view="intake" />);

    expect(screen.getByText(/当前项目集/i)).toBeInTheDocument();
    expect(screen.getByText(/快速建立项目/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^当前项目$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^设为当前项目$/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/项目名称/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/项目模板/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/行业 \/ 场景/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/负责人/i)).toBeInTheDocument();
    expect(screen.queryByText(/Prompt 模板库/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最新 PRD 草案/i)).not.toBeInTheDocument();
  });

  it("renders prompt templates and prd tools on the task-pack page", () => {
    render(<AppShell snapshot={snapshot} view="task-pack" />);

    expect(screen.getByText(/Prompt 模板库/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /PRD 生成/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最新 PRD 草案/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/选择模板/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/补充说明/i)).toBeInTheDocument();
    expect(screen.getAllByText(/诊所升级处置台 PRD 草案/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/本地支付修复台 PRD 草案/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/快速建立项目/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/推荐复用资产/i)).not.toBeInTheDocument();
  });

  it("keeps the execution page focused on delivery work instead of mixed operations", () => {
    render(<AppShell snapshot={snapshot} view="execution" />);

    expect(screen.getByRole("heading", { name: /当前节点工作台/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /执行焦点/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /执行队列/i })).toBeInTheDocument();
    expect(screen.getByText(/当前通道/i)).toBeInTheDocument();
    expect(screen.getByText(/编码执行/i)).toBeInTheDocument();
    expect(screen.queryByText(/风险与阻塞/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prompt 模板库/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRD 生成/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最新 PRD 草案/i)).not.toBeInTheDocument();
  });

  it("keeps the verification page centered on gates and blockers", () => {
    render(<AppShell snapshot={snapshot} view="verification" />);

    expect(screen.getByRole("heading", { name: /当前节点工作台/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /风险与阻塞/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /验证记录/i })).toBeInTheDocument();
    expect(screen.getByText(/阻塞节点: 自动化测试/i)).toBeInTheDocument();
    expect(screen.queryByText(/执行焦点/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prompt 模板库/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRD 生成/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/最新 PRD 草案/i)).not.toBeInTheDocument();
  });

  it("keeps the delivery page centered on release summary and handoff context", () => {
    render(<AppShell snapshot={snapshot} view="delivery" />);

    expect(screen.getByRole("heading", { name: /当前节点工作台/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /交付概要/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最新 PRD 草案/i })).toBeInTheDocument();
    expect(screen.getAllByText(/当前项目/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/诊所升级处置台/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/门禁结果/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/最近执行/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/验证记录/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/推荐复用资产/i)).not.toBeInTheDocument();
  });

  it("keeps the archive page focused on reusable knowledge only", () => {
    render(<AppShell snapshot={snapshot} view="archive" />);

    expect(screen.getByRole("heading", { name: /沉淀建议/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /推荐复用资产/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最新 PRD 草案/i })).toBeInTheDocument();
    expect(screen.queryByText(/当前节点工作台/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/风险与阻塞/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/执行队列/i)).not.toBeInTheDocument();
  });
});
