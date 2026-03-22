"use client";

import React, { startTransition, useEffect, useState } from "react";
import type { ForgeExecutionPageData } from "../lib/forge-execution-page-data";
import { fetchForgePageContract } from "../lib/forge-page-api";
import { subscribeForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import ForgeExecutionPage from "./forge-execution-page";

const EXECUTION_PAGE_REFRESH_INTERVAL_MS = 60_000;

export default function ForgeExecutionPageBridge({
  initialData,
  showNavigation = false,
  enableLiveSync = process.env.NODE_ENV !== "test"
}: {
  initialData: ForgeExecutionPageData;
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
        const contract = await fetchForgePageContract("execution");
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setPageData(contract.page);
        });
      } catch {
        // Keep the last known-good execution page contract when refresh fails.
      }
    }

    const timer = window.setInterval(() => {
      void refreshPage();
    }, EXECUTION_PAGE_REFRESH_INTERVAL_MS);
    const unsubscribe = subscribeForgePageContractRefresh("execution", () => {
      void refreshPage();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [enableLiveSync]);

  return <ForgeExecutionPage data={pageData} showNavigation={showNavigation} />;
}
