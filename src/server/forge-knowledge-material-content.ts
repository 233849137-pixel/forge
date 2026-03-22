import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { ForgeApiError } from "../lib/forge-ai";
import { loadForgeObsidianKnowledgeBase } from "./forge-obsidian-kb";

const supportedMaterialTypes = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
]);

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").trim();
}

function resolveKnowledgeMaterialPath(relativePath: string) {
  const knowledgeBase = loadForgeObsidianKnowledgeBase();

  if (!knowledgeBase.vaultPath) {
    throw new ForgeApiError(
      "当前未接通可读取的 Obsidian 知识库",
      "FORGE_NOT_FOUND",
      404,
    );
  }

  const extension = extname(relativePath).toLowerCase();

  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("../") ||
    !supportedMaterialTypes.has(extension)
  ) {
    throw new ForgeApiError("素材路径不合法", "FORGE_VALIDATION_ERROR", 400);
  }

  const absolutePath = resolve(knowledgeBase.vaultPath, relativePath);
  const relativeToVault = normalizeRelativePath(
    relative(knowledgeBase.vaultPath, absolutePath),
  );

  if (
    !relativeToVault ||
    relativeToVault.startsWith("../") ||
    relativeToVault === ".." ||
    isAbsolute(relativeToVault)
  ) {
    throw new ForgeApiError("素材路径超出了知识库范围", "FORGE_VALIDATION_ERROR", 400);
  }

  if (!existsSync(absolutePath)) {
    throw new ForgeApiError("目标素材不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    absolutePath,
    contentType: supportedMaterialTypes.get(extension) as string,
    relativePath: relativeToVault,
  };
}

export function readForgeKnowledgeMaterialContent(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const materialPath = resolveKnowledgeMaterialPath(normalizedPath);

  return {
    relativePath: materialPath.relativePath,
    contentType: materialPath.contentType,
    body: readFileSync(materialPath.absolutePath),
  };
}
