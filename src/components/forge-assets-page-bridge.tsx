"use client";

import React, { startTransition, useEffect, useState } from "react";
import type { ForgeAssetsPageData } from "./forge-assets-page.types";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import ForgeAssetsPage from "./forge-assets-page";

export default function ForgeAssetsPageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeAssetsPageData;
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
        const contract = await fetchForgePageContract("assets");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good assets page contract when refresh fails.
      }
    }

    const unsubscribe = subscribeForgePageContractRefresh("assets", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enableLiveSync]);

  return <ForgeAssetsPage data={pageData} showNavigation={showNavigation} />;
}
