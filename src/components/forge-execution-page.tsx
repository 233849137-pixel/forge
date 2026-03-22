import React from "react";
import type { ForgeDashboardSnapshot } from "../../packages/core/src";
import {
  buildForgeExecutionPageData,
  type ForgeExecutionPageData,
  type ForgeExecutionRemediationItem
} from "../lib/forge-execution-page-data";
import ForgeChrome from "./forge-chrome";
import RunnerProbeBridge from "./runner-probe-bridge";
import { RunCards, SectionPanel, SummaryList } from "./forge-os-shared";

export default function ForgeExecutionPage({
  data,
  snapshot: legacySnapshot,
  externalExecutionSummary: legacyExternalExecutionSummary,
  externalExecutionDetails: legacyExternalExecutionDetails,
  executionBackendSummary: legacyExecutionBackendSummary,
  executionBackendDetails: legacyExecutionBackendDetails,
  bridgeExecutionSummary: legacyBridgeExecutionSummary,
  bridgeExecutionDetails: legacyBridgeExecutionDetails,
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
  data?: ForgeExecutionPageData;
  snapshot?: ForgeDashboardSnapshot;
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
  showNavigation?: boolean;
}) {
  const pageData =
    data ??
    (legacySnapshot
      ? buildForgeExecutionPageData({
          snapshot: legacySnapshot,
          externalExecutionSummary: legacyExternalExecutionSummary,
          externalExecutionDetails: legacyExternalExecutionDetails,
          executionBackendSummary: legacyExecutionBackendSummary,
          executionBackendDetails: legacyExecutionBackendDetails,
          bridgeExecutionSummary: legacyBridgeExecutionSummary,
          bridgeExecutionDetails: legacyBridgeExecutionDetails,
          currentHandoffExecutionBackendLabel: legacyCurrentHandoffExecutionBackendLabel,
          currentHandoffExecutionBackendCommandPreview:
            legacyCurrentHandoffExecutionBackendCommandPreview,
          currentHandoffControllerLabel: legacyCurrentHandoffControllerLabel,
          currentHandoffControllerRoleLabel: legacyCurrentHandoffControllerRoleLabel,
          currentHandoffOwnerLabel: legacyCurrentHandoffOwnerLabel,
          currentHandoffOwnerRoleLabel: legacyCurrentHandoffOwnerRoleLabel,
          currentHandoffSourceCommandLabel: legacyCurrentHandoffSourceCommandLabel,
          currentHandoffRelatedRunLabel: legacyCurrentHandoffRelatedRunLabel,
          currentHandoffRuntimeLabel: legacyCurrentHandoffRuntimeLabel,
          externalExecutionRecommendation: legacyExternalExecutionRecommendation,
          remediationQueueItems: legacyRemediationQueueItems
        })
      : null);

  if (!pageData) {
    throw new Error("ForgeExecutionPage requires page data.");
  }

  return (
    <ForgeChrome
      view="execution"
      showNavigation={showNavigation}
      eyebrow="执行"
      title="执行中枢"
      description="执行页只负责真实运行链路：谁在执行、当前队列、运行成本和本地上下文。这里不是项目摘要页，也不是团队组织图。"
      metrics={[
        { label: "执行记录", value: pageData.metrics.totalRuns },
        { label: "运行中", value: pageData.metrics.runningRuns },
        { label: "已阻塞", value: pageData.metrics.blockedRuns }
      ]}
    >
      <RunnerProbeBridge />

      <SectionPanel eyebrow="焦点" title="当前执行焦点" badge={pageData.focus.badge} className="panel panel-wide">
        <SummaryList items={pageData.focus.items} />
      </SectionPanel>

      <SectionPanel eyebrow="阻塞" title="阻塞原因" badge={pageData.blockers.badge} className="panel">
        <SummaryList items={pageData.blockers.items} />
      </SectionPanel>

      <SectionPanel eyebrow="任务" title="待处理任务中枢" badge={pageData.taskQueue.badge} className="panel">
        <SummaryList items={pageData.taskQueue.items} />
      </SectionPanel>

      <SectionPanel eyebrow="证据" title="证据状态" badge={pageData.evidence.badge} className="panel">
        <SummaryList items={pageData.evidence.items} />
      </SectionPanel>

      <SectionPanel eyebrow="整改" title="整改回放" badge={pageData.remediation.badge} className="panel panel-wide">
        <SummaryList items={pageData.remediation.items} />
      </SectionPanel>

      <SectionPanel eyebrow="Runner" title="Runner 注册表" badge={pageData.runnerRegistry.badge} className="panel">
        <SummaryList items={pageData.runnerRegistry.items} />
      </SectionPanel>

      <SectionPanel eyebrow="探测" title="Runner 探测状态" badge={pageData.runnerProbe.badge} className="panel">
        <SummaryList items={pageData.runnerProbe.items} />
      </SectionPanel>

      <SectionPanel
        eyebrow="归因"
        title="失败归因"
        badge={pageData.failureAttribution.badge}
        className="panel"
      >
        <SummaryList items={pageData.failureAttribution.items} />
      </SectionPanel>

      <SectionPanel eyebrow="事件" title="最近事件流" badge={pageData.timeline.badge} className="panel panel-wide">
        <SummaryList items={pageData.timeline.items} />
      </SectionPanel>

      <SectionPanel eyebrow="队列" title="执行队列" badge="Runner 视角" className="panel panel-full">
        <RunCards
          runs={pageData.runQueue.runs}
          projects={pageData.runQueue.projects}
          artifacts={pageData.runQueue.artifacts}
          components={pageData.runQueue.components}
        />
      </SectionPanel>

      <SectionPanel eyebrow="本地" title="本地运行上下文" badge={pageData.localContext.badge} className="panel panel-wide">
        <SummaryList items={pageData.localContext.items} />
      </SectionPanel>
    </ForgeChrome>
  );
}
