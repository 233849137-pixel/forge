import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ForgeApiError, getSnapshotForAI } from "../lib/forge-ai";

const SKIPPED_DIRECTORY_NAMES = new Set([".git", "node_modules", ".next", "dist", "build", "coverage"]);

export type ForgeWorkspaceTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  extension?: string | null;
  children?: ForgeWorkspaceTreeNode[];
};

export type ForgeWorkspaceTreeResult = {
  projectId: string;
  workspaceLabel: string;
  tree: ForgeWorkspaceTreeNode[];
};

export type ForgeWorkspaceFileRecord = {
  projectId: string;
  path: string;
  name: string;
  body: string;
  editable: boolean;
  language: "markdown" | "json" | "text";
  updatedAt: string | null;
};

export type ForgeWorkspaceFileResult = {
  file: ForgeWorkspaceFileRecord;
};

export type ForgeWorkspaceMutationResult = ForgeWorkspaceTreeResult & {
  file?: ForgeWorkspaceFileRecord | null;
};

function getProjectWorkspace(projectId: string, dbPath?: string) {
  const snapshot = getSnapshotForAI(dbPath);
  const project = snapshot.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const profile = snapshot.projectProfiles.find((item) => item.projectId === projectId);
  const workspacePath = profile?.workspacePath?.trim();

  if (!workspacePath) {
    throw new ForgeApiError("当前项目还没有初始化工作区", "FORGE_NOT_FOUND", 404);
  }

  const rootPath = resolve(workspacePath);

  if (!existsSync(rootPath)) {
    throw new ForgeApiError("当前项目工作区不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    projectId,
    projectName: project.name,
    rootPath,
    workspaceLabel: basename(rootPath) || project.name
  };
}

function normalizeWorkspaceRelativePath(input: string) {
  return input.replaceAll("\\", "/").replace(/^\/+/, "").trim();
}

function resolveWorkspaceRelativePath(rootPath: string, relativePathInput: string) {
  const normalizedRelativePath = normalizeWorkspaceRelativePath(relativePathInput);

  if (!normalizedRelativePath) {
    throw new ForgeApiError("文件路径不能为空", "FORGE_VALIDATION_ERROR", 400);
  }

  const absolutePath = resolve(rootPath, normalizedRelativePath);
  const relativePath = relative(rootPath, absolutePath);
  const normalizedResolvedPath = relativePath.split(sep).join("/");

  if (
    !normalizedResolvedPath ||
    normalizedResolvedPath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new ForgeApiError("文件路径超出了工作区范围", "FORGE_VALIDATION_ERROR", 400);
  }

  return {
    absolutePath,
    relativePath: normalizedResolvedPath
  };
}

function sortWorkspaceEntries(left: { name: string; isDirectory(): boolean }, right: { name: string; isDirectory(): boolean }) {
  if (left.isDirectory() !== right.isDirectory()) {
    return left.isDirectory() ? -1 : 1;
  }

  return left.name.localeCompare(right.name, "zh-CN");
}

function buildWorkspaceTree(directoryPath: string, relativeDirectoryPath = ""): ForgeWorkspaceTreeNode[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => {
      if (entry.isSymbolicLink()) {
        return false;
      }

      if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
        return false;
      }

      return true;
    })
    .sort(sortWorkspaceEntries)
    .map((entry) => {
      const path = relativeDirectoryPath ? `${relativeDirectoryPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        return {
          id: path,
          name: entry.name,
          path,
          kind: "directory" as const,
          children: buildWorkspaceTree(join(directoryPath, entry.name), path)
        };
      }

      return {
        id: path,
        name: entry.name,
        path,
        kind: "file" as const,
        extension: extname(entry.name).toLowerCase() || null
      };
    });
}

function getWorkspaceFileLanguage(path: string): ForgeWorkspaceFileRecord["language"] {
  const extension = extname(path).toLowerCase();

  if (extension === ".md" || extension === ".mdx") {
    return "markdown";
  }

  if (extension === ".json") {
    return "json";
  }

  return "text";
}

function isEditableWorkspaceMarkdown(path: string) {
  const extension = extname(path).toLowerCase();
  return extension === ".md" || extension === ".mdx";
}

function readWorkspaceFileRecord(projectId: string, absolutePath: string, relativePath: string): ForgeWorkspaceFileRecord {
  const stats = statSync(absolutePath);

  if (stats.isDirectory()) {
    throw new ForgeApiError("当前路径指向目录，无法直接打开", "FORGE_VALIDATION_ERROR", 400);
  }

  return {
    projectId,
    path: relativePath,
    name: basename(relativePath),
    body: readFileSync(absolutePath, "utf8"),
    editable: isEditableWorkspaceMarkdown(relativePath),
    language: getWorkspaceFileLanguage(relativePath),
    updatedAt: stats.mtime.toISOString()
  };
}

function buildWorkspaceTreeResult(workspace: ReturnType<typeof getProjectWorkspace>): ForgeWorkspaceTreeResult {
  return {
    projectId: workspace.projectId,
    workspaceLabel: workspace.workspaceLabel,
    tree: buildWorkspaceTree(workspace.rootPath)
  };
}

function assertWorkspaceEntryDoesNotExist(absolutePath: string) {
  if (existsSync(absolutePath)) {
    throw new ForgeApiError("目标路径已存在", "FORGE_VALIDATION_ERROR", 400);
  }
}

function assertWorkspaceMarkdownPath(relativePath: string) {
  if (!isEditableWorkspaceMarkdown(relativePath)) {
    throw new ForgeApiError("当前只支持新建 Markdown 文档", "FORGE_VALIDATION_ERROR", 400);
  }
}

export function listForgeWorkspaceFiles(projectId: string, dbPath?: string): ForgeWorkspaceTreeResult {
  const workspace = getProjectWorkspace(projectId, dbPath);

  return buildWorkspaceTreeResult(workspace);
}

export function readForgeWorkspaceFile(
  projectId: string,
  relativePathInput: string,
  dbPath?: string
): ForgeWorkspaceFileResult {
  const workspace = getProjectWorkspace(projectId, dbPath);
  const resolvedPath = resolveWorkspaceRelativePath(workspace.rootPath, relativePathInput);

  if (!existsSync(resolvedPath.absolutePath)) {
    throw new ForgeApiError("目标文件不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    file: readWorkspaceFileRecord(projectId, resolvedPath.absolutePath, resolvedPath.relativePath)
  };
}

export function saveForgeWorkspaceFile(input: {
  projectId: string;
  path: string;
  body: string;
}, dbPath?: string): ForgeWorkspaceFileResult {
  const workspace = getProjectWorkspace(input.projectId, dbPath);
  const resolvedPath = resolveWorkspaceRelativePath(workspace.rootPath, input.path);

  if (!existsSync(resolvedPath.absolutePath)) {
    throw new ForgeApiError("目标文件不存在", "FORGE_NOT_FOUND", 404);
  }

  if (!isEditableWorkspaceMarkdown(resolvedPath.relativePath)) {
    throw new ForgeApiError("当前只支持编辑 Markdown 文档", "FORGE_VALIDATION_ERROR", 400);
  }

  writeFileSync(resolvedPath.absolutePath, input.body, "utf8");

  return {
    file: readWorkspaceFileRecord(input.projectId, resolvedPath.absolutePath, resolvedPath.relativePath)
  };
}

export function createForgeWorkspaceDirectory(input: {
  projectId: string;
  path: string;
}, dbPath?: string): ForgeWorkspaceMutationResult {
  const workspace = getProjectWorkspace(input.projectId, dbPath);
  const resolvedPath = resolveWorkspaceRelativePath(workspace.rootPath, input.path);

  assertWorkspaceEntryDoesNotExist(resolvedPath.absolutePath);
  mkdirSync(resolvedPath.absolutePath, { recursive: true });

  return buildWorkspaceTreeResult(workspace);
}

export function createForgeWorkspaceMarkdown(input: {
  projectId: string;
  path: string;
  body?: string;
}, dbPath?: string): ForgeWorkspaceMutationResult {
  const workspace = getProjectWorkspace(input.projectId, dbPath);
  const resolvedPath = resolveWorkspaceRelativePath(workspace.rootPath, input.path);

  assertWorkspaceMarkdownPath(resolvedPath.relativePath);
  assertWorkspaceEntryDoesNotExist(resolvedPath.absolutePath);
  mkdirSync(dirname(resolvedPath.absolutePath), { recursive: true });
  writeFileSync(
    resolvedPath.absolutePath,
    input.body ?? `# ${basename(resolvedPath.relativePath, extname(resolvedPath.relativePath))}\n`,
    "utf8"
  );

  return {
    ...buildWorkspaceTreeResult(workspace),
    file: readWorkspaceFileRecord(input.projectId, resolvedPath.absolutePath, resolvedPath.relativePath)
  };
}

export function deleteForgeWorkspaceEntry(input: {
  projectId: string;
  path: string;
}, dbPath?: string): ForgeWorkspaceMutationResult {
  const workspace = getProjectWorkspace(input.projectId, dbPath);
  const resolvedPath = resolveWorkspaceRelativePath(workspace.rootPath, input.path);

  if (!existsSync(resolvedPath.absolutePath)) {
    throw new ForgeApiError("目标文件不存在", "FORGE_NOT_FOUND", 404);
  }

  rmSync(resolvedPath.absolutePath, { recursive: true, force: true });

  return buildWorkspaceTreeResult(workspace);
}
