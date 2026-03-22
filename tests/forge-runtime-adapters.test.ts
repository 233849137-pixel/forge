import { describe, expect, it } from "vitest";
import {
  buildRuntimeExecutionPlan,
  createDefaultRuntimeAdapters,
  getExecutionBackendAdapterRegistry,
  selectRuntimeAdapter,
  type ForgeRuntimeAdapterContext
} from "../packages/ai/src/runtime-adapters";
import type { ForgeCommand, ForgeComponent, ForgeRunner } from "../packages/core/src";
import executionBackendContractConfigs from "../config/forge-execution-backend-contracts.json";

const runner: ForgeRunner = {
  id: "runner-local-main",
  name: "本地主执行器",
  status: "idle",
  summary: "负责本地研发执行。",
  workspacePath: "/tmp/forge/workspace",
  capabilities: ["TaskPack 执行", "规则审查", "Playwright"],
  detectedCapabilities: ["TaskPack 执行", "规则审查", "Playwright"],
  probeStatus: "healthy",
  probeSummary: "可用",
  currentRunId: null,
  lastHeartbeat: "刚刚",
  lastProbeAt: "刚刚"
};

const linkedComponents: ForgeComponent[] = [
  {
    id: "component-payment-checkout",
    title: "支付结算模块",
    category: "payment",
    summary: "处理结算与回调。",
    sourceType: "github",
    sourceRef: "github.com/example/payment",
    tags: ["支付", "退款"],
    recommendedSectors: ["零售"],
    usageGuide: "先配置回调，再接退款状态。"
  }
];

function buildContext(command: ForgeCommand): ForgeRuntimeAdapterContext {
  return {
    command,
    project: {
      id: "retail-support",
      name: "零售客服副驾驶",
      sector: "智能客服 / 零售",
      owner: "Iris",
      status: "active",
      lastRun: "刚刚",
      progress: 72,
      riskNote: "支付失败回归链路待补齐"
    },
    taskPackArtifact: {
      id: "artifact-taskpack-retail-support",
      projectId: "retail-support",
      type: "task-pack",
      title: "零售客服副驾驶 TaskPack",
      ownerAgentId: "agent-architect",
      status: "ready",
      updatedAt: "刚刚"
    },
    linkedComponents,
    runner,
    extraNotes: "需要覆盖支付异常路径"
  };
}

describe("forge runtime adapters", () => {
  it("selects dedicated adapters for execution, review and gate commands", () => {
    const adapters = createDefaultRuntimeAdapters();

    expect(selectRuntimeAdapter(adapters, "component.assemble")?.id).toBe("architect-runner");
    expect(selectRuntimeAdapter(adapters, "execution.start")?.id).toBe("engineer-runner");
    expect(selectRuntimeAdapter(adapters, "review.run")?.id).toBe("reviewer-runner");
    expect(selectRuntimeAdapter(adapters, "gate.run")?.id).toBe("qa-runner");
  });

  it("generates an architect assembly result with TaskPack and component context", () => {
    const adapters = createDefaultRuntimeAdapters();
    const result = selectRuntimeAdapter(adapters, "component.assemble")?.run(
      buildContext({
        id: "command-component-assemble",
        name: "补齐组件装配",
        type: "component.assemble",
        summary: "把推荐组件写回 TaskPack 装配段。",
        triggerStage: "开发执行",
        requiresArtifacts: ["task-pack"]
      })
    );

    expect(result?.status).toBe("done");
    expect(result?.summary).toContain("TaskPack");
    expect(result?.summary).toContain("支付结算模块");
    expect(result?.artifacts.map((artifact) => artifact.type)).toEqual(["assembly-plan"]);
  });

  it("generates an engineer execution result with patch and demo evidence", () => {
    const adapters = createDefaultRuntimeAdapters();
    const result = selectRuntimeAdapter(adapters, "execution.start")?.run(
      buildContext({
        id: "command-execution-start",
        name: "启动研发执行",
        type: "execution.start",
        summary: "把 TaskPack 交给工程执行器。",
        triggerStage: "开发执行",
        requiresArtifacts: ["task-pack"]
      })
    );

    expect(result?.status).toBe("done");
    expect(result?.summary).toContain("TaskPack");
    expect(result?.summary).toContain("支付结算模块");
    expect(result?.artifacts.map((artifact) => artifact.type)).toEqual(["patch", "demo-build"]);
  });

  it("generates a reviewer result with review evidence", () => {
    const adapters = createDefaultRuntimeAdapters();
    const result = selectRuntimeAdapter(adapters, "review.run")?.run(
      buildContext({
        id: "command-review-run",
        name: "发起规则审查",
        type: "review.run",
        summary: "把 Patch 和 Demo 交给 Reviewer。",
        triggerStage: "开发执行",
        requiresArtifacts: ["patch", "demo-build"]
      })
    );

    expect(result?.status).toBe("done");
    expect(result?.summary).toContain("规则审查");
    expect(result?.summary).toContain("TaskPack");
    expect(result?.summary).toContain("支付结算模块");
    expect(result?.artifacts.map((artifact) => artifact.type)).toEqual(["review-report"]);
  });

  it("generates a qa result with test and playwright evidence", () => {
    const adapters = createDefaultRuntimeAdapters();
    const result = selectRuntimeAdapter(adapters, "gate.run")?.run(
      buildContext({
        id: "command-gate-run",
        name: "发起测试门禁",
        type: "gate.run",
        summary: "运行 QA 门禁。",
        triggerStage: "测试验证",
        requiresArtifacts: ["demo-build", "review-report"]
      })
    );

    expect(result?.status).toBe("done");
    expect(result?.summary).toContain("Playwright");
    expect(result?.summary).toContain("TaskPack");
    expect(result?.summary).toContain("支付结算模块");
    expect(result?.artifacts.map((artifact) => artifact.type)).toEqual([
      "test-report",
      "playwright-run"
    ]);
  });

  it("builds external execution plans for engineer, reviewer and qa runners", () => {
    const adapters = createDefaultRuntimeAdapters();
    const engineerPlan = buildRuntimeExecutionPlan(
      selectRuntimeAdapter(adapters, "component.assemble")!,
      buildContext({
        id: "command-component-assemble",
        name: "补齐组件装配",
        type: "component.assemble",
        summary: "把推荐组件写回 TaskPack 装配段。",
        triggerStage: "开发执行",
        requiresArtifacts: ["task-pack"]
      })
    );
    const engineerExecutionPlan = buildRuntimeExecutionPlan(
      selectRuntimeAdapter(adapters, "execution.start")!,
      buildContext({
        id: "command-execution-start",
        name: "启动研发执行",
        type: "execution.start",
        summary: "把 TaskPack 交给工程执行器。",
        triggerStage: "开发执行",
        requiresArtifacts: ["task-pack"]
      })
    );
    const reviewerPlan = buildRuntimeExecutionPlan(
      selectRuntimeAdapter(adapters, "review.run")!,
      buildContext({
        id: "command-review-run",
        name: "发起规则审查",
        type: "review.run",
        summary: "把 Patch 和 Demo 交给 Reviewer。",
        triggerStage: "开发执行",
        requiresArtifacts: ["patch", "demo-build"]
      })
    );
    const qaPlan = buildRuntimeExecutionPlan(
      selectRuntimeAdapter(adapters, "gate.run")!,
      buildContext({
        id: "command-gate-run",
        name: "发起测试门禁",
        type: "gate.run",
        summary: "运行 QA 门禁。",
        triggerStage: "测试验证",
        requiresArtifacts: ["demo-build", "review-report"]
      })
    );

    expect(engineerPlan.mode).toBe("external-shell");
    expect(engineerPlan.command.join(" ")).toContain("forge-architect-runner.mjs");
    expect(engineerPlan.command.join(" ")).toContain("--taskpack-id artifact-taskpack-retail-support");
    expect(engineerPlan.command.join(" ")).toContain("--component-ids component-payment-checkout");
    expect(engineerPlan.command).toContain("--execute-if-ready");
    expect(engineerPlan.cwd).toContain("/tmp/forge/workspace");
    expect(engineerPlan.expectedArtifacts).toEqual(["assembly-plan"]);

    expect(engineerExecutionPlan.mode).toBe("external-shell");
    expect(engineerExecutionPlan.command.join(" ")).toContain("forge-engineer-runner.mjs");
    expect(engineerExecutionPlan.command.join(" ")).toContain("--taskpack-id artifact-taskpack-retail-support");
    expect(engineerExecutionPlan.command.join(" ")).toContain("--component-ids component-payment-checkout");
    expect(engineerExecutionPlan.command).toContain("--execute-if-ready");
    expect(engineerExecutionPlan.cwd).toContain("/tmp/forge/workspace");
    expect(engineerExecutionPlan.expectedArtifacts).toEqual(["patch", "demo-build"]);

    expect(reviewerPlan.command.join(" ")).toContain("forge-review-runner.mjs");
    expect(reviewerPlan.command.join(" ")).toContain("--taskpack-id artifact-taskpack-retail-support");
    expect(reviewerPlan.command.join(" ")).toContain("--component-ids component-payment-checkout");
    expect(reviewerPlan.command).toContain("--execute-if-ready");
    expect(reviewerPlan.expectedArtifacts).toEqual(["review-report"]);

    expect(qaPlan.command.join(" ")).toContain("forge-qa-runner.mjs");
    expect(qaPlan.command.join(" ")).toContain("--taskpack-id artifact-taskpack-retail-support");
    expect(qaPlan.command.join(" ")).toContain("--component-ids component-payment-checkout");
    expect(qaPlan.command).toContain("--execute-if-ready");
    expect(qaPlan.expectedArtifacts).toEqual(["test-report", "playwright-run"]);
  });

  it("derives execution backend capability descriptors from runtime adapters", () => {
    const descriptors = getExecutionBackendAdapterRegistry(
      executionBackendContractConfigs,
      createDefaultRuntimeAdapters()
    );

    expect(descriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pm-execution-backend",
          kind: "pm",
          runnerProfile: "pm-orchestrator",
          supportedCommandTypes: ["prd.generate"],
          expectedArtifacts: ["prd"]
        }),
        expect.objectContaining({
          id: "engineer-execution-backend",
          kind: "engineer",
          runnerProfile: "engineer-runner",
          supportedCommandTypes: ["execution.start"],
          expectedArtifacts: ["patch", "demo-build"]
        }),
        expect.objectContaining({
          id: "reviewer-execution-backend",
          kind: "reviewer",
          runnerProfile: "reviewer-runner",
          supportedCommandTypes: ["review.run"],
          expectedArtifacts: ["review-report"]
        })
      ])
    );
  });
});
