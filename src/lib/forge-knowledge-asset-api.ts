import type { ForgeAssetRecommendationManagementGroup } from "../../packages/core/src/types";

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

export type SaveForgeKnowledgeAssetMetadataInput = {
  sourcePath: string;
  asset: boolean;
  assetGroup: ForgeAssetRecommendationManagementGroup | null;
  assetLabel: string | null;
};

export type SaveForgeKnowledgeAssetMetadataResult = {
  sourcePath: string;
  asset: boolean;
  assetGroup: ForgeAssetRecommendationManagementGroup | null;
  assetLabel: string | null;
};

export type SaveForgeKnowledgeAssetContentInput = {
  sourcePath: string;
  body: string;
};

export type SaveForgeKnowledgeAssetContentResult = {
  sourcePath: string;
  body: string;
};

async function readForgeApiPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ForgeApiEnvelope<T>;

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.ok === false ? payload.error?.message ?? "资产写回失败。" : "资产写回失败。");
  }

  return payload.data;
}

export async function saveForgeKnowledgeAssetMetadata(
  input: SaveForgeKnowledgeAssetMetadataInput
): Promise<SaveForgeKnowledgeAssetMetadataResult> {
  const response = await fetch("/api/forge/assets/metadata", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeApiPayload<SaveForgeKnowledgeAssetMetadataResult>(response);
}

export async function saveForgeKnowledgeAssetContent(
  input: SaveForgeKnowledgeAssetContentInput
): Promise<SaveForgeKnowledgeAssetContentResult> {
  const response = await fetch("/api/forge/assets/content", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readForgeApiPayload<SaveForgeKnowledgeAssetContentResult>(response);
}
