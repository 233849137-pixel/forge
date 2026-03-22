"use client";

import React, { startTransition, useEffect, useState } from "react";
import { executeForgeCommand, sendForgeWorkbenchChatMessage } from "../lib/forge-command-api";
import {
  activateForgeProject,
  createForgeProject,
  generateForgePrdDraft,
  saveForgeProjectWorkbenchState
} from "../lib/forge-project-api";
import type { ForgeProjectsPageData } from "../server/forge-page-dtos";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import ForgeProjectsPage from "./forge-projects-page";

export default function ForgeProjectsPageBridge({
  initialData,
  initialNode,
  initialProjectId,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeProjectsPageData;
  initialNode?: string;
  initialProjectId?: string;
  showNavigation?: boolean;
  enableLiveSync?: boolean;
}) {
  const [pageData, setPageData] = useState(initialData);

  useEffect(() => {
    if (!enableLiveSync) {
      return;
    }

    let cancelled = false;

    async function refreshPage() {
      if (cancelled) {
        return;
      }

      try {
        const contract = await fetchForgePageContract("projects");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good projects page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("projects", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return (
    <ForgeProjectsPage
      activateWorkbenchProject={activateForgeProject}
      createWorkbenchProject={createForgeProject}
      data={pageData}
      executeWorkbenchCommand={executeForgeCommand}
      generateWorkbenchPrd={generateForgePrdDraft}
      initialNode={initialNode}
      initialProjectId={initialProjectId}
      saveProjectWorkbenchState={saveForgeProjectWorkbenchState}
      sendWorkbenchChatMessage={sendForgeWorkbenchChatMessage}
      showNavigation={showNavigation}
    />
  );
}
