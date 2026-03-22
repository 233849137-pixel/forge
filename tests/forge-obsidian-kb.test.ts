import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadForgeObsidianKnowledgeBase } from "../src/server/forge-obsidian-kb";

function createVaultFixture() {
  const directory = join(tmpdir(), `forge-obsidian-kb-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const vaultPath = join(directory, "forge-knowledge-vault");

  mkdirSync(join(vaultPath, ".obsidian"), { recursive: true });
  mkdirSync(join(vaultPath, "00-Agent协作Agent-OS", "经验库"), { recursive: true });
  mkdirSync(join(vaultPath, "10-项目Projects", "Demo"), { recursive: true });

  writeFileSync(
    join(vaultPath, ".obsidian", "workspace.json"),
    JSON.stringify({
      lastOpenFiles: [
        "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
        "00-Agent协作Agent-OS/经验库/INBOX-经验速记.md"
      ]
    })
  );

  writeFileSync(
    join(vaultPath, "00-Agent协作Agent-OS", "经验库", "INBOX-经验速记.md"),
    "# 经验速记\n\n记录知识库沉淀的流程约束。 #ops #knowledge\n"
  );
  writeFileSync(
    join(vaultPath, "10-项目Projects", "Demo", "NOTE-2026-03-15-知识库同步方案.md"),
    "---\nstatus: draft\n---\n# 知识库同步方案\n\n把 Obsidian KB v2 同步到 Forge 资产页。\n\n#forge #obsidian\n"
  );
  writeFileSync(join(vaultPath, "02-主题地图MOCs.canvas"), "{\"nodes\":[]}");

  return { directory, vaultPath };
}

function createCliScript(directory: string, body: string) {
  const cliPath = join(directory, "obsidian-cli");
  writeFileSync(cliPath, `#!/bin/sh\n${body}\n`);
  chmodSync(cliPath, 0o755);
  return cliPath;
}

describe("forge obsidian knowledge base", () => {
  const directories = new Set<string>();

  afterEach(() => {
    directories.forEach((directory) => rmSync(directory, { force: true, recursive: true }));
    directories.clear();
  });

  it("loads kb v2 notes and recent files through an enabled obsidian cli adapter", () => {
    const { directory, vaultPath } = createVaultFixture();
    directories.add(directory);

    const snapshot = loadForgeObsidianKnowledgeBase({
      cliBinaryPath: "/mock/obsidian",
      cliRunner: (args) => {
        if (args[0] === "--help") {
          return {
            ok: true,
            output: "Obsidian CLI\n\nUsage: obsidian <command> [options]"
          };
        }

        if (args[0] === "recents") {
          return {
            ok: true,
            output: [
              "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md",
              "00-Agent协作Agent-OS/经验库/INBOX-经验速记.md"
            ].join("\n")
          };
        }

        return { ok: true, output: "" };
      },
      vaultPath
    });

    expect(snapshot.vaultName).toBe("forge-knowledge-vault");
    expect(snapshot.cliStatus).toBe("ready");
    expect(snapshot.syncMode).toBe("cli-assisted");
    expect(snapshot.noteCount).toBe(2);
    expect(snapshot.canvasCount).toBe(1);
    expect(snapshot.recentNotes[0]?.relativePath).toBe(
      "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md"
    );
    expect(snapshot.notes[0]?.title).toBe("知识库同步方案");
    expect(snapshot.notes[0]?.openUri).toContain("obsidian://open");
    expect(snapshot.notes[0]?.tags).toEqual(expect.arrayContaining(["forge", "obsidian"]));
    expect(snapshot.topFolders[0]).toEqual({
      name: "00-Agent协作Agent-OS",
      noteCount: 1
    });
  });

  it("falls back to filesystem sync when obsidian cli exists but is not enabled", () => {
    const { directory, vaultPath } = createVaultFixture();
    directories.add(directory);

    const snapshot = loadForgeObsidianKnowledgeBase({
      cliBinaryPath: "/mock/obsidian",
      cliRunner: () => ({
        ok: true,
        output: "Command line interface is not enabled. Please turn it on in Settings > General > Advanced."
      }),
      vaultPath
    });

    expect(snapshot.cliStatus).toBe("disabled");
    expect(snapshot.syncMode).toBe("filesystem");
    expect(snapshot.noteCount).toBe(2);
    expect(snapshot.recentNotes).toHaveLength(2);
    expect(snapshot.summary).toContain("CLI 未启用");
  });
});
