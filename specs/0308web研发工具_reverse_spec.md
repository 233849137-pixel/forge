# 0308web研发工具 前端页面 DTO 反向规格

## 范围

- 统计对象: `http://127.0.0.1:3322/` 对应的 Next.js 页面
- 入口路由: `app/page.tsx:8-52`, `app/[view]/page.tsx:22-216`
- 路由别名解析: `src/lib/forge-views.ts:11-67`
- 页面数据入口: `src/server/forge-page-data.ts:5-14`

本文基于当前代码实现反向整理前端已经稳定下来的页面数据需求，用于下一阶段后端 DTO 设计和接口收口。

## 技术与架构观察

### 当前页面装配方式

1. 页面入口统一调用 `getForgePageContext()`，拿到:
   - `snapshot`
   - `controlPlane`
   - `blocks`

   证据: `src/server/forge-page-data.ts:5-14`

2. 但当前正式路由只实际解构了 `snapshot` 和 `controlPlane`，没有消费 `blocks`。

   证据:
   - `app/page.tsx:9`
   - `app/[view]/page.tsx:34`

3. 当前页面依赖仍然是“服务端拼装 + 组件直接吃 snapshot/controlPlane 派生字段”，还没有完全切到正式 DTO 层。

### 当前已存在的 block 基础

`src/server/forge-block-data.ts:11-108` 已经有一层 block selector，但目前只覆盖:

- `projectOverview`
- `executionStatus`
- `readiness`
- `artifactsSummary`

这层还没有进入页面正式消费链路。

## 当前正式地址

根据 `src/lib/forge-views.ts:50-67`，当前页面与地址对应关系如下:

| 地址 | 主视图 | 组件 |
|---|---|---|
| `/` | `home` | `ForgeHomePage` |
| `/projects` | `projects` | `ForgeProjectsPage` |
| `/team` | `team` | `AgentTeamPage` |
| `/artifacts` | `artifacts` | `ForgeArtifactsPage` |
| `/execution` | `execution` | `ForgeExecutionPage` |
| `/assets` | `assets` | `ForgeAssetsPage` |
| `/governance` | `governance` | `ForgeGovernancePage` |

旧别名:

- `/intake` -> `projects`
- `/task-pack`, `/delivery` -> `artifacts`
- `/archive` -> `assets`
- `/verification` -> `governance`

## 页面级观察

### 1. 首页 `/`

组件声明了大量 control-plane props，但实际函数只解构了:

- `snapshot`
- `showNavigation`

证据:

- props 定义: `src/components/forge-home-page.tsx:20-50`
- 实际函数签名: `src/components/forge-home-page.tsx:189-192`

当前直接读取的 snapshot 顶层字段:

- `snapshot.activeProjectId`
- `snapshot.agents`
- `snapshot.projects`
- `snapshot.tasks`

证据: 对 `src/components/forge-home-page.tsx` 的直接字段扫描。

额外观察:

- 路由仍传入 `executeCommandAction` 和多组 control-plane 摘要，但组件内部没有继续使用。
  证据:
  - 传参: `app/page.tsx:12-50`, `app/[view]/page.tsx:39-86`
  - 组件内 `executeCommandAction` 仅出现在类型声明: `src/components/forge-home-page.tsx:22`

当前 UI 区块:

- 项目总览
- 待你处理

证据:

- `src/components/forge-home-page.tsx:576-579`
- `src/components/forge-home-page.tsx:732-735`

结论:

- 首页已经是“snapshot 驱动页面”
- 当前不需要 control-plane 专用首页 DTO
- 首页最适合收敛为轻量 `HomePageDTO`

建议 DTO:

```ts
type HomePageDTO = {
  activeProjectId: string | null;
  projectRows: Array<{
    id: string;
    partnerName: string;
    projectName: string;
    stageLabel: string;
    progressLabel: string;
    planLabel: string;
    deliveryDateLabel: string;
    ownerAgentName: string;
    pendingActionCount: number;
  }>;
  pendingItems: Array<{
    id: string;
    projectId: string;
    projectName: string;
    kind: "待补料" | "待接管" | "待确认" | "待放行";
    title: string;
    ownerLabel: string;
    nextStep: string;
  }>;
};
```

### 2. 项目页 `/projects`

组件声明了 create/setActive/workflow action 和大量 control-plane props，但实际函数只解构了:

- `snapshot`
- `showNavigation`

证据:

- props 定义: `src/components/forge-projects-page.tsx:22-55`
- 实际函数签名: `src/components/forge-projects-page.tsx:302-305`

当前直接读取的 snapshot 顶层字段:

- `snapshot.projects`
- `snapshot.projectProfiles`
- `snapshot.projectTemplates`
- `snapshot.prdDocuments`
- `snapshot.projectAssetLinks`
- `snapshot.artifacts`
- `snapshot.artifactReviews`
- `snapshot.tasks`
- `snapshot.components`
- `snapshot.runs`
- `snapshot.runEvents`
- `snapshot.deliveryGate`

证据: 对 `src/components/forge-projects-page.tsx` 的直接字段扫描。

额外观察:

- `createProjectAction`
- `setActiveProjectAction`
- `updateProjectWorkflowStateAction`

这三个 action 目前也只存在于 props 类型和函数解构中，没有实际调用。

证据:

- 类型声明: `src/components/forge-projects-page.tsx:24-26`
- 组件解构: `src/components/forge-projects-page.tsx:302-305`
- 代码搜索未发现其他引用

当前 UI 区块:

- 项目选择
- 工作节点
- AI 对话
- 节点结果

证据:

- `src/components/forge-projects-page.tsx:907-921`
- `src/components/forge-projects-page.tsx:988-1214`

结论:

- 项目页已经是“项目工作台 DTO”候选，而不是控制面摘要页
- 现阶段不应该再往它上面追加 runtime/control-plane 字段

建议 DTO:

```ts
type ProjectsPageDTO = {
  selectedProjectId: string | null;
  projects: Array<{
    id: string;
    name: string;
    owner: string;
    sector: string;
    healthLabel: string;
    currentStage: string | null;
    nodeStatuses: Array<{
      node: "需求确认" | "项目原型" | "UI设计" | "后端研发" | "DEMO测试" | "内测调优" | "交付发布";
      status: "已完成" | "进行中" | "已阻塞" | "待开始";
      summary: string;
      agentName: string;
      agentRole: string;
    }>;
  }>;
  workbench: {
    activeNode: string;
    conversationTabs: Array<{ id: string; label: string; messages: Array<{ id: string; speaker: string; role: "human" | "ai"; text: string; time: string }> }>;
    documentTabs: Array<{ id: string; label: string; document: { title: string; body: string; updatedAt?: string | null } | null }>;
  };
};
```

### 3. 团队页 `/team`

组件只声明:

- `snapshot`
- `updateAgentProfileAction`
- `showNavigation`

证据: `src/components/agent-team-page.tsx:21-25`

实际函数解构:

- `snapshot`
- `updateAgentProfileAction`
- `showNavigation`

证据: `src/components/agent-team-page.tsx:553-557`

当前直接读取的 snapshot 顶层字段:

- `snapshot.agents`
- `snapshot.promptTemplates`
- `snapshot.runners`
- `snapshot.skills`
- `snapshot.teamTemplates`

证据: 对 `src/components/agent-team-page.tsx` 的直接字段扫描。

额外观察:

- `updateAgentProfileAction` 当前只被解构，没有实际调用。
  证据:
  - 类型声明: `src/components/agent-team-page.tsx:23`
  - 组件解构: `src/components/agent-team-page.tsx:555`
  - 代码搜索未发现其他引用

当前 UI 区块:

- 团队配置
- 组织架构
- 员工管理
- 技能配置
- 自动化
- 权限管理

证据:

- `src/components/agent-team-page.tsx:2282`
- `src/components/agent-team-page.tsx:2470`
- `src/components/agent-team-page.tsx:2730`
- `src/components/agent-team-page.tsx:3335`
- `src/components/agent-team-page.tsx:4001`
- `src/components/agent-team-page.tsx:4017`

建议 DTO:

```ts
type TeamPageDTO = {
  teamTemplate: {
    id: string;
    name: string;
    leadAgentId: string | null;
  } | null;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
    statusLabel: string;
    promptTemplateId?: string | null;
    skillIds: string[];
    runnerId?: string | null;
    governancePermissions: string[];
  }>;
  promptTemplates: Array<{ id: string; title: string; summary: string }>;
  skills: Array<{ id: string; name: string; category: string; summary: string }>;
  runners: Array<{ id: string; name: string; statusLabel: string; probeStatusLabel: string }>;
};
```

### 4. 工件页 `/artifacts`

组件只接收:

- `snapshot`
- `showNavigation`

证据: `src/components/forge-artifacts-page.tsx:28-34`

但它大量通过 `forge-os-shared` selector 间接消费 snapshot:

- `getProjectArtifacts`
- `getArtifactQueue`
- `getMissingArtifactsForProject`
- `getEvidenceTimelineSummary`
- `getArtifactReviewRecordSummary`
- `getArtifactReviewChecklistSummary`
- `getReleaseGateSummaryView`
- `getFormalArtifactProvenanceSummary`
- `getFormalArtifactResponsibilityView`
- `getLatestPrdDocument`

证据: `src/components/forge-artifacts-page.tsx:35-63`

当前 UI 区块:

- 工件总览
- 责任与来源
- 证据与评审
- 工件资产

证据:

- `src/components/forge-artifacts-page.tsx:140`
- `src/components/forge-artifacts-page.tsx:161`
- `src/components/forge-artifacts-page.tsx:207`
- `src/components/forge-artifacts-page.tsx:234`

结论:

- 工件页不适合继续暴露原始 snapshot
- 最适合收敛为“工件中心聚合 DTO”

建议 DTO:

```ts
type ArtifactsPageDTO = {
  activeProject: { id: string; name: string } | null;
  artifacts: Array<{ id: string; title: string; type: string; status: string; updatedAt?: string | null }>;
  artifactQueue: Array<{ artifactId: string; title: string; statusLabel: string; slaLabel: string; action: string }>;
  missingArtifacts: Array<{ label: string; detail: string }>;
  evidenceTimeline: Array<{ label: string; value: string }>;
  reviewRecords: Array<{ label: string; value: string }>;
  reviewChecklist: Array<{ label: string; value: string }>;
  latestPrd: { id: string; title: string; updatedAt?: string | null } | null;
  releaseGateSummary: {
    overallLabel: string;
    summary: string;
    archiveProvenance?: { summary: string; detail?: string | null } | null;
  };
  formalArtifact: {
    provenanceItems: Array<{ label: string; value: string }>;
    responsibilityItems: Array<{ label: string; value: string }>;
    releaseClosureItems: Array<{ label: string; value: string }>;
  };
};
```

### 5. 执行页 `/execution`

组件实际解构并使用:

- `snapshot`
- `externalExecutionSummary`
- `externalExecutionDetails`
- `executionBackendSummary`
- `executionBackendDetails`
- `bridgeExecutionSummary`
- `bridgeExecutionDetails`
- `currentHandoffExecutionBackendLabel`
- `currentHandoffExecutionBackendCommandPreview`
- `currentHandoffSourceCommandLabel`
- `currentHandoffRelatedRunLabel`
- `currentHandoffRuntimeLabel`
- `externalExecutionRecommendation`
- `remediationQueueItems`
- `showNavigation`

证据: `src/components/forge-execution-page.tsx:89-121`

页面同时通过 selector 和 snapshot 构建数据:

- `getExecutionFocusSummary`
- `getExecutionBlockerSummary`
- `getExecutionTaskQueueSummary`
- `getRuntimeModelExecutionSummary`
- `getDeliveryReadinessSummaryView`
- `getRunnerRegistrySummary`
- `getRunTimelineSummary`
- `RunCards`

证据: `src/components/forge-execution-page.tsx:122-416`

当前直接读取的 snapshot 顶层字段:

- `snapshot.runs`
- `snapshot.projects`
- `snapshot.artifacts`
- `snapshot.components`

证据: 对 `src/components/forge-execution-page.tsx` 的直接字段扫描。

当前 UI 区块:

- 当前执行焦点
- 阻塞原因
- 待处理任务中枢
- 证据状态
- 整改回放
- Runner 注册表
- Runner 探测状态
- 失败归因
- 最近事件流
- 执行队列
- 本地运行上下文

证据: `src/components/forge-execution-page.tsx:157-323`

建议 DTO:

```ts
type ExecutionPageDTO = {
  hero: {
    executionFocus: { id?: string; title: string; executor: string; state: string } | null;
    blockers: string[];
    failureAttribution: { categoryLabel: string; runId: string; summary: string } | null;
  };
  taskQueue: Array<{ taskId: string; label: string; action: string }>;
  evidence: {
    evidenceStatusSummary: Array<{ label: string; value: string }>;
    runtimeModelExecution: {
      providers: string[];
      details: string[];
      activeProvider: string | null;
      activeDetail: string | null;
    };
  };
  remediationQueue: Array<{
    title: string;
    priority: string;
    remediationSummary: string;
    remediationAction: string;
    runtimeExecutionBackendLabel?: string | null;
    runtimeExecutionBackendCommandPreview?: string | null;
    retryRunnerCommand?: string | null;
    unifiedRetryApiPath?: string | null;
  }>;
  runners: Array<{
    id: string;
    name: string;
    statusLabel: string;
    probeStatusLabel: string;
    capabilityDetailSummary: string;
    lastHeartbeatLabel: string;
    lastProbeLabel: string;
  }>;
  timeline: Array<{ categoryLabel: string; runId: string; summary: string }>;
  runCards: {
    runs: Array<unknown>;
    projects: Array<unknown>;
    artifacts: Array<unknown>;
    components: Array<unknown>;
  };
  runtimeContext: {
    currentProjectName: string | null;
    workspacePath: string | null;
    externalExecutionSummary?: string | null;
    externalExecutionDetails?: string[];
    executionBackendSummary?: string | null;
    executionBackendDetails?: string[];
    bridgeExecutionSummary?: string | null;
    bridgeExecutionDetails?: string[];
    currentHandoffExecutionBackendLabel?: string | null;
    currentHandoffExecutionBackendCommandPreview?: string | null;
    currentHandoffSourceRunValue?: string | null;
    externalExecutionRecommendation?: string | null;
  };
};
```

### 6. 资产页 `/assets`

组件只接收:

- `snapshot`
- `showNavigation`

证据: `src/components/forge-assets-page.tsx:202-208`

页面直接从 snapshot 组出四个资产分区:

- 模板资产
- 组件资产
- 历史交付物
- 知识沉淀

证据:

- 区块装配: `src/components/forge-assets-page.tsx:194-199`
- 页面消费: `src/components/forge-assets-page.tsx:216-218`

当前直接读取的 snapshot 顶层字段:

- `snapshot.projectTemplates`
- `snapshot.promptTemplates`
- `snapshot.assets`
- `snapshot.components`
- `snapshot.artifacts`
- `snapshot.artifactReviews`
- `snapshot.skills`
- `snapshot.sops`
- `snapshot.projects`
- `snapshot.projectProfiles`
- `snapshot.agents`

证据: 对 `src/components/forge-assets-page.tsx` 的直接字段扫描。

建议 DTO:

```ts
type AssetsPageDTO = {
  sections: {
    templateAssets: AssetLibraryItemDTO[];
    componentAssets: AssetLibraryItemDTO[];
    deliveryArtifacts: AssetLibraryItemDTO[];
    knowledgeAssets: AssetLibraryItemDTO[];
  };
};

type AssetLibraryItemDTO = {
  id: string;
  title: string;
  typeLabel: string;
  summary: string;
  detailSummary: string;
  sceneLabel: string;
  sourceLabel: string;
  callableLabel: string;
  updatedAt: string;
  tone: "info" | "good" | "warn" | "neutral";
  detailMeta: Array<{ label: string; value: string }>;
  detailNotes?: string[];
};
```

### 7. 治理页 `/governance`

组件实际解构并使用:

- `snapshot`
- `externalExecutionSummary`
- `externalExecutionDetails`
- `executionBackendSummary`
- `executionBackendDetails`
- `bridgeExecutionSummary`
- `bridgeExecutionDetails`
- `archiveProvenanceSummary`
- `archiveProvenanceDetail`
- `approvalHandoffSummary`
- `approvalHandoffDetail`
- `approvalHandoffNextAction`
- `releaseClosureResponsibilitySummary`
- `releaseClosureResponsibilityDetail`
- `releaseClosureResponsibilityNextAction`
- `releaseClosureResponsibilitySourceLabel`
- `releaseClosureSummary`
- `releaseClosureDetail`
- `releaseClosureNextAction`
- `releaseClosureSourceCommandLabel`
- `releaseClosureRelatedRunLabel`
- `releaseClosureRuntimeLabel`
- `currentHandoffExecutionBackendLabel`
- `currentHandoffExecutionBackendCommandPreview`
- `currentHandoffSourceCommandLabel`
- `currentHandoffRelatedRunLabel`
- `currentHandoffRuntimeLabel`
- `externalExecutionRecommendation`
- `remediationQueueItems`
- `showNavigation`

证据: `src/components/forge-governance-page.tsx:102-164`

当前直接读取的 snapshot 顶层字段:

- `snapshot.commands`
- `snapshot.commandHooks`
- `snapshot.commandExecutions`
- `snapshot.policyDecisions`
- `snapshot.projects`
- `snapshot.tasks`
- `snapshot.workflowTransitions`
- `snapshot.deliveryGate`

证据: 对 `src/components/forge-governance-page.tsx` 的直接字段扫描。

当前 UI 区块:

- 门禁状态
- 放行判断
- 责任与升级
- 命令审计
- 治理基线

证据:

- `src/components/forge-governance-page.tsx:566`
- `src/components/forge-governance-page.tsx:570`
- `src/components/forge-governance-page.tsx:600`
- `src/components/forge-governance-page.tsx:865`
- `src/components/forge-governance-page.tsx:892`

建议 DTO:

```ts
type GovernancePageDTO = {
  gateDecision: {
    overallLabel: string;
    summary: string;
    missingItems: Array<{ label: string; statusLabel: string; detail: string }>;
    bridgeHandoffSummary?: string | null;
    bridgeHandoffDetail?: string | null;
    archiveProvenanceSummary?: string | null;
    archiveProvenanceDetail?: string | null;
    nextAction?: string | null;
  };
  releaseDecision: {
    formalArtifactItems: Array<{ label: string; value: string }>;
    releaseClosureItems: Array<{ label: string; value: string }>;
    pendingApprovals: Array<{ label: string; value: string }>;
    escalationItems: Array<{ label: string; value: string }>;
  };
  runtimeSignals: {
    runtimeNotes: string[];
    runtimeCapabilityDetails: string[];
    externalExecutionSummary?: string | null;
    externalExecutionDetails?: string[];
    executionBackendSummary?: string | null;
    executionBackendDetails?: string[];
    bridgeExecutionSummary?: string | null;
    bridgeExecutionDetails?: string[];
    currentHandoffExecutionBackendLabel?: string | null;
    currentHandoffExecutionBackendCommandPreview?: string | null;
    currentHandoffSourceRunValue?: string | null;
    externalExecutionRecommendation?: string | null;
  };
  audit: {
    recentTransitions: Array<{ label: string; value: string }>;
    recentCommandExecutions: Array<{ label: string; value: string }>;
    recentPolicyDecisions: Array<{ label: string; value: string }>;
    blockedCommandExecutions: number;
    remediationRetryApiPaths: string[];
    remediationQueue: Array<{
      title: string;
      priority: string;
      remediationSummary: string;
      remediationAction: string;
      retryApiPath?: string | null;
      unifiedRetryApiPath?: string | null;
    }>;
  };
};
```

## 已确认的冗余传参与边界问题

### 冗余传参

以下 props 目前已经不是前端真实依赖，属于历史遗留:

1. 首页的 `executeCommandAction` 与整组 control-plane 摘要
   - 传参: `app/page.tsx:12-50`, `app/[view]/page.tsx:39-86`
   - 组件实际未使用: `src/components/forge-home-page.tsx:189-192`

2. 项目页的三类 action 与整组 control-plane 摘要
   - 传参: `app/[view]/page.tsx:91-129`
   - 组件实际未使用: `src/components/forge-projects-page.tsx:302-305`

3. 团队页的 `updateAgentProfileAction`
   - 传参: `app/[view]/page.tsx:134-137`
   - 组件内部未使用: `src/components/agent-team-page.tsx:553-557`

### 未接入的 block 层

`getForgePageContext()` 已经返回 `blocks`，但正式页面还没接:

- `src/server/forge-page-data.ts:10-14`
- `app/page.tsx:9`
- `app/[view]/page.tsx:34`

这意味着后端已经有了“区块层起点”，但前端正式页面仍然主要吃 raw snapshot / raw control-plane props。

## 观察到的需求 EARS

1. 当用户访问 `/` 时，系统应展示项目总览和待处理事项，并允许按项目搜索和切换当前查看项目。
2. 当用户访问 `/projects` 时，系统应展示项目工作台、节点状态、对话标签和节点结果，不依赖治理页或执行页的 control-plane 摘要。
3. 当用户访问 `/team` 时，系统应展示组织架构、员工、技能、自动化和权限配置。
4. 当用户访问 `/artifacts` 时，系统应展示工件总览、责任链、证据与评审、最新 PRD 和工件资产。
5. 当用户访问 `/execution` 时，系统应展示运行焦点、阻塞、任务队列、整改队列、Runner 状态、事件流和本地运行上下文。
6. 当用户访问 `/assets` 时，系统应按模板资产、组件资产、历史交付物和知识沉淀四类展示资产。
7. 当用户访问 `/governance` 时，系统应展示门禁结论、放行判断、责任与升级、命令审计和治理基线。

## 推荐的后端对接落地顺序

### 第一阶段

先把正式页面 DTO 分成 4 类:

1. `HomePageDTO`
2. `ProjectsPageDTO`
3. `ArtifactsPageDTO`
4. `AssetsPageDTO`

这四页已经基本不需要 control-plane 细粒度直传。

### 第二阶段

把 runtime / governance 相关内容切成可复用 block:

1. `ExecutionRuntimeBlockDTO`
2. `ExecutionQueueBlockDTO`
3. `RunnerRegistryBlockDTO`
4. `GateDecisionBlockDTO`
5. `ReleaseDecisionBlockDTO`
6. `CommandAuditBlockDTO`

然后分别组装成:

- `ExecutionPageDTO`
- `GovernancePageDTO`

### 第三阶段

清理冗余入口:

1. 从 `app/page.tsx` 和 `app/[view]/page.tsx` 删除首页、项目页、团队页的无效传参
2. 让 `getForgePageContext()` 不再默认返回整个 `controlPlane`
3. 改成按页面返回显式 DTO 或显式 blocks

## 不确定项

1. `ForgeArtifactsPage`、`ForgeExecutionPage`、`ForgeGovernancePage` 通过 `forge-os-shared.tsx` 间接消费了不少 core selector，若要进一步细化字段，需要继续下钻 selector 依赖面。
2. `home / projects / team` 当前很多交互是纯前端本地状态驱动，后续如果要接回真实写入接口，还需要再对“哪些操作要落库”做一次梳理。
3. 团队页、项目页当前有明显的“已重做 UI，但写入行为尚未接线”的状态，这部分适合单独做一轮 action/API 对接，而不是混在 DTO 设计里一起推进。

## 建议

1. 先按本文 7 个页面的建议 DTO 建后端 read model，不要继续把整个 `snapshot` 直接暴露给页面。
2. 先处理首页、项目页、团队页的冗余传参，因为这三页最容易先稳定。
3. 执行页和治理页不要直接拆成几十个散接口，先按 block 聚合，再按页面组装。
4. 工件页和资产页最适合做“领域聚合 DTO”，不要让前端自己继续从原始对象现场拼装。
