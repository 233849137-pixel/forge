import { describe, expect, it } from "vitest";
import { detectExternalExecutionCapability } from "../scripts/lib/runtime-capability-detect.mjs";

describe("runtime capability detect", () => {
  it("reads the pm external execution contract from env-like input", () => {
    const result = detectExternalExecutionCapability(
      "pm",
      {
        FORGE_PM_EXEC_COMMAND: 'forge ceo --project "{projectId}" --stage "{stage}"',
        FORGE_PM_EXEC_PROVIDER: "Forge CEO",
        FORGE_PM_EXEC_BACKEND: "NanoClaw",
        FORGE_PM_EXEC_BACKEND_COMMAND:
          'nanoclaw run-ceo --project "{projectId}" --stage "{stage}" --agent "{agentId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "forge") {
            return "/usr/local/bin/forge";
          }

          if (command === "nanoclaw") {
            return "/usr/local/bin/nanoclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/forge") {
            return "forge-cli 0.3.0";
          }

          if (binaryPath === "/usr/local/bin/nanoclaw") {
            return "nanoclaw 0.2.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "pm-execution-backend",
      kind: "pm",
      label: "CEO总控",
      command: ["forge", "ceo", "--project", "{projectId}", "--stage", "{stage}"],
      provider: "Forge CEO",
      backend: "NanoClaw",
      commandKey: "FORGE_PM_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "nanoclaw",
        "run-ceo",
        "--project",
        "{projectId}",
        "--stage",
        "{stage}",
        "--agent",
        "{agentId}",
        "--provider",
        "{provider}"
      ],
      backendCommandSource: "FORGE_PM_EXEC_BACKEND_COMMAND",
      backendBinaryPath: "/usr/local/bin/nanoclaw",
      backendVersion: "nanoclaw 0.2.0",
      binaryPath: "/usr/local/bin/forge",
      version: "forge-cli 0.3.0",
      source: "FORGE_PM_EXEC_COMMAND"
    });
  });

  it("reads the engineer external execution contract from env-like input", () => {
    const result = detectExternalExecutionCapability(
      "engineer",
      {
        FORGE_ENGINEER_EXEC_COMMAND: 'claude exec --project "{projectId}" --taskpack "{taskPackId}"',
        FORGE_ENGINEER_EXEC_PROVIDER: "Claude Code",
        FORGE_ENGINEER_EXEC_BACKEND: "OpenClaw",
        FORGE_ENGINEER_EXEC_BACKEND_COMMAND:
          'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "claude") {
            return "/usr/local/bin/claude";
          }

          if (command === "openclaw") {
            return "/usr/local/bin/openclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/claude") {
            return "claude 2.1.34";
          }

          if (binaryPath === "/usr/local/bin/openclaw") {
            return "openclaw 0.9.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "engineer-execution-backend",
      kind: "engineer",
      label: "研发执行",
      command: ["claude", "exec", "--project", "{projectId}", "--taskpack", "{taskPackId}"],
      provider: "Claude Code",
      backend: "OpenClaw",
      commandKey: "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
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
    });
  });

  it("returns null when no external execution command is configured", () => {
    const result = detectExternalExecutionCapability("reviewer", {}, {});

    expect(result).toBeNull();
  });

  it("reads the reviewer external execution contract from the global NanoClaw manager config", () => {
    const result = detectExternalExecutionCapability(
      "reviewer",
      {
        FORGE_NANO_EXEC_PROVIDER: "Nano CEO",
        FORGE_NANO_EXEC_BACKEND: "NanoClaw",
        FORGE_NANO_EXEC_BACKEND_COMMAND:
          'nanoclaw manage --command "{commandType}" --project "{projectId}" --stage "{stage}" --taskpack "{taskPackId}" --agent "{agentId}" --controller "{controllerAgentId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "nanoclaw") {
            return "/usr/local/bin/nanoclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/nanoclaw") {
            return "nanoclaw 1.2.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "reviewer-execution-backend",
      kind: "reviewer",
      label: "规则审查",
      command: [
        "nanoclaw",
        "manage",
        "--command",
        "{commandType}",
        "--project",
        "{projectId}",
        "--stage",
        "{stage}",
        "--taskpack",
        "{taskPackId}",
        "--agent",
        "{agentId}",
        "--controller",
        "{controllerAgentId}",
        "--provider",
        "{provider}"
      ],
      provider: "Nano CEO",
      backend: "NanoClaw",
      commandKey: "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "nanoclaw",
        "manage",
        "--command",
        "{commandType}",
        "--project",
        "{projectId}",
        "--stage",
        "{stage}",
        "--taskpack",
        "{taskPackId}",
        "--agent",
        "{agentId}",
        "--controller",
        "{controllerAgentId}",
        "--provider",
        "{provider}"
      ],
      backendCommandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND",
      backendBinaryPath: "/usr/local/bin/nanoclaw",
      backendVersion: "nanoclaw 1.2.0",
      binaryPath: "/usr/local/bin/nanoclaw",
      version: "nanoclaw 1.2.0",
      source: "FORGE_NANO_EXEC_BACKEND_COMMAND"
    });
  });

  it("falls back to the built-in NanoClaw manager wrapper when only the global backend is configured", () => {
    const result = detectExternalExecutionCapability(
      "engineer",
      {
        FORGE_NANO_EXEC_PROVIDER: "Nano CEO",
        FORGE_NANO_EXEC_BACKEND: "NanoClaw"
      },
      {
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

    expect(result).toEqual({
      id: "engineer-execution-backend",
      kind: "engineer",
      label: "研发执行",
      command: [
        "node",
        "{repoRoot}/scripts/forge-nanoclaw-manager.mjs",
        "--command",
        "{commandType}",
        "--project-id",
        "{projectId}",
        "--stage",
        "{stage}",
        "--taskpack-id",
        "{taskPackId}",
        "--agent-id",
        "{agentId}",
        "--controller-id",
        "{controllerAgentId}",
        "--provider",
        "{provider}",
        "--workspace",
        "{cwd}"
      ],
      provider: "Nano CEO",
      backend: "NanoClaw",
      commandKey: "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "node",
        "{repoRoot}/scripts/forge-nanoclaw-manager.mjs",
        "--command",
        "{commandType}",
        "--project-id",
        "{projectId}",
        "--stage",
        "{stage}",
        "--taskpack-id",
        "{taskPackId}",
        "--agent-id",
        "{agentId}",
        "--controller-id",
        "{controllerAgentId}",
        "--provider",
        "{provider}",
        "--workspace",
        "{cwd}"
      ],
      backendCommandSource: "internal-default:nanoclaw-manager",
      backendBinaryPath: "/usr/local/bin/node",
      backendVersion: "node v24.1.0",
      binaryPath: "/usr/local/bin/node",
      version: "node v24.1.0",
      source: "internal-default:nanoclaw-manager"
    });
  });

  it("reads the qa external execution contract from env-like input", () => {
    const result = detectExternalExecutionCapability(
      "qa",
      {
        FORGE_QA_EXEC_COMMAND: 'claude gate --project "{projectId}" --taskpack "{taskPackId}"',
        FORGE_QA_EXEC_PROVIDER: "Claude Code QA",
        FORGE_QA_EXEC_BACKEND: "OpenClaw",
        FORGE_QA_EXEC_BACKEND_COMMAND:
          'openclaw run-gate --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "claude") {
            return "/usr/local/bin/claude";
          }

          if (command === "openclaw") {
            return "/usr/local/bin/openclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/claude") {
            return "claude 2.1.34";
          }

          if (binaryPath === "/usr/local/bin/openclaw") {
            return "openclaw 0.9.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "qa-execution-backend",
      kind: "qa",
      label: "测试门禁",
      command: ["claude", "gate", "--project", "{projectId}", "--taskpack", "{taskPackId}"],
      provider: "Claude Code QA",
      backend: "OpenClaw",
      commandKey: "FORGE_QA_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "openclaw",
        "run-gate",
        "--project",
        "{projectId}",
        "--taskpack",
        "{taskPackId}",
        "--provider",
        "{provider}"
      ],
      backendCommandSource: "FORGE_QA_EXEC_BACKEND_COMMAND",
      backendBinaryPath: "/usr/local/bin/openclaw",
      backendVersion: "openclaw 0.9.0",
      binaryPath: "/usr/local/bin/claude",
      version: "claude 2.1.34",
      source: "FORGE_QA_EXEC_COMMAND"
    });
  });

  it("reads the release external execution contract from env-like input", () => {
    const result = detectExternalExecutionCapability(
      "release",
      {
        FORGE_RELEASE_EXEC_COMMAND:
          'claude release --project "{projectId}" --taskpack "{taskPackId}"',
        FORGE_RELEASE_EXEC_PROVIDER: "Claude Code Release",
        FORGE_RELEASE_EXEC_BACKEND: "OpenClaw",
        FORGE_RELEASE_EXEC_BACKEND_COMMAND:
          'openclaw run-release --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "claude") {
            return "/usr/local/bin/claude";
          }

          if (command === "openclaw") {
            return "/usr/local/bin/openclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/claude") {
            return "claude 2.1.34";
          }

          if (binaryPath === "/usr/local/bin/openclaw") {
            return "openclaw 0.9.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "release-execution-backend",
      kind: "release",
      label: "交付说明",
      command: ["claude", "release", "--project", "{projectId}", "--taskpack", "{taskPackId}"],
      provider: "Claude Code Release",
      backend: "OpenClaw",
      commandKey: "FORGE_RELEASE_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "openclaw",
        "run-release",
        "--project",
        "{projectId}",
        "--taskpack",
        "{taskPackId}",
        "--provider",
        "{provider}"
      ],
      backendCommandSource: "FORGE_RELEASE_EXEC_BACKEND_COMMAND",
      backendBinaryPath: "/usr/local/bin/openclaw",
      backendVersion: "openclaw 0.9.0",
      binaryPath: "/usr/local/bin/claude",
      version: "claude 2.1.34",
      source: "FORGE_RELEASE_EXEC_COMMAND"
    });
  });

  it("reads the archive external execution contract from env-like input", () => {
    const result = detectExternalExecutionCapability(
      "archive",
      {
        FORGE_ARCHIVE_EXEC_COMMAND:
          'claude archive --project "{projectId}" --taskpack "{taskPackId}"',
        FORGE_ARCHIVE_EXEC_PROVIDER: "Claude Code Archive",
        FORGE_ARCHIVE_EXEC_BACKEND: "OpenClaw",
        FORGE_ARCHIVE_EXEC_BACKEND_COMMAND:
          'openclaw run-archive --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      },
      {
        detectExecutable: (command) => {
          if (command === "claude") {
            return "/usr/local/bin/claude";
          }

          if (command === "openclaw") {
            return "/usr/local/bin/openclaw";
          }

          return null;
        },
        detectBinaryVersion: (binaryPath) => {
          if (binaryPath === "/usr/local/bin/claude") {
            return "claude 2.1.34";
          }

          if (binaryPath === "/usr/local/bin/openclaw") {
            return "openclaw 0.9.0";
          }

          return null;
        }
      }
    );

    expect(result).toEqual({
      id: "archive-execution-backend",
      kind: "archive",
      label: "归档沉淀",
      command: ["claude", "archive", "--project", "{projectId}", "--taskpack", "{taskPackId}"],
      provider: "Claude Code Archive",
      backend: "OpenClaw",
      commandKey: "FORGE_ARCHIVE_EXEC_BACKEND_COMMAND",
      backendCommand: [
        "openclaw",
        "run-archive",
        "--project",
        "{projectId}",
        "--taskpack",
        "{taskPackId}",
        "--provider",
        "{provider}"
      ],
      backendCommandSource: "FORGE_ARCHIVE_EXEC_BACKEND_COMMAND",
      backendBinaryPath: "/usr/local/bin/openclaw",
      backendVersion: "openclaw 0.9.0",
      binaryPath: "/usr/local/bin/claude",
      version: "claude 2.1.34",
      source: "FORGE_ARCHIVE_EXEC_COMMAND"
    });
  });
});
