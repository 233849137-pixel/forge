import type { ForgeCommandModelExecution } from "../../packages/core/src/types";

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

export type ForgeExecuteCommandInput = {
  commandId: string;
  projectId: string;
  extraNotes?: string;
  selectedModel?: string;
  thinkingBudget?: string;
  triggeredBy: string;
};
export type ExecuteForgeCommandInput = ForgeExecuteCommandInput;

export type ForgeExecuteCommandResult = {
  execution: {
    id: string;
    commandId: string;
    status: string;
    summary: string;
  };
  modelExecution?: ForgeCommandModelExecution;
};
export type ExecuteForgeCommandResult = ForgeExecuteCommandResult;

export type ForgeWorkbenchChatInput = {
  projectId: string;
  prompt: string;
  selectedModel: string;
  thinkingBudget?: string;
  triggeredBy: string;
  workbenchNode?: string;
};
export type SendForgeWorkbenchChatInput = ForgeWorkbenchChatInput;

export type ForgeWorkbenchChatResult = {
  modelExecution: ForgeCommandModelExecution;
};
export type SendForgeWorkbenchChatResult = ForgeWorkbenchChatResult;

export async function executeForgeCommand(
  input: ForgeExecuteCommandInput
): Promise<ForgeExecuteCommandResult> {
  const response = await fetch("/api/forge/commands", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mode: "execute",
      ...input
    })
  });
  const payload = (await response.json()) as ForgeApiEnvelope<ForgeExecuteCommandResult>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "命令执行失败。");
  }

  return payload.data;
}

export async function sendForgeWorkbenchChatMessage(
  input: ForgeWorkbenchChatInput
): Promise<ForgeWorkbenchChatResult> {
  const response = await fetch("/api/forge/commands", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mode: "chat",
      ...input
    })
  });
  const payload = (await response.json()) as ForgeApiEnvelope<ForgeWorkbenchChatResult>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "工作台回复失败。");
  }

  return payload.data;
}
