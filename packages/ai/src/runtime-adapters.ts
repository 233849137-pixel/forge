import type {
  ForgeArtifact,
  ForgeArtifactType,
  ForgeCommand,
  ForgeComponent,
  ForgeProject,
  ForgeRunner
} from "../../core/src";

export type ForgeRuntimeAdapterArtifact = {
  type: ForgeArtifactType;
  title: string;
  ownerAgentId: string;
  status: "draft" | "in-review" | "ready";
};

export type ForgeRuntimeAdapterResult = {
  status: "done" | "blocked";
  summary: string;
  artifacts: ForgeRuntimeAdapterArtifact[];
};

export type ForgeRuntimeAdapterContext = {
  command: ForgeCommand;
  project: ForgeProject;
  taskPackArtifact?: ForgeArtifact | null;
  linkedComponents?: ForgeComponent[];
  runner: ForgeRunner;
  extraNotes?: string;
};

export type ForgeRuntimeAdapter = {
  id: string;
  commandType: ForgeCommand["type"];
  runnerProfile: string;
  executionMode: "external-shell";
  commandTemplate: string[];
  expectedArtifacts: ForgeArtifactType[];
  run: (context: ForgeRuntimeAdapterContext) => ForgeRuntimeAdapterResult;
};

export type ForgeRuntimeExecutionPlan = {
  mode: "external-shell";
  cwd: string;
  command: string[];
  expectedArtifacts: ForgeArtifactType[];
};

export type ForgeExecutionBackendContractConfig = {
  id: string;
  kind: "pm" | "engineer" | "reviewer" | "qa" | "release" | "archive";
  label: string;
  runnerProfile: string;
  source: string;
  providerKey: string;
  backendKey: string;
  commandKey: string;
};

export type ForgeExecutionBackendAdapterDescriptor = ForgeExecutionBackendContractConfig & {
  adapterIds: string[];
  supportedCommandTypes: ForgeCommand["type"][];
  expectedArtifacts: ForgeArtifactType[];
};

export function createDefaultRuntimeAdapters(): ForgeRuntimeAdapter[] {
  return [
    {
      id: "pm-orchestrator",
      commandType: "prd.generate",
      runnerProfile: "pm-orchestrator",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-runner.mjs",
        "--runner-id",
        "runner-local-main",
        "--command-id",
        "command-prd-generate",
        "--project-id",
        "{projectId}",
        "--execute-plan"
      ],
      expectedArtifacts: ["prd"],
      run: ({ project, extraNotes }) => ({
        status: "done",
        summary: `已由 CEO 总控整理 ${project.name} 的需求确认与 PRD 草案${extraNotes ? `；补充说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "prd",
            title: `${project.name} PRD 草案`,
            ownerAgentId: "agent-service-strategy",
            status: "ready"
          }
        ]
      })
    },
    {
      id: "architect-runner",
      commandType: "component.assemble",
      runnerProfile: "architect-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-architect-runner.mjs",
        "--project-id",
        "{projectId}",
        "--workspace",
        "{cwd}",
        "--taskpack-id",
        "{taskPackId}",
        "--component-ids",
        "{componentIds}",
        "--execute-if-ready"
      ],
      expectedArtifacts: ["assembly-plan"],
      run: ({ project, taskPackArtifact, linkedComponents, extraNotes }) => ({
        status: "done",
        summary: `已完成 ${project.name} 的组件装配（TaskPack：${
          taskPackArtifact?.title ?? "latest"
        }）${
          linkedComponents && linkedComponents.length > 0
            ? `，已装配组件：${linkedComponents.map((component) => component.title).join(" / ")}`
            : ""
        }${extraNotes ? `；补充说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "assembly-plan",
            title: `${project.name} 组件装配清单`,
            ownerAgentId: "agent-architect",
            status: "ready"
          }
        ]
      })
    },
    {
      id: "engineer-runner",
      commandType: "execution.start",
      runnerProfile: "engineer-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-engineer-runner.mjs",
        "--project-id",
        "{projectId}",
        "--workspace",
        "{cwd}",
        "--taskpack-id",
        "{taskPackId}",
        "--component-ids",
        "{componentIds}",
        "--execute-if-ready"
      ],
      expectedArtifacts: ["patch", "demo-build"],
      run: ({ project, linkedComponents, extraNotes }) => ({
        status: "done",
        summary: `已按 TaskPack 生成补丁与 Demo${
          linkedComponents && linkedComponents.length > 0
            ? `，装配组件：${linkedComponents.map((component) => component.title).join(" / ")}`
            : ""
        }${extraNotes ? `，附加说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "patch",
            title: `${project.name} 首轮 Patch`,
            ownerAgentId: "agent-frontend",
            status: "in-review"
          },
          {
            type: "demo-build",
            title: `${project.name} Demo 构建`,
            ownerAgentId: "agent-frontend",
            status: "in-review"
          }
        ]
      })
    },
    {
      id: "reviewer-runner",
      commandType: "review.run",
      runnerProfile: "reviewer-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-review-runner.mjs",
        "--project-id",
        "{projectId}",
        "--workspace",
        "{cwd}",
        "--taskpack-id",
        "{taskPackId}",
        "--component-ids",
        "{componentIds}",
        "--artifact",
        "patch",
        "--execute-if-ready"
      ],
      expectedArtifacts: ["review-report"],
      run: ({ project, taskPackArtifact, linkedComponents, extraNotes }) => ({
        status: "done",
        summary: `已完成 ${project.name} 的规则审查（TaskPack：${
          taskPackArtifact?.title ?? "latest"
        }）${
          linkedComponents && linkedComponents.length > 0
            ? `，关联组件：${linkedComponents.map((component) => component.title).join(" / ")}`
            : ""
        }${extraNotes ? `；重点关注：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "review-report",
            title: `${project.name} 规则审查记录`,
            ownerAgentId: "agent-architect",
            status: "ready"
          }
        ]
      })
    },
    {
      id: "qa-runner",
      commandType: "gate.run",
      runnerProfile: "qa-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-qa-runner.mjs",
        "--project-id",
        "{projectId}",
        "--workspace",
        "{cwd}",
        "--taskpack-id",
        "{taskPackId}",
        "--component-ids",
        "{componentIds}",
        "--strict-playwright",
        "--execute-if-ready"
      ],
      expectedArtifacts: ["test-report", "playwright-run"],
      run: ({ project, taskPackArtifact, linkedComponents, extraNotes }) => ({
        status: "done",
        summary: `已完成 ${project.name} 的 Playwright 与人工复核（TaskPack：${
          taskPackArtifact?.title ?? "latest"
        }）${
          linkedComponents && linkedComponents.length > 0
            ? `，关联组件：${linkedComponents.map((component) => component.title).join(" / ")}`
            : ""
        }${extraNotes ? `；补充说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "test-report",
            title: `${project.name} 测试报告`,
            ownerAgentId: "agent-qa-automation",
            status: "ready"
          },
          {
            type: "playwright-run",
            title: `${project.name} Playwright 回归记录`,
            ownerAgentId: "agent-qa-automation",
            status: "ready"
          }
        ]
      })
    },
    {
      id: "release-runner",
      commandType: "release.prepare",
      runnerProfile: "release-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-runner.mjs",
        "--runner-id",
        "runner-release",
        "--command-id",
        "command-release-prepare",
        "--project-id",
        "{projectId}",
        "--taskpack-id",
        "{taskPackId}",
        "--execute-plan"
      ],
      expectedArtifacts: ["release-brief", "review-decision"],
      run: ({ project, taskPackArtifact, extraNotes }) => ({
        status: "done",
        summary: `已完成 ${project.name} 的交付说明整理（TaskPack：${
          taskPackArtifact?.title ?? "latest"
        }）${extraNotes ? `；补充说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "release-brief",
            title: `${project.name} 交付说明`,
            ownerAgentId: "agent-release",
            status: "in-review"
          },
          {
            type: "review-decision",
            title: `${project.name} 放行评审结论`,
            ownerAgentId: "agent-service-strategy",
            status: "in-review"
          }
        ]
      })
    },
    {
      id: "knowledge-runner",
      commandType: "archive.capture",
      runnerProfile: "knowledge-runner",
      executionMode: "external-shell",
      commandTemplate: [
        "node",
        "{repoRoot}/scripts/forge-runner.mjs",
        "--runner-id",
        "runner-knowledge",
        "--command-id",
        "command-archive-capture",
        "--project-id",
        "{projectId}",
        "--taskpack-id",
        "{taskPackId}",
        "--execute-plan"
      ],
      expectedArtifacts: ["knowledge-card", "release-audit"],
      run: ({ project, taskPackArtifact, extraNotes }) => ({
        status: "done",
        summary: `已完成 ${project.name} 的归档沉淀（TaskPack：${
          taskPackArtifact?.title ?? "latest"
        }）${extraNotes ? `；补充说明：${extraNotes}` : ""}。`,
        artifacts: [
          {
            type: "knowledge-card",
            title: `${project.name} 交付知识卡`,
            ownerAgentId: "agent-knowledge-ops",
            status: "ready"
          },
          {
            type: "release-audit",
            title: `${project.name} 归档审计记录`,
            ownerAgentId: "agent-release",
            status: "ready"
          }
        ]
      })
    }
  ];
}

export function selectRuntimeAdapter(
  adapters: ForgeRuntimeAdapter[],
  commandType: ForgeCommand["type"]
) {
  return adapters.find((adapter) => adapter.commandType === commandType) ?? null;
}

export function buildRuntimeExecutionPlan(
  adapter: ForgeRuntimeAdapter,
  context: ForgeRuntimeAdapterContext
): ForgeRuntimeExecutionPlan {
  const componentIds = context.linkedComponents?.map((component) => component.id).join(",") ?? "";

  return {
    mode: adapter.executionMode,
    cwd: context.runner.workspacePath,
    command: adapter.commandTemplate
      .map((part) =>
        part
          .replaceAll("{cwd}", context.runner.workspacePath)
          .replaceAll("{repoRoot}", process.cwd())
          .replaceAll("{projectId}", context.project.id)
          .replaceAll("{taskPackId}", context.taskPackArtifact?.id || "latest")
          .replaceAll("{componentIds}", componentIds)
      )
      .filter((part, index, parts) => {
        if (part !== "--component-ids") {
          return true;
        }

        return Boolean(parts[index + 1]);
      })
      .filter((part) => part !== ""),
    expectedArtifacts: adapter.expectedArtifacts
  };
}

export function getRuntimeAdapterRegistry(adapters: ForgeRuntimeAdapter[]) {
  return adapters.map((adapter) => ({
    id: adapter.id,
    commandType: adapter.commandType,
    runnerProfile: adapter.runnerProfile,
    executionMode: adapter.executionMode,
    commandTemplate: adapter.commandTemplate,
    expectedArtifacts: adapter.expectedArtifacts
  }));
}

export function getExecutionBackendAdapterRegistry(
  contracts: ForgeExecutionBackendContractConfig[],
  adapters: ForgeRuntimeAdapter[]
): ForgeExecutionBackendAdapterDescriptor[] {
  return contracts.map((contract) => {
    const matchedAdapters = adapters.filter((adapter) => adapter.runnerProfile === contract.runnerProfile);

    return {
      ...contract,
      adapterIds: matchedAdapters.map((adapter) => adapter.id),
      supportedCommandTypes: matchedAdapters.map((adapter) => adapter.commandType),
      expectedArtifacts: Array.from(
        new Set(matchedAdapters.flatMap((adapter) => adapter.expectedArtifacts))
      )
    };
  });
}
