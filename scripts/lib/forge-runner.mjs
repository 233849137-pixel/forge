import { executeShellPlan } from "./forge-shell-executor.mjs";

function requireArg(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`缺少必要参数: ${label}`);
  }

  return String(value).trim();
}

export function parseRunnerArgs(argv = []) {
  const args = {
    baseUrl: "http://127.0.0.1:3000",
    runnerId: "",
    commandId: "",
    taskId: "",
    remediationId: "",
    projectId: "",
    taskPackId: "",
    componentIds: "",
    triggeredBy: "",
    executePlan: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--base-url") {
      args.baseUrl = requireArg(value, "base-url");
      index += 1;
      continue;
    }

    if (token === "--runner-id") {
      args.runnerId = requireArg(value, "runner-id");
      index += 1;
      continue;
    }

    if (token === "--command-id") {
      args.commandId = requireArg(value, "command-id");
      index += 1;
      continue;
    }

    if (token === "--task-id") {
      args.taskId = requireArg(value, "task-id");
      index += 1;
      continue;
    }

    if (token === "--remediation-id") {
      args.remediationId = requireArg(value, "remediation-id");
      index += 1;
      continue;
    }

    if (token === "--project-id") {
      args.projectId = requireArg(value, "project-id");
      index += 1;
      continue;
    }

    if (token === "--taskpack-id") {
      args.taskPackId = requireArg(value, "taskpack-id");
      index += 1;
      continue;
    }

    if (token === "--component-ids") {
      args.componentIds = requireArg(value, "component-ids");
      index += 1;
      continue;
    }

    if (token === "--triggered-by") {
      args.triggeredBy = requireArg(value, "triggered-by");
      index += 1;
      continue;
    }

    if (token === "--execute-plan") {
      args.executePlan = true;
    }
  }

  if (!args.commandId && !args.taskId && !args.remediationId) {
    throw new Error("缺少必要参数: command-id、task-id 或 remediation-id");
  }
  args.projectId = requireArg(args.projectId, "project-id");

  return args;
}

async function requestJson(baseUrl, path, init) {
  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "content-type": "application/json"
      },
      ...init
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Forge 本地 API 不可用，请先启动桌面端或 dev 服务。原始错误: ${message}`);
  }

  const payload = await response.json();

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || `Forge API 调用失败: ${path}`);
  }

  return payload.data;
}

function buildRunId(commandId) {
  return `run-${commandId}-${Date.now().toString(36)}`;
}

function buildFallbackExecutionPlan(contract, runner, projectId, taskPackId = "latest", componentIds = "") {
  const cwd = runner?.workspacePath || process.cwd();

  if (contract?.runnerProfile === "engineer-runner") {
    return {
      mode: "external-shell",
      cwd,
      command: [
        "node",
        `${process.cwd()}/scripts/forge-engineer-runner.mjs`,
        "--project-id",
        projectId,
        "--workspace",
        cwd,
        "--taskpack-id",
        taskPackId,
        ...(componentIds ? ["--component-ids", componentIds] : [])
      ],
      expectedArtifacts: ["patch", "demo-build"]
    };
  }

  if (contract?.runnerProfile === "architect-runner") {
    return {
      mode: "external-shell",
      cwd,
      command: [
        "node",
        `${process.cwd()}/scripts/forge-architect-runner.mjs`,
        "--project-id",
        projectId,
        "--workspace",
        cwd,
        "--taskpack-id",
        taskPackId,
        ...(componentIds ? ["--component-ids", componentIds] : [])
      ],
      expectedArtifacts: []
    };
  }

  if (contract?.runnerProfile === "reviewer-runner") {
    return {
      mode: "external-shell",
      cwd,
      command: ["forge-review", "--cwd", cwd, "--project", projectId, "--artifact", "patch"],
      expectedArtifacts: ["review-report"]
    };
  }

  if (contract?.runnerProfile === "qa-runner") {
    return {
      mode: "external-shell",
      cwd,
      command: ["playwright", "test", "--config", "playwright.forge.config.ts", "--project", projectId],
      expectedArtifacts: ["test-report", "playwright-run"]
    };
  }

  return {
    mode: "external-shell",
    cwd,
    command: ["forge-runtime", contract?.runnerProfile || "runner", "--project", projectId],
    expectedArtifacts: []
  };
}

function normalizeExecutionPlan(plan, runner, projectId, taskPackId = "latest", componentIds = "") {
  if (!plan) {
    return null;
  }

  return {
    mode: plan.mode || "external-shell",
    cwd: plan.cwd || runner?.workspacePath || process.cwd(),
    command: Array.isArray(plan.command)
      ? plan.command
      : Array.isArray(plan.commandTemplate)
        ? plan.commandTemplate.map((part) =>
            String(part)
              .replaceAll("{projectId}", projectId)
              .replaceAll("{repoRoot}", process.cwd())
              .replaceAll("{cwd}", runner?.workspacePath || process.cwd())
              .replaceAll("{taskPackId}", taskPackId)
              .replaceAll("{componentIds}", componentIds)
          )
        : [],
    expectedArtifacts: Array.isArray(plan.expectedArtifacts) ? plan.expectedArtifacts : []
  };
}

function matchesRunnerProfile(runner, runnerProfile) {
  if (!runnerProfile) {
    return true;
  }

  if (Array.isArray(runner?.profiles) && runner.profiles.includes(runnerProfile)) {
    return true;
  }

  const profileHints = {
    "pm-orchestrator": ["pm", "产品", "交付编排"],
    "architect-runner": ["architect", "架构", "交付编排"],
    "engineer-runner": ["engineer", "主执行", "Codex", "TaskPack 执行"],
    "reviewer-runner": ["reviewer", "评审", "规则审查"],
    "qa-runner": ["qa", "浏览器验证", "Playwright", "门禁回归"],
    "release-runner": ["release", "交付编排", "发布说明"],
    "knowledge-runner": ["knowledge", "归档", "知识"]
  };
  const haystack = [
    runner?.id,
    runner?.name,
    runner?.summary,
    ...(Array.isArray(runner?.capabilities) ? runner.capabilities : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (profileHints[runnerProfile] || []).some((hint) => haystack.includes(String(hint).toLowerCase()));
}

function formatRuntimeExtraNotes(external) {
  if (!external || typeof external !== "object") {
    return "";
  }

  const data = external.data && typeof external.data === "object" ? external.data : null;
  const mode = data && typeof data.mode === "string" ? data.mode : "";
  const evidenceStatus =
    data && typeof data.evidenceStatus === "string" ? data.evidenceStatus : "";
  const evidenceLabel = data && typeof data.evidenceLabel === "string" ? data.evidenceLabel : "";
  const summary =
    (data && typeof data.summary === "string" ? data.summary : "") ||
    (typeof external.summary === "string" ? external.summary : "");
  const checks =
    data && Array.isArray(data.checks)
      ? data.checks
          .filter((check) => check && typeof check === "object")
          .map((check) => {
            const name = typeof check.name === "string" ? check.name : "";
            const status = typeof check.status === "string" ? check.status : "";
            const summary = typeof check.summary === "string" ? check.summary : "";

            return name && status ? `${name}=${status}${summary ? `[${summary}]` : ""}` : "";
          })
          .filter(Boolean)
          .join(", ")
      : "";

  return [
    mode ? `Runtime:${mode}` : "",
    evidenceStatus ? `Evidence:${evidenceStatus}` : "",
    evidenceLabel,
    summary,
    checks ? `checks:${checks}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

function deriveEvidenceStatusFromMode(mode) {
  const normalizedMode = typeof mode === "string" ? mode.trim() : "";

  if (!normalizedMode) {
    return "";
  }

  if (normalizedMode.startsWith("contract-")) {
    return "contract";
  }

  if (normalizedMode.endsWith("-executed")) {
    return "executed";
  }

  if (normalizedMode.endsWith("-ready")) {
    return "tool-ready";
  }

  return "";
}

function deriveEvidenceLabel(evidenceStatus) {
  const labels = {
    contract: "合同模式",
    "tool-ready": "工具就绪",
    executed: "已执行"
  };

  return labels[evidenceStatus] || "";
}

function normalizeEvidenceChecks(data, fallbackChecks = []) {
  const checks = Array.isArray(fallbackChecks) ? [...fallbackChecks] : [];
  const evidenceStatus =
    data && typeof data.evidenceStatus === "string"
      ? data.evidenceStatus
      : deriveEvidenceStatusFromMode(data && typeof data.mode === "string" ? data.mode : "");
  const evidenceLabel =
    data && typeof data.evidenceLabel === "string"
      ? data.evidenceLabel
      : deriveEvidenceLabel(evidenceStatus);
  const executedCommand =
    data && typeof data.executedCommand === "string" ? data.executedCommand : "";

  if (
    evidenceStatus &&
    !checks.some((check) => check && typeof check === "object" && check.name === "evidence")
  ) {
    checks.push({
      name: "evidence",
      status: evidenceStatus,
      summary: executedCommand ? `${evidenceLabel || evidenceStatus} · ${executedCommand}` : evidenceLabel || evidenceStatus
    });
  }

  return checks;
}

async function resolveRunnerExecutionContext(baseUrl, options) {
  const [commandCenter, runnerRegistry] = await Promise.all([
    requestJson(baseUrl, "/api/forge/commands"),
    requestJson(baseUrl, "/api/forge/runners")
  ]);
  const command = (commandCenter.commands || []).find((item) => item.id === options.commandId);

  if (!command) {
    throw new Error(`命令不存在: ${options.commandId}`);
  }

  const contract = (commandCenter.commandContracts || []).find((item) => item.type === command.type);

  if (!contract) {
    throw new Error(`命令缺少正式契约: ${command.type}`);
  }

  const runtimeAdapter = (commandCenter.runtimeAdapters || []).find(
    (item) => item.commandType === command.type
  );
  let taskPackId = options.taskPackId || "latest";
  let componentIds = options.componentIds || "";

  if (
    Array.isArray(runtimeAdapter?.commandTemplate) &&
    (runtimeAdapter.commandTemplate.includes("{taskPackId}") ||
      runtimeAdapter.commandTemplate.includes("{componentIds}"))
  ) {
    const snapshot = await requestJson(baseUrl, "/api/forge/snapshot");
    if (!options.taskPackId && runtimeAdapter.commandTemplate.includes("{taskPackId}")) {
      const taskPack = (snapshot.artifacts || [])
        .filter((artifact) => artifact.projectId === options.projectId && artifact.type === "task-pack")
        .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];
      taskPackId = taskPack?.id || "latest";
    }
    if (!componentIds && runtimeAdapter.commandTemplate.includes("{componentIds}")) {
      componentIds = (snapshot.projectAssetLinks || [])
        .filter(
          (link) => link.projectId === options.projectId && link.targetType === "component"
        )
        .map((link) => link.targetId)
        .join(",");
    }
  }

  const runners = runnerRegistry.items || [];

  if (options.runnerId) {
    const runner = runners.find((item) => item.id === options.runnerId);

    if (!runner) {
      throw new Error(`Runner 不存在: ${options.runnerId}`);
    }

    if (!matchesRunnerProfile(runner, contract.runnerProfile)) {
      throw new Error(`Runner ${options.runnerId} 与命令契约 ${contract.runnerProfile} 不匹配`);
    }

    const executionPlan = normalizeExecutionPlan(
      runtimeAdapter,
      runner,
      options.projectId,
      taskPackId,
      componentIds
    ) || buildFallbackExecutionPlan(contract, runner, options.projectId, taskPackId, componentIds);

    return { command, contract, runner, executionPlan, resolvedInputs: { taskPackId, componentIds } };
  }

  const runner = runners.find((item) => matchesRunnerProfile(item, contract.runnerProfile));

  if (!runner) {
    throw new Error(`没有找到可执行 ${contract.runnerProfile} 的本地 Runner`);
  }

  const executionPlan = normalizeExecutionPlan(
    runtimeAdapter,
    runner,
    options.projectId,
    taskPackId,
    componentIds
  ) || buildFallbackExecutionPlan(contract, runner, options.projectId, taskPackId, componentIds);

  return { command, contract, runner, executionPlan, resolvedInputs: { taskPackId, componentIds } };
}

async function resolveTaskRetryExecutionContext(baseUrl, options) {
  const tasksPayload = await requestJson(
    baseUrl,
    `/api/forge/tasks?projectId=${encodeURIComponent(options.projectId)}`
  );
  const task = (tasksPayload.items || []).find((item) => item.id === options.taskId);

  if (!task) {
    throw new Error(`整改任务不存在: ${options.taskId}`);
  }

  if (!task.retryCommandId) {
    throw new Error(`整改任务缺少可回放命令: ${options.taskId}`);
  }

  const executionContext = await resolveRunnerExecutionContext(baseUrl, {
    ...options,
    commandId: task.retryCommandId,
    taskPackId: task.taskPackId || options.taskPackId,
    componentIds:
      options.componentIds ||
      (Array.isArray(task.linkedComponentIds) ? task.linkedComponentIds.join(",") : "")
  });

  return {
    ...executionContext,
    task,
    resolvedCommandId: task.retryCommandId
  };
}

async function resolveRemediationExecutionContext(baseUrl, options) {
  const payload = await requestJson(
    baseUrl,
    `/api/forge/remediations?projectId=${encodeURIComponent(options.projectId)}`
  );
  const remediation = (payload.items || []).find((item) => item.id === options.remediationId);

  if (!remediation) {
    throw new Error(`整改入口不存在: ${options.remediationId}`);
  }

  if (!remediation.retryCommandId) {
    throw new Error(`整改入口缺少可回放命令: ${options.remediationId}`);
  }

  const executionContext = await resolveRunnerExecutionContext(baseUrl, {
    ...options,
    commandId: remediation.retryCommandId,
    taskPackId: remediation.taskPackId || options.taskPackId,
    componentIds:
      options.componentIds ||
      (Array.isArray(remediation.linkedComponentIds)
        ? remediation.linkedComponentIds.join(",")
        : "")
  });

  return {
    ...executionContext,
    task: {
      id: remediation.id,
      title: remediation.title,
      retryApiPath: "/api/forge/remediations/retry"
    },
    resolvedCommandId: remediation.retryCommandId
  };
}

export async function executeRunnerCommand(options, runtime = {}) {
  const projectId = requireArg(options.projectId, "project-id");
  const baseUrl = requireArg(options.baseUrl || "http://127.0.0.1:3000", "base-url");
  let task = null;
  let resolvedCommandId = options.commandId || "";
  const executionContext = options.remediationId
    ? await resolveRemediationExecutionContext(baseUrl, options)
    : options.taskId
      ? await resolveTaskRetryExecutionContext(baseUrl, options)
      : await resolveRunnerExecutionContext(baseUrl, options);
  const { command, contract, runner, executionPlan, resolvedInputs } = executionContext;
  if ("task" in executionContext) {
    task = executionContext.task;
    resolvedCommandId = executionContext.resolvedCommandId;
  } else {
    resolvedCommandId = requireArg(options.commandId, "command-id");
  }
  const runnerId = requireArg(runner?.id, "runner-id");
  const runId = buildRunId(task?.id || resolvedCommandId);
  const triggeredBy = (options.triggeredBy || runnerId).trim();
  const now = new Date().toISOString();
  const executeExternalPlan =
    runtime.executeExternalPlan ||
    executeShellPlan;
  const explicitExtraNotes = typeof options.extraNotes === "string" ? options.extraNotes.trim() : "";
  const linkedComponentIds = resolvedInputs?.componentIds
    ? resolvedInputs.componentIds
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  let planExecution = {
    status: "planned",
    summary: "当前未执行外部 Runtime Adapter 计划。",
    mode: "planned",
    evidenceStatus: "",
    evidenceLabel: "",
    checks: []
  };
  let runtimeExtraNotes = explicitExtraNotes;

  await requestJson(baseUrl, "/api/forge/runs", {
    method: "POST",
    body: JSON.stringify({
      id: runId,
      projectId,
      taskPackId: resolvedInputs?.taskPackId || undefined,
      linkedComponentIds,
      title: `${task?.title || command.name} · ${runner.name}`,
      executor: runner.name,
      cost: "$0.00",
      state: "running"
    })
  });

  await requestJson(baseUrl, "/api/forge/runners", {
    method: "POST",
    body: JSON.stringify({
      runnerId,
      status: "busy",
      currentRunId: runId,
      lastHeartbeat: now
    })
  });

  let commandResult;
  let executionStatus = "blocked";
  let finalRunnerStatus = "blocked";

  try {
    if (options.executePlan && !task) {
      const external = await executeExternalPlan(executionPlan);
      const externalSummary =
        (external?.data &&
        typeof external.data === "object" &&
        typeof external.data.summary === "string"
          ? external.data.summary
          : "") ||
        external.summary ||
        "";

      if (external.ok) {
        planExecution = {
          status: "succeeded",
          summary: externalSummary || "外部执行计划已完成。",
          mode:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.mode === "string"
              ? external.data.mode
              : "external-shell",
          evidenceStatus:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.evidenceStatus === "string"
              ? external.data.evidenceStatus
              : deriveEvidenceStatusFromMode(
                  external?.data &&
                    typeof external.data === "object" &&
                    typeof external.data.mode === "string"
                    ? external.data.mode
                    : ""
                ),
          evidenceLabel:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.evidenceLabel === "string"
              ? external.data.evidenceLabel
              : deriveEvidenceLabel(
                  external?.data &&
                    typeof external.data === "object" &&
                    typeof external.data.evidenceStatus === "string"
                    ? external.data.evidenceStatus
                    : deriveEvidenceStatusFromMode(
                        external?.data &&
                          typeof external.data === "object" &&
                          typeof external.data.mode === "string"
                          ? external.data.mode
                          : ""
                      )
                ),
          checks:
            normalizeEvidenceChecks(
              external?.data && typeof external.data === "object" ? external.data : null,
              external?.data &&
                typeof external.data === "object" &&
                Array.isArray(external.data.checks)
                ? external.data.checks
                : []
            )
        };
        runtimeExtraNotes = [explicitExtraNotes, formatRuntimeExtraNotes(external)]
          .filter(Boolean)
          .join(" | ");
      } else {
        planExecution = {
          status: "failed",
          summary: externalSummary || "外部执行计划失败。",
          mode:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.mode === "string"
              ? external.data.mode
              : "external-shell",
          evidenceStatus:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.evidenceStatus === "string"
              ? external.data.evidenceStatus
              : deriveEvidenceStatusFromMode(
                  external?.data &&
                    typeof external.data === "object" &&
                    typeof external.data.mode === "string"
                    ? external.data.mode
                    : ""
                ),
          evidenceLabel:
            external?.data &&
            typeof external.data === "object" &&
            typeof external.data.evidenceLabel === "string"
              ? external.data.evidenceLabel
              : deriveEvidenceLabel(
                  external?.data &&
                    typeof external.data === "object" &&
                    typeof external.data.evidenceStatus === "string"
                    ? external.data.evidenceStatus
                    : deriveEvidenceStatusFromMode(
                        external?.data &&
                          typeof external.data === "object" &&
                          typeof external.data.mode === "string"
                          ? external.data.mode
                          : ""
                      )
                ),
          checks:
            normalizeEvidenceChecks(
              external?.data && typeof external.data === "object" ? external.data : null,
              external?.data &&
                typeof external.data === "object" &&
                Array.isArray(external.data.checks)
                ? external.data.checks
                : []
            )
        };
        throw new Error(planExecution.summary);
      }
    }

    commandResult = task
      ? await requestJson(baseUrl, task.retryApiPath || "/api/forge/tasks/retry", {
          method: "POST",
          body: JSON.stringify({
            ...(task.retryApiPath === "/api/forge/remediations/retry"
              ? { remediationId: task.id }
              : { taskId: task.id }),
            triggeredBy
          })
        })
      : await requestJson(baseUrl, "/api/forge/commands", {
          method: "POST",
          body: JSON.stringify({
            mode: "execute",
            commandId: resolvedCommandId,
            projectId,
            taskPackId: resolvedInputs?.taskPackId || undefined,
            triggeredBy,
            extraNotes: runtimeExtraNotes || undefined
          })
        });
    executionStatus = commandResult.execution?.status || "blocked";
    finalRunnerStatus = executionStatus === "blocked" ? "blocked" : "idle";
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);

    await requestJson(baseUrl, "/api/forge/runs", {
      method: "POST",
      body: JSON.stringify({
        id: runId,
        projectId,
        taskPackId: resolvedInputs?.taskPackId || undefined,
        linkedComponentIds,
        title: `${task?.title || command.name} · ${runner.name}`,
        executor: runner.name,
        cost: "$0.00",
        state: "blocked",
        failureCategory: "unknown",
        failureSummary: summary,
        outputSummary: planExecution.status !== "planned" ? planExecution.summary : undefined,
        outputMode: planExecution.mode !== "planned" ? planExecution.mode : undefined,
        outputChecks: planExecution.checks
      })
    });

    await requestJson(baseUrl, "/api/forge/runners", {
      method: "POST",
      body: JSON.stringify({
        runnerId,
        status: "blocked",
        currentRunId: null,
        lastHeartbeat: new Date().toISOString()
      })
    });

    throw error;
  }

  await requestJson(baseUrl, "/api/forge/runs", {
    method: "POST",
    body: JSON.stringify({
      id: runId,
      projectId,
      taskPackId: resolvedInputs?.taskPackId || undefined,
      linkedComponentIds,
      title: `${task?.title || command.name} · ${runner.name}`,
      executor: runner.name,
      cost: "$0.00",
      state: executionStatus === "blocked" ? "blocked" : "done",
      failureCategory: executionStatus === "blocked" ? "unknown" : null,
      failureSummary:
        executionStatus === "blocked" ? commandResult?.execution?.summary || "命令执行被阻断。" : "",
      outputSummary: planExecution.status === "succeeded" ? planExecution.summary : undefined,
      outputMode: planExecution.mode,
      outputChecks: planExecution.checks
    })
  });

  await requestJson(baseUrl, "/api/forge/runners", {
    method: "POST",
    body: JSON.stringify({
      runnerId,
      status: finalRunnerStatus,
      currentRunId: null,
      lastHeartbeat: new Date().toISOString()
    })
  });

  return {
    runnerId,
    runId,
    commandId: resolvedCommandId,
    taskId: task?.id || null,
    runnerProfile: contract.runnerProfile,
    executionPlan,
    resolvedInputs,
    planExecution,
    executionStatus,
    finalRunnerStatus,
    commandResult
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseRunnerArgs(argv);
  const result = await executeRunnerCommand(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.executionStatus === "blocked") {
    process.exitCode = 1;
  }
}
