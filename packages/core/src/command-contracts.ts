import type { ForgeArtifactType, ForgeCommandType, ForgeWorkflowStage } from "./types";

export type ForgeRunnerProfile =
  | "pm-orchestrator"
  | "architect-runner"
  | "engineer-runner"
  | "reviewer-runner"
  | "qa-runner"
  | "release-runner"
  | "knowledge-runner";

export type ForgeCommandContract = {
  type: ForgeCommandType;
  runnerProfile: ForgeRunnerProfile;
  triggerStage: ForgeWorkflowStage;
  inputArtifacts: ForgeArtifactType[];
  outputArtifacts: ForgeArtifactType[];
  nextStage: ForgeWorkflowStage;
};

export const forgeCommandContracts: ForgeCommandContract[] = [
  {
    type: "prd.generate",
    runnerProfile: "pm-orchestrator",
    triggerStage: "项目接入",
    inputArtifacts: [],
    outputArtifacts: ["prd"],
    nextStage: "方案与任务包"
  },
  {
    type: "taskpack.generate",
    runnerProfile: "architect-runner",
    triggerStage: "方案与任务包",
    inputArtifacts: ["prd", "architecture-note", "ui-spec"],
    outputArtifacts: ["task-pack"],
    nextStage: "开发执行"
  },
  {
    type: "component.assemble",
    runnerProfile: "architect-runner",
    triggerStage: "开发执行",
    inputArtifacts: ["task-pack"],
    outputArtifacts: ["assembly-plan"],
    nextStage: "开发执行"
  },
  {
    type: "execution.start",
    runnerProfile: "engineer-runner",
    triggerStage: "开发执行",
    inputArtifacts: ["task-pack"],
    outputArtifacts: ["patch", "demo-build"],
    nextStage: "开发执行"
  },
  {
    type: "review.run",
    runnerProfile: "reviewer-runner",
    triggerStage: "开发执行",
    inputArtifacts: ["patch", "demo-build"],
    outputArtifacts: ["review-report"],
    nextStage: "测试验证"
  },
  {
    type: "gate.run",
    runnerProfile: "qa-runner",
    triggerStage: "测试验证",
    inputArtifacts: ["demo-build", "review-report"],
    outputArtifacts: ["test-report", "playwright-run"],
    nextStage: "交付发布"
  },
  {
    type: "release.prepare",
    runnerProfile: "release-runner",
    triggerStage: "交付发布",
    inputArtifacts: ["demo-build", "test-report"],
    outputArtifacts: ["release-brief", "review-decision"],
    nextStage: "交付发布"
  },
  {
    type: "archive.capture",
    runnerProfile: "knowledge-runner",
    triggerStage: "归档复用",
    inputArtifacts: ["release-brief", "knowledge-card"],
    outputArtifacts: ["knowledge-card", "release-audit"],
    nextStage: "归档复用"
  }
];

export function getForgeCommandContract(type: ForgeCommandType) {
  return forgeCommandContracts.find((item) => item.type === type) ?? null;
}
