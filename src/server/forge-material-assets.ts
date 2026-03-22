import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import type { ForgeMaterialAsset } from "../components/forge-assets-page.types";
import type { ForgeObsidianKnowledgeBaseData } from "./forge-obsidian-kb";

const materialExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
]);

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/");
}

function isExplicitMaterialAsset(relativePath: string) {
  const normalizedPath = relativePath.toLowerCase();

  if (
    /(\/|^)(设计稿|原型图|效果图|prototype|wireframe|mockup|figma|screenshot|截图)(\/|$)/i.test(
      normalizedPath,
    )
  ) {
    return true;
  }

  if (
    /(原型图|设计稿|效果图|prototype|wireframe|mockup|figma|高保真|低保真|截图)/i.test(
      basename(relativePath, extname(relativePath)),
    )
  ) {
    return true;
  }

  return false;
}

function isReferencedVisualMaterialAsset(relativePath: string, referencedPaths: Set<string>) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedPathLower = normalizedPath.toLowerCase();
  const filename = basename(normalizedPath, extname(normalizedPath));

  if (!referencedPaths.has(normalizedPath)) {
    return false;
  }

  if (/(^|\/)(test-|tests?\/)/i.test(normalizedPathLower) || /(^|-)test($|-)/i.test(filename)) {
    return false;
  }

  if (
    /(封面|对比|架构|流程|飞轮|sop|cover|compare|architecture|flow|illustration|banner|visual)/i.test(
      filename,
    )
  ) {
    return true;
  }

  return false;
}

function inferMaterialType(relativePath: string): ForgeMaterialAsset["typeLabel"] {
  if (/(原型|prototype|wireframe|figma|lowfi|lofi|高保真)/i.test(relativePath)) {
    return "原型图";
  }

  if (
    /(设计|design|视觉|效果|ui|ux|封面|banner|illustration|对比|compare|style)/i.test(
      relativePath,
    )
  ) {
    return "设计效果图";
  }

  return "图片素材";
}

function buildMaterialSummary(
  typeLabel: ForgeMaterialAsset["typeLabel"],
  sourceLabel: string,
) {
  if (typeLabel === "原型图") {
    return `用于交互结构和页面走查的原型素材，来源：${sourceLabel}。`;
  }

  if (typeLabel === "设计效果图") {
    return `用于视觉确认和风格对齐的设计素材，来源：${sourceLabel}。`;
  }

  return `当前挂在知识库附件目录下的图片素材，来源：${sourceLabel}。`;
}

function collectMaterialFiles(vaultPath: string) {
  const files: string[] = [];

  const walk = (currentPath: string) => {
    readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      if (entry.name === ".obsidian" || entry.name === "node_modules") {
        return;
      }

      const absolutePath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        return;
      }

      if (materialExtensions.has(extname(entry.name).toLowerCase())) {
        files.push(absolutePath);
      }
    });
  };

  walk(vaultPath);
  return files;
}

function collectMarkdownFiles(vaultPath: string) {
  const files: string[] = [];

  const walk = (currentPath: string) => {
    readdirSync(currentPath, { withFileTypes: true }).forEach((entry) => {
      if (entry.name === ".obsidian" || entry.name === "node_modules") {
        return;
      }

      const absolutePath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        return;
      }

      if (extname(entry.name).toLowerCase() === ".md") {
        files.push(absolutePath);
      }
    });
  };

  walk(vaultPath);
  return files;
}

function buildMaterialFileIndexes(vaultPath: string) {
  const materialFiles = collectMaterialFiles(vaultPath);
  const byBasename = new Map<string, string[]>();

  materialFiles.forEach((absolutePath) => {
    const relativePath = normalizeRelativePath(relative(vaultPath, absolutePath));
    const name = basename(relativePath).toLowerCase();
    const existing = byBasename.get(name);

    if (existing) {
      existing.push(relativePath);
      return;
    }

    byBasename.set(name, [relativePath]);
  });

  return { materialFiles, byBasename };
}

function collectReferencedMaterialPaths(
  vaultPath: string,
  byBasename: Map<string, string[]>,
) {
  const referencedPaths = new Set<string>();
  const embedPattern = /!\[\[([^|\]]+\.(?:png|jpg|jpeg|webp|gif|svg))(?:\|[^\]]*)?\]\]/gi;

  collectMarkdownFiles(vaultPath).forEach((absolutePath) => {
    const content = readFileSync(absolutePath, "utf8");

    for (const match of content.matchAll(embedPattern)) {
      const rawReference = normalizeRelativePath(match[1]?.trim() ?? "");

      if (!rawReference) {
        continue;
      }

      if (rawReference.includes("/")) {
        referencedPaths.add(rawReference);
        continue;
      }

      const candidates = byBasename.get(rawReference.toLowerCase());

      if (candidates?.length === 1) {
        referencedPaths.add(candidates[0]);
      }
    }
  });

  return referencedPaths;
}

export function buildForgeMaterialAssetsFromKnowledgeBase(
  knowledgeBase: ForgeObsidianKnowledgeBaseData,
): ForgeMaterialAsset[] {
  if (!knowledgeBase.vaultPath || !existsSync(knowledgeBase.vaultPath)) {
    return [];
  }

  const { materialFiles, byBasename } = buildMaterialFileIndexes(knowledgeBase.vaultPath);
  const referencedPaths = collectReferencedMaterialPaths(knowledgeBase.vaultPath, byBasename);

  return materialFiles
    .filter((absolutePath) => {
      const relativePath = normalizeRelativePath(
        relative(knowledgeBase.vaultPath, absolutePath),
      );

      return (
        isExplicitMaterialAsset(relativePath) ||
        isReferencedVisualMaterialAsset(relativePath, referencedPaths)
      );
    })
    .map((absolutePath) => {
      const relativePath = normalizeRelativePath(
        relative(knowledgeBase.vaultPath, absolutePath),
      );
      const sourceLabel = relativePath.split("/").slice(0, -1).join(" / ") || "根目录";
      const typeLabel = inferMaterialType(relativePath);
      const stats = statSync(absolutePath);

      return {
        id: `material:${relativePath}`,
        title: basename(relativePath, extname(relativePath)),
        typeLabel,
        summary: buildMaterialSummary(typeLabel, sourceLabel),
        relativePath,
        sourceLabel,
        modifiedAt: stats.mtime.toISOString(),
        openUri: `obsidian://open?vault=${encodeURIComponent(knowledgeBase.vaultName)}&file=${encodeURIComponent(relativePath)}`,
        previewSrc: `/api/forge/knowledge-base/material?relativePath=${encodeURIComponent(relativePath)}`,
        actionLabel: "在 Obsidian 打开",
        sourceKind: "obsidian",
      } satisfies ForgeMaterialAsset;
    })
    .sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
}
