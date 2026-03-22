import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import type {
  ForgeAgentRole,
  ForgeDashboardSnapshot,
  ForgeSkill,
  ForgeSkillCategory
} from "../../packages/core/src/types";

type ForgeRealSkillLoadOptions = {
  skillRoots?: string[];
  supplementalSkillRoots?: string[];
  vaultPath?: string | null;
};

type ForgeRealSkillProfile = {
  skills: ForgeSkill[];
  legacySkillIdMap: Record<string, string>;
};

type SkillSourceInfo = {
  skillRoots: string[];
  groupedSkillIds: Map<string, { groupKey: string; groupLabel: string }>;
};

type RoleWhitelistContext = {
  folderPrefix: string;
  role: ForgeAgentRole;
  line: string;
  displayCategory: string;
};

const skillLineOrder = [
  "AI智能",
  "开发工具",
  "效率提升",
  "数据分析",
  "内容创作",
  "安全合规",
  "通讯协作"
] as const;

const DEFAULT_VAULT_PATH = join(homedir(), "Documents/New project", "forge-knowledge-vault");

const DEFAULT_SUPPLEMENTAL_SKILL_ROOTS = [
  join(homedir(), ".agents", "skills")
];

const legacySkillIdMap: Record<string, string> = {
  "skill-prd": "feature-forge",
  "skill-acceptance": "writing-plans",
  "skill-architecture": "spec-miner",
  "skill-boundary-review": "requesting-code-review",
  "skill-design-system": "frontend-design",
  "skill-ui-review": "ui-ux-pro-max",
  "skill-code": "test-driven-development",
  "skill-codegen": "test-driven-development",
  "skill-refactor": "systematic-debugging",
  "skill-db": "spec-miner",
  "skill-playwright": "playwright",
  "skill-regression": "playwright-expert",
  "skill-release": "release-skills",
  "skill-preview": "vercel-deploy",
  "skill-archive": "remembering-conversations-kb",
  "skill-template-extract": "self-improving-agent-kb",
  "skill-faq": "summarize",
  "skill-rag": "tavily-search",
  "skill-incident": "systematic-debugging",
  "skill-delivery-gate": "verification-before-completion"
};

const roleWhitelistContexts: RoleWhitelistContext[] = [
  { folderPrefix: "CEO-", role: "pm", line: "AI智能", displayCategory: "规划" },
  { folderPrefix: "技术总监-CTO", role: "architect", line: "开发工具", displayCategory: "架构" },
  { folderPrefix: "前端开发-FE", role: "design", line: "内容创作", displayCategory: "设计" },
  { folderPrefix: "后端开发-BE", role: "engineer", line: "开发工具", displayCategory: "开发" },
  { folderPrefix: "集成工程-Integration", role: "engineer", line: "开发工具", displayCategory: "开发" },
  { folderPrefix: "回归测试-RegressionQA", role: "qa", line: "开发工具", displayCategory: "测试" },
  { folderPrefix: "测试总监-QA", role: "qa", line: "开发工具", displayCategory: "测试" },
  { folderPrefix: "开发交付经理-EM", role: "release", line: "通讯协作", displayCategory: "交付" },
  { folderPrefix: "运维总监-知识库与修复", role: "knowledge", line: "数据分析", displayCategory: "知识" },
  { folderPrefix: "运营总监-数据与整理", role: "knowledge", line: "数据分析", displayCategory: "知识" }
];

const groupKeyToForgeCategory: Record<string, ForgeSkillCategory> = {
  publish: "release",
  write: "product",
  visual: "design",
  convert: "knowledge",
  tools: "engineering"
};

const lineByRole: Record<ForgeAgentRole, string> = {
  pm: "AI智能",
  architect: "开发工具",
  design: "内容创作",
  engineer: "开发工具",
  qa: "开发工具",
  release: "通讯协作",
  knowledge: "数据分析"
};

const displayCategoryByForgeCategory: Record<ForgeSkillCategory, string> = {
  product: "规划",
  architecture: "架构",
  design: "设计",
  engineering: "开发",
  quality: "测试",
  release: "发布",
  knowledge: "知识"
};

const displayCategoryByRole: Record<ForgeAgentRole, string> = {
  pm: "规划",
  architect: "架构",
  design: "设计",
  engineer: "开发",
  qa: "测试",
  release: "交付",
  knowledge: "知识"
};

const rolePriority: ForgeAgentRole[] = [
  "pm",
  "architect",
  "design",
  "engineer",
  "qa",
  "release",
  "knowledge"
];

let cachedRealSkillProfile:
  | { cacheKey: string; profile: ForgeRealSkillProfile }
  | null = null;

function shouldEnableRealSkills() {
  if (process.env.FORGE_ENABLE_REAL_SKILLS === "1") {
    return true;
  }

  if (process.env.FORGE_ENABLE_REAL_SKILLS === "0") {
    return false;
  }

  return process.env.NODE_ENV !== "test";
}

function resolveVaultPath(explicitVaultPath?: string | null) {
  if (explicitVaultPath && existsSync(explicitVaultPath)) {
    return explicitVaultPath;
  }

  const envVaultPath = process.env.FORGE_OBSIDIAN_VAULT_PATH;
  if (envVaultPath && existsSync(envVaultPath)) {
    return envVaultPath;
  }

  return existsSync(DEFAULT_VAULT_PATH) ? DEFAULT_VAULT_PATH : null;
}

function humanizeSkillId(skillId: string) {
  return skillId
    .replace(/^xiaomo-/, "")
    .replace(/^baoyu-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripMarkdownFrontmatter(content: string) {
  const normalized = content.replace(/^\uFEFF/, "");

  if (!normalized.startsWith("---\n")) {
    return normalized;
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return normalized;
  }

  return normalized.slice(end + 5);
}

function parseFrontmatter(content: string) {
  const normalized = content.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n")) {
    return {} as Record<string, string>;
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return {} as Record<string, string>;
  }

  const rawFrontmatter = normalized.slice(4, end);
  const result: Record<string, string> = {};

  rawFrontmatter.split("\n").forEach((line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!match) return;
    result[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  });

  return result;
}

function extractSummary(content: string) {
  return stripMarkdownFrontmatter(content)
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("- ") && !line.startsWith("* "))
    ?.slice(0, 120);
}

function readSkillSourceInfo(vaultPath: string | null): SkillSourceInfo {
  const fallbackRoots = [
    join(homedir(), ".codex", "skills"),
    join(homedir(), ".openclaw", "workspace", "skills")
  ].filter((root) => existsSync(root));

  if (!vaultPath) {
    return {
      skillRoots: fallbackRoots,
      groupedSkillIds: new Map()
    };
  }

  const indexPath = join(
    vaultPath,
    "00-Agent协作Agent-OS",
    "20-注册表与索引",
    "技能索引-CORE-SKILLS.md"
  );

  if (!existsSync(indexPath)) {
    return {
      skillRoots: fallbackRoots,
      groupedSkillIds: new Map()
    };
  }

  const content = readFileSync(indexPath, "utf8");
  const roots = Array.from(
    content.matchAll(/-\s+[^：]+：`([^`]+)`/g),
    (match) => match[1]
  ).filter((root) => existsSync(root));

  const groupedSkillIds = new Map<string, { groupKey: string; groupLabel: string }>();
  let currentGroupKey: string | null = null;
  let currentGroupLabel: string | null = null;

  content.split("\n").forEach((line) => {
    const headingMatch = line.match(/^###\s+(.+?)（([^)]+)）/);
    if (headingMatch) {
      currentGroupLabel = headingMatch[1].replace(/类$/, "").trim();
      currentGroupKey = headingMatch[2].trim();
      return;
    }

    if (!currentGroupKey || !currentGroupLabel) {
      return;
    }

    Array.from(line.matchAll(/`([^`]+)`/g), (match) => match[1]).forEach((skillId) => {
      groupedSkillIds.set(skillId, {
        groupKey: currentGroupKey!,
        groupLabel: currentGroupLabel!
      });
    });
  });

  return {
    skillRoots: roots.length > 0 ? roots : fallbackRoots,
    groupedSkillIds
  };
}

function readRoleWhitelistProfiles(vaultPath: string | null) {
  const skillProfiles = new Map<
    string,
    {
      roles: Set<ForgeAgentRole>;
      lines: Set<string>;
      displayCategories: Set<string>;
    }
  >();

  if (!vaultPath) {
    return skillProfiles;
  }

  const roleCardRoot = join(vaultPath, "00-Agent协作Agent-OS", "10-岗位角色卡");

  if (!existsSync(roleCardRoot)) {
    return skillProfiles;
  }

  readdirSync(roleCardRoot, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return;
    const context = roleWhitelistContexts.find((item) => entry.name.startsWith(item.folderPrefix));
    if (!context) return;

    const whitelistPath = join(roleCardRoot, entry.name, "技能白名单.md");
    if (!existsSync(whitelistPath)) return;

    const content = readFileSync(whitelistPath, "utf8");
    Array.from(content.matchAll(/`([^`]+)`/g), (match) => match[1]).forEach((skillId) => {
      const existing = skillProfiles.get(skillId) ?? {
        roles: new Set<ForgeAgentRole>(),
        lines: new Set<string>(),
        displayCategories: new Set<string>()
      };
      existing.roles.add(context.role);
      existing.lines.add(context.line);
      existing.displayCategories.add(context.displayCategory);
      skillProfiles.set(skillId, existing);
    });
  });

  return skillProfiles;
}

function collectSkillFiles(root: string) {
  const skillFiles: string[] = [];

  const walk = (directory: string, depth = 0) => {
    if (depth > 3) return;
    readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        if (entry.name !== ".system") return;
      }

      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        const directSkillFile = join(absolutePath, "SKILL.md");
        if (existsSync(directSkillFile)) {
          skillFiles.push(directSkillFile);
          return;
        }
        walk(absolutePath, depth + 1);
      }
    });
  };

  if (existsSync(root)) {
    walk(root);
  }

  return skillFiles;
}

function inferSourceLabel(root: string) {
  const normalizedRoot = root.toLowerCase();

  if (normalizedRoot.includes(".openclaw") || normalizedRoot.includes("openclaw")) {
    return "OpenClaw";
  }

  if (normalizedRoot.includes(".agents") || normalizedRoot.includes("/agents") || normalizedRoot.includes("agents")) {
    return ".agents";
  }

  return "Codex";
}

function inferLineFromGroup(groupKey: string | null) {
  switch (groupKey) {
    case "write":
      return "效率提升";
    case "visual":
      return "内容创作";
    case "publish":
      return "通讯协作";
    case "convert":
      return "效率提升";
    case "tools":
      return "开发工具";
    default:
      return null;
  }
}

function inferSkillLineFromSkillId(
  skillId: string,
  groupKey: string | null,
  role: ForgeAgentRole
) {
  if (
    /(openai-docs|prompt-engineer|proactive-agent|self-improving-agent$|multi-ai-discuss|ai-daily|feature-forge|coding-agent|multi-coding-agent|sora)/i.test(
      skillId
    )
  ) {
    return "AI智能";
  }

  if (
    /(brainstorming|writing-plans|remembering-conversations|kb-bootstrap|find-skills|skill-installer|skill-creator|skills-index|trending-skills|self-improving-agent-kb|learn-maintain-skills|receiving-code-review|requesting-code-review)/i.test(
      skillId
    )
  ) {
    return "效率提升";
  }

  if (
    /(tavily-search|duckduckgo-search|web-search|weather|github-topics|find-topic|content-eval|summarize|model-usage)/i.test(
      skillId
    )
  ) {
    return "数据分析";
  }

  if (
    /(article|writer|humanizer|image|cover|comic|infographic|visual-style|markdown-to-html|format-markdown|url-to-markdown|seedance|nano-banana|wechat-layout|xhs|twitter-illustrator|slide-deck|illustrator|comic|storyboard)/i.test(
      skillId
    )
  ) {
    return "内容创作";
  }

  if (
    /(skill-vetter|verification-before-completion)/i.test(skillId)
  ) {
    return "安全合规";
  }

  if (
    /(gog|discord|openclaw-discord-ops|post-to-wechat|post-to-x|wechat-article-publisher|x-article-publisher)/i.test(
      skillId
    )
  ) {
    return "通讯协作";
  }

  if (
    /(playwright|gh-cli|figma|frontend-design|ui-ux-pro-max|vercel-deploy|coze-web-packaging|release-skills|spec-miner|systematic-debugging|system-info|file-search|fs-street|screenshot|mermaid-visualizer|excalidraw-diagram|obsidian-canvas-creator|openclaw-repair)/i.test(
      skillId
    )
  ) {
    return "开发工具";
  }

  return inferLineFromGroup(groupKey) ?? lineByRole[role] ?? skillLineOrder[0];
}

function inferDefaultOwnerRole(groupKey: string | null, skillId: string): ForgeAgentRole {
  if (/playwright|regression|verification|test|qa/i.test(skillId)) {
    return "qa";
  }

  if (/release|deploy|publish/i.test(skillId)) {
    return "release";
  }

  if (/markdown|summarize|search|knowledge|kb|format|url-to-markdown/i.test(skillId)) {
    return "knowledge";
  }

  if (/design|visual|figma|ui|ux|illustrator|infographic|canvas|diagram/i.test(skillId)) {
    return "design";
  }

  if (/feature-forge|writing|writer|humanizer|topic|plan|prompt/i.test(skillId)) {
    return "pm";
  }

  switch (groupKey) {
    case "publish":
      return "release";
    case "visual":
      return "design";
    case "convert":
      return "knowledge";
    case "write":
      return "pm";
    default:
      return "engineer";
  }
}

function inferForgeCategory(
  groupKey: string | null,
  role: ForgeAgentRole | null,
  displayCategory: string
): ForgeSkillCategory {
  if (groupKey && groupKeyToForgeCategory[groupKey]) {
    if (groupKey === "tools" && role === "qa") return "quality";
    if (groupKey === "tools" && role === "release") return "release";
    if (groupKey === "tools" && role === "knowledge") return "knowledge";
    if (groupKey === "tools" && role === "architect") return "architecture";
    return groupKeyToForgeCategory[groupKey];
  }

  if (displayCategory.includes("测试")) return "quality";
  if (displayCategory.includes("发布") || displayCategory.includes("交付")) return "release";
  if (displayCategory.includes("知识")) return "knowledge";
  if (displayCategory.includes("设计")) return "design";
  if (displayCategory.includes("架构")) return "architecture";
  if (displayCategory.includes("产品") || displayCategory.includes("协作")) return "product";
  if (role === "architect") return "architecture";
  if (role === "qa") return "quality";
  if (role === "release") return "release";
  if (role === "knowledge") return "knowledge";
  if (role === "design") return "design";
  if (role === "pm") return "product";
  return "engineering";
}

function buildRealSkillProfile(options: ForgeRealSkillLoadOptions = {}): ForgeRealSkillProfile {
  const vaultPath = resolveVaultPath(options.vaultPath);
  const sourceInfo = readSkillSourceInfo(vaultPath);
  const whitelistProfiles = readRoleWhitelistProfiles(vaultPath);
  const curatedSkillIds = new Set([
    ...Array.from(whitelistProfiles.keys()),
    ...Array.from(sourceInfo.groupedSkillIds.keys())
  ]);
  const authorityRoots =
    options.skillRoots?.filter((root) => existsSync(root)) ?? sourceInfo.skillRoots;
  const supplementalRoots =
    options.supplementalSkillRoots?.filter((root) => existsSync(root)) ??
    DEFAULT_SUPPLEMENTAL_SKILL_ROOTS.filter((root) => existsSync(root));
  const scanRoots = [...authorityRoots, ...supplementalRoots];
  const cacheKey = JSON.stringify({
    roots: scanRoots,
    vaultPath,
    curatedSkillIds: Array.from(curatedSkillIds).sort()
  });

  if (cachedRealSkillProfile?.cacheKey === cacheKey) {
    return cachedRealSkillProfile.profile;
  }

  const skillsById = new Map<string, ForgeSkill>();

  scanRoots.forEach((root) => {
    const sourceLabel = inferSourceLabel(root);
    collectSkillFiles(root).forEach((skillFile) => {
      const skillId = basename(dirname(skillFile));
      if (skillsById.has(skillId)) {
        return;
      }

      const content = readFileSync(skillFile, "utf8");
      const frontmatter = parseFrontmatter(content);
      const profile = whitelistProfiles.get(skillId);
      const grouped = sourceInfo.groupedSkillIds.get(skillId);
      const recommendedRoles = Array.from(profile?.roles ?? []).sort(
        (left, right) => rolePriority.indexOf(left) - rolePriority.indexOf(right)
      );
      const preferredOwnerRole = inferDefaultOwnerRole(grouped?.groupKey ?? null, skillId);
      const ownerRole =
        recommendedRoles.find((role) => role === preferredOwnerRole) ??
        preferredOwnerRole ??
        recommendedRoles[0] ??
        "engineer";
      const profileLines = Array.from(profile?.lines ?? []);
      const preferredLine = inferSkillLineFromSkillId(
        skillId,
        grouped?.groupKey ?? null,
        ownerRole
      );
      const line =
        profileLines.find((candidate) => candidate === preferredLine) ??
        preferredLine ??
        inferLineFromGroup(grouped?.groupKey ?? null) ??
        "开发工具";
      const profileDisplayCategories = Array.from(profile?.displayCategories ?? []);
      const preferredDisplayCategory = displayCategoryByRole[ownerRole];
      const category = inferForgeCategory(
        grouped?.groupKey ?? null,
        ownerRole,
        preferredDisplayCategory ?? "通用"
      );
      const displayCategory =
        profileDisplayCategories.find((candidate) => candidate === preferredDisplayCategory) ??
        profileDisplayCategories[0] ??
        grouped?.groupLabel ??
        preferredDisplayCategory ??
        displayCategoryByForgeCategory[category];
      const summary =
        frontmatter.description?.trim() ||
        extractSummary(content) ||
        `${frontmatter.name?.trim() || humanizeSkillId(skillId)} 的技能说明。`;

      skillsById.set(skillId, {
        id: skillId,
        name: frontmatter.name?.trim() || humanizeSkillId(skillId),
        category,
        ownerRole,
        summary,
        usageGuide: `来源：${sourceLabel}`,
        line,
        displayCategory,
        sourceLabel,
        sourcePath: skillFile,
        recommendedRoles
      });
    });
  });

  const profile: ForgeRealSkillProfile = {
    skills: Array.from(skillsById.values()).sort((left, right) => {
      const leftIndex = skillLineOrder.indexOf(left.line as (typeof skillLineOrder)[number]);
      const rightIndex = skillLineOrder.indexOf(right.line as (typeof skillLineOrder)[number]);
      if (leftIndex !== rightIndex) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.name.localeCompare(right.name, "zh-Hans-CN");
    }),
    legacySkillIdMap
  };

  cachedRealSkillProfile = {
    cacheKey,
    profile
  };

  return profile;
}

function mapSkillIdsToRealSkills(
  skillIds: string[],
  realSkillIds: Set<string>,
  role: ForgeAgentRole,
  realSkills: ForgeSkill[]
) {
  const nextSkillIds = Array.from(
    new Set(
      skillIds
        .map((skillId) => legacySkillIdMap[skillId] ?? skillId)
        .filter((skillId) => realSkillIds.has(skillId))
    )
  );

  if (nextSkillIds.length > 0) {
    return nextSkillIds;
  }

  return realSkills
    .filter((skill) => skill.recommendedRoles?.includes(role) || skill.ownerRole === role)
    .slice(0, 2)
    .map((skill) => skill.id);
}

export function loadForgeRealSkills(options: ForgeRealSkillLoadOptions = {}) {
  return buildRealSkillProfile(options).skills;
}

export function hydrateSnapshotWithRealSkills(
  snapshot: ForgeDashboardSnapshot,
  options: ForgeRealSkillLoadOptions = {}
) {
  if (!shouldEnableRealSkills()) {
    return snapshot;
  }

  const profile = buildRealSkillProfile(options);
  if (profile.skills.length === 0) {
    return snapshot;
  }

  const nextSnapshot = structuredClone(snapshot) as ForgeDashboardSnapshot;
  const realSkillIds = new Set(profile.skills.map((skill) => skill.id));

  nextSnapshot.skills = profile.skills;
  nextSnapshot.agents = nextSnapshot.agents.map((agent) => ({
    ...agent,
    skillIds: mapSkillIdsToRealSkills(agent.skillIds, realSkillIds, agent.role, profile.skills)
  }));

  if (nextSnapshot.teamWorkbenchState) {
    nextSnapshot.teamWorkbenchState.managedAgents =
      nextSnapshot.teamWorkbenchState.managedAgents.map((agent) => ({
        ...agent,
        skillIds: mapSkillIdsToRealSkills(agent.skillIds, realSkillIds, agent.role, profile.skills)
      }));

    nextSnapshot.teamWorkbenchState.manualSkillIdsByAgentId = Object.fromEntries(
      Object.entries(nextSnapshot.teamWorkbenchState.manualSkillIdsByAgentId ?? {}).map(
        ([agentId, skillIds]) => [
          agentId,
          Array.from(
            new Set(
              skillIds
                .map((skillId) => profile.legacySkillIdMap[skillId] ?? skillId)
                .filter((skillId) => realSkillIds.has(skillId))
            )
          )
        ]
      )
    );

    nextSnapshot.teamWorkbenchState.customAbilityPacks =
      nextSnapshot.teamWorkbenchState.customAbilityPacks.map((pack) => ({
        ...pack,
        skillIds: Array.from(
          new Set(
            pack.skillIds
              .map((skillId) => profile.legacySkillIdMap[skillId] ?? skillId)
              .filter((skillId) => realSkillIds.has(skillId))
          )
        )
      }));

    nextSnapshot.teamWorkbenchState.skillCatalogOverrides = Object.fromEntries(
      Object.entries(nextSnapshot.teamWorkbenchState.skillCatalogOverrides ?? {}).flatMap(
        ([skillId, override]) => {
          const nextSkillId = profile.legacySkillIdMap[skillId] ?? skillId;
          if (!realSkillIds.has(nextSkillId)) {
            return [];
          }

          return [[nextSkillId, override] as const];
        }
      )
    );

    nextSnapshot.teamWorkbenchState.hiddenSkillIds = Array.from(
      new Set(
        (nextSnapshot.teamWorkbenchState.hiddenSkillIds ?? [])
          .map((skillId) => profile.legacySkillIdMap[skillId] ?? skillId)
          .filter((skillId) => realSkillIds.has(skillId))
      )
    );

    nextSnapshot.teamWorkbenchState.removedPackSkillIdsByAgentId = Object.fromEntries(
      Object.entries(nextSnapshot.teamWorkbenchState.removedPackSkillIdsByAgentId ?? {}).map(
        ([agentId, removedByPack]) => [
          agentId,
          Object.fromEntries(
            Object.entries(removedByPack).map(([packKey, removedSkillIds]) => [
              packKey,
              Array.from(
                new Set(
                  removedSkillIds
                    .map((skillId) => profile.legacySkillIdMap[skillId] ?? skillId)
                    .filter((skillId) => realSkillIds.has(skillId))
                )
              )
            ])
          )
        ]
      )
    );
  }

  return nextSnapshot;
}

export { shouldEnableRealSkills };
