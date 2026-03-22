type ForgeApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

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

function buildWorkspaceFileTreeUrl(projectId: string) {
  return `/api/forge/workspace-files?projectId=${encodeURIComponent(projectId)}`;
}

function buildWorkspaceFileUrl(projectId: string, path: string) {
  return `${buildWorkspaceFileTreeUrl(projectId)}&path=${encodeURIComponent(path)}`;
}

async function readForgeEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ForgeApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "工作区请求失败。");
  }

  return payload.data;
}

export async function getForgeWorkspaceFileTree(projectId: string): Promise<ForgeWorkspaceTreeResult> {
  const response = await fetch(buildWorkspaceFileTreeUrl(projectId), {
    method: "GET",
    cache: "no-store"
  });

  return readForgeEnvelope<ForgeWorkspaceTreeResult>(response);
}

export async function getForgeWorkspaceFile(
  projectId: string,
  path: string
): Promise<ForgeWorkspaceFileResult> {
  const response = await fetch(buildWorkspaceFileUrl(projectId, path), {
    method: "GET",
    cache: "no-store"
  });

  return readForgeEnvelope<ForgeWorkspaceFileResult>(response);
}

export async function saveForgeWorkspaceFile(input: {
  projectId: string;
  path: string;
  body: string;
}): Promise<ForgeWorkspaceFileResult> {
  const response = await fetch("/api/forge/workspace-files", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<ForgeWorkspaceFileResult>(response);
}

export async function createForgeWorkspaceMarkdown(input: {
  projectId: string;
  path: string;
  body?: string;
}): Promise<ForgeWorkspaceMutationResult> {
  const response = await fetch("/api/forge/workspace-files", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action: "create-markdown",
      projectId: input.projectId,
      path: input.path,
      ...(typeof input.body === "string" ? { body: input.body } : {})
    })
  });

  return readForgeEnvelope<ForgeWorkspaceMutationResult>(response);
}

export async function createForgeWorkspaceDirectory(input: {
  projectId: string;
  path: string;
}): Promise<ForgeWorkspaceMutationResult> {
  const response = await fetch("/api/forge/workspace-files", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action: "create-directory",
      projectId: input.projectId,
      path: input.path
    })
  });

  return readForgeEnvelope<ForgeWorkspaceMutationResult>(response);
}

export async function deleteForgeWorkspaceEntry(input: {
  projectId: string;
  path: string;
}): Promise<ForgeWorkspaceMutationResult> {
  const response = await fetch("/api/forge/workspace-files", {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<ForgeWorkspaceMutationResult>(response);
}
