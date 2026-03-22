import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  detectExecutable,
  detectExecutableInfo,
  detectExternalExecutionCapability,
  splitCommandString
} from "./runtime-capability-detect.mjs";

function requireArg(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`缺少必要参数: ${label}`);
  }

  return String(value).trim();
}

export function parseEngineerRunnerArgs(argv = []) {
  const args = {
    projectId: "",
    workspace: "",
    taskpack: "latest",
    taskpackId: "",
    componentIds: "",
    executeIfReady: false,
    executeCommand: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--project-id") {
      args.projectId = requireArg(value, "project-id");
      index += 1;
      continue;
    }

    if (token === "--workspace") {
      args.workspace = requireArg(value, "workspace");
      index += 1;
      continue;
    }

    if (token === "--taskpack") {
      args.taskpack = requireArg(value, "taskpack");
      index += 1;
      continue;
    }

    if (token === "--taskpack-id") {
      args.taskpackId = requireArg(value, "taskpack-id");
      index += 1;
      continue;
    }

    if (token === "--component-ids") {
      args.componentIds = requireArg(value, "component-ids");
      index += 1;
      continue;
    }

    if (token === "--execute-if-ready") {
      args.executeIfReady = true;
      continue;
    }

    if (token === "--execute-command") {
      args.executeCommand = requireArg(value, "execute-command");
      index += 1;
    }
  }

  args.projectId = requireArg(args.projectId, "project-id");
  args.workspace = requireArg(args.workspace, "workspace");

  return args;
}

function buildEvidenceFields(evidenceStatus, executedCommand = "") {
  const evidenceLabelMap = {
    contract: "合同模式",
    "tool-ready": "工具就绪",
    executed: "已执行"
  };
  const evidenceLabel = evidenceLabelMap[evidenceStatus] || "未知状态";

  return {
    evidenceStatus,
    evidenceLabel,
    executedCommand: executedCommand || null,
    evidenceCheck: {
      name: "evidence",
      status: evidenceStatus,
      summary: executedCommand ? `${evidenceLabel} · ${executedCommand}` : evidenceLabel
    }
  };
}

async function executeCommand(command, workspace, runtime = {}) {
  if (runtime.executeCommand) {
    return await runtime.executeCommand(command, workspace);
  }

  return await new Promise((resolvePromise) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd: workspace,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolvePromise({
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: error.message
      });
    });

    child.on("close", (code) => {
      resolvePromise({
        ok: code === 0,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function renderCommandTemplate(command = [], replacements = {}) {
  return command
    .map((part) =>
      Object.entries(replacements).reduce(
        (value, [token, replacement]) => value.replaceAll(`{${token}}`, replacement),
        String(part)
      )
    )
    .filter((part) => part !== "");
}

export async function runEngineerExecution(options, runtime = {}) {
  const workspace = requireArg(options.workspace, "workspace");
  const projectId = requireArg(options.projectId, "project-id");
  const taskpack = requireArg(options.taskpack || "latest", "taskpack");
  const taskPackRef = options.taskpackId?.trim() || taskpack;
  const componentIds = options.componentIds
    ? String(options.componentIds)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const resolveExecutable = runtime.detectExecutable || detectExecutable;

  if (!existsSync(workspace)) {
    return {
      ok: false,
      mode: "contract-execution",
      summary: `工作区不存在：${workspace}`,
      checks: [{ name: "workspace", status: "fail", summary: "工作区缺失" }]
    };
  }

  const externalCapability =
    runtime.detectExternalExecutionCapability?.("engineer") ||
    detectExternalExecutionCapability("engineer", runtime.env || process.env, {
      detectExecutable: runtime.detectExecutable,
      detectBinaryVersion: runtime.detectBinaryVersion
    });

  if (externalCapability) {
    const providerSummary = [
      externalCapability.provider,
      externalCapability.backend ? `后端 ${externalCapability.backend}` : "",
      externalCapability.version || externalCapability.binaryPath || "",
      `来源 ${externalCapability.source}`
    ]
      .filter(Boolean)
      .join(" · ");

    if (options.executeIfReady) {
      const commandTemplate = externalCapability.backendCommand || externalCapability.command;
      const executionCommand = renderCommandTemplate(commandTemplate, {
        projectId,
        workspace,
        taskPackId: taskPackRef,
        componentIds: componentIds.join(","),
        provider: externalCapability.provider,
        backend: externalCapability.backend || ""
      });
      const execution = await executeCommand(executionCommand, workspace, runtime);
      const executionLabel =
        externalCapability.backend && externalCapability.backendCommand
          ? `${externalCapability.backend} 后端调度 ${externalCapability.provider}`
          : externalCapability.provider;
      const executionSummary = execution.ok
        ? `已通过 ${executionLabel} 执行 ${executionCommand.join(" ")}`
        : `执行失败：${execution.stderr || execution.stdout || `退出码 ${execution.exitCode ?? "unknown"}`}`;
      const evidence = buildEvidenceFields("executed", executionCommand.join(" "));

      return {
        ok: execution.ok,
        mode: "codex-executed",
        evidenceStatus: evidence.evidenceStatus,
        evidenceLabel: evidence.evidenceLabel,
        executedCommand: evidence.executedCommand,
        executionProvider: externalCapability.provider,
        executionBackend: externalCapability.backend || null,
        executionSource: externalCapability.backendCommandSource || externalCapability.source,
        summary: `${executionSummary}，已进入 ${projectId} 的 TaskPack(${taskPackRef}) 工程执行。`,
        checks: [
          { name: "workspace", status: "pass", summary: `已找到工作区：${workspace}` },
          { name: "taskpack", status: "pass", summary: `已选择 TaskPack：${taskPackRef}` },
          ...(componentIds.length > 0
            ? [
                {
                  name: "components",
                  status: "pass",
                  summary: `已装配组件：${componentIds.join(", ")}`
                }
              ]
            : []),
          {
            name: "model-execution",
            status: "pass",
            summary: providerSummary
          },
          {
            name: "execution",
            status: execution.ok ? "pass" : "fail",
            summary: executionSummary
          },
          evidence.evidenceCheck
        ]
      };
    }

    const evidence = buildEvidenceFields("tool-ready");

    return {
      ok: true,
      mode: "codex-ready",
      evidenceStatus: evidence.evidenceStatus,
      evidenceLabel: evidence.evidenceLabel,
      executedCommand: evidence.executedCommand,
      executionProvider: externalCapability.provider,
      executionBackend: externalCapability.backend || null,
      executionSource: externalCapability.source,
      summary: `已检测到外部执行器 ${providerSummary}，可继续执行 ${projectId} 的 TaskPack(${taskPackRef})。`,
      checks: [
        { name: "workspace", status: "pass", summary: `已找到工作区：${workspace}` },
        { name: "taskpack", status: "pass", summary: `已选择 TaskPack：${taskPackRef}` },
        ...(componentIds.length > 0
          ? [
              {
                name: "components",
                status: "pass",
                summary: `已装配组件：${componentIds.join(", ")}`
              }
            ]
          : []),
        {
          name: "model-execution",
          status: "pass",
          summary: providerSummary
        },
        evidence.evidenceCheck
      ]
    };
  }

  const executableInfo =
    runtime.detectExecutableInfo?.("codex") ||
    (() => {
      const path = resolveExecutable("codex");
      return path ? { path, version: null } : null;
    })();
  const codexBinary = executableInfo?.path || null;
  const codexVersion = executableInfo?.version || null;

  if (codexBinary) {
    if (options.executeIfReady) {
      const executionCommand = options.executeCommand
        ? splitCommandString(options.executeCommand)
        : [codexBinary, "--version"];
      const execution = await executeCommand(executionCommand, workspace, runtime);
      const executionSummary = execution.ok
        ? `已执行 ${executionCommand.join(" ")}`
        : `执行失败：${execution.stderr || execution.stdout || `退出码 ${execution.exitCode ?? "unknown"}`}`;
      const evidence = buildEvidenceFields("executed", executionCommand.join(" "));

      return {
        ok: execution.ok,
        mode: "codex-executed",
        evidenceStatus: evidence.evidenceStatus,
        evidenceLabel: evidence.evidenceLabel,
        executedCommand: evidence.executedCommand,
        summary: `${executionSummary}，已进入 ${projectId} 的 TaskPack(${taskPackRef}) 工程执行。`,
        checks: [
          { name: "workspace", status: "pass", summary: `已找到工作区：${workspace}` },
          { name: "taskpack", status: "pass", summary: `已选择 TaskPack：${taskPackRef}` },
          ...(componentIds.length > 0
            ? [
                {
                  name: "components",
                  status: "pass",
                  summary: `已装配组件：${componentIds.join(", ")}`
                }
              ]
            : []),
          {
            name: "codex",
            status: "pass",
            summary: `已检测到 ${codexBinary}${codexVersion ? ` · ${codexVersion}` : ""}`
          },
          {
            name: "execution",
            status: execution.ok ? "pass" : "fail",
            summary: executionSummary
          },
          evidence.evidenceCheck
        ]
      };
    }

    const evidence = buildEvidenceFields("tool-ready");

    return {
      ok: true,
      mode: "codex-ready",
      evidenceStatus: evidence.evidenceStatus,
      evidenceLabel: evidence.evidenceLabel,
      executedCommand: evidence.executedCommand,
      summary: `已检测到 Codex (${codexBinary}${codexVersion ? `, ${codexVersion}` : ""})，可继续执行 ${projectId} 的 TaskPack(${taskPackRef})。`,
      checks: [
        { name: "workspace", status: "pass", summary: `已找到工作区：${workspace}` },
        { name: "taskpack", status: "pass", summary: `已选择 TaskPack：${taskPackRef}` },
        ...(componentIds.length > 0
          ? [
              {
                name: "components",
                status: "pass",
                summary: `已装配组件：${componentIds.join(", ")}`
              }
            ]
          : []),
        {
          name: "codex",
          status: "pass",
          summary: `已检测到 ${codexBinary}${codexVersion ? ` · ${codexVersion}` : ""}`
        },
        evidence.evidenceCheck
      ]
    };
  }

  const evidence = buildEvidenceFields("contract");

  return {
    ok: true,
    mode: "contract-execution",
    evidenceStatus: evidence.evidenceStatus,
    evidenceLabel: evidence.evidenceLabel,
    executedCommand: evidence.executedCommand,
    summary: `已为 ${projectId} 装载 TaskPack(${taskPackRef})，当前使用本地 Engineer 合同执行模式。`,
    checks: [
      { name: "workspace", status: "pass", summary: `已找到工作区：${workspace}` },
      { name: "taskpack", status: "pass", summary: `已选择 TaskPack：${taskPackRef}` },
      ...(componentIds.length > 0
        ? [
            {
              name: "components",
              status: "pass",
              summary: `已装配组件：${componentIds.join(", ")}`
            }
          ]
        : []),
      { name: "execution-policy", status: "pass", summary: "工程执行策略已加载" },
      evidence.evidenceCheck
    ]
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseEngineerRunnerArgs(argv);
  const result = await runEngineerExecution(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}
