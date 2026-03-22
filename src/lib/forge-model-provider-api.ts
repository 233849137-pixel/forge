import type {
  ForgeModelProviderConnectionResult,
  ForgeModelProviderId,
  ForgeModelProviderSetting
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

export type SaveForgeModelProviderInput = {
  providerId: ForgeModelProviderId;
  enabled: boolean;
  apiKey?: string;
  modelPriority: string[];
};

export type TestForgeModelProviderInput = {
  providerId: ForgeModelProviderId;
  apiKey?: string;
  model?: string;
};

async function readForgeApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ForgeApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "模型供应商请求失败。");
  }

  return payload.data;
}

export async function fetchForgeModelProviders(): Promise<{
  providers: ForgeModelProviderSetting[];
}> {
  const response = await fetch("/api/forge/model-providers", {
    method: "GET"
  });

  return readForgeApiPayload<{ providers: ForgeModelProviderSetting[] }>(response);
}

export async function saveForgeModelProvider(
  input: SaveForgeModelProviderInput
): Promise<{
  provider: ForgeModelProviderSetting;
}> {
  const response = await fetch("/api/forge/model-providers", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mode: "save",
      ...input
    })
  });

  return readForgeApiPayload<{ provider: ForgeModelProviderSetting }>(response);
}

export async function testForgeModelProviderConnection(
  input: TestForgeModelProviderInput
): Promise<{
  provider: ForgeModelProviderSetting;
  connection: ForgeModelProviderConnectionResult;
}> {
  const response = await fetch("/api/forge/model-providers", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mode: "test",
      ...input
    })
  });

  return readForgeApiPayload<{
    provider: ForgeModelProviderSetting;
    connection: ForgeModelProviderConnectionResult;
  }>(response);
}
