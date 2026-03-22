import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function requireArg(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`缺少必要参数: ${label}`);
  }

  return String(value).trim();
}

function splitCommandString(command) {
  return String(command)
    .trim()
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"(.*)"$/, "$1")) ?? [];
}

function renderCommandStringTemplate(commandTemplate, replacements) {
  return Object.entries(replacements).reduce(
    (value, [token, replacement]) => value.replaceAll(`{${token}}`, replacement),
    commandTemplate
  );
}

function tryParseJson(text) {
  if (!text || !String(text).trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(String(text));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getBinaryBasename(binary) {
  return String(binary || "")
    .trim()
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase() ?? "";
}

function normalizeHealthStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (["ready", "healthy", "ok", "success", "online"].includes(normalized)) {
    return "ready";
  }

  if (["degraded", "error", "fail", "failed", "offline"].includes(normalized)) {
    return "degraded";
  }

  return null;
}

function parseStructuredHealthPayload(output) {
  if (!output || !String(output).trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(String(output));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const status = normalizeHealthStatus(parsed.status);
    const summary = String(parsed.summary || "").trim();
    const details = Array.isArray(parsed.details)
      ? parsed.details.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const version = String(parsed.version || "").trim() || null;

    if (!status || !summary) {
      return null;
    }

    return {
      status,
      summary,
      details,
      version
    };
  } catch {
    return null;
  }
}

export function parseNanoClawManagerArgs(argv = []) {
  const args = {
    commandType: "",
    projectId: "",
    stage: "",
    taskPackId: "",
    agentId: "",
    controllerId: "",
    provider: "",
    workspace: process.cwd()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--command") {
      args.commandType = requireArg(value, "command");
      index += 1;
      continue;
    }

    if (token === "--project-id") {
      args.projectId = requireArg(value, "project-id");
      index += 1;
      continue;
    }

    if (token === "--stage") {
      args.stage = requireArg(value, "stage");
      index += 1;
      continue;
    }

    if (token === "--taskpack-id") {
      args.taskPackId = requireArg(value, "taskpack-id");
      index += 1;
      continue;
    }

    if (token === "--agent-id") {
      args.agentId = requireArg(value, "agent-id");
      index += 1;
      continue;
    }

    if (token === "--controller-id") {
      args.controllerId = requireArg(value, "controller-id");
      index += 1;
      continue;
    }

    if (token === "--provider") {
      args.provider = requireArg(value, "provider");
      index += 1;
      continue;
    }

    if (token === "--workspace") {
      args.workspace = requireArg(value, "workspace");
      index += 1;
    }
  }

  args.commandType = requireArg(args.commandType, "command");
  args.projectId = requireArg(args.projectId, "project-id");
  args.agentId = requireArg(args.agentId, "agent-id");
  args.controllerId = requireArg(args.controllerId, "controller-id");
  args.provider = requireArg(args.provider, "provider");
  args.workspace = requireArg(args.workspace, "workspace");

  return args;
}

function writeExecutionPayloadFile(payload) {
  const directory = join(tmpdir(), "forge-nanoclaw");
  mkdirSync(directory, { recursive: true });
  const filePath = join(
    directory,
    `payload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.json`
  );
  writeFileSync(filePath, payload, "utf8");
  return filePath;
}

export function buildNanoClawManagerCommand(options, env = process.env) {
  const parsed = {
    commandType: requireArg(options.commandType, "command"),
    projectId: requireArg(options.projectId, "project-id"),
    stage: String(options.stage || "").trim(),
    taskPackId: String(options.taskPackId || "").trim(),
    agentId: requireArg(options.agentId, "agent-id"),
    controllerId: requireArg(options.controllerId, "controller-id"),
    provider: requireArg(options.provider, "provider"),
    workspace: requireArg(options.workspace || process.cwd(), "workspace")
  };
  const binary = String(env.FORGE_NANO_EXEC_BIN || "nanoclaw").trim() || "nanoclaw";
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const executionPayload = String(env.FORGE_EXECUTION_PAYLOAD || "").trim();
  const payloadFilePath = executionPayload ? writeExecutionPayloadFile(executionPayload) : null;
  const commandTemplate = String(env.FORGE_NANO_MANAGE_COMMAND || "").trim();
  const command = commandTemplate
    ? splitCommandString(
        renderCommandStringTemplate(commandTemplate, {
          repoRoot,
          commandType: parsed.commandType,
          projectId: parsed.projectId,
          stage: parsed.stage,
          taskPackId: parsed.taskPackId,
          agentId: parsed.agentId,
          controllerId: parsed.controllerId,
          provider: parsed.provider,
          workspace: parsed.workspace,
          cwd: parsed.workspace,
          payloadFile: payloadFilePath || ""
        })
      )
    : [
        binary,
        "manage",
        "--command",
        parsed.commandType,
        "--project",
        parsed.projectId,
        ...(parsed.stage ? ["--stage", parsed.stage] : []),
        ...(parsed.taskPackId ? ["--taskpack", parsed.taskPackId] : []),
        "--agent",
        parsed.agentId,
        "--controller",
        parsed.controllerId,
        "--provider",
        parsed.provider,
        ...(payloadFilePath ? ["--payload-file", payloadFilePath] : [])
      ];

  return {
    cwd: parsed.workspace,
    command,
    payloadFilePath
  };
}

export function buildNanoClawHealthcheckCommand(env = process.env) {
  const explicitCommand = String(env.FORGE_NANO_HEALTHCHECK_COMMAND || "").trim();

  if (explicitCommand) {
    return {
      command: splitCommandString(explicitCommand),
      fallbackCommand: null,
      source: "env"
    };
  }

  const binary = String(env.FORGE_NANO_EXEC_BIN || "nanoclaw").trim() || "nanoclaw";
  const basename = getBinaryBasename(binary);

  if (basename === "node" || basename.startsWith("node")) {
    return {
      command: [binary, "--version"],
      fallbackCommand: null,
      source: "version-fallback"
    };
  }

  return {
    command: [binary, "health", "--json"],
    fallbackCommand: [binary, "--version"],
    source: "builtin-handshake"
  };
}

function runCapturedCommand(command, cwd = process.cwd()) {
  const [binary, ...args] = command;
  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8"
  });

  return {
    status: result.status,
    error: result.error ?? null,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  };
}

function normalizeProbeResult(result, command, source, fallbackReason = null) {
  const output = [result.stdout, result.stderr].find(Boolean) || "";
  const parsed = parseStructuredHealthPayload(output);
  const successful = result.status === 0 && !result.error;

  if (parsed) {
    return {
      status: successful && parsed.status === "ready" ? "ready" : "degraded",
      summary: parsed.summary,
      details: [
        ...(fallbackReason ? [fallbackReason] : []),
        ...parsed.details,
        ...(!successful ? [`退出码 ${result.status ?? "unknown"}`] : [])
      ],
      version: parsed.version,
      command,
      source
    };
  }

  if (successful) {
    return {
      status: "ready",
      summary:
        source === "version-fallback"
          ? "Nano 二进制可达，当前回退到版本探测。"
          : "Nano 健康检查通过。",
      details: [
        ...(fallbackReason ? [fallbackReason] : []),
        ...(output ? [`健康检查输出：${output}`] : [])
      ],
      version: output || null,
      command,
      source
    };
  }

  return {
    status: "degraded",
    summary: `Nano 健康检查失败：退出码 ${result.status ?? "unknown"}`,
    details: [
      ...(fallbackReason ? [fallbackReason] : []),
      `退出码 ${result.status ?? "unknown"}`,
      ...(output ? [`健康检查输出：${output}`] : []),
      ...(result.error instanceof Error ? [`错误：${result.error.message}`] : [])
    ],
    version: null,
    command,
    source
  };
}

export async function probeNanoClawManagerHealth(env = process.env) {
  const prepared = buildNanoClawHealthcheckCommand(env);
  let result = runCapturedCommand(prepared.command);

  if (
    (result.status !== 0 || result.error) &&
    prepared.fallbackCommand &&
    prepared.fallbackCommand.length > 0
  ) {
    const fallbackResult = runCapturedCommand(prepared.fallbackCommand);

    if (fallbackResult.status === 0 && !fallbackResult.error) {
      return normalizeProbeResult(
        fallbackResult,
        prepared.fallbackCommand,
        "version-fallback",
        `主健康检查失败，已回退：${prepared.command.join(" ")}`
      );
    }
  }

  return normalizeProbeResult(result, prepared.command, prepared.source);
}

async function executeCommand(command, cwd) {
  return await new Promise((resolvePromise) => {
    const [bin, ...args] = command;
    const child = spawn(bin, args, {
      cwd,
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
      resolvePromise({ ok: false, exitCode: null, error, stdout, stderr });
    });

    child.on("close", (code) => {
      resolvePromise({ ok: code === 0, exitCode: code, error: null, stdout, stderr });
    });
  });
}

function normalizeExecutionReceipt(result, command) {
  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  const parsed = tryParseJson(stdout);
  const successful = Boolean(result.ok);
  const parsedSummary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  const parsedStatus = String(parsed?.status || "").trim();
  const parsedArtifacts = Array.isArray(parsed?.artifacts) ? parsed.artifacts : [];
  const parsedChecks = Array.isArray(parsed?.checks) ? parsed.checks : [];
  const parsedDetails = Array.isArray(parsed?.details)
    ? parsed.details.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const fallbackOutput = [stdout, stderr].filter(Boolean).join(" | ");
  const summary =
    parsedSummary ||
    fallbackOutput ||
    (successful
      ? "NanoClaw manager 已完成执行。"
      : `NanoClaw manager 执行失败，退出码 ${result.exitCode ?? "unknown"}。`);

  return {
    ok: successful,
    status:
      parsedStatus === "done" || parsedStatus === "blocked"
        ? parsedStatus
        : successful
          ? "done"
          : "blocked",
    summary,
    details: [
      ...parsedDetails,
      ...(stderr ? [`stderr: ${stderr}`] : []),
      ...(!successful ? [`退出码 ${result.exitCode ?? "unknown"}`] : [])
    ],
    artifacts: parsedArtifacts,
    checks: parsedChecks,
    backendLabel: typeof parsed?.backendLabel === "string" ? parsed.backendLabel.trim() : "NanoClaw",
    stdout,
    stderr,
    command,
    exitCode: result.exitCode ?? null
  };
}

export async function runNanoClawManagerCommand(options, env = process.env) {
  const prepared = buildNanoClawManagerCommand(options, env);

  try {
    mkdirSync(prepared.cwd, { recursive: true });
    const result = await executeCommand(prepared.command, prepared.cwd);
    return normalizeExecutionReceipt(result, prepared.command);
  } finally {
    if (prepared.payloadFilePath) {
      rmSync(prepared.payloadFilePath, { force: true });
    }
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--healthcheck") || argv[0] === "healthcheck") {
    const result = await probeNanoClawManagerHealth(env);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.status === "ready" ? 0 : 1;
  }

  const parsed = parseNanoClawManagerArgs(argv);
  const receipt = await runNanoClawManagerCommand(parsed, env);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt.ok ? 0 : 1;
}
