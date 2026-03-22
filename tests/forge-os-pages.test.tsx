import React from "react";
import { render, screen } from "@testing-library/react";
import ForgeArtifactsPage from "../src/components/forge-artifacts-page";
import ForgeAssetsPage from "../src/components/forge-assets-page";
import ForgeExecutionPage from "../src/components/forge-execution-page";
import ForgeGovernancePage from "../src/components/forge-governance-page";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

describe("Forge operating system pages", () => {
  it("keeps artifacts page focused on artifact outputs", () => {
    render(<ForgeArtifactsPage snapshot={forgeSnapshotFixture} />);

    expect(screen.getByRole("heading", { name: /工件中心/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /工件总览/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /责任与来源/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /责任与来源/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /证据与评审/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /工件资产/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /待接棒队列/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /关键缺失工件/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /正式工件责任/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /证据时间线/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /评审结果记录/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /通过条件/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /当前工件清单/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最新 PRD 草案/i })).toBeInTheDocument();
    expect(screen.getAllByText(/退款失败主流程 TaskPack/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Runtime:/i)).toBeInTheDocument();
    expect(screen.queryByText(/快速建立项目/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/风险与阻塞/i)).not.toBeInTheDocument();

    const overviewRegion = screen.getByRole("region", { name: /工件总览/i });
    expect(overviewRegion.querySelector(".grouped-summary-cluster")).not.toBeNull();
  });

  it("shows archive provenance in the evidence timeline", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
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
        },
        {
          id: "artifact-retail-release-brief",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "零售客服副驾驶 交付说明",
          ownerAgentId: "agent-knowledge",
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
          followUpTaskIds: ["task-retail-support-knowledge-card"],
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
          followUpTaskIds: ["task-retail-support-knowledge-card"],
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
      ]
    };

    render(<ForgeArtifactsPage snapshot={snapshot} />);

    expect(screen.getByRole("heading", { name: /责任与来源/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /责任与来源/i })).toBeInTheDocument();
    expect(
      screen
        .getByRole("region", { name: /证据与评审/i })
        .querySelector(".artifact-evidence-cluster")
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: /正式工件责任/i })).toBeInTheDocument();
    expect(screen.getByText(/^正式工件沉淀$/i)).toBeInTheDocument();
    expect(screen.getByText(/^正式工件缺口$/i)).toBeInTheDocument();
    expect(screen.getByText(/^待人工确认$/i)).toBeInTheDocument();
    expect(screen.getByText(/^补齐责任$/i)).toBeInTheDocument();
    expect(screen.getByText(/^确认责任$/i)).toBeInTheDocument();
    expect(screen.getByText(/^确认后接棒$/i)).toBeInTheDocument();
    expect(screen.getByText(/^接棒细节$/i)).toBeInTheDocument();
    expect(screen.getByText(/^接棒动作$/i)).toBeInTheDocument();
    expect(screen.getByText(/已沉淀 4 项正式工件/i)).toBeInTheDocument();
    expect(screen.getByText(/当前正式工件缺口已清零。/i)).toBeInTheDocument();
    expect(screen.getAllByText(/确认交付说明与放行口径/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/确认后将继续进入归档沉淀。/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /确认交付说明与放行口径后，继续沉淀知识卡与归档审计。 · 来源命令：整理交付说明 · 来源运行：交付说明外部桥整理 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/沉淀交付知识卡与归档审计记录/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /归档接棒/i })).toBeInTheDocument();
    expect(screen.getByText(/^归档来源$/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/归档审计记录 已由 触发归档沉淀 写回正式工件面。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /当前归档沉淀接棒来源于 整理交付说明 · 交付说明外部桥整理 · OpenClaw Bridge。/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /正式来源链/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /零售客服副驾驶 交付说明.*来源命令：整理交付说明.*来源运行：交付说明外部桥整理 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /零售客服副驾驶 放行评审结论.*来源命令：整理交付说明.*来源运行：交付说明外部桥整理 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /零售客服副驾驶 归档审计记录.*来源命令：触发归档沉淀.*来源运行：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /零售客服副驾驶 交付知识卡.*来源命令：触发归档沉淀.*来源运行：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /零售客服副驾驶 归档审计记录 · 知识沉淀 Agent · 今天 20:35 · Runtime:external-shell-bridge-executed.*来源命令：触发归档沉淀 · 来源运行：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge/i
      )
    ).toBeInTheDocument();
  });

  it("shows a top-level release closure summary in the artifacts responsibility view", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
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
        },
        {
          id: "artifact-retail-release-brief",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "零售客服副驾驶 交付说明",
          ownerAgentId: "agent-knowledge",
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
          followUpTaskIds: ["task-retail-support-knowledge-card"],
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
          followUpTaskIds: ["task-retail-support-knowledge-card"],
          createdAt: "今天 20:10"
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
          taskPackId: "artifact-task-pack",
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
      ]
    };

    render(<ForgeArtifactsPage snapshot={snapshot} />);

    expect(screen.getByText(/^最终放行摘要$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^最终放行责任链$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^放行细节$/i)).toBeInTheDocument();
    expect(screen.getByText(/^放行动作$/i)).toBeInTheDocument();
    expect(screen.getByText(/^最终放行来源$/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/发布链已完成最终放行，归档沉淀已写回正式工件面。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /发布链已完成最终放行，归档沉淀已写回正式工件面。 .*归档接棒：归档审计记录 已由 触发归档沉淀 写回正式工件面。/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge · 来源命令：触发归档沉淀/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "最终放行责任链" })).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /当前归档沉淀接棒来源于 整理交付说明 · 交付说明外部桥整理 · OpenClaw Bridge。/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/沉淀交付知识卡与归档审计记录/i).length).toBeGreaterThan(0);
  });

  it("keeps execution page focused on runs and local execution context", () => {
    render(<ForgeExecutionPage snapshot={forgeSnapshotFixture} />);

    expect(screen.getByRole("heading", { name: /执行中枢/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /当前执行焦点/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /阻塞原因/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /待处理任务中枢/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /证据状态/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /整改回放/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Runner 注册表/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Runner 探测状态/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /失败归因/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最近事件流/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /执行队列/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /本地运行上下文/i })).toBeInTheDocument();
    expect(screen.getAllByText(/最近探测/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/本地主执行器/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P0/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/来源命令：发起测试门禁/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime: codex-ready/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence: tool-ready/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^模型执行器$/i)).toBeInTheDocument();
    expect(screen.getByText(/^外部模型执行器$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Claude Code · claude 2.1.34 · 来源 env:FORGE_ENGINEER_EXEC_COMMAND/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/checks: codex=pass/i)).toBeInTheDocument();
    expect(screen.getAllByText(/TaskPack：退款失败主流程 TaskPack/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/装配组件：支付结算组件/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/git version 2.39.5/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /项目负载/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Agent 负载/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/建立项目/i)).not.toBeInTheDocument();
  }, 10000);

  it("shows provider-aware unified replay guidance in the execution page", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks,
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
        }
      ],
      commands: [
        {
          id: "command-review-run",
          name: "发起规则审查",
          type: "review.run",
          summary: "由 Reviewer Runner 审查 Patch 与 Demo，生成规则审查记录并移交 QA。",
          triggerStage: "开发执行",
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
          status: "blocked",
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
        }
      ]
    } as typeof forgeSnapshotFixture;

    render(
      React.createElement(ForgeExecutionPage as any, {
        snapshot,
        remediationQueueItems: [
          {
            ...forgeSnapshotFixture.tasks[0],
            id: "task-retail-review-remediation",
            title: "复跑规则审查并确认补丁口径",
            priority: "P2",
            remediationOwnerLabel: "研发 Agent",
            remediationSummary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。",
            remediationAction: "由 研发 Agent 补齐 规则审查记录 · 模型执行器：Claude Code Review · 执行后端：OpenClaw",
            runtimeExecutionBackendLabel: "OpenClaw",
            bridgeHandoffStatus: "qa-handoff" as const,
            bridgeHandoffSummary: "外部执行桥已产出规则审查记录，并已移交 QA 门禁。",
            bridgeHandoffDetail: "等待 QA 执行 Playwright 门禁、浏览器回归和人工复核。",
            runtimeExecutionBackendCommandPreview:
              'openclaw run-review --project "retail-support" --taskpack "artifact-task-pack" --artifact "patch" --provider "Claude Code Review"',
            unifiedRetryRunnerCommand:
              "npm run runner:forge -- --remediation-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack",
            retryRunnerCommand:
              "npm run runner:forge -- --task-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack",
            unifiedRetryApiPath: "/api/forge/remediations/retry"
          }
        ]
      })
    );

    expect(
      screen.getAllByText(
        /由 研发 Agent 补齐 规则审查记录 · 模型执行器：Claude Code Review/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/执行后端：OpenClaw/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/桥接移交：外部执行桥已产出规则审查记录，并已移交 QA 门禁。/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/移交细节：等待 QA 执行 Playwright 门禁、浏览器回归和人工复核。/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /后端命令预览：openclaw run-review --project "retail-support" --taskpack "artifact-task-pack" --artifact "patch" --provider "Claude Code Review"/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /统一回放：npm run runner:forge -- --remediation-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack/i
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows external execution readiness in the execution page local context", { timeout: 10000 }, () => {
    render(
      <ForgeExecutionPage
        snapshot={forgeSnapshotFixture}
        externalExecutionSummary="已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。"
        externalExecutionDetails={[
          "研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ]}
        executionBackendSummary="当前外部执行后端为 OpenClaw，后续执行与整改可继续沿该后端推进。"
        executionBackendDetails={[
          "研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ]}
        bridgeExecutionSummary="已写回 1 条外部执行桥证据，最近一条已进入正式运行时间线。"
        bridgeExecutionDetails={["OpenClaw Bridge · external-shell-bridge-executed · bridge-ok"]}
        externalExecutionRecommendation="已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。"
      />
    );

    expect(screen.getByText(/^外部执行准备度$/i)).toBeInTheDocument();
    expect(screen.getByText(/^外部执行建议$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Provider 契约$/i)).toBeInTheDocument();
    expect(screen.getByText(/^执行后端$/i)).toBeInTheDocument();
    expect(screen.getByText(/^后端契约$/i)).toBeInTheDocument();
    expect(screen.getByText(/^桥接证据$/i)).toBeInTheDocument();
    expect(screen.getByText(/^桥接明细$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/当前外部执行后端为 OpenClaw，后续执行与整改可继续沿该后端推进。/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND \/ 规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND \/ 规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/已写回 1 条外部执行桥证据，最近一条已进入正式运行时间线。/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/OpenClaw Bridge · external-shell-bridge-executed · bridge-ok/i)
    ).toBeInTheDocument();
  });

  it("shows bridge handoff status in the execution page local context", () => {
    const snapshot = {
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

    render(<ForgeExecutionPage snapshot={snapshot} />);

    expect(screen.getByText(/^桥接移交$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/已移交 QA 门禁/i).length).toBeGreaterThan(0);
  });

  it("keeps assets page focused on reusable capability layers", () => {
    render(<ForgeAssetsPage snapshot={forgeSnapshotFixture} />);

    expect(screen.getByRole("heading", { name: /资料列表/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /资料详情/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /知识库问答模板/i })).toBeInTheDocument();
    expect(screen.getByText(/绑定知识库、兜底问答和标准测试门禁。/i)).toBeInTheDocument();
    expect(screen.getAllByText(/项目模板库/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/项目接入 \/ 方案与任务包 \/ 产品负责人/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /当前项目推荐/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Prompt 模板库/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Skill 注册表/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /可复用资产/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/风险与阻塞/i)).not.toBeInTheDocument();
  });

  it("keeps governance page focused on rules and gates", { timeout: 10000 }, () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      tasks: [
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-support-gate-escalation",
          projectId: "retail-support",
          stage: "测试验证",
          title: "处理测试门禁阻塞",
          ownerAgentId: "agent-pm",
          status: "todo",
          priority: "P0",
          category: "handoff",
          summary: "门禁阻塞待处理：Playwright。"
        },
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "交付发布",
          title: "确认交付说明与放行口径",
          ownerAgentId: "agent-pm",
          status: "todo",
          priority: "P0",
          category: "review",
          summary: "负责人需要确认交付说明、验收范围和发布口径。"
        },
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
        }
      ],
      commands: [
        {
          id: "command-review-run",
          name: "发起规则审查",
          type: "review.run",
          summary: "由 Reviewer Runner 审查 Patch 与 Demo，生成规则审查记录并移交 QA。",
          triggerStage: "开发执行",
          requiresArtifacts: ["patch"]
        },
        ...forgeSnapshotFixture.commands
      ],
      commandExecutions: [
        {
          id: "command-execution-gate-run",
          commandId: "command-gate-run",
          projectId: "retail-support",
          status: "blocked",
          summary: "发起测试门禁时被 beforeRelease 策略阻止。",
          triggeredBy: "测试 Agent",
          createdAt: "今天 10:48",
          followUpTaskIds: ["task-retail-support-gate-escalation", "task-retail-support-gate-remediation"]
        },
        {
          id: "command-execution-review-run",
          commandId: "command-review-run",
          projectId: "retail-support",
          status: "blocked",
          summary: "规则审查要求补齐异常态说明后再移交 QA。",
          triggeredBy: "Reviewer Agent",
          createdAt: "今天 10:47",
          followUpTaskIds: ["task-retail-review-remediation"]
        }
      ],
      policyDecisions: [
        {
          id: "policy-decision-before-release",
          hookId: "hook-before-release",
          commandExecutionId: "command-execution-gate-run",
          outcome: "block",
          summary: "存在失败门禁，禁止推进交付发布。",
          createdAt: "今天 10:49"
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
        }
      ]
    } as typeof forgeSnapshotFixture & {
      commandExecutions: Array<{ summary: string }>;
      policyDecisions: Array<{ summary: string }>;
    };

    render(
      React.createElement(ForgeGovernancePage as any, {
        snapshot,
        remediationQueueItems: [
          {
            ...forgeSnapshotFixture.tasks[0],
            id: "task-retail-review-remediation",
            title: "复跑规则审查并确认补丁口径",
            evidenceAction: "证据缺口：规则审查记录",
            remediationSummary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。",
            remediationAction: "由 研发 Agent 补齐 规则审查记录 · 模型执行器：Claude Code Review · 执行后端：OpenClaw",
            runtimeExecutionBackendLabel: "OpenClaw",
            runtimeExecutionBackendCommandPreview:
              'openclaw run-review --project "retail-support" --taskpack "artifact-task-pack" --artifact "patch" --provider "Claude Code Review"',
            unifiedRetryApiPath: "/api/forge/remediations/retry",
            unifiedRetryRunnerCommand:
              "npm run runner:forge -- --remediation-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack"
          }
        ],
        recentExecutionItems: [
          {
            commandId: "command-review-run",
            status: "blocked",
            summary: "规则审查要求补齐异常态说明后再移交 QA。",
            triggeredBy: "Reviewer Agent",
            projectId: "retail-support",
            createdAt: "今天 10:47",
            taskPackLabel: "退款失败主流程 TaskPack",
            relatedRunLabel: "执行退款失败补丁规则审查",
            linkedComponentLabels: ["邮箱登录组件"],
            pendingComponentLabels: [],
            componentAssemblyAction: null,
            runtimeEvidenceSummary: "Runtime: review-ready",
            runtimeExecutionBackendLabel: "OpenClaw",
            runtimeModelProviderLabel: "Claude Code Review",
            runtimeModelExecutionDetail:
              "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND",
            followUpTasks: [
              {
                title: "复跑规则审查并确认补丁口径",
                evidenceAction: "证据缺口：规则审查记录",
                remediationSummary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。",
                remediationAction:
                  "由 研发 Agent 补齐 规则审查记录 · 模型执行器：Claude Code Review · 执行后端：OpenClaw",
                componentAssemblyAction: null,
                runtimeCapabilityDetails: [],
                runtimeExecutionBackendLabel: "OpenClaw",
                runtimeExecutionBackendCommandPreview:
                  'openclaw run-review --project "retail-support" --taskpack "artifact-task-pack" --artifact "patch" --provider "Claude Code Review"',
                runtimeModelProviderLabel: "Claude Code Review",
                runtimeModelExecutionDetail:
                  "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND",
                retryApiPath: "/api/forge/tasks/retry",
                unifiedRetryApiPath: "/api/forge/remediations/retry",
                unifiedRetryRunnerCommand:
                  "npm run runner:forge -- --remediation-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack",
                remediationOwnerLabel: "研发 Agent",
                retryCommandLabel: "发起规则审查",
                retryRunnerCommand:
                  "npm run runner:forge -- --task-id task-retail-review-remediation --project-id retail-support --taskpack-id artifact-task-pack"
              }
            ]
          }
        ]
      })
    );

    expect(screen.getByRole("heading", { name: /命令中心/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /门禁状态/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /放行判断/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /责任与升级/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /命令审计/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /治理基线/i })).toBeInTheDocument();
    expect(
      screen
        .getByRole("region", { name: /责任与升级/i })
        .querySelector(".governance-responsibility-cluster")
    ).not.toBeNull();
    expect(
      screen
        .getByRole("region", { name: /命令审计/i })
        .querySelector(".governance-audit-cluster")
    ).not.toBeNull();
    expect(
      screen
        .getByRole("region", { name: /治理基线/i })
        .querySelector(".grouped-summary-cluster")
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: /闸口判断/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /执行链信号/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /放行审批链/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /自动升级动作/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /风险与阻塞/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /待人工确认/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /升级事项/i })).toBeInTheDocument();
    expect(screen.getAllByText(/运行信号/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /最近流转记录/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /命令中心/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /最近命令执行/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /标准命令/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /策略判定/i })).toBeInTheDocument();
    expect(screen.getByText(/发起测试门禁时被 beforeRelease 策略阻止/i)).toBeInTheDocument();
    expect(screen.getAllByText(/后续任务：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TaskPack：退款失败主流程 TaskPack/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/相关运行：主流程回归验证/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/待装配组件：支付结算组件/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/存在失败门禁，禁止推进交付发布/i)).toBeInTheDocument();
    expect(screen.getAllByText(/当前没有待人工确认事项。/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/当前无需等待审批后接棒。/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/处理测试门禁阻塞/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/最新运行信号/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/最近运行证据：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/关联任务：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/整改入口：\/api\/forge\/escalations\/retry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/整改入口：\/api\/forge\/tasks\/retry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/统一整改入口：\/api\/forge\/remediations\/retry/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/统一回放：npm run runner:forge -- --remediation-id task-retail-playwright --project-id retail-support/i)
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/证据缺口：测试报告 \/ Playwright 回归记录/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/待装配组件：支付结算组件/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/先处理运行失败：登录态失效/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/模型执行器：Claude Code Review/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/执行后端：OpenClaw/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /后端命令预览：openclaw run-review --project "retail-support" --taskpack "artifact-task-pack" --artifact "patch" --provider "Claude Code Review"/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/^正式工件缺口$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^补齐责任$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/当前仍缺少 交付说明 \/ 放行评审结论 \/ 归档审计记录 \/ 知识卡。/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/playwright-ready/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Version 1.55.0/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/负责人：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/角色：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SLA：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/违约风险：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/触发条件：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/升级规则：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/下一步：/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/阻断发布：/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/责任执行器：reviewer-runner/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /策略 Hook/i })).toBeInTheDocument();
    expect(screen.getByText(/产品经理 Agent → 测试验证/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /协作规则/i })).toBeInTheDocument();
    expect(screen.queryByText(/Prompt 模板库/i)).not.toBeInTheDocument();
  });

  it("shows the default external review entry in governance summaries", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        currentHandoffExecutionBackendLabel="OpenClaw"
        currentHandoffControllerLabel="项目牧羊人 Agent"
        currentHandoffOwnerLabel="架构师 Agent"
        currentHandoffOwnerRoleLabel="架构师"
        currentHandoffExecutionBackendCommandPreview='openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      />
    );

    expect(screen.getByText(/^默认外部执行$/i)).toBeInTheDocument();
    expect(screen.getByText(/^总控角色$/i)).toBeInTheDocument();
    expect(screen.getByText(/^当前接棒负责人$/i)).toBeInTheDocument();
    expect(screen.getByText(/^执行入口预览$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^OpenClaw$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/项目牧羊人 Agent · Nano CEO 总控/i)).toBeInTheDocument();
    expect(screen.getByText(/架构师 Agent · 架构师/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"/i
      )
    ).toBeInTheDocument();
  });

  it("shows current handoff provenance in governance summaries", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        currentHandoffSourceCommandLabel="生成交付说明与放行结论"
        currentHandoffRelatedRunLabel="交付说明外部桥整理 · OpenClaw Bridge"
      />
    );

    expect(screen.getByText(/^当前接棒来源运行$/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /交付说明外部桥整理 · OpenClaw Bridge · 来源命令：生成交付说明与放行结论/i
      )
    ).toBeInTheDocument();
  });

  it("shows approval handoff guidance in governance recent executions", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      commands: [
        ...forgeSnapshotFixture.commands,
        {
          id: "command-release-prepare",
          name: "整理交付说明",
          type: "release.prepare" as const,
          summary: "基于 Demo、测试结果和验收口径生成交付说明。",
          triggerStage: "交付发布" as const,
          requiresArtifacts: ["demo-build", "test-report"]
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts,
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
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks,
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
      commandExecutions: [
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
        ...forgeSnapshotFixture.commandExecutions
      ],
      runs: [
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
        ...forgeSnapshotFixture.runs
      ]
    };

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(
      screen.getAllByText(/确认后接棒：确认后将继续进入归档沉淀。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/接棒动作：沉淀交付知识卡与归档审计记录/i).length
    ).toBeGreaterThan(0);
  });

  it("shows archive provenance in governance recent executions", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
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
      artifacts: [
        ...forgeSnapshotFixture.artifacts,
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
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "人工确认" as const,
          title: "确认交付说明与放行口径",
          ownerAgentId: "agent-pm",
          status: "done" as const,
          priority: "P0" as const,
          category: "approval" as const,
          summary: "发布链已经进入人工确认，需确认交付说明与最终放行口径。"
        },
        {
          id: "task-retail-support-knowledge-card",
          projectId: "retail-support",
          stage: "归档复用" as const,
          title: "沉淀交付知识卡与归档审计记录",
          ownerAgentId: "agent-knowledge",
          status: "done" as const,
          priority: "P1" as const,
          category: "knowledge" as const,
          summary: "归档沉淀已完成，知识卡与归档审计已写回。"
        }
      ],
      commandExecutions: [
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
          followUpTaskIds: ["task-retail-support-knowledge-card"],
          createdAt: "今天 20:35"
        },
        ...forgeSnapshotFixture.commandExecutions
      ],
      runs: [
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
          taskPackId: "artifact-task-pack",
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
        },
        ...forgeSnapshotFixture.runs
      ]
    };

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(
      screen.getAllByText(/归档接棒：归档审计记录 已由 触发归档沉淀 写回正式工件面。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/归档来源：当前归档沉淀接棒来源于 整理交付说明 · 交付说明外部桥整理 · OpenClaw Bridge。/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/最终放行摘要：发布链已完成最终放行，归档沉淀已写回正式工件面。/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/最终放行责任链：发布链已完成最终放行，归档沉淀已写回正式工件面。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /放行细节：当前归档沉淀接棒来源于 整理交付说明 · 交付说明外部桥整理 · OpenClaw Bridge。/i
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows release closure in governance recent executions", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      commands: [
        ...forgeSnapshotFixture.commands,
        {
          id: "command-release-prepare",
          name: "整理交付说明",
          type: "release.prepare" as const,
          summary: "基于 Demo、测试结果和验收口径生成交付说明。",
          triggerStage: "交付发布" as const,
          requiresArtifacts: ["demo-build", "test-report"]
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts,
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
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "人工确认" as const,
          title: "确认交付说明与放行口径",
          ownerAgentId: "agent-pm",
          status: "todo" as const,
          priority: "P0" as const,
          category: "approval" as const,
          summary: "发布链已经进入人工确认，需确认交付说明与最终放行口径。"
        }
      ],
      commandExecutions: [
        {
          id: "command-execution-retail-release-prepare",
          commandId: "command-release-prepare",
          projectId: "retail-support",
          taskPackId: "artifact-task-pack",
          relatedRunId: "run-retail-release-prepare-bridge",
          status: "done" as const,
          summary: "外部桥已完成交付说明整理，并准备进入人工确认。",
          triggeredBy: "交付编排执行器",
          followUpTaskIds: ["task-retail-support-release-approval"],
          createdAt: "今天 20:10"
        },
        ...forgeSnapshotFixture.commandExecutions
      ],
      runs: [
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
        ...forgeSnapshotFixture.runs
      ]
    };

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(
      screen.getByText(/最终放行摘要：发布链已经进入人工确认，等待最终放行口径。/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/最终放行责任链：发布链已经进入人工确认，等待最终放行口径。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /放行细节：.*确认责任：确认交付说明与放行口径.*确认后接棒：确认后将继续进入归档沉淀。/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/放行动作：确认交付说明与放行口径/i).length).toBeGreaterThan(0);
  });

  it("shows archive provenance in governance release summary", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        bridgeHandoffSummary="外部执行桥已完成归档沉淀，并已回写归档审计。"
        archiveProvenanceSummary="归档审计记录 已由 触发归档沉淀 写回正式工件面。"
        archiveProvenanceDetail="当前归档沉淀接棒来源于 生成交付说明与放行结论 · 交付说明外部桥整理 · OpenClaw Bridge。"
      />
    );

    expect(screen.getAllByText(/^归档接棒$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^归档来源$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/归档审计记录 已由 触发归档沉淀 写回正式工件面。/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /当前归档沉淀接棒来源于 生成交付说明与放行结论 · 交付说明外部桥整理 · OpenClaw Bridge。/i
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows top-level approval handoff detail in governance summaries", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        approvalHandoffSummary="确认后将继续进入归档沉淀。"
        approvalHandoffDetail="确认交付说明与放行口径后，继续沉淀知识卡与归档审计。 · 来源命令：整理交付说明 · 来源运行：交付说明外部桥整理 · OpenClaw Bridge"
        approvalHandoffNextAction="沉淀交付知识卡与归档审计记录"
      />
    );

    expect(screen.getAllByText(/^确认后接棒$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^接棒细节$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^接棒动作$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/确认后将继续进入归档沉淀。/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /确认交付说明与放行口径后，继续沉淀知识卡与归档审计。 · 来源命令：整理交付说明 · 来源运行：交付说明外部桥整理 · OpenClaw Bridge/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/沉淀交付知识卡与归档审计记录/i).length).toBeGreaterThan(0);
  });

  it("shows a top-level release closure summary in governance summaries", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        releaseClosureResponsibilitySummary="发布链已经进入人工确认，等待最终放行口径。 · 当前动作：确认交付说明与放行口径 · 来源：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge · 来源命令：触发归档沉淀"
        releaseClosureResponsibilityDetail="零售客服副驾驶 交付说明 当前处于已就绪。 · 确认责任：确认交付说明与放行口径 · 确认后接棒：确认后将继续进入归档沉淀。"
        releaseClosureResponsibilityNextAction="确认交付说明与放行口径"
        releaseClosureResponsibilitySourceLabel="零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge · 来源命令：触发归档沉淀"
      />
    );

    expect(screen.getAllByText(/^最终放行摘要$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^最终放行责任链$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^放行细节$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^放行动作$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/发布链已经进入人工确认，等待最终放行口径。/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /发布链已经进入人工确认，等待最终放行口径。 · 当前动作：确认交付说明与放行口径 · 来源：零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge · 来源命令：触发归档沉淀/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /零售客服副驾驶 交付说明 当前处于已就绪。 · 确认责任：确认交付说明与放行口径 · 确认后接棒：确认后将继续进入归档沉淀。/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/^最终放行来源$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/零售客服副驾驶 外部桥归档沉淀 · OpenClaw Bridge · 来源命令：触发归档沉淀/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/^确认交付说明与放行口径$/i).length).toBeGreaterThan(0);
  });

  it("prefers structured release closure responsibility summary in governance summaries", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        releaseClosureSummary="旧版最终放行摘要，不应继续作为治理页第一口径。"
        releaseClosureResponsibilitySummary="责任链最终放行摘要，应优先显示。"
        releaseClosureResponsibilityDetail="责任链放行细节。"
      />
    );

    expect(screen.getAllByText("责任链最终放行摘要，应优先显示。").length).toBeGreaterThan(0);
    expect(screen.queryByText("旧版最终放行摘要，不应继续作为治理页第一口径。")).not.toBeInTheDocument();
  });

  it("shows release closure as a dedicated summary group in governance", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        releaseClosureResponsibilitySummary="责任链最终放行摘要，应优先显示。"
        releaseClosureResponsibilityDetail="责任链放行细节。"
        releaseClosureResponsibilityNextAction="确认交付说明与放行口径"
      />
    );

    expect(screen.getByRole("heading", { name: "最终放行责任链" })).toBeInTheDocument();
  });

  it("shows the default external review entry in execution context", () => {
    render(
      <ForgeExecutionPage
        snapshot={forgeSnapshotFixture}
        currentHandoffExecutionBackendLabel="OpenClaw"
        currentHandoffControllerLabel="项目牧羊人 Agent"
        currentHandoffOwnerLabel="架构师 Agent"
        currentHandoffOwnerRoleLabel="架构师"
        currentHandoffExecutionBackendCommandPreview='openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      />
    );

    expect(screen.getByText(/^默认外部执行$/i)).toBeInTheDocument();
    expect(screen.getByText(/^总控角色$/i)).toBeInTheDocument();
    expect(screen.getByText(/^当前接棒负责人$/i)).toBeInTheDocument();
    expect(screen.getByText(/^执行入口预览$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^OpenClaw$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/项目牧羊人 Agent · Nano CEO 总控/i)).toBeInTheDocument();
    expect(screen.getByText(/架构师 Agent · 架构师/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"/i
      )
    ).toBeInTheDocument();
  });

  it("shows current handoff provenance in execution context", () => {
    render(
      <ForgeExecutionPage
        snapshot={forgeSnapshotFixture}
        currentHandoffSourceCommandLabel="生成交付说明与放行结论"
        currentHandoffRelatedRunLabel="交付说明外部桥整理 · OpenClaw Bridge"
        currentHandoffRuntimeLabel="Runtime: release-ready"
      />
    );

    expect(screen.getByText(/^当前接棒来源运行$/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /交付说明外部桥整理 · OpenClaw Bridge · 来源命令：生成交付说明与放行结论 · Runtime: release-ready/i
      )
    ).toBeInTheDocument();
  });

  it("shows external execution readiness in the governance release summary", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        externalExecutionSummary="已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。"
        externalExecutionDetails={[
          "研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ]}
        externalExecutionRecommendation="已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。"
        executionBackendSummary="当前外部执行后端为 OpenClaw，后续执行与整改可继续沿该后端推进。"
        executionBackendDetails={[
          "研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ]}
        bridgeExecutionSummary="已写回 1 条外部执行桥证据，最近一条已进入正式运行时间线。"
        bridgeExecutionDetails={["OpenClaw Bridge · external-shell-bridge-executed · bridge-ok"]}
      />
    );

    expect(screen.getAllByText(/^外部执行准备度$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^外部执行建议$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Provider 契约$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^执行后端$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^后端契约$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^桥接证据$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^桥接明细$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/当前外部执行后端为 OpenClaw，后续执行与整改可继续沿该后端推进。/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND \/ 规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND \/ 规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/已写回 1 条外部执行桥证据，最近一条已进入正式运行时间线。/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/OpenClaw Bridge · external-shell-bridge-executed · bridge-ok/i).length
    ).toBeGreaterThan(0);
  });

  it("surfaces bridge handoff status in governance gate and escalation views", () => {
    const snapshot = {
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

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(screen.getAllByText(/^桥接移交$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/已移交 QA 门禁/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^当前接棒$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^审查来源运行$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/退款失败流程 外部桥规则审查 · OpenClaw Bridge · 来源命令：command-review-run/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/先由(?:测试|现实校验) Agent 补齐测试报告 \/ Playwright 回归记录。/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/桥接评审已移交 QA/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/测试 Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/测试报告/i).length).toBeGreaterThan(0);
  });

  it("surfaces review handoff as the default governance escalation path", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      workflowStates: [
        {
          projectId: "retail-support",
          currentStage: "开发执行" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 16:54",
          updatedBy: "Engineer Agent"
        }
      ],
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

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(screen.getAllByText(/^桥接移交$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/等待规则审查接棒/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^当前接棒$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/发起规则审查并补齐规则审查记录/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_, element) =>
          element?.textContent?.includes("规则审查记录") &&
          element.textContent.includes("负责人：技术架构师 · Eagle") &&
          element.textContent.includes("当前接棒：桥接研发执行已完成")
      ).length
    ).toBeGreaterThan(0);
  });

  it("surfaces release approval handoff in governance pending approvals", () => {
    const snapshot = {
      ...forgeSnapshotFixture,
      workflowStates: [
        {
          projectId: "retail-support",
          currentStage: "交付发布" as const,
          state: "current" as const,
          blockers: [],
          lastTransitionAt: "今天 12:18",
          updatedBy: "release"
        }
      ],
      artifacts: [
        ...forgeSnapshotFixture.artifacts,
        {
          id: "artifact-release-brief-retail",
          projectId: "retail-support",
          type: "release-brief" as const,
          title: "退款失败流程交付说明",
          ownerAgentId: "agent-pm",
          status: "ready" as const,
          updatedAt: "今天 12:18"
        }
      ],
      tasks: [
        ...forgeSnapshotFixture.tasks,
        {
          id: "task-retail-support-release-approval",
          projectId: "retail-support",
          stage: "交付发布" as const,
          title: "确认交付说明与最终放行",
          ownerAgentId: "agent-pm",
          status: "todo" as const,
          priority: "P1" as const,
          category: "review" as const,
          summary: "等待产品经理确认交付说明、放行口径与验收备注。"
        }
      ]
    };

    render(<ForgeGovernancePage snapshot={snapshot} />);

    expect(screen.getAllByText(/确认交付说明与最终放行/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/确认后将继续进入归档沉淀。/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        (_, element) =>
          element?.textContent?.includes("当前接棒：确认交付说明与最终放行")
      ).length
    ).toBeGreaterThan(0);
  });

  it("surfaces external execution readiness in governance risk handling", () => {
    render(
      <ForgeGovernancePage
        snapshot={forgeSnapshotFixture}
        externalExecutionSummary="已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。"
        externalExecutionDetails={[
          "研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
          "规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
        ]}
        externalExecutionRecommendation="已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。"
      />
    );

    expect(screen.getAllByText(/^外部执行准备度$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^外部执行建议$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Provider 契约$/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/已配置 2 条外部模型执行契约，当前尚未产出新的 provider 证据。/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。/i
      ).length
    ).toBeGreaterThan(0);
  });
});
