"use client";

import React, { startTransition, useEffect, useState } from "react";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import {
  saveForgeAgentProfile,
  saveForgeTeamWorkbenchState
} from "../lib/forge-team-api";
import type { ForgeTeamPageData } from "../server/forge-page-dtos";
import AgentTeamPage from "./agent-team-page";

export default function ForgeTeamPageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeTeamPageData;
  showNavigation?: boolean;
  enableLiveSync?: boolean;
}) {
  const [pageData, setPageData] = useState(initialData);
  const [pageRevision, setPageRevision] = useState(0);

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
        const contract = await fetchForgePageContract("team");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
          setPageRevision((current) => current + 1);
        });
      } catch {
        // Keep the last known-good team page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("team", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return (
    <AgentTeamPage
      key={pageRevision}
      data={pageData}
      saveAgentProfile={saveForgeAgentProfile}
      saveTeamWorkbenchState={saveForgeTeamWorkbenchState}
      showNavigation={showNavigation}
    />
  );
}
