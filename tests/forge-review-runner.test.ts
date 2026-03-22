import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  parseReviewRunnerArgs,
  runReviewVerification
} from "../scripts/lib/forge-review-runner.mjs";

describe("forge review runner", () => {
  it("parses review runner arguments", () => {
    const args = parseReviewRunnerArgs([
      "--project-id",
      "retail-support",
      "--workspace",
      "/tmp/forge/workspace",
      "--taskpack-id",
      "artifact-taskpack-retail-support",
      "--component-ids",
      "component-payment-checkout",
      "--artifact",
      "patch",
      "--execute-if-ready"
    ]);

    expect(args.projectId).toBe("retail-support");
    expect(args.workspace).toBe("/tmp/forge/workspace");
    expect(args.taskpackId).toBe("artifact-taskpack-retail-support");
    expect(args.componentIds).toBe("component-payment-checkout");
    expect(args.artifact).toBe("patch");
    expect(args.executeIfReady).toBe(true);
  });

  it("fails when the local workspace is missing", async () => {
    const result = await runReviewVerification({
      projectId: "retail-support",
      workspace: "/definitely/missing/workspace",
      artifact: "patch"
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("工作区不存在");
  });

  it("returns a contract review summary when the workspace exists", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          artifact: "patch"
        },
        {
          detectExecutable: () => null
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("contract-review");
      expect(result.evidenceStatus).toBe("contract");
      expect(result.evidenceLabel).toBe("合同模式");
      expect(result.summary).toContain("规则审查");
      expect(result.summary).toContain("artifact-taskpack-retail-support");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("contract");
      expect(result.checks.map((check) => check.name)).toEqual(
        expect.arrayContaining(["workspace", "taskpack", "components", "artifact", "review-policy", "evidence"])
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("switches to review-ready mode when git is available locally", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          artifact: "patch"
        },
        {
          detectExecutableInfo: (command) =>
            command === "git"
              ? { path: "/usr/bin/git", version: "git version 2.49.0" }
              : null
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("review-ready");
      expect(result.evidenceStatus).toBe("tool-ready");
      expect(result.evidenceLabel).toBe("工具就绪");
      expect(result.summary).toContain("git");
      expect(result.summary).toContain("2.49.0");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("tool-ready");
      expect(result.checks.find((check) => check.name === "taskpack")?.summary).toContain(
        "artifact-taskpack-retail-support"
      );
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "git")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "git")?.summary).toContain("2.49.0");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes a real review command when requested", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          artifact: "patch",
          executeIfReady: true,
          reviewCommand: "node -e \"process.stdout.write('review')\""
        },
        {
          detectExecutableInfo: (command) =>
            command === "git"
              ? { path: "/usr/bin/git", version: "git version 2.49.0" }
              : null,
          executeCommand: async (command) => ({
            ok: true,
            exitCode: 0,
            stdout: command.join(" "),
            stderr: ""
          })
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("review-executed");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.evidenceLabel).toBe("已执行");
      expect(result.executedCommand).toBe("node -e process.stdout.write('review')");
      expect(result.summary).toContain("已执行");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("executed");
      expect(result.checks.find((check) => check.name === "taskpack")?.summary).toContain(
        "artifact-taskpack-retail-support"
      );
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "execution")?.status).toBe("pass");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prefers configured external model execution when available", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          artifact: "patch",
          executeIfReady: true
        },
        {
          detectExternalExecutionCapability: () => ({
            provider: "Claude Code Review",
            command: [
              "node",
              "-e",
              "process.stdout.write('external-review')",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}",
              "--artifact",
              "{artifact}"
            ],
            binaryPath: "/usr/local/bin/claude",
            version: "claude 2.1.34",
            source: "FORGE_REVIEW_EXEC_COMMAND"
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
      expect(result.mode).toBe("review-executed");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.executedCommand).toBe(
        "node -e process.stdout.write('external-review') --project retail-support --taskpack artifact-taskpack-retail-support --artifact patch"
      );
      expect(result.checks.find((check) => check.name === "model-execution")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain("Claude Code Review");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain("2.1.34");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain(
        "FORGE_REVIEW_EXEC_COMMAND"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("routes review execution through the configured backend command when present", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          artifact: "patch",
          executeIfReady: true
        },
        {
          detectExternalExecutionCapability: () => ({
            provider: "Claude Code Review",
            backend: "OpenClaw",
            command: [
              "claude",
              "review",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}",
              "--artifact",
              "{artifact}"
            ],
            backendCommand: [
              "openclaw",
              "run-review",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}",
              "--artifact",
              "{artifact}",
              "--provider",
              "{provider}"
            ],
            backendCommandSource: "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
            backendBinaryPath: "/usr/local/bin/openclaw",
            backendVersion: "openclaw 0.9.0",
            binaryPath: "/usr/local/bin/claude",
            version: "claude 2.1.34",
            source: "FORGE_REVIEW_EXEC_COMMAND"
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
      expect(result.executedCommand).toBe(
        "openclaw run-review --project retail-support --taskpack artifact-taskpack-retail-support --artifact patch --provider Claude Code Review"
      );
      expect(result.summary).toContain("OpenClaw");
      expect(result.checks.find((check) => check.name === "execution")?.summary).toContain("OpenClaw");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("treats the global NanoClaw manager as review-ready when no lane-specific command is configured", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-review-runner-"));

    try {
      const result = await runReviewVerification(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          artifact: "patch"
        },
        {
          env: {
            FORGE_NANO_EXEC_PROVIDER: "Nano CEO",
            FORGE_NANO_EXEC_BACKEND: "NanoClaw"
          },
          detectExecutable: (command) => {
            if (command === "node") {
              return "/usr/local/bin/node";
            }

            return null;
          },
          detectBinaryVersion: (binaryPath) => {
            if (binaryPath === "/usr/local/bin/node") {
              return "node v24.1.0";
            }

            return null;
          }
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("review-ready");
      expect(result.executionProvider).toBe("Nano CEO");
      expect(result.executionBackend).toBe("NanoClaw");
      expect(result.executionSource).toBe("internal-default:nanoclaw-manager");
      expect(result.summary).toContain("Nano CEO");
      expect(result.summary).toContain("NanoClaw");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
