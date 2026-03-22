import type { ForgeProjectWorkbenchState } from "../../packages/core/src/types";

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

export type ForgeProjectMutationResult = {
  activeProjectId: string;
  project: {
    id: string;
    name: string;
    requirement?: string;
    enterpriseName?: string;
    sector?: string;
    projectType?: string;
    owner?: string;
    deliveryDate?: string;
    note?: string;
    teamTemplateId?: string;
  };
};

export type DeleteForgeProjectResult = {
  deletedProjectId: string;
  activeProjectId: string | null;
};

export type CreateForgeProjectInput = {
  name?: string;
  templateId?: string;
  demoSeed?: boolean;
  teamTemplateId?: string;
  sector?: string;
  owner?: string;
  requirement?: string;
  enterpriseName?: string;
  projectType?: string;
  deliveryDate?: string;
  note?: string;
};

export type UpdateForgeProjectInput = {
  projectId: string;
  name?: string;
  teamTemplateId?: string;
  sector?: string;
  owner?: string;
  requirement?: string;
  enterpriseName?: string;
  projectType?: string;
  deliveryDate?: string;
  note?: string;
};

export type GenerateForgePrdDraftInput = {
  projectId: string;
  templateId: string;
  extraNotes?: string;
};

export type GenerateForgePrdDraftResult = {
  activeProjectId: string;
  document: {
    id: string;
    title: string;
  };
  template: {
    id: string;
    title: string;
  };
};

export type SaveForgeProjectWorkbenchStateInput = ForgeProjectWorkbenchState;

export type SaveForgeProjectWorkbenchStateResult = {
  state: ForgeProjectWorkbenchState;
};

async function readForgeEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ForgeApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "项目操作失败。");
  }

  return payload.data;
}

export async function activateForgeProject(projectId: string): Promise<ForgeProjectMutationResult> {
  const response = await fetch("/api/forge/projects/active", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ projectId })
  });

  return readForgeEnvelope<ForgeProjectMutationResult>(response);
}

export async function createForgeProject(
  input: CreateForgeProjectInput
): Promise<ForgeProjectMutationResult> {
  const response = await fetch("/api/forge/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<ForgeProjectMutationResult>(response);
}

export async function updateForgeProject(
  input: UpdateForgeProjectInput
): Promise<ForgeProjectMutationResult> {
  const response = await fetch("/api/forge/projects", {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<ForgeProjectMutationResult>(response);
}

export async function deleteForgeProject(projectId: string): Promise<DeleteForgeProjectResult> {
  const response = await fetch("/api/forge/projects", {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ projectId })
  });

  return readForgeEnvelope<DeleteForgeProjectResult>(response);
}

export async function generateForgePrdDraft(
  input: GenerateForgePrdDraftInput
): Promise<GenerateForgePrdDraftResult> {
  const response = await fetch("/api/forge/prd", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<GenerateForgePrdDraftResult>(response);
}

export async function saveForgeProjectWorkbenchState(
  input: SaveForgeProjectWorkbenchStateInput
): Promise<SaveForgeProjectWorkbenchStateResult> {
  const response = await fetch("/api/forge/project-workbench-state", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeEnvelope<SaveForgeProjectWorkbenchStateResult>(response);
}
