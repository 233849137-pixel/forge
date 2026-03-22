# Forge Kimi Coding Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OpenClaw-style `kimi-coding` support to Forge's independent model gateway so system settings, project workbench model selection, and real command execution can use the working Kimi Coding API path.

**Architecture:** Extend Forge's existing local model-provider system with a fifth provider, `kimi-coding`, that uses the Anthropic-style messages API at `https://api.kimi.com/coding/v1/messages`. Keep all config storage in Forge's own SQLite `app_state`, surface the provider in the shared system settings dialog, and route workbench model execution through the existing model-gateway abstraction without introducing any runtime dependency on OpenClaw.

**Tech Stack:** TypeScript, Next.js route handlers, React client UI, Vitest, better-sqlite3

---

### Task 1: Add failing gateway tests for `kimi-coding`

**Files:**
- Modify: `tests/forge-model-gateway.test.ts`

**Step 1: Write the failing test**

Add tests that:
- Expect the provider catalog to include `kimi-coding`
- Expect `resolveModelGatewaySelection("k2p5", ...)` to resolve to `kimi-coding`
- Expect connection tests for `kimi-coding` to call `https://api.kimi.com/coding/v1/messages` with `x-api-key`, `anthropic-version`, and `user-agent`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-model-gateway.test.ts`

Expected: FAIL because `kimi-coding` does not exist in the current provider union/catalog.

**Step 3: Write minimal implementation**

Update the model gateway and provider-id types just enough to satisfy the new catalog and request-shape tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-model-gateway.test.ts`

Expected: PASS

### Task 2: Add failing API and page-data tests for provider visibility

**Files:**
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `tests/forge-page-data.test.ts`

**Step 1: Write the failing test**

Add tests that:
- Expect `/api/forge/model-providers` to return five providers including `kimi-coding`
- Expect saving and testing `kimi-coding` settings to persist and call the correct endpoint
- Expect `pages.projects.availableModelOptions` and `modelProviderSummary` to include configured `k2p5`

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-page-data.test.ts`

Expected: FAIL because the provider is not yet exposed through API/storage/page DTOs.

**Step 3: Write minimal implementation**

Wire `kimi-coding` through provider settings persistence and page DTO model-option generation.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-page-data.test.ts`

Expected: PASS

### Task 3: Add failing execution-routing tests for real workbench use

**Files:**
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-projects-page.test.tsx`

**Step 1: Write the failing test**

Add tests that:
- Expect `executeCommandWithModelForAI()` to resolve `k2p5` to the `kimi-coding` provider and attach `modelExecution`
- Expect the projects workbench to render a `Kimi Coding` reply when the selected model is `k2p5`

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-projects-page.test.tsx`

Expected: FAIL because the execution path does not yet recognize `kimi-coding`.

**Step 3: Write minimal implementation**

Hook the new provider into selection resolution and execution result labeling.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-projects-page.test.tsx`

Expected: PASS

### Task 4: Surface `kimi-coding` in system settings UI

**Files:**
- Modify: `src/components/forge-system-settings.tsx`
- Modify: `tests/forge-console-shell.test.tsx`

**Step 1: Write the failing test**

Add a test that expects the system settings dialog to list `Kimi Coding` and show a Kimi Coding-specific API key label.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-console-shell.test.tsx`

Expected: FAIL because the provider rail and guide copy only cover the existing four providers.

**Step 3: Write minimal implementation**

Extend the provider avatar/guide maps and default selected-provider handling.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-console-shell.test.tsx`

Expected: PASS

### Task 5: Verify the integrated slice

**Files:**
- No code changes expected unless failures appear

**Step 1: Run focused regression**

Run:
`npm test -- tests/forge-model-gateway.test.ts tests/forge-api-routes.test.ts tests/forge-page-data.test.ts tests/forge-ai.test.ts tests/forge-projects-page.test.tsx tests/forge-console-shell.test.tsx`

Expected: PASS

**Step 2: Run broader suite if the focused slice is green**

Run: `npm test`

Expected: PASS, or capture any unrelated failures separately.
