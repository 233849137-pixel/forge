import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { ForgeApiError } from "../lib/forge-ai";
import {
  replaceObsidianBody,
  stripObsidianFrontmatter,
} from "./forge-obsidian-frontmatter";
import { loadForgeObsidianKnowledgeBase } from "./forge-obsidian-kb";

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").trim();
}

function resolveKnowledgeNotePath(relativePath: string) {
  const knowledgeBase = loadForgeObsidianKnowledgeBase();

  if (!knowledgeBase.vaultPath) {
    throw new ForgeApiError(
      "当前未接通可读取的 Obsidian 知识库",
      "FORGE_NOT_FOUND",
      404,
    );
  }

  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("../") ||
    !relativePath.endsWith(".md")
  ) {
    throw new ForgeApiError("笔记路径不合法", "FORGE_VALIDATION_ERROR", 400);
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
    throw new ForgeApiError("笔记路径超出了知识库范围", "FORGE_VALIDATION_ERROR", 400);
  }

  if (!existsSync(absolutePath)) {
    throw new ForgeApiError("目标笔记不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    absolutePath,
    relativePath: relativeToVault,
  };
}

export function readForgeKnowledgeNoteContent(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const notePath = resolveKnowledgeNotePath(normalizedPath);
  const content = readFileSync(notePath.absolutePath, "utf8");

  return {
    relativePath: notePath.relativePath,
    body: stripObsidianFrontmatter(content).trimStart(),
  };
}

export function saveForgeKnowledgeNoteContent(relativePath: string, body: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const nextBody = body.trim();

  if (!nextBody) {
    throw new ForgeApiError("正文内容不能为空", "FORGE_VALIDATION_ERROR", 400);
  }

  const notePath = resolveKnowledgeNotePath(normalizedPath);
  const content = readFileSync(notePath.absolutePath, "utf8");
  const nextContent = replaceObsidianBody(content, nextBody);

  writeFileSync(notePath.absolutePath, nextContent, "utf8");

  return {
    relativePath: notePath.relativePath,
    body: nextBody,
  };
}
