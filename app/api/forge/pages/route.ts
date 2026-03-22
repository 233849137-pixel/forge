import { ForgeApiError } from "../../../../src/lib/forge-ai";
import {
  resolveForgeStablePageView
} from "../../../../src/lib/forge-page-contract";
import { resolveForgePrimaryView } from "../../../../src/lib/forge-views";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";
import { getForgeStablePageContract } from "../../../../src/server/forge-page-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawView = searchParams.get("view")?.trim();

    if (!rawView) {
      throw new ForgeApiError("页面视图不能为空", "FORGE_VALIDATION_ERROR", 400);
    }

    const resolvedPrimaryView = resolveForgePrimaryView(rawView);

    if (!resolvedPrimaryView) {
      throw new ForgeApiError("页面视图不合法", "FORGE_VALIDATION_ERROR", 400);
    }

    const stableView = resolveForgeStablePageView(rawView);

    if (!stableView) {
      throw new ForgeApiError(`页面合同暂未稳定: ${resolvedPrimaryView}`, "FORGE_NOT_FOUND", 404);
    }

    return forgeSuccess(getForgeStablePageContract(stableView));
  } catch (error) {
    return forgeError(error);
  }
}
