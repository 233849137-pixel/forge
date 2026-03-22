import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectBinaryVersion } from "./runtime-capability-detect.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function requireArg(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`缺少必要参数: ${label}`);
  }

  return String(value).trim();
}

export function parseQaRunnerArgs(argv = []) {
  const args = {
    baseUrl: "http://127.0.0.1:3000",
    projectId: "",
    workspace: "",
    taskpackId: "",
    componentIds: "",
    strictPlaywright: false,
    executeIfReady: false,
    testCommand: ""
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

    if (token === "--base-url") {
      args.baseUrl = requireArg(value, "base-url");
      index += 1;
      continue;
    }

    if (token === "--strict-playwright") {
      args.strictPlaywright = true;
      continue;
    }

    if (token === "--execute-if-ready") {
      args.executeIfReady = true;
      continue;
    }

    if (token === "--test-command") {
      args.testCommand = requireArg(value, "test-command");
      index += 1;
    }
  }

  args.projectId = requireArg(args.projectId, "project-id");
  args.workspace = requireArg(args.workspace, "workspace");

  return args;
}

function splitCommandString(command) {
  return String(command)
    .trim()
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"(.*)"$/, "$1")) ?? [];
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

function detectPlaywrightBinary() {
  const localBinary = resolve(repoRoot, "node_modules/.bin/playwright");
  return existsSync(localBinary) ? localBinary : null;
}

function detectPlaywrightInfo() {
  const path = detectPlaywrightBinary();

  if (!path) {
    return null;
  }

  return {
    path,
    version: detectBinaryVersion(path, ["--version"])
  };
}

function loadPackageJsonScripts(workspace) {
  const packageJsonPath = resolve(workspace, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return parsed?.scripts ?? null;
  } catch {
    return null;
  }
}

function resolvePlaywrightExecutionCommand(options, playwrightBinary, runtime = {}) {
  if (options.testCommand) {
    return splitCommandString(options.testCommand);
  }

  const configCandidates = [
    "playwright.forge.config.ts",
    "playwright.config.ts",
    "playwright.config.js",
    "playwright.config.mjs"
  ].map((file) => resolve(options.workspace, file));
  const matchedConfig = configCandidates.find((file) => existsSync(file));

  if (matchedConfig && playwrightBinary) {
    return [playwrightBinary, "test", "--config", matchedConfig, "--project", options.projectId];
  }

  const scripts = runtime.loadPackageJsonScripts?.(options.workspace) ?? loadPackageJsonScripts(options.workspace);

  if (scripts?.["test:e2e"]) {
    return ["npm", "run", "test:e2e", "--", "--project", options.projectId];
  }

  return null;
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

export async function runQaVerification(options, runtime = {}) {
  const workspace = requireArg(options.workspace, "workspace");
  const projectId = requireArg(options.projectId, "project-id");
  const taskPackRef = options.taskpackId?.trim() || "latest";
  const componentIds = options.componentIds
    ? String(options.componentIds)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (!existsSync(workspace)) {
    return {
      ok: false,
      mode: "contract-check",
      summary: `工作区不存在：${workspace}`,
      checks: [{ name: "workspace", status: "fail", summary: "工作区缺失" }]
    };
  }

  const playwrightInfo =
    runtime.detectPlaywrightInfo?.() ||
    (() => {
      const path = (runtime.detectPlaywrightBinary || detectPlaywrightBinary)();
      return path ? { path, version: null } : null;
    })();
  const playwrightBinary = playwrightInfo?.path || null;
  const playwrightVersion = playwrightInfo?.version || null;

  if (!playwrightBinary && options.strictPlaywright) {
    const evidence = buildEvidenceFields("contract");

    return {
      ok: false,
      mode: "contract-check",
      evidenceStatus: evidence.evidenceStatus,
      evidenceLabel: evidence.evidenceLabel,
      executedCommand: evidence.executedCommand,
      summary: "未检测到 Playwright，无法执行严格浏览器门禁。",
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
        { name: "playwright", status: "fail", summary: "未检测到 Playwright" },
        evidence.evidenceCheck
      ]
    };
  }

  if (playwrightBinary) {
    const executionCommand = resolvePlaywrightExecutionCommand(options, playwrightBinary, runtime);

    if (options.executeIfReady && executionCommand) {
      const execution = await executeCommand(executionCommand, workspace, runtime);
      const executionSummary = execution.ok
        ? `已执行 ${executionCommand.join(" ")}`
        : `执行失败：${execution.stderr || execution.stdout || `退出码 ${execution.exitCode ?? "unknown"}`}`;
      const evidence = buildEvidenceFields("executed", executionCommand.join(" "));

      return {
        ok: execution.ok,
        mode: "playwright-executed",
        evidenceStatus: evidence.evidenceStatus,
        evidenceLabel: evidence.evidenceLabel,
        executedCommand: evidence.executedCommand,
        summary: `${executionSummary}，项目 ${projectId} 的浏览器门禁已${execution.ok ? "完成" : "阻塞"}。`,
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
            name: "playwright",
            status: "pass",
            summary: `已检测到 ${playwrightBinary}${playwrightVersion ? ` · ${playwrightVersion}` : ""}`
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
      mode: "playwright-ready",
      evidenceStatus: evidence.evidenceStatus,
      evidenceLabel: evidence.evidenceLabel,
      executedCommand: evidence.executedCommand,
      summary: `已检测到 Playwright (${playwrightBinary}${playwrightVersion ? `, ${playwrightVersion}` : ""})，可继续执行项目 ${projectId} 的浏览器门禁（TaskPack：${taskPackRef}）。`,
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
          name: "playwright",
          status: "pass",
          summary: `已检测到 ${playwrightBinary}${playwrightVersion ? ` · ${playwrightVersion}` : ""}`
        },
        {
          name: "execution-plan",
          status: options.executeIfReady ? "warn" : "pass",
          summary: options.executeIfReady
            ? "未发现可执行 Playwright 配置，暂保持 ready 模式"
            : "当前未请求真实执行，仅返回就绪态"
        },
        evidence.evidenceCheck
      ]
    };
  }

  const evidence = buildEvidenceFields("contract");

  return {
    ok: true,
    mode: "contract-check",
    evidenceStatus: evidence.evidenceStatus,
    evidenceLabel: evidence.evidenceLabel,
    executedCommand: evidence.executedCommand,
    summary: `已完成 ${projectId} 的 QA 合同检查（TaskPack：${taskPackRef}），当前使用无 Playwright 的本地门禁模式。`,
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
      { name: "playwright", status: "warn", summary: "未检测到 Playwright，暂时仅执行合同检查" },
      evidence.evidenceCheck
    ]
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseQaRunnerArgs(argv);
  const result = await runQaVerification(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}
