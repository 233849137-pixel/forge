import React from "react";
import {
  getBlockingTaskChain,
  getRecentCommandExecutions,
  getRemediationTaskQueue,
  forgeCommandContracts,
  type ForgeDashboardSnapshot
} from "../../packages/core/src";
import type { ForgeGovernancePageData } from "../server/forge-page-dtos";
import ForgeChrome from "./forge-chrome";
import {
  EvidenceAuditCluster,
  GateList,
  GroupedSummaryCluster,
  GovernanceResponsibilityCluster,
  ReleaseDecisionCluster,
  SectionPanel,
  SummaryGroup,
  SummaryList,
  countBlockedRuns,
  countFailedGates,
  getActiveForgeProject,
  getCurrentWorkflowStage,
  getFormalArtifactResponsibilitySummaryItems,
  getFormalArtifactResponsibilityView,
  getNextAction,
  getReleaseClosureSummaryItems,
  getResolvedFormalArtifactResponsibilityView,
  getResolvedReleaseClosureView,
  getReleaseGateSummaryView
} from "./forge-os-shared";

function getModelExecutionEvidenceLabel(input: {
  runtimeModelProviderLabel?: string | null;
  runtimeModelExecutionDetail?: string | null;
}) {
  const detail = input.runtimeModelProviderLabel ?? input.runtimeModelExecutionDetail;

  return detail ? `模型执行器：${detail}` : "";
}

function getExecutionBackendEvidenceLabel(input: {
  runtimeExecutionBackendLabel?: string | null;
}) {
  return input.runtimeExecutionBackendLabel ? `执行后端：${input.runtimeExecutionBackendLabel}` : "";
}

function getPrimaryReleaseEscalationAction(
  actions: ReturnType<typeof getReleaseGateSummaryView>["escalationActions"],
  bridgeHandoffStatus: ReturnType<typeof getReleaseGateSummaryView>["bridgeHandoffStatus"]
) {
  if (bridgeHandoffStatus === "review-handoff") {
    return (
      actions.find(
        (item) =>
          item.ownerRoleLabel === "架构师" ||
          item.label.includes("规则审查记录")
      ) ??
      actions.find((item) => item.blocking && item.nextAction) ??
      actions.find((item) => item.nextAction) ??
      null
    );
  }

  if (bridgeHandoffStatus === "qa-handoff") {
    return (
      actions.find(
        (item) =>
          item.ownerRoleLabel === "测试" ||
          item.label.includes("测试报告") ||
          item.label.includes("Playwright 回归记录")
      ) ??
      actions.find((item) => item.blocking && item.nextAction) ??
      actions.find((item) => item.nextAction) ??
      null
    );
  }

  if (bridgeHandoffStatus === "release-candidate") {
    return (
      actions.find(
        (item) =>
          item.ownerRoleLabel === "发布" ||
          item.label.includes("交付说明") ||
          item.label.includes("放行评审结论")
      ) ??
      actions.find((item) => item.blocking && item.nextAction) ??
      actions.find((item) => item.nextAction) ??
      null
    );
  }

  return actions.find((item) => item.blocking && item.nextAction) ?? actions.find((item) => item.nextAction) ?? null;
}

type ForgeGovernanceRemediationItem = ReturnType<typeof getRemediationTaskQueue>[number] & {
  runtimeExecutionBackendCommandPreview?: string | null;
};

export default function ForgeGovernancePage({
  data,
  snapshot: legacySnapshot,
  externalExecutionSummary: legacyExternalExecutionSummary,
  externalExecutionDetails: legacyExternalExecutionDetails,
  executionBackendSummary: legacyExecutionBackendSummary,
  executionBackendDetails: legacyExecutionBackendDetails,
  bridgeExecutionSummary: legacyBridgeExecutionSummary,
  bridgeExecutionDetails: legacyBridgeExecutionDetails,
  archiveProvenanceSummary: legacyArchiveProvenanceSummary,
  archiveProvenanceDetail: legacyArchiveProvenanceDetail,
  approvalHandoffSummary: legacyApprovalHandoffSummary,
  approvalHandoffDetail: legacyApprovalHandoffDetail,
  approvalHandoffNextAction: legacyApprovalHandoffNextAction,
  releaseClosureResponsibilitySummary: legacyReleaseClosureResponsibilitySummary,
  releaseClosureResponsibilityDetail: legacyReleaseClosureResponsibilityDetail,
  releaseClosureResponsibilityNextAction: legacyReleaseClosureResponsibilityNextAction,
  releaseClosureResponsibilitySourceLabel: legacyReleaseClosureResponsibilitySourceLabel,
  releaseClosureSummary: legacyReleaseClosureSummary,
  releaseClosureDetail: legacyReleaseClosureDetail,
  releaseClosureNextAction: legacyReleaseClosureNextAction,
  releaseClosureSourceCommandLabel: legacyReleaseClosureSourceCommandLabel,
  releaseClosureRelatedRunLabel: legacyReleaseClosureRelatedRunLabel,
  releaseClosureRuntimeLabel: legacyReleaseClosureRuntimeLabel,
  currentHandoffExecutionBackendLabel: legacyCurrentHandoffExecutionBackendLabel,
  currentHandoffExecutionBackendCommandPreview: legacyCurrentHandoffExecutionBackendCommandPreview,
  currentHandoffControllerLabel: legacyCurrentHandoffControllerLabel,
  currentHandoffControllerRoleLabel: legacyCurrentHandoffControllerRoleLabel,
  currentHandoffOwnerLabel: legacyCurrentHandoffOwnerLabel,
  currentHandoffOwnerRoleLabel: legacyCurrentHandoffOwnerRoleLabel,
  currentHandoffSourceCommandLabel: legacyCurrentHandoffSourceCommandLabel,
  currentHandoffRelatedRunLabel: legacyCurrentHandoffRelatedRunLabel,
  currentHandoffRuntimeLabel: legacyCurrentHandoffRuntimeLabel,
  externalExecutionRecommendation: legacyExternalExecutionRecommendation,
  remediationQueueItems: legacyRemediationQueueItems,
  showNavigation = false
}: {
  data?: ForgeGovernancePageData;
  snapshot?: ForgeDashboardSnapshot;
  externalExecutionSummary?: string;
  externalExecutionDetails?: string[];
  executionBackendSummary?: string;
  executionBackendDetails?: string[];
  bridgeExecutionSummary?: string;
  bridgeExecutionDetails?: string[];
  archiveProvenanceSummary?: string;
  archiveProvenanceDetail?: string;
  approvalHandoffSummary?: string;
  approvalHandoffDetail?: string;
  approvalHandoffNextAction?: string;
  releaseClosureResponsibilitySummary?: string;
  releaseClosureResponsibilityDetail?: string;
  releaseClosureResponsibilityNextAction?: string;
  releaseClosureResponsibilitySourceLabel?: string;
  releaseClosureSummary?: string;
  releaseClosureDetail?: string;
  releaseClosureNextAction?: string;
  releaseClosureSourceCommandLabel?: string;
  releaseClosureRelatedRunLabel?: string;
  releaseClosureRuntimeLabel?: string;
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
  remediationQueueItems?: ForgeGovernanceRemediationItem[];
  showNavigation?: boolean;
}) {
  const snapshot = data?.snapshot ?? legacySnapshot;
  const externalExecutionSummary =
    data?.externalExecutionSummary ?? legacyExternalExecutionSummary;
  const externalExecutionDetails =
    data?.externalExecutionDetails ?? legacyExternalExecutionDetails;
  const executionBackendSummary =
    data?.executionBackendSummary ?? legacyExecutionBackendSummary;
  const executionBackendDetails =
    data?.executionBackendDetails ?? legacyExecutionBackendDetails;
  const bridgeExecutionSummary =
    data?.bridgeExecutionSummary ?? legacyBridgeExecutionSummary;
  const bridgeExecutionDetails =
    data?.bridgeExecutionDetails ?? legacyBridgeExecutionDetails;
  const archiveProvenanceSummary =
    data?.archiveProvenanceSummary ?? legacyArchiveProvenanceSummary;
  const archiveProvenanceDetail =
    data?.archiveProvenanceDetail ?? legacyArchiveProvenanceDetail;
  const approvalHandoffSummary =
    data?.approvalHandoffSummary ?? legacyApprovalHandoffSummary;
  const approvalHandoffDetail =
    data?.approvalHandoffDetail ?? legacyApprovalHandoffDetail;
  const approvalHandoffNextAction =
    data?.approvalHandoffNextAction ?? legacyApprovalHandoffNextAction;
  const releaseClosureResponsibilitySummary =
    data?.releaseClosureResponsibilitySummary ?? legacyReleaseClosureResponsibilitySummary;
  const releaseClosureResponsibilityDetail =
    data?.releaseClosureResponsibilityDetail ?? legacyReleaseClosureResponsibilityDetail;
  const releaseClosureResponsibilityNextAction =
    data?.releaseClosureResponsibilityNextAction ?? legacyReleaseClosureResponsibilityNextAction;
  const releaseClosureResponsibilitySourceLabel =
    data?.releaseClosureResponsibilitySourceLabel ??
    legacyReleaseClosureResponsibilitySourceLabel;
  const releaseClosureSummary =
    data?.releaseClosureSummary ?? legacyReleaseClosureSummary;
  const releaseClosureDetail =
    data?.releaseClosureDetail ?? legacyReleaseClosureDetail;
  const releaseClosureNextAction =
    data?.releaseClosureNextAction ?? legacyReleaseClosureNextAction;
  const releaseClosureSourceCommandLabel =
    data?.releaseClosureSourceCommandLabel ?? legacyReleaseClosureSourceCommandLabel;
  const releaseClosureRelatedRunLabel =
    data?.releaseClosureRelatedRunLabel ?? legacyReleaseClosureRelatedRunLabel;
  const releaseClosureRuntimeLabel =
    data?.releaseClosureRuntimeLabel ?? legacyReleaseClosureRuntimeLabel;
  const currentHandoffExecutionBackendLabel =
    data?.currentHandoffExecutionBackendLabel ?? legacyCurrentHandoffExecutionBackendLabel;
  const currentHandoffExecutionBackendCommandPreview =
    data?.currentHandoffExecutionBackendCommandPreview ??
    legacyCurrentHandoffExecutionBackendCommandPreview;
  const currentHandoffControllerLabel =
    data?.currentHandoffControllerLabel ?? legacyCurrentHandoffControllerLabel;
  const currentHandoffControllerRoleLabel =
    data?.currentHandoffControllerRoleLabel ?? legacyCurrentHandoffControllerRoleLabel;
  const currentHandoffOwnerLabel = data?.currentHandoffOwnerLabel ?? legacyCurrentHandoffOwnerLabel;
  const currentHandoffOwnerRoleLabel =
    data?.currentHandoffOwnerRoleLabel ?? legacyCurrentHandoffOwnerRoleLabel;
  const currentHandoffSourceCommandLabel =
    data?.currentHandoffSourceCommandLabel ?? legacyCurrentHandoffSourceCommandLabel;
  const currentHandoffRelatedRunLabel =
    data?.currentHandoffRelatedRunLabel ?? legacyCurrentHandoffRelatedRunLabel;
  const currentHandoffRuntimeLabel =
    data?.currentHandoffRuntimeLabel ?? legacyCurrentHandoffRuntimeLabel;
  const externalExecutionRecommendation =
    data?.externalExecutionRecommendation ?? legacyExternalExecutionRecommendation;
  const remediationQueueItems =
    data?.remediationQueueItems ?? legacyRemediationQueueItems;

  if (!snapshot) {
    throw new Error("ForgeGovernancePage requires page data.");
  }

  const failedGates = countFailedGates(snapshot);
  const blockedRuns = countBlockedRuns(snapshot);
  const activeProject = getActiveForgeProject(snapshot);
  const currentStage = getCurrentWorkflowStage(activeProject, snapshot);
  const releaseGateSummary = getReleaseGateSummaryView(snapshot, activeProject?.id);
  const formalArtifactResponsibility = getFormalArtifactResponsibilityView(snapshot, activeProject?.id);
  const formalArtifactView = getResolvedFormalArtifactResponsibilityView({
    formalArtifactResponsibility,
    approvalHandoffSummary,
    approvalHandoffDetail,
    approvalHandoffNextAction
  });
  const releaseClosureView = getResolvedReleaseClosureView({
    releaseClosureResponsibilitySummary,
    releaseClosureResponsibilityDetail,
    releaseClosureResponsibilityNextAction,
    releaseClosureResponsibilitySourceLabel,
    releaseClosureSummary,
    releaseClosureDetail,
    releaseClosureNextAction,
    releaseClosureSourceCommandLabel,
    releaseClosureRelatedRunLabel,
    releaseClosureRuntimeLabel,
    approvalHandoffSummary: formalArtifactView.approvalHandoffSummary,
    approvalHandoffNextAction: formalArtifactView.approvalHandoffAction,
    archiveProvenanceSummary
  });
  const governanceFormalArtifactItems = getFormalArtifactResponsibilitySummaryItems({
    formalArtifactView
  });
  const governanceReleaseClosureItems = getReleaseClosureSummaryItems({
    releaseClosureView
  });
  const bridgeReviewCommand = releaseGateSummary.bridgeReviewCommandId
    ? snapshot.commands.find((item) => item.id === releaseGateSummary.bridgeReviewCommandId) ?? null
    : null;
  const bridgeReviewRunValue = releaseGateSummary.bridgeReviewRunLabel
    ? `${releaseGateSummary.bridgeReviewRunLabel}${
        bridgeReviewCommand ? ` · 来源命令：${bridgeReviewCommand.name}` : ""
      }${
        releaseGateSummary.bridgeReviewRuntimeLabel
          ? ` · ${releaseGateSummary.bridgeReviewRuntimeLabel}`
          : ""
      }`
    : null;
  const primaryReleaseEscalationAction = getPrimaryReleaseEscalationAction(
    releaseGateSummary.escalationActions,
    releaseGateSummary.bridgeHandoffStatus
  );
  const nextAction =
    getNextAction(snapshot, currentStage, activeProject) ??
    primaryReleaseEscalationAction?.nextAction ??
    null;
  const blockingTaskChain = getBlockingTaskChain(snapshot, activeProject?.id).slice(0, 3);
  const remediationQueue: ForgeGovernanceRemediationItem[] =
    remediationQueueItems ?? getRemediationTaskQueue(snapshot, activeProject?.id).slice(0, 3);
  const remediationRetryApiPaths = Array.from(
    new Set(
      [
        ...[...snapshot.tasks]
          .filter((task) => (activeProject ? task.projectId === activeProject.id : true))
          .filter((task) => task.status !== "done")
          .flatMap((task) => [
            task.id.includes("escalation")
              ? "/api/forge/escalations/retry"
              : "/api/forge/tasks/retry",
            "/api/forge/remediations/retry"
          ]),
        ...[...blockingTaskChain, ...remediationQueue]
        .flatMap((item) => [item.retryApiPath, item.unifiedRetryApiPath])
        .filter((item): item is string => Boolean(item))
      ]
    )
  );
  const blockedCommandExecutions = snapshot.commandExecutions.filter(
    (execution) => execution.status === "blocked"
  ).length;
  const recentTransitions = snapshot.workflowTransitions.slice(0, 5).map((transition) => {
    const project = snapshot.projects.find((item) => item.id === transition.projectId);
    const stateLabel = transition.state === "blocked" ? "阻塞" : "推进中";

    return {
      label: `${transition.updatedBy} → ${transition.stage}`,
      value: `${project?.name ?? transition.projectId} · ${stateLabel} · ${transition.createdAt}${
        transition.blockers.length > 0 ? ` · ${transition.blockers[0]}` : ""
      }`
    };
  });
  const recentCommandExecutions = getRecentCommandExecutions(snapshot, activeProject?.id).map((execution) => {
    const command = snapshot.commands.find((item) => item.id === execution.commandId);
    const project = execution.projectId
      ? snapshot.projects.find((item) => item.id === execution.projectId)
      : null;

    return {
      label: `${command?.name ?? execution.commandId} · ${execution.status}`,
      value: `${execution.summary} · ${execution.triggeredBy}${
        project ? ` · ${project.name}` : ""
      } · ${execution.createdAt}${
        execution.relatedRunLabel ? ` · 相关运行：${execution.relatedRunLabel}` : ""
      }${execution.taskPackLabel ? ` · TaskPack：${execution.taskPackLabel}` : ""}${
        execution.releaseClosureSummary
          ? ` · 最终放行摘要：${execution.releaseClosureSummary}`
          : ""
      }${
        execution.releaseClosureResponsibilitySummary
          ? ` · 最终放行责任链：${execution.releaseClosureResponsibilitySummary}`
          : ""
      }${
        execution.releaseClosureDetail ?? execution.releaseClosureResponsibilityDetail
          ? ` · 放行细节：${execution.releaseClosureDetail ?? execution.releaseClosureResponsibilityDetail}`
          : ""
      }${
        execution.releaseClosureNextAction ?? execution.releaseClosureResponsibilityNextAction
          ? ` · 放行动作：${execution.releaseClosureNextAction ?? execution.releaseClosureResponsibilityNextAction}`
          : ""
      }${
        !execution.releaseClosureSummary && execution.releaseClosureResponsibilitySourceLabel
          ? ` · 最终放行来源：${execution.releaseClosureResponsibilitySourceLabel}`
          : ""
      }${
        execution.approvalHandoffSummary
          ? ` · 确认后接棒：${execution.approvalHandoffSummary}`
          : ""
      }${
        execution.approvalHandoffDetail
          ? ` · 接棒细节：${execution.approvalHandoffDetail}`
          : ""
      }${
        execution.approvalHandoffNextAction
          ? ` · 接棒动作：${execution.approvalHandoffNextAction}`
          : ""
      }${
        execution.archiveProvenanceSummary
          ? ` · 归档接棒：${execution.archiveProvenanceSummary}`
          : ""
      }${
        execution.archiveProvenanceDetail
          ? ` · 归档来源：${execution.archiveProvenanceDetail}`
          : ""
      }${
        execution.linkedComponentLabels.length > 0
          ? ` · 装配组件：${execution.linkedComponentLabels.join(" / ")}`
          : ""
      }${
        execution.pendingComponentLabels.length > 0
          ? ` · 待装配组件：${execution.pendingComponentLabels.join(" / ")}`
          : ""
      }${execution.componentAssemblyAction ? ` · ${execution.componentAssemblyAction}` : ""}${
        execution.runtimeEvidenceSummary ? ` · 最近运行证据：${execution.runtimeEvidenceSummary}` : ""
      }${
        getExecutionBackendEvidenceLabel(execution)
          ? ` · ${getExecutionBackendEvidenceLabel(execution)}`
          : ""
      }${
        getModelExecutionEvidenceLabel(execution)
          ? ` · ${getModelExecutionEvidenceLabel(execution)}`
          : ""
      }${
        execution.followUpTasks.length > 0
          ? ` · 后续任务：${execution.followUpTasks
              .map(
                (task) =>
                  `${task.title}（${task.evidenceAction}${
                    task.remediationSummary ? `；${task.remediationSummary}` : ""
                  }${task.remediationAction ? `；${task.remediationAction}` : ""}${
                    task.componentAssemblyAction ? `；${task.componentAssemblyAction}` : ""
                  }${
                    task.runtimeCapabilityDetails && task.runtimeCapabilityDetails.length > 0
                      ? `；运行证据：${task.runtimeCapabilityDetails.join(" / ")}`
                      : ""
                  }${
                    getExecutionBackendEvidenceLabel(task)
                      ? `；${getExecutionBackendEvidenceLabel(task)}`
                      : ""
                  }${
                    getModelExecutionEvidenceLabel(task)
                      ? `；${getModelExecutionEvidenceLabel(task)}`
                      : ""
                  }${task.retryApiPath ? `；整改入口：${task.retryApiPath}` : ""}${
                    task.unifiedRetryApiPath ? `；统一整改入口：${task.unifiedRetryApiPath}` : ""
                  }${
                    task.unifiedRetryRunnerCommand ? `；统一回放：${task.unifiedRetryRunnerCommand}` : ""
                  }${
                    task.remediationOwnerLabel ? `；负责人：${task.remediationOwnerLabel}` : ""
                  }${task.retryCommandLabel ? `；恢复命令：${task.retryCommandLabel}` : ""}${
                    task.retryRunnerCommand ? `；Runner回放：${task.retryRunnerCommand}` : ""
                  }）`
              )
              .join(" / ")}`
          : ""
      }`
    };
  });
  const recentPolicyDecisions = snapshot.policyDecisions.slice(0, 5).map((decision) => {
    const hook = snapshot.commandHooks.find((item) => item.id === decision.hookId);
    const execution = snapshot.commandExecutions.find(
      (item) => item.id === decision.commandExecutionId
    );
    const command = execution
      ? snapshot.commands.find((item) => item.id === execution.commandId)
      : null;

    return {
      label: `${hook?.name ?? decision.hookId} · ${decision.outcome}`,
      value: `${decision.summary}${command ? ` · 来自 ${command.name}` : ""} · ${decision.createdAt}`
    };
  });
  const pendingApprovals = formalArtifactResponsibility.pendingApprovals
    .slice(0, 5)
    .map((item) => ({
      label: `${item.label} · ${item.statusLabel}`,
      value: `${item.detail}${item.ownerLabel ? ` · 负责人：${item.ownerLabel}` : ""}${
        item.ownerRoleLabel ? ` · 角色：${item.ownerRoleLabel}` : ""
      }${item.nextAction ? ` · 当前接棒：${item.nextAction}` : ""}${
        item.relatedRunLabel ? ` · 审查来源运行：${item.relatedRunLabel}` : ""
      }${
        item.sourceCommandLabel
          ? ` · 来源命令：${item.sourceCommandLabel}`
          : ""
      }${
        releaseGateSummary.bridgeHandoffSummary
          ? ` · 桥接移交：${releaseGateSummary.bridgeHandoffSummary}`
          : ""
      }`
    }));
  const escalationItems = releaseGateSummary.escalationActions.slice(0, 5).map((item) => ({
    label: item.label,
    value: `${item.detail}${item.ownerLabel ? ` · 负责人：${item.ownerLabel}` : ""}${
      item.ownerRoleLabel ? ` · 角色：${item.ownerRoleLabel}` : ""
    }${item.nextAction ? ` · 当前接棒：${item.nextAction}` : ""}${
      item.escalationLabel ? ` · 升级规则：${item.escalationLabel}` : ""
    }${item.triggerLabel ? ` · 触发条件：${item.triggerLabel}` : ""}${
      item.relatedRunLabel ? ` · 审查来源运行：${item.relatedRunLabel}` : ""
    }${
      item.sourceCommandId
        ? ` · 来源命令：${
            snapshot.commands.find((command) => command.id === item.sourceCommandId)?.name ??
            item.sourceCommandId
          }`
        : ""
    }${
      item.bridgeHandoffSummary ? ` · 桥接移交：${item.bridgeHandoffSummary}` : ""
    }`
  }));
  const currentHandoffSourceRunValue = currentHandoffRelatedRunLabel
    ? `${currentHandoffRelatedRunLabel}${
        currentHandoffSourceCommandLabel ? ` · 来源命令：${currentHandoffSourceCommandLabel}` : ""
      }${currentHandoffRuntimeLabel ? ` · ${currentHandoffRuntimeLabel}` : ""}`
    : null;
  const governanceGateDecisionItems = [
    { label: "当前结论", value: releaseGateSummary.summary },
    ...governanceFormalArtifactItems,
    {
      label: "桥接移交",
      value:
        releaseGateSummary.bridgeHandoffSummary ??
        "当前 bridge 结果尚未形成正式移交。"
    },
    ...(bridgeReviewRunValue
      ? [
          {
            label: "审查来源运行",
            value: bridgeReviewRunValue
          }
        ]
      : []),
    ...(archiveProvenanceSummary
      ? [
          {
            label: "归档接棒",
            value: archiveProvenanceSummary
          },
          ...(archiveProvenanceDetail
            ? [
                {
                  label: "归档来源",
                  value: archiveProvenanceDetail
                }
              ]
            : [])
        ]
      : []),
    ...(releaseGateSummary.bridgeHandoffDetail
      ? [
          {
            label: "移交细节",
            value: releaseGateSummary.bridgeHandoffDetail
          }
        ]
      : []),
    ...(nextAction
      ? [
          {
            label: "当前接棒",
            value: nextAction
          }
        ]
      : []),
    ...(releaseGateSummary.missingItems.length > 0
      ? releaseGateSummary.missingItems.map((item) => ({
          label: `${item.label} · ${item.statusLabel}`,
          value: item.detail
        }))
      : [{ label: "当前状态", value: "所有关键证据和门禁都已就绪。" }])
  ];
  const governanceRuntimeSignalItems = [
    {
      label: "运行信号",
      value:
        releaseGateSummary.runtimeNotes.length > 0
          ? releaseGateSummary.runtimeNotes.join(" / ")
          : "当前没有可引用的 Runtime 信号"
    },
    {
      label: "运行证据",
      value:
        releaseGateSummary.runtimeCapabilityDetails.length > 0
          ? releaseGateSummary.runtimeCapabilityDetails.join(" / ")
          : "当前没有结构化的运行能力证据"
    },
    {
      label: "外部执行准备度",
      value:
        externalExecutionSummary ?? "当前未配置外部模型执行契约，默认仍走本地 fallback。"
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
    ...(currentHandoffSourceRunValue
      ? [
          {
            label: "当前接棒来源运行",
            value: currentHandoffSourceRunValue
          }
        ]
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
      ? [
          {
            label: "默认外部执行",
            value: currentHandoffExecutionBackendLabel
          }
        ]
      : []),
    ...(currentHandoffExecutionBackendCommandPreview
      ? [
          {
            label: "执行入口预览",
            value: currentHandoffExecutionBackendCommandPreview
          }
        ]
      : []),
    {
      label: "外部执行建议",
      value:
        externalExecutionRecommendation ??
        "未配置外部模型执行契约，当前继续使用本地 fallback；如需真实模型执行，先配置 Engineer / Reviewer provider 契约。"
    }
  ];

  return (
    <ForgeChrome
      view="governance"
      showNavigation={showNavigation}
      eyebrow="命令"
      title="命令中心"
      description="命令中心负责标准动作、策略 Hook 和审计回写。它是训练与治理后台的一部分，不直接替代项目交付工作台。"
      metrics={[
        { label: "标准命令", value: forgeCommandContracts.length },
        { label: "阻断命令", value: blockedCommandExecutions },
        { label: "失败门禁", value: failedGates }
      ]}
    >
      <SectionPanel eyebrow="门禁" title="门禁状态" badge="交付阀门" className="panel panel-wide">
        <GateList gates={snapshot.deliveryGate} />
      </SectionPanel>

      <SectionPanel eyebrow="放行" title="放行判断" badge={releaseGateSummary.overallLabel} className="panel">
        <ReleaseDecisionCluster
          name="governance-release"
          gateGroup={{
            eyebrow: "闸口",
            title: "闸口判断",
            badge: releaseGateSummary.overallLabel,
            items: governanceGateDecisionItems,
            tone: "signal"
          }}
          runtimeGroup={{
            eyebrow: "执行",
            title: "执行链信号",
            badge: executionBackendSummary ? "外部链" : "本地 fallback",
            items: governanceRuntimeSignalItems
          }}
          releaseClosureGroup={
            governanceReleaseClosureItems.length > 0
              ? {
                  eyebrow: "放行",
                  title: "最终放行责任链",
                  badge: "终态",
                  items: governanceReleaseClosureItems,
                  tone: "closure"
                }
              : null
          }
        />
      </SectionPanel>

      <SectionPanel eyebrow="责任" title="责任与升级" badge={`${releaseGateSummary.escalationActions.length} 项`} className="panel panel-full">
        <GovernanceResponsibilityCluster
          name="governance-responsibility"
          approvalGroup={{
            eyebrow: "审批",
            title: "放行审批链",
            badge: `${releaseGateSummary.approvalTrace.length} 步`,
            items:
              releaseGateSummary.approvalTrace.length > 0
                ? releaseGateSummary.approvalTrace.map((item) => ({
                    label: `${item.label} · ${item.statusLabel}`,
                    value: `${item.detail} · ${item.createdAt}${
                      item.ownerLabel ? ` · 负责人：${item.ownerLabel}` : ""
                    }${item.ownerRoleLabel ? ` · 角色：${item.ownerRoleLabel}` : ""}${
                      item.slaLabel ? ` · SLA：${item.slaLabel}` : ""
                    }${item.breachLabel ? ` · 违约风险：${item.breachLabel}` : ""}${
                      item.escalationTrigger ? ` · 触发条件：${item.escalationTrigger}` : ""
                    }${item.escalationLabel ? ` · 升级规则：${item.escalationLabel}` : ""}${
                      item.nextAction ? ` · 下一步：${item.nextAction}` : ""
                    }${item.escalated ? " · 已升级" : ""}`
                  }))
                : [{ label: "当前状态", value: "当前还没有形成可追踪的放行审批链。" }]
          }}
          escalationGroup={{
            eyebrow: "升级",
            title: "自动升级动作",
            badge: `${releaseGateSummary.escalationActions.length} 项`,
            items:
              releaseGateSummary.escalationActions.length > 0
                ? releaseGateSummary.escalationActions.map((item) => ({
                    label: item.label,
                    value: `${item.detail}${
                      item.ownerLabel ? ` · 负责人：${item.ownerLabel}` : ""
                    }${item.ownerRoleLabel ? ` · 角色：${item.ownerRoleLabel}` : ""}${
                      item.runtimeEvidenceLabel ? ` · 运行证据：${item.runtimeEvidenceLabel}` : ""
                    }${
                      getExecutionBackendEvidenceLabel(item)
                        ? ` · ${getExecutionBackendEvidenceLabel(item)}`
                        : ""
                    }${
                      getModelExecutionEvidenceLabel(item)
                        ? ` · ${getModelExecutionEvidenceLabel(item)}`
                        : ""
                    }${item.taskLabel ? ` · 关联任务：${item.taskLabel}` : ""}${
                      item.retryApiPath ? ` · 整改入口：${item.retryApiPath}` : ""
                    }${item.unifiedRetryApiPath ? ` · 统一整改入口：${item.unifiedRetryApiPath}` : ""}${
                      item.unifiedRetryRunnerCommand ? ` · 统一回放：${item.unifiedRetryRunnerCommand}` : ""
                    }${item.retryRunnerCommand ? ` · Runner回放：${item.retryRunnerCommand}` : ""}${
                      item.triggerLabel ? ` · 触发条件：${item.triggerLabel}` : ""
                    }${item.escalationLabel ? ` · 升级规则：${item.escalationLabel}` : ""}${
                      releaseGateSummary.bridgeHandoffSummary
                        ? ` · 桥接移交：${releaseGateSummary.bridgeHandoffSummary}`
                        : ""
                    }${
                      releaseGateSummary.bridgeHandoffDetail
                        ? ` · 移交细节：${releaseGateSummary.bridgeHandoffDetail}`
                        : ""
                    }${item.nextAction ? ` · 当前接棒：${item.nextAction}` : ""} · 阻断发布：${
                      item.blocking ? "是" : "否"
                    }`
                  }))
                : [{ label: "当前状态", value: "当前没有需要自动生成的升级动作。" }]
          }}
          riskGroup={{
            eyebrow: "风险",
            title: "风险与阻塞",
            badge: "负责人处理",
            items: [
              { label: "失败门禁", value: failedGates > 0 ? "存在失败项" : "暂无" },
              { label: "阻塞执行", value: blockedRuns > 0 ? `${blockedRuns} 条` : "暂无" },
              {
                label: "阻断任务链",
                value:
                  blockingTaskChain.length > 0
                    ? blockingTaskChain
                        .map((item) =>
                          item.sourceCommandLabel
                            ? `${item.title} <- ${item.sourceCommandLabel} · ${item.evidenceAction}${
                                item.runtimeLabel ? ` · ${item.runtimeLabel}` : ""
                              }${
                                getModelExecutionEvidenceLabel(item)
                                  ? ` · ${getModelExecutionEvidenceLabel(item)}`
                                  : ""
                              }${
                                item.runtimeCapabilityDetails && item.runtimeCapabilityDetails.length > 0
                                  ? ` · ${item.runtimeCapabilityDetails.join(" / ")}`
                                  : ""
                              }${item.componentAssemblyAction ? ` · ${item.componentAssemblyAction}` : ""}${
                                item.remediationSummary ? ` · ${item.remediationSummary}` : ""
                              }${item.remediationAction ? ` · ${item.remediationAction}` : ""}${
                                item.retryApiPath ? ` · 整改入口：${item.retryApiPath}` : ""
                              }${
                                item.unifiedRetryApiPath
                                  ? ` · 统一整改入口：${item.unifiedRetryApiPath}`
                                  : ""
                              }${
                                item.unifiedRetryRunnerCommand
                                  ? ` · 统一回放：${item.unifiedRetryRunnerCommand}`
                                  : ""
                              }${item.remediationOwnerLabel ? ` · 负责人：${item.remediationOwnerLabel}` : ""}${
                                item.retryCommandLabel ? ` · 恢复命令：${item.retryCommandLabel}` : ""
                              }${item.retryRunnerCommand ? ` · Runner回放：${item.retryRunnerCommand}` : ""}`
                            : `${item.title} · ${item.evidenceAction}${
                                item.runtimeLabel ? ` · ${item.runtimeLabel}` : ""
                              }${
                                getModelExecutionEvidenceLabel(item)
                                  ? ` · ${getModelExecutionEvidenceLabel(item)}`
                                  : ""
                              }${
                                item.runtimeCapabilityDetails && item.runtimeCapabilityDetails.length > 0
                                  ? ` · ${item.runtimeCapabilityDetails.join(" / ")}`
                                  : ""
                              }${item.componentAssemblyAction ? ` · ${item.componentAssemblyAction}` : ""}${
                                item.remediationSummary ? ` · ${item.remediationSummary}` : ""
                              }${item.remediationAction ? ` · ${item.remediationAction}` : ""}${
                                item.retryApiPath ? ` · 整改入口：${item.retryApiPath}` : ""
                              }${
                                item.unifiedRetryApiPath
                                  ? ` · 统一整改入口：${item.unifiedRetryApiPath}`
                                  : ""
                              }${
                                item.unifiedRetryRunnerCommand
                                  ? ` · 统一回放：${item.unifiedRetryRunnerCommand}`
                                  : ""
                              }${item.remediationOwnerLabel ? ` · 负责人：${item.remediationOwnerLabel}` : ""}${
                                item.retryCommandLabel ? ` · 恢复命令：${item.retryCommandLabel}` : ""
                              }${item.retryRunnerCommand ? ` · Runner回放：${item.retryRunnerCommand}` : ""}`
                        )
                        .join(" / ")
                    : "当前没有需要处理的阻断任务"
              },
              {
                label: "整改队列",
                value:
                  remediationQueue.length > 0
                    ? remediationQueue
                        .map(
                          (item) =>
                            `${item.title} · ${item.evidenceAction}${
                              item.runtimeLabel ? ` · ${item.runtimeLabel}` : ""
                            }${
                              getModelExecutionEvidenceLabel(item)
                                ? ` · ${getModelExecutionEvidenceLabel(item)}`
                                : ""
                            }${
                              item.runtimeCapabilityDetails && item.runtimeCapabilityDetails.length > 0
                                ? ` · ${item.runtimeCapabilityDetails.join(" / ")}`
                                : ""
                            }${item.componentAssemblyAction ? ` · ${item.componentAssemblyAction}` : ""}${
                              item.remediationSummary ? ` · ${item.remediationSummary}` : ""
                            }${item.remediationAction ? ` · ${item.remediationAction}` : ""}${
                              item.runtimeExecutionBackendCommandPreview
                                ? ` · 后端命令预览：${item.runtimeExecutionBackendCommandPreview}`
                                : ""
                            }${item.retryApiPath ? ` · 整改入口：${item.retryApiPath}` : ""}${
                              item.unifiedRetryApiPath ? ` · 统一整改入口：${item.unifiedRetryApiPath}` : ""
                            }${
                              item.unifiedRetryRunnerCommand
                                ? ` · 统一回放：${item.unifiedRetryRunnerCommand}`
                                : ""
                            }${item.remediationOwnerLabel ? ` · 负责人：${item.remediationOwnerLabel}` : ""}${
                              item.retryCommandLabel ? ` · 恢复命令：${item.retryCommandLabel}` : ""
                            }${item.retryRunnerCommand ? ` · Runner回放：${item.retryRunnerCommand}` : ""}`
                        )
                        .join(" / ")
                    : "当前没有需要回放的整改任务"
              },
              {
                label: "整改入口",
                value:
                  remediationRetryApiPaths.length > 0
                    ? remediationRetryApiPaths
                        .map((path) =>
                          path === "/api/forge/remediations/retry"
                            ? `统一整改入口：${path}`
                            : `整改入口：${path}`
                        )
                        .join(" / ")
                    : "当前没有可用的整改回放入口"
              },
              ...(nextAction ? [{ label: "当前接棒", value: nextAction }] : []),
              {
                label: "外部执行准备度",
                value:
                  externalExecutionSummary ?? "当前未配置外部模型执行契约，默认仍走本地 fallback。"
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
                value:
                  releaseGateSummary.bridgeHandoffSummary ??
                  "当前 bridge 结果尚未形成正式移交。"
              },
              {
                label: "外部执行建议",
                value:
                  externalExecutionRecommendation ??
                  "未配置外部模型执行契约，当前继续使用本地 fallback；如需真实模型执行，先配置 Engineer / Reviewer provider 契约。"
              }
            ]
          }}
          pendingApprovalGroup={{
            eyebrow: "确认",
            title: "待人工确认",
            badge: `${pendingApprovals.length} 项`,
            items:
              pendingApprovals.length > 0
                ? [
                    ...pendingApprovals,
                    {
                      label: "确认后接棒",
                      value: `${formalArtifactView.approvalHandoffSummary}${
                        formalArtifactView.approvalHandoffDetail
                          ? ` · ${formalArtifactView.approvalHandoffDetail}`
                          : ""
                      }${
                        formalArtifactView.approvalHandoffAction
                          ? ` · 接棒动作：${formalArtifactView.approvalHandoffAction}`
                          : ""
                      }`
                    }
                  ]
                : [{ label: "当前状态", value: "当前没有待人工确认事项。" }]
          }}
          incidentGroup={{
            eyebrow: "升级",
            title: "升级事项",
            badge: `${escalationItems.length} 项`,
            items:
              escalationItems.length > 0
                ? escalationItems
                : [{ label: "当前状态", value: "当前没有升级事项。" }]
          }}
        />
      </SectionPanel>

      <SectionPanel eyebrow="审计" title="命令审计" badge={`${snapshot.commandExecutions.length} 条`} className="panel panel-wide">
        <EvidenceAuditCluster
          name="governance-audit"
          className="governance-audit-cluster"
          groups={[
            {
              eyebrow: "审计",
              title: "最近流转记录",
              badge: "阶段历史",
              items:
                recentTransitions.length > 0
                  ? recentTransitions
                  : [{ label: "当前状态", value: "还没有记录到阶段流转历史。" }]
            },
            {
              eyebrow: "执行",
              title: "最近命令执行",
              badge: `${snapshot.commandExecutions.length} 条`,
              items:
                recentCommandExecutions.length > 0
                  ? recentCommandExecutions
                  : [{ label: "当前状态", value: "还没有命令执行记录。" }]
            }
          ]}
        />
      </SectionPanel>

      <SectionPanel eyebrow="基线" title="治理基线" badge={`${forgeCommandContracts.length} 条标准命令`} className="panel panel-full">
        <GroupedSummaryCluster
          name="governance-baseline"
          groups={[
            {
              eyebrow: "命令",
              title: "标准命令",
              badge: `${forgeCommandContracts.length} 条`,
              items:
                forgeCommandContracts.length > 0
                  ? forgeCommandContracts.map((contract) => {
                      const command = snapshot.commands.find((item) => item.type === contract.type);

                      return {
                        label: `${command?.name ?? contract.type} · ${contract.triggerStage}`,
                        value: `${command?.summary ?? "标准交付动作"} · 责任执行器：${contract.runnerProfile} · 输入：${
                          contract.inputArtifacts.length > 0
                            ? contract.inputArtifacts.join(" / ")
                            : "无"
                        } · 输出：${contract.outputArtifacts.join(" / ")}`
                      };
                    })
                  : [{ label: "当前状态", value: "还没有标准命令。" }]
            },
            {
              eyebrow: "策略",
              title: "策略 Hook",
              badge: `${snapshot.commandHooks.length} 条`,
              items:
                snapshot.commandHooks.length > 0
                  ? snapshot.commandHooks.map((hook) => ({
                      label: hook.name,
                      value: `${hook.summary} · ${hook.policy}`
                    }))
                  : [{ label: "当前状态", value: "还没有 Hook / Policy 基线。" }]
            },
            {
              eyebrow: "判定",
              title: "策略判定",
              badge: `${snapshot.policyDecisions.length} 条`,
              items:
                recentPolicyDecisions.length > 0
                  ? recentPolicyDecisions
                  : [{ label: "当前状态", value: "还没有策略判定记录。" }]
            }
          ]}
        />
        <div className="subpanel-stack">
          <article className="subpanel">
            <div className="subpanel-head">
              <div>
                <p className="eyebrow">规则</p>
                <h4>协作规则</h4>
              </div>
              <span className="pill">团队纪律</span>
            </div>
            <ul className="rule-list">
              <li>所有交付必须经过 PRD、TaskPack、补丁和测试报告四类工件交接。</li>
              <li>失败门禁未清零前，发布负责人不得推进交付动作。</li>
              <li>Prompt、Skill 和模板变更必须沉淀到资产层，不能只留在单次对话里。</li>
            </ul>
          </article>
        </div>
      </SectionPanel>
    </ForgeChrome>
  );
}
