"use client";

import React, { startTransition, useEffect, useState } from "react";
import type { ForgeGovernancePageData } from "../server/forge-page-dtos";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import ForgeGovernancePage from "./forge-governance-page";

export default function ForgeGovernancePageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeGovernancePageData;
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
        const contract = await fetchForgePageContract("governance");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good governance page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("governance", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return <ForgeGovernancePage data={pageData} showNavigation={showNavigation} />;
}
