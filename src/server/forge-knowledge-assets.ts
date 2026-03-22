import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ForgeAssetRecommendationItem,
  ForgeAssetRecommendationManagementGroup,
  ForgeAssetRecommendationPriority,
  ForgeAssetRecommendationResult,
  ForgeDashboardSnapshot,
  ForgeProjectAssetLinkRelation,
} from "../../packages/core/src/types";
import type { ForgeAssetLibraryStage } from "../lib/forge-asset-library-stage";
import { forgeAssetLibraryStages } from "../lib/forge-asset-library-stage";
import type { ForgeObsidianKnowledgeBaseData, ForgeObsidianKnowledgeBaseNote } from "./forge-obsidian-kb";
import {
  parseObsidianFrontmatter,
  stripObsidianFrontmatter
} from "./forge-obsidian-frontmatter";

export type ForgeKnowledgeAssetUsage = {
  projectId: string;
  projectName: string;
  relation: ForgeProjectAssetLinkRelation;
  reason: string;
  usageGuide: string;
};

export type ForgeKnowledgeAsset = {
  id: string;
  title: string;
  managementGroup: ForgeAssetRecommendationManagementGroup;
  libraryStage: ForgeAssetLibraryStage;
  typeLabel: string;
  summary: string;
  detailSummary: string;
  contentPreview: string;
  markdownBody: string;
  sceneLabel: string;
  sourceLabel: string;
  callableLabel: string;
  updatedAt: string;
  sourcePath: string;
  sourceNoteType: string;
  tags: string[];
  detailNotes: string[];
  projectUsage: ForgeKnowledgeAssetUsage[];
  usageCount: number;
  openUri: string;
  assetEnabled: boolean;
  assetGroupValue: ForgeAssetRecommendationManagementGroup | null;
  assetLabelValue: string | null;
};

type ParsedFrontmatter = Record<string, string>;

const managementGroups: ForgeAssetRecommendationManagementGroup[] = [
  "启动资产",
  "执行资产",
  "规则资产",
  "证据资产",
  "知识资产"
];
const SHARED_ASSET_MODULE_PREFIX = "20-共享资产SharedAssets/02-通用模块/";
const SHARED_ASSET_SOURCE_LABEL = "共享资产 / 通用模块";
const ASSET_GROUP_LABELS = new Set<ForgeAssetRecommendationManagementGroup>(managementGroups);
const ASSET_LIBRARY_STAGE_LABELS = new Set<ForgeAssetLibraryStage>(
  forgeAssetLibraryStages,
);

function parseFrontmatter(content: string): ParsedFrontmatter {
  return parseObsidianFrontmatter(content);
}

function stripFrontmatter(content: string) {
  return stripObsidianFrontmatter(content);
}

function isTruthy(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function readAssetGroup(frontmatter: ParsedFrontmatter): ForgeAssetRecommendationManagementGroup | null {
  const value = frontmatter.asset_group?.trim() as
    | ForgeAssetRecommendationManagementGroup
    | undefined;

  return value && ASSET_GROUP_LABELS.has(value) ? value : null;
}

function readNoteContent(
  knowledgeBase: ForgeObsidianKnowledgeBaseData,
  note: ForgeObsidianKnowledgeBaseNote
) {
  if (!knowledgeBase.vaultPath) {
    return null;
  }

  const absolutePath = join(knowledgeBase.vaultPath, note.relativePath);

  if (!existsSync(absolutePath)) {
    return null;
  }

  return readFileSync(absolutePath, "utf8");
}

function isAssetCandidate(note: ForgeObsidianKnowledgeBaseNote, frontmatter: ParsedFrontmatter) {
  const path = note.relativePath;
  const title = note.title;

  if (/^(README|INDEX|HANDOFF-HUB)$/i.test(title.trim())) {
    return false;
  }

  if (!path.startsWith(SHARED_ASSET_MODULE_PREFIX)) {
    return false;
  }

  return isTruthy(frontmatter.asset) && readAssetGroup(frontmatter) !== null;
}

function classifyManagementGroup(
  note: ForgeObsidianKnowledgeBaseNote,
  frontmatter: ParsedFrontmatter
): ForgeAssetRecommendationManagementGroup {
  const declaredGroup = readAssetGroup(frontmatter);

  if (declaredGroup) {
    return declaredGroup;
  }

  return "知识资产";
}

function mapLegacyWorkflowStageToLibraryStage(
  value: string | undefined,
): ForgeAssetLibraryStage | null {
  switch (value?.trim()) {
    case "项目接入":
      return "立项起盘";
    case "方案与任务包":
      return "需求方案";
    case "开发执行":
      return "开发联调";
    case "测试验证":
    case "交付发布":
      return "测试发布";
    case "归档复用":
      return "复盘沉淀";
    default:
      return null;
  }
}

function readLibraryStage(frontmatter: ParsedFrontmatter): ForgeAssetLibraryStage | null {
  const explicitValue = frontmatter.library_stage?.trim() as
    | ForgeAssetLibraryStage
    | undefined;

  if (explicitValue && ASSET_LIBRARY_STAGE_LABELS.has(explicitValue)) {
    return explicitValue;
  }

  return mapLegacyWorkflowStageToLibraryStage(frontmatter.workflow_stage);
}

function classifyLibraryStage(
  note: ForgeObsidianKnowledgeBaseNote,
  frontmatter: ParsedFrontmatter,
  managementGroup: ForgeAssetRecommendationManagementGroup,
  content: string | null
): ForgeAssetLibraryStage {
  const declaredStage = readLibraryStage(frontmatter);

  if (declaredStage) {
    return declaredStage;
  }

  const body = content ? stripFrontmatter(content) : "";
  const corpus = [
    note.title,
    note.relativePath,
    frontmatter.type,
    frontmatter.asset_label,
    frontmatter.scope,
    body.slice(0, 800),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const includesAny = (...keywords: string[]) =>
    keywords.some((keyword) => corpus.includes(keyword.toLowerCase()));

  if (includesAny("起盘", "接入", "派工", "初始化", "协作写作")) {
    return "立项起盘";
  }

  if (includesAny("原型", "绘图", "页面结构", "交互", "界面", "线框", "wireframe")) {
    return "原型设计";
  }

  if (includesAny("方案", "spec", "任务包", "需求", "prd")) {
    return "需求方案";
  }

  if (includesAny("交付", "部署", "发布", "上线", "备份", "恢复", "隔离", "环境", "扣子")) {
    return "测试发布";
  }

  if (includesAny("测试", "回归", "验收", "验证", "qa")) {
    return "测试发布";
  }

  if (includesAny("开发", "执行", "联调", "模块", "工具", "基线", "api", "sdk", "脚本", "automation")) {
    return "开发联调";
  }

  if (includesAny("复盘", "归档", "案例", "沉淀", "handoff", "postmortem")) {
    return "复盘沉淀";
  }

  switch (managementGroup) {
    case "启动资产":
      return "立项起盘";
    case "执行资产":
      return "开发联调";
    case "证据资产":
    case "知识资产":
      return "复盘沉淀";
    default:
      return "需求方案";
  }
}

function getTypeLabel(
  group: ForgeAssetRecommendationManagementGroup,
  noteType: string,
  frontmatter: ParsedFrontmatter
) {
  if (frontmatter.asset_label?.trim()) {
    return frontmatter.asset_label.trim();
  }

  if (group === "启动资产") {
    return "启动模板";
  }

  if (group === "执行资产") {
    return noteType === "playbook" || noteType === "runbook" ? "执行模块" : "通用模块";
  }

  if (group === "规则资产") {
    return noteType === "sop" ? "执行规范" : "共享规范";
  }

  if (group === "证据资产") {
    return "共享案例";
  }

  return "共享资料";
}

function getStageSceneLabel(stage: ForgeAssetLibraryStage) {
  switch (stage) {
    case "立项起盘":
      return "立项起盘 / 协作启动";
    case "需求方案":
      return "需求方案 / 任务拆解";
    case "原型设计":
      return "原型设计 / 页面结构";
    case "开发联调":
      return "开发联调 / 执行推进";
    case "测试发布":
      return "测试发布 / 验收放行";
    default:
      return "复盘沉淀 / 经验复用";
  }
}

function getCallableLabel(group: ForgeAssetRecommendationManagementGroup) {
  switch (group) {
    case "启动资产":
      return "立项起盘 / 新建项目 / 起盘";
    case "执行资产":
      return "开发联调 / 执行推进 / 通用操作";
    case "规则资产":
      return "需求方案 / 原型设计 / 测试发布";
    case "证据资产":
      return "复盘沉淀 / 经验背书 / 风险提示";
    default:
      return "知识上下文 / 背景参考 / 检索";
  }
}

function buildDetailNotes(note: ForgeObsidianKnowledgeBaseNote, frontmatter: ParsedFrontmatter) {
  const details: string[] = [];

  if (frontmatter.type) {
    details.push(`笔记类型：${frontmatter.type}`);
  }

  if (frontmatter.owner) {
    details.push(`维护人：${frontmatter.owner}`);
  }

  if (frontmatter.scope) {
    details.push(`适用范围：${frontmatter.scope}`);
  }

  if (frontmatter.status) {
    details.push(`状态：${frontmatter.status}`);
  }

  if (note.tags.length > 0) {
    details.push(`标签：${note.tags.join(" / ")}`);
  }

  return details;
}

function buildContentPreview(content: string | null) {
  if (!content) {
    return "";
  }

  const body = stripFrontmatter(content).trim();

  if (!body) {
    return "";
  }

  const lines = body.split("\n");
  const preview = lines.slice(0, 120).join("\n").trim();

  return lines.length > 120 ? `${preview}\n\n...` : preview;
}

function buildMarkdownBody(content: string | null) {
  if (!content) {
    return "";
  }

  return stripFrontmatter(content).trim();
}

function scoreKnowledgeAsset(asset: ForgeKnowledgeAsset) {
  let score = 50;

  if (asset.sourcePath.startsWith(SHARED_ASSET_MODULE_PREFIX)) {
    score += 24;
  }

  if (asset.managementGroup === "启动资产") {
    score += 12;
  }

  if (asset.managementGroup === "规则资产") {
    score += 10;
  }

  if (asset.managementGroup === "执行资产") {
    score += 8;
  }

  if (asset.tags.includes("forge")) {
    score += 6;
  }

  return score;
}

function buildRecommendationReason(
  asset: ForgeKnowledgeAsset,
  projectName: string | undefined
) {
  switch (asset.managementGroup) {
    case "启动资产":
      return `${asset.title} 适合作为 ${projectName ?? "当前项目"} 的起盘基线。`;
    case "执行资产":
      return `${asset.title} 更像可直接调用的执行卡，适合当前推进环节。`;
    case "规则资产":
      return `${asset.title} 可作为当前项目的硬约束，避免重复踩坑。`;
    case "证据资产":
      return `${asset.title} 提供了经过验证的复盘证据，可先作为参考。`;
    default:
      return `${asset.title} 更适合在需要时加入项目上下文。`;
  }
}

function buildRecommendationPriority(group: ForgeAssetRecommendationManagementGroup): ForgeAssetRecommendationPriority {
  if (group === "启动资产" || group === "规则资产") {
    return "required";
  }

  if (group === "证据资产") {
    return "reference";
  }

  return "recommended";
}

export function buildKnowledgeAssetsFromKnowledgeBase(
  knowledgeBase: ForgeObsidianKnowledgeBaseData
): ForgeKnowledgeAsset[] {
  const assets = knowledgeBase.notes
    .map<ForgeKnowledgeAsset | null>((note) => {
      const content = readNoteContent(knowledgeBase, note);
      const frontmatter = content ? parseFrontmatter(content) : {};

      if (!isAssetCandidate(note, frontmatter)) {
        return null;
      }

      const managementGroup = classifyManagementGroup(note, frontmatter);
      const libraryStage = classifyLibraryStage(
        note,
        frontmatter,
        managementGroup,
        content,
      );
      const noteType = frontmatter.type?.toLowerCase() ?? "knowledge-note";

      return {
        id: `knowledge-asset:${note.id}`,
        title: note.title,
        managementGroup,
        libraryStage,
        typeLabel: getTypeLabel(managementGroup, noteType, frontmatter),
        summary: note.excerpt,
        detailSummary: note.excerpt,
        contentPreview: buildContentPreview(content),
        markdownBody: buildMarkdownBody(content),
        sceneLabel: getStageSceneLabel(libraryStage),
        sourceLabel: SHARED_ASSET_SOURCE_LABEL,
        callableLabel: getCallableLabel(managementGroup),
        updatedAt: note.modifiedAt,
        sourcePath: note.relativePath,
        sourceNoteType: noteType,
        tags: note.tags,
        detailNotes: buildDetailNotes(note, frontmatter),
        projectUsage: [] as ForgeKnowledgeAssetUsage[],
        usageCount: 0,
        openUri: note.openUri,
        assetEnabled: isTruthy(frontmatter.asset),
        assetGroupValue: readAssetGroup(frontmatter),
        assetLabelValue: frontmatter.asset_label?.trim() || null
      } satisfies ForgeKnowledgeAsset;
    })
    .filter((asset): asset is ForgeKnowledgeAsset => Boolean(asset));

  return assets.sort((left, right) => {
    if (left.libraryStage !== right.libraryStage) {
      return (
        forgeAssetLibraryStages.indexOf(left.libraryStage) -
        forgeAssetLibraryStages.indexOf(right.libraryStage)
      );
    }

    return right.updatedAt.localeCompare(left.updatedAt, "zh-CN");
  });
}

export function buildKnowledgeAssetRecommendations(
  knowledgeAssets: ForgeKnowledgeAsset[],
  snapshot: ForgeDashboardSnapshot
): ForgeAssetRecommendationResult {
  const project =
    snapshot.projects.find((item) => item.id === snapshot.activeProjectId) ?? snapshot.projects[0] ?? null;
  const stage =
    snapshot.workflowStates.find((item) => item.projectId === project?.id)?.currentStage ?? null;

  const items = knowledgeAssets
    .map((asset) => {
      const priority = buildRecommendationPriority(asset.managementGroup);

      return {
        id: asset.id,
        title: asset.title,
        sourceKind: "knowledge-asset",
        managementGroup: asset.managementGroup,
        priority,
        summary: asset.summary,
        reason: buildRecommendationReason(asset, project?.name),
        usageGuide: `先在知识库中查看 ${asset.title}，确认后再挂到项目里。`,
        linked: asset.usageCount > 0,
        score: scoreKnowledgeAsset(asset),
        stageTags: stage ? [stage] : [],
        sectorTags: project?.sector ? [project.sector] : [],
        relation: asset.projectUsage[0]?.relation ?? null
      } satisfies ForgeAssetRecommendationItem;
    })
    .sort((left, right) => right.score - left.score);

  return {
    project: project ? { id: project.id, name: project.name, sector: project.sector } : null,
    stage,
    taskPack: null,
    query: null,
    managementGroups,
    requiredItems: items.filter((item) => item.priority === "required").slice(0, 4),
    recommendedItems: items.filter((item) => item.priority === "recommended").slice(0, 4),
    referenceItems: items.filter((item) => item.priority === "reference").slice(0, 4),
    total: items.length,
    items
  };
}
