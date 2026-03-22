import { ForgeApiError } from "../../../../../src/lib/forge-ai";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readNullableString,
  readRequiredString
} from "../../../../../src/lib/forge-api-response";
import { saveForgeKnowledgeAssetMetadata } from "../../../../../src/server/forge-knowledge-asset-writeback";

function readRequiredBoolean(body: Record<string, unknown>, key: string, label: string) {
  const value = body[key];

  if (typeof value !== "boolean") {
    throw new ForgeApiError(`${label}必须是布尔值`, "FORGE_VALIDATION_ERROR", 400);
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      saveForgeKnowledgeAssetMetadata({
        sourcePath: readRequiredString(body, "sourcePath", "资产路径"),
        asset: readRequiredBoolean(body, "asset", "资产状态"),
        assetGroup: readNullableString(body, "assetGroup", "资产分组"),
        assetLabel: readNullableString(body, "assetLabel", "资产标签")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
