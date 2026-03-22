import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  parseArchitectRunnerArgs,
  runArchitectAssembly
} from "../scripts/lib/forge-architect-runner.mjs";

describe("forge architect runner", () => {
  it("parses architect runner arguments", () => {
    const args = parseArchitectRunnerArgs([
      "--project-id",
      "retail-support",
      "--workspace",
      "/tmp/forge/workspace",
      "--taskpack-id",
      "artifact-taskpack-retail-support",
      "--component-ids",
      "component-payment-checkout,component-auth-email",
      "--execute-if-ready"
    ]);

    expect(args.projectId).toBe("retail-support");
    expect(args.workspace).toBe("/tmp/forge/workspace");
    expect(args.taskpackId).toBe("artifact-taskpack-retail-support");
    expect(args.componentIds).toBe("component-payment-checkout,component-auth-email");
    expect(args.executeIfReady).toBe(true);
  });

  it("fails clearly when workspace is missing", async () => {
    const result = await runArchitectAssembly({
      projectId: "retail-support",
      workspace: "/definitely/missing/workspace",
      taskpackId: "artifact-taskpack-retail-support"
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("工作区不存在");
  });

  it("returns a contract assembly summary when the workspace exists", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-architect-runner-"));

    try {
      const result = await runArchitectAssembly({
        projectId: "retail-support",
        workspace: directory,
        taskpackId: "artifact-taskpack-retail-support",
        componentIds: "component-payment-checkout,component-auth-email"
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("assembly-ready");
      expect(result.summary).toContain("artifact-taskpack-retail-support");
      expect(result.checks.map((check) => check.name)).toEqual(
        expect.arrayContaining(["workspace", "taskpack", "components", "assembly-policy"])
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes a real assembly command when requested", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-architect-runner-"));

    try {
      const result = await runArchitectAssembly(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          executeIfReady: true,
          assembleCommand: "node -e \"process.stdout.write('assembly')\""
        },
        {
          executeCommand: async (command) => ({
            ok: true,
            exitCode: 0,
            stdout: command.join(" "),
            stderr: ""
          })
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("assembly-executed");
      expect(result.summary).toContain("已执行");
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "execution")?.status).toBe("pass");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
