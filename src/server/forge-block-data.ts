import { getControlPlaneSnapshotForAI } from "../../packages/ai/src";
import { loadDashboardSnapshot } from "../../packages/db/src";

type ForgeSnapshot = ReturnType<typeof loadDashboardSnapshot>;
type ForgeControlPlane = ReturnType<typeof getControlPlaneSnapshotForAI>;

function resolveActiveProjectId(snapshot: ForgeSnapshot) {
  return snapshot.activeProjectId ?? snapshot.projects[0]?.id ?? null;
}

export function getProjectOverviewBlock(snapshot: ForgeSnapshot) {
  const activeProjectId = resolveActiveProjectId(snapshot);
  const activeProject = snapshot.projects.find((project) => project.id === activeProjectId) ?? null;
  const activeWorkflow =
    snapshot.workflowStates.find((workflow) => workflow.projectId === activeProjectId) ?? null;

  return {
    activeProjectId,
    activeProject,
    activeWorkflow,
    totalProjects: snapshot.projects.length,
    totalTasks: snapshot.tasks.length,
    totalArtifacts: snapshot.artifacts.length,
    items: snapshot.projects.map((project) => {
      const workflow =
        snapshot.workflowStates.find((item) => item.projectId === project.id) ?? null;
      const tasks = snapshot.tasks.filter((task) => task.projectId === project.id);
      const artifacts = snapshot.artifacts.filter((artifact) => artifact.projectId === project.id);

      return {
        id: project.id,
        name: project.name,
        sector: project.sector,
        stage: workflow?.currentStage ?? null,
        state: workflow?.state ?? null,
        taskCount: tasks.length,
        blockedTaskCount: tasks.filter((task) => task.status === "blocked").length,
        artifactCount: artifacts.length,
        readyArtifactCount: artifacts.filter((artifact) => artifact.status === "ready").length
      };
    })
  };
}

export function getExecutionStatusBlock(controlPlane: ForgeControlPlane) {
  return {
    externalExecutionSummary: controlPlane.runtimeSummary.externalExecutionSummary,
    externalExecutionDetails: controlPlane.runtimeSummary.externalExecutionDetails,
    executionBackendSummary: controlPlane.runtimeSummary.executionBackendSummary,
    executionBackendDetails: controlPlane.runtimeSummary.executionBackendDetails,
    bridgeExecutionSummary: controlPlane.runtimeSummary.bridgeExecutionSummary,
    bridgeExecutionDetails: controlPlane.runtimeSummary.bridgeExecutionDetails,
    externalExecutionRecommendation: controlPlane.runtimeSummary.externalExecutionRecommendation,
    remediationQueueCount: controlPlane.remediationQueue.length,
    currentHandoffExecutionBackendLabel:
      controlPlane.currentHandoff.runtimeExecutionBackendLabel ?? null,
    currentHandoffExecutionBackendCommandPreview:
      controlPlane.currentHandoff.runtimeExecutionBackendCommandPreview ?? null
  };
}

export function getReadinessBlock(controlPlane: ForgeControlPlane) {
  return {
    statusLabel: controlPlane.readiness.statusLabel,
    bridgeHandoffSummary: controlPlane.readiness.bridgeHandoffSummary ?? null,
    bridgeHandoffDetail: controlPlane.readiness.bridgeHandoffDetail ?? null,
    releaseGateOverallLabel: controlPlane.releaseGate.overallLabel,
    blockingTaskCount: controlPlane.blockingTasks.length
  };
}

export function getArtifactsSummaryBlock(
  snapshot: ForgeSnapshot,
  projectId = resolveActiveProjectId(snapshot) ?? undefined
) {
  const scopedArtifacts = projectId
    ? snapshot.artifacts.filter((artifact) => artifact.projectId === projectId)
    : snapshot.artifacts;
  const byType = Object.entries(
    scopedArtifacts.reduce<Record<string, number>>((accumulator, artifact) => {
      accumulator[artifact.type] = (accumulator[artifact.type] ?? 0) + 1;
      return accumulator;
    }, {})
  )
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));

  return {
    projectId: projectId ?? null,
    totalArtifacts: snapshot.artifacts.length,
    projectArtifactCount: scopedArtifacts.length,
    byStatus: {
      draft: scopedArtifacts.filter((artifact) => artifact.status === "draft").length,
      inReview: scopedArtifacts.filter((artifact) => artifact.status === "in-review").length,
      ready: scopedArtifacts.filter((artifact) => artifact.status === "ready").length
    },
    byType
  };
}

export function getForgeBlocks(snapshot: ForgeSnapshot, controlPlane: ForgeControlPlane) {
  return {
    projectOverview: getProjectOverviewBlock(snapshot),
    executionStatus: getExecutionStatusBlock(controlPlane),
    readiness: getReadinessBlock(controlPlane),
    artifactsSummary: getArtifactsSummaryBlock(snapshot)
  };
}
