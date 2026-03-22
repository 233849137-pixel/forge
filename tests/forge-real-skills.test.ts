import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureForgeDatabase, loadDashboardSnapshot } from "../packages/db/src";
import {
  hydrateSnapshotWithRealSkills,
  loadForgeRealSkills
} from "../src/server/forge-real-skills";

function writeSkill(root: string, skillId: string, name: string, description: string) {
  const skillDir = join(root, skillId);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n`
  );
}

function writeWhitelist(vaultPath: string, folderName: string, body: string) {
  const directory = join(
    vaultPath,
    "00-Agent协作Agent-OS",
    "10-岗位角色卡",
    folderName
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "技能白名单.md"), body);
}

function writeCoreIndex(vaultPath: string, codexRoot: string, openclawRoot: string) {
  const directory = join(vaultPath, "00-Agent协作Agent-OS", "20-注册表与索引");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "技能索引-CORE-SKILLS.md"),
    `# 核心技能索引\n\n## 技能根目录（权威落点）\n- Codex 技能：\`${codexRoot}\`\n- OpenClaw 技能：\`${openclawRoot}\`\n\n### 写作类（write）\n- \`feature-forge\`\n- \`writing-plans\`\n\n### 工具类（tools）\n- \`playwright\`\n- \`spec-miner\`\n`
  );
}

describe("forge real skills", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads real skills from configured roots and obsidian whitelist mapping", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-real-skills-"));
    const vaultPath = join(directory, "forge-knowledge-vault");
    const codexRoot = join(directory, "codex-skills");
    const openclawRoot = join(directory, "openclaw-skills");

    try {
      mkdirSync(codexRoot, { recursive: true });
      mkdirSync(openclawRoot, { recursive: true });

      writeSkill(codexRoot, "feature-forge", "Feature Forge", "把需求整理成结构化方案和 PRD。");
      writeSkill(codexRoot, "writing-plans", "Writing Plans", "输出多步骤计划和验收清单。");
      writeSkill(openclawRoot, "playwright", "Playwright", "执行浏览器自动化与回归验证。");
      writeSkill(openclawRoot, "spec-miner", "Spec Miner", "从现有实现中提炼结构和边界。");

      writeCoreIndex(vaultPath, codexRoot, openclawRoot);
      writeWhitelist(
        vaultPath,
        "CEO-总经理",
        "# CEO 白名单\n\n- `feature-forge`\n- `writing-plans`\n"
      );
      writeWhitelist(
        vaultPath,
        "技术总监-CTO",
        "# CTO 白名单\n\n- `spec-miner`\n"
      );
      writeWhitelist(
        vaultPath,
        "测试总监-QA",
        "# QA 白名单\n\n- `playwright`\n"
      );

      const skills = loadForgeRealSkills({
        vaultPath,
        skillRoots: [codexRoot, openclawRoot],
        supplementalSkillRoots: []
      });

      expect(skills.map((skill) => skill.id)).toEqual(
        expect.arrayContaining(["feature-forge", "writing-plans", "playwright", "spec-miner"])
      );
      expect(skills.find((skill) => skill.id === "feature-forge")).toMatchObject({
        line: "AI智能",
        displayCategory: "规划",
        ownerRole: "pm",
        sourceLabel: "Codex"
      });
      expect(skills.find((skill) => skill.id === "playwright")).toMatchObject({
        line: "开发工具",
        displayCategory: "测试",
        ownerRole: "qa",
        sourceLabel: "OpenClaw"
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("hydrates dashboard snapshots with real skills and migrates legacy skill ids", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-real-skills-"));
    const vaultPath = join(directory, "forge-knowledge-vault");
    const codexRoot = join(directory, "codex-skills");
    const openclawRoot = join(directory, "openclaw-skills");
    const dbPath = join(directory, "forge.db");

    try {
      mkdirSync(codexRoot, { recursive: true });
      mkdirSync(openclawRoot, { recursive: true });

      writeSkill(codexRoot, "feature-forge", "Feature Forge", "把需求整理成结构化方案和 PRD。");
      writeSkill(codexRoot, "writing-plans", "Writing Plans", "输出多步骤计划和验收清单。");
      writeSkill(openclawRoot, "playwright", "Playwright", "执行浏览器自动化与回归验证。");

      writeCoreIndex(vaultPath, codexRoot, openclawRoot);
      writeWhitelist(
        vaultPath,
        "CEO-总经理",
        "# CEO 白名单\n\n- `feature-forge`\n- `writing-plans`\n"
      );
      writeWhitelist(
        vaultPath,
        "测试总监-QA",
        "# QA 白名单\n\n- `playwright`\n"
      );

      ensureForgeDatabase(dbPath);
      const snapshot = loadDashboardSnapshot(dbPath);

      vi.stubEnv("FORGE_ENABLE_REAL_SKILLS", "1");

      const hydratedSnapshot = hydrateSnapshotWithRealSkills(snapshot, {
        vaultPath,
        skillRoots: [codexRoot, openclawRoot],
        supplementalSkillRoots: []
      });

      expect(hydratedSnapshot.skills.map((skill) => skill.id)).toEqual(
        expect.arrayContaining(["feature-forge", "writing-plans", "playwright"])
      );
      expect(hydratedSnapshot.skills.some((skill) => skill.id === "skill-prd")).toBe(false);
      expect(hydratedSnapshot.agents.find((agent) => agent.id === "agent-pm")?.skillIds).toEqual(
        expect.arrayContaining(["feature-forge", "writing-plans"])
      );
      expect(hydratedSnapshot.agents.find((agent) => agent.id === "agent-qa")?.skillIds).toEqual(
        expect.arrayContaining(["playwright"])
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
