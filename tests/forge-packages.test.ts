import { describe, expect, test } from "vitest";

async function safeImport<T>(loader: () => Promise<T>) {
  try {
    return await loader();
  } catch {
    return null;
  }
}

describe("forge package boundaries", () => {
  test("core package exposes forge types and selectors", async () => {
    const module = await safeImport(() => import("../packages/core/src/index"));

    expect(module).toBeTruthy();
    expect(module).toHaveProperty("getActiveProject");
    expect(module).toHaveProperty("getDeliveryStateLabel");
  });

  test("db package exposes dashboard persistence services", async () => {
    const module = await safeImport(() => import("../packages/db/src/index"));

    expect(module).toBeTruthy();
    expect(module).toHaveProperty("ensureForgeDatabase");
    expect(module).toHaveProperty("loadDashboardSnapshot");
    expect(module).toHaveProperty("createProject");
  });

  test("ai package exposes Forge AI service entry points", async () => {
    const module = await safeImport(() => import("../packages/ai/src/index"));

    expect(module).toBeTruthy();
    expect(module).toHaveProperty("getSnapshotForAI");
    expect(module).toHaveProperty("createProjectForAI");
    expect(module).toHaveProperty("generatePrdDraftForAI");
  });
});
