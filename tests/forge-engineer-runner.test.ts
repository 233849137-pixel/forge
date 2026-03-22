import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  parseEngineerRunnerArgs,
  runEngineerExecution
} from "../scripts/lib/forge-engineer-runner.mjs";

describe("forge engineer runner", () => {
  it("parses engineer runner arguments", () => {
    const args = parseEngineerRunnerArgs([
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

  it("fails when the engineer workspace is missing", async () => {
    const result = await runEngineerExecution({
      projectId: "retail-support",
      workspace: "/definitely/missing/workspace",
      taskpack: "latest"
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("工作区不存在");
  });

  it("returns a contract execution summary when the workspace exists", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support"
          ,
          componentIds: "component-payment-checkout,component-auth-email"
        },
        {
          detectExecutable: () => null
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("contract-execution");
      expect(result.evidenceStatus).toBe("contract");
      expect(result.evidenceLabel).toBe("合同模式");
      expect(result.summary).toContain("artifact-taskpack-retail-support");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("contract");
      expect(result.checks.map((check) => check.name)).toEqual(
        expect.arrayContaining(["workspace", "taskpack", "components", "execution-policy", "evidence"])
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("switches to codex-ready mode when codex is available locally", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout"
        },
        {
          detectExecutableInfo: (command) =>
            command === "codex"
              ? { path: "/usr/local/bin/codex", version: "codex 0.42.0" }
              : null
        }
      );

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("codex-ready");
      expect(result.evidenceStatus).toBe("tool-ready");
      expect(result.evidenceLabel).toBe("工具就绪");
      expect(result.summary).toContain("Codex");
      expect(result.summary).toContain("0.42.0");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("tool-ready");
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "codex")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "codex")?.summary).toContain("0.42.0");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes a real engineer command when requested", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          executeIfReady: true,
          executeCommand: "node -e \"process.stdout.write('engineer')\""
        },
        {
          detectExecutableInfo: (command) =>
            command === "codex"
              ? { path: "/usr/local/bin/codex", version: "codex 0.42.0" }
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
      expect(result.mode).toBe("codex-executed");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.evidenceLabel).toBe("已执行");
      expect(result.executedCommand).toBe("node -e process.stdout.write('engineer')");
      expect(result.summary).toContain("已执行");
      expect(result.checks.find((check) => check.name === "evidence")?.status).toBe("executed");
      expect(result.checks.find((check) => check.name === "components")?.summary).toContain(
        "component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "execution")?.status).toBe("pass");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prefers configured external model execution when available", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          executeIfReady: true
        },
        {
          detectExternalExecutionCapability: () => ({
            provider: "Claude Code",
            command: [
              "node",
              "-e",
              "process.stdout.write('external-engineer')",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}",
              "--components",
              "{componentIds}"
            ],
            binaryPath: "/usr/local/bin/claude",
            version: "claude 2.1.34",
            source: "FORGE_ENGINEER_EXEC_COMMAND"
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
      expect(result.mode).toBe("codex-executed");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.executedCommand).toBe(
        "node -e process.stdout.write('external-engineer') --project retail-support --taskpack artifact-taskpack-retail-support --components component-payment-checkout"
      );
      expect(result.checks.find((check) => check.name === "model-execution")?.status).toBe("pass");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain("Claude Code");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain("2.1.34");
      expect(result.checks.find((check) => check.name === "model-execution")?.summary).toContain(
        "FORGE_ENGINEER_EXEC_COMMAND"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("routes execution through the configured backend command when present", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support",
          componentIds: "component-payment-checkout",
          executeIfReady: true
        },
        {
          detectExternalExecutionCapability: () => ({
            provider: "Claude Code",
            backend: "OpenClaw",
            command: [
              "claude",
              "exec",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}"
            ],
            backendCommand: [
              "openclaw",
              "run",
              "--project",
              "{projectId}",
              "--taskpack",
              "{taskPackId}",
              "--provider",
              "{provider}"
            ],
            backendCommandSource: "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
            backendBinaryPath: "/usr/local/bin/openclaw",
            backendVersion: "openclaw 0.9.0",
            binaryPath: "/usr/local/bin/claude",
            version: "claude 2.1.34",
            source: "FORGE_ENGINEER_EXEC_COMMAND"
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
        "openclaw run --project retail-support --taskpack artifact-taskpack-retail-support --provider Claude Code"
      );
      expect(result.summary).toContain("OpenClaw");
      expect(result.checks.find((check) => check.name === "execution")?.summary).toContain("OpenClaw");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("treats the global NanoClaw manager as engineer-ready when no lane-specific command is configured", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-engineer-runner-"));

    try {
      const result = await runEngineerExecution(
        {
          projectId: "retail-support",
          workspace: directory,
          taskpackId: "artifact-taskpack-retail-support"
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
      expect(result.mode).toBe("codex-ready");
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
