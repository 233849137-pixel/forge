"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ForgeAssetLibraryStage } from "../lib/forge-asset-library-stage";
import {
  forgeAssetLibraryStageDescriptions,
  forgeAssetLibraryStages,
} from "../lib/forge-asset-library-stage";
import type { ForgeAssetsPageData } from "./forge-assets-page.types";
import ForgeConsoleShell, {
  getToneBadgeClassName,
} from "./forge-console-shell";
import shellStyles from "./forge-console-shell.module.css";
import {
  saveForgeKnowledgeAssetContent,
  saveForgeKnowledgeAssetMetadata,
} from "../lib/forge-knowledge-asset-api";
import {
  readForgeKnowledgeNoteContent,
  saveForgeKnowledgeNoteContent,
} from "../lib/forge-knowledge-note-api";
import { dispatchForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import {
  formatTimestamp,
  type Tone,
} from "./forge-console-utils";
import styles from "./forge-assets-page.module.css";

type AssetPrimarySection =
  | "资产总览"
  | "知识类资产"
  | "素材类资产"
  | "代码类资产"
  | "知识库";
type CodeAssetCategory =
  | "项目骨架"
  | "工作台界面"
  | "知识检索"
  | "业务流程"
  | "集成连接"
  | "测试与发布"
  | "基础能力";
type MaterialAssetCategory =
  | ForgeAssetsPageData["materialAssets"][number]["typeLabel"];
type AssetSection =
  | "资产总览"
  | ForgeAssetLibraryStage
  | MaterialAssetCategory
  | CodeAssetCategory
  | "知识库";
type AssetLibraryTab = ForgeAssetLibraryStage;
type AssetSortMode = "default" | "usage" | "name";
type AssetUsageRelation = "default" | "required" | "recommended";
type AssetManagementGroup =
  ForgeAssetsPageData["knowledgeAssets"][number]["managementGroup"];

type AssetProjectUsage = {
  projectId: string;
  projectName: string;
  relation: AssetUsageRelation;
  reason: string;
  usageGuide: string;
};

type AssetLibraryItem = {
  id: string;
  title: string;
  typeLabel: string;
  summary: string;
  detailSummary: string;
  contentPreview: string;
  markdownBody: string;
  sceneLabel: string;
  sourceLabel: string;
  callableLabel: string;
  updatedAt: string;
  tone: Tone;
  detailMeta: Array<{ label: string; value: string }>;
  detailNotes?: string[];
  projectUsage: AssetProjectUsage[];
  usageCount: number;
  externalHref?: string;
  externalActionLabel?: string;
  sourcePath: string;
  assetEnabled: boolean;
  assetGroupValue: AssetManagementGroup | null;
  assetLabelValue: string | null;
};

type KnowledgeNote = ForgeAssetsPageData["knowledgeBase"]["notes"][number];
type ReusableModuleRegistry = ForgeAssetsPageData["reusableModules"];
type KnowledgeTreeFolder = {
  id: string;
  name: string;
  path: string;
  folders: KnowledgeTreeFolder[];
  notes: KnowledgeNote[];
};
type KnowledgeTreeData = {
  folders: KnowledgeTreeFolder[];
  notes: KnowledgeNote[];
};
type AssetRecommendationItem =
  ForgeAssetsPageData["assetRecommendations"]["items"][number];
type AssetMetadataDraft = {
  asset: boolean;
  assetGroup: AssetManagementGroup | null;
  assetLabel: string;
};
type ReusableModuleItem = {
  id: string;
  title: string;
  codeCategory: CodeAssetCategory;
  sourceTypeLabel: string;
  summary: string;
  usageGuide: string;
  tags: string[];
  recommendedSectors: string[];
  sourceRef: string;
  sourceLocator: string | null;
  importPath: string | null;
  installCommand: string | null;
  requiredEnv: string[];
  setupSteps: string[];
  smokeTestCommand: string | null;
  ownedPaths: string[];
  peerDeps: string[];
  deliveryModeLabel: string | null;
  linkedReason: string | null;
  linkedRelation: string | null;
  usageCount: number;
  successCount: number;
  blockedCount: number;
  statusLabel: string;
  score: number | null;
  suggestionReason: string | null;
  tone: Tone;
};
type MaterialAssetItem = ForgeAssetsPageData["materialAssets"][number];

type ForgeAssetsPageInput = Omit<
  ForgeAssetsPageData,
  "knowledgeBase" | "materialAssets" | "reusableModules" | "assetRecommendations"
> & {
  knowledgeBase?: ForgeAssetsPageData["knowledgeBase"];
  materialAssets?: ForgeAssetsPageData["materialAssets"];
  reusableModules?: ForgeAssetsPageData["reusableModules"];
  assetRecommendations?: ForgeAssetsPageData["assetRecommendations"];
};

function createFallbackKnowledgeBase(): ForgeAssetsPageData["knowledgeBase"] {
  return {
    provider: "obsidian",
    vaultName: "Knowledge Vault",
    vaultPath: "",
    cliStatus: "unavailable",
    cliSummary: "当前还没有接通可用的知识库连接器。",
    syncMode: "filesystem",
    syncedAt: new Date().toISOString(),
    summary: "当前还没有接入可同步的外部知识库。",
    noteCount: 0,
    canvasCount: 0,
    topFolders: [],
    recentNotes: [],
    notes: [],
  };
}

function createFallbackAssetRecommendations(): ForgeAssetsPageData["assetRecommendations"] {
  return {
    project: null,
    stage: null,
    taskPack: null,
    query: null,
    managementGroups: [
      "启动资产",
      "执行资产",
      "规则资产",
      "证据资产",
      "知识资产",
    ],
    requiredItems: [],
    recommendedItems: [],
    referenceItems: [],
    total: 0,
    items: [],
  };
}

function createFallbackReusableModules(): ForgeAssetsPageData["reusableModules"] {
  return {
    project: null,
    taskPack: null,
    total: 0,
    categories: [],
    recommendedCount: 0,
    linkedCount: 0,
    linkedItems: [],
    usageSignals: [],
    assemblySuggestions: [],
    items: [],
  };
}

function createFallbackMaterialAssets(): ForgeAssetsPageData["materialAssets"] {
  return [];
}

const codeAssetCategories: CodeAssetCategory[] = [
  "项目骨架",
  "工作台界面",
  "知识检索",
  "业务流程",
  "集成连接",
  "测试与发布",
  "基础能力",
];
const materialAssetCategories: MaterialAssetCategory[] = [
  "原型图",
  "设计效果图",
  "图片素材",
];
const plannedMaterialCategoryCounts: Record<MaterialAssetCategory, number> = {
  原型图: 4,
  设计效果图: 6,
  图片素材: 3,
};
const plannedCodeCategoryCounts: Record<CodeAssetCategory, number> = {
  项目骨架: 2,
  工作台界面: 4,
  知识检索: 3,
  业务流程: 3,
  集成连接: 2,
  测试与发布: 2,
  基础能力: 4,
};
const codeAssetCategoryDescriptions: Record<CodeAssetCategory, string> = {
  项目骨架: "项目模板、应用壳和起盘骨架。",
  工作台界面: "工作台、会话面板、表单与业务页面。",
  知识检索: "RAG、检索、索引与引用能力。",
  业务流程: "结算、审批、状态流与业务链路。",
  集成连接: "上传下载、外部接口、Webhook 与连接器。",
  测试与发布: "测试门禁、发布、回滚与验收动作。",
  基础能力: "鉴权、配置、日志、会话等基础底座。",
};
const assetSortOptions: Array<{ label: string; value: AssetSortMode }> = [
  { label: "默认排序", value: "default" },
  { label: "按引用项目数", value: "usage" },
  { label: "按资料名称", value: "name" },
];
const assetManagementGroups: AssetManagementGroup[] = [
  "启动资产",
  "执行资产",
  "规则资产",
  "证据资产",
  "知识资产",
];

function getRecommendationTone(
  priority: AssetRecommendationItem["priority"],
): Tone {
  switch (priority) {
    case "required":
      return "warn";
    case "recommended":
      return "info";
    default:
      return "neutral";
  }
}

function getRecommendationPriorityLabel(
  priority: AssetRecommendationItem["priority"],
) {
  switch (priority) {
    case "required":
      return "必带";
    case "recommended":
      return "AI 推荐";
    default:
      return "背景参考";
  }
}

function getRecommendationSection(
  item: AssetRecommendationItem,
): AssetLibraryTab {
  return snapshotLibraryStageByRecommendationItem(item) ?? "开发联调";
}

function isKnowledgeStage(section: AssetSection): section is ForgeAssetLibraryStage {
  return forgeAssetLibraryStages.includes(section as ForgeAssetLibraryStage);
}

function isCodeCategory(section: AssetSection): section is CodeAssetCategory {
  return codeAssetCategories.includes(section as CodeAssetCategory);
}

function isMaterialCategory(section: AssetSection): section is MaterialAssetCategory {
  return materialAssetCategories.includes(section as MaterialAssetCategory);
}

function getPrimarySection(section: AssetSection): AssetPrimarySection {
  if (
    section === "资产总览" ||
    section === "知识库"
  ) {
    return section;
  }

  if (isKnowledgeStage(section)) {
    return "知识类资产";
  }

  if (isMaterialCategory(section)) {
    return "素材类资产";
  }

  return "代码类资产";
}

function defaultLibraryStageForManagementGroup(
  group: AssetManagementGroup,
): ForgeAssetLibraryStage {
  switch (group) {
    case "启动资产":
      return "立项起盘";
    case "规则资产":
      return "需求方案";
    case "执行资产":
      return "开发联调";
    case "证据资产":
    case "知识资产":
      return "复盘沉淀";
    default:
      return "需求方案";
  }
}

function defaultManagementGroupForLibraryStage(
  stage: ForgeAssetLibraryStage,
): AssetManagementGroup {
  switch (stage) {
    case "立项起盘":
      return "启动资产";
    case "需求方案":
    case "原型设计":
    case "测试发布":
      return "规则资产";
    case "开发联调":
      return "执行资产";
    case "复盘沉淀":
      return "证据资产";
    default:
      return "执行资产";
  }
}

function snapshotLibraryStageByRecommendationItem(
  item: AssetRecommendationItem,
  knowledgeAssets?: ForgeAssetsPageData["knowledgeAssets"],
) {
  const matchedAsset = knowledgeAssets?.find((asset) => asset.id === item.id);

  return matchedAsset?.libraryStage ?? defaultLibraryStageForManagementGroup(item.managementGroup);
}

function classifyReusableModule(
  item: ReusableModuleRegistry["items"][number],
): CodeAssetCategory {
  const haystack = [
    item.title,
    item.summary,
    item.usageGuide,
    item.category,
    item.tags.join(" "),
    item.assemblyContract?.sourceLocator ?? "",
    item.assemblyContract?.importPath ?? "",
    item.assemblyContract?.setupSteps.join(" ") ?? "",
    item.assemblyContract?.ownedPaths.join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    /(bootstrap|scaffold|starter|shell|骨架|起盘|模板|初始化|app shell)/i.test(
      haystack,
    )
  ) {
    return "项目骨架";
  }

  if (/(auth|login|session|鉴权|登录|权限|验证码|会话保持)/i.test(haystack)) {
    return "基础能力";
  }

  if (
    /(chat|panel|workspace|dashboard|form|page|table|communication|界面|工作台|面板|页面|表单|列表|会话)/i.test(
      haystack,
    )
  ) {
    return "工作台界面";
  }

  if (/(rag|检索|检索增强|search|retriev|index|索引|知识)/i.test(haystack)) {
    return "知识检索";
  }

  if (
    /(payment|checkout|审批|approval|workflow|结算|支付|订单|状态流|工单|流程)/i.test(
      haystack,
    )
  ) {
    return "业务流程";
  }

  if (
    /(upload|file|storage|webhook|connector|api|integration|集成|接口|对象存储|下载)/i.test(
      haystack,
    )
  ) {
    return "集成连接";
  }

  if (
    /(test|smoke|release|deploy|rollback|验收|发布|回滚|测试|门禁)/i.test(
      haystack,
    )
  ) {
    return "测试与发布";
  }

  return "基础能力";
}

function getComponentSourceTypeLabel(sourceType: ReusableModuleRegistry["items"][number]["sourceType"]) {
  return sourceType === "internal" ? "内部复用" : "外部模块";
}

function getDeliveryModeLabel(deliveryMode?: string | null) {
  switch (deliveryMode) {
    case "workspace-package":
      return "Workspace 包";
    case "local-template":
      return "本地模板";
    case "git-repo":
      return "Git 仓库";
    case "npm-package":
      return "NPM 包";
    default:
      return null;
  }
}

function getReusableModuleItems(
  reusableModules: ForgeAssetsPageData["reusableModules"],
): ReusableModuleItem[] {
  const linkedById = new Map(
    reusableModules.linkedItems.map((item) => [item.componentId, item]),
  );
  const usageSignalById = new Map(
    reusableModules.usageSignals.map((item) => [item.componentId, item]),
  );
  const suggestionById = new Map(
    reusableModules.assemblySuggestions.map((item) => [item.componentId, item]),
  );

  return reusableModules.items.map((item) => {
    const contract = item.assemblyContract;
    const linked = linkedById.get(item.id);
    const usageSignal = usageSignalById.get(item.id);
    const suggestion = suggestionById.get(item.id);
    const tone: Tone = linked
      ? "good"
      : suggestion
        ? "info"
        : usageSignal?.blockedCount
          ? "warn"
          : "neutral";

    return {
      id: item.id,
      title: item.title,
      codeCategory: classifyReusableModule(item),
      sourceTypeLabel: getComponentSourceTypeLabel(item.sourceType),
      summary: item.summary,
      usageGuide: item.usageGuide,
      tags: item.tags,
      recommendedSectors: item.recommendedSectors,
      sourceRef: item.sourceRef,
      sourceLocator: contract?.sourceLocator ?? null,
      importPath: contract?.importPath ?? null,
      installCommand: contract?.installCommand ?? null,
      requiredEnv: contract?.requiredEnv ?? [],
      setupSteps: contract?.setupSteps ?? [],
      smokeTestCommand: contract?.smokeTestCommand ?? null,
      ownedPaths: contract?.ownedPaths ?? [],
      peerDeps: contract?.peerDeps ?? [],
      deliveryModeLabel: getDeliveryModeLabel(contract?.deliveryMode),
      linkedReason: linked?.reason ?? null,
      linkedRelation: linked?.relation ?? null,
      usageCount: usageSignal?.usageCount ?? 0,
      successCount: usageSignal?.successCount ?? 0,
      blockedCount: usageSignal?.blockedCount ?? 0,
      statusLabel: usageSignal?.statusLabel ?? (linked ? "已接入" : "待接入"),
      score: suggestion?.score ?? null,
      suggestionReason: suggestion?.reason ?? null,
      tone,
    };
  });
}

function getUsageTone(relation: AssetUsageRelation): Tone {
  switch (relation) {
    case "default":
      return "info";
    case "required":
      return "warn";
    default:
      return "good";
  }
}

function getUsageLabel(relation: AssetUsageRelation) {
  switch (relation) {
    case "default":
      return "默认关联";
    case "required":
      return "必选引用";
    default:
      return "推荐引用";
  }
}

function getKnowledgeBaseTone(
  status: ForgeAssetsPageData["knowledgeBase"]["cliStatus"],
): Tone {
  switch (status) {
    case "ready":
      return "good";
    case "disabled":
      return "warn";
    case "error":
      return "risk";
    default:
      return "neutral";
  }
}

function getKnowledgeNoteDirectory(note: KnowledgeNote) {
  const segments = note.relativePath.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

function buildKnowledgeTree(notes: KnowledgeNote[]): KnowledgeTreeData {
  const folderMap = new Map<string, KnowledgeTreeFolder>();
  const rootFolders: KnowledgeTreeFolder[] = [];
  const rootNotes: KnowledgeNote[] = [];

  const ensureFolder = (path: string) => {
    const normalizedPath = path.trim();

    if (!normalizedPath) {
      return null;
    }

    const existing = folderMap.get(normalizedPath);
    if (existing) {
      return existing;
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    const name = segments[segments.length - 1] ?? normalizedPath;
    const parentPath = segments.slice(0, -1).join("/");
    const folder: KnowledgeTreeFolder = {
      id: `folder:${normalizedPath}`,
      name,
      path: normalizedPath,
      folders: [],
      notes: [],
    };

    folderMap.set(normalizedPath, folder);

    if (parentPath) {
      const parent = ensureFolder(parentPath);
      parent?.folders.push(folder);
    } else {
      rootFolders.push(folder);
    }

    return folder;
  };

  notes.forEach((note) => {
    const folder = ensureFolder(getKnowledgeNoteDirectory(note));

    if (folder) {
      folder.notes.push(note);
      return;
    }

    rootNotes.push(note);
  });

  const sortFolders = (folders: KnowledgeTreeFolder[]) => {
    folders.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
    folders.forEach((folder) => {
      folder.notes.sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      );
      sortFolders(folder.folders);
    });
  };

  sortFolders(rootFolders);
  rootNotes.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));

  return {
    folders: rootFolders,
    notes: rootNotes,
  };
}

function collectKnowledgeFolderIds(folders: KnowledgeTreeFolder[]): string[] {
  return folders.flatMap((folder) => [
    folder.id,
    ...collectKnowledgeFolderIds(folder.folders),
  ]);
}

type ObsidianPreviewBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; language: string; code: string };

function parseObsidianPreview(content: string): ObsidianPreviewBlock[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks: ObsidianPreviewBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        kind: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index]?.trim().startsWith(">")) {
        quoteLines.push((lines[index] ?? "").trim().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push({
        kind: "quote",
        text: quoteLines.join(" "),
      });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index]?.trim() ?? "")) {
        items.push((lines[index] ?? "").trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({
        kind: "list",
        ordered: false,
        items,
      });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index]?.trim() ?? "")) {
        items.push((lines[index] ?? "").trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({
        kind: "list",
        ordered: true,
        items,
      });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const currentLine = lines[index] ?? "";
      const currentTrimmed = currentLine.trim();

      if (
        !currentTrimmed ||
        currentTrimmed.startsWith("```") ||
        currentTrimmed.startsWith(">") ||
        /^#{1,6}\s+/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed)
      ) {
        break;
      }

      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    blocks.push({
      kind: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function normalizePreviewTitle(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function renderObsidianPreview(content: string, title?: string) {
  const blocks = parseObsidianPreview(content);
  const normalizedTitle = title ? normalizePreviewTitle(title) : "";
  const visibleBlocks =
    normalizedTitle &&
    blocks[0]?.kind === "heading" &&
    normalizePreviewTitle(blocks[0].text) === normalizedTitle
      ? blocks.slice(1)
      : blocks;

  if (visibleBlocks.length === 0) {
    return <p className={styles.obsidianEmpty}>当前这条资产还没有可展示的正文预览。</p>;
  }

  return visibleBlocks.map((block, index) => {
    if (block.kind === "heading") {
      return (
        <p
          className={`${styles.obsidianHeading} ${
            block.level <= 2 ? styles.obsidianHeadingPrimary : styles.obsidianHeadingSecondary
          }`}
          key={`${block.kind}-${index}`}
        >
          {block.text}
        </p>
      );
    }

    if (block.kind === "quote") {
      return (
        <blockquote className={styles.obsidianQuote} key={`${block.kind}-${index}`}>
          {block.text}
        </blockquote>
      );
    }

    if (block.kind === "code") {
      return (
        <pre className={styles.obsidianCodeBlock} key={`${block.kind}-${index}`}>
          {block.language ? <span className={styles.obsidianCodeLabel}>{block.language}</span> : null}
          <code>{block.code}</code>
        </pre>
      );
    }

    if (block.kind === "list") {
      const ListTag = block.ordered ? "ol" : "ul";

      return (
        <ListTag className={styles.obsidianList} key={`${block.kind}-${index}`}>
          {block.items.map((item) => (
            <li key={`${block.kind}-${index}-${item}`}>{item}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <p className={styles.obsidianParagraph} key={`${block.kind}-${index}`}>
        {block.text}
      </p>
    );
  });
}

function getAssetSections(snapshot: ForgeAssetsPageData) {
  const knowledgeAssets = snapshot.knowledgeAssets ?? [];
  const sections: Record<AssetLibraryTab, AssetLibraryItem[]> = {
    立项起盘: [],
    需求方案: [],
    原型设计: [],
    开发联调: [],
    测试发布: [],
    复盘沉淀: [],
  };

  knowledgeAssets.forEach((asset) => {
    const libraryStage =
      asset.libraryStage && asset.libraryStage in sections
        ? asset.libraryStage
        : defaultLibraryStageForManagementGroup(asset.managementGroup);
    const tone: Tone =
      asset.managementGroup === "启动资产"
        ? "info"
        : asset.managementGroup === "执行资产"
          ? "good"
          : asset.managementGroup === "规则资产"
            ? "warn"
            : "neutral";

    sections[libraryStage].push({
      id: asset.id,
      title: asset.title,
      typeLabel: asset.typeLabel,
      summary: asset.summary || "这条资料还没有提炼摘要。",
      detailSummary: asset.detailSummary || asset.summary || "这条资料还没有详细说明。",
      contentPreview: asset.contentPreview || asset.detailSummary || asset.summary,
      markdownBody:
        asset.markdownBody ||
        asset.contentPreview ||
        asset.detailSummary ||
        asset.summary,
      sceneLabel: asset.sceneLabel,
      sourceLabel: asset.sourceLabel,
      callableLabel: asset.callableLabel,
      updatedAt: asset.updatedAt,
      tone,
      detailMeta: [
        { label: "适用场景", value: asset.sceneLabel },
        { label: "资料来源", value: asset.sourceLabel },
        { label: "来源路径", value: asset.sourcePath },
        { label: "更新时间", value: asset.updatedAt || "知识库同步" },
      ],
      detailNotes: asset.detailNotes,
      projectUsage: asset.projectUsage as AssetProjectUsage[],
      usageCount: asset.usageCount,
      externalHref: asset.openUri,
      externalActionLabel: "在知识库中打开",
      sourcePath: asset.sourcePath,
      assetEnabled: asset.assetEnabled,
      assetGroupValue: asset.assetGroupValue,
      assetLabelValue: asset.assetLabelValue,
    });
  });

  return sections;
}

export default function ForgeAssetsPage({
  data,
  snapshot: legacySnapshot,
  showNavigation = false,
}: {
  data?: ForgeAssetsPageInput;
  snapshot?: ForgeAssetsPageInput;
  showNavigation?: boolean;
}) {
  const sourceSnapshot = data ?? legacySnapshot;

  if (!sourceSnapshot) {
    throw new Error("ForgeAssetsPage requires page data.");
  }

  const snapshot: ForgeAssetsPageData = {
    ...sourceSnapshot,
    knowledgeAssets: sourceSnapshot.knowledgeAssets ?? [],
    knowledgeBase:
      sourceSnapshot.knowledgeBase ?? createFallbackKnowledgeBase(),
    materialAssets:
      sourceSnapshot.materialAssets ?? createFallbackMaterialAssets(),
    reusableModules:
      sourceSnapshot.reusableModules ?? createFallbackReusableModules(),
    assetRecommendations:
      sourceSnapshot.assetRecommendations ??
      createFallbackAssetRecommendations(),
  };
  const knowledgeBaseHref = "obsidian://open";

  const actionFeedbackTimerRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<AssetSection>("立项起盘");
  const [expandedPrimarySection, setExpandedPrimarySection] = useState<
    Extract<AssetPrimarySection, "知识类资产" | "素材类资产" | "代码类资产"> | null
  >("知识类资产");
  const [assetSearch, setAssetSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [sortMode, setSortMode] = useState<AssetSortMode>("default");
  const [selectedIds, setSelectedIds] = useState<
    Partial<Record<AssetSection, string>>
  >({});
  const [selectedKnowledgeNoteId, setSelectedKnowledgeNoteId] = useState<
    string | null
  >(null);
  const [expandedKnowledgeFolders, setExpandedKnowledgeFolders] = useState<
    string[]
  >([]);
  const [knowledgeNoteBodies, setKnowledgeNoteBodies] = useState<
    Record<string, string>
  >({});
  const [loadingKnowledgeNoteId, setLoadingKnowledgeNoteId] = useState<
    string | null
  >(null);
  const [knowledgeNoteError, setKnowledgeNoteError] = useState<string | null>(
    null,
  );
  const [editingKnowledgeNoteId, setEditingKnowledgeNoteId] = useState<
    string | null
  >(null);
  const [knowledgeBodyDraft, setKnowledgeBodyDraft] = useState("");
  const [isSavingKnowledgeNote, setIsSavingKnowledgeNote] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [metadataDraft, setMetadataDraft] = useState<AssetMetadataDraft | null>(
    null,
  );
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [bodyDraft, setBodyDraft] = useState("");
  const [isSavingBody, setIsSavingBody] = useState(false);
  const [bodyOverrides, setBodyOverrides] = useState<Record<string, string>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    tone: "success" | "info" | "warn";
  } | null>(null);
  const knowledgeAssets = snapshot.knowledgeAssets;
  const sections = useMemo(() => getAssetSections(snapshot), [snapshot]);
  const reusableModuleItems = useMemo(
    () => getReusableModuleItems(snapshot.reusableModules),
    [snapshot.reusableModules],
  );
  const activePrimarySection = getPrimarySection(activeSection);
  const knowledgeBaseTone = getKnowledgeBaseTone(
    snapshot.knowledgeBase.cliStatus,
  );
  const isReusableModuleSection = isCodeCategory(activeSection);
  const isLibrarySection = isKnowledgeStage(activeSection);
  const isMaterialSection = isMaterialCategory(activeSection);
  const currentItems = isLibrarySection ? sections[activeSection] : [];
  const visibleItems = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    const searchedItems = search
      ? currentItems.filter((item) =>
          [
            item.title,
            item.summary,
            item.detailSummary,
            item.sceneLabel,
            item.sourceLabel,
            item.typeLabel,
          ].some((value) => value.toLowerCase().includes(search)),
        )
      : currentItems;

    if (sortMode === "usage") {
      return [...searchedItems].sort((left, right) => {
        if (right.usageCount !== left.usageCount) {
          return right.usageCount - left.usageCount;
        }
        return left.title.localeCompare(right.title, "zh-CN");
      });
    }

    if (sortMode === "name") {
      return [...searchedItems].sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      );
    }

    return searchedItems;
  }, [assetSearch, currentItems, sortMode]);
  const selectedItem = isLibrarySection
    ? (visibleItems.find((item) => item.id === selectedIds[activeSection]) ??
      visibleItems[0] ??
      null)
    : null;
  const referencedItemCount = visibleItems.filter(
    (item) => item.usageCount > 0,
  ).length;
  const visibleMaterialAssets = useMemo(() => {
    const currentMaterialCategory = isMaterialCategory(activeSection)
      ? activeSection
      : materialAssetCategories[0];
    const search = materialSearch.trim().toLowerCase();
    const categoryItems = snapshot.materialAssets.filter(
      (item) => item.typeLabel === currentMaterialCategory,
    );
    const searchedItems = search
      ? categoryItems.filter((item) =>
          [
            item.title,
            item.summary,
            item.typeLabel,
            item.sourceLabel,
            item.relativePath,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search),
        )
      : categoryItems;

    if (sortMode === "name") {
      return [...searchedItems].sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      );
    }

    if (sortMode === "usage") {
      return [...searchedItems].sort(
        (left, right) =>
          Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt),
      );
    }

    return [...searchedItems].sort(
      (left, right) =>
        Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt),
    );
  }, [activeSection, materialSearch, snapshot.materialAssets, sortMode]);
  const selectedMaterialAsset =
    visibleMaterialAssets.find(
      (item) =>
        item.id === (isMaterialCategory(activeSection) ? selectedIds[activeSection] : undefined),
    ) ??
    visibleMaterialAssets[0] ??
    null;
  const selectedMaterialActionLabel =
    selectedMaterialAsset?.actionLabel ??
    (selectedMaterialAsset?.sourceKind === "external" ? "打开来源" : "在知识库中打开");
  const visibleReusableModules = useMemo(() => {
    const currentCodeCategory = isCodeCategory(activeSection)
      ? activeSection
      : codeAssetCategories[0];
    const search = moduleSearch.trim().toLowerCase();
    const categoryItems = reusableModuleItems.filter(
      (item) => item.codeCategory === currentCodeCategory,
    );
    const searchedItems = search
      ? categoryItems.filter((item) =>
          [
            item.title,
            item.summary,
            item.usageGuide,
            item.codeCategory,
            item.sourceTypeLabel,
            item.tags.join(" "),
            item.recommendedSectors.join(" "),
            item.installCommand ?? "",
            item.importPath ?? "",
            item.sourceLocator ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(search),
        )
      : categoryItems;

    if (sortMode === "usage") {
      return [...searchedItems].sort((left, right) => {
        if (right.usageCount !== left.usageCount) {
          return right.usageCount - left.usageCount;
        }
        return left.title.localeCompare(right.title, "zh-CN");
      });
    }

    if (sortMode === "name") {
      return [...searchedItems].sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      );
    }

    return [...searchedItems].sort((left, right) => {
      const leftScore = left.score ?? -1;
      const rightScore = right.score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }

      return left.title.localeCompare(right.title, "zh-CN");
    });
  }, [activeSection, moduleSearch, reusableModuleItems, sortMode]);
  const selectedReusableModule =
    visibleReusableModules.find(
      (item) => item.id === (isCodeCategory(activeSection) ? selectedIds[activeSection] : undefined),
    ) ??
    visibleReusableModules[0] ??
    null;
  const linkedReusableModuleCount = visibleReusableModules.filter(
    (item) => item.linkedReason,
  ).length;
  const visibleKnowledgeNotes = useMemo(() => {
    const search = knowledgeSearch.trim().toLowerCase();
    const sourceNotes = snapshot.knowledgeBase.notes;

    if (!search) {
      return sourceNotes;
    }

    return sourceNotes.filter((note) =>
      [
        note.title,
        note.excerpt,
        note.folder,
        note.relativePath,
        note.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [knowledgeSearch, snapshot.knowledgeBase.notes]);
  const knowledgeTree = useMemo(
    () => buildKnowledgeTree(visibleKnowledgeNotes),
    [visibleKnowledgeNotes],
  );
  const allKnowledgeFolderIds = useMemo(
    () => collectKnowledgeFolderIds(knowledgeTree.folders),
    [knowledgeTree],
  );
  const selectedKnowledgeNote =
    visibleKnowledgeNotes.find((note) => note.id === selectedKnowledgeNoteId) ??
    visibleKnowledgeNotes[0] ??
    null;
  const selectedKnowledgeNoteBody = selectedKnowledgeNote
    ? knowledgeNoteBodies[selectedKnowledgeNote.id] ?? ""
    : "";
  const isEditingSelectedKnowledgeNote =
    Boolean(selectedKnowledgeNote) &&
    editingKnowledgeNoteId === selectedKnowledgeNote?.id;
  const isEditingSelectedItem =
    Boolean(selectedItem) &&
    selectedItem?.id === editingAssetId &&
    Boolean(metadataDraft);
  const isSavingAssetEdit = isSavingMetadata || isSavingBody;
  const selectedItemMarkdownBody = selectedItem
    ? bodyOverrides[selectedItem.id] ?? selectedItem.markdownBody
    : "";
  const knowledgeStageCounts = useMemo(
    () =>
      Object.fromEntries(
        forgeAssetLibraryStages.map((stage) => [stage, sections[stage].length]),
      ) as Record<ForgeAssetLibraryStage, number>,
    [sections],
  );
  const codeCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        codeAssetCategories.map((category) => [
          category,
          reusableModuleItems.filter((item) => item.codeCategory === category).length,
        ]),
      ) as Record<CodeAssetCategory, number>,
    [reusableModuleItems],
  );
  const materialCategoryCounts = useMemo(
    () =>
      Object.fromEntries(
        materialAssetCategories.map((category) => [
          category,
          snapshot.materialAssets.filter((item) => item.typeLabel === category).length,
        ]),
      ) as Record<MaterialAssetCategory, number>,
    [snapshot.materialAssets],
  );

  const focusKnowledgeAssets = (nextStage?: ForgeAssetLibraryStage) => {
    if (!nextStage && expandedPrimarySection === "知识类资产") {
      setExpandedPrimarySection(null);
      return;
    }

    const targetStage =
      nextStage ??
      (isKnowledgeStage(activeSection) ? activeSection : undefined) ??
      forgeAssetLibraryStages.find((stage) => knowledgeStageCounts[stage] > 0) ??
      "立项起盘";

    setExpandedPrimarySection("知识类资产");
    setActiveSection(targetStage);
  };

  const focusCodeAssets = (nextCategory?: CodeAssetCategory) => {
    if (!nextCategory && expandedPrimarySection === "代码类资产") {
      setExpandedPrimarySection(null);
      return;
    }

    const targetCategory =
      nextCategory ??
      (isCodeCategory(activeSection) ? activeSection : undefined) ??
      codeAssetCategories.find((category) => codeCategoryCounts[category] > 0) ??
      "基础能力";

    setExpandedPrimarySection("代码类资产");
    setActiveSection(targetCategory);
  };

  const focusMaterialAssets = (nextCategory?: MaterialAssetCategory) => {
    if (!nextCategory && expandedPrimarySection === "素材类资产") {
      setExpandedPrimarySection(null);
      return;
    }

    const targetCategory =
      nextCategory ??
      (isMaterialCategory(activeSection) ? activeSection : undefined) ??
      materialAssetCategories.find((category) => materialCategoryCounts[category] > 0) ??
      "设计效果图";

    setExpandedPrimarySection("素材类资产");
    setActiveSection(targetCategory);
  };
  const hasPlannedMaterialMetrics = snapshot.materialAssets.length === 0;
  const hasPlannedCodeMetrics = snapshot.reusableModules.total === 0;
  const overviewMaterialCategoryCounts = hasPlannedMaterialMetrics
    ? plannedMaterialCategoryCounts
    : materialCategoryCounts;
  const overviewCodeCategoryCounts = hasPlannedCodeMetrics
    ? plannedCodeCategoryCounts
    : codeCategoryCounts;
  const overviewMaterialTotal = materialAssetCategories.reduce(
    (sum, category) => sum + overviewMaterialCategoryCounts[category],
    0,
  );
  const overviewCodeTotal = codeAssetCategories.reduce(
    (sum, category) => sum + overviewCodeCategoryCounts[category],
    0,
  );
  const knowledgeDonutSlices = forgeAssetLibraryStages.map((stage, index) => ({
    label: stage,
    count: knowledgeStageCounts[stage],
    color: ["#5da0ff", "#7e8fff", "#8d7cff", "#4cc2ff", "#4fd1b5", "#7bc96f"][index],
    onSelect: () => focusKnowledgeAssets(stage),
    ariaLabel: `查看 ${stage} 资产`,
  }));
  const materialDonutSlices = materialAssetCategories.map((category, index) => ({
    label: category,
    count: overviewMaterialCategoryCounts[category],
    color: ["#ffb347", "#ff8747", "#ffd166"][index],
    onSelect: () => focusMaterialAssets(category),
    ariaLabel: `查看 ${category} 素材`,
  }));
  const codeDonutSlices = codeAssetCategories.map((category, index) => ({
    label: category,
    count: overviewCodeCategoryCounts[category],
    color: ["#59d4a6", "#4ecdc4", "#45b7d1", "#66a6ff", "#7f8cff", "#8f6dff", "#64d98b"][index],
    onSelect: () => focusCodeAssets(category),
    ariaLabel: `查看 ${category} 模块`,
  }));

  const buildDonutBackground = (
    slices: Array<{ count: number; color: string }>,
    total: number,
  ) => {
    if (total <= 0) {
      return "conic-gradient(rgba(255,255,255,0.12) 0 100%)";
    }

    let cursor = 0;
    const parts = slices
      .filter((slice) => slice.count > 0)
      .map((slice) => {
        const start = cursor;
        cursor += (slice.count / total) * 100;
        return `${slice.color} ${start}% ${cursor}%`;
      });

    return parts.length > 0
      ? `conic-gradient(${parts.join(", ")})`
      : "conic-gradient(rgba(255,255,255,0.12) 0 100%)";
  };

  const showActionFeedback = (
    message: string,
    tone: "success" | "info" | "warn" = "info",
  ) => {
    if (actionFeedbackTimerRef.current !== null) {
      window.clearTimeout(actionFeedbackTimerRef.current);
    }
    setActionFeedback({ message, tone });
    actionFeedbackTimerRef.current = window.setTimeout(() => {
      setActionFeedback((current) =>
        current?.message === message ? null : current,
      );
      actionFeedbackTimerRef.current = null;
    }, 2200);
  };

  const focusRecommendationItem = (item: AssetRecommendationItem) => {
    const targetSection =
      snapshotLibraryStageByRecommendationItem(item, knowledgeAssets) ??
      "开发联调";

    setExpandedPrimarySection("知识类资产");
    setActiveSection(targetSection);
    setSelectedIds((current) => ({ ...current, [targetSection]: item.id }));
    showActionFeedback(`已定位到 ${item.title}`, "info");
  };

  const beginKnowledgeNoteEdit = () => {
    if (!selectedKnowledgeNote) {
      return;
    }

    setEditingKnowledgeNoteId(selectedKnowledgeNote.id);
    setKnowledgeBodyDraft(selectedKnowledgeNoteBody);
    setIsSavingKnowledgeNote(false);
  };

  const cancelKnowledgeNoteEdit = () => {
    setEditingKnowledgeNoteId(null);
    setKnowledgeBodyDraft("");
    setIsSavingKnowledgeNote(false);
  };

  const saveKnowledgeNoteEdit = async () => {
    if (
      !selectedKnowledgeNote ||
      !isEditingSelectedKnowledgeNote ||
      isSavingKnowledgeNote
    ) {
      return;
    }

    const nextBody = knowledgeBodyDraft.trim();

    if (!nextBody || nextBody === selectedKnowledgeNoteBody.trim()) {
      cancelKnowledgeNoteEdit();
      return;
    }

    setIsSavingKnowledgeNote(true);

    try {
      const result = await saveForgeKnowledgeNoteContent({
        relativePath: selectedKnowledgeNote.relativePath,
        body: nextBody,
      });

      setKnowledgeNoteBodies((current) => ({
        ...current,
        [selectedKnowledgeNote.id]: result.body,
      }));
      cancelKnowledgeNoteEdit();
      showActionFeedback("已同步到知识库", "success");
      dispatchForgePageContractRefresh(["assets"]);
    } catch (error) {
      setIsSavingKnowledgeNote(false);
      showActionFeedback(
        error instanceof Error ? error.message : "同步知识库失败",
        "warn",
      );
    }
  };

  const beginAssetEdit = () => {
    if (!selectedItem) {
      return;
    }

    setEditingAssetId(selectedItem.id);
    setMetadataDraft({
      asset: selectedItem.assetEnabled,
      assetGroup:
        selectedItem.assetGroupValue ??
        defaultManagementGroupForLibraryStage(
          isKnowledgeStage(activeSection) ? activeSection : "开发联调",
        ),
      assetLabel: selectedItem.assetLabelValue ?? "",
    });
    setBodyDraft(selectedItemMarkdownBody);
    setIsSavingMetadata(false);
    setIsSavingBody(false);
  };

  const cancelAssetEdit = () => {
    setEditingAssetId(null);
    setMetadataDraft(null);
    setBodyDraft("");
    setIsSavingMetadata(false);
    setIsSavingBody(false);
  };

  const saveAssetEdit = async () => {
    if (!selectedItem || !metadataDraft || isSavingAssetEdit) {
      return;
    }

    const nextAssetGroup = metadataDraft.asset ? metadataDraft.assetGroup : null;
    const nextAssetLabel = metadataDraft.asset
      ? metadataDraft.assetLabel.trim() || null
      : null;
    const nextBody = bodyDraft.trim();

    const metadataChanged =
      metadataDraft.asset !== selectedItem.assetEnabled ||
      nextAssetGroup !== (selectedItem.assetEnabled ? selectedItem.assetGroupValue : null) ||
      nextAssetLabel !== (selectedItem.assetEnabled ? selectedItem.assetLabelValue : null);
    const bodyChanged = nextBody !== selectedItemMarkdownBody.trim();

    if (!metadataChanged && !bodyChanged) {
      cancelAssetEdit();
      return;
    }

    setIsSavingMetadata(metadataChanged);
    setIsSavingBody(bodyChanged);

    try {
      if (metadataChanged) {
        await saveForgeKnowledgeAssetMetadata({
          sourcePath: selectedItem.sourcePath,
          asset: metadataDraft.asset,
          assetGroup: nextAssetGroup,
          assetLabel: nextAssetLabel,
        });
      }

      if (bodyChanged) {
        const result = await saveForgeKnowledgeAssetContent({
          sourcePath: selectedItem.sourcePath,
          body: nextBody,
        });

        setBodyOverrides((current) => ({
          ...current,
          [selectedItem.id]: result.body,
        }));
      }

      cancelAssetEdit();
      showActionFeedback("已同步到知识库", "success");
      dispatchForgePageContractRefresh(["assets"]);
    } catch (error) {
      setIsSavingMetadata(false);
      setIsSavingBody(false);
      showActionFeedback(
        error instanceof Error ? error.message : "同步知识库失败",
        "warn",
      );
    }
  };

  useEffect(() => {
    return () => {
      if (actionFeedbackTimerRef.current !== null) {
        window.clearTimeout(actionFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setEditingAssetId(null);
    setMetadataDraft(null);
    setBodyDraft("");
    setIsSavingMetadata(false);
    setIsSavingBody(false);
  }, [selectedItem?.id]);

  useEffect(() => {
    if (allKnowledgeFolderIds.length === 0) {
      setExpandedKnowledgeFolders([]);
      return;
    }

    setExpandedKnowledgeFolders((current) => {
      if (knowledgeSearch.trim()) {
        return allKnowledgeFolderIds;
      }

      return current.length > 0 ? current : allKnowledgeFolderIds;
    });
  }, [allKnowledgeFolderIds, knowledgeSearch]);

  useEffect(() => {
    if (activeSection !== "知识库" || !selectedKnowledgeNote) {
      setLoadingKnowledgeNoteId(null);
      setKnowledgeNoteError(null);
      return;
    }

    if (knowledgeNoteBodies[selectedKnowledgeNote.id]) {
      setLoadingKnowledgeNoteId(null);
      setKnowledgeNoteError(null);
      return;
    }

    let cancelled = false;
    setKnowledgeNoteError(null);
    setLoadingKnowledgeNoteId(selectedKnowledgeNote.id);

    readForgeKnowledgeNoteContent({
      relativePath: selectedKnowledgeNote.relativePath,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setKnowledgeNoteBodies((current) => ({
          ...current,
          [selectedKnowledgeNote.id]: result.body,
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setKnowledgeNoteError(
          error instanceof Error ? error.message : "读取当前笔记失败",
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLoadingKnowledgeNoteId((current) =>
          current === selectedKnowledgeNote.id ? null : current,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    knowledgeNoteBodies,
    selectedKnowledgeNote?.id,
    selectedKnowledgeNote?.relativePath,
  ]);

  useEffect(() => {
    setEditingKnowledgeNoteId(null);
    setKnowledgeBodyDraft("");
    setIsSavingKnowledgeNote(false);
  }, [selectedKnowledgeNote?.id]);

  return (
    <ForgeConsoleShell
      activeView="assets"
      breadcrumb={[]}
      hideHeader
      showNavigation={showNavigation}
      sidebarSections={[
        {
          label: "资产分组",
          action: (
            <div className={styles.assetSidebarTree}>
              <button
                aria-label="资产总览"
                aria-pressed={activePrimarySection === "资产总览"}
                className={`${styles.assetSidebarPrimary} ${
                  activePrimarySection === "资产总览"
                    ? styles.assetSidebarPrimaryActive
                    : ""
                }`}
                onClick={() => setActiveSection("资产总览")}
                type="button"
              >
                <span className={styles.assetSidebarPrimaryText}>
                  <strong>资产总览</strong>
                </span>
                <span className={getToneBadgeClassName("info")}>
                  {snapshot.assetRecommendations.total}
                </span>
              </button>

              <div className={styles.assetSidebarGroup}>
                <button
                  aria-label="知识类资产"
                  aria-expanded={expandedPrimarySection === "知识类资产"}
                  aria-pressed={activePrimarySection === "知识类资产"}
                  className={`${styles.assetSidebarPrimary} ${
                    activePrimarySection === "知识类资产"
                      ? styles.assetSidebarPrimaryActive
                      : ""
                  }`}
                  onClick={() => focusKnowledgeAssets()}
                  type="button"
                >
                  <span className={styles.assetSidebarPrimaryLead}>
                    <span className={styles.assetSidebarCaret}>
                      {expandedPrimarySection === "知识类资产" ? "▾" : "▸"}
                    </span>
                    <span className={styles.assetSidebarPrimaryText}>
                      <strong>知识类资产</strong>
                    </span>
                  </span>
                  <span className={getToneBadgeClassName("info")}>
                    {knowledgeAssets.length}
                  </span>
                </button>
                {expandedPrimarySection === "知识类资产" ? (
                  <div className={styles.assetSidebarChildren}>
                    {forgeAssetLibraryStages.map((stage) => (
                      <button
                        aria-pressed={activeSection === stage}
                        className={`${styles.assetSidebarChild} ${
                          activeSection === stage ? styles.assetSidebarChildActive : ""
                        }`}
                        key={stage}
                        onClick={() => focusKnowledgeAssets(stage)}
                        type="button"
                      >
                        <span className={styles.assetSidebarPrimaryText}>
                          <strong>{stage}</strong>
                        </span>
                        <span className={getToneBadgeClassName("neutral")}>
                          {knowledgeStageCounts[stage]}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={styles.assetSidebarGroup}>
                <button
                  aria-label="素材类资产"
                  aria-expanded={expandedPrimarySection === "素材类资产"}
                  aria-pressed={activePrimarySection === "素材类资产"}
                  className={`${styles.assetSidebarPrimary} ${
                    activePrimarySection === "素材类资产"
                      ? styles.assetSidebarPrimaryActive
                      : ""
                  }`}
                  onClick={() => focusMaterialAssets()}
                  type="button"
                >
                  <span className={styles.assetSidebarPrimaryLead}>
                    <span className={styles.assetSidebarCaret}>
                      {expandedPrimarySection === "素材类资产" ? "▾" : "▸"}
                    </span>
                    <span className={styles.assetSidebarPrimaryText}>
                      <strong>素材类资产</strong>
                    </span>
                  </span>
                  <span className={getToneBadgeClassName("warn")}>
                    {snapshot.materialAssets.length}
                  </span>
                </button>
                {expandedPrimarySection === "素材类资产" ? (
                  <div className={styles.assetSidebarChildren}>
                    {materialAssetCategories.map((category) => (
                      <button
                        aria-pressed={activeSection === category}
                        className={`${styles.assetSidebarChild} ${
                          activeSection === category ? styles.assetSidebarChildActive : ""
                        }`}
                        key={category}
                        onClick={() => focusMaterialAssets(category)}
                        type="button"
                      >
                        <span className={styles.assetSidebarPrimaryText}>
                          <strong>{category}</strong>
                        </span>
                        <span className={getToneBadgeClassName("neutral")}>
                          {materialCategoryCounts[category]}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={styles.assetSidebarGroup}>
                <button
                  aria-label="代码类资产"
                  aria-expanded={expandedPrimarySection === "代码类资产"}
                  aria-pressed={activePrimarySection === "代码类资产"}
                  className={`${styles.assetSidebarPrimary} ${
                    activePrimarySection === "代码类资产"
                      ? styles.assetSidebarPrimaryActive
                      : ""
                  }`}
                  onClick={() => focusCodeAssets()}
                  type="button"
                >
                  <span className={styles.assetSidebarPrimaryLead}>
                    <span className={styles.assetSidebarCaret}>
                      {expandedPrimarySection === "代码类资产" ? "▾" : "▸"}
                    </span>
                    <span className={styles.assetSidebarPrimaryText}>
                      <strong>代码类资产</strong>
                    </span>
                  </span>
                  <span className={getToneBadgeClassName("good")}>
                    {snapshot.reusableModules.total}
                  </span>
                </button>
                {expandedPrimarySection === "代码类资产" ? (
                  <div className={styles.assetSidebarChildren}>
                    {codeAssetCategories.map((category) => (
                      <button
                        aria-pressed={activeSection === category}
                        className={`${styles.assetSidebarChild} ${
                          activeSection === category ? styles.assetSidebarChildActive : ""
                        }`}
                        key={category}
                        onClick={() => focusCodeAssets(category)}
                        type="button"
                      >
                        <span className={styles.assetSidebarPrimaryText}>
                          <strong>{category}</strong>
                        </span>
                        <span className={getToneBadgeClassName("neutral")}>
                          {codeCategoryCounts[category]}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                aria-label="知识库"
                aria-pressed={activePrimarySection === "知识库"}
                className={`${styles.assetSidebarPrimary} ${
                  activePrimarySection === "知识库"
                    ? styles.assetSidebarPrimaryActive
                    : ""
                }`}
                onClick={() => setActiveSection("知识库")}
                type="button"
              >
                <span className={styles.assetSidebarPrimaryText}>
                  <strong>知识库</strong>
                </span>
                {knowledgeBaseTone === "good" ? (
                  <span className={getToneBadgeClassName(knowledgeBaseTone)}>
                    已接通
                  </span>
                ) : null}
              </button>
            </div>
          ),
          items: [],
        },
      ]}
      sidebarTitle="Forge"
      contentLayout={activeSection === "知识库" ? "full-bleed" : "default"}
    >
      {activeSection === "知识库" ? (
        <section
          aria-label="知识库工作区"
          className={styles.knowledgeWorkspace}
        >
          <div className={styles.knowledgeWorkbench}>
            <aside className={styles.knowledgeExplorer}>
              <label className={styles.knowledgeSearchField}>
                <span className={styles.searchLabel}>搜索知识库</span>
                <input
                  aria-label="搜索知识库"
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  placeholder="搜索文件名、路径或标签"
                  type="search"
                  value={knowledgeSearch}
                />
              </label>
              <div
                aria-label="知识库目录"
                className={styles.knowledgeExplorerTree}
                role="tree"
              >
                {knowledgeTree.folders.length > 0 || knowledgeTree.notes.length > 0 ? (
                  <>
                    {knowledgeTree.folders.map((folder) => {
                      const renderFolder = (
                        currentFolder: KnowledgeTreeFolder,
                        depth: number,
                      ) => {
                        const isExpanded = expandedKnowledgeFolders.includes(
                          currentFolder.id,
                        );

                        return (
                          <div
                            className={styles.knowledgeTreeBranch}
                            key={currentFolder.id}
                            role="none"
                          >
                            <button
                              aria-expanded={isExpanded}
                              className={`${styles.knowledgeTreeFolder} ${
                                isExpanded ? styles.knowledgeTreeFolderExpanded : ""
                              }`}
                              onClick={() =>
                                setExpandedKnowledgeFolders((current) =>
                                  current.includes(currentFolder.id)
                                    ? current.filter((item) => item !== currentFolder.id)
                                    : [...current, currentFolder.id],
                                )
                              }
                              role="treeitem"
                              style={{ "--tree-depth": depth } as React.CSSProperties}
                              type="button"
                            >
                              <span className={styles.knowledgeTreeCaret}>
                                {isExpanded ? "▾" : "▸"}
                              </span>
                              <span className={styles.knowledgeTreeFolderLabel}>
                                {currentFolder.name}
                              </span>
                            </button>
                            {isExpanded ? (
                              <div className={styles.knowledgeTreeGroup} role="group">
                                {currentFolder.folders.map((child) =>
                                  renderFolder(child, depth + 1),
                                )}
                                {currentFolder.notes.map((note) => (
                                  <button
                                    key={note.id}
                                    aria-label={note.title}
                                    aria-selected={selectedKnowledgeNote?.id === note.id}
                                    className={`${styles.knowledgeTreeNote} ${
                                      selectedKnowledgeNote?.id === note.id
                                        ? styles.knowledgeTreeNoteActive
                                        : ""
                                    }`}
                                    onClick={() => setSelectedKnowledgeNoteId(note.id)}
                                    role="treeitem"
                                    style={
                                      {
                                        "--tree-depth": depth + 1,
                                      } as React.CSSProperties
                                    }
                                    type="button"
                                  >
                                    <span className={styles.knowledgeTreeNoteIcon}>
                                      •
                                    </span>
                                    <span className={styles.knowledgeTreeNoteLabel}>
                                      {note.title}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      };

                      return renderFolder(folder, 0);
                    })}
                    {knowledgeTree.notes.map((note) => (
                      <button
                        key={note.id}
                        aria-label={note.title}
                        aria-selected={selectedKnowledgeNote?.id === note.id}
                        className={`${styles.knowledgeTreeNote} ${
                          selectedKnowledgeNote?.id === note.id
                            ? styles.knowledgeTreeNoteActive
                            : ""
                        }`}
                        onClick={() => setSelectedKnowledgeNoteId(note.id)}
                        role="treeitem"
                        style={{ "--tree-depth": 0 } as React.CSSProperties}
                        type="button"
                      >
                        <span className={styles.knowledgeTreeNoteIcon}>•</span>
                        <span className={styles.knowledgeTreeNoteLabel}>
                          {note.title}
                        </span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className={styles.emptyListState}>
                    <h4>没有找到匹配笔记</h4>
                    <p>换个关键词，或者继续整理知识目录后再回来查看。</p>
                  </div>
                )}
              </div>
            </aside>

            <article className={styles.knowledgePreviewPane}>
              {selectedKnowledgeNote ? (
                <div className={styles.knowledgePreviewBody}>
                  <div className={styles.knowledgeDocumentHeader}>
                    <div className={styles.knowledgeDocumentHeading}>
                      <p className={styles.knowledgePreviewPath}>
                        {selectedKnowledgeNote.relativePath}
                      </p>
                      <h3>{selectedKnowledgeNote.title}</h3>
                    </div>
                    <div className={styles.knowledgeDocumentActions}>
                      <span className={styles.knowledgeDocumentMeta}>
                        {formatTimestamp(selectedKnowledgeNote.modifiedAt)}
                      </span>
                      <button
                        aria-label="编辑当前笔记"
                        className={styles.detailIconButton}
                        disabled={loadingKnowledgeNoteId === selectedKnowledgeNote.id}
                        onClick={beginKnowledgeNoteEdit}
                        title="编辑当前笔记"
                        type="button"
                      >
                        ✎
                      </button>
                      <a
                        aria-label={`在知识库中打开 ${selectedKnowledgeNote.title}`}
                        className={styles.detailIconButton}
                        href={selectedKnowledgeNote.openUri || knowledgeBaseHref}
                        title="在知识库中打开"
                      >
                        ↗
                      </a>
                    </div>
                  </div>
                  <div
                    className={styles.knowledgeDocumentBody}
                    data-testid="knowledge-note-body"
                  >
                    {loadingKnowledgeNoteId === selectedKnowledgeNote.id ? (
                      <p className={styles.obsidianEmpty}>
                        正在从知识库读取当前笔记...
                      </p>
                    ) : knowledgeNoteError ? (
                      <p className={styles.obsidianEmpty}>{knowledgeNoteError}</p>
                    ) : isEditingSelectedKnowledgeNote ? (
                      <section className={styles.metadataEditorCard}>
                        <div className={styles.metadataEditorHeader}>
                          <div>
                            <strong>编辑当前笔记</strong>
                            <p>会把 Markdown 正文直接同步回知识库。</p>
                          </div>
                        </div>
                        <label className={styles.markdownEditorField}>
                          <span className={styles.searchLabel}>
                            编辑知识库 Markdown 正文
                          </span>
                          <textarea
                            aria-label="编辑知识库 Markdown 正文"
                            className={styles.markdownEditorTextarea}
                            onChange={(event) =>
                              setKnowledgeBodyDraft(event.target.value)
                            }
                            value={knowledgeBodyDraft}
                          />
                        </label>
                        <div className={styles.metadataEditorActions}>
                          <button
                            className={shellStyles.primaryButton}
                            disabled={
                              isSavingKnowledgeNote || !knowledgeBodyDraft.trim()
                            }
                            onClick={() => {
                              void saveKnowledgeNoteEdit();
                            }}
                            type="button"
                          >
                            保存到知识库
                          </button>
                          <button
                            className={shellStyles.secondaryButton}
                            disabled={isSavingKnowledgeNote}
                            onClick={cancelKnowledgeNoteEdit}
                            type="button"
                          >
                            取消
                          </button>
                        </div>
                      </section>
                    ) : selectedKnowledgeNoteBody ? (
                      renderObsidianPreview(
                        selectedKnowledgeNoteBody,
                        selectedKnowledgeNote.title,
                      )
                    ) : (
                      <p className={styles.obsidianEmpty}>
                        当前笔记还没有可展示的正文内容。
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <h4>知识库暂时为空</h4>
                  <p>
                    当前还没有同步到可预览的笔记，继续整理知识库后再回来查看。
                  </p>
                </div>
              )}
            </article>
          </div>
        </section>
      ) : activeSection === "资产总览" ? (
        <section className={shellStyles.card}>
          <article
            className={styles.assetStrategyPanel}
            aria-label="资产总览仪表盘"
          >
            <div className={styles.assetStrategyHeader}>
              <div>
                <p className={styles.knowledgePaneLabel}>项目资产</p>
                <h3>资产总览仪表盘</h3>
                <p className={styles.assetStrategySummary}>
                  {snapshot.assetRecommendations.project
                    ? `当前聚焦 ${snapshot.assetRecommendations.project.name}。`
                    : "按资产类型快速看版图。"}
                </p>
              </div>
              <div className={styles.assetStrategyActions}>
                <span className={getToneBadgeClassName(knowledgeBaseTone)}>
                  {knowledgeBaseTone === "good" ? "知识库已接通" : snapshot.knowledgeBase.cliStatus}
                </span>
                <button
                  aria-label="打开知识库"
                  className={styles.assetDashboardAction}
                  onClick={() => setActiveSection("知识库")}
                  type="button"
                >
                  打开知识库
                </button>
              </div>
            </div>

            <div
              className={styles.assetDashboardCompact}
              data-dashboard-density="donut-readable"
              data-testid="asset-dashboard-layout"
            >
              <section className={styles.assetDashboardDonutPanel}>
                <div className={styles.assetDashboardPanelHeader}>
                  <h5>知识类资产</h5>
                  <span className={styles.summaryChip}>{knowledgeAssets.length}</span>
                </div>
                <div className={styles.assetDonutPanelBody}>
                  <div
                    className={styles.assetDonutChart}
                    data-testid="asset-donut-chart"
                    style={{
                      background: buildDonutBackground(
                        knowledgeDonutSlices,
                        knowledgeAssets.length,
                      ),
                    }}
                  >
                    <div className={styles.assetDonutHole}>
                      <strong>{knowledgeAssets.length}</strong>
                      <span>条目</span>
                    </div>
                  </div>
                  <div
                    className={`${styles.assetDonutCountList} ${styles.assetDonutCountListDense}`}
                    data-count-density="two-column"
                    data-testid="asset-count-list-knowledge"
                  >
                    {knowledgeDonutSlices.map((slice) => (
                      <button
                        key={slice.label}
                        aria-label={slice.ariaLabel}
                        className={styles.assetCountRowButton}
                        onClick={slice.onSelect}
                        type="button"
                      >
                        <span
                          className={styles.assetCountRowSwatch}
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className={styles.assetCountRowLabel}>{slice.label}</span>
                        <strong className={styles.assetCountRowValue}>{slice.count}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={styles.assetDashboardDonutPanel}>
                <div className={styles.assetDashboardPanelHeader}>
                  <h5>素材类资产</h5>
                  {hasPlannedMaterialMetrics ? (
                    <span className={styles.summaryChip}>规划态</span>
                  ) : (
                    <span className={styles.summaryChip}>{overviewMaterialTotal}</span>
                  )}
                </div>
                <div className={styles.assetDonutPanelBody}>
                  <div
                    className={styles.assetDonutChart}
                    data-testid="asset-donut-chart"
                    style={{
                      background: buildDonutBackground(
                        materialDonutSlices,
                        overviewMaterialTotal,
                      ),
                    }}
                  >
                    <div className={styles.assetDonutHole}>
                      <strong>{overviewMaterialTotal}</strong>
                      <span>素材</span>
                    </div>
                  </div>
                  <div
                    className={`${styles.assetDonutCountList} ${styles.assetDonutCountListSingle}`}
                    data-count-density="single-column"
                    data-testid="asset-count-list-material"
                  >
                    {materialDonutSlices.map((slice) => (
                      <button
                        key={slice.label}
                        aria-label={slice.ariaLabel}
                        className={styles.assetCountRowButton}
                        onClick={slice.onSelect}
                        type="button"
                      >
                        <span
                          className={styles.assetCountRowSwatch}
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className={styles.assetCountRowLabel}>{slice.label}</span>
                        <strong className={styles.assetCountRowValue}>{slice.count}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className={styles.assetDashboardDonutPanel}>
                <div className={styles.assetDashboardPanelHeader}>
                  <h5>代码类资产</h5>
                  {hasPlannedCodeMetrics ? (
                    <span className={styles.summaryChip}>规划态</span>
                  ) : (
                    <span className={styles.summaryChip}>{overviewCodeTotal}</span>
                  )}
                </div>
                <div className={styles.assetDonutPanelBody}>
                  <div
                    className={styles.assetDonutChart}
                    data-testid="asset-donut-chart"
                    style={{
                      background: buildDonutBackground(codeDonutSlices, overviewCodeTotal),
                    }}
                  >
                    <div className={styles.assetDonutHole}>
                      <strong>{overviewCodeTotal}</strong>
                      <span>模块</span>
                    </div>
                  </div>
                  <div
                    className={`${styles.assetDonutCountList} ${styles.assetDonutCountListDense}`}
                    data-count-density="two-column"
                    data-testid="asset-count-list-code"
                  >
                    {codeDonutSlices.map((slice) => (
                      <button
                        key={slice.label}
                        aria-label={slice.ariaLabel}
                        className={styles.assetCountRowButton}
                        onClick={slice.onSelect}
                        type="button"
                      >
                        <span
                          className={styles.assetCountRowSwatch}
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className={styles.assetCountRowLabel}>{slice.label}</span>
                        <strong className={styles.assetCountRowValue}>{slice.count}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

            </div>
          </article>
        </section>
      ) : isMaterialSection ? (
        <section className={shellStyles.card}>
          <div className={styles.libraryLayout}>
            <article className={styles.libraryPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>素材列表</h3>
                  <p className={styles.panelSubheading}>
                    集中查看设计效果图、原型图和图片素材。
                  </p>
                </div>
                <span className={getToneBadgeClassName("warn")}>
                  {visibleMaterialAssets.length}
                </span>
              </div>

              <div className={styles.panelToolbar}>
                <label className={styles.searchField}>
                  <span className={styles.searchLabel}>搜索素材</span>
                  <input
                    aria-label="搜索素材"
                    onChange={(event) => setMaterialSearch(event.target.value)}
                    placeholder="搜索文件名、目录或素材类型"
                    type="search"
                    value={materialSearch}
                  />
                </label>
                <label className={styles.sortField}>
                  <span className={styles.searchLabel}>排序方式</span>
                  <select
                    aria-label="排序方式"
                    onChange={(event) =>
                      setSortMode(event.target.value as AssetSortMode)
                    }
                    value={sortMode}
                  >
                    {assetSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.panelSummary}>
                <p>
                  当前分类 <strong>{isMaterialCategory(activeSection) ? activeSection : "设计效果图"}</strong>
                </p>
                <div className={styles.summaryChips}>
                  <span className={styles.summaryChip}>
                    命中 {visibleMaterialAssets.length}
                  </span>
                </div>
              </div>

              <div className={styles.libraryList}>
                {visibleMaterialAssets.length > 0 ? (
                  visibleMaterialAssets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedMaterialAsset?.id === item.id}
                      className={`${styles.libraryRow} ${
                        selectedMaterialAsset?.id === item.id
                          ? styles.libraryRowActive
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedIds((current) => ({
                          ...current,
                          [isMaterialCategory(activeSection) ? activeSection : "设计效果图"]: item.id,
                        }))
                      }
                    >
                      <div className={styles.libraryRowHead}>
                        <strong>{item.title}</strong>
                        <span className={getToneBadgeClassName("warn")}>
                          {item.typeLabel}
                        </span>
                      </div>
                      <div className={styles.libraryRowMeta}>
                        <span>{item.sourceLabel}</span>
                        <span>{formatTimestamp(item.modifiedAt)}</span>
                      </div>
                      <p>{item.summary}</p>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyListState}>
                    <h4>当前还没有素材资产</h4>
                    <p>先把设计图、原型图或效果图沉到知识库附件目录里。</p>
                  </div>
                )}
              </div>
            </article>

            <article className={`${styles.libraryPanel} ${styles.libraryDetailPanel}`}>
              {selectedMaterialAsset ? (
                <div
                  className={`${styles.libraryDetail} ${styles.materialDetail}`}
                  data-detail-layout="expanded"
                >
                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.detailHeaderEyebrow}>
                        素材类资产 · {selectedMaterialAsset.typeLabel}
                      </p>
                      <h4>{selectedMaterialAsset.title}</h4>
                    </div>
                    <div
                      className={styles.detailHeaderActions}
                      data-action-alignment="center"
                    >
                      <a
                        aria-label={`${selectedMaterialActionLabel} ${selectedMaterialAsset.title}`}
                        className={styles.detailIconButton}
                        href={selectedMaterialAsset.openUri || knowledgeBaseHref}
                        target={
                          selectedMaterialAsset.sourceKind === "external" ? "_blank" : undefined
                        }
                        rel={
                          selectedMaterialAsset.sourceKind === "external"
                            ? "noreferrer"
                            : undefined
                        }
                        title={selectedMaterialActionLabel}
                      >
                        ↗
                      </a>
                    </div>
                  </div>

                  <section className={styles.moduleHeroCard}>
                    <p className={styles.moduleLead}>{selectedMaterialAsset.summary}</p>
                    <div className={styles.summaryChips}>
                      <span className={styles.summaryChip}>
                        {selectedMaterialAsset.sourceLabel}
                      </span>
                      <span className={styles.summaryChip}>
                        {formatTimestamp(selectedMaterialAsset.modifiedAt)}
                      </span>
                    </div>
                  </section>

                  <div className={styles.materialPreviewFrame}>
                    <img
                      alt={selectedMaterialAsset.title}
                      className={styles.materialPreviewImage}
                      src={selectedMaterialAsset.previewSrc}
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <h4>当前还没有可预览素材</h4>
                  <p>先在左侧素材列表选择一张图片，或者补充新的设计附件。</p>
                </div>
              )}
            </article>
          </div>
        </section>
      ) : isReusableModuleSection ? (
        <section className={shellStyles.card}>
          <div className={styles.libraryLayout}>
            <article className={styles.libraryPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>复用模块列表</h3>
                  <p className={styles.panelSubheading}>
                    先装配现成模块，再只写项目自己的胶水层。
                  </p>
                </div>
                <span className={getToneBadgeClassName("good")}>
                  {visibleReusableModules.length}
                </span>
              </div>

              <div className={styles.panelToolbar}>
                <label className={styles.searchField}>
                  <span className={styles.searchLabel}>搜索复用模块</span>
                  <input
                    aria-label="搜索复用模块"
                    onChange={(event) => setModuleSearch(event.target.value)}
                    placeholder="搜索模块名、能力或接入命令"
                    type="search"
                    value={moduleSearch}
                  />
                </label>
                <label className={styles.sortField}>
                  <span className={styles.searchLabel}>排序方式</span>
                  <select
                    aria-label="排序方式"
                    onChange={(event) =>
                      setSortMode(event.target.value as AssetSortMode)
                    }
                    value={sortMode}
                  >
                    {assetSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.panelSummary}>
                <p>
                  当前分类 <strong>{isCodeCategory(activeSection) ? activeSection : "基础能力"}</strong>
                </p>
                <div className={styles.summaryChips}>
                  <span className={styles.summaryChip}>
                    命中 {visibleReusableModules.length}
                  </span>
                  <span className={styles.summaryChip}>
                    已接入 {linkedReusableModuleCount}
                  </span>
                  <span className={styles.summaryChip}>
                    {snapshot.reusableModules.project?.name ?? "未绑定项目"}
                  </span>
                </div>
              </div>

              <div className={styles.libraryList}>
                {visibleReusableModules.length > 0 ? (
                  visibleReusableModules.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedReusableModule?.id === item.id}
                      className={`${styles.libraryRow} ${
                        selectedReusableModule?.id === item.id
                          ? styles.libraryRowActive
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedIds((current) => ({
                          ...current,
                          [activeSection]: item.id,
                        }))
                      }
                    >
                      <div className={styles.libraryRowHead}>
                        <strong>{item.title}</strong>
                        <span className={getToneBadgeClassName(item.tone)}>
                          {item.codeCategory}
                        </span>
                      </div>
                      <div className={styles.libraryRowMeta}>
                        <span>{item.sourceTypeLabel}</span>
                        <span>
                          {item.score !== null ? `推荐度 ${item.score}` : "已收录"}
                        </span>
                        <span>{item.statusLabel}</span>
                      </div>
                      <p>{item.summary}</p>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyListState}>
                    <h4>没有找到匹配模块</h4>
                    <p>换个关键词，或者先补齐复用模块的装配合同。</p>
                  </div>
                )}
              </div>
            </article>

            <article className={`${styles.libraryPanel} ${styles.libraryDetailPanel}`}>
              {selectedReusableModule ? (
                <div
                  className={`${styles.libraryDetail} ${styles.reusableModuleDetail}`}
                  data-detail-layout="expanded"
                >
                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.detailHeaderEyebrow}>
                        {selectedReusableModule.codeCategory}
                        {selectedReusableModule.sourceTypeLabel
                          ? ` · ${selectedReusableModule.sourceTypeLabel}`
                          : ""}
                      </p>
                      <h4>{selectedReusableModule.title}</h4>
                    </div>
                    <div className={styles.reusableModuleSignals}>
                      {selectedReusableModule.deliveryModeLabel ? (
                        <span className={styles.summaryChip}>
                          {selectedReusableModule.deliveryModeLabel}
                        </span>
                      ) : null}
                      <span className={getToneBadgeClassName(selectedReusableModule.tone)}>
                        {selectedReusableModule.statusLabel}
                      </span>
                    </div>
                  </div>

                  <section className={styles.moduleHeroCard}>
                    <p className={styles.moduleLead}>{selectedReusableModule.summary}</p>
                    <p className={styles.moduleUsageGuide}>
                      {selectedReusableModule.usageGuide}
                    </p>
                    <div className={styles.summaryChips}>
                      {selectedReusableModule.recommendedSectors.map((sector) => (
                        <span className={styles.summaryChip} key={sector}>
                          {sector}
                        </span>
                      ))}
                    </div>
                  </section>

                  <div className={styles.reusableModuleGrid}>
                    <section className={styles.moduleSectionCard}>
                      <h5>安装命令</h5>
                      {selectedReusableModule.installCommand ? (
                        <pre className={styles.obsidianCodeBlock}>
                          <code>{selectedReusableModule.installCommand}</code>
                        </pre>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前模块不需要额外安装命令。</p>
                      )}
                    </section>

                    <section className={styles.moduleSectionCard}>
                      <h5>导入路径</h5>
                      {selectedReusableModule.importPath ? (
                        <pre className={styles.obsidianCodeBlock}>
                          <code>{selectedReusableModule.importPath}</code>
                        </pre>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前还没有固化导入路径。</p>
                      )}
                    </section>
                  </div>

                  <div className={styles.reusableModuleGrid}>
                    <section className={styles.moduleSectionCard}>
                      <h5>所需环境变量</h5>
                      {selectedReusableModule.requiredEnv.length > 0 ? (
                        <div className={styles.summaryChips}>
                          {selectedReusableModule.requiredEnv.map((entry) => (
                            <span className={styles.summaryChip} key={entry}>
                              {entry}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前没有额外环境变量。</p>
                      )}
                    </section>

                    <section className={styles.moduleSectionCard}>
                      <h5>Peer 依赖</h5>
                      {selectedReusableModule.peerDeps.length > 0 ? (
                        <div className={styles.summaryChips}>
                          {selectedReusableModule.peerDeps.map((entry) => (
                            <span className={styles.summaryChip} key={entry}>
                              {entry}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前没有额外 peer 依赖。</p>
                      )}
                    </section>
                  </div>

                  <section className={styles.moduleSectionCard}>
                    <h5>接入步骤</h5>
                    {selectedReusableModule.setupSteps.length > 0 ? (
                      <ol className={styles.moduleStepList}>
                        {selectedReusableModule.setupSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className={styles.moduleEmptyValue}>当前还没有固化接入步骤。</p>
                    )}
                  </section>

                  <div className={styles.reusableModuleGrid}>
                    <section className={styles.moduleSectionCard}>
                      <h5>冒烟命令</h5>
                      {selectedReusableModule.smokeTestCommand ? (
                        <pre className={styles.obsidianCodeBlock}>
                          <code>{selectedReusableModule.smokeTestCommand}</code>
                        </pre>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前没有冒烟命令。</p>
                      )}
                    </section>

                    <section className={styles.moduleSectionCard}>
                      <h5>受影响路径</h5>
                      {selectedReusableModule.ownedPaths.length > 0 ? (
                        <div className={styles.summaryChips}>
                          {selectedReusableModule.ownedPaths.map((path) => (
                            <span className={styles.summaryChip} key={path}>
                              {path}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.moduleEmptyValue}>当前没有登记受影响路径。</p>
                      )}
                    </section>
                  </div>

                  {selectedReusableModule.suggestionReason ||
                  selectedReusableModule.linkedReason ? (
                    <section className={styles.moduleSectionCard}>
                      <h5>当前项目建议</h5>
                      {selectedReusableModule.suggestionReason ? (
                        <p>{selectedReusableModule.suggestionReason}</p>
                      ) : null}
                      {selectedReusableModule.linkedReason ? (
                        <p className={styles.moduleLinkedHint}>
                          已接入原因：{selectedReusableModule.linkedReason}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <h4>暂无复用模块</h4>
                  <p>当前还没有能直接装配到项目里的代码模块。</p>
                </div>
              )}
            </article>
          </div>
        </section>
      ) : (
        <section className={shellStyles.card}>
          <div className={styles.libraryLayout}>
            <article className={styles.libraryPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3>资料列表</h3>
                  <p className={styles.panelSubheading}>
                    先筛资料，再看引用关系，最后回到对应项目推进接入。
                  </p>
                </div>
                <span className={getToneBadgeClassName("neutral")}>
                  {visibleItems.length}
                </span>
              </div>

              <div className={styles.panelToolbar}>
                <label className={styles.searchField}>
                  <span className={styles.searchLabel}>搜索资料</span>
                  <input
                    aria-label="搜索资料"
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder={`搜索${activeSection}`}
                    type="search"
                    value={assetSearch}
                  />
                </label>
                <label className={styles.sortField}>
                  <span className={styles.searchLabel}>排序方式</span>
                  <select
                    aria-label="排序方式"
                    onChange={(event) =>
                      setSortMode(event.target.value as AssetSortMode)
                    }
                    value={sortMode}
                  >
                    {assetSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.panelSummary}>
                <p>
                  当前分组 <strong>{activeSection}</strong>
                </p>
                <div className={styles.summaryChips}>
                  <span className={styles.summaryChip}>
                    命中 {visibleItems.length}
                  </span>
                  <span className={styles.summaryChip}>
                    已被项目引用 {referencedItemCount}
                  </span>
                </div>
              </div>

              <div className={styles.libraryList}>
                {visibleItems.length > 0 ? (
                  visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedItem?.id === item.id}
                      className={`${styles.libraryRow} ${selectedItem?.id === item.id ? styles.libraryRowActive : ""}`}
                      onClick={() =>
                        setSelectedIds((current) => ({
                          ...current,
                          [activeSection]: item.id,
                        }))
                      }
                    >
                      <div className={styles.libraryRowHead}>
                        <strong>{item.title}</strong>
                        <span className={getToneBadgeClassName(item.tone)}>
                          {item.typeLabel}
                        </span>
                      </div>
                      <div className={styles.libraryRowMeta}>
                        <span>{item.sceneLabel}</span>
                        <span>{item.sourceLabel}</span>
                        <span>
                          {item.usageCount > 0
                            ? `已关联 ${item.usageCount} 个项目`
                            : "待接入项目"}
                        </span>
                      </div>
                      <p>{item.summary}</p>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyListState}>
                    <h4>没有找到匹配资料</h4>
                    <p>换个关键词，或者切到别的资产分组继续找。</p>
                  </div>
                )}
              </div>
            </article>

            <article className={`${styles.libraryPanel} ${styles.libraryDetailPanel}`}>
              {selectedItem ? (
                <div
                  className={styles.libraryDetail}
                  data-detail-layout="expanded"
                  data-testid="asset-detail-layout"
                >
                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.detailHeaderEyebrow}>
                        {selectedItem.typeLabel}
                        {selectedItem.sourceLabel
                          ? ` · ${selectedItem.sourceLabel}`
                          : ""}
                      </p>
                      <h4>{selectedItem.title}</h4>
                    </div>
                    <div
                      className={styles.detailHeaderActions}
                      data-action-alignment="center"
                    >
                      <button
                        aria-label="编辑资料"
                        className={styles.detailIconButton}
                        onClick={beginAssetEdit}
                        title="编辑资料"
                        type="button"
                      >
                        <span aria-hidden="true">✎</span>
                      </button>
                      {selectedItem.externalHref ? (
                        <a
                          aria-label={`${selectedItem.externalActionLabel ?? "打开"} ${selectedItem.title}`}
                          className={styles.detailIconButton}
                          href={selectedItem.externalHref}
                          title={selectedItem.externalActionLabel ?? "打开"}
                        >
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {isEditingSelectedItem && metadataDraft ? (
                    <section className={styles.metadataEditorCard}>
                      <div className={styles.metadataEditorHeader}>
                        <div>
                          <strong>编辑资料</strong>
                          <p>会同时把资产元信息和 Markdown 正文同步回知识库。</p>
                        </div>
                      </div>
                      <label className={styles.metadataEditorCheckbox}>
                        <input
                          checked={metadataDraft.asset}
                          onChange={(event) =>
                            setMetadataDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    asset: event.target.checked,
                                    assetGroup: event.target.checked
                                      ? current.assetGroup ??
                                        defaultManagementGroupForLibraryStage(
                                          isKnowledgeStage(activeSection)
                                            ? activeSection
                                            : "开发联调",
                                        )
                                      : null,
                                  }
                                : current,
                            )
                          }
                          type="checkbox"
                        />
                        <span>继续作为资产</span>
                      </label>
                      <div className={styles.metadataEditorGrid}>
                        <label className={styles.metadataEditorField}>
                          <span>资产分组</span>
                          <select
                            aria-label="资产分组"
                            disabled={!metadataDraft.asset}
                            onChange={(event) =>
                              setMetadataDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      assetGroup: event.target
                                        .value as AssetManagementGroup,
                                    }
                                  : current,
                              )
                            }
                            value={metadataDraft.assetGroup ?? ""}
                          >
                            <option value="" disabled>
                              选择分组
                            </option>
                            {assetManagementGroups.map((group) => (
                              <option key={group} value={group}>
                                {group}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.metadataEditorField}>
                          <span>资产标签</span>
                          <input
                            aria-label="资产标签"
                            disabled={!metadataDraft.asset}
                            onChange={(event) =>
                              setMetadataDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      assetLabel: event.target.value,
                                    }
                                  : current,
                              )
                            }
                            placeholder="比如：共享启动模板"
                            type="text"
                            value={metadataDraft.assetLabel}
                          />
                        </label>
                      </div>
                      <label className={styles.markdownEditorField}>
                        <span className={styles.searchLabel}>
                          编辑 Markdown 正文
                        </span>
                        <textarea
                          aria-label="编辑 Markdown 正文"
                          className={styles.markdownEditorTextarea}
                          onChange={(event) => setBodyDraft(event.target.value)}
                          value={bodyDraft}
                        />
                      </label>
                      <div className={styles.metadataEditorActions}>
                        <button
                          className={shellStyles.primaryButton}
                          disabled={
                            isSavingAssetEdit ||
                            !bodyDraft.trim() ||
                            (metadataDraft.asset && !metadataDraft.assetGroup)
                          }
                          onClick={() => {
                            void saveAssetEdit();
                          }}
                          type="button"
                        >
                          保存到知识库
                        </button>
                        <button
                          className={shellStyles.secondaryButton}
                          disabled={isSavingAssetEdit}
                          onClick={cancelAssetEdit}
                          type="button"
                        >
                          取消
                        </button>
                      </div>
                    </section>
                  ) : (
                    <article className={styles.obsidianPreviewCard}>
                      <div
                        className={styles.obsidianPreviewBody}
                        data-preview-density="roomy"
                        data-testid="asset-preview-body"
                      >
                        {renderObsidianPreview(
                          selectedItemMarkdownBody,
                          selectedItem.title,
                        )}
                      </div>
                    </article>
                  )}

                  {selectedItem.projectUsage.length > 0 ? (
                    <section className={styles.projectUsageSection}>
                      <div className={styles.sectionBlockHeader}>
                        <h5>项目引用</h5>
                        <span className={getToneBadgeClassName("info")}>
                          {selectedItem.usageCount}
                        </span>
                      </div>

                      <div className={styles.projectUsageList}>
                        {selectedItem.projectUsage.map((usage) => (
                          <article
                            className={styles.projectUsageCard}
                            key={`${selectedItem.id}-${usage.projectId}`}
                          >
                            <div className={styles.projectUsageHead}>
                              <strong>{usage.projectName}</strong>
                              <span
                                className={getToneBadgeClassName(
                                  getUsageTone(usage.relation),
                                )}
                              >
                                {getUsageLabel(usage.relation)}
                              </span>
                            </div>
                            <p>{usage.reason}</p>
                            <div className={styles.projectUsageFoot}>
                              <span className={shellStyles.muted}>
                                {usage.usageGuide}
                              </span>
                              <Link
                                aria-label={`进入 ${usage.projectName} 项目工作台`}
                                className={shellStyles.secondaryButton}
                                href={`/projects?projectId=${encodeURIComponent(usage.projectId)}`}
                              >
                                进入项目工作台
                              </Link>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <h4>暂无资料</h4>
                  <p>当前分类还没有可供工作台与 AI 调用的资料。</p>
                </div>
              )}
            </article>
          </div>
        </section>
      )}
      {actionFeedback ? (
        <div
          aria-live="polite"
          className={`${shellStyles.floatingStatusToast} ${
            actionFeedback.tone === "info"
              ? shellStyles.floatingStatusToastInfo
              : actionFeedback.tone === "warn"
                ? shellStyles.floatingStatusToastWarn
                : ""
          }`}
          role="status"
        >
          {actionFeedback.message}
        </div>
      ) : null}
    </ForgeConsoleShell>
  );
}
