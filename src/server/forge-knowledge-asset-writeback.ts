import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ForgeAssetRecommendationManagementGroup } from "../../packages/core/src/types";
import { ForgeApiError } from "../lib/forge-ai";
import { loadForgeObsidianKnowledgeBase } from "./forge-obsidian-kb";
import {
  replaceObsidianBody,
  updateObsidianFrontmatter
} from "./forge-obsidian-frontmatter";

export const FORGE_SHARED_ASSET_MODULE_PREFIX = "20-共享资产SharedAssets/02-通用模块/";

const ASSET_GROUP_LABELS = new Set<ForgeAssetRecommendationManagementGroup>([
  "启动资产",
  "执行资产",
  "规则资产",
  "证据资产",
  "知识资产",
]);

function normalizeSourcePath(sourcePath: string) {
  return sourcePath.replace(/\\/g, "/").trim();
}

function validateAssetGroup(
  assetGroup: string | null | undefined
): ForgeAssetRecommendationManagementGroup | null | undefined {
  if (assetGroup === undefined || assetGroup === null) {
    return assetGroup;
  }

  if (!ASSET_GROUP_LABELS.has(assetGroup as ForgeAssetRecommendationManagementGroup)) {
    throw new ForgeApiError("资产分组不合法", "FORGE_VALIDATION_ERROR", 400);
  }

  return assetGroup as ForgeAssetRecommendationManagementGroup;
}

function resolveAbsoluteNotePath(vaultPath: string, sourcePath: string) {
  const absolutePath = resolve(vaultPath, sourcePath);
  const relativeToVault = normalizeSourcePath(relative(vaultPath, absolutePath));

  if (
    !relativeToVault ||
    relativeToVault.startsWith("../") ||
    relativeToVault === ".." ||
    isAbsolute(relativeToVault)
  ) {
    throw new ForgeApiError("资产路径超出了知识库范围", "FORGE_VALIDATION_ERROR", 400);
  }

  return absolutePath;
}

export type SaveForgeKnowledgeAssetMetadataInput = {
  sourcePath: string;
  asset: boolean;
  assetGroup?: string | null;
  assetLabel?: string | null;
};

export type SaveForgeKnowledgeAssetContentInput = {
  sourcePath: string;
  body: string;
};

function resolveWritableAssetPath(sourcePath: string) {
  if (
    !sourcePath ||
    sourcePath.startsWith("/") ||
    sourcePath.includes("../") ||
    !sourcePath.endsWith(".md")
  ) {
    throw new ForgeApiError("资产路径不合法", "FORGE_VALIDATION_ERROR", 400);
  }

  if (!sourcePath.startsWith(FORGE_SHARED_ASSET_MODULE_PREFIX)) {
    throw new ForgeApiError("当前只允许维护共享通用模块资产", "FORGE_VALIDATION_ERROR", 400);
  }

  const knowledgeBase = loadForgeObsidianKnowledgeBase();

  if (!knowledgeBase.vaultPath) {
    throw new ForgeApiError("当前未接通可写入的 Obsidian 知识库", "FORGE_NOT_FOUND", 404);
  }

  const absolutePath = resolveAbsoluteNotePath(knowledgeBase.vaultPath, sourcePath);

  if (!existsSync(absolutePath)) {
    throw new ForgeApiError("目标笔记不存在", "FORGE_NOT_FOUND", 404);
  }

  return absolutePath;
}

export function saveForgeKnowledgeAssetMetadata(
  input: SaveForgeKnowledgeAssetMetadataInput
) {
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const assetGroup = validateAssetGroup(input.assetGroup);
  const assetLabel = input.assetLabel === undefined ? undefined : input.assetLabel?.trim() || null;

  if (input.asset && !assetGroup) {
    throw new ForgeApiError("继续作为资产时必须选择资产分组", "FORGE_VALIDATION_ERROR", 400);
  }
  const absolutePath = resolveWritableAssetPath(sourcePath);

  const content = readFileSync(absolutePath, "utf8");
  const nextContent = updateObsidianFrontmatter(content, {
    asset: input.asset,
    asset_group: input.asset ? assetGroup ?? null : null,
    asset_label: input.asset ? assetLabel ?? null : null,
  });

  writeFileSync(absolutePath, nextContent, "utf8");

  return {
    sourcePath,
    asset: input.asset,
    assetGroup: input.asset ? assetGroup ?? null : null,
    assetLabel: input.asset ? assetLabel ?? null : null,
  };
}

export function saveForgeKnowledgeAssetContent(
  input: SaveForgeKnowledgeAssetContentInput
) {
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const body = input.body.trim();

  if (!body) {
    throw new ForgeApiError("正文内容不能为空", "FORGE_VALIDATION_ERROR", 400);
  }

  const absolutePath = resolveWritableAssetPath(sourcePath);
  const content = readFileSync(absolutePath, "utf8");
  const nextContent = replaceObsidianBody(content, body);

  writeFileSync(absolutePath, nextContent, "utf8");

  return {
    sourcePath,
    body
  };
}
