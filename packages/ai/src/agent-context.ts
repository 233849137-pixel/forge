import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { basename, extname, join } from "node:path";

import type {
  ForgeAgent,
  ForgeArtifact,
  ForgeArtifactType,
  ForgeCommandType,
  ForgeDashboardSnapshot,
  ForgeProjectWorkbenchNode,
  ForgePrdDocument,
  ForgeResolvedAgentContext,
  ForgeResolvedAgentContextBudget,
  ForgeResolvedAgentContextDeliverable,
  ForgeResolvedAgentContextKnowledgeSnippet,
  ForgeResolvedAgentContextPathContract,
  ForgeResolvedAgentContextTool
} from "../../core/src/types";
import {
  getProjectWorkbenchAgent,
  getProjectWorkbenchNodeForCommandType,
  isProjectWorkbenchNode
} from "../../core/src";

const artifactTypeLabels: Record<ForgeArtifactType, string> = {
  prd: "PRD",
  "architecture-note": "架构说明",
  "ui-spec": "UI 规格",
  "task-pack": "TaskPack",
  "assembly-plan": "组件装配计划",
  patch: "补丁",
  "review-report": "审查记录",
  "demo-build": "Demo 构建",
  "test-report": "测试报告",
  "playwright-run": "Playwright 结果",
  "review-decision": "评审结论",
  "release-brief": "交付说明",
  "release-audit": "交付审计",
  "knowledge-card": "知识卡片"
};

const requiredDeliverableTypesByNode: Record<
  ForgeProjectWorkbenchNode,
  Array<ForgeArtifactType | "prd-document">
> = {
  需求确认: ["prd-document", "prd"],
  项目原型: ["prd-document", "architecture-note", "task-pack"],
  UI设计: ["prd-document", "ui-spec"],
  后端研发: ["prd-document", "architecture-note", "ui-spec", "task-pack"],
  DEMO测试: ["task-pack", "patch", "demo-build", "test-report", "playwright-run"],
  内测调优: ["review-report", "demo-build", "test-report", "playwright-run"],
  交付发布: ["test-report", "playwright-run", "release-brief", "review-decision"]
};

export function buildAgentContextBudget(): ForgeResolvedAgentContextBudget {
  return {
    maxSkills: 3,
    maxSops: 2,
    maxKnowledgeSnippets: 3,
    maxDeliverables: 4
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeText(value: string | null | undefined, maxLength = 120) {
  const normalized = normalizeWhitespace(value ?? "");

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

type ForgeKnowledgeCandidate = {
  key: string;
  title: string;
  text: string;
  priority: number;
};

const knowledgeDocumentExtensions = new Set([".md", ".mdx", ".txt"]);
const maxWorkspaceKnowledgeFiles = 12;
const maxWorkspaceKnowledgeBytes = 4_000;

const deliverableKnowledgePriorities: Record<
  ForgeResolvedAgentContextDeliverable["type"],
  number
> = {
  "prd-document": 118,
  prd: 116,
  "architecture-note": 126,
  "ui-spec": 120,
  "task-pack": 128,
  "assembly-plan": 96,
  patch: 114,
  "review-report": 106,
  "demo-build": 112,
  "test-report": 110,
  "playwright-run": 108,
  "review-decision": 102,
  "release-brief": 104,
  "release-audit": 98,
  "knowledge-card": 100
};

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildKnowledgeSearchTerms(label: string) {
  const normalized = normalizeWhitespace(label);

  if (!normalized) {
    return [];
  }

  const phraseTerms = normalized
    .split(/[\s/、，,：:；;·\-]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);
  const asciiTerms = normalized.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const chineseSegments = normalized
    .split("")
    .filter((char) => /[\u4e00-\u9fff]/.test(char));
  const chineseBigrams =
    chineseSegments.length >= 2
      ? Array.from({ length: chineseSegments.length - 1 }, (_, index) =>
          `${chineseSegments[index]}${chineseSegments[index + 1]}`
        )
      : [];

  return dedupeStrings([
    normalized.toLowerCase(),
    ...phraseTerms,
    ...asciiTerms.map((term) => term.toLowerCase()),
    ...chineseBigrams
  ]);
}

function pushKnowledgeCandidate(
  candidates: ForgeKnowledgeCandidate[],
  candidate: ForgeKnowledgeCandidate | null
) {
  if (!candidate) {
    return;
  }

  const normalizedText = normalizeWhitespace(candidate.text);

  if (!normalizedText) {
    return;
  }

  candidates.push({
    ...candidate,
    text: normalizedText
  });
}

function resolveProjectAssetLinkTitle(
  snapshot: ForgeDashboardSnapshot,
  linkTargetType: ForgeDashboardSnapshot["projectAssetLinks"][number]["targetType"],
  targetId: string
) {
  switch (linkTargetType) {
    case "prompt":
      return snapshot.promptTemplates.find((item) => item.id === targetId)?.title ?? targetId;
    case "asset":
      return snapshot.assets.find((item) => item.id === targetId)?.title ?? targetId;
    case "template":
      return snapshot.projectTemplates.find((item) => item.id === targetId)?.title ?? targetId;
    case "component":
      return snapshot.components.find((item) => item.id === targetId)?.title ?? targetId;
    default:
      return targetId;
  }
}

function buildWorkspaceKnowledgeCandidates(paths: ForgeResolvedAgentContextPathContract) {
  if (!existsSync(paths.knowledgeRoot)) {
    return [];
  }

  const files: string[] = [];

  const walk = (currentPath: string, depth: number) => {
    if (files.length >= maxWorkspaceKnowledgeFiles || depth > 2) {
      return;
    }

    let entries: Dirent[];

    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxWorkspaceKnowledgeFiles) {
        break;
      }

      const nextPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) {
          walk(nextPath, depth + 1);
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!knowledgeDocumentExtensions.has(extname(entry.name).toLowerCase())) {
        continue;
      }

      files.push(nextPath);
    }
  };

  walk(paths.knowledgeRoot, 0);

  return files
    .map<ForgeKnowledgeCandidate | null>((absolutePath) => {
      try {
        const raw = readFileSync(absolutePath, "utf8").slice(0, maxWorkspaceKnowledgeBytes);
        const title = basename(absolutePath, extname(absolutePath));
        const content = raw
          .replace(/^---[\s\S]*?---\s*/m, "")
          .replace(/^#{1,6}\s+/gm, "")
          .trim();

        if (!content) {
          return null;
        }

        return {
          key: `workspace-knowledge:${absolutePath}`,
          title,
          text: content,
          priority: 138
        };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is ForgeKnowledgeCandidate => Boolean(candidate));
}

function buildKnowledgeCandidates(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  node: ForgeProjectWorkbenchNode,
  agent: ForgeAgent,
  deliverables: ForgeResolvedAgentContextDeliverable[],
  paths: ForgeResolvedAgentContextPathContract
) {
  const candidates: ForgeKnowledgeCandidate[] = [];
  const project = snapshot.projects.find((item) => item.id === projectId) ?? null;
  const prdDocument = snapshot.prdDocuments.find((item) => item.projectId === projectId) ?? null;
  const promptTemplate = snapshot.promptTemplates.find(
    (item) => item.id === agent.promptTemplateId
  ) ?? null;
  const projectAssetLinks = snapshot.projectAssetLinks.filter((item) => item.projectId === projectId);
  const projectTasks = snapshot.tasks.filter((item) => item.projectId === projectId);
  const projectReviews = snapshot.artifactReviews.filter((item) =>
    snapshot.artifacts.some(
      (artifact) => artifact.id === item.artifactId && artifact.projectId === projectId
    )
  );

  for (const candidate of buildWorkspaceKnowledgeCandidates(paths)) {
    pushKnowledgeCandidate(candidates, candidate);
  }

  pushKnowledgeCandidate(candidates, project
    ? {
        key: `project:${project.id}:requirement`,
        title: `${project.name} 项目需求`,
        text: [project.requirement, project.note, project.riskNote].filter(Boolean).join(" "),
        priority: 108
      }
    : null);

  pushKnowledgeCandidate(candidates, prdDocument
    ? {
        key: `prd-document:${prdDocument.id}`,
        title: prdDocument.title,
        text: prdDocument.content,
        priority: node === "需求确认" ? 130 : 120
      }
    : null);

  pushKnowledgeCandidate(candidates, promptTemplate
    ? {
        key: `prompt-template:${promptTemplate.id}`,
        title: promptTemplate.title,
        text: [promptTemplate.summary, promptTemplate.template].filter(Boolean).join(" "),
        priority: 86
      }
    : null);

  for (const deliverable of deliverables) {
    pushKnowledgeCandidate(candidates, {
      key: `deliverable:${deliverable.id}`,
      title: deliverable.title,
      text: `${deliverable.label} ${deliverable.summary}`,
      priority: deliverableKnowledgePriorities[deliverable.type]
    });
  }

  for (const link of projectAssetLinks) {
    const title = resolveProjectAssetLinkTitle(snapshot, link.targetType, link.targetId);

    pushKnowledgeCandidate(candidates, {
      key: `project-link:${link.id}`,
      title,
      text: [link.reason, link.usageGuide].filter(Boolean).join(" "),
      priority: link.relation === "required" ? 96 : link.relation === "default" ? 90 : 82
    });
  }

  for (const task of projectTasks) {
    pushKnowledgeCandidate(candidates, {
      key: `task:${task.id}`,
      title: task.title,
      text: task.summary,
      priority: task.stage === "测试验证" ? 74 : 62
    });
  }

  for (const review of projectReviews) {
    pushKnowledgeCandidate(candidates, {
      key: `review:${review.id}`,
      title: `评审：${review.artifactId}`,
      text: [review.summary, ...review.conditions].join(" "),
      priority: 78
    });
  }

  const deduped = new Map<string, ForgeKnowledgeCandidate>();

  for (const candidate of candidates) {
    if (!deduped.has(candidate.key)) {
      deduped.set(candidate.key, candidate);
    }
  }

  return [...deduped.values()];
}

function scoreKnowledgeCandidate(label: string, candidate: ForgeKnowledgeCandidate) {
  const terms = buildKnowledgeSearchTerms(label);
  const corpus = `${candidate.title} ${candidate.text}`.toLowerCase();
  let score = candidate.priority;

  for (const term of terms) {
    if (!term) {
      continue;
    }

    if (corpus.includes(term)) {
      score += term === normalizeWhitespace(label).toLowerCase() ? 20 : term.length >= 4 ? 6 : 3;
    }
  }

  return score;
}

function buildKnowledgeMatchReason(candidate: ForgeKnowledgeCandidate, matched: boolean) {
  if (!matched) {
    return "节点回退：优先参考当前关键资料";
  }

  if (candidate.key.startsWith("workspace-knowledge:")) {
    return "工作区知识命中";
  }

  if (candidate.key.startsWith("deliverable:")) {
    return "关键交付物命中";
  }

  if (candidate.key.startsWith("prd-document:")) {
    return "PRD 内容命中";
  }

  if (candidate.key.startsWith("prompt-template:")) {
    return "模板规则命中";
  }

  if (candidate.key.startsWith("project-link:")) {
    return "项目资产链接命中";
  }

  if (candidate.key.startsWith("project:")) {
    return "项目背景命中";
  }

  if (candidate.key.startsWith("task:")) {
    return "任务摘要命中";
  }

  if (candidate.key.startsWith("review:")) {
    return "评审记录命中";
  }

  return "项目资料命中";
}

function getKnowledgeFallbackPriority(candidate: ForgeKnowledgeCandidate) {
  if (candidate.key.startsWith("workspace-knowledge:")) {
    return candidate.priority - 24;
  }

  return candidate.priority;
}

function buildKnowledgeSnippets(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  node: ForgeProjectWorkbenchNode,
  agent: ForgeAgent,
  deliverables: ForgeResolvedAgentContextDeliverable[],
  paths: ForgeResolvedAgentContextPathContract,
  maxKnowledgeSnippets: number
): ForgeResolvedAgentContextKnowledgeSnippet[] {
  const knowledgeSources = agent.knowledgeSources.slice(0, maxKnowledgeSnippets);
  const candidates = buildKnowledgeCandidates(snapshot, projectId, node, agent, deliverables, paths);
  const fallbackCandidates = [...candidates].sort(
    (left, right) => getKnowledgeFallbackPriority(right) - getKnowledgeFallbackPriority(left)
  );
  const usedCandidateKeys = new Set<string>();

  return knowledgeSources.map((label) => {
    const rankedCandidates = candidates
      .map((candidate) => ({
        candidate,
        score: scoreKnowledgeCandidate(label, candidate)
      }))
      .sort((left, right) => right.score - left.score);
    const matchedCandidate =
      rankedCandidates.find(
        ({ candidate, score }) =>
          score - candidate.priority >= 6 && !usedCandidateKeys.has(candidate.key)
      )?.candidate ?? null;
    const fallbackCandidate =
      fallbackCandidates.find((candidate) => !usedCandidateKeys.has(candidate.key)) ?? null;
    const selectedCandidate = matchedCandidate ?? fallbackCandidate;

    if (!selectedCandidate) {
      return {
        label,
        summary: `当前项目暂未整理《${label}》的对应资料，请先补齐知识来源。`,
        sourceTitle: "暂无匹配资料",
        matchReason: "未命中知识来源"
      };
    }

    usedCandidateKeys.add(selectedCandidate.key);

    const prefix = matchedCandidate
      ? `《${selectedCandidate.title}》`
      : `未命中专门资料，先参考《${selectedCandidate.title}》`;

    return {
      label,
      summary: `${prefix}：${summarizeText(selectedCandidate.text, 120)}`,
      sourceTitle: selectedCandidate.title,
      matchReason: buildKnowledgeMatchReason(selectedCandidate, Boolean(matchedCandidate))
    };
  });
}

function resolveWorkbenchNode(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  nodeOrCommand: ForgeProjectWorkbenchNode | ForgeCommandType | null | undefined
) {
  if (nodeOrCommand && isProjectWorkbenchNode(nodeOrCommand)) {
    return nodeOrCommand;
  }

  if (nodeOrCommand) {
    const derivedNode = getProjectWorkbenchNodeForCommandType(nodeOrCommand as ForgeCommandType);

    if (derivedNode) {
      return derivedNode;
    }
  }

  const selectedNode = snapshot.projectWorkbenchState?.[projectId]?.selectedNode;
  return selectedNode && isProjectWorkbenchNode(selectedNode) ? selectedNode : null;
}

function buildPromptTemplateSummary(
  snapshot: ForgeDashboardSnapshot,
  promptTemplateId: string | null | undefined
) {
  const template = snapshot.promptTemplates.find((item) => item.id === promptTemplateId);

  if (!template) {
    return "";
  }

  return `${template.title}：${summarizeText(template.summary, 90)} 模板要点：${summarizeText(
    template.template,
    120
  )}`;
}

function buildDeliverableSummaryFromArtifact(artifact: ForgeArtifact): ForgeResolvedAgentContextDeliverable {
  return {
    id: artifact.id,
    type: artifact.type,
    label: artifactTypeLabels[artifact.type],
    title: artifact.title,
    status: artifact.status,
    updatedAt: artifact.updatedAt,
    summary: `${artifactTypeLabels[artifact.type]}已处于 ${artifact.status}，当前标题为《${artifact.title}》。`
  };
}

function buildDeliverableSummaryFromPrdDocument(document: ForgePrdDocument): ForgeResolvedAgentContextDeliverable {
  return {
    id: document.id,
    type: "prd-document",
    label: "PRD 正文",
    title: document.title,
    status: document.status,
    updatedAt: document.createdAt,
    summary: summarizeText(document.content, 140)
  };
}

function pickRequiredArtifacts(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  node: ForgeProjectWorkbenchNode,
  maxDeliverables: number
) {
  const requiredTypes = requiredDeliverableTypesByNode[node];
  const deliverables: ForgeResolvedAgentContextDeliverable[] = [];

  for (const type of requiredTypes) {
    if (deliverables.length >= maxDeliverables) {
      break;
    }

    if (type === "prd-document") {
      const document = snapshot.prdDocuments.find((item) => item.projectId === projectId);

      if (document) {
        deliverables.push(buildDeliverableSummaryFromPrdDocument(document));
      }

      continue;
    }

    const artifact = snapshot.artifacts.find(
      (item) => item.projectId === projectId && item.type === type
    );

    if (artifact) {
      deliverables.push(buildDeliverableSummaryFromArtifact(artifact));
    }
  }

  return deliverables;
}

function buildRoleToolset(node: ForgeProjectWorkbenchNode, role: ForgeResolvedAgentContext["identity"]["role"]) {
  const toolsets: Record<
    ForgeResolvedAgentContext["identity"]["role"],
    ForgeResolvedAgentContextTool[]
  > = {
    pm: [
      {
        id: "knowledge-search",
        label: "知识检索",
        summary: "读取历史案例、资产摘要和知识来源，快速收敛需求背景。",
        mode: "read"
      },
      {
        id: "doc-summarize",
        label: "文档整理",
        summary: "整理需求、访谈和汇报信息，输出面向立项的结构化结论。",
        mode: "review"
      },
      {
        id: "handoff-plan",
        label: "交接编排",
        summary: "梳理当前节点的完成标准、阻塞和下一位接棒人。",
        mode: "review"
      }
    ],
    architect: [
      {
        id: "spec-review",
        label: "规格审阅",
        summary: "读取 PRD、架构说明和组件边界，识别实现风险。",
        mode: "read"
      },
      {
        id: "solution-outline",
        label: "方案梳理",
        summary: "沉淀模块拆分、接口边界和关键实现说明。",
        mode: "write"
      },
      {
        id: "asset-link",
        label: "资产关联",
        summary: "绑定组件、模板和历史方案，补齐当前节点所需资产。",
        mode: "review"
      }
    ],
    design: [
      {
        id: "prototype-reference",
        label: "原型参考",
        summary: "读取原型、流程和设计规范，保持界面与体验一致。",
        mode: "read"
      },
      {
        id: "ui-spec-write",
        label: "设计输出",
        summary: "补充页面结构、交互细节和演示说明。",
        mode: "write"
      },
      {
        id: "ux-review",
        label: "体验审查",
        summary: "检查核心路径、边界状态和演示可读性。",
        mode: "review"
      }
    ],
    engineer: [
      {
        id: "workspace-read",
        label: "文件读取",
        summary: "读取工作区内的代码、配置和交付物上下文。",
        mode: "read"
      },
      {
        id: "workspace-write",
        label: "文件写入",
        summary: "允许在工作区内写入补丁、脚本和交付说明。",
        mode: "write"
      },
      {
        id: "shell-run",
        label: "命令执行",
        summary: "允许在工作区内执行研发、安装和回归相关命令。",
        mode: "execute"
      },
      {
        id: "test-run",
        label: "测试运行",
        summary: "运行测试、校验构建结果，并记录执行证据。",
        mode: "execute"
      }
    ],
    qa: [
      {
        id: "playwright-run",
        label: "自动回归",
        summary: "执行 Playwright 和关键路径回归，验证交付物可演示。",
        mode: "execute"
      },
      {
        id: "evidence-capture",
        label: "证据采集",
        summary: "整理测试截图、日志和门禁证据，支撑治理判断。",
        mode: "review"
      },
      {
        id: "gate-review",
        label: "门禁审查",
        summary: "对照验收标准和阻塞项，决定是否放行下一节点。",
        mode: "review"
      }
    ],
    release: [
      {
        id: "delivery-checklist",
        label: "交付清单",
        summary: "核对发布说明、放行条件和交付边界。",
        mode: "review"
      },
      {
        id: "deploy-trigger",
        label: "部署触发",
        summary: "在确认前置条件后执行部署或发布动作。",
        mode: "execute"
      },
      {
        id: "release-notes",
        label: "发布说明",
        summary: "整理版本说明、风险提示和回滚信息。",
        mode: "write"
      }
    ],
    knowledge: [
      {
        id: "asset-catalog",
        label: "资产编目",
        summary: "把本次项目的成果归档为可复用资产和知识卡片。",
        mode: "write"
      },
      {
        id: "kb-retrieve",
        label: "知识回查",
        summary: "读取历史交付经验、FAQ 和知识库条目。",
        mode: "read"
      },
      {
        id: "archive-summary",
        label: "沉淀总结",
        summary: "输出可复用的复盘、模板和经验摘要。",
        mode: "review"
      }
    ]
  };

  const roleTools = toolsets[role] ?? [];

  if (node === "DEMO测试" && role === "engineer") {
    return roleTools.map((tool) =>
      tool.id === "test-run"
        ? {
            ...tool,
            summary: "优先执行测试、构建和快速回归，确认演示链路可运行。"
          }
        : tool
    );
  }

  return roleTools;
}

function buildPathContract(
  snapshot: ForgeDashboardSnapshot,
  projectId: string
): ForgeResolvedAgentContextPathContract {
  const workspaceRoot =
    snapshot.projectProfiles.find((item) => item.projectId === projectId)?.workspacePath?.trim() ||
    join(process.cwd(), "data", "workspaces", projectId);

  return {
    workspaceRoot,
    artifactsRoot: join(workspaceRoot, "artifacts"),
    uploadsRoot: join(workspaceRoot, "uploads"),
    knowledgeRoot: join(workspaceRoot, "knowledge"),
    skillsRoot: join(workspaceRoot, "skills")
  };
}

function buildResolvedAgentContext(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  node: ForgeProjectWorkbenchNode,
  agent: ForgeAgent
): ForgeResolvedAgentContext {
  const budget = buildAgentContextBudget();
  const workflowState = snapshot.workflowStates.find((item) => item.projectId === projectId) ?? null;
  const promptTemplateSummary = buildPromptTemplateSummary(snapshot, agent.promptTemplateId);
  const project =
    snapshot.projects.find((item) => item.id === projectId) ?? null;
  const skills = agent.skillIds
    .map((skillId) => snapshot.skills.find((item) => item.id === skillId) ?? null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, budget.maxSkills)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      summary: summarizeText(skill.summary, 90),
      usageGuide: summarizeText(skill.usageGuide, 90)
    }));
  const sops = agent.sopIds
    .map((sopId) => snapshot.sops.find((item) => item.id === sopId) ?? null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, budget.maxSops)
    .map((sop) => ({
      id: sop.id,
      name: sop.name,
      summary: summarizeText(sop.summary, 90),
      checklist: sop.checklist.slice(0, 3)
    }));
  const knowledgeSources = agent.knowledgeSources.slice(0, budget.maxKnowledgeSnippets);
  const tools = buildRoleToolset(node, agent.role);
  const paths = buildPathContract(snapshot, projectId);
  const goal = summarizeText(
    project?.requirement ||
      project?.note ||
      snapshot.prdDocuments.find((item) => item.projectId === projectId)?.content ||
      project?.name ||
      "",
    160
  );
  const deliverables = pickRequiredArtifacts(snapshot, projectId, node, budget.maxDeliverables);
  const knowledgeSnippets = buildKnowledgeSnippets(
    snapshot,
    projectId,
    node,
    agent,
    deliverables,
    paths,
    budget.maxKnowledgeSnippets
  );

  return {
    identity: {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      persona: agent.persona,
      ownerMode: agent.ownerMode
    },
    rolePrompt: [agent.systemPrompt, promptTemplateSummary].filter(Boolean).join(" "),
    skills,
    sops,
    knowledgeSources: [...agent.knowledgeSources],
    knowledgeSnippets,
    projectContext: {
      projectId,
      projectName: project?.name ?? "",
      goal,
      currentNode: node,
      currentStage: workflowState?.currentStage ?? null,
      blockers: workflowState?.blockers ?? []
    },
    deliverables,
    tools,
    paths,
    budget
  };
}

export function resolveWorkbenchAgentContextForAgent(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  agentId: string | null | undefined,
  nodeOrCommand: ForgeProjectWorkbenchNode | ForgeCommandType | null | undefined
): ForgeResolvedAgentContext | null {
  const normalizedProjectId = projectId?.trim();
  const normalizedAgentId = agentId?.trim();

  if (!normalizedProjectId || !normalizedAgentId) {
    return null;
  }

  const project = snapshot.projects.find((item) => item.id === normalizedProjectId) ?? null;

  if (!project) {
    return null;
  }

  const node = resolveWorkbenchNode(snapshot, normalizedProjectId, nodeOrCommand);

  if (!node) {
    return null;
  }

  const agent = snapshot.agents.find((item) => item.id === normalizedAgentId) ?? null;

  if (!agent) {
    return null;
  }

  return buildResolvedAgentContext(snapshot, normalizedProjectId, node, agent);
}

export function resolveWorkbenchAgentContext(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  nodeOrCommand: ForgeProjectWorkbenchNode | ForgeCommandType | null | undefined
): ForgeResolvedAgentContext | null {
  const normalizedProjectId = projectId?.trim();

  if (!normalizedProjectId) {
    return null;
  }

  const project =
    snapshot.projects.find((item) => item.id === normalizedProjectId) ?? null;

  if (!project) {
    return null;
  }

  const node = resolveWorkbenchNode(snapshot, normalizedProjectId, nodeOrCommand);

  if (!node) {
    return null;
  }

  const agent = getProjectWorkbenchAgent(snapshot, normalizedProjectId, node);

  if (!agent) {
    return null;
  }

  return buildResolvedAgentContext(snapshot, normalizedProjectId, node, agent);
}
