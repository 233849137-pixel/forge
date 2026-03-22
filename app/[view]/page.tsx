import React from "react";
import { notFound } from "next/navigation";
import ForgeTeamPageBridge from "../../src/components/agent-team-page-bridge";
import ForgeArtifactsPageBridge from "../../src/components/forge-artifacts-page-bridge";
import ForgeAssetsPageBridge from "../../src/components/forge-assets-page-bridge";
import ForgeExecutionPageBridge from "../../src/components/forge-execution-page-bridge";
import ForgeGovernancePageBridge from "../../src/components/forge-governance-page-bridge";
import ForgeHomePageBridge from "../../src/components/forge-home-page-bridge";
import ForgeProjectsPageBridge from "../../src/components/forge-projects-page-bridge";
import { resolveForgeStablePageView } from "../../src/lib/forge-page-contract";
import { resolveForgePrimaryView } from "../../src/lib/forge-views";
import { getForgeStablePageContract } from "../../src/server/forge-page-data";

export const dynamic = "force-dynamic";

function readSingleSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgeStagePage({
  params,
  searchParams
}: {
  params: Promise<{ view: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const resolvedView = resolveForgePrimaryView(view);

  if (!resolvedView) {
    notFound();
  }

  const stableView = resolveForgeStablePageView(view);

  if (!stableView) {
    notFound();
  }

  const contract = getForgeStablePageContract(stableView);

  switch (resolvedView) {
    case "home":
      return (
        <ForgeHomePageBridge
          initialData={contract.page as React.ComponentProps<typeof ForgeHomePageBridge>["initialData"]}
          showNavigation
        />
      );
    case "projects":
      return (
        <ForgeProjectsPageBridge
          initialData={
            contract.page as React.ComponentProps<typeof ForgeProjectsPageBridge>["initialData"]
          }
          initialNode={readSingleSearchParam(resolvedSearchParams.node)}
          initialProjectId={readSingleSearchParam(resolvedSearchParams.projectId)}
          showNavigation
        />
      );
    case "team":
      return (
        <ForgeTeamPageBridge
          initialData={contract.page as React.ComponentProps<typeof ForgeTeamPageBridge>["initialData"]}
          showNavigation
        />
      );
    case "artifacts":
      return (
        <ForgeArtifactsPageBridge
          initialData={
            contract.page as React.ComponentProps<typeof ForgeArtifactsPageBridge>["initialData"]
          }
          showNavigation
        />
      );
    case "execution":
      return (
        <ForgeExecutionPageBridge
          initialData={
            contract.page as React.ComponentProps<typeof ForgeExecutionPageBridge>["initialData"]
          }
          showNavigation
        />
      );
    case "assets":
      return (
        <ForgeAssetsPageBridge
          initialData={contract.page as React.ComponentProps<typeof ForgeAssetsPageBridge>["initialData"]}
          showNavigation
        />
      );
    case "governance":
      return (
        <ForgeGovernancePageBridge
          initialData={
            contract.page as React.ComponentProps<typeof ForgeGovernancePageBridge>["initialData"]
          }
          showNavigation
        />
      );
    default:
      notFound();
  }
}
