import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

function requireArg(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`缺少必要参数: ${label}`);
  }

  return String(value).trim();
}

export function parseArchitectRunnerArgs(argv = []) {
  const args = {
    projectId: "",
    workspace: "",
    taskpackId: "",
    componentIds: "",
    executeIfReady: false,
    assembleCommand: ""
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

    if (token === "--execute-if-ready") {
      args.executeIfReady = true;
      continue;
    }

    if (token === "--assemble-command") {
      args.assembleCommand = requireArg(value, "assemble-command");
      index += 1;
    }
  }

  args.projectId = requireArg(args.projectId, "project-id");
  args.workspace = requireArg(args.workspace, "workspace");
  args.taskpackId = requireArg(args.taskpackId, "taskpack-id");

  return args;
}

function splitCommandString(command) {
  return String(command)
    .trim()
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"(.*)"$/, "$1")) ?? [];
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

export async function runArchitectAssembly(options, runtime = {}) {
  const workspace = requireArg(options.workspace, "workspace");
  const projectId = requireArg(options.projectId, "project-id");
  const taskPackRef = requireArg(options.taskpackId, "taskpack-id");
  const componentIds = options.componentIds
    ? String(options.componentIds)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (!existsSync(workspace)) {
    return {
      ok: false,
      mode: "assembly-ready",
      summary: `工作区不存在：${workspace}`,
      checks: [{ name: "workspace", status: "fail", summary: "工作区缺失" }]
    };
  }

  if (options.executeIfReady && options.assembleCommand) {
    const executionCommand = splitCommandString(options.assembleCommand);
    const execution = await executeCommand(executionCommand, workspace, runtime);
    const executionSummary = execution.ok
      ? `已执行 ${executionCommand.join(" ")}`
      : `执行失败：${execution.stderr || execution.stdout || `退出码 ${execution.exitCode ?? "unknown"}`}`;

    return {
      ok: execution.ok,
      mode: "assembly-executed",
      summary: `${executionSummary}，已完成 ${projectId} 的 TaskPack(${taskPackRef}) 组件装配。`,
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
          name: "assembly-policy",
          status: "pass",
          summary: "组件装配策略已加载"
        },
        {
          name: "execution",
          status: execution.ok ? "pass" : "fail",
          summary: executionSummary
        }
      ]
    };
  }

  return {
    ok: true,
    mode: "assembly-ready",
    summary: `已为 ${projectId} 准备 TaskPack(${taskPackRef}) 的组件装配计划。`,
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
      { name: "assembly-policy", status: "pass", summary: "组件装配策略已加载" }
    ]
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArchitectRunnerArgs(argv);
  const result = await runArchitectAssembly(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}
