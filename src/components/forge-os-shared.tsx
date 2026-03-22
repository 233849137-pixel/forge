import React from "react";
import {
  getActiveProject,
  getForgeAgentDisplayLabel,
  getArtifactHandoffQueue,
  getArtifactReviewChecklist,
  getArtifactReviewRecords,
  getDeliveryStateLabel,
  getDeliveryReadinessSummary,
  getEvidenceTimeline,
  getExecutionBlockers,
  getExecutionFocus,
  getExecutionTaskQueue,
  getFormalArtifactCoverageSummary as getFormalArtifactCoverageSummaryFromCore,
  getFormalArtifactGapSummary as getFormalArtifactGapSummaryFromCore,
  getFormalArtifactProvenanceSummary as getFormalArtifactProvenanceSummaryFromCore,
  getFormalArtifactResponsibilitySummary as getFormalArtifactResponsibilitySummaryFromCore,
  getLatestRunFailure,
  getAgentTaskLoad,
  getCurrentHandoffSummary,
  getMissingRequiredArtifacts,
  getProjectTaskLoad,
  getProjectArtifacts as getProjectArtifactsFromCore,
  getProjectStageStateMachine,
  getProjectTaskQueue,
  getReleaseGateSummary,
  getStageAdmissionSummary,
  getTaskDispatchQueue,
  getRunTimeline,
  getProjectWorkflowStage,
  type WorkflowStage,
  workflowStages
} from "../../packages/core/src";
import type {
  DeliveryGateItem,
  ForgeArtifact,
  ForgeComponent,
  ForgeDashboardSnapshot,
  ForgePrdDocument,
  ForgeProject,
  ForgeProjectProfile,
  ForgePromptTemplate,
  ForgeRunner,
  ForgeRun
} from "../../packages/core/src/types";

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

function getRunEvidenceStatus(run: ForgeRun) {
  const evidenceCheck = run.outputChecks.find((check) => check.name === "evidence");

  if (typeof evidenceCheck?.status === "string" && evidenceCheck.status.trim()) {
    return evidenceCheck.status.trim();
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

export function getRunModelExecutionDetail(run: ForgeRun) {
  const modelExecutionCheck = run.outputChecks.find((check) => check.name === "model-execution");

  if (typeof modelExecutionCheck?.summary === "string" && modelExecutionCheck.summary.trim()) {
    return modelExecutionCheck.summary.trim();
  }

  return "";
}

export function getRunModelExecutionProvider(run: ForgeRun) {
  const detail = getRunModelExecutionDetail(run);

  if (!detail) {
    return "";
  }

  return detail.split(" · ")[0]?.trim() ?? "";
}

const runnerStatusLabel = {
  idle: "空闲",
  busy: "执行中",
  blocked: "阻塞中",
  offline: "离线"
} as const;

const runnerProbeStatusLabel = {
  unknown: "待探测",
  healthy: "健康",
  degraded: "降级",
  offline: "离线"
} as const;

const runFailureCategoryLabel = {
  "spec-gap": "规格缺口",
  tooling: "工具链问题",
  environment: "环境问题",
  permission: "权限问题",
  "test-failure": "测试失败",
  unknown: "未知问题"
} as const;

const gateStatusLabel = {
  pass: "通过",
  pending: "待确认",
  fail: "失败"
} as const;

const reviewDecisionLabel = {
  pass: "已通过",
  "changes-requested": "需修改",
  pending: "待确认"
} as const;

export const artifactTypeLabel = {
  prd: "PRD",
  "architecture-note": "架构说明",
  "ui-spec": "原型与交互规范",
  "task-pack": "TaskPack",
  "assembly-plan": "组件装配清单",
  patch: "补丁",
  "review-report": "规则审查记录",
  "demo-build": "Demo 构建",
  "test-report": "测试报告",
  "playwright-run": "Playwright 回归记录",
  "review-decision": "放行评审结论",
  "release-brief": "交付说明",
  "release-audit": "归档审计记录",
  "knowledge-card": "知识卡"
} as const;

const artifactStatusLabel = {
  draft: "草稿",
  "in-review": "评审中",
  ready: "已就绪"
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

export function getActiveForgeProject(snapshot: ForgeDashboardSnapshot) {
  return getActiveProject(snapshot.projects, snapshot.activeProjectId) ?? null;
}

export function getProjectProfile(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return null;
  }

  return snapshot.projectProfiles.find((profile) => profile.projectId === projectId) ?? null;
}

export function getProjectArtifacts(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getProjectArtifactsFromCore(snapshot, projectId);
}

export function getProjectAssetLinks(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return [];
  }

  return snapshot.projectAssetLinks.filter((link) => link.projectId === projectId);
}

export function getLinkedPromptTemplates(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const links = getProjectAssetLinks(snapshot, projectId).filter((link) => link.targetType === "prompt");

  return links
    .map((link) => ({
      link,
      prompt: snapshot.promptTemplates.find((prompt) => prompt.id === link.targetId)
    }))
    .filter(
      (
        item
      ): item is {
        link: (typeof links)[number];
        prompt: ForgePromptTemplate;
      } => Boolean(item.prompt)
    );
}

export function getLinkedAssets(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const links = getProjectAssetLinks(snapshot, projectId).filter((link) => link.targetType === "asset");

  return links
    .map((link) => ({
      link,
      asset: snapshot.assets.find((asset) => asset.id === link.targetId)
    }))
    .filter(
      (
        item
      ): item is {
        link: (typeof links)[number];
        asset: ForgeDashboardSnapshot["assets"][number];
      } => Boolean(item.asset)
    );
}

export function getLinkedComponents(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const links = getProjectAssetLinks(snapshot, projectId).filter((link) => link.targetType === "component");

  return links
    .map((link) => ({
      link,
      component: snapshot.components.find((component) => component.id === link.targetId)
    }))
    .filter(
      (
        item
      ): item is {
        link: (typeof links)[number];
        component: ForgeComponent;
      } => Boolean(item.component)
    );
}

export function getLinkedTemplateSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const templateLink = getProjectAssetLinks(snapshot, projectId).find(
    (link) => link.targetType === "template"
  );

  if (!templateLink) {
    return null;
  }

  const template = snapshot.projectTemplates.find((item) => item.id === templateLink.targetId);

  if (!template) {
    return null;
  }

  return {
    link: templateLink,
    template
  };
}

export function getLinkedGateSummaries(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const profile = getProjectProfile(snapshot, projectId);

  if (!profile) {
    return [];
  }

  return profile.defaultGateIds
    .map((gateId) => snapshot.deliveryGate.find((gate) => gate.id === gateId))
    .filter((gate): gate is DeliveryGateItem => Boolean(gate));
}

export function getLatestPrdDocument(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null
): ForgePrdDocument | null {
  const documents = projectId
    ? snapshot.prdDocuments.filter((document) => document.projectId === projectId)
    : snapshot.prdDocuments;

  return documents[0] ?? null;
}

export function countBlockedRuns(snapshot: ForgeDashboardSnapshot) {
  return snapshot.runs.filter((run) => run.state === "blocked").length;
}

export function countFailedGates(snapshot: ForgeDashboardSnapshot) {
  return snapshot.deliveryGate.filter((gate) => gate.status === "fail").length;
}

export function getArtifactQueue(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getArtifactHandoffQueue(snapshot, projectId).map((item) => ({
    ...item,
    statusLabel: artifactStatusLabel[item.artifact.status]
  }));
}

export function getMissingArtifactsForProject(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getMissingRequiredArtifacts(snapshot, projectId);
}

export function getArtifactReviewRecordSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getArtifactReviewRecords(snapshot, projectId).map((item) => ({
    ...item,
    decisionLabel: reviewDecisionLabel[item.review.decision]
  }));
}

export function getArtifactReviewChecklistSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getArtifactReviewChecklist(snapshot, projectId).map((item) => ({
    ...item,
    decisionLabel: reviewDecisionLabel[item.decision]
  }));
}

export function getEvidenceTimelineSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getEvidenceTimeline(snapshot, projectId).map((item) => ({
    ...item,
    ownerLabel:
      item.ownerLabel ??
      (item.owner ? getForgeAgentDisplayLabel(item.owner) : item.artifact.ownerAgentId)
  }));
}

export function getFormalArtifactProvenanceSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getFormalArtifactProvenanceSummaryFromCore(snapshot, projectId);
}

export function getFormalArtifactCoverageSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getFormalArtifactCoverageSummaryFromCore(snapshot, projectId);
}

export function getFormalArtifactGapSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getFormalArtifactGapSummaryFromCore(snapshot, projectId);
}

export function getFormalArtifactResponsibilitySummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getFormalArtifactResponsibilitySummaryFromCore(snapshot, projectId);
}

export function getFormalArtifactResponsibilityView(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const summary = getFormalArtifactResponsibilitySummaryFromCore(snapshot, projectId);
  const primaryPendingApproval = summary.pendingApprovals[0] ?? null;

  return {
    ...summary,
    primaryPendingApproval,
    pendingApprovalSummary: primaryPendingApproval
      ? `${primaryPendingApproval.detail}${
          primaryPendingApproval.nextAction
            ? ` · 当前接棒：${primaryPendingApproval.nextAction}`
            : ""
        }`
      : "当前没有待人工确认事项。",
    pendingApprovalAction:
      primaryPendingApproval?.nextAction ??
      primaryPendingApproval?.ownerLabel ??
      "当前无需人工确认。",
    approvalHandoffSummary: summary.approvalHandoff.summary,
    approvalHandoffDetail: summary.approvalHandoff.detail,
    approvalHandoffAction: summary.approvalHandoff.nextAction
  };
}

export function getResolvedFormalArtifactResponsibilityView(input: {
  formalArtifactResponsibility: ReturnType<typeof getFormalArtifactResponsibilityView>;
  approvalHandoffSummary?: string | null;
  approvalHandoffDetail?: string | null;
  approvalHandoffNextAction?: string | null;
}) {
  const resolvedApprovalHandoffSummary =
    input.approvalHandoffSummary ?? input.formalArtifactResponsibility.approvalHandoffSummary;
  const resolvedApprovalHandoffDetail =
    input.approvalHandoffDetail ?? input.formalArtifactResponsibility.approvalHandoffDetail ?? null;
  const resolvedApprovalHandoffAction =
    input.approvalHandoffNextAction ??
    (!input.approvalHandoffSummary && !input.approvalHandoffDetail
      ? input.formalArtifactResponsibility.approvalHandoffAction
      : undefined) ??
    null;

  return {
    coverage: input.formalArtifactResponsibility.coverage,
    gap: input.formalArtifactResponsibility.gap,
    pendingApprovalSummary: input.formalArtifactResponsibility.pendingApprovalSummary,
    pendingApprovalAction: input.formalArtifactResponsibility.pendingApprovalAction,
    approvalHandoffSummary: resolvedApprovalHandoffSummary,
    approvalHandoffDetail: resolvedApprovalHandoffDetail,
    approvalHandoffAction: resolvedApprovalHandoffAction
  };
}

export function getFormalArtifactResponsibilitySummaryItems(input: {
  formalArtifactView: ReturnType<typeof getResolvedFormalArtifactResponsibilityView>;
  gapActionFallback?: string;
  includeCoverageDetail?: boolean;
}) {
  const items: Array<{ label: string; value: string }> = [
    {
      label: "正式工件沉淀",
      value: input.formalArtifactView.coverage.summary
    }
  ];

  if (input.includeCoverageDetail) {
    items.push({
      label: "沉淀清单",
      value: input.formalArtifactView.coverage.detail
    });
  }

  items.push(
    {
      label: "正式工件缺口",
      value: input.formalArtifactView.gap.summary
    },
    {
      label: "补齐责任",
      value:
        input.formalArtifactView.gap.nextAction ??
        input.formalArtifactView.gap.ownerLabel ??
        input.gapActionFallback ??
        "当前无需补齐正式工件。"
    }
  );

  const hasPendingApproval =
    input.formalArtifactView.pendingApprovalSummary !== "当前没有待人工确认事项。";
  const hasApprovalHandoff =
    Boolean(input.formalArtifactView.approvalHandoffSummary) &&
    input.formalArtifactView.approvalHandoffSummary !== "当前无需等待审批后接棒。";

  if (hasPendingApproval) {
    items.push({
      label: "待人工确认",
      value: input.formalArtifactView.pendingApprovalSummary
    });

    if (input.formalArtifactView.pendingApprovalAction) {
      items.push({
        label: "确认责任",
        value: input.formalArtifactView.pendingApprovalAction
      });
    }
  }

  if (hasApprovalHandoff) {
    items.push({
      label: "确认后接棒",
      value: input.formalArtifactView.approvalHandoffSummary
    });

    if (input.formalArtifactView.approvalHandoffDetail) {
      items.push({
        label: "接棒细节",
        value: input.formalArtifactView.approvalHandoffDetail
      });
    }

    if (input.formalArtifactView.approvalHandoffAction) {
      items.push({
        label: "接棒动作",
        value: input.formalArtifactView.approvalHandoffAction
      });
    }
  }

  return items;
}

export function getReleaseClosureSummaryItems(input: {
  releaseClosureView: ReturnType<typeof getResolvedReleaseClosureView>;
}) {
  if (!input.releaseClosureView.visible) {
    return [];
  }

  const items: Array<{ label: string; value: string }> = [
    {
      label: "最终放行摘要",
      value: input.releaseClosureView.summary
    }
  ];

  if (input.releaseClosureView.responsibilityLine) {
    items.push({
      label: "最终放行责任链",
      value: input.releaseClosureView.responsibilityLine
    });
  }

  items.push({
    label: "放行细节",
    value: input.releaseClosureView.detail
  });

  if (input.releaseClosureView.sourceLabel) {
    items.push({
      label: "最终放行来源",
      value: input.releaseClosureView.sourceLabel
    });
  }

  if (input.releaseClosureView.nextAction) {
    items.push({
      label: "放行动作",
      value: input.releaseClosureView.nextAction
    });
  }

  return items;
}

export function getDeliveryReadinessSummaryView(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getDeliveryReadinessSummary(snapshot, projectId);
}

export function getReleaseGateSummaryView(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getReleaseGateSummary(snapshot, projectId);
}

export function getProjectStageAdmission(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getStageAdmissionSummary(snapshot, projectId);
}

export function getProjectStageStateMachineSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getProjectStageStateMachine(snapshot, projectId);
}

export function getProjectTaskQueueSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getProjectTaskQueue(snapshot, projectId);
}

export function getExecutionFocusSummary(snapshot: ForgeDashboardSnapshot) {
  return getExecutionFocus(snapshot);
}

export function getExecutionBlockerSummary(snapshot: ForgeDashboardSnapshot) {
  return getExecutionBlockers(snapshot);
}

export function getExecutionTaskQueueSummary(snapshot: ForgeDashboardSnapshot) {
  return getExecutionTaskQueue(snapshot);
}

export function getExecutionFailureAttributionSummary(snapshot: ForgeDashboardSnapshot) {
  const failure = getLatestRunFailure(snapshot);

  if (!failure) {
    return null;
  }

  return {
    ...failure,
    categoryLabel: failure.failureCategory
      ? runFailureCategoryLabel[failure.failureCategory]
      : "未知问题"
  };
}

export function getRuntimeModelExecutionSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null
) {
  const relevantRuns = snapshot.runs.filter((run) =>
    projectId ? run.projectId === projectId : true
  );
  const providers = Array.from(
    new Set(relevantRuns.map((run) => getRunModelExecutionProvider(run)).filter(Boolean))
  );
  const details = Array.from(
    new Set(relevantRuns.map((run) => getRunModelExecutionDetail(run)).filter(Boolean))
  );
  const activeRun =
    relevantRuns.find((run) => run.state === "running" && getRunModelExecutionDetail(run)) ??
    relevantRuns.find((run) => getRunModelExecutionDetail(run)) ??
    null;

  return {
    providers,
    details,
    activeProvider: activeRun ? getRunModelExecutionProvider(activeRun) || null : null,
    activeDetail: activeRun ? getRunModelExecutionDetail(activeRun) || null : null
  };
}

export function getReleaseClosureResponsibilityLine(input: {
  releaseClosureSummary?: string | null;
  releaseClosureNextAction?: string | null;
  releaseClosureSourceCommandLabel?: string | null;
  releaseClosureRelatedRunLabel?: string | null;
  releaseClosureRuntimeLabel?: string | null;
  approvalHandoffSummary?: string | null;
  approvalHandoffNextAction?: string | null;
  archiveProvenanceSummary?: string | null;
}) {
  if (!input.releaseClosureSummary) {
    return null;
  }

  const sourceValue =
    input.releaseClosureRelatedRunLabel || input.releaseClosureSourceCommandLabel
      ? `${input.releaseClosureRelatedRunLabel ?? "未记录来源运行"}${
          input.releaseClosureSourceCommandLabel
            ? ` · 来源命令：${input.releaseClosureSourceCommandLabel}`
            : ""
        }${input.releaseClosureRuntimeLabel ? ` · ${input.releaseClosureRuntimeLabel}` : ""}`
      : null;
  const meaningfulApprovalHandoffSummary =
    input.approvalHandoffSummary && input.approvalHandoffSummary !== "当前无需等待审批后接棒。"
      ? input.approvalHandoffSummary
      : null;

  const parts = [
    input.releaseClosureSummary,
    input.releaseClosureNextAction ? `当前动作：${input.releaseClosureNextAction}` : null,
    !input.releaseClosureNextAction && input.approvalHandoffNextAction
      ? `确认后动作：${input.approvalHandoffNextAction}`
      : null,
    meaningfulApprovalHandoffSummary ? `确认后接棒：${meaningfulApprovalHandoffSummary}` : null,
    input.archiveProvenanceSummary ? `归档接棒：${input.archiveProvenanceSummary}` : null,
    sourceValue ? `来源：${sourceValue}` : null
  ].filter(Boolean);

  return parts.join(" · ");
}

export function getResolvedReleaseClosureView(input: {
  releaseClosureResponsibilitySummary?: string | null;
  releaseClosureResponsibilityDetail?: string | null;
  releaseClosureResponsibilityNextAction?: string | null;
  releaseClosureResponsibilitySourceLabel?: string | null;
  releaseClosureSummary?: string | null;
  releaseClosureDetail?: string | null;
  releaseClosureNextAction?: string | null;
  releaseClosureSourceCommandLabel?: string | null;
  releaseClosureRelatedRunLabel?: string | null;
  releaseClosureRuntimeLabel?: string | null;
  approvalHandoffSummary?: string | null;
  approvalHandoffNextAction?: string | null;
  archiveProvenanceSummary?: string | null;
  emptySummary?: string;
  emptyDetail?: string;
}) {
  const summary =
    input.releaseClosureResponsibilitySummary ?? input.releaseClosureSummary ?? null;
  const responsibilityLine =
    input.releaseClosureResponsibilitySummary ??
    getReleaseClosureResponsibilityLine({
      releaseClosureSummary: input.releaseClosureSummary,
      releaseClosureNextAction: input.releaseClosureNextAction,
      releaseClosureSourceCommandLabel: input.releaseClosureSourceCommandLabel,
      releaseClosureRelatedRunLabel: input.releaseClosureRelatedRunLabel,
      releaseClosureRuntimeLabel: input.releaseClosureRuntimeLabel,
      approvalHandoffSummary: input.approvalHandoffSummary,
      approvalHandoffNextAction: input.approvalHandoffNextAction,
      archiveProvenanceSummary: input.archiveProvenanceSummary
    });
  const detail =
    input.releaseClosureResponsibilityDetail ??
    input.releaseClosureDetail ??
    input.emptyDetail ??
    "当前最终放行摘要还没有补充细节。";
  const nextAction =
    input.releaseClosureResponsibilityNextAction ?? input.releaseClosureNextAction ?? null;
  const sourceLabel =
    input.releaseClosureResponsibilitySourceLabel ??
    ((input.releaseClosureRelatedRunLabel || input.releaseClosureSourceCommandLabel)
      ? `${input.releaseClosureRelatedRunLabel ?? "未记录来源运行"}${
          input.releaseClosureSourceCommandLabel
            ? ` · 来源命令：${input.releaseClosureSourceCommandLabel}`
            : ""
        }${input.releaseClosureRuntimeLabel ? ` · ${input.releaseClosureRuntimeLabel}` : ""}`
      : null);
  const visible = Boolean(
    input.releaseClosureResponsibilitySummary ||
      input.releaseClosureResponsibilityDetail ||
      input.releaseClosureResponsibilityNextAction ||
      input.releaseClosureResponsibilitySourceLabel ||
      input.releaseClosureSummary ||
      input.releaseClosureDetail ||
      input.releaseClosureNextAction ||
      input.releaseClosureSourceCommandLabel ||
      input.releaseClosureRelatedRunLabel ||
      input.releaseClosureRuntimeLabel
  );

  return {
    summary: summary ?? input.emptySummary ?? "当前最终放行摘要仍在整理中。",
    responsibilityLine,
    detail,
    nextAction,
    sourceLabel,
    visible
  };
}

export function getRunTimelineSummary(
  snapshot: ForgeDashboardSnapshot,
  options: { projectId?: string | null; runId?: string | null } = {}
) {
  return getRunTimeline(snapshot, options).map((event) => ({
    ...event,
    categoryLabel: event.failureCategory
      ? runFailureCategoryLabel[event.failureCategory]
      : "状态事件"
  }));
}

export function getTaskDispatchQueueSummary(snapshot: ForgeDashboardSnapshot) {
  return getTaskDispatchQueue(snapshot);
}

export function getProjectTaskLoadSummary(snapshot: ForgeDashboardSnapshot) {
  return getProjectTaskLoad(snapshot);
}

export function getAgentTaskLoadSummary(snapshot: ForgeDashboardSnapshot) {
  return getAgentTaskLoad(snapshot);
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "未记录";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / (60 * 1000)));

  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${Math.floor(diffHours / 24)} 天前`;
}

export function getRunnerRegistrySummary(snapshot: ForgeDashboardSnapshot): Array<
  ForgeRunner & {
    statusLabel: string;
    probeStatusLabel: string;
    lastHeartbeatLabel: string;
    lastProbeLabel: string;
    capabilityDetailSummary: string;
  }
> {
  return snapshot.runners.map((runner) => ({
    ...runner,
    statusLabel: runnerStatusLabel[runner.status],
    probeStatusLabel: runnerProbeStatusLabel[runner.probeStatus],
    lastHeartbeatLabel: formatRelativeTime(runner.lastHeartbeat),
    lastProbeLabel: formatRelativeTime(runner.lastProbeAt),
    capabilityDetailSummary:
      runner.detectedCapabilityDetails && runner.detectedCapabilityDetails.length > 0
        ? runner.detectedCapabilityDetails
            .map((detail) =>
              `${detail.capability}${detail.version ? `(${detail.version})` : detail.path ? `(${detail.path})` : ""}`
            )
            .join(" / ")
        : "当前还没有结构化探测详情"
  }));
}

export function getCurrentWorkflowStage(
  activeProject: ForgeProject | null,
  snapshot: ForgeDashboardSnapshot
): WorkflowStage {
  return getProjectWorkflowStage(snapshot, activeProject?.id);
}

export function getNextAction(
  snapshot: ForgeDashboardSnapshot,
  _currentStage: WorkflowStage,
  activeProject: ForgeProject | null
) {
  return getCurrentHandoffSummary(snapshot, activeProject?.id).nextAction;
}

function getStageSummary(stage: WorkflowStage, activeProject: ForgeProject | null, snapshot: ForgeDashboardSnapshot) {
  const deliveryState = getDeliveryStateLabel(snapshot.deliveryGate);

  if (!activeProject) {
    return "当前还没有激活项目。";
  }

  const summaries: Record<WorkflowStage, string> = {
    项目接入: "建立项目、绑定模板、生成本地工作区与团队编制。",
    "方案与任务包": "收口 PRD、TaskPack、约束和验收标准。",
    开发执行: `围绕 ${activeProject.name} 推进实现，当前完成度 ${activeProject.progress}%。`,
    测试验证:
      deliveryState === "已阻塞"
        ? "门禁存在失败项，必须先完成回归。"
        : "门禁已接近转绿，可以准备交付。",
    交付发布: "产出预览、交付说明和验收资料。",
    归档复用: "把经验沉淀成可复用资产。"
  };

  return summaries[stage];
}

function getWorkflowNodeState(
  stage: WorkflowStage,
  currentStage: WorkflowStage,
  snapshot: ForgeDashboardSnapshot
) {
  const stageIndex = workflowStages.indexOf(stage);
  const currentStageIndex = workflowStages.indexOf(currentStage);

  if (stageIndex < currentStageIndex) {
    return "done";
  }

  if (stageIndex > currentStageIndex) {
    return "pending";
  }

  if (stage === "测试验证" && countFailedGates(snapshot) > 0) {
    return "risk";
  }

  return "current";
}

export function SectionPanel({
  eyebrow,
  title,
  badge,
  className,
  children
}: {
  eyebrow: string;
  title: string;
  badge?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = React.useId();
  const panelClassName = ["panel", className].filter(Boolean).join(" ");

  return (
    <section className={panelClassName} aria-labelledby={headingId}>
      <div className="panel-head">
        <div className="panel-head-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h3 id={headingId}>{title}</h3>
        </div>
        {badge ? (
          <div className="panel-head-meta">
            <span className="pill panel-head-badge">{badge}</span>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SummaryList({
  items
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <ul className="summary-list">
      {items.map((item) => (
        <li className="summary-item" key={item.label}>
          <div className="summary-item-line">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SummaryGroup({
  eyebrow,
  title,
  badge,
  items,
  tone = "neutral"
}: {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
}) {
  return (
    <article className={`subpanel summary-group summary-group-${tone}`} data-summary-tone={tone}>
      <div className="subpanel-head summary-group-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h4>{title}</h4>
        </div>
        {badge ? <span className="pill">{badge}</span> : null}
      </div>
      <SummaryList items={items} />
    </article>
  );
}

export function SummaryCluster({
  name,
  layout = "grid",
  children,
  className
}: {
  name: string;
  layout?: "grid" | "stack";
  children: React.ReactNode;
  className?: string;
}) {
  const clusterClassName = [
    "summary-cluster",
    layout === "grid" ? "summary-cluster-grid" : "summary-cluster-stack",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={clusterClassName} data-summary-cluster={name} data-cluster-layout={layout}>
      {children}
    </div>
  );
}

type OverviewSignalGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function OverviewSignalCluster({
  name,
  className,
  primaryGroup,
  signalGroup
}: {
  name: string;
  className?: string;
  primaryGroup: OverviewSignalGroup;
  signalGroup: OverviewSignalGroup;
}) {
  return (
    <SummaryCluster
      name={name}
      layout="grid"
      className={["overview-signal-cluster", className].filter(Boolean).join(" ")}
    >
      <SummaryGroup
        eyebrow={primaryGroup.eyebrow}
        title={primaryGroup.title}
        badge={primaryGroup.badge}
        items={primaryGroup.items}
        tone={primaryGroup.tone}
      />
      <SummaryGroup
        eyebrow={signalGroup.eyebrow}
        title={signalGroup.title}
        badge={signalGroup.badge}
        items={signalGroup.items}
        tone={signalGroup.tone}
      />
    </SummaryCluster>
  );
}

type GroupedSummaryClusterGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function GroupedSummaryCluster({
  name,
  layout = "stack",
  className,
  groups
}: {
  name: string;
  layout?: "grid" | "stack";
  className?: string;
  groups: GroupedSummaryClusterGroup[];
}) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <SummaryCluster
      name={name}
      layout={layout}
      className={["grouped-summary-cluster", className].filter(Boolean).join(" ")}
    >
      {visibleGroups.map((group) => (
        <SummaryGroup
          key={group.title}
          eyebrow={group.eyebrow}
          title={group.title}
          badge={group.badge}
          items={group.items}
          tone={group.tone}
        />
      ))}
    </SummaryCluster>
  );
}

type ReleaseDecisionGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function ReleaseDecisionCluster({
  name,
  className,
  gateGroup,
  runtimeGroup,
  releaseClosureGroup
}: {
  name: string;
  className?: string;
  gateGroup?: ReleaseDecisionGroup | null;
  runtimeGroup?: ReleaseDecisionGroup | null;
  releaseClosureGroup?: ReleaseDecisionGroup | null;
}) {
  const signalGroups = [gateGroup, runtimeGroup].filter((group): group is ReleaseDecisionGroup => {
    if (!group) {
      return false;
    }

    return group.items.length > 0;
  });

  const hasReleaseClosureGroup = Boolean(releaseClosureGroup && releaseClosureGroup.items.length > 0);

  if (signalGroups.length === 0 && !hasReleaseClosureGroup) {
    return null;
  }

  return (
    <SummaryCluster
      name={name}
      layout="stack"
      className={["release-decision-cluster", className].filter(Boolean).join(" ")}
    >
      {signalGroups.length > 0 ? (
        <GroupedSummaryCluster
          name={`${name}-signals`}
          layout="grid"
          className="release-decision-primary"
          groups={signalGroups}
        />
      ) : null}
      {hasReleaseClosureGroup && releaseClosureGroup ? (
        <SummaryGroup
          eyebrow={releaseClosureGroup.eyebrow}
          title={releaseClosureGroup.title}
          badge={releaseClosureGroup.badge}
          items={releaseClosureGroup.items}
          tone={releaseClosureGroup.tone}
        />
      ) : null}
    </SummaryCluster>
  );
}

type ResponsibilitySummaryGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function ResponsibilitySummaryCluster({
  name,
  layout = "grid",
  className,
  primaryGroup,
  formalArtifactGroup,
  releaseClosureGroup,
  archiveGroup,
  provenanceGroup
}: {
  name: string;
  layout?: "grid" | "stack";
  className?: string;
  primaryGroup?: ResponsibilitySummaryGroup | null;
  formalArtifactGroup?: ResponsibilitySummaryGroup | null;
  releaseClosureGroup?: ResponsibilitySummaryGroup | null;
  archiveGroup?: ResponsibilitySummaryGroup | null;
  provenanceGroup?: ResponsibilitySummaryGroup | null;
}) {
  const groups = [
    primaryGroup,
    formalArtifactGroup,
    releaseClosureGroup,
    archiveGroup,
    provenanceGroup
  ].filter((group): group is ResponsibilitySummaryGroup => {
    if (!group) {
      return false;
    }

    return group.items.length > 0;
  });

  if (groups.length === 0) {
    return null;
  }

  return (
    <SummaryCluster
      name={name}
      layout={layout}
      className={["responsibility-summary-cluster", className].filter(Boolean).join(" ")}
    >
      {groups.map((group) => (
        <SummaryGroup
          key={group.title}
          eyebrow={group.eyebrow}
          title={group.title}
          badge={group.badge}
          items={group.items}
          tone={group.tone}
        />
      ))}
    </SummaryCluster>
  );
}

type GovernanceSummaryGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function GovernanceResponsibilityCluster({
  name,
  className,
  approvalGroup,
  escalationGroup,
  riskGroup,
  pendingApprovalGroup,
  incidentGroup
}: {
  name: string;
  className?: string;
  approvalGroup?: GovernanceSummaryGroup | null;
  escalationGroup?: GovernanceSummaryGroup | null;
  riskGroup?: GovernanceSummaryGroup | null;
  pendingApprovalGroup?: GovernanceSummaryGroup | null;
  incidentGroup?: GovernanceSummaryGroup | null;
}) {
  const groups = [
    approvalGroup,
    escalationGroup,
    riskGroup,
    pendingApprovalGroup,
    incidentGroup
  ].filter((group): group is GovernanceSummaryGroup => {
    if (!group) {
      return false;
    }

    return group.items.length > 0;
  });

  if (groups.length === 0) {
    return null;
  }

  return (
    <SummaryCluster
      name={name}
      layout="stack"
      className={["governance-responsibility-cluster", className].filter(Boolean).join(" ")}
    >
      {groups.map((group) => (
        <SummaryGroup
          key={group.title}
          eyebrow={group.eyebrow}
          title={group.title}
          badge={group.badge}
          items={group.items}
          tone={group.tone}
        />
      ))}
    </SummaryCluster>
  );
}

type EvidenceAuditGroup = {
  eyebrow: string;
  title: string;
  badge?: string;
  items: Array<{ label: string; value: string }>;
  tone?: "neutral" | "signal" | "closure" | "provenance";
};

export function EvidenceAuditCluster({
  name,
  className,
  groups
}: {
  name: string;
  className?: string;
  groups: EvidenceAuditGroup[];
}) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <SummaryCluster
      name={name}
      layout="stack"
      className={["evidence-audit-cluster", className].filter(Boolean).join(" ")}
    >
      {visibleGroups.map((group) => (
        <SummaryGroup
          key={group.title}
          eyebrow={group.eyebrow}
          title={group.title}
          badge={group.badge}
          items={group.items}
          tone={group.tone}
        />
      ))}
    </SummaryCluster>
  );
}

export function WorkbenchPanelCluster({
  name,
  wide = false,
  children,
  className
}: {
  name: string;
  wide?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const clusterClassName = [
    "workbench-panel-cluster",
    wide ? "summary-card-grid summary-card-grid-wide" : "summary-card-grid",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={clusterClassName} data-workbench-cluster={name}>
      {children}
    </div>
  );
}

function StatusPill({
  tone,
  label
}: {
  tone: keyof typeof statusTone;
  label: string;
}) {
  return <span className={`pill ${statusTone[tone]}`}>{label}</span>;
}

export function WorkflowRail({ snapshot }: { snapshot: ForgeDashboardSnapshot }) {
  const activeProject = getActiveForgeProject(snapshot);
  const currentStage = getCurrentWorkflowStage(activeProject, snapshot);

  return (
    <div className="workflow-rail">
      {workflowStages.map((stage, index) => {
        const state = getWorkflowNodeState(stage, currentStage, snapshot);

        return (
          <article className="workflow-stage" key={stage}>
            <div className="workflow-stage-line" />
            <div className="workflow-stage-marker">
              <span className="workflow-stage-number">{String(index + 1).padStart(2, "0")}</span>
              <span className={`pill ${workflowNodeTone[state]}`}>
                {workflowNodeStateLabel[state]}
              </span>
            </div>
            <div className="workflow-stage-copy">
              <h4>{stage}</h4>
              <p>{getStageSummary(stage, activeProject, snapshot)}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function RunCards({
  runs,
  projects,
  artifacts,
  components,
  titleKey = "id"
}: {
  runs: ForgeRun[];
  projects?: ForgeProject[];
  artifacts?: ForgeArtifact[];
  components?: ForgeComponent[];
  titleKey?: "id" | "title";
}) {
  if (runs.length === 0) {
    return (
      <div className="empty-state-card">
        <p>当前还没有执行记录。</p>
      </div>
    );
  }

  return (
    <div className="run-list">
      {runs.map((run) => (
        <article className="run-card" key={run[titleKey]}>
          {(() => {
            const taskPackLabel = run.taskPackId
              ? artifacts?.find((artifact) => artifact.id === run.taskPackId)?.title
              : null;
            const linkedComponentLabels = (run.linkedComponentIds ?? [])
              .map((componentId) => components?.find((component) => component.id === componentId)?.title)
              .filter((label): label is string => Boolean(label));

            return (
          <div>
            <h4>{run.title}</h4>
            <p>
              {run.executor}
              {run.projectId
                ? ` · ${projects?.find((project) => project.id === run.projectId)?.name ?? run.projectId}`
                : ""}
            </p>
            {taskPackLabel ? <p>TaskPack：{taskPackLabel}</p> : null}
            {linkedComponentLabels.length > 0 ? (
              <p>装配组件：{linkedComponentLabels.join(" / ")}</p>
            ) : null}
            {run.outputMode || run.outputChecks.length > 0 ? (
              <p>
                {run.outputMode ? `Runtime: ${run.outputMode}` : "Runtime: 未标记"}
                {getRunEvidenceStatus(run) ? ` · Evidence: ${getRunEvidenceStatus(run)}` : ""}
                {run.outputChecks.length > 0
                  ? ` · checks: ${run.outputChecks
                      .map((check) =>
                        `${check.name}=${check.status}${check.summary ? `(${check.summary})` : ""}`
                      )
                      .join(", ")}`
                  : ""}
              </p>
            ) : null}
          </div>
            );
          })()}
          <div className="run-meta">
            <span className={`pill ${statusTone[run.state]}`}>{runStateLabel[run.state]}</span>
            <span>{run.cost}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LatestPrdPanel({
  document
}: {
  document: ForgePrdDocument | null;
}) {
  if (!document) {
    return (
      <div className="empty-state-card">
        <p>当前项目还没有 PRD 草案。</p>
      </div>
    );
  }

  return (
    <article className="prd-document-card">
      <div className="prd-document-head">
        <div>
          <h4>{document.title}</h4>
          <p>{document.createdAt}</p>
        </div>
        <span className="pill pill-soft">{document.status === "draft" ? "草稿" : "已就绪"}</span>
      </div>
      <pre className="prd-document-preview">{document.content}</pre>
    </article>
  );
}

export function ArtifactCards({
  artifacts,
  snapshot
}: {
  artifacts: ForgeArtifact[];
  snapshot: ForgeDashboardSnapshot;
}) {
  if (artifacts.length === 0) {
    return (
      <div className="empty-state-card">
        <p>当前项目还没有工件记录。</p>
      </div>
    );
  }

  return (
    <div className="artifact-list-card">
      {artifacts.map((artifact) => {
        const owner = snapshot.agents.find((agent) => agent.id === artifact.ownerAgentId);

        return (
          <article className="artifact-card-row artifact-item" key={artifact.id}>
            <div>
              <strong>{artifact.title}</strong>
              <p className="context-line">
                {artifactTypeLabel[artifact.type]} · {owner ? getForgeAgentDisplayLabel(owner) : artifact.ownerAgentId}
              </p>
            </div>
            <div className="artifact-card-meta">
              <span>{artifact.updatedAt}</span>
              <span className="pill pill-soft">
                {artifactStatusLabel[artifact.status]}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AssetCards({
  prompts,
  assets
}: {
  prompts: ForgePromptTemplate[];
  assets: ForgeDashboardSnapshot["assets"];
}) {
  return (
    <div className="asset-capability-grid">
      {prompts.map((prompt) => (
        <article className="prompt-template-card" key={prompt.id}>
          <div className="prompt-template-head">
            <div>
              <h4>{prompt.title}</h4>
              <p>{prompt.scenario}</p>
            </div>
            <span className="pill pill-soft">{prompt.version}</span>
          </div>
          <p className="prompt-template-summary">{prompt.summary}</p>
          <div className="prompt-template-meta">
            <span>变量：{prompt.variables.join(" / ")}</span>
            <span>已使用：{prompt.useCount} 次</span>
          </div>
        </article>
      ))}
      {assets.map((asset) => (
        <article className="asset-card" key={asset.id}>
          <div className="asset-top">
            <h4>{asset.title}</h4>
            <span className="pill pill-soft">{asset.type}</span>
          </div>
          <p>{asset.summary}</p>
        </article>
      ))}
    </div>
  );
}

export function GateList({ gates }: { gates: DeliveryGateItem[] }) {
  if (gates.length === 0) {
    return (
      <div className="empty-state-card">
        <p>当前没有门禁记录。</p>
      </div>
    );
  }

  return (
    <div className="gate-list">
      {gates.map((gate) => (
        <div className="gate-item" key={gate.id}>
          <strong>{gate.name}</strong>
          <StatusPill tone={gate.status} label={gateStatusLabel[gate.status]} />
        </div>
      ))}
    </div>
  );
}

export function ProjectCards({
  projects,
  activeProjectId
}: {
  projects: ForgeDashboardSnapshot["projects"];
  activeProjectId: string | null;
}) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
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
            <span>负责人：{project.owner}</span>
            <span>进度：{project.progress}%</span>
            <span>最近执行：{project.lastRun}</span>
          </div>
          {activeProjectId === project.id ? (
            <button className="action-button" type="button" disabled>
              当前项目
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ProjectContext({
  activeProject,
  profile,
  currentStage,
  nextAction,
  executionPathHint,
  formalArtifactHint,
  handoffBackendHint,
  handoffCommandPreview
}: {
  activeProject: ForgeProject | null;
  profile: ForgeProjectProfile | null;
  currentStage: WorkflowStage;
  nextAction: string;
  executionPathHint?: string | null;
  formalArtifactHint?: string | null;
  handoffBackendHint?: string | null;
  handoffCommandPreview?: string | null;
}) {
  return (
    <div className="summary-card-grid">
      <article className="metric-tile">
        <p className="stage-label">当前项目</p>
        <strong>{activeProject?.name ?? "未选择项目"}</strong>
        <span className="context-line">{activeProject?.sector ?? "先建立项目"}</span>
      </article>
      <article className="metric-tile">
        <p className="stage-label">当前阶段</p>
        <strong>{currentStage}</strong>
        <span className="context-line">{nextAction}</span>
        {executionPathHint ? <span className="context-line">{executionPathHint}</span> : null}
        {formalArtifactHint ? <span className="context-line">{formalArtifactHint}</span> : null}
        {handoffBackendHint ? <span className="context-line">{handoffBackendHint}</span> : null}
        {handoffCommandPreview ? <span className="context-line">{handoffCommandPreview}</span> : null}
      </article>
      <article className="metric-tile">
        <p className="stage-label">本地工作区</p>
        <strong>{profile?.templateTitle ?? "未绑定模板"}</strong>
        <span className="context-line">{profile?.workspacePath ?? "项目建立后自动初始化"}</span>
      </article>
    </div>
  );
}
