import type { ForgeAssetLibraryStage } from "../lib/forge-asset-library-stage";
import type {
  ForgeComponent,
  ForgeComponentCategory,
} from "../../packages/core/src/types";

export type ForgeObsidianCliStatus = "ready" | "disabled" | "unavailable" | "error";
export type ForgeObsidianSyncMode = "cli-assisted" | "filesystem";

export type ForgeObsidianKnowledgeBaseNote = {
  id: string;
  title: string;
  relativePath: string;
  folder: string;
  excerpt: string;
  tags: string[];
  modifiedAt: string;
  wordCount: number;
  isRecent: boolean;
  openUri: string;
};

export type ForgeObsidianKnowledgeBaseData = {
  provider: "obsidian";
  vaultName: string;
  vaultPath: string;
  cliStatus: ForgeObsidianCliStatus;
  cliSummary: string;
  syncMode: ForgeObsidianSyncMode;
  syncedAt: string;
  summary: string;
  noteCount: number;
  canvasCount: number;
  topFolders: Array<{ name: string; noteCount: number }>;
  recentNotes: ForgeObsidianKnowledgeBaseNote[];
  notes: ForgeObsidianKnowledgeBaseNote[];
};

export type ForgeKnowledgeAssetUsage = {
  projectId: string;
  projectName: string;
  relation: "default" | "required" | "recommended";
  reason: string;
  usageGuide: string;
};

export type ForgeKnowledgeAsset = {
  id: string;
  title: string;
  managementGroup: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产";
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
  assetGroupValue: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产" | null;
  assetLabelValue: string | null;
};

export type ForgeMaterialAsset = {
  id: string;
  title: string;
  typeLabel: "原型图" | "设计效果图" | "图片素材";
  summary: string;
  relativePath: string;
  sourceLabel: string;
  modifiedAt: string;
  openUri: string;
  previewSrc: string;
  actionLabel?: string;
  sourceKind?: "obsidian" | "external";
};

export type ForgeAssetsPageData = {
  knowledgeBase: ForgeObsidianKnowledgeBaseData;
  knowledgeAssets: ForgeKnowledgeAsset[];
  materialAssets: ForgeMaterialAsset[];
  reusableModules: {
    project: { id: string; name: string; sector: string } | null;
    taskPack: {
      id: string;
      title: string;
    } | null;
    total: number;
    categories: ForgeComponentCategory[];
    recommendedCount: number;
    linkedCount: number;
    linkedItems: Array<{
      componentId: string;
      title: string;
      relation: string;
      reason: string;
    }>;
    usageSignals: Array<{
      componentId: string;
      title: string;
      status: string;
      statusLabel: string;
      usageCount: number;
      successCount: number;
      blockedCount: number;
      runningCount: number;
      lastRunId: string | null;
      lastRunTitle: string | null;
      lastRunState: string | null;
      lastFailureSummary: string | null;
    }>;
    assemblySuggestions: Array<{
      componentId: string;
      title: string;
      score: number;
      reason: string;
    }>;
    items: ForgeComponent[];
  };
  assetRecommendations: {
    project: { id: string; name: string; sector: string } | null;
    stage: string | null;
    taskPack: {
      id: string;
      title: string;
    } | null;
    query: string | null;
    managementGroups: Array<"启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产">;
    requiredItems: Array<{
      id: string;
      title: string;
      sourceKind:
        | "project-template"
        | "prompt-template"
        | "asset"
        | "gate"
        | "component"
        | "skill"
        | "sop"
        | "artifact"
        | "knowledge-asset";
      managementGroup: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产";
      priority: "required" | "recommended" | "reference";
      summary: string;
      reason: string;
      usageGuide: string | null;
      linked: boolean;
      score: number;
      stageTags: string[];
      sectorTags: string[];
      relation: "default" | "required" | "recommended" | null;
    }>;
    recommendedItems: Array<{
      id: string;
      title: string;
      sourceKind:
        | "project-template"
        | "prompt-template"
        | "asset"
        | "gate"
        | "component"
        | "skill"
        | "sop"
        | "artifact"
        | "knowledge-asset";
      managementGroup: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产";
      priority: "required" | "recommended" | "reference";
      summary: string;
      reason: string;
      usageGuide: string | null;
      linked: boolean;
      score: number;
      stageTags: string[];
      sectorTags: string[];
      relation: "default" | "required" | "recommended" | null;
    }>;
    referenceItems: Array<{
      id: string;
      title: string;
      sourceKind:
        | "project-template"
        | "prompt-template"
        | "asset"
        | "gate"
        | "component"
        | "skill"
        | "sop"
        | "artifact"
        | "knowledge-asset";
      managementGroup: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产";
      priority: "required" | "recommended" | "reference";
      summary: string;
      reason: string;
      usageGuide: string | null;
      linked: boolean;
      score: number;
      stageTags: string[];
      sectorTags: string[];
      relation: "default" | "required" | "recommended" | null;
    }>;
    total: number;
    items: Array<{
      id: string;
      title: string;
      sourceKind:
        | "project-template"
        | "prompt-template"
        | "asset"
        | "gate"
        | "component"
        | "skill"
        | "sop"
        | "artifact"
        | "knowledge-asset";
      managementGroup: "启动资产" | "执行资产" | "规则资产" | "证据资产" | "知识资产";
      priority: "required" | "recommended" | "reference";
      summary: string;
      reason: string;
      usageGuide: string | null;
      linked: boolean;
      score: number;
      stageTags: string[];
      sectorTags: string[];
      relation: "default" | "required" | "recommended" | null;
    }>;
  };
};
