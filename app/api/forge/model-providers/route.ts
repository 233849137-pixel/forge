import {
  getModelProviderSettingsForAI,
  testModelProviderConnectionForAI,
  updateModelProviderSettingsForAI
} from "../../../../packages/ai/src";
import type { ForgeModelProviderId } from "../../../../packages/core/src/types";
import { ForgeApiError } from "../../../../src/lib/forge-ai";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readOptionalString,
  readRequiredString
} from "../../../../src/lib/forge-api-response";

function readOptionalBoolean(body: Record<string, unknown>, key: string, label: string) {
  const value = body[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ForgeApiError(`${label}必须是布尔值`, "FORGE_VALIDATION_ERROR", 400);
  }

  return value;
}

function readOptionalStringArray(body: Record<string, unknown>, key: string, label: string) {
  const value = body[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ForgeApiError(`${label}必须是字符串数组`, "FORGE_VALIDATION_ERROR", 400);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

export async function GET() {
  try {
    return forgeSuccess(getModelProviderSettingsForAI());
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);
    const mode = readRequiredString(body, "mode", "操作模式");
    const providerId = readRequiredString(body, "providerId", "模型供应商 ID");

    if (mode === "save") {
      return forgeSuccess(
        updateModelProviderSettingsForAI({
          providerId: providerId as ForgeModelProviderId,
          enabled: readOptionalBoolean(body, "enabled", "启用状态"),
          apiKey: readOptionalString(body, "apiKey", "API 密钥"),
          modelPriority: readOptionalStringArray(body, "modelPriority", "模型优先级")
        })
      );
    }

    if (mode === "test") {
      return forgeSuccess(
        await testModelProviderConnectionForAI({
          providerId: providerId as ForgeModelProviderId,
          apiKey: readOptionalString(body, "apiKey", "API 密钥"),
          model: readOptionalString(body, "model", "测试模型")
        })
      );
    }

    throw new ForgeApiError("不支持的操作模式", "FORGE_VALIDATION_ERROR", 400);
  } catch (error) {
    return forgeError(error);
  }
}
