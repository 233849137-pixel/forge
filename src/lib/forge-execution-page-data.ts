import { getRemediationTaskQueue, type ForgeDashboardSnapshot } from "../../packages/core/src";
import {
  getActiveForgeProject,
  getDeliveryReadinessSummaryView,
  getExecutionBlockerSummary,
  getExecutionFailureAttributionSummary,
  getExecutionFocusSummary,
  getExecutionTaskQueueSummary,
  getProjectProfile,
  getRunTimelineSummary,
  getRunnerRegistrySummary,
  getRuntimeModelExecutionSummary
} from "../components/forge-os-shared";

export type ForgeExecutionSummaryItem = {
  label: string;
  value: string;
};

export type ForgeExecutionPageSection = {
  badge: string;
  items: ForgeExecutionSummaryItem[];
};

export type ForgeExecutionRemediationItem = ReturnType<typeof getRemediationTaskQueue>[number] & {
  runtimeExecutionBackendCommandPreview?: string | null;
};

export type ForgeExecutionPageData = {
  currentHandoffControllerLabel?: string;
  currentHandoffControllerRoleLabel?: string;
  currentHandoffOwnerLabel?: string;
  currentHandoffOwnerRoleLabel?: string;
  metrics: {
    totalRuns: number;
    runningRuns: number;
    blockedRuns: number;
  };
  focus: ForgeExecutionPageSection;
  blockers: ForgeExecutionPageSection;
  taskQueue: ForgeExecutionPageSection;
  evidence: ForgeExecutionPageSection;
  remediation: ForgeExecutionPageSection;
  runnerRegistry: ForgeExecutionPageSection;
  runnerProbe: ForgeExecutionPageSection;
  failureAttribution: ForgeExecutionPageSection;
  timeline: ForgeExecutionPageSection;
  runQueue: Pick<ForgeDashboardSnapshot, "runs" | "projects" | "artifacts" | "components">;
  localContext: {
    badge: string;
    items: ForgeExecutionSummaryItem[];
  };
};

export type ForgeExecutionPageDataInput = {
  snapshot: ForgeDashboardSnapshot;
  externalExecutionSummary?: string;
  externalExecutionDetails?: string[];
  executionBackendSummary?: string;
  executionBackendDetails?: string[];
  bridgeExecutionSummary?: string;
  bridgeExecutionDetails?: string[];
  currentHandoffExecutionBackendLabel?: string;
  currentHandoffExecutionBackendCommandPreview?: string;
  currentHandoffControllerLabel?: string;
  currentHandoffControllerRoleLabel?: string;
  currentHandoffOwnerLabel?: string;
  currentHandoffOwnerRoleLabel?: string;
  currentHandoffSourceCommandLabel?: string;
  currentHandoffRelatedRunLabel?: string;
  currentHandoffRuntimeLabel?: string;
  externalExecutionRecommendation?: string;
  remediationQueueItems?: ForgeExecutionRemediationItem[];
};

function getExecutionBackendEvidenceLabel(label?: string | null) {
  return label ? `执行后端：${label}` : "";
}

function getRunEvidenceStatus(run: ForgeDashboardSnapshot["runs"][number]) {
  const evidenceCheck = run.outputChecks.find((check) => check.name === "evidence");
  const normalizedCheckStatus =
    typeof evidenceCheck?.status === "string" ? evidenceCheck.status.trim() : "";

  if (normalizedCheckStatus) {
    return normalizedCheckStatus;
  }

  const outputMode = run.outputMode?.trim() ?? "";

  if (!outputMode) {
    return "";
  }

  if (outputMode.startsWith("contract-")) {
    return "contract";
  }

  if (outputMode.endsWith("-executed")) {
    return "executed";
  }

  if (outputMode.endsWith("-ready")) {
    return "tool-ready";
  }

  return "";
}

function getEvidenceStatusSummary(snapshot: ForgeDashboardSnapshot) {
  const counts = snapshot.runs.reduce(
    (accumulator, run) => {
      const status = getRunEvidenceStatus(run);

      if (status === "contract" || status === "tool-ready" || status === "executed") {
        accumulator[status] += 1;
      }

      return accumulator;
    },
    { contract: 0, "tool-ready": 0, executed: 0 }
  );

  return [
    {
      label: "合同模式",
      value: `${counts.contract} 条运行仍停留在合同模式，需要先补齐本地工具或执行环境。`
    },
    {
      label: "工具就绪",
      value: `${counts["tool-ready"]} 条运行已具备外部工具，可继续触发真实执行。`
    },
    {
      label: "已执行",
      value: `${counts.executed} 条运行已经写回真实执行证据，可直接进入后续门禁或交付判断。`
    }
  ];
}

export function buildForgeExecutionPageData(
  input: ForgeExecutionPageDataInput
): ForgeExecutionPageData {
  const {
    snapshot,
    externalExecutionSummary,
    externalExecutionDetails,
    executionBackendSummary,
    executionBackendDetails,
    bridgeExecutionSummary,
    bridgeExecutionDetails,
    currentHandoffExecutionBackendLabel,
    currentHandoffExecutionBackendCommandPreview,
    currentHandoffControllerLabel,
    currentHandoffControllerRoleLabel,
    currentHandoffOwnerLabel,
    currentHandoffOwnerRoleLabel,
    currentHandoffSourceCommandLabel,
    currentHandoffRelatedRunLabel,
    currentHandoffRuntimeLabel,
    externalExecutionRecommendation,
    remediationQueueItems
  } = input;

  const activeProject = getActiveForgeProject(snapshot);
  const profile = getProjectProfile(snapshot, activeProject?.id);
  const executionFocus = getExecutionFocusSummary(snapshot);
  const blockers = getExecutionBlockerSummary(snapshot);
  const failureAttribution = getExecutionFailureAttributionSummary(snapshot);
  const taskQueue = getExecutionTaskQueueSummary(snapshot);
  const evidenceStatusSummary = getEvidenceStatusSummary(snapshot);
  const runtimeModelExecution = getRuntimeModelExecutionSummary(snapshot, activeProject?.id);
  const deliveryReadiness = getDeliveryReadinessSummaryView(snapshot, activeProject?.id);
  const remediationQueue: ForgeExecutionRemediationItem[] =
    remediationQueueItems ?? getRemediationTaskQueue(snapshot, activeProject?.id).slice(0, 4);
  const runnerRegistry = getRunnerRegistrySummary(snapshot);
  const timeline = getRunTimelineSummary(snapshot, { projectId: activeProject?.id }).slice(0, 5);
  const activeRunner =
    runnerRegistry.find((runner) => runner.currentRunId === executionFocus?.id) ?? runnerRegistry[0];
  const currentHandoffSourceRunValue = currentHandoffRelatedRunLabel
    ? `${currentHandoffRelatedRunLabel}${
        currentHandoffSourceCommandLabel ? ` · 来源命令：${currentHandoffSourceCommandLabel}` : ""
      }${currentHandoffRuntimeLabel ? ` · ${currentHandoffRuntimeLabel}` : ""}`
    : null;

  return {
    currentHandoffControllerLabel,
    currentHandoffControllerRoleLabel,
    currentHandoffOwnerLabel,
    currentHandoffOwnerRoleLabel,
    metrics: {
      totalRuns: snapshot.runs.length,
      runningRuns: snapshot.runs.filter((run) => run.state === "running").length,
      blockedRuns: snapshot.runs.filter((run) => run.state === "blocked").length
    },
    focus: {
      badge: executionFocus?.executor ?? "暂无",
      items: [
        { label: "当前任务", value: executionFocus?.title ?? "暂无活跃执行" },
        { label: "执行器", value: executionFocus?.executor ?? "未分配" },
        {
          label: "状态",
          value:
            executionFocus?.state === "running"
              ? "执行中"
              : executionFocus?.state === "blocked"
                ? "已阻塞"
                : executionFocus?.state === "done"
                  ? "已完成"
                  : "暂无"
        },
        {
          label: "模型执行器",
          value: runtimeModelExecution.activeDetail ?? "当前执行焦点还没有外部模型 provider 证据。"
        }
      ]
    },
    blockers: {
      badge: `${blockers.length} 项`,
      items:
        blockers.length > 0
          ? blockers.map((item, index) => ({
              label: `阻塞 ${index + 1}`,
              value: item
            }))
          : [{ label: "当前状态", value: "没有执行阻塞，可以继续推进。" }]
    },
    taskQueue: {
      badge: `${taskQueue.length} 项`,
      items:
        taskQueue.length > 0
          ? taskQueue.map((item) => ({
              label: `${item.priorityLabel} · ${item.project?.name ?? "未绑定项目"} · ${item.task.title}`,
              value: item.action
            }))
          : [{ label: "当前状态", value: "没有待处理执行任务，可以继续推进后续交付。" }]
    },
    evidence: {
      badge: `${evidenceStatusSummary.length} 类`,
      items: [
        ...evidenceStatusSummary,
        {
          label: "外部模型执行器",
          value:
            runtimeModelExecution.providers.length > 0
              ? `${runtimeModelExecution.providers.join(" / ")} · 当前焦点 ${
                  runtimeModelExecution.activeDetail ?? runtimeModelExecution.details[0]
                }`
              : "当前还没有外部模型 provider 证据，仍以本地 fallback 为主。"
        }
      ]
    },
    remediation: {
      badge: `${remediationQueue.length} 项`,
      items:
        remediationQueue.length > 0
          ? remediationQueue.map((item) => ({
              label: `${item.priority} · ${item.title}`,
              value: [
                item.remediationOwnerLabel ? `负责人：${item.remediationOwnerLabel}` : "",
                item.remediationSummary,
                item.remediationAction,
                item.bridgeHandoffSummary ? `桥接移交：${item.bridgeHandoffSummary}` : "",
                item.bridgeHandoffDetail ? `移交细节：${item.bridgeHandoffDetail}` : "",
                getExecutionBackendEvidenceLabel(item.runtimeExecutionBackendLabel),
                item.runtimeExecutionBackendCommandPreview
                  ? `后端命令预览：${item.runtimeExecutionBackendCommandPreview}`
                  : "",
                item.unifiedRetryRunnerCommand ? `统一回放：${item.unifiedRetryRunnerCommand}` : "",
                item.retryRunnerCommand ? `Runner 回放：${item.retryRunnerCommand}` : "",
                item.unifiedRetryApiPath ? `统一整改入口：${item.unifiedRetryApiPath}` : ""
              ]
                .filter(Boolean)
                .join(" · ")
            }))
          : [{ label: "当前状态", value: "当前没有待回放整改任务。" }]
    },
    runnerRegistry: {
      badge: `${runnerRegistry.length} 个`,
      items:
        runnerRegistry.length > 0
          ? runnerRegistry.slice(0, 4).map((runner) => ({
              label: `${runner.name} · ${runner.statusLabel}`,
              value: `${runner.capabilities.slice(0, 2).join(" / ")} · ${runner.capabilityDetailSummary} · 最近心跳 ${runner.lastHeartbeatLabel}`
            }))
          : [{ label: "当前状态", value: "还没有注册本地 Runner。" }]
    },
    runnerProbe: {
      badge: `${runnerRegistry.length} 个`,
      items:
        runnerRegistry.length > 0
          ? runnerRegistry.slice(0, 4).map((runner) => ({
              label: `${runner.name} · ${runner.probeStatusLabel}`,
              value: `${runner.probeSummary} · 最近探测 ${runner.lastProbeLabel}`
            }))
          : [{ label: "当前状态", value: "还没有 Runner 探测记录。" }]
    },
    failureAttribution: {
      badge: failureAttribution?.categoryLabel ?? "暂无失败",
      items: failureAttribution
        ? [
            { label: "失败分类", value: failureAttribution.categoryLabel },
            { label: "关联运行", value: failureAttribution.runId },
            { label: "失败说明", value: failureAttribution.summary }
          ]
        : [{ label: "当前状态", value: "最近没有新的执行失败，可继续推进。" }]
    },
    timeline: {
      badge: `${timeline.length} 条`,
      items:
        timeline.length > 0
          ? timeline.map((event) => ({
              label: `${event.categoryLabel} · ${event.runId}`,
              value: event.summary
            }))
          : [{ label: "当前状态", value: "还没有执行事件记录。" }]
    },
    runQueue: {
      runs: snapshot.runs,
      projects: snapshot.projects,
      artifacts: snapshot.artifacts,
      components: snapshot.components
    },
    localContext: {
      badge: "local-first",
      items: [
        { label: "当前项目", value: activeProject?.name ?? "未选择项目" },
        { label: "工作区路径", value: profile?.workspacePath ?? "建立项目后自动初始化" },
        { label: "活跃 Runner", value: activeRunner?.name ?? "未分配" },
        { label: "Runner 状态", value: activeRunner?.statusLabel ?? "暂无" },
        { label: "最近探测", value: activeRunner?.lastProbeLabel ?? "未记录" },
        { label: "执行焦点", value: executionFocus?.title ?? "暂无活跃执行" },
        {
          label: "外部执行准备度",
          value:
            externalExecutionSummary ??
            (runtimeModelExecution.providers.length > 0
              ? `已写回 ${runtimeModelExecution.providers.join(" / ")} 的 provider 证据，可继续沿当前外部执行链推进。`
              : "当前未配置外部模型执行契约，默认仍走本地 fallback。")
        },
        {
          label: "Provider 契约",
          value:
            externalExecutionDetails && externalExecutionDetails.length > 0
              ? externalExecutionDetails.join(" / ")
              : "当前未配置外部模型执行契约。"
        },
        {
          label: "执行后端",
          value:
            executionBackendSummary ?? "当前外部执行契约未声明执行后端，默认仍由模型执行器直连。"
        },
        {
          label: "后端契约",
          value:
            executionBackendDetails && executionBackendDetails.length > 0
              ? executionBackendDetails.join(" / ")
              : "当前未声明外部执行后端。"
        },
        {
          label: "桥接证据",
          value: bridgeExecutionSummary ?? "当前还没有外部执行桥写回证据。"
        },
        {
          label: "桥接明细",
          value:
            bridgeExecutionDetails && bridgeExecutionDetails.length > 0
              ? bridgeExecutionDetails.join(" / ")
              : "当前还没有桥接执行明细。"
        },
        {
          label: "桥接移交",
          value: deliveryReadiness.bridgeHandoffSummary ?? "当前 bridge 结果尚未形成正式移交。"
        },
        ...(deliveryReadiness.bridgeHandoffDetail
          ? [{ label: "移交细节", value: deliveryReadiness.bridgeHandoffDetail }]
          : []),
        ...(currentHandoffControllerLabel
          ? [
              {
                label: "总控角色",
                value: `${currentHandoffControllerLabel} · ${
                  currentHandoffControllerRoleLabel ?? "Nano CEO 总控"
                }`
              }
            ]
          : []),
        ...(currentHandoffOwnerLabel
          ? [
              {
                label: "当前接棒负责人",
                value: `${currentHandoffOwnerLabel}${
                  currentHandoffOwnerRoleLabel ? ` · ${currentHandoffOwnerRoleLabel}` : ""
                }`
              }
            ]
          : []),
        ...(currentHandoffExecutionBackendLabel
          ? [{ label: "默认外部执行", value: currentHandoffExecutionBackendLabel }]
          : []),
        ...(currentHandoffExecutionBackendCommandPreview
          ? [{ label: "执行入口预览", value: currentHandoffExecutionBackendCommandPreview }]
          : []),
        ...(currentHandoffSourceRunValue
          ? [{ label: "当前接棒来源运行", value: currentHandoffSourceRunValue }]
          : []),
        {
          label: "外部执行建议",
          value:
            externalExecutionRecommendation ??
            "未配置外部模型执行契约，当前继续使用本地 fallback；如需真实模型执行，先配置 Engineer / Reviewer provider 契约。"
        }
      ]
    }
  };
}
