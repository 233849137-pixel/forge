import React from "react";
import ForgeHomePageBridge from "../src/components/forge-home-page-bridge";
import { getForgeStablePageContract } from "../src/server/forge-page-data";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const contract = getForgeStablePageContract("home");

  return (
    <ForgeHomePageBridge
      initialData={contract.page}
      showNavigation
    />
  );
}
