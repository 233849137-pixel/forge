import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseQaRunnerArgs, runQaVerification } from "../scripts/lib/forge-qa-runner.mjs";

describe("forge qa runner", () => {
  it("parses project, workspace and strict mode flags", () => {
    const parsed = parseQaRunnerArgs([
      "--project-id",
      "retail-support",
      "--workspace",
      "/tmp/workspace",
      "--taskpack-id",
      "artifact-taskpack-retail-support",
      "--component-ids",
      "component-payment-checkout",
      "--strict-playwright",
      "--execute-if-ready"
    ]);

    expect(parsed.projectId).toBe("retail-support");
    expect(parsed.workspace).toBe("/tmp/workspace");
    expect(parsed.taskpackId).toBe("artifact-taskpack-retail-support");
    expect(parsed.componentIds).toBe("component-payment-checkout");
    expect(parsed.strictPlaywright).toBe(true);
    expect(parsed.executeIfReady).toBe(true);
    expect(parsed.baseUrl).toBe("http://127.0.0.1:3000");
  });

  it("fails clearly when workspace is missing", async () => {
    const result = await runQaVerification({
      projectId: "retail-support",
      workspace: "/tmp/missing-workspace",
      baseUrl: "http://127.0.0.1:3000",
      strictPlaywright: false
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("工作区不存在");
  });

  it("reports missing playwright in strict mode", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "forge-qa-runner-"));

    try {
      const result = await runQaVerification({
        projectId: "retail-support",
        workspace,
        taskpackId: "artifact-taskpack-retail-support",
        componentIds: "component-payment-checkout",
        baseUrl: "http://127.0.0.1:3000",
        strictPlaywright: true
      });

      expect(result.ok).toBe(false);
      expect(result.mode).toBe("contract-check");
      expect(result.summary).toContain("未检测到 Playwright");
      expect(result.evidenceStatus).toBe("contract");
      expect(result.evidenceLabel).toBe("合同模式");
      expect(result.executedCommand).toBeNull();
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("contract");
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  it("switches to playwright-ready mode when playwright is available", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "forge-qa-runner-"));

    try {
      const result = await runQaVerification(
        {
          projectId: "retail-support",
          workspace,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          baseUrl: "http://127.0.0.1:3000",
          strictPlaywright: true
        },
        {
          detectPlaywrightInfo: () => ({
            path: "/tmp/node_modules/.bin/playwright",
            version: "Version 1.55.0"
          })
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("playwright-ready");
      expect(result.summary).toContain("Playwright");
      expect(result.summary).toContain("1.55.0");
      expect(result.evidenceStatus).toBe("tool-ready");
      expect(result.evidenceLabel).toBe("工具就绪");
      expect(result.executedCommand).toBeNull();
      expect(result.checks.find((check) => check.name === "taskpack")?.summary).toContain(
        "artifact-taskpack-retail-support"
      );
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "playwright")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "playwright")?.summary).toContain("1.55.0");
      expect(result.checks.find((check) => check.name === "execution-plan")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("tool-ready");
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  it("executes a real playwright command when requested and configuration exists", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "forge-qa-runner-"));

    try {
      const result = await runQaVerification(
        {
          projectId: "retail-support",
          workspace,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          baseUrl: "http://127.0.0.1:3000",
          strictPlaywright: true,
          executeIfReady: true,
          testCommand: "node -e \"process.stdout.write('ok')\""
        },
        {
          detectPlaywrightInfo: () => ({
            path: "/tmp/node_modules/.bin/playwright",
            version: "Version 1.55.0"
          }),
          executeCommand: async (command) => ({
            ok: true,
            exitCode: 0,
            stdout: command.join(" "),
            stderr: ""
          })
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("playwright-executed");
      expect(result.summary).toContain("已执行");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.evidenceLabel).toBe("已执行");
      expect(result.executedCommand).toBe("node -e process.stdout.write('ok')");
      expect(result.checks.find((check) => check.name === "taskpack")?.summary).toContain(
        "artifact-taskpack-retail-support"
      );
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "execution")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("executed");
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });
});
