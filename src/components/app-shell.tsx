import React from "react";
import { getActiveProject, getDeliveryStateLabel } from "../../packages/core/src";
import type {
  DeliveryGateItem,
  ForgeDashboardSnapshot,
  ForgeProject,
  ForgePromptTemplate
} from "../../packages/core/src/types";
import { forgeNavigationItems } from "../lib/forge-views";
import type { AppShellView } from "../lib/forge-views";

const statusTone = {
  active: "status-active",
  risk: "status-risk",
  ready: "status-ready",
  running: "status-active",
  blocked: "status-risk",
  done: "status-ready",
  pass: "status-ready",
  pending: "status-pending",
  fail: "status-risk"
} as const;

const projectStatusLabel = {
  active: "进行中",
  risk: "有风险",
  ready: "可交付"
} as const;

const runStateLabel = {
  running: "执行中",
  blocked: "已阻塞",
  done: "已完成"
} as const;

const gateStatusLabel = {
  pass: "通过",
  pending: "待确认",
  fail: "失败"
} as const;

const assetTypeLabel = {
  template: "模板",
  prompt: "提示词",
  skill: "技能",
  gate: "门禁"
} as const;

const executorLabel = {
  Codex: "编码代理",
  Claude: "总结代理",
  Playwright: "自动化测试"
} as const;

const workflowNodeTone = {
  done: "status-ready",
  current: "status-active",
  pending: "status-pending",
  risk: "status-risk"
} as const;

const workflowNodeStateLabel = {
  done: "已完成",
  current: "当前节点",
  pending: "待开始",
  risk: "阻塞中"
} as const;

const workflowStages = [
  "项目接入",
  "方案与任务包",
  "开发执行",
  "测试验证",
  "交付发布",
  "归档复用"
] as const;

const stageViewMap: Record<Exclude<AppShellView, "home" | "team">, WorkflowStage> = {
  intake: "项目接入",
  "task-pack": "方案与任务包",
  execution: "开发执行",
  verification: "测试验证",
  delivery: "交付发布",
  archive: "归档复用"
};

type WorkflowStage = (typeof workflowStages)[number];
type WorkflowNodeState = keyof typeof workflowNodeTone;
type WorkflowNode = {
  id: string;
  title: WorkflowStage;
  state: WorkflowNodeState;
  summary: string;
};

type StageChecklistItem = {
  id: string;
  label: string;
  state: keyof typeof statusTone;
  detail: string;
};

type StageArtifact = {
  label: string;
  value: string;
};

type SummaryItem = {
  label: string;
  value: string;
};

type StageWorkbenchModel = {
  stageTag: string;
  objective: string;
  nextAction: string;
  lane: string;
  operator: string;
  blockerTitle: string;
  blockerSummary: string;
  checklist: StageChecklistItem[];
  artifacts: StageArtifact[];
};

function getCurrentWorkflowStage(
  activeProject: ForgeProject,
  deliveryState: string
): WorkflowStage {
  if (deliveryState === "已阻塞" || deliveryState === "待确认") {
    return "测试验证";
  }

  if (activeProject.progress < 15) {
    return "项目接入";
  }

  if (activeProject.progress < 35) {
    return "方案与任务包";
  }

  if (activeProject.progress < 85) {
    return "开发执行";
  }

  if (activeProject.status === "ready") {
    return "交付发布";
  }

  return "开发执行";
}

function getWorkflowStageIndex(stage: WorkflowStage) {
  return workflowStages.indexOf(stage);
}

function getSelectedStage(view: AppShellView, currentStage: WorkflowStage): WorkflowStage {
  if (view === "home" || view === "team") {
    return currentStage;
  }

  return stageViewMap[view];
}

function getPageTitle(view: AppShellView) {
  const pageTitles: Record<AppShellView, string> = {
    home: "研发驾驶舱",
    intake: "项目接入",
    "task-pack": "方案与任务包",
    execution: "开发执行",
    verification: "测试验证",
    delivery: "交付发布",
    archive: "归档复用",
    team: "团队"
  };

  return pageTitles[view];
}

function getPageEyebrow(view: AppShellView) {
  return view === "home" ? "首页总览" : "节点页面";
}

function getPageDescription(
  view: AppShellView,
  activeProject: ForgeProject,
  currentStage: WorkflowStage
) {
  const descriptions: Record<AppShellView, string> = {
    home: "首页只保留节点轨道、当前工作台、阻塞和执行动态，专注判断项目接下来该怎么推进。",
    intake: "只处理新项目创建、模板绑定和项目切换，不把需求接入动作混在其他阶段里。",
    "task-pack":
      "只处理 Prompt 模板、PRD 草案和任务包准备，让方案层输出独立成页。",
    execution: `围绕 ${activeProject.name} 的开发推进执行记录和当前工作台，不混入接入与沉淀模块。`,
    verification: "只看门禁、阻塞和验证动作，把测试验证从首页剥离成独立节点页。",
    delivery: `聚焦 ${activeProject.name} 的交付状态、发布动作和当前可交付性，避免和开发细节混杂。`,
    archive: "只看可复用资产和复盘沉淀，不把归档内容和执行过程混在一起。",
    team: "团队页独立承载 Agent 编制、角色职责和工件归属，不与项目节点动作混排。"
  };

  if (view === "home") {
    return descriptions.home;
  }

  return `${descriptions[view]} 当前项目实际所在节点：${currentStage}。`;
}

function getWorkflowNodes(
  activeProject: ForgeProject,
  deliveryState: string
): WorkflowNode[] {
  const currentStage = getCurrentWorkflowStage(activeProject, deliveryState);
  const currentStageIndex = getWorkflowStageIndex(currentStage);

  return workflowStages.map((title, index) => {
    let state: WorkflowNodeState = "pending";

    if (index < currentStageIndex) {
      state = "done";
    } else if (index === currentStageIndex) {
      state = currentStage === "测试验证" && deliveryState === "已阻塞" ? "risk" : "current";
    }

    const summaries: Record<WorkflowStage, string> = {
      项目接入: "补齐需求摘要、模板和约束，建立本地项目基线。",
      "方案与任务包": "把方案收敛成可执行任务包，锁定实现边界。",
      开发执行: `围绕当前任务包推进编码，已完成 ${activeProject.progress}% 。`,
      测试验证:
        deliveryState === "已阻塞"
          ? "当前门禁存在失败项，必须先回归再继续发布。"
          : "当前门禁已基本转绿，可以准备交付动作。",
      交付发布: "生成预览、整理验收说明、发起交付确认。",
      归档复用: "沉淀模板、提示词、修复经验和交付记录。"
    };

    return {
      id: `stage-${index + 1}`,
      title,
      state,
      summary: summaries[title]
    };
  });
}

function getNextStepLabel(deliveryGates: DeliveryGateItem[], currentStage: WorkflowStage) {
  const failedGate = deliveryGates.find((gate) => gate.status === "fail");

  if (failedGate) {
    return "修复失败项并重新运行验证";
  }

  if (currentStage === "交付发布") {
    return "生成预览链接并发起验收";
  }

  if (currentStage === "开发执行") {
    return "继续推进当前任务包并准备回归";
  }

  return "补齐当前节点必需信息";
}

function getExecutorLabel(executor: string) {
  return executorLabel[executor as keyof typeof executorLabel] ?? executor;
}

function isRecommendedPromptTemplate(template: ForgePromptTemplate, project: ForgeProject) {
  const projectContext = `${project.name} ${project.sector}`.toLowerCase();
  const scenario = template.scenario.toLowerCase();

  if (projectContext.includes("客服") && scenario.includes("客服")) {
    return true;
  }

  if (projectContext.includes("rag") && scenario.includes("rag")) {
    return true;
  }

  if (projectContext.includes("运营") && scenario.includes("运营")) {
    return true;
  }

  return false;
}

function getPrdPreview(content: string) {
  return content.split("\n").slice(0, 10).join("\n");
}

function getGateDetail(gate: DeliveryGateItem) {
  if (gate.name === "Playwright" || gate.name === "自动化测试") {
    return "覆盖主流程与异常输入回归";
  }

  if (gate.name === "构建") {
    return "确保当前版本可以正常打包";
  }

  if (gate.name === "类型检查") {
    return "消除类型漂移与未收敛接口";
  }

  if (gate.name === "人工复核") {
    return "确认业务路径与交互符合预期";
  }

  return "当前节点校验项";
}

function getStageChecklist(
  currentStage: WorkflowStage,
  deliveryGate: DeliveryGateItem[]
): StageChecklistItem[] {
  if (currentStage === "测试验证") {
    return deliveryGate.map((gate) => ({
      id: gate.id,
      label: gate.name,
      state: gate.status,
      detail: getGateDetail(gate)
    }));
  }

  const stageTemplates: Record<Exclude<WorkflowStage, "测试验证">, StageChecklistItem[]> = {
    项目接入: [
      {
        id: "intake-1",
        label: "录入需求摘要",
        state: "done",
        detail: "客户目标、禁忌和核心流程已经进入项目上下文。"
      },
      {
        id: "intake-2",
        label: "选择行业模板",
        state: "active",
        detail: "确定默认提示词、测试包和交付框架。"
      },
      {
        id: "intake-3",
        label: "建立本地项目",
        state: "pending",
        detail: "创建工作目录、知识库和初始配置。"
      }
    ],
    "方案与任务包": [
      {
        id: "plan-1",
        label: "收敛方案边界",
        state: "active",
        detail: "明确不做什么，避免 AI 自由发挥。"
      },
      {
        id: "plan-2",
        label: "输出任务包",
        state: "pending",
        detail: "把需求拆成可直接投喂的执行单元。"
      },
      {
        id: "plan-3",
        label: "确认验收标准",
        state: "pending",
        detail: "把测试门禁和交付条件写成清单。"
      }
    ],
    开发执行: [
      {
        id: "dev-1",
        label: "推进编码任务",
        state: "active",
        detail: "围绕当前任务包生成和修正代码。"
      },
      {
        id: "dev-2",
        label: "同步关键上下文",
        state: "done",
        detail: "保留客户约束、模板引用和风险说明。"
      },
      {
        id: "dev-3",
        label: "准备回归验证",
        state: "pending",
        detail: "在提交前整理好测试入口和预期结果。"
      }
    ],
    交付发布: [
      {
        id: "release-1",
        label: "生成预览地址",
        state: "active",
        detail: "让客户或内部评审能直接查看当前版本。"
      },
      {
        id: "release-2",
        label: "整理验收说明",
        state: "pending",
        detail: "用业务语言说明已完成内容和限制。"
      },
      {
        id: "release-3",
        label: "发起交付确认",
        state: "pending",
        detail: "推动签收、反馈和后续迭代。"
      }
    ],
    归档复用: [
      {
        id: "archive-1",
        label: "沉淀模板",
        state: "active",
        detail: "将本次方案整理为下次可启动的骨架。"
      },
      {
        id: "archive-2",
        label: "沉淀提示词",
        state: "pending",
        detail: "保留有效提示词和变量约束。"
      },
      {
        id: "archive-3",
        label: "沉淀修复经验",
        state: "pending",
        detail: "记录本次坑点和验证路径。"
      }
    ]
  };

  return stageTemplates[currentStage];
}

function getStageWorkbenchModel(
  activeProject: ForgeProject,
  currentStage: WorkflowStage,
  deliveryState: string,
  deliveryGate: DeliveryGateItem[]
): StageWorkbenchModel {
  const blockedGate = deliveryGate.find((gate) => gate.status === "fail");
  const nextAction = getNextStepLabel(deliveryGate, currentStage);
  const checklist = getStageChecklist(currentStage, deliveryGate);

  const baseArtifacts: StageArtifact[] = [
    {
      label: "当前项目",
      value: activeProject.name
    },
    {
      label: "业务场景",
      value: activeProject.sector
    },
    {
      label: "负责人",
      value: activeProject.owner
    },
    {
      label: "最近更新",
      value: activeProject.lastRun
    }
  ];

  const models: Record<WorkflowStage, Omit<StageWorkbenchModel, "checklist" | "artifacts">> = {
    项目接入: {
      stageTag: "节点 1",
      objective: "把新项目的需求、模板和约束一次性收进系统。",
      nextAction,
      lane: "建立项目 DNA",
      operator: activeProject.owner,
      blockerTitle: "当前关注",
      blockerSummary: activeProject.riskNote
    },
    "方案与任务包": {
      stageTag: "节点 2",
      objective: "把需求收敛成可执行任务包，锁定实现边界。",
      nextAction,
      lane: "方案输出",
      operator: activeProject.owner,
      blockerTitle: "当前关注",
      blockerSummary: activeProject.riskNote
    },
    开发执行: {
      stageTag: "节点 3",
      objective: "围绕当前任务包推进实现，并为下一轮回归留出口。",
      nextAction,
      lane: "编码执行",
      operator: activeProject.owner,
      blockerTitle: "当前关注",
      blockerSummary: activeProject.riskNote
    },
    测试验证: {
      stageTag: "节点 4",
      objective: "让交付门禁全部转绿，恢复发布通道。",
      nextAction,
      lane: "验证回归",
      operator: activeProject.owner,
      blockerTitle: blockedGate?.name ?? "无阻塞",
      blockerSummary:
        deliveryState === "已阻塞" ? activeProject.riskNote : "门禁已恢复，可以推进交付。"
    },
    交付发布: {
      stageTag: "节点 5",
      objective: "整理预览、说明和验收动作，推动项目交付。",
      nextAction,
      lane: "交付推进",
      operator: activeProject.owner,
      blockerTitle: "交付说明",
      blockerSummary: activeProject.riskNote
    },
    归档复用: {
      stageTag: "节点 6",
      objective: "把这次项目变成下次启动时可直接复用的资产。",
      nextAction,
      lane: "经验沉淀",
      operator: activeProject.owner,
      blockerTitle: "沉淀重点",
      blockerSummary: activeProject.riskNote
    }
  };

  return {
    ...models[currentStage],
    checklist,
    artifacts: baseArtifacts
  };
}

function getGatePassCount(deliveryGate: DeliveryGateItem[]) {
  return deliveryGate.filter((gate) => gate.status === "pass").length;
}

function getExecutionFocusItems(
  activeProject: ForgeProject,
  activeProjectProfile: ForgeDashboardSnapshot["projectProfiles"][number] | null,
  workbench: StageWorkbenchModel
): SummaryItem[] {
  return [
    {
      label: "执行责任",
      value: workbench.operator
    },
    {
      label: "本地工作区",
      value: activeProjectProfile?.workspacePath ?? "待初始化"
    },
    {
      label: "已绑模板",
      value: activeProjectProfile?.templateTitle ?? "待绑定"
    },
    {
      label: "当前关注",
      value: activeProject.riskNote
    }
  ];
}

function getDeliverySummaryItems(
  activeProject: ForgeProject,
  deliveryState: string,
  deliveryGate: DeliveryGateItem[],
  latestPrdDocument: ForgeDashboardSnapshot["prdDocuments"][number] | null
): SummaryItem[] {
  return [
    {
      label: "当前项目",
      value: activeProject.name
    },
    {
      label: "当前状态",
      value: deliveryState
    },
    {
      label: "门禁结果",
      value: `${getGatePassCount(deliveryGate)}/${deliveryGate.length} 已通过`
    },
    {
      label: "交付材料",
      value: latestPrdDocument?.title ?? "待生成"
    }
  ];
}

function getArchiveSummaryItems(
  activeProjectProfile: ForgeDashboardSnapshot["projectProfiles"][number] | null,
  latestPrdDocument: ForgeDashboardSnapshot["prdDocuments"][number] | null,
  assetCount: number,
  promptCount: number
): SummaryItem[] {
  return [
    {
      label: "沉淀模板",
      value: activeProjectProfile?.templateTitle ?? "待沉淀"
    },
    {
      label: "最新草案",
      value: latestPrdDocument?.title ?? "待生成"
    },
    {
      label: "可复用资产",
      value: `${assetCount} 项`
    },
    {
      label: "Prompt 模板",
      value: `${promptCount} 条`
    }
  ];
}

type SummaryPanelProps = {
  eyebrow: string;
  title: string;
  badge: string;
  items: SummaryItem[];
  panelClassName?: string;
};

function SummaryPanel({
  eyebrow,
  title,
  badge,
  items,
  panelClassName
}: SummaryPanelProps) {
  return (
    <section className={panelClassName ? `panel ${panelClassName}` : "panel"}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="pill">{badge}</span>
      </div>
      <ul className="detail-list summary-list">
        {items.map((item) => (
          <li className="summary-item" key={item.label}>
            <p className="summary-item-line">
              <span>{item.label}:</span>
              <strong>{item.value}</strong>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

type RunsPanelProps = {
  runs: ForgeDashboardSnapshot["runs"];
  title: string;
  eyebrow: string;
  badge: string;
};

function RunsPanel({ runs, title, eyebrow, badge }: RunsPanelProps) {
  return (
    <section id="settings" className="panel panel-full">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="pill">{badge}</span>
      </div>
      <div className="run-list run-list-wide">
        {runs.map((run) => (
          <article className="run-card" key={run.id}>
            <div>
              <h4>{run.title}</h4>
              <p>{getExecutorLabel(run.executor)}</p>
            </div>
            <div className="run-meta">
              <span>{run.cost}</span>
              <span className={`pill ${statusTone[run.state]}`}>{runStateLabel[run.state]}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LatestPrdPanel({
  latestPrdDocument
}: {
  latestPrdDocument: ForgeDashboardSnapshot["prdDocuments"][number] | null;
}) {
  return (
    <section id="prd-latest" className="panel panel-full">
      <div className="panel-head">
        <div>
          <p className="eyebrow">草案</p>
          <h3>最新 PRD 草案</h3>
        </div>
        <span className="pill">{latestPrdDocument?.status === "draft" ? "草案" : "已就绪"}</span>
      </div>
      {latestPrdDocument ? (
        <article className="prd-document-card">
          <div className="prd-document-head">
            <div>
              <h4>{latestPrdDocument.title}</h4>
              <p>来源模板：{latestPrdDocument.templateId}</p>
            </div>
            <span className="pill pill-soft">{latestPrdDocument.createdAt}</span>
          </div>
          <pre className="prd-document-preview">{getPrdPreview(latestPrdDocument.content)}</pre>
        </article>
      ) : (
        <div className="empty-state-card">
          <p>还没有生成 PRD 草案，先选择模板并生成第一份文档。</p>
        </div>
      )}
    </section>
  );
}

type AppShellProps = {
  snapshot: ForgeDashboardSnapshot;
  view?: AppShellView;
  createProjectAction?: (formData: FormData) => void | Promise<void>;
  generatePrdDraftAction?: (formData: FormData) => void | Promise<void>;
  setActiveProjectAction?: (formData: FormData) => void | Promise<void>;
};

export default function AppShell({
  snapshot,
  view = "home",
  createProjectAction,
  generatePrdDraftAction,
  setActiveProjectAction
}: AppShellProps) {
  const activeProject =
    getActiveProject(snapshot.projects, snapshot.activeProjectId) ??
    snapshot.projects[0] ??
    null;
  const deliveryState = getDeliveryStateLabel(snapshot.deliveryGate);

  if (!activeProject) {
    return (
      <main className="forge-shell">
        <section className="main-grid">
          <section className="panel panel-wide">
            <div className="panel-head">
              <div>
                <p className="eyebrow">项目</p>
                <h3>暂无项目</h3>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const currentStage = getCurrentWorkflowStage(activeProject, deliveryState);
  const selectedStage = getSelectedStage(view, currentStage);
  const nextStepLabel = getNextStepLabel(snapshot.deliveryGate, currentStage);
  const workflowNodes = getWorkflowNodes(activeProject, deliveryState);
  const blockedGate = snapshot.deliveryGate.find((gate) => gate.status === "fail");
  const activeProjectProfile =
    snapshot.projectProfiles.find((profile) => profile.projectId === activeProject.id) ?? null;
  const latestPrdDocument =
    snapshot.prdDocuments.find((document) => document.projectId === activeProject.id) ?? null;
  const workbench = getStageWorkbenchModel(
    activeProject,
    selectedStage,
    deliveryState,
    snapshot.deliveryGate
  );
  const pageTitle = getPageTitle(view);
  const pageEyebrow = getPageEyebrow(view);
  const pageDescription = getPageDescription(view, activeProject, currentStage);
  const selectedStageNodeState =
    workflowNodes[getWorkflowStageIndex(selectedStage)]?.state ?? "current";
  const isHomeView = view === "home";
  const isIntakeView = view === "intake";
  const isTaskPackView = view === "task-pack";
  const isExecutionView = view === "execution";
  const isVerificationView = view === "verification";
  const isDeliveryView = view === "delivery";
  const isArchiveView = view === "archive";
  const executionFocusItems = getExecutionFocusItems(activeProject, activeProjectProfile, workbench);
  const deliverySummaryItems = getDeliverySummaryItems(
    activeProject,
    deliveryState,
    snapshot.deliveryGate,
    latestPrdDocument
  );
  const archiveSummaryItems = getArchiveSummaryItems(
    activeProjectProfile,
    latestPrdDocument,
    snapshot.assets.length,
    snapshot.promptTemplates.length
  );

  return (
    <main className="forge-shell">
      <aside className="nav-rail">
        <div>
          <p className="eyebrow">Forge 工作台</p>
          <h1>Forge</h1>
        </div>
        <nav className="nav-stack" aria-label="主导航">
          {forgeNavigationItems.map((item) => (
            <a
              href={item.href}
              key={item.view}
              data-active={view === item.view ? "true" : "false"}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="nav-foot">
          <span className="pill pill-solid">macOS 本地优先</span>
          <p>单一桌面入口，本地执行生产过程，云端只共享必要状态。</p>
        </div>
      </aside>

      <section className="main-grid">
        <header className="hero-card context-strip">
          <div>
            <p className="eyebrow">{pageEyebrow}</p>
            <h2>{pageTitle}</h2>
            <p className="context-line">当前项目：{activeProject.name}</p>
            <p className="context-line">当前节点：{currentStage}</p>
            {!isHomeView ? <p className="context-line">正在查看：{selectedStage}</p> : null}
            <p className="context-line">下一步：{nextStepLabel}</p>
            <p className="hero-copy">{pageDescription}</p>
          </div>
          <div className="hero-metrics context-metrics">
            <div>
              <span>{snapshot.projects.length}</span>
              <p>活动项目</p>
            </div>
            <div>
              <span>{activeProject.progress}%</span>
              <p>当前进度</p>
            </div>
            <div>
              <span>{deliveryState}</span>
              <p>节点状态</p>
            </div>
          </div>
        </header>

        {isHomeView ? (
          <section className="panel panel-full workflow-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">研发流程</p>
              <h3>节点轨道</h3>
            </div>
            <span className="pill">按节点推进</span>
          </div>
          <div className="workflow-rail">
            {workflowNodes.map((node, index) => (
              <article className="workflow-stage" key={node.id} id={node.id}>
                <div className="workflow-stage-line" aria-hidden="true" />
                <div className="workflow-stage-marker">
                  <span className={`pill ${workflowNodeTone[node.state]}`}>
                    {workflowNodeStateLabel[node.state]}
                  </span>
                  <span className="workflow-stage-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="workflow-stage-copy">
                  <h4>{node.title}</h4>
                  <p>{node.summary}</p>
                </div>
              </article>
            ))}
          </div>
          </section>
        ) : null}

        {(isHomeView || isExecutionView || isVerificationView || isDeliveryView) ? (
        <section id="workspace" className="panel panel-wide workspace-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{workbench.stageTag}</p>
              <h3>当前节点工作台</h3>
            </div>
            <span className={`pill ${workflowNodeTone[selectedStageNodeState]}`}>
              {selectedStage}
            </span>
          </div>

          <div className="workbench-hero">
            <div className="workbench-main">
              <p className="stage-label">当前目标</p>
              <h4>{workbench.objective}</h4>
              <p className="stage-summary">{workbench.blockerSummary}</p>
            </div>
            <div className="workbench-meta">
              <div className="metric-tile">
                <p className="stage-label">下一动作</p>
                <strong>{workbench.nextAction}</strong>
              </div>
              <div className="metric-tile">
                <p className="stage-label">执行责任</p>
                <strong>{workbench.operator}</strong>
              </div>
              <div className="metric-tile">
                <p className="stage-label">当前通道</p>
                <strong>{workbench.lane}</strong>
              </div>
            </div>
          </div>

          <div className="workbench-grid">
            <section className="subpanel">
              <div className="subpanel-head">
                <div>
                  <p className="eyebrow">检查清单</p>
                  <h4>节点检查项</h4>
                </div>
                <span className={`pill ${blockedGate ? "status-risk" : "status-ready"}`}>
                  {blockedGate ? "先清阻塞" : "可继续推进"}
                </span>
              </div>
              <div className="checklist-list">
                {workbench.checklist.map((item) => (
                  <div className="checklist-item" key={item.id}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className={`pill ${statusTone[item.state]}`}>
                      {item.state === "fail"
                        ? "失败"
                        : item.state === "pending"
                          ? "待确认"
                          : item.state === "done"
                            ? "已完成"
                            : item.state === "pass"
                                ? "通过"
                                : "处理中"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="subpanel">
              <div className="subpanel-head">
                <div>
                  <p className="eyebrow">上下文</p>
                  <h4>当前上下文</h4>
                </div>
                <span className="pill">项目信息</span>
              </div>
              <div className="artifact-list">
                {workbench.artifacts.map((artifact) => (
                  <div className="artifact-item" key={artifact.label}>
                    <span>{artifact.label}</span>
                    <strong>{artifact.value}</strong>
                  </div>
                ))}
                {activeProjectProfile ? (
                  <>
                    <div className="artifact-item">
                      <span>项目模板</span>
                      <strong>{activeProjectProfile.templateTitle}</strong>
                    </div>
                    <div className="artifact-item">
                      <span>本地工作区</span>
                      <strong>{activeProjectProfile.workspacePath}</strong>
                    </div>
                    <div className="artifact-item">
                      <span>DNA 摘要</span>
                      <strong>{activeProjectProfile.dnaSummary}</strong>
                    </div>
                  </>
                ) : null}
                <div className="artifact-item">
                  <span>关键阻塞</span>
                  <strong>{workbench.blockerTitle}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>
        ) : null}

        {isIntakeView ? (
        <section id="projects" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">项目切换</p>
              <h3>当前项目集</h3>
            </div>
            <span className="pill">本地项目</span>
          </div>
          <div className="project-switch-list">
            {snapshot.projects.map((project) => (
              <article className="project-switch-card" key={project.id}>
                <div className="project-switch-head">
                  <div>
                    <h4>{project.name}</h4>
                    <p>{project.sector}</p>
                  </div>
                  <span className={`pill ${statusTone[project.status]}`}>
                    {projectStatusLabel[project.status]}
                  </span>
                </div>
                <div className="project-inline-meta">
                  <span>负责人 {project.owner}</span>
                  <span>进度 {project.progress}%</span>
                </div>
                <form action={setActiveProjectAction} className="project-card-action">
                  <input type="hidden" name="projectId" value={project.id} />
                  <button
                    type="submit"
                    className="action-button"
                    disabled={project.id === activeProject.id}
                  >
                    {project.id === activeProject.id ? "当前项目" : "设为当前项目"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {isIntakeView ? (
        <section id="create" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">项目接入</p>
              <h3>快速建立项目</h3>
            </div>
            <span className="pill">节点 1</span>
          </div>
          <form action={createProjectAction} className="project-form">
            <label className="field">
              <span>项目名称</span>
              <input name="name" type="text" placeholder="例如：企业知识助手" required />
            </label>
            <label className="field">
              <span>项目模板</span>
              <select
                name="templateId"
                defaultValue={snapshot.projectTemplates[0]?.id}
                required
              >
                {snapshot.projectTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>行业 / 场景</span>
              <input name="sector" type="text" placeholder="例如：企业服务 / 知识管理" required />
            </label>
            <label className="field">
              <span>负责人</span>
              <input name="owner" type="text" placeholder="例如：项目负责人" required />
            </label>
            <button type="submit" className="action-button action-button-primary">
              创建并激活项目
            </button>
          </form>
        </section>
        ) : null}

        {isArchiveView ? (
        <section id="assets" className="panel panel-wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">推荐</p>
              <h3>推荐复用资产</h3>
            </div>
            <span className="pill">归档复用</span>
          </div>
          <div className="asset-list">
            {snapshot.assets.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <div className="asset-top">
                  <span className="pill pill-soft">{assetTypeLabel[asset.type]}</span>
                  <h4>{asset.title}</h4>
                </div>
                <p>{asset.summary}</p>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {isTaskPackView ? (
        <section id="prompts" className="panel panel-wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">模板</p>
              <h3>Prompt 模板库</h3>
            </div>
            <span className="pill">方案与任务包</span>
          </div>
          <div className="prompt-template-list">
            {snapshot.promptTemplates.map((template) => (
              <article className="prompt-template-card" key={template.id}>
                <div className="prompt-template-head">
                  <div>
                    <h4>{template.title}</h4>
                    <p>
                      {template.scenario} · {template.version}
                    </p>
                  </div>
                  <span
                    className={`pill ${isRecommendedPromptTemplate(template, activeProject) ? "status-ready" : "pill-soft"}`}
                  >
                    {isRecommendedPromptTemplate(template, activeProject)
                      ? "推荐给当前项目"
                      : "可复用"}
                  </span>
                </div>
                <p className="prompt-template-summary">{template.summary}</p>
                <div className="prompt-template-meta">
                  <span>变量：{template.variables.join(" / ")}</span>
                  <span>使用 {template.useCount} 次</span>
                  <span>最近 {template.lastUsedAt ?? "未使用"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {isTaskPackView ? (
        <section id="prd-generator" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">生成</p>
              <h3>PRD 生成</h3>
            </div>
            <span className="pill">节点 2</span>
          </div>
          <form action={generatePrdDraftAction} className="project-form">
            <label className="field">
              <span>选择模板</span>
              <select name="templateId" defaultValue={snapshot.promptTemplates[0]?.id}>
                {snapshot.promptTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>补充说明</span>
              <textarea
                name="extraNotes"
                placeholder="例如：强调核心流程、异常处理和验收标准。"
                rows={6}
              />
            </label>
            <button type="submit" className="action-button action-button-primary">
              生成 PRD 草案
            </button>
          </form>
        </section>
        ) : null}

        {(isHomeView || isVerificationView) ? (
        <section id="delivery" className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">风险</p>
              <h3>风险与阻塞</h3>
            </div>
            <span className="pill status-risk">{blockedGate ? "需处理" : "正常"}</span>
          </div>
          <ul className="detail-list">
            <li>风险说明: {activeProject.riskNote}</li>
            <li>阻塞节点: {blockedGate?.name ?? "无"}</li>
            <li>当前状态: {deliveryState}</li>
          </ul>
        </section>
        ) : null}

        {isExecutionView ? (
          <SummaryPanel
            eyebrow="执行"
            title="执行焦点"
            badge="当前任务"
            items={executionFocusItems}
          />
        ) : null}

        {isExecutionView ? (
          <RunsPanel runs={snapshot.runs} title="执行队列" eyebrow="执行" badge="开发执行" />
        ) : null}

        {isVerificationView ? (
          <RunsPanel runs={snapshot.runs} title="验证记录" eyebrow="验证" badge="测试验证" />
        ) : null}

        {isDeliveryView ? (
          <SummaryPanel
            eyebrow="交付"
            title="交付概要"
            badge="交付发布"
            items={deliverySummaryItems}
          />
        ) : null}

        {isArchiveView ? (
          <SummaryPanel
            eyebrow="沉淀"
            title="沉淀建议"
            badge="归档复用"
            items={archiveSummaryItems}
          />
        ) : null}

        {(isTaskPackView || isDeliveryView || isArchiveView) ? (
          <LatestPrdPanel latestPrdDocument={latestPrdDocument} />
        ) : null}

        {isHomeView ? (
          <RunsPanel runs={snapshot.runs} title="最近执行" eyebrow="执行" badge="开发执行" />
        ) : null}
      </section>
    </main>
  );
}
