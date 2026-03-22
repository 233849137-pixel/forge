import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, relative } from "node:path";

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

type LoadForgeObsidianKnowledgeBaseOptions = {
  cliBinaryPath?: string;
  cliRunner?: (args: string[]) => CliRunResult;
  vaultPath?: string;
  appConfigPath?: string;
};

type CliRunResult = {
  ok: boolean;
  output: string;
};

const DEFAULT_VAULT_NAME = "forge-knowledge-vault";
const DEFAULT_OBSIDIAN_BINARY = "/Applications/Obsidian.app/Contents/MacOS/Obsidian";

export function createEmptyForgeObsidianKnowledgeBase(
  partial: Partial<ForgeObsidianKnowledgeBaseData> = {}
): ForgeObsidianKnowledgeBaseData {
  return {
    provider: "obsidian",
    vaultName: partial.vaultName ?? DEFAULT_VAULT_NAME,
    vaultPath: partial.vaultPath ?? "",
    cliStatus: partial.cliStatus ?? "unavailable",
    cliSummary: partial.cliSummary ?? "未发现可用的 Obsidian CLI。",
    syncMode: partial.syncMode ?? "filesystem",
    syncedAt: partial.syncedAt ?? new Date().toISOString(),
    summary: partial.summary ?? "当前还没有接入可同步的 Obsidian 知识库。",
    noteCount: partial.noteCount ?? 0,
    canvasCount: partial.canvasCount ?? 0,
    topFolders: partial.topFolders ?? [],
    recentNotes: partial.recentNotes ?? [],
    notes: partial.notes ?? []
  };
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/");
}

function resolveVaultPath(options: LoadForgeObsidianKnowledgeBaseOptions) {
  if (options.vaultPath && existsSync(options.vaultPath)) {
    return options.vaultPath;
  }

  const envVaultPath = process.env.FORGE_OBSIDIAN_VAULT_PATH;
  if (envVaultPath && existsSync(envVaultPath)) {
    return envVaultPath;
  }

  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const appConfigPath =
    options.appConfigPath ?? join(homedir(), "Library/Application Support/Obsidian/obsidian.json");

  if (existsSync(appConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(appConfigPath, "utf8")) as {
        vaults?: Record<string, { path?: string; ts?: number; open?: boolean }>;
      };

      const vaults = Object.values(config.vaults ?? {}).filter(
        (vault): vault is { path: string; ts?: number; open?: boolean } => Boolean(vault.path)
      );
      const preferredVault =
        vaults.find((vault) => basename(vault.path) === DEFAULT_VAULT_NAME) ??
        vaults.find((vault) => vault.path.includes(`/${DEFAULT_VAULT_NAME}`)) ??
        vaults.sort((left, right) => (right.ts ?? 0) - (left.ts ?? 0))[0];

      if (preferredVault?.path && existsSync(preferredVault.path)) {
        return preferredVault.path;
      }
    } catch {
      // Ignore malformed Obsidian desktop config and fall back to defaults.
    }
  }

  const fallbackPath = join(homedir(), "Documents/New project", DEFAULT_VAULT_NAME);
  return existsSync(fallbackPath) ? fallbackPath : null;
}

function resolveCliBinaryPath(options: LoadForgeObsidianKnowledgeBaseOptions) {
  if (options.cliRunner) {
    return options.cliBinaryPath ?? "__obsidian_cli_runner__";
  }

  if (options.cliBinaryPath && existsSync(options.cliBinaryPath)) {
    return options.cliBinaryPath;
  }

  const envCliPath = process.env.FORGE_OBSIDIAN_CLI_BIN;
  if (envCliPath && existsSync(envCliPath)) {
    return envCliPath;
  }

  return existsSync(DEFAULT_OBSIDIAN_BINARY) ? DEFAULT_OBSIDIAN_BINARY : null;
}

function runObsidianCli(binaryPath: string, args: string[]): CliRunResult {
  try {
    const output = execFileSync(binaryPath, args, {
      encoding: "utf8",
      timeout: Number(process.env.FORGE_OBSIDIAN_CLI_TIMEOUT_MS ?? 3000)
    });

    return {
      ok: true,
      output: output.trim()
    };
  } catch (error) {
    const output = [error instanceof Error ? error.message : "", (error as any)?.stdout, (error as any)?.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();

    return {
      ok: false,
      output
    };
  }
}

function detectCliStatus(binaryPath: string | null, cliRunner?: (args: string[]) => CliRunResult) {
  if (!binaryPath) {
    return {
      cliStatus: "unavailable" as const,
      cliSummary: "未发现可用的 Obsidian CLI，当前只能读取本地 vault。",
      recents: [] as string[]
    };
  }

  const helpResult = cliRunner ? cliRunner(["--help"]) : runObsidianCli(binaryPath, ["--help"]);
  const helpOutput = helpResult.output;

  if (helpOutput.includes("Command line interface is not enabled")) {
    return {
      cliStatus: "disabled" as const,
      cliSummary: "Obsidian CLI 已发现，但还没在桌面设置里启用。",
      recents: [] as string[]
    };
  }

  if (!helpResult.ok || (!helpOutput.includes("Obsidian CLI") && !helpOutput.includes("Usage: obsidian"))) {
    return {
      cliStatus: "error" as const,
      cliSummary: helpOutput || "Obsidian CLI 校验失败，暂时回退到 vault 文件同步。",
      recents: [] as string[]
    };
  }

  return {
    cliStatus: "ready" as const,
    cliSummary: "Obsidian CLI 已接通，可辅助读取最近打开记录。",
    recents: [] as string[]
  };
}

function readCliRecents(
  binaryPath: string,
  vaultName: string,
  cliRunner?: (args: string[]) => CliRunResult
) {
  const result = cliRunner
    ? cliRunner(["recents", `vault=${vaultName}`])
    : runObsidianCli(binaryPath, ["recents", `vault=${vaultName}`]);

  if (!result.ok || !result.output || result.output === "No recent files.") {
    return [];
  }

  return result.output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectVaultFiles(vaultPath: string) {
  const markdownFiles: string[] = [];
  let canvasCount = 0;

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

      const extension = extname(entry.name).toLowerCase();

      if (extension === ".md") {
        markdownFiles.push(absolutePath);
      }

      if (extension === ".canvas") {
        canvasCount += 1;
      }
    });
  };

  walk(vaultPath);

  return { markdownFiles, canvasCount };
}

function stripFrontmatter(content: string) {
  const normalized = content.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n")) {
    return normalized;
  }

  const frontmatterEnd = normalized.indexOf("\n---\n", 4);
  if (frontmatterEnd === -1) {
    return normalized;
  }

  return normalized.slice(frontmatterEnd + 5);
}

function extractTitle(content: string, fallback: string) {
  const body = stripFrontmatter(content);
  const heading = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

function extractExcerpt(content: string) {
  const body = stripFrontmatter(content);
  const excerpt = body
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("```") &&
        !line.startsWith("- ") &&
        !line.startsWith("* ")
    );

  return excerpt ?? "该笔记还没有可展示的摘要。";
}

function extractTags(content: string) {
  const matches = content.match(/(^|\s)#([^\s#]+)/g) ?? [];
  return Array.from(
    new Set(
      matches
        .map((match) => match.trim().replace(/^#/, "").replace(/\s+#/, ""))
        .map((tag) => tag.replace(/^#/, ""))
        .filter(Boolean)
    )
  );
}

function estimateWordCount(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function buildFolderCounts(notes: ForgeObsidianKnowledgeBaseNote[]) {
  const counts = new Map<string, number>();

  notes.forEach((note) => {
    counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, noteCount]) => ({ name, noteCount }))
    .sort((left, right) => {
      if (right.noteCount !== left.noteCount) {
        return right.noteCount - left.noteCount;
      }

      return left.name.localeCompare(right.name, "zh-CN");
    })
    .slice(0, 6);
}

function buildKnowledgeNotes(
  vaultPath: string,
  vaultName: string,
  markdownFiles: string[],
  recentFiles: string[]
) {
  const recentOrder = new Map(recentFiles.map((file, index) => [normalizeRelativePath(file), index]));

  const notes = markdownFiles.map((filePath) => {
    const relativePath = normalizeRelativePath(relative(vaultPath, filePath));
    const content = readFileSync(filePath, "utf8");
    const stats = statSync(filePath);
    const title = extractTitle(content, basename(relativePath, ".md"));
    const firstSegment = relativePath.split("/")[0] ?? "根目录";

    return {
      id: `obsidian:${relativePath}`,
      title,
      relativePath,
      folder: firstSegment,
      excerpt: extractExcerpt(content),
      tags: extractTags(content),
      modifiedAt: stats.mtime.toISOString(),
      wordCount: estimateWordCount(content),
      isRecent: recentOrder.has(relativePath),
      openUri: `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`
    } satisfies ForgeObsidianKnowledgeBaseNote;
  });

  notes.sort((left, right) => {
    const leftRecent = recentOrder.get(left.relativePath);
    const rightRecent = recentOrder.get(right.relativePath);

    if (leftRecent !== undefined || rightRecent !== undefined) {
      if (leftRecent === undefined) {
        return 1;
      }

      if (rightRecent === undefined) {
        return -1;
      }

      return leftRecent - rightRecent;
    }

    return Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt);
  });

  const recentNotes = notes.filter((note) => note.isRecent).slice(0, 6);

  if (recentNotes.length < 6) {
    notes.forEach((note) => {
      if (!recentNotes.some((current) => current.id === note.id) && recentNotes.length < 6) {
        recentNotes.push(note);
      }
    });
  }

  return {
    notes,
    recentNotes
  };
}

export function loadForgeObsidianKnowledgeBase(
  options: LoadForgeObsidianKnowledgeBaseOptions = {}
): ForgeObsidianKnowledgeBaseData {
  const vaultPath = resolveVaultPath(options);
  const cliBinaryPath = resolveCliBinaryPath(options);
  const cliDetection = detectCliStatus(cliBinaryPath, options.cliRunner);
  const syncedAt = new Date().toISOString();

  if (!vaultPath) {
    return createEmptyForgeObsidianKnowledgeBase({
      cliStatus: cliDetection.cliStatus,
      cliSummary: cliDetection.cliSummary,
      syncedAt,
      summary:
        cliDetection.cliStatus === "unavailable"
          ? "未发现默认知识库目录，本页暂时没有可同步的知识库资料。"
          : "尚未定位到默认知识库目录，本页暂时没有可同步的知识库资料。"
    });
  }

  const vaultName = basename(vaultPath);
  const recentFiles =
    cliDetection.cliStatus === "ready" && cliBinaryPath
      ? readCliRecents(cliBinaryPath, vaultName, options.cliRunner)
      : [];
  const { markdownFiles, canvasCount } = collectVaultFiles(vaultPath);
  const { notes, recentNotes } = buildKnowledgeNotes(vaultPath, vaultName, markdownFiles, recentFiles);
  const topFolders = buildFolderCounts(notes);
  const syncMode: ForgeObsidianSyncMode = cliDetection.cliStatus === "ready" ? "cli-assisted" : "filesystem";
  const summary =
    cliDetection.cliStatus === "ready"
      ? "CLI 已接通，当前用 Obsidian recent 记录辅助同步 vault 内容。"
      : cliDetection.cliStatus === "disabled"
        ? "CLI 未启用，当前按 vault 文件直读同步。"
        : cliDetection.cliStatus === "error"
          ? "CLI 校验失败，当前回退到 vault 文件直读同步。"
          : "未发现 Obsidian CLI，当前按 vault 文件直读同步。";

  return {
    provider: "obsidian",
    vaultName,
    vaultPath,
    cliStatus: cliDetection.cliStatus,
    cliSummary: cliDetection.cliSummary,
    syncMode,
    syncedAt,
    summary,
    noteCount: notes.length,
    canvasCount,
    topFolders,
    recentNotes,
    notes
  };
}
