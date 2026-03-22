import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import {
  activateProjectForAI,
  applyComponentAssemblyForAI,
  bridgeExecutionBackendDispatchForAI,
  createProjectForAI,
  dispatchExecutionBackendRequestForAI,
  executeExecutionBackendDispatchForAI,
  executeCommandForAI,
  ForgeApiError,
  getCommandHandler,
  getCommandCenterForAI,
  getCapabilityRegistryForAI,
  getComponentAssemblyPlanForAI,
  getComponentRegistryForAI,
  getControlPlaneSnapshotForAI,
  getDeliveryReadinessForAI,
  getAssetRecommendationsForAI,
  generatePrdDraftForAI,
  generateWorkbenchChatReplyForAI,
  updateAgentProfileForAI,
  updateModelProviderSettingsForAI,
  updateProjectWorkflowStateForAI,
  getGateStatusForAI,
  getProjectTemplatesForAI,
  getPromptTemplatesForAI,
  prepareExecutionBackendRequestForAI,
  getRemediationsForAI,
  getRunnerRegistryForAI,
  getRunTimelineForAI,
  getSnapshotForAI,
  getTeamWorkbenchStateForAI,
  getTeamRegistryForAI,
  listTasksForAI,
  listProjectsForAI,
  probeRunnersForAI,
  retryRemediationForAI,
  retryEscalationForAI,
  retryTaskForAI,
  recordCommandExecutionForAI,
  executeCommandWithModelForAI,
  searchExternalComponentResourcesForAI,
  upsertRunForAI,
  updateTeamWorkbenchStateForAI,
  updateRunnerHeartbeatForAI,
  writebackExecutionBackendBridgeRunForAI,
  searchAssetsForAI
} from "../packages/ai/src";
import {
  resolveWorkbenchAgentContext,
  resolveWorkbenchAgentContextForAgent
} from "../packages/ai/src/agent-context";
import {
  upsertProjectComponentLink,
  ensureForgeDatabase,
  loadDashboardSnapshot,
  upsertProjectArtifact,
  upsertProjectTask
} from "../packages/db/src";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

function overrideCanonicalTeamTemplateAgents(
  dbPath: string,
  templateId: string,
  agentIds: string[],
  leadAgentId: string
) {
  const db = new Database(dbPath);

  try {
    db.prepare(`
      UPDATE team_templates
      SET agent_ids_json = ?,
          lead_agent_id = ?
      WHERE id = ?
    `).run(JSON.stringify(agentIds), leadAgentId, templateId);
  } finally {
    db.close();
  }
}

describe("forge ai core", () => {
  it("routes high-churn commands through dedicated handlers", () => {
    expect(getCommandHandler("prd.generate")).toBeTypeOf("function");
    expect(getCommandHandler("review.run")).toBeTypeOf("function");
    expect(getCommandHandler("gate.run")).toBeTypeOf("function");
    expect(getCommandHandler("execution.start")).toBeTypeOf("function");
    expect(getCommandHandler("release.prepare")).toBeTypeOf("function");
    expect(getCommandHandler("archive.capture")).toBeTypeOf("function");
  });

  it("lists projects with the active project marker", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = listProjectsForAI(dbPath);

      expect(result.projects).toHaveLength(3);
      expect(result.activeProjectId).toBe("retail-support");
      expect(result.projects[0]?.name).toBe("零售客服副驾驶");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates and activates a project through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      const snapshot = getSnapshotForAI(dbPath);

      expect(created.project.name).toBe("售后修复总台");
      expect(snapshot.activeProject?.id).toBe(created.project.id);
      expect(snapshot.activeProject?.name).toBe("售后修复总台");
      expect(snapshot.activeProjectProfile?.templateId).toBe("template-smart-service");
      expect(snapshot.activeProjectProfile?.workspacePath).toContain(created.project.id);
      expect(snapshot.controlPlane?.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(snapshot.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(snapshot.controlPlane?.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
      expect(snapshot.controlPlane?.runtimeSummary?.capabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(snapshot.controlPlane?.readiness?.statusLabel).toBeTruthy();
      expect(snapshot.controlPlane?.releaseGate?.overallLabel).toBeTruthy();
      expect(Array.isArray(snapshot.controlPlane?.blockingTasks)).toBe(true);
      expect(Array.isArray(snapshot.controlPlane?.remediationQueue)).toBe(true);
      expect(Array.isArray(snapshot.controlPlane?.evidenceTimeline)).toBe(true);
      expect(Array.isArray(snapshot.controlPlane?.recentExecutions)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates a requirement-based project without demo seeding when demoSeed is false", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
          enterpriseName: "百川零售",
          owner: "Iris",
          demoSeed: false
        },
        dbPath
      );

      const snapshot = getSnapshotForAI(dbPath);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const artifacts = snapshot.artifacts.filter((item) => item.projectId === created.project.id);
      const runs = snapshot.runs.filter((item) => item.projectId === created.project.id);

      expect(snapshot.activeProject?.id).toBe(created.project.id);
      expect(snapshot.activeProject).toEqual(
        expect.objectContaining({
          status: "active",
          progress: 0,
          enterpriseName: "百川零售"
        })
      );
      expect(workflow).toEqual(
        expect.objectContaining({
          currentStage: "项目接入",
          state: "current"
        })
      );
      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "prd", status: "draft" }),
          expect.objectContaining({ type: "architecture-note", status: "draft" }),
          expect.objectContaining({ type: "ui-spec", status: "draft" }),
          expect.objectContaining({ type: "task-pack", status: "draft" })
        ])
      );
      expect(artifacts).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "release-brief", status: "ready" }),
          expect.objectContaining({ type: "review-decision", status: "ready" })
        ])
      );
      expect(runs).toHaveLength(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns a dedicated control-plane snapshot through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
        'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertRunForAI(
        {
          id: "run-retail-review-provider-ready",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-payment-checkout"],
          title: "外部模型规则审查准备",
          executor: "Reviewer",
          cost: "$0.18",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [
            {
              name: "model-execution",
              status: "pass",
              summary: "Claude Code Review · claude 2.1.34 · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
            },
            {
              name: "evidence",
              status: "tool-ready",
              summary: "已检测到外部审查执行器"
            }
          ]
        },
        dbPath
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-dev",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );
      upsertRunForAI(
        {
          id: "run-retail-review-provider",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-auth-email"],
          title: "执行退款失败补丁规则审查",
          executor: "Reviewer",
          cost: "$0.28",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [
            {
              name: "model-execution",
              status: "pass",
              summary:
                "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
            },
            {
              name: "evidence",
              status: "tool-ready",
              summary: "已检测到外部审查执行器"
            }
          ]
        },
        dbPath
      );

      const controlPlane = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);

      expect(controlPlane.project?.id).toBe("retail-support");
      expect(controlPlane.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(controlPlane.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(controlPlane.runtimeSummary?.evidenceStates).toContain("tool-ready");
      expect(controlPlane.runtimeSummary?.evidenceLabels).toContain("工具就绪");
      expect(controlPlane.runtimeSummary?.modelExecutionProviders).toContain("Claude Code Review");
      expect(controlPlane.runtimeSummary?.modelExecutionDetails).toContain(
        "Claude Code Review · claude 2.1.34 · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      );
      expect(controlPlane.readiness?.statusLabel).toBeTruthy();
      expect(controlPlane.releaseGate?.overallLabel).toBeTruthy();
      expect(controlPlane.componentRegistry?.project?.id).toBe("retail-support");
      expect(controlPlane.componentRegistry?.taskPack?.id).toBe("artifact-taskpack-retail");
      expect(controlPlane.componentRegistry?.recommendedCount).toBeGreaterThan(0);
      expect(controlPlane.componentRegistry?.pendingCount).toBeGreaterThanOrEqual(0);
      expect(controlPlane.componentRegistry?.assemblySuggestions?.[0]?.componentId).toBe("component-payment-checkout");
      expect(controlPlane.componentRegistry?.usageSignals?.[0]?.componentId).toBe("component-payment-checkout");
      expect(controlPlane.componentRegistry?.usageSignals?.[0]?.blockedCount).toBeGreaterThanOrEqual(0);
      expect(controlPlane.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "reviewer-execution-backend",
            runnerProfile: "reviewer-runner",
            supportedCommandTypes: ["review.run"],
            expectedArtifacts: ["review-report"]
          })
        ])
      );
      expect(Array.isArray(controlPlane.componentRegistry?.items)).toBe(true);
      expect(Array.isArray(controlPlane.blockingTasks)).toBe(true);
      expect(Array.isArray(controlPlane.remediationQueue)).toBe(true);
      expect(Array.isArray(controlPlane.evidenceTimeline)).toBe(true);
      expect(Array.isArray(controlPlane.recentExecutions)).toBe(true);
      expect(controlPlane.currentHandoff).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          source: expect.any(String),
          nextAction: expect.any(String)
        })
      );
      expect(controlPlane.formalArtifactCoverage).toEqual({
        count: 0,
        summary: "当前还没有沉淀正式工件。",
        detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
      });
      expect(controlPlane.formalArtifactGap).toEqual({
        missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
        missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
        summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
        ownerLabel: "测试开发工程师 · Monkey",
        ownerRoleLabel: "测试",
        nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
      });
      expect(controlPlane.formalArtifactResponsibility).toEqual(
        expect.objectContaining({
          coverage: {
            count: 0,
            summary: "当前还没有沉淀正式工件。",
            detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
          },
          gap: {
            missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
            missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
            summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
            ownerLabel: "测试开发工程师 · Monkey",
            ownerRoleLabel: "测试",
            nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
          },
          approvalHandoff: expect.objectContaining({
            summary: "当前无需等待审批后接棒。",
            detail: "当前没有待人工确认事项。",
            ownerLabel: null,
            ownerRoleLabel: null,
            nextAction: null
          }),
          pendingApprovals: expect.any(Array),
          provenance: expect.any(Array)
        })
      );
      expect(Array.isArray(controlPlane.pendingApprovals)).toBe(true);
      expect(Array.isArray(controlPlane.escalationItems)).toBe(true);
      expect(
        (
          controlPlane.remediationQueue?.find((item) => item.id === "task-retail-review-remediation") as {
            runtimeExecutionBackendInvocation?: {
              backendId: string;
              backend: string;
              commandType: string;
              artifactType: string | null;
              commandPreview: string;
            } | null;
            runtimeExecutionBackendCommandPreview?: string | null;
          } | undefined
        )?.runtimeExecutionBackendInvocation
      ).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          commandType: "review.run",
          artifactType: "patch",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
      expect(
        (
          controlPlane.recentExecutions?.find((item) => item.commandId === "command-review-run")
            ?.followUpTasks?.[0] as {
            runtimeExecutionBackendInvocation?: {
              backendId: string;
              backend: string;
              commandType: string;
              artifactType: string | null;
              commandPreview: string;
            } | null;
            runtimeExecutionBackendCommandPreview?: string | null;
          } | undefined
        )?.runtimeExecutionBackendInvocation
      ).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          commandType: "review.run",
          artifactType: "patch",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("rejects activating a missing project", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      expect(() => activateProjectForAI("missing-project", dbPath)).toThrowError(ForgeApiError);
      expect(() => activateProjectForAI("missing-project", dbPath)).toThrowError("项目不存在");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("searches assets by query and type", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = searchAssetsForAI({ query: "客服", type: "prompt" }, dbPath);

      expect(result.total).toBe(1);
      expect(result.items[0]?.title).toContain("客服");
      expect(result.items[0]?.type).toBe("prompt");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns unified asset recommendations for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getAssetRecommendationsForAI(
        {
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          stage: "测试验证",
          query: "支付"
        },
        dbPath
      );

      expect(result.project?.id).toBe("retail-support");
      expect(result.stage).toBe("测试验证");
      expect(result.taskPack?.id).toBe("artifact-taskpack-retail");
      expect(result.managementGroups).toEqual(
        expect.arrayContaining(["启动资产", "执行资产", "规则资产", "证据资产", "知识资产"])
      );
      expect(result.requiredItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceKind: "project-template",
            managementGroup: "启动资产",
            priority: "required",
            linked: true
          }),
          expect.objectContaining({
            sourceKind: "prompt-template",
            managementGroup: "启动资产",
            priority: "required",
            linked: true
          }),
          expect.objectContaining({
            title: "Playwright",
            sourceKind: "gate",
            managementGroup: "规则资产",
            priority: "required",
            linked: true
          })
        ])
      );
      expect(result.recommendedItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "支付结算组件",
            sourceKind: "component",
            managementGroup: "执行资产",
            priority: "recommended"
          }),
          expect.objectContaining({
            title: "测试门禁 SOP",
            sourceKind: "sop",
            managementGroup: "规则资产",
            priority: "recommended"
          })
        ])
      );
      expect(result.referenceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("Demo"),
            sourceKind: "artifact",
            managementGroup: "证据资产",
            priority: "reference"
          })
        ])
      );
      expect(result.items.some((item) => item.reason.includes("当前阶段"))).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("summarizes gate status for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getGateStatusForAI(dbPath);

      expect(result.overallState).toBe("blocked");
      expect(result.blockedGate?.name).toBe("Playwright");
      expect(result.gates).toHaveLength(4);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns delivery readiness with blocking task lineage for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getDeliveryReadinessForAI({ projectId: "retail-support" }, dbPath);

      expect(result.project?.id).toBe("retail-support");
      expect(result.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(result.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(result.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.capabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(Array.isArray(result.blockingTasks)).toBe(true);
      expect(Array.isArray(result.remediationQueue)).toBe(true);
      expect(result.blockingTasks[0]?.title).toContain("Playwright");
      expect(result.blockingTasks[0]?.sourceCommandLabel).toBe("发起测试门禁");
      expect(result.blockingTasks[0]?.sourceCommandAction).toContain("来源命令：发起测试门禁");
      expect(result.blockingTasks[0]?.missingArtifactLabels).toEqual(
        expect.arrayContaining(["测试报告", "Playwright 回归记录"])
      );
      expect(result.blockingTasks[0]?.relatedRunId).toBeTruthy();
      expect(result.blockingTasks[0]?.relatedRunLabel).toBeTruthy();
      expect(result.blockingTasks[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
      expect(result.blockingTasks[0]?.remediationSummary).toContain("优先补齐");
      expect(result.blockingTasks[0]?.remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
      expect(result.blockingTasks[0]?.retryCommandId).toBe("command-gate-run");
      expect(result.blockingTasks[0]?.retryCommandLabel).toBe("发起测试门禁");
      expect(result.blockingTasks[0]?.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.blockingTasks[0]?.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.blockingTasks[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
      expect(result.blockingTasks[0]?.retryRunnerCommand).toContain("--task-id task-retail-playwright");
      expect(result.blockingTasks[0]?.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
      expect(result.blockingTasks[0]?.unifiedRetryRunnerCommand).toContain(
        "--remediation-id task-retail-playwright"
      );
      expect(result.remediationQueue[0]?.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.remediationQueue[0]?.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.blockingTasks[0]?.runtimeCapabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(result.remediationQueue[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
      expect(result.remediationQueue[0]?.remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
      expect(result.remediationQueue[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
      expect(result.remediationQueue[0]?.retryRunnerCommand).toContain("--project-id retail-support");
      expect(result.remediationQueue[0]?.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
      expect(result.remediationQueue[0]?.unifiedRetryRunnerCommand).toContain(
        "--remediation-id task-retail-playwright"
      );
      expect(result.remediationQueue[0]?.runtimeCapabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns structured external execution readiness for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
        'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );

      const result = getDeliveryReadinessForAI({ projectId: "retail-support" }, dbPath);

      expect(result.runtimeSummary?.externalExecutionStatus).toBe("provider-active");
      expect(result.runtimeSummary?.externalExecutionContractCount).toBe(2);
      expect(result.runtimeSummary?.externalExecutionActiveProviderCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.externalExecutionRecommendation).toContain(
        "后续执行、整改和回放优先沿现有外部执行链推进"
      );
      expect(result.runtimeSummary?.executionBackendSummary).toContain("OpenClaw");
      expect(result.runtimeSummary?.executionBackendDetails).toEqual(
        expect.arrayContaining([
          "研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ])
      );
      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "engineer-execution-backend",
            runnerProfile: "engineer-runner",
            supportedCommandTypes: ["execution.start"],
            expectedArtifacts: ["patch", "demo-build"]
          })
        ])
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("surfaces bridge execution evidence in runtime summary for ai callers", { timeout: 10000 }, async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );
      await writebackExecutionBackendBridgeRunForAI(
        {
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell",
          runId: "run-bridge-retail-summary"
        },
        dbPath
      );

      const result = getDeliveryReadinessForAI({ projectId: "retail-support" }, dbPath);

      expect(result.runtimeSummary?.bridgeExecutionCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.bridgeExecutionSummary).toContain("已写回 1 条外部执行桥证据");
      expect(result.runtimeSummary?.bridgeExecutionDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("OpenClaw Bridge")])
      );
      expect(result.currentHandoff).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          source: expect.any(String),
          nextAction: expect.any(String)
        })
      );
      expect(result.formalArtifactCoverage).toEqual({
        count: 0,
        summary: "当前还没有沉淀正式工件。",
        detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
      });
      expect(result.formalArtifactGap).toEqual({
        missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
        missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
        summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
        ownerLabel: "测试开发工程师 · Monkey",
        ownerRoleLabel: "测试",
        nextAction: "桥接评审已移交 QA，先由测试开发工程师 · Monkey 补齐测试报告 / Playwright 回归记录。"
      });
      expect(Array.isArray(result.pendingApprovals)).toBe(true);
      expect(Array.isArray(result.escalationItems)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns unified remediation entries for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
        'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-dev",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );
      upsertRunForAI(
        {
          id: "run-retail-review-provider",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-auth-email"],
          title: "执行退款失败补丁规则审查",
          executor: "Reviewer",
          cost: "$0.28",
          state: "done",
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
        },
        dbPath
      );

      const result = getRemediationsForAI({ projectId: "retail-support" }, dbPath);

      expect(result.project?.id).toBe("retail-support");
      expect(result.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(result.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(result.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.capabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(result.total).toBeGreaterThan(0);
      expect(result.items.some((item) => item.kind === "task")).toBe(true);
      expect(result.items.some((item) => item.kind === "escalation")).toBe(true);
      expect(result.items.some((item) => item.retryApiPath === "/api/forge/tasks/retry")).toBe(true);
      expect(
        result.items.some((item) => item.retryApiPath === "/api/forge/escalations/retry")
      ).toBe(true);
      expect(
        result.items.some((item) => item.unifiedRetryApiPath === "/api/forge/remediations/retry")
      ).toBe(true);
      expect(
        result.items.some((item) =>
          item.unifiedRetryRunnerCommand?.includes("--remediation-id task-retail-playwright")
        )
      ).toBe(true);
      expect(
        result.items.some((item) =>
          item.runtimeCapabilityDetails.some((detail) => detail.includes("Version 1.55.0"))
        )
      ).toBe(true);
      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "reviewer-execution-backend",
            runnerProfile: "reviewer-runner",
            supportedCommandTypes: ["review.run"],
            expectedArtifacts: ["review-report"]
          })
        ])
      );
      const reviewRemediation = result.items.find((item) => item.id === "task-retail-review-remediation");
      expect(reviewRemediation?.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(reviewRemediation?.runtimeExecutionBackendInvocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Review",
          commandType: "review.run",
          taskPackId: "artifact-taskpack-retail",
          artifactType: "patch",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
      expect(result.approvalHandoff).toEqual(
        expect.objectContaining({
          summary: "当前无需等待审批后接棒。",
          detail: "当前没有待人工确认事项。"
        })
      );
      expect(reviewRemediation?.runtimeExecutionBackendCommandPreview).toBe(
        'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      );
      expect(result.currentHandoff).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          source: expect.any(String),
          nextAction: expect.any(String)
        })
      );
      expect(result.formalArtifactCoverage).toEqual({
        count: 0,
        summary: "当前还没有沉淀正式工件。",
        detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
      });
      expect(result.formalArtifactGap).toEqual({
        missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
        missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
        summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
        ownerLabel: "测试开发工程师 · Monkey",
        ownerRoleLabel: "测试",
        nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
      });
      expect(Array.isArray(result.pendingApprovals)).toBe(true);
      expect(Array.isArray(result.escalationItems)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prepares a structured execution backend request for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = prepareExecutionBackendRequestForAI(
        { taskId: "task-retail-review-remediation" },
        dbPath
      );

      expect(result.sourceKind).toBe("task");
      expect(result.sourceId).toBe("task-retail-review-remediation");
      expect(result.retryCommandId).toBe("command-review-run");
      expect(result.invocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Review",
          commandType: "review.run",
          artifactType: "patch",
          taskPackId: "artifact-taskpack-retail",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prepares a NanoClaw CEO backend request with the fixed project shepherd profile", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-pm",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-pm"
      );
      vi.stubEnv(
        "FORGE_PM_EXEC_COMMAND",
        'forge ceo --project "{projectId}" --stage "{stage}"'
      );
      vi.stubEnv("FORGE_PM_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_PM_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv(
        "FORGE_PM_EXEC_BACKEND_COMMAND",
        'nanoclaw run-ceo --project "{projectId}" --stage "{stage}" --agent "{agentId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "Nano CEO 接入台",
          sector: "智能客服 / 零售",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      const result = prepareExecutionBackendRequestForAI(
        { projectId: created.project.id },
        dbPath
      );

      expect(result.sourceKind).toBe("project-handoff");
      expect(result.retryCommandId).toBe("command-prd-generate");
      expect(result.invocation).toEqual(
        expect.objectContaining({
          backendId: "pm-execution-backend",
          backend: "NanoClaw",
          provider: "Nano CEO",
          commandType: "prd.generate",
          commandPreview: `nanoclaw run-ceo --project "${created.project.id}" --stage "项目接入" --agent "agent-service-strategy" --provider "Nano CEO"`
        })
      );
      expect(result.invocation.payload).toEqual(
        expect.objectContaining({
          projectId: created.project.id,
          stage: "项目接入",
          commandType: "prd.generate",
          taskInstruction: expect.stringContaining("生成 PRD"),
          expectedOutput: ["prd"],
          toolCapabilities: expect.arrayContaining([
            expect.objectContaining({
              id: "knowledge-search",
              label: "知识检索",
              mode: "read"
            }),
            expect.objectContaining({
              id: "doc-summarize",
              label: "文档整理",
              mode: "review"
            })
          ]),
          workspacePaths: expect.objectContaining({
            workspaceRoot: expect.stringContaining(created.project.id),
            artifactsRoot: expect.stringContaining(`${created.project.id}/artifacts`),
            knowledgeRoot: expect.stringContaining(`${created.project.id}/knowledge`)
          }),
          agent: expect.objectContaining({
            id: "agent-service-strategy",
            name: "项目经理 · Lion",
            permissionProfileId: "perm-collaborator",
            ownerMode: "human-approved",
            skillIds: expect.arrayContaining(["skill-prd"])
          })
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("surfaces a single NanoClaw manager backend across all Forge execution lanes", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv(
        "FORGE_NANO_EXEC_BACKEND_COMMAND",
        'nanoclaw manage --command "{commandType}" --project "{projectId}" --stage "{stage}" --taskpack "{taskPackId}" --agent "{agentId}" --controller "{controllerAgentId}" --provider "{provider}"'
      );

      const result = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);

      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "pm-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          }),
          expect.objectContaining({
            id: "engineer-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          }),
          expect.objectContaining({
            id: "reviewer-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          }),
          expect.objectContaining({
            id: "qa-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          }),
          expect.objectContaining({
            id: "release-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          }),
          expect.objectContaining({
            id: "archive-execution-backend",
            backend: "NanoClaw",
            provider: "Nano CEO",
            commandConfigured: true,
            commandSource: "FORGE_NANO_EXEC_BACKEND_COMMAND"
          })
        ])
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("uses the built-in NanoClaw manager wrapper when only the global backend is configured", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");

      const result = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);
      const reviewerBackend = result.executionBackends.find(
        (item) => item.id === "reviewer-execution-backend"
      );

      expect(reviewerBackend).toEqual(
        expect.objectContaining({
          backend: "NanoClaw",
          provider: "Nano CEO",
          commandConfigured: true,
          commandSource: "internal-default:nanoclaw-manager"
        })
      );
      expect(reviewerBackend?.backendCommandTemplate).toContain("forge-nanoclaw-manager.mjs");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reports NanoClaw manager readiness when the global CEO backend is locally callable", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");

      const result = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);
      const pmBackend = result.executionBackends.find((item) => item.kind === "pm");

      expect(result.runtimeSummary?.nanoManagerStatus).toBe("ready");
      expect(result.runtimeSummary?.nanoManagerSummary).toContain("NanoClaw CEO 总控已就绪");
      expect(result.runtimeSummary?.nanoManagerDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("CEO总控")])
      );
      expect(pmBackend).toEqual(
        expect.objectContaining({
          backend: "NanoClaw",
          probeStatus: "ready"
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("marks the NanoClaw CEO manager as degraded when the healthcheck command fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
      vi.stubEnv("FORGE_NANO_HEALTHCHECK_COMMAND", 'node -e "process.exit(7)"');

      const result = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);
      const pmBackend = result.executionBackends.find((item) => item.kind === "pm");

      expect(result.runtimeSummary?.nanoManagerStatus).toBe("degraded");
      expect(result.runtimeSummary?.nanoManagerSummary).toContain("健康检查失败");
      expect(result.runtimeSummary?.nanoManagerDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("退出码 7")])
      );
      expect(pmBackend).toEqual(
        expect.objectContaining({
          backend: "NanoClaw",
          probeStatus: "degraded"
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("surfaces a standardized NanoClaw handshake summary through runtime readiness", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
      vi.stubEnv(
        "FORGE_NANO_HEALTHCHECK_COMMAND",
        'node -e "process.stdout.write(JSON.stringify({status:\'ready\',summary:\'Nano 在线握手成功\',details:[\'CEO manager ready\'],version:\'nano-1.0.0\'}))"'
      );

      const result = getControlPlaneSnapshotForAI({ projectId: "retail-support" }, dbPath);
      const pmBackend = result.executionBackends.find((item) => item.kind === "pm");

      expect(result.runtimeSummary?.nanoManagerStatus).toBe("ready");
      expect(pmBackend).toEqual(
        expect.objectContaining({
          backend: "NanoClaw",
          probeStatus: "ready",
          probeSummary: expect.stringContaining("Nano 在线握手成功"),
          probeDetails: expect.arrayContaining([expect.stringContaining("CEO manager ready")]),
          probeVersion: "nano-1.0.0"
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("dispatches an execution backend adapter request through a stub receipt for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = dispatchExecutionBackendRequestForAI(
        { remediationId: "task-retail-review-remediation" },
        dbPath
      );

      expect(result.status).toBe("queued");
      expect(result.mode).toBe("stub");
      expect(result.sourceKind).toBe("remediation");
      expect(result.backend).toBe("OpenClaw");
      expect(result.provider).toBe("Claude Code Review");
      expect(result.summary).toContain("已生成 OpenClaw 的 execution backend dispatch receipt");
      expect(result.invocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          commandType: "review.run",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("builds a stub execution plan for an execution backend dispatch", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = executeExecutionBackendDispatchForAI(
        { remediationId: "task-retail-review-remediation" },
        dbPath
      );

      expect(result.status).toBe("ready");
      expect(result.mode).toBe("external-shell-stub");
      expect(result.backend).toBe("OpenClaw");
      expect(result.provider).toBe("Claude Code Review");
      expect(result.execution.cwd).toContain("/workspaces/retail-support");
      expect(result.execution.command).toEqual([
        "openclaw",
        "run-review",
        "--project",
        "retail-support",
        "--taskpack",
        "artifact-taskpack-retail",
        "--artifact",
        "patch",
        "--provider",
        "Claude Code Review"
      ]);
      expect(result.execution.commandPreview).toBe(
        'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("bridges an execution backend dispatch in stub mode", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = await bridgeExecutionBackendDispatchForAI(
        { remediationId: "task-retail-review-remediation" },
        dbPath
      );

      expect(result.status).toBe("ready");
      expect(result.mode).toBe("external-shell-bridge-stub");
      expect(result.bridgeStatus).toBe("stub");
      expect(result.backend).toBe("OpenClaw");
      expect(result.provider).toBe("Claude Code Review");
      expect(result.outputMode).toBe("external-shell-bridge-ready");
      expect(result.evidenceStatus).toBe("tool-ready");
      expect(result.evidenceLabel).toBe("工具就绪");
      expect(result.outputChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "execution-backend",
            status: "pass"
          }),
          expect.objectContaining({
            name: "evidence",
            status: "tool-ready"
          })
        ])
      );
      expect(result.execution.commandPreview).toBe(
        'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      );
      expect(result.executionResult).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("bridges an execution backend dispatch through the local shell executor when explicitly enabled", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = await bridgeExecutionBackendDispatchForAI(
        {
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell"
        },
        dbPath
      );

      expect(result.status).toBe("executed");
      expect(result.mode).toBe("external-shell-bridge");
      expect(result.bridgeStatus).toBe("executed");
      expect(result.backend).toBe("OpenClaw");
      expect(result.outputMode).toBe("external-shell-bridge-executed");
      expect(result.evidenceStatus).toBe("executed");
      expect(result.evidenceLabel).toBe("已执行");
      expect(result.outputChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "execution-backend",
            status: "pass"
          }),
          expect.objectContaining({
            name: "bridge-execution",
            status: "pass"
          }),
          expect.objectContaining({
            name: "evidence",
            status: "executed"
          })
        ])
      );
      expect(result.execution.command).toEqual(["/bin/sh", "-lc", "printf bridge-ok"]);
      expect(result.executionResult).toMatchObject({
        ok: true,
        exitCode: 0
      });
      expect(result.executionResult?.summary).toContain("bridge-ok");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("bridges a NanoClaw manager dispatch through the built-in wrapper and returns a structured receipt", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv(
        "FORGE_NANO_MANAGE_COMMAND",
        'node -e "process.stdout.write(JSON.stringify({ok:true,status:\'done\',summary:\'Nano 审查回执已生成\',artifacts:[{type:\'review-report\',title:\'Nano 审查记录\',ownerAgentId:\'agent-architect\',status:\'ready\'}],checks:[{name:\'receipt\',status:\'pass\'}],details:[\'review lane complete\']}))"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = await bridgeExecutionBackendDispatchForAI(
        {
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell"
        },
        dbPath
      );

      expect(result.status).toBe("executed");
      expect(result.backend).toBe("NanoClaw");
      expect(result.execution.command[0]).toBe("node");
      expect(result.execution.command.join(" ")).toContain("forge-nanoclaw-manager.mjs");
      expect(result.executionResult).toMatchObject({
        ok: true,
        summary: "Nano 审查回执已生成"
      });
      expect(result.executionResult?.data).toMatchObject({
        status: "done",
        artifacts: [
          {
            type: "review-report",
            title: "Nano 审查记录",
            ownerAgentId: "agent-architect",
            status: "ready"
          }
        ],
        checks: [{ name: "receipt", status: "pass" }]
      });
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("writes back a bridge execution result into the run timeline", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell",
          runId: "run-bridge-retail-review"
        },
        dbPath
      );

      expect(result.bridge.status).toBe("executed");
      expect(result.run.id).toBe("run-bridge-retail-review");
      expect(result.run.outputMode).toBe("external-shell-bridge-executed");
      expect(result.run.outputChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "bridge-execution",
            status: "pass"
          })
        ])
      );
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            projectId: "retail-support",
            type: "review-report",
            status: "ready"
          })
        ])
      );

      const timeline = getRunTimelineForAI({ projectId: "retail-support" }, dbPath);
      const bridgeItem = timeline.items.find((item) => item.id === "run-bridge-retail-review");
      const snapshot = getSnapshotForAI(dbPath);
      const reviewArtifact = snapshot.artifacts.find(
        (item) => item.projectId === "retail-support" && item.type === "review-report"
      );

      expect(bridgeItem?.evidenceStatus).toBe("executed");
      expect(bridgeItem?.evidenceLabel).toBe("已执行");
      expect(bridgeItem?.outputMode).toBe("external-shell-bridge-executed");
      expect(bridgeItem?.linkedComponentIds).toEqual([]);
      expect(reviewArtifact?.status).toBe("ready");
      expect(reviewArtifact?.title).toContain("规则审查记录");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("writes back a NanoClaw CEO bridge run into the PRD timeline", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-pm",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-pm"
      );
      vi.stubEnv(
        "FORGE_PM_EXEC_COMMAND",
        'forge ceo --project "{projectId}" --stage "{stage}"'
      );
      vi.stubEnv("FORGE_PM_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_PM_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_PM_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf nano-bridge-ok"');

      const created = createProjectForAI(
        {
          name: "Nano CEO 接入台",
          sector: "智能客服 / 零售",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-prd`
        },
        dbPath
      );

      const snapshot = getSnapshotForAI(dbPath);
      const prdArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "prd"
      );
      const commandExecution = snapshot.commandExecutions.find(
        (item) => item.projectId === created.project.id && item.commandId === "command-prd-generate"
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.bridge.status).toBe("executed");
      expect(result.bridge.backend).toBe("NanoClaw");
      expect(result.run.executor).toBe("NanoClaw Bridge");
      expect(result.run.outputMode).toBe("external-shell-bridge-executed");
      expect(prdArtifact?.ownerAgentId).toBe("agent-service-strategy");
      expect(prdArtifact?.status).toBe("ready");
      expect(commandExecution?.summary).toContain("已通过 NanoClaw Bridge 完成需求确认与 PRD 生成");
      expect(workflow?.currentStage).toBe("方案与任务包");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("moves a bridge-backed review execution into qa handoff", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "桥接评审交付台",
          sector: "智能客服 / 审查",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接评审交付台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-review-remediation`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: `command-execution-${created.project.id}-review-run`,
          commandId: "command-review-run",
          projectId: created.project.id,
          taskPackId: `artifact-${created.project.id}-task-pack`,
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: [`task-${created.project.id}-review-remediation`]
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          remediationId: `task-${created.project.id}-review-remediation`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const qaTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find(
        (item) => item.id === `task-${created.project.id}-qa-gate`
      );

      expect(workflow?.currentStage).toBe("测试验证");
      expect(workflow?.state).toBe("current");
      expect(qaTask?.ownerAgentId).toBe("agent-qa-automation");
      expect(qaTask?.status).toBe("in-progress");
      expect(qaTask?.title).toContain("Playwright");

      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);

      expect(readiness.readiness.bridgeHandoffStatus).toBe("qa-handoff");
      expect(readiness.readiness.bridgeHandoffSummary).toContain("已移交 QA 门禁");
      expect(readiness.currentHandoff.nextAction).toBe(
        "桥接评审已移交 QA，先由测试开发工程师 · Monkey 补齐测试报告 / Playwright 回归记录。"
      );
      expect(readiness.releaseGate.bridgeHandoffStatus).toBe("qa-handoff");
      expect(readiness.releaseGate.bridgeHandoffSummary).toContain("已移交 QA 门禁");
      expect(readiness.releaseGate.formalArtifactGap).toEqual({
        missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
        missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
        summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
        ownerLabel: "测试开发工程师 · Monkey",
        ownerRoleLabel: "测试",
        nextAction: "桥接评审已移交 QA，先由测试开发工程师 · Monkey 补齐测试报告 / Playwright 回归记录。"
      });
      expect(readiness.releaseGate.bridgeReviewCommandId).toBe("command-review-run");
      expect(readiness.releaseGate.bridgeReviewRunId).toBe(`run-bridge-${created.project.id}-review`);
      expect(readiness.releaseGate.bridgeReviewRunLabel).toContain("规则审查");
      expect(
        readiness.releaseGate.approvalTrace.some(
          (item) =>
            item.sourceCommandId === "command-review-run" &&
            item.relatedRunId === `run-bridge-${created.project.id}-review`
        )
      ).toBe(true);
      expect(
        readiness.releaseGate.escalationActions.some(
          (item) =>
            item.bridgeHandoffStatus === "qa-handoff" &&
            item.bridgeHandoffSummary?.includes("已移交 QA 门禁") &&
            item.relatedRunId === `run-bridge-${created.project.id}-review` &&
            item.nextAction?.includes("先由测试开发工程师 · Monkey 补齐")
        )
      ).toBe(true);
      expect(
        readiness.releaseGate.escalationActions.some(
          (item) =>
            item.label === "交付说明 · 缺失" &&
            item.ownerLabel === "测试开发工程师 · Monkey" &&
            item.ownerRoleLabel === "测试" &&
            item.nextAction === "桥接评审已移交 QA，先由测试开发工程师 · Monkey 补齐测试报告 / Playwright 回归记录。"
        )
      ).toBe(true);
      expect(
        readiness.escalationItems.some(
          (item) =>
            item.sourceCommandId === "command-review-run" &&
            item.relatedRunId === `run-bridge-${created.project.id}-review`
        )
      ).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("writes back an engineer bridge execution from runner gates into review-ready artifacts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-service-strategy",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-service-strategy"
      );
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "桥接研发交付台",
          sector: "智能客服 / 研发",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接研发交付台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const patchArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "patch"
      );
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const demoReview = snapshot.artifactReviews.find((item) => item.artifactId === demoArtifact?.id);
      const runnerGateTask = snapshot.tasks.find((item) => item.id === `task-${created.project.id}-runner-gates`);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.bridge.status).toBe("executed");
      expect(result.bridge.invocation.commandType).toBe("execution.start");
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: created.project.id, type: "patch" }),
          expect.objectContaining({ projectId: created.project.id, type: "demo-build" })
        ])
      );
      expect(patchArtifact?.ownerAgentId).toBe("agent-engineer");
      expect(demoArtifact?.ownerAgentId).toBe("agent-engineer");
      expect(patchArtifact?.status).toBe("in-review");
      expect(demoArtifact?.status).toBe("in-review");
      expect(demoReview?.decision).toBe("pending");
      expect(demoReview?.reviewerAgentId).toBe("agent-qa-automation");
      expect(runnerGateTask?.status).toBe("done");
      expect(runnerGateTask?.summary).toContain("外部执行桥已写回 Patch 与 Demo");
      expect(workflow?.currentStage).toBe("开发执行");
      expect(workflow?.state).toBe("current");

      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);

      expect(readiness.readiness.bridgeHandoffStatus).toBe("review-handoff");
      expect(readiness.readiness.bridgeHandoffSummary).toContain("等待规则审查");
      expect(readiness.currentHandoff.source).toBe("review-handoff");
      expect(readiness.currentHandoff.ownerRoleLabel).toBe("架构师");
      expect(readiness.currentHandoff.nextAction).toContain("发起规则审查");
      expect(readiness.currentHandoff.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(readiness.currentHandoff.runtimeExecutionBackendCommandPreview).toContain(
        'openclaw run-review --project "'
      );
      expect(readiness.currentHandoff.runtimeExecutionBackendInvocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          commandType: "review.run",
          artifactType: "patch"
        })
      );
      expect(
        readiness.releaseGate.escalationActions.some(
          (item) =>
            item.bridgeHandoffStatus === "review-handoff" &&
            item.label.includes("规则审查记录") &&
            item.ownerRoleLabel === "架构师" &&
            item.nextAction?.includes("发起规则审查")
        )
      ).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("advances a review handoff project directly through review backend bridge writeback", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "桥接规则审查直连台",
          sector: "智能客服 / 研发",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接规则审查直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const reviewReport = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-report"
      );
      const qaTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find(
        (item) => item.id === `task-${created.project.id}-qa-gate`
      );
      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const commandCenter = getCommandCenterForAI(dbPath);
      const reviewExecution = commandCenter.recentExecutions.find(
        (item) => item.commandId === "command-review-run"
      );

      expect(result.bridge.sourceKind).toBe("project-handoff");
      expect(result.bridge.sourceId).toBe(created.project.id);
      expect(result.bridge.retryCommandId).toBe("command-review-run");
      expect(result.bridge.invocation.commandType).toBe("review.run");
      expect(result.bridge.invocation.backend).toBe("OpenClaw");
      expect(result.commandExecution?.commandId).toBe("command-review-run");
      expect(result.commandExecution?.status).toBe("done");
      expect(result.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-review`);
      expect(result.commandExecution?.summary).toContain("已通过 OpenClaw Bridge 完成规则审查");
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: created.project.id, type: "review-report" })
        ])
      );
      expect(reviewReport?.status).toBe("ready");
      expect(qaTask?.ownerAgentId).toBe("agent-qa-automation");
      expect(qaTask?.status).toBe("in-progress");
      expect(readiness.readiness.bridgeHandoffStatus).toBe("qa-handoff");
      expect(readiness.readiness.bridgeHandoffSummary).toContain("已移交 QA 门禁");
      expect(readiness.currentHandoff.source).toBe("qa-handoff");
      expect(reviewExecution?.summary).toContain("已通过 OpenClaw Bridge 完成规则审查");
      expect(reviewExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-review`);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prepares a qa handoff project directly through the gate backend request", { timeout: 10000 }, async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_QA_EXEC_COMMAND",
        'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_QA_EXEC_BACKEND_COMMAND",
        'openclaw run-gate --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "桥接测试门禁直连台",
          sector: "智能客服 / 测试",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接测试门禁直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const prepared = prepareExecutionBackendRequestForAI({ projectId: created.project.id }, dbPath);

      expect(readiness.currentHandoff.source).toBe("qa-handoff");
      expect(prepared.sourceKind).toBe("project-handoff");
      expect(prepared.retryCommandId).toBe("command-gate-run");
      expect(prepared.invocation).toEqual(
        expect.objectContaining({
          backendId: "qa-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code QA",
          commandType: "gate.run",
          expectedArtifacts: expect.arrayContaining(["test-report", "playwright-run"])
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("advances a qa handoff project directly through gate backend bridge writeback", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_QA_EXEC_COMMAND",
        'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "桥接测试门禁发布台",
          sector: "智能客服 / 测试",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接测试门禁发布台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const testReport = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "test-report"
      );
      const playwrightRun = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "playwright-run"
      );
      const releaseBrief = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      const releaseBriefTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find(
        (item) => item.id === `task-${created.project.id}-release-brief`
      );
      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const commandCenter = getCommandCenterForAI(dbPath);
      const gateExecution = commandCenter.recentExecutions.find(
        (item) => item.commandId === "command-gate-run"
      );

      expect(result.bridge.sourceKind).toBe("project-handoff");
      expect(result.bridge.retryCommandId).toBe("command-gate-run");
      expect(result.bridge.invocation.commandType).toBe("gate.run");
      expect(result.commandExecution?.commandId).toBe("command-gate-run");
      expect(result.commandExecution?.status).toBe("done");
      expect(result.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-gate`);
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: created.project.id, type: "test-report" }),
          expect.objectContaining({ projectId: created.project.id, type: "playwright-run" })
        ])
      );
      expect(testReport?.status).toBe("ready");
      expect(playwrightRun?.status).toBe("ready");
      expect(releaseBrief?.status).toBe("draft");
      expect(releaseBriefTask?.stage).toBe("交付发布");
      expect(releaseBriefTask?.status).toBe("todo");
      expect(readiness.readiness.bridgeHandoffStatus).toBe("release-candidate");
      expect(readiness.currentHandoff.source).toBe("release-candidate");
      expect(readiness.currentHandoff.nextAction).toBe(
        "桥接链已进入放行候选，先由发布工程师 · Horse 收口交付说明 / 放行评审结论。"
      );
      expect(
        readiness.releaseGate.approvalTrace.find((item) => item.artifactType === "release-brief")
          ?.nextAction
      ).toBe("桥接链已进入放行候选，先由发布工程师 · Horse 收口交付说明 / 放行评审结论。");
      expect(
        readiness.releaseGate.escalationActions.some(
          (item) =>
            item.label === "交付说明 · 缺失" &&
            item.ownerLabel === "发布工程师 · Horse" &&
            item.ownerRoleLabel === "发布" &&
            item.nextAction === "桥接链已进入放行候选，先由发布工程师 · Horse 收口交付说明 / 放行评审结论。"
        )
      ).toBe(true);
      expect(gateExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-gate`);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("prepares a NanoClaw qa handoff payload with a fixed controller and routed qa profile", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-service-strategy",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-service-strategy"
      );
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'nanoclaw exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'nanoclaw review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_QA_EXEC_COMMAND",
        'nanoclaw gate --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Nano CEO");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND", "NanoClaw");
      vi.stubEnv(
        "FORGE_QA_EXEC_BACKEND_COMMAND",
        'nanoclaw run-gate --project "{projectId}" --taskpack "{taskPackId}" --agent "{agentId}" --controller "{controllerAgentId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "NanoClaw 测试门禁直连台",
          sector: "智能客服 / 测试",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "NanoClaw 测试门禁直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const prepared = prepareExecutionBackendRequestForAI({ projectId: created.project.id }, dbPath);

      expect(prepared.retryCommandId).toBe("command-gate-run");
      expect(prepared.invocation).toEqual(
        expect.objectContaining({
          backendId: "qa-execution-backend",
          backend: "NanoClaw",
          provider: "Nano CEO",
          commandType: "gate.run",
          commandPreview: `nanoclaw run-gate --project "${created.project.id}" --taskpack "${prepared.taskPackId}" --agent "agent-qa-automation" --controller "agent-service-strategy" --provider "Nano CEO"`
        })
      );
      expect(prepared.invocation.payload).toEqual(
        expect.objectContaining({
          projectId: created.project.id,
          commandType: "gate.run",
          agent: expect.objectContaining({
            id: "agent-qa-automation",
            role: "qa"
          }),
          controllerAgent: expect.objectContaining({
            id: "agent-service-strategy",
            name: "项目经理 · Lion",
            role: "pm"
          })
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prepares a release candidate project directly through the release backend request", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_QA_EXEC_COMMAND",
        'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_RELEASE_EXEC_COMMAND",
        'claude release --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_RELEASE_EXEC_PROVIDER", "Claude Code Release");
      vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_RELEASE_EXEC_BACKEND_COMMAND",
        'openclaw run-release --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "桥接交付说明直连台",
          sector: "智能客服 / 发布",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接交付说明直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );
      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );
      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        },
        dbPath
      );

      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const prepared = prepareExecutionBackendRequestForAI({ projectId: created.project.id }, dbPath);

      expect(readiness.currentHandoff.source).toBe("release-candidate");
      expect(prepared.sourceKind).toBe("project-handoff");
      expect(prepared.retryCommandId).toBe("command-release-prepare");
      expect(prepared.invocation).toEqual(
        expect.objectContaining({
          backendId: "release-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Release",
          commandType: "release.prepare",
          expectedArtifacts: expect.arrayContaining(["release-brief", "review-decision"])
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("advances a release candidate project directly through release backend bridge writeback", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_QA_EXEC_COMMAND",
        'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
      vi.stubEnv(
        "FORGE_RELEASE_EXEC_COMMAND",
        'claude release --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_RELEASE_EXEC_PROVIDER", "Claude Code Release");
      vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "桥接交付说明发布台",
          sector: "智能客服 / 发布",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接交付说明发布台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-runner-gates`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "启动研发执行并接通默认门禁",
          ownerAgentId: "agent-engineer",
          status: "in-progress",
          priority: "P0",
          category: "execution",
          summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        },
        dbPath
      );
      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );
      await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        },
        dbPath
      );

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-release`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const releaseBrief = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      const reviewDecision = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-decision"
      );
      const approvalTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find(
        (item) => item.id === `task-${created.project.id}-release-approval`
      );
      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const commandCenter = getCommandCenterForAI(dbPath);
      const releaseExecution = commandCenter.recentExecutions.find(
        (item) => item.commandId === "command-release-prepare"
      );

      expect(result.bridge.sourceKind).toBe("project-handoff");
      expect(result.bridge.retryCommandId).toBe("command-release-prepare");
      expect(result.bridge.invocation.commandType).toBe("release.prepare");
      expect(result.commandExecution?.commandId).toBe("command-release-prepare");
      expect(result.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-release`);
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: created.project.id, type: "release-brief" }),
          expect.objectContaining({ projectId: created.project.id, type: "review-decision" })
        ])
      );
      expect(releaseBrief?.status).toBe("in-review");
      expect(reviewDecision?.status).toBe("in-review");
      expect(approvalTask?.status).toBe("todo");
      expect(readiness.currentHandoff.source).toBe("approval");
      expect(releaseExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-release`);
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
        "当前动作：确认交付说明与放行口径"
      );
      expect(releaseExecution?.releaseClosureResponsibilityDetail).toContain(
        "确认责任：确认交付说明与放行口径"
      );
      expect(releaseExecution?.releaseClosureResponsibilityNextAction).toBe(
        "确认交付说明与放行口径"
      );
      expect(releaseExecution?.releaseClosureResponsibilitySourceLabel).toContain("整理交付说明");
      expect(releaseExecution?.releaseClosureResponsibilitySourceLabel).toContain(
        "来源命令：整理交付说明"
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("prepares an archive-stage project directly through the archive backend request", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ARCHIVE_EXEC_COMMAND",
        'claude archive --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ARCHIVE_EXEC_PROVIDER", "Claude Code Archive");
      vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ARCHIVE_EXEC_BACKEND_COMMAND",
        'openclaw run-archive --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "归档沉淀直连台",
          sector: "智能客服 / 归档",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "归档沉淀直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI({ commandId: "command-execution-start", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-review-run", projectId: created.project.id }, dbPath);

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI({ commandId: "command-gate-run", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-release-prepare", projectId: created.project.id }, dbPath);
      upsertRunForAI(
        {
          id: `run-${created.project.id}-approval-runtime`,
          projectId: created.project.id,
          title: "放行阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [{ name: "git", status: "pass" }]
        },
        dbPath
      );
      executeCommandForAI({ commandId: "command-release-approve", projectId: created.project.id }, dbPath);

      const payload = prepareExecutionBackendRequestForAI({ projectId: created.project.id }, dbPath);

      expect(payload.sourceKind).toBe("project-handoff");
      expect(payload.retryCommandId).toBe("command-archive-capture");
      expect(payload.invocation).toEqual(
        expect.objectContaining({
          backendId: "archive-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Archive",
          commandType: "archive.capture",
          expectedArtifacts: ["knowledge-card", "release-audit"],
          taskPackId: expect.any(String),
          commandPreview:
            `openclaw run-archive --project "${created.project.id}" --taskpack "${payload.taskPackId}" --provider "Claude Code Archive"`
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("advances an archive-stage project directly through archive backend bridge writeback", { timeout: 15000 }, async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ARCHIVE_EXEC_COMMAND",
        'claude archive --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ARCHIVE_EXEC_PROVIDER", "Claude Code Archive");
      vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "归档沉淀直连台",
          sector: "智能客服 / 归档",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "归档沉淀直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI({ commandId: "command-execution-start", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-review-run", projectId: created.project.id }, dbPath);

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI({ commandId: "command-gate-run", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-release-prepare", projectId: created.project.id }, dbPath);
      upsertRunForAI(
        {
          id: `run-${created.project.id}-approval-runtime`,
          projectId: created.project.id,
          title: "放行阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [{ name: "git", status: "pass" }]
        },
        dbPath
      );
      executeCommandForAI({ commandId: "command-release-approve", projectId: created.project.id }, dbPath);

      const result = await writebackExecutionBackendBridgeRunForAI(
        {
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-archive`
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const knowledgeCard = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "knowledge-card"
      );
      const releaseAudit = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-audit"
      );
      const archiveTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-knowledge-card`
      );
      const commandCenter = getCommandCenterForAI(dbPath);
      const archiveExecution = commandCenter.recentExecutions.find(
        (item) => item.commandId === "command-archive-capture"
      );
      const releaseAuditTrace = getDeliveryReadinessForAI(
        { projectId: created.project.id },
        dbPath
      ).releaseGate.approvalTrace.find((item) => item.artifactType === "release-audit");
      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);
      const controlPlane = getControlPlaneSnapshotForAI({ projectId: created.project.id }, dbPath);

      expect(result.bridge.sourceKind).toBe("project-handoff");
      expect(result.bridge.retryCommandId).toBe("command-archive-capture");
      expect(result.bridge.invocation.commandType).toBe("archive.capture");
      expect(result.commandExecution?.commandId).toBe("command-archive-capture");
      expect(result.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-archive`);
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: created.project.id, type: "knowledge-card", status: "ready" }),
          expect.objectContaining({ projectId: created.project.id, type: "release-audit", status: "ready" })
        ])
      );
      expect(knowledgeCard?.status).toBe("ready");
      expect(releaseAudit?.status).toBe("ready");
      expect(archiveTask?.status).toBe("done");
      expect(archiveExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-archive`);
      expect(releaseAuditTrace?.sourceCommandId).toBe("command-archive-capture");
      expect(releaseAuditTrace?.relatedRunId).toBe(`run-bridge-${created.project.id}-archive`);
      expect(readiness.archiveProvenance?.artifactType).toBe("release-audit");
      expect(readiness.archiveProvenance?.archiveCommandId).toBe("command-archive-capture");
      expect(readiness.archiveProvenance?.archiveRunId).toBe(`run-bridge-${created.project.id}-archive`);
      expect(readiness.archiveProvenance?.handoffCommandId).toBe("command-release-prepare");
      expect(readiness.archiveProvenance?.handoffRunLabel).toContain("交付说明整理");
      expect(readiness.releaseGate.archiveProvenance?.archiveCommandId).toBe("command-archive-capture");
      expect(readiness.approvalHandoff).toEqual(
        expect.objectContaining({
          summary: "确认后将继续进入归档沉淀。",
          detail: expect.stringContaining("确认交付说明与放行口径后，继续沉淀知识卡与归档审计。")
        })
      );
      expect(readiness.releaseClosure).toEqual(
        expect.objectContaining({
          status: "archive-recorded",
          summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          nextAction: null,
          sourceCommandId: "command-archive-capture",
          sourceCommandLabel: "触发归档沉淀",
          relatedRunLabel: expect.stringContaining("触发归档沉淀")
        })
      );
      expect(readiness.releaseClosureResponsibility).toEqual(
        expect.objectContaining({
          summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          sourceLabel: expect.stringContaining("触发归档沉淀"),
          nextAction: "沉淀交付知识卡与归档审计记录"
        })
      );
      expect(readiness.releaseGate.approvalHandoff).toEqual(
        expect.objectContaining({
          summary: "确认后将继续进入归档沉淀。",
          detail: expect.stringContaining("确认交付说明与放行口径后，继续沉淀知识卡与归档审计。")
        })
      );
      expect(controlPlane.archiveProvenance?.archiveCommandId).toBe("command-archive-capture");
      expect(controlPlane.archiveProvenance?.handoffCommandId).toBe("command-release-prepare");
      expect(controlPlane.approvalHandoff).toEqual(
        expect.objectContaining({
          summary: "确认后将继续进入归档沉淀。",
          detail: expect.stringContaining("确认交付说明与放行口径后，继续沉淀知识卡与归档审计。")
        })
      );
      expect(controlPlane.releaseClosure).toEqual(
        expect.objectContaining({
          status: "archive-recorded",
          summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          nextAction: null,
          sourceCommandId: "command-archive-capture",
          sourceCommandLabel: "触发归档沉淀",
          relatedRunLabel: expect.stringContaining("触发归档沉淀")
        })
      );
      expect(controlPlane.releaseClosureResponsibility).toEqual(
        expect.objectContaining({
          summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          sourceLabel: expect.stringContaining("触发归档沉淀"),
          nextAction: "沉淀交付知识卡与归档审计记录"
        })
      );
      expect(commandCenter.archiveProvenance?.archiveCommandId).toBe("command-archive-capture");
      expect(commandCenter.archiveProvenance?.archiveRunId).toBe(`run-bridge-${created.project.id}-archive`);
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
      expect(commandCenter.approvalHandoff).toEqual(
        expect.objectContaining({
          summary: "确认后将继续进入归档沉淀。",
          detail: expect.stringContaining("确认交付说明与放行口径后，继续沉淀知识卡与归档审计。")
        })
      );
      expect(commandCenter.releaseClosure).toEqual(
        expect.objectContaining({
          status: "archive-recorded",
          summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          nextAction: null,
          sourceCommandId: "command-archive-capture",
          sourceCommandLabel: "触发归档沉淀",
          relatedRunLabel: expect.stringContaining("触发归档沉淀")
        })
      );
      expect(commandCenter.releaseClosureResponsibility).toEqual(
        expect.objectContaining({
          summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
          detail: expect.stringContaining("当前归档沉淀接棒来源于"),
          sourceLabel: expect.stringContaining("触发归档沉淀"),
          nextAction: "沉淀交付知识卡与归档审计记录"
        })
      );
      expect(commandCenter.archiveProvenance?.handoffCommandId).toBe("command-release-prepare");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("surfaces the archive backend entry in current handoff after release approval", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ARCHIVE_EXEC_COMMAND",
        'claude archive --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ARCHIVE_EXEC_PROVIDER", "Claude Code Archive");
      vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ARCHIVE_EXEC_BACKEND_COMMAND",
        'openclaw run-archive --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );

      const created = createProjectForAI(
        {
          name: "归档沉淀直连台",
          sector: "智能客服 / 归档",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "归档沉淀直连台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI({ commandId: "command-execution-start", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-review-run", projectId: created.project.id }, dbPath);

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI({ commandId: "command-gate-run", projectId: created.project.id }, dbPath);
      executeCommandForAI({ commandId: "command-release-prepare", projectId: created.project.id }, dbPath);
      upsertRunForAI(
        {
          id: `run-${created.project.id}-approval-runtime`,
          projectId: created.project.id,
          title: "放行阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [{ name: "git", status: "pass" }]
        },
        dbPath
      );
      executeCommandForAI({ commandId: "command-release-approve", projectId: created.project.id }, dbPath);

      const readiness = getDeliveryReadinessForAI({ projectId: created.project.id }, dbPath);

      expect(readiness.currentHandoff.stage).toBe("归档复用");
      expect(readiness.currentHandoff.source).toBe("stage-default");
      expect(readiness.currentHandoff.ownerRoleLabel).toBe("知识沉淀");
      expect(readiness.currentHandoff.nextAction).toBe("沉淀交付知识卡");
      expect(readiness.currentHandoff.sourceCommandId).toBe("command-release-prepare");
      expect(readiness.currentHandoff.relatedRunId).toMatch(
        new RegExp(`^run-${created.project.id}-release-`)
      );
      expect(readiness.currentHandoff.relatedRunLabel).toContain("交付说明整理");
      expect(readiness.currentHandoff.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(readiness.currentHandoff.runtimeExecutionBackendCommandPreview).toContain(
        'openclaw run-archive --project "'
      );
      expect(readiness.currentHandoff.runtimeExecutionBackendInvocation).toEqual(
        expect.objectContaining({
          backendId: "archive-execution-backend",
          backend: "OpenClaw",
          commandType: "archive.capture",
          artifactType: null
        })
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("blocks release approval with bridge handoff guidance when review has only reached qa handoff", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

      const created = createProjectForAI(
        {
          name: "桥接放行等待台",
          sector: "智能客服 / 审查",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "桥接放行等待台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      upsertProjectTask(
        {
          id: `task-${created.project.id}-review-remediation`,
          projectId: created.project.id,
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: `command-execution-${created.project.id}-review-run`,
          commandId: "command-review-run",
          projectId: created.project.id,
          taskPackId: `artifact-${created.project.id}-task-pack`,
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: [`task-${created.project.id}-review-remediation`]
        },
        dbPath
      );

      await writebackExecutionBackendBridgeRunForAI(
        {
          remediationId: `task-${created.project.id}-review-remediation`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-release-approve",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string; summary: string };
        decisions: Array<{ summary: string }>;
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const escalationTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-release-escalation`
      );

      expect(result.execution.status).toBe("blocked");
      expect(result.execution.summary).toContain("已移交 QA 门禁");
      expect(result.decisions[0]?.summary).toContain("已移交 QA 门禁");
      expect(escalationTask?.summary).toContain("已移交 QA 门禁");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("retries a unified remediation entry through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = retryRemediationForAI({ remediationId: "task-retail-playwright" }, dbPath);

      expect(result.command.id).toBe("command-gate-run");
      expect(result.execution.commandId).toBe("command-gate-run");
      expect(result.retryApiPath).toBe("/api/forge/remediations/retry");
      expect(result.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.retryRunnerCommand).toContain("--remediation-id task-retail-playwright");
      expect(result.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("lists prompt templates for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getPromptTemplatesForAI(dbPath);

      expect(result.total).toBe(3);
      expect(result.items[0]?.title).toContain("模板");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("lists project templates for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getProjectTemplatesForAI(dbPath);

      expect(result.total).toBe(3);
      expect(result.items[0]?.title).toContain("模板");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns the team registry for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getTeamRegistryForAI(dbPath);

      expect(result.totalAgents).toBe(19);
      expect(result.totalSkills).toBeGreaterThan(0);
      expect(result.totalSops).toBeGreaterThan(0);
      expect(result.agents[0]?.name).toContain("·");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns the capability registry for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
        'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
      );
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );

      const result = getCapabilityRegistryForAI(dbPath);

      expect(result.totalPrompts).toBe(3);
      expect(result.totalComponents).toBeGreaterThan(0);
      expect(result.totalSkills).toBeGreaterThan(0);
      expect(result.totalSops).toBeGreaterThan(0);
      expect(result.executionBackendCount).toBe(2);
      expect(result.activeExecutionBackendCount).toBeGreaterThanOrEqual(1);
      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "engineer-execution-backend",
            kind: "engineer",
            label: "研发执行",
            backend: "OpenClaw",
            provider: "Claude Code",
            source: "FORGE_ENGINEER_EXEC_COMMAND",
            commandKey: "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
            runnerProfile: "engineer-runner",
            backendCommandTemplate:
              'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"',
            backendCommandPlaceholders: ["projectId", "taskPackId", "provider"],
            supportedCommandTypes: ["execution.start"],
            expectedArtifacts: ["patch", "demo-build"]
          }),
          expect.objectContaining({
            id: "reviewer-execution-backend",
            kind: "reviewer",
            label: "规则审查",
            backend: "OpenClaw",
            provider: "Claude Code Review",
            source: "FORGE_REVIEW_EXEC_COMMAND",
            commandKey: "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
            runnerProfile: "reviewer-runner",
            backendCommandTemplate:
              'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"',
            backendCommandPlaceholders: ["projectId", "taskPackId", "artifactType", "provider"],
            supportedCommandTypes: ["review.run"],
            expectedArtifacts: ["review-report"]
          })
        ])
      );
      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commandConfigured: true,
            commandSource: expect.stringMatching(/FORGE_.*_EXEC_BACKEND_COMMAND/)
          })
        ])
      );
      expect(result.assets[0]?.title).toBeTruthy();
      expect(result.components[0]?.title).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns the component registry for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getComponentRegistryForAI(
        { projectId: "retail-support", taskPackId: "artifact-taskpack-retail", sourceType: "github" },
        dbPath
      );

      expect(result.total).toBeGreaterThan(0);
      expect(result.project?.id).toBe("retail-support");
      expect(result.taskPack?.id).toBe("artifact-taskpack-retail");
      expect(result.recommendedCount).toBeGreaterThan(0);
      expect(result.assemblySuggestions[0]?.componentId).toBe("component-payment-checkout");
      expect(result.assemblySuggestions[0]?.reason).toContain("TaskPack");
      expect(result.usageSignals[0]?.componentId).toBe("component-payment-checkout");
      expect(result.usageSignals[0]?.blockedCount).toBeGreaterThanOrEqual(0);
      expect(result.categories).toEqual(
        expect.arrayContaining(["auth", "payment", "file", "communication"])
      );
      expect(result.items.every((item) => item.sourceType === "github")).toBe(true);
      expect(result.items.some((item) => item.id === "component-payment-checkout")).toBe(true);
      expect(result.items[0]?.assemblyContract.deliveryMode).toBeTruthy();
      expect(result.items[0]?.assemblyContract.importPath).toBeTruthy();
      expect(Array.isArray(result.items[0]?.assemblyContract.setupSteps)).toBe(true);
      expect(Array.isArray(result.items[0]?.assemblyContract.ownedPaths)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("searches external component resources for ai callers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 101,
              full_name: "acme/next-payment-kit",
              name: "next-payment-kit",
              description: "Reusable payment flows for Next.js apps.",
              html_url: "https://github.com/acme/next-payment-kit",
              language: "TypeScript",
              stargazers_count: 1450,
              pushed_at: "2026-02-20T08:00:00Z",
              topics: ["payment", "checkout", "nextjs"]
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    ) as unknown as typeof fetch;

    try {
      ensureForgeDatabase(dbPath);

      const result = await searchExternalComponentResourcesForAI(
        {
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          category: "payment",
          language: "TypeScript"
        },
        dbPath,
        fetcher
      );

      expect(result.status).toBe("ready");
      expect(result.project?.id).toBe("retail-support");
      expect(result.taskPack?.id).toBe("artifact-taskpack-retail");
      expect(result.total).toBe(1);
      expect(result.items[0]?.sourceType).toBe("github-candidate");
      expect(result.items[0]?.repoFullName).toBe("acme/next-payment-kit");
      expect(result.items[0]?.recommendationReason).toContain("支付结算组件");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns a component assembly plan for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getComponentAssemblyPlanForAI(
        { projectId: "retail-support", taskPackId: "artifact-taskpack-retail", maxItems: 2 },
        dbPath
      );

      expect(result.project?.id).toBe("retail-support");
      expect(result.taskPack?.id).toBe("artifact-taskpack-retail");
      expect(result.totalSuggested).toBeGreaterThan(0);
      expect(result.selectedCount).toBe(2);
      expect(result.pendingCount).toBe(2);
      expect(result.linkedCount).toBe(0);
      expect(result.items[0]?.componentId).toBe("component-payment-checkout");
      expect(result.items[0]?.reason).toContain("TaskPack");
      expect(result.items[0]?.assemblyContract.deliveryMode).toBeTruthy();
      expect(result.items[0]?.assemblyContract.sourceLocator).toBeTruthy();
      expect(result.items[0]?.assemblyContract.installCommand).toBeTruthy();
      expect(result.pendingItems[0]?.componentId).toBe("component-payment-checkout");
      expect(result.nextAction).toContain("TaskPack");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("applies component assembly links for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = applyComponentAssemblyForAI(
        {
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          componentIds: ["component-payment-checkout", "component-auth-email"],
          triggeredBy: "资产页"
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const registry = getComponentRegistryForAI({ projectId: "retail-support" }, dbPath);
      const componentLinks = snapshot.projectAssetLinks.filter(
        (item) => item.projectId === "retail-support" && item.targetType === "component"
      );
      const assemblyExecution = snapshot.commandExecutions.find(
        (item) => item.commandId === "command-component-assemble"
      );

      expect(result.linkedCount).toBe(2);
      expect(result.items[0]?.component.id).toBe("component-payment-checkout");
      expect(result.nextAction).toContain("Engineer Runner");
      expect(result.execution.commandId).toBe("command-component-assemble");
      expect(result.execution.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.execution.followUpTaskIds).toContain("task-retail-support-component-assembly");
      expect(result.execution.summary).toContain("待装配组件");
      expect(result.execution.summary).toContain("组件装配清单");
      expect(result.artifact?.type).toBe("assembly-plan");
      expect(result.artifact?.title).toContain("组件装配清单");
      expect(result.assemblyManifest.installCommands).toEqual(
        expect.arrayContaining([
          "pnpm add @forge-components/payment-checkout",
          "pnpm --filter app add @forge-modules/auth-email-login"
        ])
      );
      expect(result.assemblyManifest.requiredEnv).toEqual(
        expect.arrayContaining([
          "PAYMENT_CALLBACK_BASE_URL",
          "PAYMENT_PROVIDER_KEY",
          "AUTH_API_BASE_URL",
          "AUTH_SESSION_SECRET"
        ])
      );
      expect(result.assemblyManifest.setupSteps.length).toBeGreaterThan(2);
      expect(result.assemblyManifest.smokeTestCommands).toEqual(
        expect.arrayContaining([
          "pnpm test -- payment-checkout.integration",
          "pnpm test -- auth-email-login.smoke"
        ])
      );
      expect(result.assemblyManifest.ownedPaths).toEqual(
        expect.arrayContaining([
          "src/modules/payment",
          "src/app/api/payment",
          "src/modules/auth",
          "src/app/(auth)"
        ])
      );
      expect(result.assemblyManifest.items[0]?.componentId).toBe("component-payment-checkout");
      expect(result.assemblyManifest.items[0]?.sourceLocator).toBeTruthy();
      expect(componentLinks).toHaveLength(2);
      expect(assemblyExecution?.taskPackId).toBe("artifact-taskpack-retail");
      expect(assemblyExecution?.followUpTaskIds).toContain("task-retail-support-component-assembly");
      expect(registry.linkedCount).toBe(2);
      expect(registry.linkedItems[0]?.componentId).toBeTruthy();
      expect(componentLinks[0]?.usageGuide).toBeTruthy();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns the runner registry for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getRunnerRegistryForAI(dbPath);

      expect(result.totalRunners).toBeGreaterThan(0);
      expect(result.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(result.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(result.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.capabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(result.items[0]?.name).toContain("执行器");
      expect(result.items[0]?.capabilities.length).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns command executions and policy decisions for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = getCommandCenterForAI(dbPath) as typeof getCommandCenterForAI extends (
        ...args: never[]
      ) => infer TResult
        ? TResult & {
            totalExecutions?: number;
            unifiedRemediationApiPath?: string;
            runtimeSummary?: {
              totalRunners?: number;
              healthyRunnerCount?: number;
              capabilityDetails?: string[];
            };
            recentExecutions?: Array<{
              commandId: string;
              runtimeEvidenceSummary?: string;
              relatedRunId?: string | null;
              taskPackId?: string | null;
              taskPackLabel?: string | null;
              pendingComponentLabels?: string[];
              componentAssemblyAction?: string | null;
              followUpTasks?: Array<{
                unifiedRetryApiPath?: string;
                unifiedRetryRunnerCommand?: string;
              }>;
            }>;
            recentDecisions?: Array<{ hookId: string }>;
            releaseGate?: { escalationActions?: Array<{ runtimeEvidenceLabel?: string }> };
            remediationQueue?: Array<{
              remediationOwnerLabel?: string;
              retryRunnerCommand?: string;
              unifiedRetryApiPath?: string;
              unifiedRetryRunnerCommand?: string;
            }>;
          }
        : never;

      expect(result.totalExecutions).toBeGreaterThan(0);
      expect(result.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
      expect(result.runtimeSummary?.totalRunners).toBeGreaterThan(0);
      expect(result.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
      expect(result.runtimeSummary?.capabilityDetails).toEqual(
        expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
      );
      expect(result.recentExecutions?.[0]?.commandId).toBeTruthy();
      expect(result.recentExecutions?.[0]?.relatedRunId).toBe("run-2");
      expect(result.recentExecutions?.[0]?.runtimeEvidenceSummary).toContain("Version 1.55.0");
      expect(result.recentExecutions?.[0]?.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.recentExecutions?.[0]?.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.recentExecutions?.[0]?.pendingComponentLabels).toContain("支付结算组件");
      expect(result.recentExecutions?.[0]?.componentAssemblyAction).toContain("待装配组件");
      expect(result.recentExecutions?.[0]?.followUpTasks?.[0]?.unifiedRetryApiPath).toBe(
        "/api/forge/remediations/retry"
      );
      expect(result.recentExecutions?.[0]?.followUpTasks?.[0]).toMatchObject({
        taskPackId: "artifact-taskpack-retail",
        taskPackLabel: "支付失败修复任务包"
      });
      expect(result.recentExecutions?.[0]?.followUpTasks?.[0]?.unifiedRetryRunnerCommand).toContain(
        "--remediation-id task-retail-playwright"
      );
      expect(result.recentExecutions?.[0]?.followUpTasks?.[0]?.unifiedRetryRunnerCommand).toContain(
        "--taskpack-id artifact-taskpack-retail"
      );
      expect(result.recentDecisions?.[0]?.hookId).toBeTruthy();
      expect(result.remediationQueue?.[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
      expect(result.remediationQueue?.[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
      expect(result.remediationQueue?.[0]).toMatchObject({
        taskPackId: "artifact-taskpack-retail",
        taskPackLabel: "支付失败修复任务包"
      });
      expect(result.remediationQueue?.[0]?.unifiedRetryRunnerCommand).toContain(
        "--remediation-id task-retail-playwright"
      );
      expect(result.remediationQueue?.[0]?.unifiedRetryRunnerCommand).toContain(
        "--taskpack-id artifact-taskpack-retail"
      );
      expect(result.remediationQueue?.[0]?.retryRunnerCommand).toContain("--task-id task-retail-playwright");
      expect(result.remediationQueue?.[0]?.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
      expect(result.releaseGate?.escalationActions?.[0]?.runtimeEvidenceLabel).toContain(
        "Version 1.55.0"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it(
    "pushes model execution provider context into command center and retry actions",
    { timeout: 10000 },
    () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
        'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
      );
      upsertProjectTask(
        {
          id: "task-retail-review-remediation",
          projectId: "retail-support",
          stage: "开发执行",
          title: "复跑规则审查并确认补丁口径",
          ownerAgentId: "agent-engineer",
          status: "todo",
          priority: "P2",
          category: "review",
          summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
        },
        dbPath
      );
      recordCommandExecutionForAI(
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          followUpTaskIds: ["task-retail-review-remediation"]
        },
        dbPath
      );
      upsertRunForAI(
        {
          id: "run-retail-review-provider",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-auth-email"],
          title: "执行退款失败补丁规则审查",
          executor: "Reviewer",
          cost: "$0.28",
          state: "done",
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
        },
        dbPath
      );

      const commandCenter = getCommandCenterForAI(dbPath) as ReturnType<typeof getCommandCenterForAI> & {
        recentExecutions?: Array<{
          commandId: string;
          runtimeModelProviderLabel?: string | null;
          runtimeExecutionBackendLabel?: string | null;
          runtimeModelExecutionDetail?: string | null;
          followUpTasks?: Array<{
            runtimeModelProviderLabel?: string | null;
            runtimeExecutionBackendLabel?: string | null;
            runtimeModelExecutionDetail?: string | null;
            remediationAction?: string | null;
          }>;
        }>;
      };
      const reviewExecution = commandCenter.recentExecutions?.find(
        (item) => item.commandId === "command-review-run"
      );
      const retry = retryTaskForAI({ taskId: "task-retail-review-remediation" }, dbPath) as ReturnType<
        typeof retryTaskForAI
      > & {
        runtimeModelProviderLabel?: string | null;
        runtimeExecutionBackendLabel?: string | null;
        runtimeExecutionBackendCommandPreview?: string | null;
        runtimeModelExecutionDetail?: string | null;
        nextAction?: string | null;
      };
      const remediationRetry = retryRemediationForAI(
        { remediationId: "task-retail-review-remediation" },
        dbPath
      ) as ReturnType<typeof retryRemediationForAI> & {
        runtimeExecutionBackendInvocation?: {
          backendId: string;
          backend: string;
          provider: string;
          commandType: string;
          artifactType: string | null;
          commandPreview: string;
        } | null;
        runtimeExecutionBackendCommandPreview?: string | null;
        nextAction?: string | null;
      };

      expect(reviewExecution?.runtimeModelProviderLabel).toBe("Claude Code Review");
      expect(reviewExecution?.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(reviewExecution?.runtimeModelExecutionDetail).toBe(
        "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      );
      expect(reviewExecution?.followUpTasks?.[0]?.runtimeModelProviderLabel).toBe("Claude Code Review");
      expect(reviewExecution?.followUpTasks?.[0]?.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(reviewExecution?.followUpTasks?.[0]?.remediationAction).toContain(
        "模型执行器：Claude Code Review"
      );
      expect(retry.runtimeModelProviderLabel).toBe("Claude Code Review");
      expect(retry.runtimeExecutionBackendLabel).toBe("OpenClaw");
      expect(retry.runtimeModelExecutionDetail).toBe(
        "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      );
      expect(retry.nextAction).toContain("模型执行器：Claude Code Review");
      expect(retry.nextAction).toContain("执行后端：OpenClaw");
      expect(retry.runtimeExecutionBackendCommandPreview).toBe(
        'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      );
      expect(retry.runtimeExecutionBackendInvocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Review",
          commandType: "review.run",
          artifactType: "patch",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
      expect(remediationRetry.runtimeExecutionBackendInvocation).toEqual(
        expect.objectContaining({
          backendId: "reviewer-execution-backend",
          backend: "OpenClaw",
          provider: "Claude Code Review",
          commandType: "review.run",
          artifactType: "patch",
          commandPreview:
            'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
        })
      );
      expect(remediationRetry.runtimeExecutionBackendCommandPreview).toBe(
        'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      );
      expect(remediationRetry.nextAction).toContain("执行后端：OpenClaw");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
    }
  );

  it("retries a remediation task through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");

      const result = retryTaskForAI(
        {
          taskId: "task-retail-playwright"
        },
        dbPath
      );

      expect(result.command.id).toBe("command-gate-run");
      expect(result.execution.commandId).toBe("command-gate-run");
      expect(result.project.id).toBe("retail-support");
      expect(result.retryApiPath).toBe("/api/forge/tasks/retry");
      expect(result.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.retryRunnerCommand).toContain("--task-id task-retail-playwright");
      expect(result.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
      expect(result.retryRunnerArgs).toEqual([
        "--task-id",
        "task-retail-playwright",
        "--project-id",
        "retail-support",
        "--taskpack-id",
        "artifact-taskpack-retail"
      ]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("retries a component assembly task through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "prd",
          title: "售后修复总台 PRD 草案",
          ownerAgentId: "agent-pm",
          status: "ready"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "architecture-note",
          title: "售后修复总台 架构说明",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "ui-spec",
          title: "售后修复总台 原型与交互规范",
          ownerAgentId: "agent-design",
          status: "ready"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-taskpack-generate",
          projectId: created.project.id
        },
        dbPath
      );

      const result = retryTaskForAI(
        {
          taskId: `task-${created.project.id}-component-assembly`
        },
        dbPath
      ) as {
        command: { id: string };
        execution: { commandId: string };
        linkedCount: number;
      };

      expect(result.command.id).toBe("command-component-assemble");
      expect(result.execution.commandId).toBe("command-component-assemble");
      expect(result.linkedCount).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("retries a release escalation through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");

      const result = retryEscalationForAI(
        {
          taskId: "task-retail-playwright"
        },
        dbPath
      );

      expect(result.command.id).toBe("command-gate-run");
      expect(result.execution.commandId).toBe("command-gate-run");
      expect(result.project.id).toBe("retail-support");
      expect(result.retryApiPath).toBe("/api/forge/escalations/retry");
      expect(result.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
      expect(result.taskPackId).toBe("artifact-taskpack-retail");
      expect(result.taskPackLabel).toBe("支付失败修复任务包");
      expect(result.retryRunnerCommand).toContain("--task-id task-retail-playwright");
      expect(result.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
      expect(result.unifiedRetryRunnerCommand).toContain("--remediation-id task-retail-playwright");
      expect(result.unifiedRetryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("records a command execution and policy decisions for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = recordCommandExecutionForAI(
        {
          id: "command-execution-release-blocked",
          commandId: "command-gate-run",
          projectId: "retail-support",
          status: "blocked",
          summary: "现实校验 Agent 发起门禁时被发布策略阻止。",
          triggeredBy: "现实校验 Agent",
          decisions: [
            {
              id: "policy-decision-release-blocked",
              hookId: "hook-before-release",
              outcome: "block",
              summary: "Playwright 门禁失败，禁止推进发布。"
            }
          ]
        },
        dbPath
      ) as {
        execution: { id: string; status: string };
        decisions: Array<{ id: string; outcome: string }>;
      };

      expect(result.execution.id).toBe("command-execution-release-blocked");
      expect(result.execution.status).toBe("blocked");
      expect(result.decisions[0]?.outcome).toBe("block");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("auto-generates a blocking policy decision when required artifacts are missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = recordCommandExecutionForAI(
        {
          id: "command-execution-auto-blocked",
          commandId: "command-execution-start",
          projectId: "clinic-rag",
          status: "blocked",
          summary: "尝试启动研发执行。",
          triggeredBy: "后端研发 Agent"
        },
        dbPath
      ) as {
        decisions: Array<{ hookId: string; outcome: string; summary: string }>;
      };

      expect(result.decisions[0]?.hookId).toBe("hook-before-run");
      expect(result.decisions[0]?.outcome).toBe("block");
      expect(result.decisions[0]?.summary).toContain("缺少必要工件");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes the PRD command and persists a new PRD draft", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = executeCommandForAI(
        {
          commandId: "command-prd-generate",
          projectId: "retail-support"
        },
        dbPath
      ) as {
        execution: { status: string };
        document?: { title: string };
      };

      expect(result.execution.status).toBe("done");
      expect(result.document?.title).toContain("PRD 草案");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("links PRD command execution to artifacts, tasks and workflow state", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-prd-generate",
          projectId: created.project.id
        },
        dbPath
      );

      const fullSnapshot = loadDashboardSnapshot(dbPath);
      const prdArtifact = fullSnapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "prd"
      );
      const workflow = fullSnapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const prdTask = fullSnapshot.tasks.find(
        (item) => item.projectId === created.project.id && item.title.includes("PRD")
      );

      expect(fullSnapshot.activeProjectId).toBe(created.project.id);
      expect(prdArtifact?.status).toBe("ready");
      expect(prdArtifact?.title).toContain("PRD 草案");
      expect(workflow?.currentStage).toBe("方案与任务包");
      expect(workflow?.blockers.join(" / ")).toContain("架构说明");
      expect(prdTask?.status).toBe("done");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes the gate command and returns a blocked result when gates are not ready", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: "retail-support"
        },
        dbPath
      ) as {
        execution: { status: string; summary: string };
        decisions: Array<{ outcome: string }>;
      };

      expect(result.execution.status).toBe("blocked");
      expect(result.execution.summary).toContain("门禁");
      expect(result.decisions.length).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("links gate command blocking to workflow blockers and execution tasks", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: "retail-support"
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === "retail-support");
      const testReportArtifact = snapshot.artifacts.find(
        (item) => item.projectId === "retail-support" && item.type === "test-report"
      );
      const task = listTasksForAI({ projectId: "retail-support" }, dbPath).items.find((item) =>
        item.title.includes("Playwright")
      );

      expect(workflow?.currentStage).toBe("测试验证");
      expect(workflow?.state).toBe("blocked");
      expect(workflow?.blockers.join(" / ")).toContain("门禁");
      expect(testReportArtifact?.status).toBe("in-review");
      expect(task?.status).toBe("blocked");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("links TaskPack command execution to a ready task pack and development handoff", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-prd-generate",
          projectId: created.project.id
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "architecture-note",
          title: "售后修复总台 架构说明",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "ui-spec",
          title: "售后修复总台 原型与交互规范",
          ownerAgentId: "agent-design",
          status: "ready"
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-taskpack-generate",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string; summary?: string; followUpTaskIds?: string[] };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const taskPackArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "task-pack"
      );
      const componentLinks = snapshot.projectAssetLinks.filter(
        (item) => item.projectId === created.project.id && item.targetType === "component"
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const runnerTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find((item) =>
        item.title.includes("本地执行")
      );
      const assemblyTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find((item) =>
        item.id === `task-${created.project.id}-component-assembly`
      );

      expect(result.execution.status).toBe("done");
      expect(result.execution.followUpTaskIds).toContain(`task-${created.project.id}-component-assembly`);
      expect(result.execution.summary).toContain("待装配组件");
      expect(taskPackArtifact?.status).toBe("ready");
      expect(componentLinks.length).toBeGreaterThan(0);
      expect(assemblyTask?.status).toBe("todo");
      expect(assemblyTask?.summary).toContain("待装配组件");
      expect(workflow?.currentStage).toBe("开发执行");
      expect(runnerTask?.status).toBe("in-progress");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("executes component assembly through the standard command path", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "prd",
          title: "售后修复总台 PRD 草案",
          ownerAgentId: "agent-pm",
          status: "ready"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "architecture-note",
          title: "售后修复总台 架构说明",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "ui-spec",
          title: "售后修复总台 原型与交互规范",
          ownerAgentId: "agent-design",
          status: "ready"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-taskpack-generate",
          projectId: created.project.id
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-component-assemble",
          projectId: created.project.id,
          componentIds: ["component-payment-checkout"]
        },
        dbPath
      ) as {
        execution: { status: string; commandId: string; taskPackId?: string | null };
        linkedCount: number;
      };

      expect(result.execution.status).toBe("done");
      expect(result.execution.commandId).toBe("command-component-assemble");
      expect(result.execution.taskPackId).toBeTruthy();
      expect(result.linkedCount).toBe(1);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("links execution start to a live run and demo artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "登录与账号体系需要先装入执行上下文。",
          usageGuide: "先接邮箱登录，再补验证码兜底。"
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id,
          selectedModel: "Claude Code",
          thinkingBudget: "高"
        },
        dbPath
      ) as {
        execution: { status: string; taskPackId?: string | null; summary?: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const patchArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "patch"
      );
      const taskPackArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "task-pack"
      );
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const demoReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === demoArtifact?.id
      );
      const run = snapshot.runs.find(
        (item) => item.projectId === created.project.id && item.state === "running"
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.execution.status).toBe("done");
      expect(patchArtifact?.status).toBe("in-review");
      expect(patchArtifact?.title).toContain("Patch");
      expect(demoArtifact?.status).toBe("in-review");
      expect(demoReview?.decision).toBe("pending");
      expect(demoReview?.conditions.length).toBeGreaterThan(0);
      expect(result.execution.taskPackId).toBe(taskPackArtifact?.id);
      expect(result.execution.summary).toContain("装配组件");
      expect(result.execution.summary).toContain("模型偏好：Claude Code");
      expect(result.execution.summary).toContain("思考预算：高");
      expect(run?.title).toContain("研发执行");
      expect(run?.title).toContain("邮箱登录组件");
      expect(run?.taskPackId).toBe(taskPackArtifact?.id);
      expect(run?.linkedComponentIds).toEqual(["component-auth-email"]);
      expect(workflow?.currentStage).toBe("开发执行");
      expect(workflow?.state).toBe("current");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("blocks execution start when the task pack still needs component assembly", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "支付修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "支付修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string; summary?: string; followUpTaskIds?: string[] };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const assemblyTask = snapshot.tasks.find((item) => item.id === `task-${created.project.id}-component-assembly`);
      const run = snapshot.runs.find((item) => item.projectId === created.project.id && item.title.includes("研发执行"));

      expect(result.execution.status).toBe("blocked");
      expect(result.execution.summary).toContain("组件装配");
      expect(result.execution.followUpTaskIds).toContain(`task-${created.project.id}-component-assembly`);
      expect(workflow?.currentStage).toBe("开发执行");
      expect(workflow?.state).toBe("blocked");
      expect(workflow?.blockers.join(" / ")).toContain("待装配组件");
      expect(assemblyTask?.ownerAgentId).toBe("agent-architect");
      expect(assemblyTask?.status).toBe("todo");
      expect(run).toBeUndefined();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("assigns execution and gate ownership to the project's selected ai team", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-pm",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-pm"
      );

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );
      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );
      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const patchArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "patch"
      );
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const demoReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === demoArtifact?.id && item.reviewerAgentId === "agent-qa-automation"
      );
      const escalationTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-gate-escalation`
      );
      const remediationTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-gate-remediation`
      );
      const qaTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find((item) =>
        item.title.includes("Playwright")
      );

      expect(patchArtifact?.ownerAgentId).toBe("agent-engineer");
      expect(demoArtifact?.ownerAgentId).toBe("agent-engineer");
      expect(demoReview?.reviewerAgentId).toBe("agent-qa-automation");
      expect(qaTask?.ownerAgentId).toBe("agent-qa-automation");
      expect(escalationTask?.ownerAgentId).toBe("agent-service-strategy");
      expect(remediationTask?.ownerAgentId).toBe("agent-engineer");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("links review run to reviewer runner and qa handoff", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string };
        artifact: { type: string; status: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const reviewArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-report"
      );
      const patchArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "patch"
      );
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const patchReview = snapshot.artifactReviews.find((item) => item.artifactId === patchArtifact?.id);
      const run = snapshot.runs.find(
        (item) => item.projectId === created.project.id && item.title.includes("规则审查")
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);
      const qaTask = listTasksForAI({ projectId: created.project.id }, dbPath).items.find((item) =>
        item.title.includes("Playwright")
      );

      expect(result.execution.status).toBe("done");
      expect(result.artifact.type).toBe("review-report");
      expect(reviewArtifact?.status).toBe("ready");
      expect(patchArtifact?.status).toBe("ready");
      expect(demoArtifact?.status).toBe("ready");
      expect(patchReview?.decision).toBe("pass");
      expect(patchReview?.reviewerAgentId).toBe("agent-architect");
      expect(run?.executor).toContain("评审");
      expect(workflow?.currentStage).toBe("测试验证");
      expect(workflow?.state).toBe("current");
      expect(qaTask?.ownerAgentId).toBe("agent-qa-automation");
      expect(qaTask?.status).toBe("in-progress");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("links archive capture to a knowledge card artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "release-brief",
          title: "售后修复总台 交付说明",
          ownerAgentId: "agent-release",
          status: "ready"
        },
        dbPath
      );

      upsertRunForAI(
        {
          id: `run-${created.project.id}-archive-runtime`,
          projectId: created.project.id,
          title: "归档阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "codex-ready",
          outputChecks: [{ name: "codex", status: "pass" }]
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-archive-capture",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const knowledgeCard = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "knowledge-card"
      );
      const releaseAudit = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-audit"
      );
      const releaseAuditReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === releaseAudit?.id
      );
      const archiveRun = snapshot.runs.find(
        (item) => item.projectId === created.project.id && item.title.includes("归档沉淀")
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.execution.status).toBe("done");
      expect(knowledgeCard?.status).toBe("ready");
      expect(releaseAudit?.status).toBe("ready");
      expect(releaseAudit?.title).toContain("归档审计");
      expect(releaseAuditReview?.summary).toContain("Runtime:codex-ready");
      expect(archiveRun?.executor).toBe("交付编排执行器");
      expect(archiveRun?.state).toBe("done");
      expect(workflow?.currentStage).toBe("归档复用");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates the demo review decision when gate command blocks", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const playwrightRunArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "playwright-run"
      );
      const demoReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === demoArtifact?.id && item.reviewerAgentId === "agent-qa-automation"
      );
      const gateRun = snapshot.runs.find(
        (item) => item.projectId === created.project.id && item.title.includes("测试门禁")
      );
      const escalationTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-gate-escalation`
      );
      const remediationTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-gate-remediation`
      );

      expect(demoReview?.decision).toBe("changes-requested");
      expect(demoReview?.summary).toContain("门禁");
      expect(demoReview?.conditions.length).toBeGreaterThan(0);
      expect(playwrightRunArtifact?.status).toBe("in-review");
      expect(playwrightRunArtifact?.title).toContain("Playwright");
      expect(gateRun?.executor).toBe("浏览器验证执行器");
      expect(gateRun?.state).toBe("blocked");
      expect(escalationTask?.ownerAgentId).toBe("agent-service-strategy");
      expect(escalationTask?.status).toBe("todo");
      expect(escalationTask?.summary).toContain("门禁");
      expect(remediationTask?.ownerAgentId).toBe("agent-engineer");
      expect(remediationTask?.stage).toBe("开发执行");
      expect(remediationTask?.status).toBe("todo");
      expect(remediationTask?.summary).toContain("修复");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("carries runtime readiness notes into gate execution summary", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id,
          extraNotes:
            "Runtime:playwright-ready | 已检测到 Playwright，可继续执行浏览器门禁。 | checks:playwright=pass[Version 1.55.0]"
        },
        dbPath
      );

      expect(result.execution.summary).toContain("Runtime:playwright-ready");
      expect(result.execution.summary).toContain("playwright=pass");
      expect(result.execution.summary).toContain("Version 1.55.0");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("moves a passing gate command into release handoff", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      const result = executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const releaseBrief = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      const releaseTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-release-brief`
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.execution.status).toBe("done");
      expect(releaseBrief?.status).toBe("draft");
      expect(releaseTask?.status).toBe("todo");
      expect(workflow?.currentStage).toBe("交付发布");
      expect(workflow?.state).toBe("current");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates pending human approval when release prepare completes", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      );

      upsertRunForAI(
        {
          id: `run-${created.project.id}-release-runtime`,
          projectId: created.project.id,
          title: "交付阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "playwright-ready",
          outputChecks: [{ name: "playwright", status: "pass" }]
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-release-prepare",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const releaseBrief = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      const reviewDecision = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-decision"
      );
      const releaseRun = snapshot.runs.find(
        (item) => item.projectId === created.project.id && item.title.includes("交付说明整理")
      );
      const approvalTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-release-approval`
      );
      const releaseReview = snapshot.artifactReviews.find(
        (item) =>
          item.artifactId === releaseBrief?.id &&
          item.reviewerAgentId === "agent-service-strategy"
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.execution.status).toBe("done");
      expect(releaseBrief?.status).toBe("in-review");
      expect(reviewDecision?.status).toBe("in-review");
      expect(reviewDecision?.title).toContain("放行评审");
      expect(releaseRun?.executor).toBe("交付编排执行器");
      expect(releaseRun?.state).toBe("done");
      expect(approvalTask?.status).toBe("todo");
      expect(releaseReview?.decision).toBe("pending");
      expect(releaseReview?.summary).toContain("Runtime:playwright-ready");
      expect(workflow?.currentStage).toBe("交付发布");
      expect(workflow?.state).toBe("blocked");
      expect(workflow?.blockers.join(" / ")).toContain("人工确认");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("assigns release and archive ownership to the project's selected ai team", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      overrideCanonicalTeamTemplateAgents(
        dbPath,
        "team-standard-delivery",
        [
          "agent-pm",
          "agent-architect",
          "agent-design",
          "agent-engineer",
          "agent-qa",
          "agent-release",
          "agent-knowledge"
        ],
        "agent-pm"
      );

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service",
          teamTemplateId: "team-standard-delivery"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );
      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      );
      executeCommandForAI(
        {
          commandId: "command-release-prepare",
          projectId: created.project.id
        },
        dbPath
      );

      const releaseBrief = loadDashboardSnapshot(dbPath).artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      if (!releaseBrief) {
        throw new Error("expected release brief artifact");
      }

      const releaseDb = new Database(dbPath);
      releaseDb.prepare(`
        UPDATE artifact_reviews
        SET decision = 'pass'
        WHERE artifact_id = ?
      `).run(releaseBrief.id);
      releaseDb.prepare(`
        UPDATE artifacts
        SET status = 'ready'
        WHERE id = ?
      `).run(releaseBrief.id);
      releaseDb.close();

      executeCommandForAI(
        {
          commandId: "command-archive-capture",
          projectId: created.project.id
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const reviewDecision = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-decision"
      );
      const approvalTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-release-approval`
      );
      const releaseReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === releaseBrief.id
      );
      const knowledgeCard = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "knowledge-card"
      );
      const releaseAudit = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-audit"
      );
      const releaseAuditReview = snapshot.artifactReviews.find(
        (item) => item.artifactId === releaseAudit?.id
      );

      expect(reviewDecision?.ownerAgentId).toBe("agent-service-strategy");
      expect(approvalTask?.ownerAgentId).toBe("agent-service-strategy");
      expect(releaseReview?.reviewerAgentId).toBe("agent-service-strategy");
      expect(knowledgeCard?.ownerAgentId).toBe("agent-knowledge-ops");
      expect(releaseAudit?.ownerAgentId).toBe("agent-release");
      expect(releaseAuditReview?.reviewerAgentId).toBe("agent-service-strategy");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  }, 10000);

  it("approves release and advances the project to archive stage", { timeout: 10000 }, () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const created = createProjectForAI(
        {
          name: "售后修复总台",
          sector: "智能客服 / 售后",
          owner: "Iris",
          templateId: "template-smart-service"
        },
        dbPath
      );

      upsertProjectArtifact(
        {
          projectId: created.project.id,
          type: "task-pack",
          title: "售后修复总台 首轮 TaskPack",
          ownerAgentId: "agent-architect",
          status: "ready"
        },
        dbPath
      );
      upsertProjectComponentLink(
        {
          projectId: created.project.id,
          componentId: "component-auth-email",
          reason: "研发执行前先装入账号与登录组件。",
          usageGuide: "先接邮箱登录，再补异常兜底。"
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-execution-start",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-review-run",
          projectId: created.project.id
        },
        dbPath
      );

      const db = new Database(dbPath);
      db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
      db.close();

      executeCommandForAI(
        {
          commandId: "command-gate-run",
          projectId: created.project.id
        },
        dbPath
      );

      executeCommandForAI(
        {
          commandId: "command-release-prepare",
          projectId: created.project.id
        },
        dbPath
      );

      upsertRunForAI(
        {
          id: `run-${created.project.id}-approval-runtime`,
          projectId: created.project.id,
          title: "放行阶段 Runtime 审计",
          executor: "交付编排执行器",
          cost: "$0.00",
          state: "done",
          outputMode: "review-ready",
          outputChecks: [{ name: "git", status: "pass" }]
        },
        dbPath
      );

      const result = executeCommandForAI(
        {
          commandId: "command-release-approve",
          projectId: created.project.id
        },
        dbPath
      ) as {
        execution: { status: string };
      };

      const snapshot = loadDashboardSnapshot(dbPath);
      const releaseBrief = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "release-brief"
      );
      const reviewDecision = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "review-decision"
      );
      const patchArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "patch"
      );
      const demoArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "demo-build"
      );
      const testReportArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "test-report"
      );
      const playwrightRunArtifact = snapshot.artifacts.find(
        (item) => item.projectId === created.project.id && item.type === "playwright-run"
      );
      const approvalTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-release-approval`
      );
      const knowledgeTask = snapshot.tasks.find(
        (item) => item.id === `task-${created.project.id}-knowledge-card`
      );
      const releaseReview = snapshot.artifactReviews.find(
        (item) =>
          item.artifactId === releaseBrief?.id &&
          item.reviewerAgentId === "agent-service-strategy"
      );
      const workflow = snapshot.workflowStates.find((item) => item.projectId === created.project.id);

      expect(result.execution.status).toBe("done");
      expect(releaseBrief?.status).toBe("ready");
      expect(reviewDecision?.status).toBe("ready");
      expect(reviewDecision?.title).toContain("放行评审");
      expect(approvalTask?.status).toBe("done");
      expect(knowledgeTask?.status).toBe("todo");
      expect(releaseReview?.decision).toBe("pass");
      expect(releaseReview?.summary).toContain("Runtime:review-ready");
      expect(workflow?.currentStage).toBe("归档复用");
      expect(workflow?.state).toBe("current");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("surfaces blocking escalation actions when release approval is attempted too early", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = executeCommandForAI(
        {
          commandId: "command-release-approve",
          projectId: "retail-support"
        },
        dbPath
      ) as {
        execution: { status: string; summary: string };
        decisions: Array<{ outcome: string; summary: string }>;
      };

      expect(result.execution.status).toBe("blocked");
      expect(result.execution.summary).toContain("自动升级动作");
      expect(result.execution.summary).toContain("先补齐");
      expect(result.decisions[0]?.outcome).toBe("block");

      const snapshot = loadDashboardSnapshot(dbPath);
      const escalationTask = snapshot.tasks.find(
        (item) => item.id === "task-retail-support-release-escalation"
      );

      expect(escalationTask?.status).toBe("todo");
      expect(escalationTask?.stage).toBe("交付发布");
      expect(escalationTask?.summary).toContain("自动升级动作");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates a runner heartbeat for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = updateRunnerHeartbeatForAI(
        {
          runnerId: "runner-local-main",
          status: "busy",
          currentRunId: "run-1",
          lastHeartbeat: "刚刚"
        },
        dbPath
      );

      expect(result.runner.id).toBe("runner-local-main");
      expect(result.runner.status).toBe("busy");
      expect(result.runner.currentRunId).toBe("run-1");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("probes runner capabilities and refreshes the runner heartbeat for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");
    const workspacePath = join(directory, "workspaces", "retail-support");

    try {
      ensureForgeDatabase(dbPath);
      mkdirSync(workspacePath, { recursive: true });

      const db = new Database(dbPath);
      db.prepare(`
        UPDATE runners
        SET workspace_path = ?, capabilities_json = ?
        WHERE id = ?
      `).run(workspacePath, JSON.stringify(["Git", "文件写入"]), "runner-local-main");
      db.close();

      const result = probeRunnersForAI({ runnerId: "runner-local-main" }, dbPath);

      expect(result.probedCount).toBe(1);
      expect(result.items[0]?.runner.id).toBe("runner-local-main");
      expect(result.items[0]?.probeStatus).toBe("healthy");
      expect(result.items[0]?.detectedCapabilities).toEqual(
        expect.arrayContaining(["Git", "文件写入"])
      );
      expect(result.items[0]?.detectedCapabilityDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ capability: "Git", status: "pass" })
        ])
      );
      expect(result.items[0]?.detectedCapabilityDetails?.find((item) => item.capability === "Git")?.path).toBeTruthy();
      expect(result.items[0]?.probeSummary).toContain("探测完成");
      expect(result.items[0]?.runner.lastProbeAt).toBeTruthy();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("upserts a run result for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = upsertRunForAI(
        {
          id: "run-retail-patch",
          projectId: "retail-support",
          title: "生成退款失败补丁",
          executor: "Codex",
          cost: "$1.02",
          state: "done",
          outputMode: "codex-ready",
          outputChecks: [{ name: "codex", status: "pass", summary: "codex 0.42.0" }],
          failureCategory: null,
          failureSummary: ""
        },
        dbPath
      );

      expect(result.run.id).toBe("run-retail-patch");
      expect(result.run.state).toBe("done");
      expect(result.run.cost).toBe("$1.02");
      expect(result.run.outputMode).toBe("codex-ready");
      expect(result.run.outputChecks).toEqual([
        { name: "codex", status: "pass", summary: "codex 0.42.0" }
      ]);
      expect(result.event.type).toBe("status");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns run timeline and latest failure attribution for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      upsertRunForAI(
        {
          id: "run-retail-playwright-blocked",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-payment-checkout"],
          title: "回归退款失败主流程",
          executor: "Playwright",
          cost: "$0.41",
          state: "blocked",
          outputMode: "playwright-ready",
          outputChecks: [{ name: "playwright", status: "pass" }],
          failureCategory: "test-failure",
          failureSummary: "登录态失效，主流程在支付确认页超时。"
        },
        dbPath
      );
      upsertRunForAI(
        {
          id: "run-retail-playwright-executed",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-payment-checkout"],
          title: "执行退款失败主流程回归",
          executor: "Playwright",
          cost: "$0.56",
          state: "done",
          outputChecks: [
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · node -e process.stdout.write('qa')"
            }
          ]
        },
        dbPath
      );
      upsertRunForAI(
        {
          id: "run-retail-review-provider-executed",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-payment-checkout"],
          title: "执行外部规则审查",
          executor: "Reviewer",
          cost: "$0.33",
          state: "done",
          outputMode: "review-executed",
          outputChecks: [
            {
              name: "model-execution",
              status: "pass",
              summary: "Claude Code Review · claude 2.1.34 · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
            },
            {
              name: "evidence",
              status: "executed",
              summary: "已执行 · claude review --project retail-support"
            }
          ]
        },
        dbPath
      );

      const result = getRunTimelineForAI({ projectId: "retail-support" }, dbPath);

      expect(result.totalRuns).toBeGreaterThan(0);
      expect(result.totalEvents).toBeGreaterThan(0);
      expect(result.latestFailure?.failureCategory).toBe("test-failure");
      expect(result.items.some((item) => item.outputMode === "playwright-ready")).toBe(true);
      const runtimeItem = result.items.find((item) => item.id === "run-retail-playwright-blocked");
      expect(runtimeItem?.taskPackId).toBe("artifact-taskpack-retail");
      expect(runtimeItem?.taskPackLabel).toBe("支付失败修复任务包");
      expect(runtimeItem?.linkedComponentIds).toEqual(["component-payment-checkout"]);
      expect(runtimeItem?.linkedComponentLabels).toContain("支付结算组件");
      expect(runtimeItem?.evidenceStatus).toBe("tool-ready");
      expect(runtimeItem?.evidenceLabel).toBe("工具就绪");
      const executedItem = result.items.find((item) => item.id === "run-retail-playwright-executed");
      expect(executedItem?.evidenceStatus).toBe("executed");
      expect(executedItem?.evidenceLabel).toBe("已执行");
      const reviewerItem = result.items.find((item) => item.id === "run-retail-review-provider-executed");
      expect(reviewerItem?.modelExecutionProvider).toBe("Claude Code Review");
      expect(reviewerItem?.modelExecutionDetail).toBe(
        "Claude Code Review · claude 2.1.34 · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns command center and hook policy baseline for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      vi.stubEnv(
        "FORGE_ENGINEER_EXEC_COMMAND",
        'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
      vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
      vi.stubEnv(
        "FORGE_REVIEW_EXEC_COMMAND",
        'claude review --project "{projectId}" --taskpack "{taskPackId}"'
      );
      vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
      vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");

      const result = getCommandCenterForAI(dbPath);

      expect(result.totalCommands).toBeGreaterThan(0);
      expect(result.commands.some((command) => command.name === "生成 PRD")).toBe(true);
      expect(result.commandContracts).toHaveLength(8);
      expect(result.commandContracts.some((contract) => contract.type === "component.assemble")).toBe(true);
      expect(result.commandContracts.some((contract) => contract.type === "review.run")).toBe(true);
      expect(result.runtimeAdapters.some((adapter) => adapter.commandType === "review.run")).toBe(true);
      expect(result.executionBackends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "engineer-execution-backend",
            runnerProfile: "engineer-runner",
            supportedCommandTypes: ["execution.start"],
            expectedArtifacts: ["patch", "demo-build"]
          })
        ])
      );
      expect(result.currentHandoff).toEqual(
        expect.objectContaining({
          stage: expect.any(String),
          source: expect.any(String),
          nextAction: expect.any(String)
        })
      );
      expect(Array.isArray(result.pendingApprovals)).toBe(true);
      expect(Array.isArray(result.escalationItems)).toBe(true);
      expect(result.hooks.some((hook) => hook.name === "beforeRun")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates an agent profile for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = updateAgentProfileForAI(
        {
          agentId: "agent-engineer",
          name: "研发执行 Agent",
          role: "qa",
          runnerId: "runner-reviewer",
          departmentLabel: "技术研发",
          persona: "你是研发 Agent，优先补齐任务包与组件装配。",
          policyId: "policy-engineering-strict",
          permissionProfileId: "perm-review",
          promptTemplateId: "prompt-prd-rag",
          skillIds: ["skill-code", "skill-playwright"],
          systemPrompt: "你是研发 Agent，只允许基于 TaskPack 做最小实现。",
          ownerMode: "review-required",
          knowledgeSources: ["工程规范", "数据库迁移案例"]
        },
        dbPath
      );

      expect(result.agent.id).toBe("agent-engineer");
      expect(result.agent.name).toBe("研发执行 Agent");
      expect(result.agent.role).toBe("qa");
      expect(result.agent.runnerId).toBe("runner-reviewer");
      expect(result.agent.departmentLabel).toBe("技术研发");
      expect(result.agent.persona).toContain("任务包");
      expect(result.agent.policyId).toBe("policy-engineering-strict");
      expect(result.agent.permissionProfileId).toBe("perm-review");
      expect(result.agent.promptTemplateId).toBe("prompt-prd-rag");
      expect(result.agent.skillIds).toEqual(["skill-code", "skill-playwright"]);
      expect(result.agent.ownerMode).toBe("review-required");
      expect(result.agent.knowledgeSources).toContain("数据库迁移案例");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("rejects malformed knowledge source lists for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      expect(() =>
        updateAgentProfileForAI(
          {
            agentId: "agent-engineer",
            name: "研发执行 Agent",
            role: "qa",
            runnerId: "runner-reviewer",
            departmentLabel: "技术研发",
            promptTemplateId: "prompt-prd-rag",
            systemPrompt: "你是研发 Agent，只允许基于 TaskPack 做最小实现。",
            knowledgeSources: "工程规范" as unknown as string[]
          },
          dbPath
        )
      ).toThrowError(ForgeApiError);
      expect(() =>
        updateAgentProfileForAI(
          {
            agentId: "agent-engineer",
            name: "研发执行 Agent",
            role: "qa",
            runnerId: "runner-reviewer",
            departmentLabel: "技术研发",
            promptTemplateId: "prompt-prd-rag",
            systemPrompt: "你是研发 Agent，只允许基于 TaskPack 做最小实现。",
            knowledgeSources: "工程规范" as unknown as string[]
          },
          dbPath
        )
      ).toThrowError("知识来源必须是字符串数组");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates workflow state for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = updateProjectWorkflowStateForAI(
        {
          projectId: "retail-support",
          currentStage: "开发执行",
          state: "blocked",
          blockers: ["等待研发补丁重新提交"],
          updatedBy: "pm"
        },
        dbPath
      );

      expect(result.workflow.projectId).toBe("retail-support");
      expect(result.workflow.currentStage).toBe("开发执行");
      expect(result.workflow.blockers).toContain("等待研发补丁重新提交");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("rejects malformed blocker lists for ai callers", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      expect(() =>
        updateProjectWorkflowStateForAI(
          {
            projectId: "retail-support",
            currentStage: "开发执行",
            state: "blocked",
            blockers: "等待研发补丁重新提交" as unknown as string[],
            updatedBy: "pm"
          },
          dbPath
        )
      ).toThrowError(ForgeApiError);
      expect(() =>
        updateProjectWorkflowStateForAI(
          {
            projectId: "retail-support",
            currentStage: "开发执行",
            state: "blocked",
            blockers: "等待研发补丁重新提交" as unknown as string[],
            updatedBy: "pm"
          },
          dbPath
        )
      ).toThrowError("阻塞项必须是字符串数组");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("lists tasks for ai callers with project filtering", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = listTasksForAI({ projectId: "retail-support" }, dbPath);

      expect(result.total).toBeGreaterThan(0);
      expect(result.items[0]?.projectId).toBe("retail-support");
      expect(result.items[0]?.priority).toBeTruthy();
      expect(result.summary.dispatchCount).toBeGreaterThan(0);
      expect(result.summary.blockedCount).toBeGreaterThan(0);
      expect(result.summary.topProject?.name).toBe("零售客服副驾驶");
      expect(result.summary.busyAgent?.name).toContain("·");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("generates a prd draft through the ai core", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = generatePrdDraftForAI(
        {
          projectId: "retail-support",
          templateId: "prompt-prd-customer-service",
          extraNotes: "强调退款失败与转人工。"
        },
        dbPath
      );

      expect(result.document.title).toContain("零售客服副驾驶");
      expect(result.document.content).toContain("转人工");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("retrieves knowledge snippets from actual project materials instead of placeholder labels", () => {
    const context = resolveWorkbenchAgentContextForAgent(
      forgeSnapshotFixture,
      "retail-support",
      "agent-dev",
      "后端研发"
    );

    expect(context).not.toBeNull();
    expect(context?.knowledgeSnippets).toHaveLength(2);
    expect(
      context?.knowledgeSnippets.every(
        (snippet) => !snippet.summary.includes("当前节点可优先参考")
      )
    ).toBe(true);
    expect(
      context?.knowledgeSnippets.some(
        (snippet) =>
          snippet.summary.includes("退款失败流程") ||
          snippet.summary.includes("零售客服副驾驶")
      )
    ).toBe(true);
  });

  it("retrieves knowledge snippets from workspace knowledge files when available", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const snapshot = loadDashboardSnapshot(dbPath);
      const workspaceRoot = snapshot.projectProfiles.find(
        (profile) => profile.projectId === "retail-support"
      )?.workspacePath;

      expect(workspaceRoot).toBeTruthy();

      const knowledgeRoot = join(String(workspaceRoot), "knowledge");
      mkdirSync(knowledgeRoot, { recursive: true });
      writeFileSync(
        join(knowledgeRoot, "数据库集成手册.md"),
        [
          "# 数据库集成手册",
          "",
          "支付失败订单需要优先核对 payment_attempts 表和退款补偿流水。",
          "发生回退时，必须同步检查订单快照与支付回调日志是否一致。"
        ].join("\n"),
        "utf8"
      );

      const refreshedSnapshot = loadDashboardSnapshot(dbPath);
      const context = resolveWorkbenchAgentContext(refreshedSnapshot, "retail-support", "后端研发");

      expect(context).not.toBeNull();
      expect(
        context?.knowledgeSnippets.some(
          (snippet) =>
            snippet.summary.includes("数据库集成手册") &&
            snippet.summary.includes("payment_attempts 表") &&
            snippet.sourceTitle === "数据库集成手册" &&
            snippet.matchReason.includes("工作区知识")
        )
      ).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("injects resolved employee skills and deliverables into workbench chat prompts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-123456",
          modelPriority: ["gpt-5.4"]
        },
        dbPath
      );
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "当前后端研发上下文已经准备好了。"
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof global.fetch;

      const result = await generateWorkbenchChatReplyForAI(
        {
          projectId: "retail-support",
          workbenchNode: "后端研发",
          prompt: "现在做到哪了？",
          selectedModel: "gpt-5.4"
        },
        dbPath
      );

      expect(result.modelExecution.status).toBe("success");
      const request = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(request?.[1]?.body)) as {
        messages: Array<{ content: string }>;
      };

      expect(body.messages[1]?.content).toContain("技能摘要");
      expect(body.messages[1]?.content).toContain("任务包代码生成");
      expect(body.messages[1]?.content).toContain("本地数据层集成");
      expect(body.messages[1]?.content).toContain("TaskPack 执行 SOP");
      expect(body.messages[1]?.content).toContain("支付失败修复任务包");
      expect(body.messages[1]?.content).toContain("支付失败流程架构说明");
      expect(body.messages[1]?.content).toContain("知识摘录");
      expect(body.messages[1]?.content).toContain("可用工具");
      expect(body.messages[1]?.content).toContain("文件写入");
      expect(body.messages[1]?.content).toContain("命令执行");
      expect(body.messages[1]?.content).toContain("工作区路径");
      expect(body.messages[1]?.content).toContain("retail-support/artifacts");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("injects resolved employee context into execution model prompts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-123456",
          modelPriority: ["gpt-5.4"]
        },
        dbPath
      );
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "已根据任务包和架构说明整理出执行建议。"
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof global.fetch;

      const result = await executeCommandWithModelForAI(
        {
          commandId: "command-execution-start",
          projectId: "retail-support",
          extraNotes: "请重点检查接口和数据落盘",
          selectedModel: "gpt-5.4",
          triggeredBy: "项目工作台"
        },
        dbPath
      );

      expect(result.modelExecution?.status).toBe("success");
      const request = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(request?.[1]?.body)) as {
        messages: Array<{ content: string }>;
      };

      expect(body.messages[0]?.content).toContain("岗位设定");
      expect(body.messages[1]?.content).toContain("当前动作：启动研发执行");
      expect(body.messages[1]?.content).toContain("技能摘要");
      expect(body.messages[1]?.content).toContain("结构化重构");
      expect(body.messages[1]?.content).toContain("知识摘录");
      expect(body.messages[1]?.content).toContain("支付失败流程架构说明");
      expect(body.messages[1]?.content).toContain("当前交付物");
      expect(body.messages[1]?.content).toContain("支付失败流程原型与交互规范");
      expect(body.messages[1]?.content).toContain("可用工具");
      expect(body.messages[1]?.content).toContain("文件写入");
      expect(body.messages[1]?.content).toContain("测试运行");
      expect(body.messages[1]?.content).toContain("工作区路径");
      expect(body.messages[1]?.content).toContain("retail-support/uploads");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("uses explicit team workbench role assignments when building execution model prompts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-123456",
          modelPriority: ["gpt-5.4"]
        },
        dbPath
      );
      const teamState = getTeamWorkbenchStateForAI(dbPath);
      updateTeamWorkbenchStateForAI(
        {
          ...teamState,
          roleAssignments: {
            ...teamState.roleAssignments,
            pm: "agent-pm"
          }
        },
        dbPath
      );
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "已按新的岗位绑定生成执行建议。"
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof global.fetch;

      await executeCommandWithModelForAI(
        {
          commandId: "command-prd-generate",
          projectId: "retail-support",
          extraNotes: "请按当前绑定员工的能力给建议",
          selectedModel: "gpt-5.4",
          triggeredBy: "项目工作台"
        },
        dbPath
      );

      const request = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(request?.[1]?.body)) as {
        messages: Array<{ content: string }>;
      };

      expect(body.messages[0]?.content).toContain("产品总监 · Elephant");
      expect(body.messages[1]?.content).toContain("PRD 结构化生成");
      expect(body.messages[1]?.content).not.toContain("任务包代码生成");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("uses explicit team workbench role assignments when building workbench chat prompts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-ai-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);
      updateModelProviderSettingsForAI(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-123456",
          modelPriority: ["gpt-5.4"]
        },
        dbPath
      );
      const teamState = getTeamWorkbenchStateForAI(dbPath);
      updateTeamWorkbenchStateForAI(
        {
          ...teamState,
          roleAssignments: {
            ...teamState.roleAssignments,
            qa: "agent-architect"
          }
        },
        dbPath
      );
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "已按新的 QA 绑定回复。"
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof global.fetch;

      await generateWorkbenchChatReplyForAI(
        {
          projectId: "retail-support",
          workbenchNode: "DEMO测试",
          prompt: "现在谁在负责？",
          selectedModel: "gpt-5.4"
        },
        dbPath
      );

      const request = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(String(request?.[1]?.body)) as {
        messages: Array<{ content: string }>;
      };

      expect(body.messages[0]?.content).toContain("技术架构师 · Eagle");
      expect(body.messages[1]?.content).toContain("架构边界拆解");
      expect(body.messages[1]?.content).not.toContain("门禁自动回归");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
