import {
  getControlPlaneSnapshotForAI,
  getModelProviderSettingsForAI
} from "../../packages/ai/src";
import { getForgeResolvedDataSource, loadDashboardSnapshot } from "../../packages/db/src";
import {
  FORGE_PAGE_CONTRACT_VERSION,
  type ForgeStablePageContract,
  type ForgeStablePageMap,
  type ForgeStablePageView
} from "../lib/forge-page-contract";
import { getForgeBlocks } from "./forge-block-data";
import {
  getForgeArtifactsPageData,
  getForgeAssetsPageData,
  getForgeExecutionPageData,
  getForgeGovernancePageData,
  getForgeHomePageData,
  getForgePages,
  getForgeProjectsPageData,
  getForgeTeamPageData
} from "./forge-page-dtos";
import { hydrateSnapshotWithRealSkills } from "./forge-real-skills";

function getBaseForgeSnapshot(dbPath?: string) {
  return loadDashboardSnapshot(dbPath);
}

function getHydratedForgeSnapshot(dbPath?: string) {
  const snapshot = getBaseForgeSnapshot(dbPath);

  try {
    return hydrateSnapshotWithRealSkills(snapshot);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[forge] Failed to hydrate the dashboard snapshot with local skill data; using the internal snapshot instead. ${message}`
      );
    }

    return snapshot;
  }
}

function getForgeSnapshotForView(view: ForgeStablePageView, dbPath?: string) {
  if (view === "home") {
    return getBaseForgeSnapshot(dbPath);
  }

  return getHydratedForgeSnapshot(dbPath);
}

function getForgeActiveProjectId(snapshot: ReturnType<typeof getHydratedForgeSnapshot>) {
  return snapshot.activeProjectId ?? snapshot.projects[0]?.id;
}

function getForgeControlPlaneForSnapshot(
  snapshot: ReturnType<typeof getHydratedForgeSnapshot>,
  dbPath?: string
) {
  return getControlPlaneSnapshotForAI({ projectId: getForgeActiveProjectId(snapshot) }, dbPath);
}

export function getForgePageDataForView<V extends ForgeStablePageView>(
  view: V,
  dbPath?: string
): ForgeStablePageMap[V] {
  const snapshot = getForgeSnapshotForView(view, dbPath);
  const dataModePresentation = getForgeResolvedDataSource(dbPath);

  switch (view) {
    case "home":
      return getForgeHomePageData(snapshot, dataModePresentation) as ForgeStablePageMap[V];
    case "projects": {
      const controlPlane = getForgeControlPlaneForSnapshot(snapshot, dbPath);
      const modelProviders = getModelProviderSettingsForAI(dbPath).providers;

      return getForgeProjectsPageData(
        snapshot,
        controlPlane,
        modelProviders,
        dataModePresentation
      ) as ForgeStablePageMap[V];
    }
    case "team": {
      const controlPlane = getForgeControlPlaneForSnapshot(snapshot, dbPath);
      return getForgeTeamPageData(snapshot, controlPlane) as ForgeStablePageMap[V];
    }
    case "artifacts":
      return getForgeArtifactsPageData(snapshot) as ForgeStablePageMap[V];
    case "assets":
      return getForgeAssetsPageData(snapshot, undefined, dbPath) as ForgeStablePageMap[V];
    case "execution": {
      const controlPlane = getForgeControlPlaneForSnapshot(snapshot, dbPath);
      return getForgeExecutionPageData(snapshot, controlPlane) as ForgeStablePageMap[V];
    }
    case "governance": {
      const controlPlane = getForgeControlPlaneForSnapshot(snapshot, dbPath);
      return getForgeGovernancePageData(snapshot, controlPlane) as ForgeStablePageMap[V];
    }
  }
}

export function getForgeStablePageContract<V extends ForgeStablePageView>(
  view: V,
  dbPath?: string
): ForgeStablePageContract<V> {
  return {
    view,
    contractVersion: FORGE_PAGE_CONTRACT_VERSION,
    page: getForgePageDataForView(view, dbPath)
  };
}

export function getForgePageContext(dbPath?: string) {
  const snapshot = getHydratedForgeSnapshot(dbPath);
  const controlPlane = getForgeControlPlaneForSnapshot(snapshot, dbPath);
  const modelProviders = getModelProviderSettingsForAI(dbPath).providers;
  const dataModePresentation = getForgeResolvedDataSource(dbPath);

  return {
    snapshot,
    controlPlane,
    blocks: getForgeBlocks(snapshot, controlPlane),
    pages: getForgePages(snapshot, controlPlane, modelProviders, dbPath, dataModePresentation)
  };
}
