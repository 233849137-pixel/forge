import React from "react";
import type { ForgeDashboardSnapshot } from "../../packages/core/src/types";
import type { ForgeArtifactsPageData } from "../server/forge-page-dtos";
import ForgeChrome from "./forge-chrome";
import {
  ArtifactCards,
  EvidenceAuditCluster,
  GroupedSummaryCluster,
  LatestPrdPanel,
  ResponsibilitySummaryCluster,
  SectionPanel,
  getActiveForgeProject,
  getEvidenceTimelineSummary,
  getArtifactQueue,
  getArtifactReviewChecklistSummary,
  getArtifactReviewRecordSummary,
  getFormalArtifactProvenanceSummary,
  getFormalArtifactResponsibilitySummaryItems,
  getFormalArtifactResponsibilityView,
  getLatestPrdDocument,
  getMissingArtifactsForProject,
  getProjectArtifacts,
  getReleaseClosureSummaryItems,
  getResolvedFormalArtifactResponsibilityView,
  getResolvedReleaseClosureView,
  getReleaseGateSummaryView
} from "./forge-os-shared";

export default function ForgeArtifactsPage({
  data,
  snapshot: legacySnapshot,
  showNavigation = false
}: {
  data?: ForgeArtifactsPageData;
  snapshot?: ForgeArtifactsPageData;
  showNavigation?: boolean;
}) {
  const snapshot = data ?? legacySnapshot;

  if (!snapshot) {
    throw new Error("ForgeArtifactsPage requires page data.");
  }

  const selectorSnapshot = snapshot as ForgeDashboardSnapshot;
  const activeProject = getActiveForgeProject(selectorSnapshot);
  const artifacts = getProjectArtifacts(selectorSnapshot, activeProject?.id);
  const artifactQueue = getArtifactQueue(selectorSnapshot, activeProject?.id);
  const missingArtifacts = getMissingArtifactsForProject(selectorSnapshot, activeProject?.id);
  const evidenceTimeline = getEvidenceTimelineSummary(selectorSnapshot, activeProject?.id);
  const reviewRecords = getArtifactReviewRecordSummary(selectorSnapshot, activeProject?.id);
  const reviewChecklist = getArtifactReviewChecklistSummary(selectorSnapshot, activeProject?.id);
  const releaseGateSummary = getReleaseGateSummaryView(selectorSnapshot, activeProject?.id);
  const formalArtifactProvenance = getFormalArtifactProvenanceSummary(selectorSnapshot, activeProject?.id);
  const formalArtifactResponsibility = getFormalArtifactResponsibilityView(selectorSnapshot, activeProject?.id);
  const formalArtifactView = getResolvedFormalArtifactResponsibilityView({
    formalArtifactResponsibility
  });
  const latestPrd = getLatestPrdDocument(selectorSnapshot, activeProject?.id);
  const releaseClosureView = getResolvedReleaseClosureView({
    releaseClosureResponsibilitySummary: releaseGateSummary.releaseClosureResponsibility?.summary,
    releaseClosureResponsibilityDetail: releaseGateSummary.releaseClosureResponsibility?.detail,
    releaseClosureResponsibilityNextAction: releaseGateSummary.releaseClosureResponsibility?.nextAction,
    releaseClosureResponsibilitySourceLabel: releaseGateSummary.releaseClosureResponsibility?.sourceLabel,
    releaseClosureSummary: releaseGateSummary.releaseClosure?.summary,
    releaseClosureDetail: releaseGateSummary.releaseClosure?.detail,
    releaseClosureNextAction: releaseGateSummary.releaseClosure?.nextAction,
    releaseClosureSourceCommandLabel: releaseGateSummary.releaseClosure?.sourceCommandLabel,
    releaseClosureRelatedRunLabel: releaseGateSummary.releaseClosure?.relatedRunLabel,
    releaseClosureRuntimeLabel: releaseGateSummary.releaseClosure?.runtimeLabel,
    approvalHandoffSummary: formalArtifactView.approvalHandoffSummary,
    approvalHandoffNextAction: formalArtifactView.approvalHandoffAction,
    archiveProvenanceSummary: releaseGateSummary.archiveProvenance?.summary
  });
  const artifactQueueItems =
    artifactQueue.length > 0
      ? artifactQueue.map((item) => ({
          label: item.artifact.title,
          value: `${item.statusLabel} · ${item.slaLabel} · ${item.action}`
        }))
      : [{ label: "暂无待接棒工件", value: "当前工件都处于已就绪状态。" }];
  const missingArtifactItems =
    missingArtifacts.length > 0
      ? missingArtifacts.map((item) => ({
          label: item.label,
          value: "当前阶段尚未形成，补齐后再继续推进后续交接。"
        }))
      : [{ label: "关键工件完整", value: "当前阶段所需工件已经齐备，可以继续推进。" }];
  const formalArtifactResponsibilityItems = getFormalArtifactResponsibilitySummaryItems({
    formalArtifactView,
    gapActionFallback: "当前没有额外的正式工件补齐动作。"
  });
  const releaseClosureItems = getReleaseClosureSummaryItems({
    releaseClosureView
  });
  const archiveProvenanceItems = releaseGateSummary.archiveProvenance
    ? [
        {
          label: "归档接棒",
          value: releaseGateSummary.archiveProvenance.summary
        },
        {
          label: "归档来源",
          value: releaseGateSummary.archiveProvenance.detail ?? "当前归档沉淀已进入正式工件面。"
        }
      ]
    : [];
  const formalArtifactProvenanceItems = formalArtifactProvenance.map((item) => ({
    label: item.artifactTitle,
    value: item.value
  }));
  const evidenceTimelineItems =
    evidenceTimeline.length > 0
      ? evidenceTimeline.map((item) => ({
          label: `${item.label} · ${item.statusLabel}`,
          value: `${item.artifact.title} · ${item.ownerLabel} · ${item.artifact.updatedAt}${
            item.runtimeLabel ? ` · ${item.runtimeLabel}` : ""
          }${item.sourceCommandLabel ? ` · 来源命令：${item.sourceCommandLabel}` : ""}${
            item.relatedRunLabel ? ` · 来源运行：${item.relatedRunLabel}` : ""
          }`
        }))
      : [{ label: "暂无证据对象", value: "当前项目还没有形成正式交付证据。" }];
  const reviewRecordItems =
    reviewRecords.length > 0
      ? reviewRecords.map((item) => ({
          label: `${item.artifact.title} · ${item.decisionLabel}`,
          value: `${item.reviewer?.name ?? "未分配评审"}：${item.review.summary}`
        }))
      : [{ label: "暂无评审记录", value: "当前项目还没有形成正式评审结果。" }];
  const reviewChecklistItems =
    reviewChecklist.length > 0
      ? reviewChecklist.map((item) => ({
          label: `${item.artifactTitle} · ${item.decisionLabel}`,
          value: item.conditions.join("；")
        }))
      : [{ label: "暂无通过条件", value: "当前项目还没有沉淀评审清单。" }];

  return (
    <ForgeChrome
      view="artifacts"
      showNavigation={showNavigation}
      eyebrow="工件"
      title="工件中心"
      description="工件页现在是交接中心。负责人要在这里看清楚谁在等谁、哪些工件还缺、当前 PRD 和 TaskPack 是否已经足够支撑执行与发布。"
      metrics={[
        { label: "当前项目", value: activeProject?.name ?? "未选择" },
        { label: "待接棒", value: artifactQueue.length },
        { label: "关键缺口", value: missingArtifacts.length }
      ]}
    >
      <SectionPanel eyebrow="工件" title="工件总览" badge={`${artifacts.length} 项`} className="panel panel-wide">
        <GroupedSummaryCluster
          name="artifact-overview"
          className="artifact-overview-cluster"
          groups={[
            {
              eyebrow: "接棒",
              title: "待接棒队列",
              badge: `${artifactQueue.length} 项`,
              items: artifactQueueItems
            },
            {
              eyebrow: "缺口",
              title: "关键缺失工件",
              badge: "按当前阶段",
              items: missingArtifactItems
            }
          ]}
        />
      </SectionPanel>

      <SectionPanel eyebrow="责任" title="责任与来源" badge="放行链" className="panel">
        <ResponsibilitySummaryCluster
          name="artifact-responsibility"
          layout="stack"
          formalArtifactGroup={{
            eyebrow: "责任",
            title: "正式工件责任",
            badge: "放行链",
            items: formalArtifactResponsibilityItems
          }}
          releaseClosureGroup={
            releaseClosureItems.length > 0
              ? {
                  eyebrow: "放行",
                  title: "最终放行责任链",
                  badge: "终态",
                  items: releaseClosureItems,
                  tone: "closure"
                }
              : null
          }
          archiveGroup={
            archiveProvenanceItems.length > 0
              ? {
                  eyebrow: "归档",
                  title: "归档接棒",
                  badge: "来源链",
                  items: archiveProvenanceItems,
                  tone: "provenance"
                }
              : null
          }
          provenanceGroup={
            formalArtifactProvenanceItems.length > 0
              ? {
                  eyebrow: "来源",
                  title: "正式来源链",
                  badge: `${formalArtifactProvenanceItems.length} 项`,
                  items: formalArtifactProvenanceItems,
                  tone: "provenance"
                }
              : null
          }
        />
      </SectionPanel>

      <SectionPanel eyebrow="证据" title="证据与评审" badge={`${evidenceTimeline.length} 条`} className="panel panel-wide">
        <EvidenceAuditCluster
          name="artifact-evidence"
          className="artifact-evidence-cluster"
          groups={[
            {
              eyebrow: "证据",
              title: "证据时间线",
              badge: `${evidenceTimeline.length} 条`,
              items: evidenceTimelineItems
            },
            {
              eyebrow: "评审",
              title: "评审结果记录",
              badge: `${reviewRecords.length} 条`,
              items: reviewRecordItems
            },
            {
              eyebrow: "条件",
              title: "通过条件",
              badge: "按工件",
              items: reviewChecklistItems
            }
          ]}
        />
      </SectionPanel>

      <SectionPanel eyebrow="资产" title="工件资产" badge={`${artifacts.length} 项`} className="panel panel-full">
        <div className="subpanel-stack">
          <article className="subpanel">
            <div className="subpanel-head">
              <div>
                <p className="eyebrow">工件</p>
                <h4>当前工件清单</h4>
              </div>
              <span className="pill">{`${artifacts.length} 项`}</span>
            </div>
            <ArtifactCards artifacts={artifacts} snapshot={selectorSnapshot} />
          </article>

          <article className="subpanel">
            <div className="subpanel-head">
              <div>
                <p className="eyebrow">PRD</p>
                <h4>最新 PRD 草案</h4>
              </div>
              <span className="pill">当前项目</span>
            </div>
            <LatestPrdPanel document={latestPrd} />
          </article>
        </div>
      </SectionPanel>
    </ForgeChrome>
  );
}
