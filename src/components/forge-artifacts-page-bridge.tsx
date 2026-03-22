"use client";

import React, { startTransition, useEffect, useState } from "react";
import type { ForgeArtifactsPageData } from "../server/forge-page-dtos";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import ForgeArtifactsPage from "./forge-artifacts-page";

export default function ForgeArtifactsPageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeArtifactsPageData;
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
        const contract = await fetchForgePageContract("artifacts");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good artifacts page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("artifacts", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return <ForgeArtifactsPage data={pageData} showNavigation={showNavigation} />;
}
