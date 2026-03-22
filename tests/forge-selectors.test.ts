import { deliveryGate, projects } from "../src/data/mock-data";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";
import {
  getArtifactHandoffQueue,
  getArtifactReviewChecklist,
  getArtifactReviewRecords,
  getActiveProject,
  getProjectWorkbenchAgent,
  getVisibleProjectWorkbenchNodes,
  getDeliveryReadinessSummary,
  getAgentTaskLoad,
  getBlockingTaskChain,
  getCurrentHandoffSummary,
  getDeliveryStateLabel,
  getEvidenceTimeline,
  getExecutionBlockers,
  getExecutionFocus,
  getExecutionTaskQueue,
  getComponentUsageSignals,
  getFormalArtifactResponsibilitySummary,
  getReleaseClosureSummary,
  getProjectTaskLoad,
  getRecentCommandExecutions,
  getRemediationTaskQueue,
  getTaskPackAssemblySuggestions,
  getMissingRequiredArtifacts,
  getProjectStageStateMachine,
  getProjectTaskQueue,
  getReleaseGateSummary,
  getStageAdmissionSummary,
  getTaskDispatchQueue,
  getProjectWorkflowStage
} from "../packages/core/src";

describe("forge selectors", () => {
  it("returns the first active project for the workspace focus", () => {
    expect(getActiveProject(projects)?.name).toBe("零售客服副驾驶");
  });

  it("marks the delivery state as blocked when any gate fails", () => {
    expect(getDeliveryStateLabel(deliveryGate)).toBe("已阻塞");
  });

  it("derives workflow stage from required artifacts and gate status", () => {
    expect(getProjectWorkflowStage(forgeSnapshotFixture, "retail-support")).toBe("测试验证");
  });

  it("builds a handoff queue from unfinished artifacts", () => {
    const queue = getArtifactHandoffQueue(forgeSnapshotFixture, "retail-support");

    expect(queue.map((item) => item.artifact.title)).toContain("退款失败流程 Demo 构建");
    expect(queue[0]?.nextAgent?.name).toBeTruthy();
    expect(queue[0]?.reviewerAgent?.name).toBeTruthy();
    expect(queue[0]?.escalationRule).toContain("升级");
    expect(queue[0]?.slaLabel).toContain("SLA");
    expect(queue[0]?.escalationOwner?.name).toBeTruthy();
  });

  it("resolves the workbench owner from the selected AI team", () => {
    expect(getProjectWorkbenchAgent(forgeSnapshotFixture, "retail-support", "DEMO测试")?.name).toBe(
      "现实校验 Agent"
    );
    expect(getProjectWorkbenchAgent(forgeSnapshotFixture, "retail-support", "内测调优")?.name).toBe(
      "现实校验 Agent"
    );
  });

  it("prefers explicit team workbench role assignments over default role matching", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      teamWorkbenchState: {
        managedAgents: [],
        roleAssignments: {
          pm: "agent-pm",
          architect: "agent-architect",
          design: "agent-design",
          engineer: "agent-pm",
          qa: "agent-design",
          release: "agent-pm",
          knowledge: "agent-qa"
        },
        manualSkillIdsByAgentId: {},
        manualKnowledgeSourcesByAgentId: {},
        removedPackSkillIdsByAgentId: {},
        equippedPackByAgentId: {},
        orgDepartments: [],
        orgChartMembers: [],
        customAbilityPacks: []
      }
    };

    expect(getProjectWorkbenchAgent(snapshot, "retail-support", "DEMO测试")?.id).toBe("agent-design");
    expect(getProjectWorkbenchAgent(snapshot, "retail-support", "后端研发")?.id).toBe("agent-pm");
  });

  it("derives visible workbench nodes and owners from custom team members", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      projectProfiles: forgeSnapshotFixture.projectProfiles.map((profile) =>
        profile.projectId === "retail-support"
          ? {
              ...profile,
              teamTemplateId: "team-custom-delivery",
              teamTemplateTitle: "定制交付团队"
            }
          : profile
      ),
      teamTemplates: [
        ...forgeSnapshotFixture.teamTemplates,
        {
          id: "team-custom-delivery",
          name: "定制交付团队",
          summary: "仅保留需求、研发和发布的轻量编制。",
          agentIds: ["agent-pm", "agent-dev", "agent-release"],
          leadAgentId: "agent-pm"
        }
      ],
      agents: [
        ...forgeSnapshotFixture.agents,
        {
          id: "agent-release",
          name: "交付 Agent",
          role: "release",
          runnerId: "runner-release",
          persona: "负责整理交付结果与放行节奏。",
          systemPrompt: "你是交付 Agent。",
          responsibilities: ["负责交付说明与放行节奏"],
          skillIds: [],
          sopIds: [],
          knowledgeSources: [],
          promptTemplateId: "prompt-release",
          policyId: "policy-release",
          permissionProfileId: "perm-review",
          ownerMode: "review-required"
        }
      ]
    };

    expect(getVisibleProjectWorkbenchNodes(snapshot, "retail-support")).toEqual([
      "需求确认",
      "后端研发",
      "交付发布"
    ]);
    expect(getProjectWorkbenchAgent(snapshot, "retail-support", "后端研发")?.name).toBe("研发 Agent");
  });

  it("reports missing artifacts required for the current stage", () => {
    const missingArtifacts = getMissingRequiredArtifacts(forgeSnapshotFixture, "retail-support");

    expect(missingArtifacts.map((item) => item.type)).toEqual(expect.arrayContaining(["test-report"]));
  });

  it("summarizes stage admission blockers", () => {
    const summary = getStageAdmissionSummary(forgeSnapshotFixture, "retail-support");

    expect(summary.stage).toBe("测试验证");
    expect(summary.blockers.join(" / ")).toContain("测试报告");
  });

  it("carries model execution provider context into replay-oriented selector outputs", () => {
    const providerSnapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行" as const,
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-dev",
          status: "todo" as const,
          priority: "P2" as const,
          category: "review" as const,
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        }
      ],
      commands: [
        {
          id: "command-review-run",
          name: "发起规则审查",
          type: "review.run" as const,
          summary: "由 Reviewer Runner 审查 Patch 与 Demo，生成规则审查记录并移交 QA。",
          triggerStage: "开发执行" as const,
          requiresArtifacts: ["patch"]
        },
        ...forgeSnapshotFixture.commands
      ],
      commandExecutions: [
        ...forgeSnapshotFixture.commandExecutions,
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          status: "blocked" as const,
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          createdAt: "今天 10:47",
          followUpTaskIds: ["task-retail-review-remediation"]
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs,
        {
          id: "run-retail-review",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          linkedComponentIds: ["component-auth-email"],
          title: "执行退款失败补丁规则审查",
          executor: "Reviewer",
          cost: "$0.28",
          state: "done" as const,
          outputMode: "review-ready",
          outputChecks: [
            {
              name: "model-execution",
              status: "pass",
              summary:
                "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
            },
            { name: "evidence", status: "tool-ready", summary: "已检测到外部审查执行器" }
          ]
        }
      ]
    };

    const remediation = getRemediationTaskQueue(providerSnapshot, "retail-support").find(
      (item) => item.id === "task-retail-review-remediation"
    );
    const dispatchTask = getTaskDispatchQueue(providerSnapshot).find(
      (item) => item.task.id === "task-retail-review-remediation"
    );
    const recentExecution = getRecentCommandExecutions(providerSnapshot, "retail-support").find(
      (item) => item.commandId === "command-review-run"
    );

    expect(remediation?.runtimeModelProviderLabel).toBe("Claude Code Review");
    expect(remediation?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(remediation?.runtimeModelExecutionDetail).toBe(
      "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
    );
    expect(remediation?.remediationAction).toContain("模型执行器：Claude Code Review");
    expect(remediation?.remediationAction).toContain("执行后端：OpenClaw");
    expect(dispatchTask?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(dispatchTask?.remediationAction).toContain("执行后端：OpenClaw");
    expect(recentExecution?.runtimeModelProviderLabel).toBe("Claude Code Review");
    expect(recentExecution?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(recentExecution?.runtimeModelExecutionDetail).toBe(
      "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
    );
    expect(recentExecution?.followUpTasks[0]?.runtimeModelProviderLabel).toBe("Claude Code Review");
    expect(recentExecution?.followUpTasks[0]?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(recentExecution?.followUpTasks[0]?.remediationAction).toContain(
      "模型执行器：Claude Code Review"
    );
    expect(recentExecution?.followUpTasks[0]?.remediationAction).toContain("执行后端：OpenClaw");
  });

  it("prefers running work as the execution focus and reports blockers", () => {
    const focus = getExecutionFocus(forgeSnapshotFixture);
    const blockers = getExecutionBlockers(forgeSnapshotFixture);

    expect(focus?.title).toBe("生成退款失败补丁");
    expect(blockers.join(" / ")).toContain("Playwright");
  });

  it("falls back to the project owner when a task owner label cannot be resolved", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      tasks: forgeSnapshotFixture.tasks.map((task, index) =>
        index === 0
          ? {
              ...task,
              ownerAgentId: "legacy-owner"
            }
          : task
      )
    };

    const queue = getExecutionTaskQueue(snapshot);

    expect(queue[0]?.remediationOwnerLabel).toBe("Iris");
    expect(queue[0]?.remediationAction).toContain("由 Iris");
  });

  it("builds a prioritized execution task queue across active projects", () => {
    const queue = getExecutionTaskQueue(forgeSnapshotFixture);

    expect(queue[0]?.priorityLabel).toBe("P0");
    expect(queue[0]?.project.name).toBe("零售客服副驾驶");
    expect(queue[0]?.action).toContain("解除阻塞");
    expect(queue[0]?.sourceCommandLabel).toBe("发起测试门禁");
    expect(queue[0]?.sourceCommandExecutionId).toBe("command-execution-gate-run");
    expect(queue[0]?.relatedArtifactLabels).toEqual([]);
    expect(queue[0]?.missingArtifactLabels).toEqual(
      expect.arrayContaining(["测试报告", "Playwright 回归记录"])
    );
    expect(queue[0]?.relatedRunId).toBe("run-retail-playwright");
    expect(queue[0]?.relatedRunLabel).toContain("主流程回归验证");
    expect(queue[0]?.runtimeLabel).toContain("playwright-ready");
    expect(queue[0]?.remediationOwnerLabel).toBe("测试工程师 · Owl");
    expect(queue[0]?.remediationSummary).toContain("优先补齐");
    expect(queue[0]?.remediationAction).toContain("由 测试工程师 · Owl 补齐");
    expect(queue[0]?.retryCommandId).toBe("command-gate-run");
    expect(queue[0]?.retryCommandLabel).toBe("发起测试门禁");
    expect(queue[0]?.retryRunnerCommand).toBe(
      "npm run runner:forge -- --task-id task-retail-playwright --project-id retail-support --taskpack-id artifact-task-pack"
    );
    expect(queue[0]?.evidenceAction).toContain("证据缺口");
  });

  it("builds cross-project task center summaries", () => {
    const dispatchQueue = getTaskDispatchQueue(forgeSnapshotFixture);
    const blockingTaskChain = getBlockingTaskChain(forgeSnapshotFixture, "retail-support");
    const projectLoad = getProjectTaskLoad(forgeSnapshotFixture);
    const agentLoad = getAgentTaskLoad(forgeSnapshotFixture);
    const gateTask = blockingTaskChain.find((item) => item.title === "修复 Playwright 失败并重新回归");

    expect(dispatchQueue[0]?.task.title).toBe("修复 Playwright 失败并重新回归");
    expect(dispatchQueue[0]?.project?.name).toBe("零售客服副驾驶");
    expect(gateTask?.sourceCommandLabel).toBe("发起测试门禁");
    expect(gateTask?.evidenceAction).toContain("证据缺口");
    expect(gateTask?.relatedRunId).toBe("run-retail-playwright");
    expect(gateTask?.remediationOwnerLabel).toBe("测试工程师 · Owl");
    expect(gateTask?.remediationSummary).toContain("登录态失效");
    expect(gateTask?.remediationAction).toContain("由 测试工程师 · Owl 补齐");
    expect(gateTask?.retryCommandId).toBe("command-gate-run");
    expect(gateTask?.retryRunnerCommand).toContain("--task-id task-retail-playwright");
    expect(projectLoad[0]?.project.name).toBe("零售客服副驾驶");
    expect(projectLoad[0]?.blockedCount).toBe(1);
    expect(agentLoad[0]?.agent.name).toBe("现实校验 Agent");
    expect(agentLoad[0]?.capacityLabel).toBeTruthy();
  });

  it("builds taskpack-driven component assembly suggestions", () => {
    const result = getTaskPackAssemblySuggestions(forgeSnapshotFixture, "retail-support", "artifact-task-pack");

    expect(result.project?.id).toBe("retail-support");
    expect(result.taskPack?.id).toBe("artifact-task-pack");
    expect(result.items[0]?.component.id).toBe("component-payment-checkout");
    expect(result.items[0]?.reason).toContain("TaskPack");
    expect(result.items.some((item) => item.component.id === "component-auth-email")).toBe(true);
  });

  it("derives component usage signals from linked runs", () => {
    const signals = getComponentUsageSignals(forgeSnapshotFixture, "retail-support");
    const paymentSignal = signals.find((item) => item.component.id === "component-payment-checkout");
    const authSignal = signals.find((item) => item.component.id === "component-auth-email");

    expect(paymentSignal?.usageCount).toBe(1);
    expect(paymentSignal?.successCount).toBe(0);
    expect(paymentSignal?.blockedCount).toBe(1);
    expect(paymentSignal?.runningCount).toBe(0);
    expect(paymentSignal?.lastRunTitle).toContain("主流程回归验证");
    expect(paymentSignal?.lastFailureSummary).toContain("登录态失效");
    expect(authSignal?.usageCount).toBe(1);
    expect(authSignal?.successCount).toBe(0);
    expect(authSignal?.blockedCount).toBe(0);
    expect(authSignal?.runningCount).toBe(1);
    expect(authSignal?.lastRunTitle).toContain("生成退款失败补丁");
  });

  it("builds a formal stage state machine and a project task queue", () => {
    const stageMachine = getProjectStageStateMachine(forgeSnapshotFixture, "retail-support");
    const projectTasks = getProjectTaskQueue(forgeSnapshotFixture, "retail-support");

    expect(stageMachine).toHaveLength(6);
    expect(stageMachine.find((item) => item.stage === "测试验证")?.state).toBe("blocked");
    expect(projectTasks[0]?.projectId).toBe("retail-support");
    expect(projectTasks[0]?.priority).toBe("P0");
    expect(projectTasks[0]?.sourceCommandLabel).toBe("发起测试门禁");
    expect(projectTasks[0]?.sourceCommandExecutionId).toBe("command-execution-gate-run");
    expect(projectTasks[0]?.missingArtifactLabels).toEqual(
      expect.arrayContaining(["测试报告", "Playwright 回归记录"])
    );
    expect(projectTasks[0]?.relatedRunId).toBe("run-retail-playwright");
    expect(projectTasks[0]?.runtimeLabel).toContain("playwright-ready");
    expect(projectTasks[0]?.remediationOwnerLabel).toBe("测试工程师 · Owl");
    expect(projectTasks[0]?.remediationSummary).toContain("优先补齐");
    expect(projectTasks[0]?.remediationAction).toContain("由 测试工程师 · Owl 补齐");
    expect(projectTasks[0]?.retryCommandLabel).toBe("发起测试门禁");
    expect(projectTasks[0]?.retryRunnerCommand).toContain("--project-id retail-support");
    expect(projectTasks[0]?.summary).toContain("证据缺口");
  });

  it("prefers persisted workflow state over derived stage inference", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      workflowStates: [
        {
          projectId: "retail-support",
          currentStage: "开发执行" as const,
          state: "blocked" as const,
          blockers: ["等待研发补丁重新提交"],
          lastTransitionAt: "今天 11:12",
          updatedBy: "pm"
        }
      ],
      workflowTransitions: [
        {
          id: "transition-retail-dev",
          projectId: "retail-support",
          stage: "开发执行" as const,
          state: "blocked" as const,
          updatedBy: "pm",
          blockers: ["等待研发补丁重新提交"],
          createdAt: "今天 11:12"
        }
      ]
    };

    expect(getProjectWorkflowStage(snapshot, "retail-support")).toBe("开发执行");
    expect(getStageAdmissionSummary(snapshot, "retail-support").blockers).toContain(
      "等待研发补丁重新提交"
    );
  });

  it("returns artifact review records and checklist for the active project", () => {
    const reviews = getArtifactReviewRecords(forgeSnapshotFixture, "retail-support");
    const checklist = getArtifactReviewChecklist(forgeSnapshotFixture, "retail-support");

    expect(reviews[0]?.artifact.title).toBeTruthy();
    expect(reviews[0]?.reviewer.name).toBeTruthy();
    expect(checklist[0]?.conditions.length).toBeGreaterThan(0);
  });

  it("builds evidence timeline, delivery readiness and release gate summaries", () => {
    const readySnapshot = {
      ...forgeSnapshotFixture,
      deliveryGate: forgeSnapshotFixture.deliveryGate.map((gate) => ({
        ...gate,
        status: "pass" as const
      })),
      workflowStates: [
        {
          projectId: "retail-support",
          currentStage: "交付发布" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 11:18",
          updatedBy: "release"
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter((item) => item.projectId !== "retail-support"),
        {
          id: "artifact-patch-retail",
          projectId: "retail-support",
          type: "patch" as const,
          title: "退款失败补丁 Patch",
          ownerAgentId: "agent-dev",
          status: "ready" as const,
          updatedAt: "今天 10:41"
        },
        {
          id: "artifact-demo-retail",
          projectId: "retail-support",
          type: "demo-build" as const,
          title: "退款失败流程 Demo 构建",
          ownerAgentId: "agent-dev",
          status: "ready" as const,
          updatedAt: "今天 10:42"
        },
        {
          id: "artifact-test-retail",
          projectId: "retail-support",
          type: "test-report" as const,
          title: "退款失败流程 测试报告",
          ownerAgentId: "agent-qa",
          status: "ready" as const,
          updatedAt: "今天 10:58"
        },
        {
          id: "artifact-playwright-retail",
          projectId: "retail-support",
          type: "playwright-run" as const,
          title: "退款失败流程 Playwright 回归记录",
          ownerAgentId: "agent-qa",
          status: "ready" as const,
          updatedAt: "今天 10:57"
        },
        {
          id: "artifact-release-retail",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "退款失败流程 交付说明",
          ownerAgentId: "agent-release",
          status: "ready" as const,
          updatedAt: "今天 11:05"
        },
        {
          id: "artifact-review-retail",
          projectId: "retail-support",
          type: "review-decision" as const,
          title: "退款失败流程 放行评审结论",
          ownerAgentId: "agent-pm",
          status: "ready" as const,
          updatedAt: "今天 11:08"
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs.filter((item) => item.projectId !== "retail-support"),
        {
          id: "run-retail-review-ready",
          projectId: "retail-support",
          title: "退款失败流程 规则审查",
          executor: "代码评审执行器",
          cost: "$0.00",
          state: "done" as const,
          outputMode: "review-ready",
          outputChecks: [{ name: "git", status: "pass" }]
        },
        {
          id: "run-retail-qa-ready",
          projectId: "retail-support",
          title: "退款失败流程 测试门禁",
          executor: "浏览器验证执行器",
          cost: "$0.00",
          state: "done" as const,
          outputMode: "playwright-ready",
          outputChecks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
        }
      ]
    };

    const timeline = getEvidenceTimeline(readySnapshot, "retail-support");
    const readiness = getDeliveryReadinessSummary(readySnapshot, "retail-support");
    const gateSummary = getReleaseGateSummary(readySnapshot, "retail-support");

    expect(timeline[0]?.artifact.type).toBe("review-decision");
    expect(timeline.some((item) => item.artifact.type === "patch")).toBe(true);
    expect(timeline.some((item) => item.runtimeLabel?.includes("Runtime:"))).toBe(true);
    expect(readiness.statusLabel).toBe("可交付");
    expect(readiness.missingEvidence).toHaveLength(0);
    expect(readiness.runtimeNotes).toEqual(
      expect.arrayContaining([expect.stringContaining("playwright-ready")])
    );
    expect(readiness.runtimeCapabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(gateSummary.overallLabel).toBe("可放行");
    expect(gateSummary.missingItems).toHaveLength(0);
    expect(gateSummary.approvalTrace.length).toBeGreaterThan(0);
    expect(gateSummary.approvalTrace.some((item) => item.kind === "runtime")).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.kind === "review")).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.ownerLabel)).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.ownerRoleLabel)).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.slaLabel)).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.escalationLabel)).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.breachLabel)).toBe(true);
    expect(gateSummary.approvalTrace.some((item) => item.escalationTrigger)).toBe(true);
    expect(
      gateSummary.approvalTrace.some(
        (item) =>
          (item.artifactType === "release-brief" || item.artifactType === "review-decision") &&
          Boolean(item.nextAction)
      )
    ).toBe(true);
    expect(gateSummary.escalationActions.length).toBeGreaterThan(0);
    expect(gateSummary.escalationActions.some((item) => item.ownerLabel)).toBe(true);
    expect(gateSummary.escalationActions.some((item) => item.nextAction)).toBe(true);
    expect(gateSummary.escalationActions.some((item) => item.blocking === false)).toBe(true);
    expect(
      gateSummary.escalationActions.some((item) =>
        item.runtimeEvidenceLabel?.includes("Version 1.55.0")
      )
    ).toBe(true);
    expect(gateSummary.escalationActions.some((item) => Boolean(item.taskId))).toBe(true);
    expect(
      gateSummary.escalationActions.some(
        (item) => item.retryApiPath === "/api/forge/escalations/retry"
      )
    ).toBe(true);
    expect(
      gateSummary.escalationActions.some(
        (item) => item.unifiedRetryApiPath === "/api/forge/remediations/retry"
      )
    ).toBe(true);
    expect(
      gateSummary.escalationActions.some((item) =>
        item.unifiedRetryRunnerCommand?.includes("--remediation-id task-retail-playwright")
      )
    ).toBe(true);
  });

  it("surfaces bridge handoff progress in readiness and release gate summaries", () => {
    const bridgeHandoffSnapshot = {
      ...forgeSnapshotFixture,
      workflowStates: [
        {
          projectId: "retail-support",
          currentStage: "测试验证" as const,
          state: "current" as const,
          blockers: ["测试报告 尚未齐备", "Playwright 回归记录 尚未齐备"],
          lastTransitionAt: "今天 11:28",
          updatedBy: "architect"
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) => item.projectId !== "retail-support" || item.type !== "review-report"
        ),
        {
          id: "artifact-review-retail-bridge",
          projectId: "retail-support",
          type: "review-report" as const,
          title: "退款失败流程 Bridge 规则审查记录",
          ownerAgentId: "agent-architect",
          status: "ready" as const,
          updatedAt: "今天 11:28"
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks.filter((item) => item.id !== "task-retail-support-qa-gate"),
        {
          id: "task-retail-support-qa-gate",
          projectId: "retail-support",
          stage: "测试验证" as const,
          title: "执行 Playwright 门禁与人工复核",
          ownerAgentId: "agent-qa",
          status: "in-progress" as const,
          priority: "P0" as const,
          category: "execution" as const,
          summary: "外部执行桥已产出规则审查记录，等待 QA 执行门禁、浏览器回归和人工复核。"
        }
      ],
      commandExecutions: [
        ...forgeSnapshotFixture.commandExecutions.filter(
          (item) => item.id !== "command-execution-retail-bridge-review"
        ),
        {
          id: "command-execution-retail-bridge-review",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          relatedRunId: "run-retail-bridge-review",
          status: "done" as const,
          summary: "外部桥已完成规则审查，移交 QA。",
          triggeredBy: "架构师 Agent",
          followUpTaskIds: ["task-retail-support-qa-gate"],
          createdAt: "今天 11:28"
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs.filter((item) => item.projectId !== "retail-support"),
        {
          id: "run-retail-bridge-review",
          projectId: "retail-support",
          title: "退款失败流程 外部桥规则审查",
          executor: "OpenClaw Bridge",
          cost: "$0.18",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code Review · openclaw run-review"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        }
      ]
    };

    const readiness = getDeliveryReadinessSummary(bridgeHandoffSnapshot, "retail-support");
    const gateSummary = getReleaseGateSummary(bridgeHandoffSnapshot, "retail-support");

    expect(readiness.bridgeHandoffStatus).toBe("qa-handoff");
    expect(readiness.bridgeHandoffSummary).toContain("已移交 QA 门禁");
    expect(readiness.summary).toContain("已移交 QA 门禁");
    expect(gateSummary.bridgeHandoffStatus).toBe("qa-handoff");
    expect(gateSummary.bridgeHandoffSummary).toContain("已移交 QA 门禁");
    expect(gateSummary.summary).toContain("已移交 QA 门禁");
    expect(gateSummary.formalArtifactGap).toEqual({
      missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
      missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
      summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
      ownerLabel: "测试工程师 · Owl",
      ownerRoleLabel: "测试",
      nextAction: "桥接评审已移交 QA，先由测试工程师 · Owl 补齐测试报告 / Playwright 回归记录。"
    });
    expect(gateSummary.bridgeReviewCommandId).toBe("command-review-run");
    expect(gateSummary.bridgeReviewRunId).toBe("run-retail-bridge-review");
    expect(gateSummary.bridgeReviewRunLabel).toContain("外部桥规则审查");
    expect(
      gateSummary.approvalTrace.some(
        (item) =>
          item.sourceCommandId === "command-review-run" &&
          item.relatedRunId === "run-retail-bridge-review"
      )
    ).toBe(true);
    expect(
      gateSummary.escalationActions.some(
        (item) =>
          item.sourceCommandId === "command-review-run" &&
          item.relatedRunId === "run-retail-bridge-review"
      )
    ).toBe(true);
    expect(
      gateSummary.escalationActions.some(
        (item) =>
          item.label === "交付说明 · 缺失" &&
          item.ownerLabel === "测试工程师 · Owl" &&
          item.ownerRoleLabel === "测试" &&
          item.nextAction === "桥接评审已移交 QA，先由测试工程师 · Owl 补齐测试报告 / Playwright 回归记录。"
      )
    ).toBe(true);
    expect(
      getRemediationTaskQueue(bridgeHandoffSnapshot, "retail-support").some(
        (item) =>
          item.bridgeHandoffStatus === "qa-handoff" &&
          item.bridgeHandoffSummary?.includes("已移交 QA 门禁")
      )
    ).toBe(true);
  });

  it("derives a structured current handoff summary for bridge-aware qa handoff", () => {
    const bridgeHandoffSnapshot = {
      ...forgeSnapshotFixture,
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) =>
            item.projectId !== "retail-support" ||
            (item.type !== "review-report" &&
              item.type !== "test-report" &&
              item.type !== "playwright-run")
        ),
        {
          id: "artifact-review-retail-bridge",
          projectId: "retail-support",
          type: "review-report" as const,
          title: "桥接规则审查记录",
          ownerAgentId: "agent-qa",
          status: "ready" as const,
          updatedAt: "今天 17:18"
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates.filter((item) => item.projectId !== "retail-support"),
        {
          projectId: "retail-support",
          currentStage: "测试验证" as const,
          state: "current" as const,
          blockers: ["测试报告 尚未齐备", "Playwright 门禁待确认"],
          lastTransitionAt: "今天 17:22",
          updatedBy: "QA Agent"
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks.filter((item) => item.projectId !== "retail-support"),
        {
          id: "task-retail-support-qa-gate",
          projectId: "retail-support",
          stage: "测试验证" as const,
          title: "执行 Playwright 门禁与人工复核",
          ownerAgentId: "agent-qa",
          status: "in-progress" as const,
          priority: "P0" as const,
          category: "execution" as const,
          summary: "外部执行桥已产出规则审查记录，等待 QA 执行门禁、浏览器回归和人工复核。"
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs.filter((item) => item.projectId !== "retail-support"),
        {
          id: "run-retail-bridge-review",
          projectId: "retail-support",
          title: "退款失败流程 外部桥规则审查",
          executor: "OpenClaw Bridge",
          cost: "$0.18",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code Review · openclaw run-review"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        }
      ]
    };

    const currentHandoff = getCurrentHandoffSummary(bridgeHandoffSnapshot, "retail-support");

    expect(currentHandoff.stage).toBe("测试验证");
    expect(currentHandoff.source).toBe("qa-handoff");
    expect(currentHandoff.bridgeHandoffStatus).toBe("qa-handoff");
    expect(currentHandoff.ownerLabel).toBe("测试工程师 · Owl");
    expect(currentHandoff.ownerRoleLabel).toBe("测试");
    expect(currentHandoff.nextAction).toContain("桥接评审已移交 QA");
    expect(currentHandoff.nextAction).toContain("先由测试工程师 · Owl 补齐");
    expect(currentHandoff.nextAction).toContain("测试报告 / Playwright 回归记录");
  });

  it("surfaces a structured review handoff after engineer bridge writeback", () => {
    const bridgeHandoffSnapshot = {
      ...forgeSnapshotFixture,
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) =>
            item.projectId !== "retail-support" ||
            (item.type !== "patch" && item.type !== "demo-build" && item.type !== "review-report")
        ),
        {
          id: "artifact-patch-retail-bridge",
          projectId: "retail-support",
          type: "patch" as const,
          title: "桥接退款失败补丁",
          ownerAgentId: "agent-engineer",
          status: "in-review" as const,
          updatedAt: "今天 16:52"
        },
        {
          id: "artifact-demo-retail-bridge",
          projectId: "retail-support",
          type: "demo-build" as const,
          title: "桥接退款失败 Demo",
          ownerAgentId: "agent-engineer",
          status: "in-review" as const,
          updatedAt: "今天 16:53"
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates.filter((item) => item.projectId !== "retail-support"),
        {
          projectId: "retail-support",
          currentStage: "开发执行" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 16:54",
          updatedBy: "Engineer Agent"
        }
      ],
      tasks: forgeSnapshotFixture.tasks.filter((item) => item.projectId !== "retail-support"),
      runs: [
        ...forgeSnapshotFixture.runs.filter((item) => item.projectId !== "retail-support"),
        {
          id: "run-retail-bridge-engineer",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          title: "退款失败流程 外部桥研发执行",
          executor: "OpenClaw Bridge",
          cost: "$0.16",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code · openclaw run"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        }
      ]
    };

    const readiness = getDeliveryReadinessSummary(bridgeHandoffSnapshot, "retail-support");
    const currentHandoff = getCurrentHandoffSummary(bridgeHandoffSnapshot, "retail-support");

    expect(readiness.bridgeHandoffStatus).toBe("review-handoff");
    expect(readiness.bridgeHandoffSummary).toContain("等待规则审查");
    expect(currentHandoff.source).toBe("review-handoff");
    expect(currentHandoff.bridgeHandoffStatus).toBe("review-handoff");
    expect(currentHandoff.ownerLabel).toBe("技术架构师 · Eagle");
    expect(currentHandoff.ownerRoleLabel).toBe("架构师");
    expect(currentHandoff.nextAction).toContain("发起规则审查");
    expect(currentHandoff.nextAction).toContain("规则审查记录");
  });

  it("promotes release candidate bridge handoff into approval when release approval is pending", () => {
    const approvalSnapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks.filter(
          (item) => item.projectId !== "retail-support" || item.id !== "task-retail-support-release-approval"
        ),
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "交付发布" as const,
          title: "确认交付说明与放行口径",
          ownerAgentId: "agent-pm",
          status: "todo" as const,
          priority: "P0" as const,
          category: "review" as const,
          summary: "负责人需要确认交付说明、验收范围和发布口径。"
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates.filter((item) => item.projectId !== "retail-support"),
        {
          projectId: "retail-support",
          currentStage: "交付发布" as const,
          state: "blocked" as const,
          blockers: ["等待人工确认交付说明"],
          lastTransitionAt: "今天 19:30",
          updatedBy: "release"
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) =>
            item.projectId !== "retail-support" ||
            (item.type !== "release-brief" && item.type !== "review-decision")
        ),
        {
          id: "artifact-release-brief-retail-bridge",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "退款失败流程 交付说明",
          ownerAgentId: "agent-release",
          status: "in-review" as const,
          updatedAt: "今天 19:28"
        },
        {
          id: "artifact-review-decision-retail-bridge",
          projectId: "retail-support",
          type: "review-decision" as const,
          title: "退款失败流程 放行评审",
          ownerAgentId: "agent-release",
          status: "in-review" as const,
          updatedAt: "今天 19:29"
        }
      ],
      artifactReviews: [
        ...forgeSnapshotFixture.artifactReviews.filter(
          (item) => item.artifactId !== "artifact-release-brief-retail-bridge"
        ),
        {
          artifactId: "artifact-release-brief-retail-bridge",
          reviewerAgentId: "agent-pm",
          decision: "pending" as const,
          summary: "交付说明已整理，等待负责人确认验收口径与放行条件。",
          reviewedAt: "今天 19:29"
        }
      ]
    };

    const currentHandoff = getCurrentHandoffSummary(approvalSnapshot, "retail-support");
    const approvalTrace = getReleaseGateSummary(approvalSnapshot, "retail-support").approvalTrace;
    const releaseBriefTrace = approvalTrace.find((item) => item.artifactType === "release-brief");
    const reviewDecisionTrace = approvalTrace.find((item) => item.artifactType === "review-decision");

    expect(currentHandoff.stage).toBe("交付发布");
    expect(currentHandoff.source).toBe("approval");
    expect(currentHandoff.ownerLabel).toBe("产品总监 · Elephant");
    expect(currentHandoff.ownerRoleLabel).toBe("产品经理");
    expect(currentHandoff.nextAction).toBe("确认交付说明与放行口径");
    expect(releaseBriefTrace?.nextAction).toBe("确认交付说明与放行口径");
    expect(reviewDecisionTrace?.nextAction).toBe("确认交付说明与放行口径");
  });

  it("prioritizes the knowledge capture task in archive stage handoff", () => {
    const archiveSnapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks.filter(
          (item) => item.projectId !== "retail-support" || item.id !== "task-retail-support-knowledge-card"
        ),
        {
          id: "task-retail-support-knowledge-card",
          projectId: "retail-support",
          stage: "归档复用" as const,
          title: "沉淀交付知识卡",
          ownerAgentId: "agent-knowledge",
          status: "todo" as const,
          priority: "P2" as const,
          category: "knowledge" as const,
          summary: "基于交付说明和测试结果提炼知识卡、模板和复用建议。"
        }
      ],
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates.filter((item) => item.projectId !== "retail-support"),
        {
          projectId: "retail-support",
          currentStage: "归档复用" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 20:30",
          updatedBy: "pm"
        }
      ]
    };

    const currentHandoff = getCurrentHandoffSummary(archiveSnapshot, "retail-support");

    expect(currentHandoff.stage).toBe("归档复用");
    expect(currentHandoff.source).toBe("stage-default");
    expect(currentHandoff.ownerLabel).toBe("知识运营专员 · Panda");
    expect(currentHandoff.ownerRoleLabel).toBe("知识沉淀");
    expect(currentHandoff.nextAction).toBe("沉淀交付知识卡");
  });

  it("uses archive command provenance for release-audit approval trace entries", () => {
    const archiveSnapshot = {
      ...forgeSnapshotFixture,
      workflowStates: [
        ...forgeSnapshotFixture.workflowStates.filter((item) => item.projectId !== "retail-support"),
        {
          projectId: "retail-support",
          currentStage: "归档复用" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 20:30",
          updatedBy: "pm"
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) =>
            item.projectId !== "retail-support" ||
            (item.type !== "release-audit" && item.type !== "knowledge-card")
        ),
        {
          id: "artifact-retail-release-audit",
          projectId: "retail-support",
          type: "release-audit" as const,
          title: "零售客服副驾驶 归档审计记录",
          ownerAgentId: "agent-knowledge",
          status: "ready" as const,
          updatedAt: "今天 20:35"
        },
        {
          id: "artifact-retail-knowledge-card",
          projectId: "retail-support",
          type: "knowledge-card" as const,
          title: "零售客服副驾驶 交付知识卡",
          ownerAgentId: "agent-knowledge",
          status: "ready" as const,
          updatedAt: "今天 20:35"
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks.filter(
          (item) => item.projectId !== "retail-support" || item.id !== "task-retail-support-knowledge-card"
        ),
        {
          id: "task-retail-support-knowledge-card",
          projectId: "retail-support",
          stage: "归档复用" as const,
          title: "沉淀交付知识卡",
          ownerAgentId: "agent-knowledge",
          status: "done" as const,
          priority: "P2" as const,
          category: "knowledge" as const,
          summary: "交付知识卡、归档审计和复用建议已沉淀完成。"
        }
      ],
      commandExecutions: [
        ...forgeSnapshotFixture.commandExecutions,
        {
          id: "command-execution-retail-archive",
          commandId: "command-archive-capture",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          relatedRunId: "run-retail-archive-bridge",
          status: "done" as const,
          summary: "外部桥已完成归档沉淀，知识卡与归档审计已写回。",
          triggeredBy: "知识沉淀 Agent",
          followUpTaskIds: ["task-retail-support-knowledge-card"],
          createdAt: "今天 20:35"
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs,
        {
          id: "run-retail-archive-bridge",
          projectId: "retail-support",
          title: "零售客服副驾驶 外部桥归档沉淀",
          executor: "OpenClaw Bridge",
          cost: "$0.12",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code Archive · openclaw run-archive"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        }
      ]
    };

    const gateSummary = getReleaseGateSummary(archiveSnapshot, "retail-support");
    const releaseAuditTrace = gateSummary.approvalTrace.find((item) => item.artifactType === "release-audit");

    expect(gateSummary.approvalHandoff.summary).toBe("确认后将继续进入归档沉淀。");
    expect(gateSummary.approvalHandoff.detail).toContain(
      "确认交付说明与放行口径后，继续沉淀知识卡与归档审计。"
    );
    expect(releaseAuditTrace?.sourceCommandId).toBe("command-archive-capture");
    expect(releaseAuditTrace?.relatedRunId).toBe("run-retail-archive-bridge");
    expect(releaseAuditTrace?.relatedRunLabel).toContain("外部桥归档沉淀");
  });

  it("builds a formal artifact responsibility summary from coverage gap approvals and provenance", () => {
    const archiveSnapshot = {
      ...forgeSnapshotFixture,
      artifacts: [
        ...forgeSnapshotFixture.artifacts.filter(
          (item) =>
            item.projectId !== "retail-support" ||
            !["release-brief", "review-decision", "release-audit", "knowledge-card"].includes(item.type)
        ),
        {
          id: "artifact-retail-release-brief",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "零售客服副驾驶 交付说明",
          ownerAgentId: "agent-release",
          status: "ready" as const,
          updatedAt: "今天 20:10"
        },
        {
          id: "artifact-retail-review-decision",
          projectId: "retail-support",
          type: "review-decision" as const,
          title: "零售客服副驾驶 放行评审结论",
          ownerAgentId: "agent-pm",
          status: "ready" as const,
          updatedAt: "今天 20:12"
        },
        {
          id: "artifact-retail-release-audit",
          projectId: "retail-support",
          type: "release-audit" as const,
          title: "零售客服副驾驶 归档审计记录",
          ownerAgentId: "agent-knowledge",
          status: "ready" as const,
          updatedAt: "今天 20:35"
        },
        {
          id: "artifact-retail-knowledge-card",
          projectId: "retail-support",
          type: "knowledge-card" as const,
          title: "零售客服副驾驶 交付知识卡",
          ownerAgentId: "agent-knowledge",
          status: "ready" as const,
          updatedAt: "今天 20:35"
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks.filter(
          (item) =>
            item.projectId !== "retail-support" || item.id !== "task-retail-support-release-approval"
        ),
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "人工确认" as const,
          title: "确认交付说明与放行口径",
          ownerAgentId: "agent-pm",
          status: "in-progress" as const,
          priority: "P0" as const,
          category: "approval" as const,
          summary: "发布链已经进入人工确认，需确认交付说明与最终放行口径。"
        }
      ],
      commands: [
        ...forgeSnapshotFixture.commands,
        {
          id: "command-release-prepare",
          name: "整理交付说明",
          type: "release.prepare" as const,
          summary: "基于 Demo、测试结果和验收口径生成交付说明。",
          triggerStage: "交付发布" as const,
          requiresArtifacts: ["demo-build", "test-report"]
        },
        {
          id: "command-archive-capture",
          name: "触发归档沉淀",
          type: "archive.capture" as const,
          summary: "归档最终版本、放行结论与复用知识卡。",
          triggerStage: "归档复用" as const,
          requiresArtifacts: ["release-brief", "knowledge-card"]
        }
      ],
      commandExecutions: [
        ...forgeSnapshotFixture.commandExecutions,
        {
          id: "command-execution-retail-release-prepare",
          commandId: "command-release-prepare",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          relatedRunId: "run-retail-release-prepare-bridge",
          status: "done" as const,
          summary: "外部桥已完成交付说明整理，并准备进入归档沉淀。",
          triggeredBy: "交付编排执行器",
          followUpTaskIds: ["task-retail-support-release-approval"],
          createdAt: "今天 20:10"
        },
        {
          id: "command-execution-retail-archive",
          commandId: "command-archive-capture",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          relatedRunId: "run-retail-archive-bridge",
          status: "done" as const,
          summary: "外部桥已完成归档沉淀，知识卡与归档审计已写回。",
          triggeredBy: "知识沉淀 Agent",
          followUpTaskIds: ["task-retail-support-release-approval"],
          createdAt: "今天 20:35"
        }
      ],
      runs: [
        ...forgeSnapshotFixture.runs,
        {
          id: "run-retail-release-prepare-bridge",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          title: "交付说明外部桥整理",
          executor: "OpenClaw Bridge",
          cost: "$0.10",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code Release · openclaw run-release"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        },
        {
          id: "run-retail-archive-bridge",
          projectId: "retail-support",
          title: "零售客服副驾驶 外部桥归档沉淀",
          executor: "OpenClaw Bridge",
          cost: "$0.12",
          state: "done" as const,
          outputMode: "external-shell-bridge-executed",
          outputChecks: [
            {
              name: "execution-backend",
              status: "pass",
              summary: "OpenClaw · Claude Code Archive · openclaw run-archive"
            },
            {
              name: "bridge-execution",
              status: "pass",
              summary: "bridge-ok"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · OpenClaw"
            }
          ]
        }
      ]
    };

    const summary = getFormalArtifactResponsibilitySummary(archiveSnapshot, "retail-support");

    expect(summary.coverage.summary).toBe("已沉淀 4 项正式工件");
    expect(summary.gap.summary).toBe("当前正式工件缺口已清零。");
    expect(summary.pendingApprovals.length).toBeGreaterThan(0);
    expect(summary.pendingApprovals.some((item) => item.label === "交付说明")).toBe(true);
    expect(summary.pendingApprovals.some((item) => item.nextAction === "确认交付说明与放行口径")).toBe(true);
    expect(summary.approvalHandoff.summary).toBe("确认后将继续进入归档沉淀。");
    expect(summary.approvalHandoff.detail).toContain("确认交付说明与放行口径后，继续沉淀知识卡与归档审计。");
    expect(summary.approvalHandoff.detail).toContain("来源命令：整理交付说明");
    expect(summary.approvalHandoff.detail).toContain("来源运行：交付说明外部桥整理 · OpenClaw Bridge");
    const recentExecutions = getRecentCommandExecutions(archiveSnapshot, "retail-support");
    const releaseExecution = recentExecutions.find(
      (item) => item.commandId === "command-release-prepare"
    );
    const archiveExecution = recentExecutions.find(
      (item) => item.commandId === "command-archive-capture"
    );
    expect(releaseExecution?.approvalHandoffSummary).toBe("确认后将继续进入归档沉淀。");
    expect(releaseExecution?.approvalHandoffDetail).toContain(
      "确认交付说明与放行口径后，继续沉淀知识卡与归档审计。"
    );
    expect(releaseExecution?.approvalHandoffOwnerLabel).toBe("流程运营专员 · Duck");
    expect(releaseExecution?.approvalHandoffNextAction).toBe("沉淀交付知识卡与归档审计记录");
    expect(releaseExecution?.releaseClosureSummary).toContain("发布链已经进入人工确认");
    expect(releaseExecution?.releaseClosureDetail).toContain("确认责任：确认交付说明与放行口径");
    expect(releaseExecution?.releaseClosureNextAction).toBe("确认交付说明与放行口径");
    expect(releaseExecution?.releaseClosureResponsibilitySummary).toContain(
      "确认后动作：沉淀交付知识卡与归档审计记录"
    );
    expect(releaseExecution?.releaseClosureResponsibilitySummary).toContain("归档接棒：");
    expect(releaseExecution?.releaseClosureResponsibilityDetail).toContain("当前归档沉淀接棒来源于");
    expect(releaseExecution?.releaseClosureResponsibilityDetail).toContain("整理交付说明");
    expect(releaseExecution?.releaseClosureResponsibilityNextAction).toBe(
      "沉淀交付知识卡与归档审计记录"
    );
    expect(releaseExecution?.releaseClosureResponsibilitySourceLabel).toContain(
      "零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge"
    );
    expect(archiveExecution?.archiveProvenanceSummary).toBe(
      "归档审计记录 已由 触发归档沉淀 写回正式工件面。"
    );
    expect(archiveExecution?.archiveProvenanceDetail).toContain("当前归档沉淀接棒来源于");
    expect(archiveExecution?.archiveProvenanceDetail).toContain("整理交付说明");
    expect(archiveExecution?.releaseClosureSummary).toBe(
      "发布链已完成最终放行，归档沉淀已写回正式工件面。"
    );
    expect(archiveExecution?.releaseClosureDetail).toContain("当前归档沉淀接棒来源于");
    expect(archiveExecution?.releaseClosureNextAction).toBeNull();
    expect(archiveExecution?.releaseClosureResponsibilitySummary).toContain("归档接棒：");
    expect(archiveExecution?.releaseClosureResponsibilityDetail).toContain("当前归档沉淀接棒来源于");
    expect(archiveExecution?.releaseClosureResponsibilityNextAction).toBe(
      "沉淀交付知识卡与归档审计记录"
    );
    expect(archiveExecution?.releaseClosureResponsibilitySourceLabel).toContain(
      "零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge"
    );
    expect(summary.provenance).toHaveLength(4);
    expect(
      summary.provenance.some(
        (item) =>
          item.artifactType === "release-audit" &&
          item.value.includes("来源命令：触发归档沉淀") &&
          item.value.includes("来源运行：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge")
      )
    ).toBe(true);

    const releaseClosure = getReleaseClosureSummary(archiveSnapshot, "retail-support");

    expect(releaseClosure.status).toBe("archive-recorded");
    expect(releaseClosure.summary).toBe("发布链已完成最终放行，归档沉淀已写回正式工件面。");
    expect(releaseClosure.detail).toContain("当前归档沉淀接棒来源于");
    expect(releaseClosure.nextAction).toBeNull();
    expect(releaseClosure.sourceCommandId).toBe("command-archive-capture");
    expect(releaseClosure.sourceCommandLabel).toBe("触发归档沉淀");
    expect(releaseClosure.relatedRunLabel).toContain("外部桥归档沉淀");
  });

  it("builds recent command executions with runtime and assembly context", () => {
    const recentExecutions = getRecentCommandExecutions(forgeSnapshotFixture, "retail-support");

    expect(recentExecutions[0]?.commandId).toBe("command-gate-run");
    expect(recentExecutions[0]?.relatedRunId).toBe("run-retail-playwright");
    expect(recentExecutions[0]?.relatedRunLabel).toContain("主流程回归验证");
    expect(recentExecutions[0]?.taskPackId).toBe("artifact-task-pack");
    expect(recentExecutions[0]?.taskPackLabel).toBe("退款失败主流程 TaskPack");
    expect(recentExecutions[0]?.pendingComponentLabels).toContain("支付结算组件");
    expect(recentExecutions[0]?.componentAssemblyAction).toContain("待装配组件");
    expect(recentExecutions[0]?.runtimeEvidenceSummary).toContain("Version 1.55.0");
    expect(recentExecutions[0]?.followUpTasks[0]?.title).toBe("修复 Playwright 失败并重新回归");
  });

  it("routes component assembly tasks back to the assembly command", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-component-assembly",
          projectId: "retail-support",
          stage: "开发执行",
          title: "补齐 TaskPack 组件装配",
          ownerAgentId: "agent-architect",
          status: "blocked",
          priority: "P0",
          category: "execution",
          summary: "待装配组件：支付结算组件。继续补齐组件装配，再推进研发执行。"
        }
      ],
      commands: [
        ...forgeSnapshotFixture.commands,
        {
          id: "command-component-assemble",
          name: "补齐组件装配",
          type: "component.assemble" as const,
          summary: "把推荐组件写回 TaskPack 装配段，并形成研发执行前的组件基线。",
          triggerStage: "开发执行" as const,
          requiresArtifacts: ["task-pack" as const]
        }
      ],
      commandExecutions: [
        {
          id: "command-execution-taskpack-generate",
          commandId: "command-taskpack-generate",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          status: "done" as const,
          summary: "已生成 TaskPack，并识别出待装配组件。",
          triggeredBy: "架构师 Agent",
          createdAt: "今天 10:45",
          followUpTaskIds: ["task-retail-component-assembly"]
        },
        ...forgeSnapshotFixture.commandExecutions
      ]
    };

    const chain = getBlockingTaskChain(snapshot, "retail-support");
    const assemblyTask = chain.find((item) => item.id === "task-retail-component-assembly");

    expect(assemblyTask?.retryCommandId).toBe("command-component-assemble");
    expect(assemblyTask?.retryCommandLabel).toBe("补齐组件装配");
  });

  it("routes runner-gates tasks back to execution start with the latest taskpack context", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        {
          id: "task-retail-runner-gates",
          projectId: "retail-support",
          stage: "开发执行" as const,
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-dev",
          status: "in-progress" as const,
          priority: "P0" as const,
          category: "execution" as const,
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        ...forgeSnapshotFixture.tasks
      ],
      commands: [
        {
          id: "command-execution-start",
          name: "启动研发执行",
          type: "execution.start" as const,
          summary: "按 TaskPack 启动研发执行并生成 Patch 与 Demo。",
          triggerStage: "开发执行" as const,
          requiresArtifacts: ["task-pack"]
        },
        ...forgeSnapshotFixture.commands
      ],
      commandExecutions: forgeSnapshotFixture.commandExecutions.filter(
        (item) => item.commandId !== "command-taskpack-generate"
      )
    };

    const chain = getBlockingTaskChain(snapshot, "retail-support");
    const runnerGateTask = chain.find((item) => item.id === "task-retail-runner-gates");

    expect(runnerGateTask?.retryCommandId).toBe("command-execution-start");
    expect(runnerGateTask?.retryCommandLabel).toBe("启动研发执行");
    expect(runnerGateTask?.taskPackId).toBe("artifact-task-pack");
    expect(runnerGateTask?.taskPackLabel).toBe("退款失败主流程 TaskPack");
  });
});
