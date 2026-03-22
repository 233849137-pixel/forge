import { NextResponse } from "next/server";
import { ForgeApiError } from "./forge-ai";

type JsonObjectBody = Record<string, unknown>;

export function forgeSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      ok: true,
      data
    },
    init
  );
}

export function forgeError(error: unknown) {
  if (error instanceof ForgeApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "FORGE_INTERNAL_ERROR",
        message: "Forge 内部错误"
      }
    },
    { status: 500 }
  );
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ForgeApiError("请求体必须是合法 JSON", "FORGE_INVALID_JSON", 400);
  }
}

export async function readJsonObjectBody(request: Request): Promise<JsonObjectBody> {
  const body = await readJsonBody(request);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ForgeApiError("请求体必须是 JSON 对象", "FORGE_INVALID_JSON_OBJECT", 400);
  }

  return body as JsonObjectBody;
}

export function readOptionalString(
  body: JsonObjectBody,
  key: string,
  label: string
) {
  const value = body[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ForgeApiError(`${label}必须是字符串`, "FORGE_VALIDATION_ERROR", 400);
  }

  const normalized = value.trim();

  return normalized ? normalized : undefined;
}

export function readNullableString(
  body: JsonObjectBody,
  key: string,
  label: string
) {
  const value = body[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ForgeApiError(`${label}必须是字符串`, "FORGE_VALIDATION_ERROR", 400);
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}

export function readRequiredString(
  body: JsonObjectBody,
  key: string,
  label: string
) {
  const value = body[key];

  if (value === undefined || value === null) {
    throw new ForgeApiError(`${label}不能为空`, "FORGE_VALIDATION_ERROR", 400);
  }

  if (typeof value !== "string") {
    throw new ForgeApiError(`${label}必须是字符串`, "FORGE_VALIDATION_ERROR", 400);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new ForgeApiError(`${label}不能为空`, "FORGE_VALIDATION_ERROR", 400);
  }

  return normalized;
}
