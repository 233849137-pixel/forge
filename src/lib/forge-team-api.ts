import type {
  ForgeAgentOwnerMode,
  ForgeAgentRole,
  ForgeTeamWorkbenchState
} from "../../packages/core/src/types";

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

export type SaveForgeAgentProfileInput = {
  agentId: string;
  name?: string;
  role?: ForgeAgentRole;
  runnerId?: string;
  departmentLabel?: string;
  ownerMode: ForgeAgentOwnerMode;
  persona: string;
  policyId: string;
  permissionProfileId: string;
  promptTemplateId: string;
  skillIds: string[];
  systemPrompt: string;
  knowledgeSources: string[];
};

export type SaveForgeAgentProfileResult = {
  agent: {
    id: string;
    name: string;
    role: ForgeAgentRole;
    runnerId: string;
    departmentLabel?: string;
    ownerMode: ForgeAgentOwnerMode;
    persona: string;
    policyId: string;
    permissionProfileId: string;
    promptTemplateId: string;
    skillIds: string[];
    systemPrompt: string;
    knowledgeSources: string[];
  };
};

export type SaveForgeTeamWorkbenchStateInput = ForgeTeamWorkbenchState;

export type SaveForgeTeamWorkbenchStateResult = {
  state: ForgeTeamWorkbenchState;
};

export async function saveForgeAgentProfile(
  input: SaveForgeAgentProfileInput
): Promise<SaveForgeAgentProfileResult> {
  const response = await fetch("/api/forge/team-registry", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json()) as ForgeApiEnvelope<SaveForgeAgentProfileResult>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "团队配置保存失败。");
  }

  return payload.data;
}

export async function saveForgeTeamWorkbenchState(
  input: SaveForgeTeamWorkbenchStateInput
): Promise<SaveForgeTeamWorkbenchStateResult> {
  const response = await fetch("/api/forge/team-workbench-state", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json()) as ForgeApiEnvelope<SaveForgeTeamWorkbenchStateResult>;

  if (!response.ok || !payload.ok) {
    throw new Error(
      ("error" in payload ? payload.error?.message : undefined) ?? "团队工作台状态保存失败。"
    );
  }

  return payload.data;
}
