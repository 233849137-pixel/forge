import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { loadDashboardSnapshot } from "../../../../packages/db/src";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readOptionalString,
  readRequiredString
} from "../../../../src/lib/forge-api-response";
import { ForgeApiError } from "../../../../src/lib/forge-ai";

function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (current, [token, value]) => current.replaceAll(`{${token}}`, value),
    template
  );
}

function splitShellCommand(command: string) {
  return Array.from(command.matchAll(/"([^"]*)"|[^\s]+/g)).map((match) => match[1] ?? match[0] ?? "");
}

function quoteShellArgument(value: string) {
  if (!value) {
    return '""';
  }

  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll(/(["\\$`])/g, "\\$1")}"`;
}

function appendMessageSuffix(commandPreview: string, suffix: string) {
  if (!suffix.trim()) {
    return commandPreview;
  }

  const command = splitShellCommand(commandPreview);
  const [binary, ...args] = command;

  if (!binary) {
    return commandPreview;
  }

  const messageFlagIndex = args.findIndex((item) => item === "--message");
  if (messageFlagIndex >= 0 && typeof args[messageFlagIndex + 1] === "string") {
    args[messageFlagIndex + 1] = `${args[messageFlagIndex + 1]}\n\n${suffix}`;
  } else {
    args.push("--message", suffix);
  }

  return [binary, ...args].map(quoteShellArgument).join(" ");
}

function tryParseJson(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function executeShell(commandPreview: string, cwd?: string | null) {
  const command = splitShellCommand(commandPreview);
  const [binary, ...args] = command;

  if (!binary) {
    throw new ForgeApiError("当前 CEO 对话缺少可执行命令", "FORGE_BACKEND_NOT_READY", 409);
  }

  const workingDirectory = cwd || process.cwd();
  mkdirSync(workingDirectory, { recursive: true });

  return await new Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
  }>((resolve) => {
    const child = spawn(binary, args, {
      cwd: workingDirectory,
      env: process.env,
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
      resolve({
        ok: false,
        stdout,
        stderr: error.message,
        code: null
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code
      });
    });
  });
}

function extractReply(parsed: Record<string, unknown> | null, fallback: string) {
  const payloads = Array.isArray(parsed?.payloads) ? parsed.payloads : [];
  const textPayloads = payloads
    .map((item) =>
      item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
        ? (item as { text: string }).text.trim()
        : ""
    )
    .filter(Boolean);

  return textPayloads.join("\n\n").trim() || fallback.trim();
}

function buildPortfolioSummary(snapshot: ReturnType<typeof loadDashboardSnapshot>) {
  return snapshot.projects
    .map((project) => {
      const workflow = snapshot.workflowStates.find((item) => item.projectId === project.id);
      const blockers = workflow?.blockers?.length ? `；阻塞：${workflow.blockers.join("、")}` : "";
      const riskNote = project.riskNote?.trim() ? `；风险：${project.riskNote.trim()}` : "";
      return `- ${project.name}｜企业：${project.enterpriseName || "未填写"}｜阶段：${workflow?.currentStage || "项目接入"}｜负责人：${project.owner || "未指定"}｜进度：${project.progress}%｜交付：${project.deliveryDate || "待定"}${blockers}${riskNote}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);
    const prompt = readRequiredString(body, "prompt", "对话内容");
    readOptionalString(body, "scope", "对话范围");
    readOptionalString(body, "projectId", "项目 ID");
    const triggeredBy = readOptionalString(body, "triggeredBy", "触发人") ?? "Forge · CEO 对话";
    const snapshot = loadDashboardSnapshot();
    const isPortfolioScope = true;

    const commandTemplate = process.env.FORGE_PM_EXEC_BACKEND_COMMAND?.trim();

    if (!commandTemplate) {
      throw new ForgeApiError(
        "当前还没有配置可用的 CEO 对话后端。",
        "FORGE_BACKEND_NOT_READY",
        409
      );
    }

    const resolvedProjectId = "portfolio";
    const resolvedProjectName = "全部项目";
    const stage = "组合视图";
    const workspacePath = process.cwd();
    const portfolioSummary = buildPortfolioSummary(snapshot);
    const contextSummary = `当前面对的是全部项目组合，请以 CEO 视角回答。\n\n${portfolioSummary}`;

    let commandPreview = renderTemplate(commandTemplate, {
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
      stage,
      repoRoot: process.cwd(),
      cwd: workspacePath,
      workspace: workspacePath,
      portfolioSummary,
      scopeLabel: isPortfolioScope ? "全部项目组合" : "单项目",
      provider: process.env.FORGE_PM_EXEC_PROVIDER?.trim() ?? "OpenClaw PM",
      backend: process.env.FORGE_PM_EXEC_BACKEND?.trim() ?? "OpenClaw"
    });

    commandPreview = appendMessageSuffix(
      commandPreview,
      `${contextSummary}\n\n用户问题：${prompt}\n\n请直接给出 CEO 视角的判断、建议和下一步动作，回答保持简洁、明确、可执行。`
    );

    const result = await executeShell(commandPreview, workspacePath);
    const stdoutText = result.stdout.trim();
    const stderrText = result.stderr.trim();
    const parsed = tryParseJson(stdoutText);
    const reply = extractReply(parsed, stdoutText || stderrText);

    if (!result.ok) {
      throw new ForgeApiError(
        reply || `CEO 对话执行失败，退出码 ${result.code ?? "unknown"}`,
        "FORGE_BACKEND_EXECUTION_FAILED",
        502
      );
    }

    return forgeSuccess({
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
      stage,
      triggeredBy,
      backend: process.env.FORGE_PM_EXEC_BACKEND?.trim() ?? "OpenClaw",
      provider: process.env.FORGE_PM_EXEC_PROVIDER?.trim() ?? "OpenClaw PM",
      commandPreview,
      reply
    });
  } catch (error) {
    return forgeError(error);
  }
}
