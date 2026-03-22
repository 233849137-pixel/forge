import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ForgeApiError } from "../../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonBody
} from "../../../../../src/lib/forge-api-response";

type SkillImportRequest = {
  githubUrl?: string;
  skillName?: string;
};

function parseGitHubRepository(githubUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(githubUrl);
  } catch {
    throw new ForgeApiError("GitHub 链接格式不正确", "FORGE_VALIDATION_ERROR", 400);
  }

  if (!/^github\.com$/i.test(parsedUrl.hostname)) {
    throw new ForgeApiError("目前只支持 GitHub 仓库链接", "FORGE_VALIDATION_ERROR", 400);
  }

  const segments = parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    throw new ForgeApiError("请提供完整的 GitHub 仓库链接", "FORGE_VALIDATION_ERROR", 400);
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  if (!owner || !repo) {
    throw new ForgeApiError("GitHub 仓库链接缺少 owner 或 repo", "FORGE_VALIDATION_ERROR", 400);
  }

  return { owner, repo };
}

async function readRepositoryDefaultBranch(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "forge-skill-import"
    }
  });

  if (!response.ok) {
    throw new ForgeApiError("无法读取 GitHub 仓库信息", "FORGE_SKILL_IMPORT_FAILED", 502);
  }

  const payload = (await response.json()) as { default_branch?: string };
  return payload.default_branch || "main";
}

function resolveSkillDownloadDirectory() {
  return process.env.FORGE_SKILL_DOWNLOAD_DIR || join(homedir(), "Downloads", "forge-skills");
}

function buildArchiveFileName(repo: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");

  return `${repo}-${timestamp}.zip`;
}

export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as SkillImportRequest;
    const githubUrl = body.githubUrl?.trim();

    if (!githubUrl) {
      throw new ForgeApiError("GitHub 链接不能为空", "FORGE_VALIDATION_ERROR", 400);
    }

    const { owner, repo } = parseGitHubRepository(githubUrl);
    const defaultBranch = await readRepositoryDefaultBranch(owner, repo);
    const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${defaultBranch}`;

    const archiveResponse = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "forge-skill-import"
      }
    });

    if (!archiveResponse.ok) {
      throw new ForgeApiError("GitHub Skill 下载失败", "FORGE_SKILL_IMPORT_FAILED", 502);
    }

    const targetDirectory = resolveSkillDownloadDirectory();
    mkdirSync(targetDirectory, { recursive: true });

    const fileName = buildArchiveFileName(repo);
    const downloadPath = join(targetDirectory, fileName);
    writeFileSync(downloadPath, Buffer.from(await archiveResponse.arrayBuffer()));

    return forgeSuccess({
      repository: `${owner}/${repo}`,
      defaultBranch,
      skillName: body.skillName?.trim() || repo,
      downloadPath
    });
  } catch (error) {
    return forgeError(error);
  }
}
