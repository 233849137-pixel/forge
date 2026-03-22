import { resolveForgePrimaryView } from "./forge-views";
import type {
  ForgeArtifactsPageData,
  ForgeAssetsPageData,
  ForgeGovernancePageData,
  ForgeHomePageData,
  ForgeProjectsPageData,
  ForgeTeamPageData
} from "../server/forge-page-dtos";
import type { ForgeExecutionPageData } from "./forge-execution-page-data";

export const FORGE_PAGE_CONTRACT_VERSION = "2026-03-15.phase-1";

export const forgeStablePageViews = [
  "home",
  "projects",
  "team",
  "artifacts",
  "assets",
  "execution",
  "governance"
] as const;

export type ForgeStablePageView = (typeof forgeStablePageViews)[number];

export type ForgeStablePageMap = {
  home: ForgeHomePageData;
  projects: ForgeProjectsPageData;
  team: ForgeTeamPageData;
  artifacts: ForgeArtifactsPageData;
  assets: ForgeAssetsPageData;
  execution: ForgeExecutionPageData;
  governance: ForgeGovernancePageData;
};

export type ForgeStablePageContract<V extends ForgeStablePageView = ForgeStablePageView> = {
  view: V;
  contractVersion: typeof FORGE_PAGE_CONTRACT_VERSION;
  page: ForgeStablePageMap[V];
};

export function resolveForgeStablePageView(value: string): ForgeStablePageView | null {
  const resolved = resolveForgePrimaryView(value);

  if (!resolved) {
    return null;
  }

  return forgeStablePageViews.includes(resolved as ForgeStablePageView)
    ? (resolved as ForgeStablePageView)
    : null;
}
