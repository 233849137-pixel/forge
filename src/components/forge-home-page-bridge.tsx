"use client";

import React, { startTransition, useEffect, useState } from "react";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import {
  createForgeProject,
  deleteForgeProject,
  updateForgeProject
} from "../lib/forge-project-api";
import type { ForgeHomePageData } from "../server/forge-page-dtos";
import ForgeHomePage from "./forge-home-page";

export default function ForgeHomePageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeHomePageData;
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
        const contract = await fetchForgePageContract("home");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good home page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("home", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return (
    <ForgeHomePage
      createWorkbenchProject={createForgeProject}
      data={pageData}
      deleteWorkbenchProject={deleteForgeProject}
      showNavigation={showNavigation}
      updateWorkbenchProject={updateForgeProject}
    />
  );
}
