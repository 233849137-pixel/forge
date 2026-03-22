import { getAssetRecommendationsForAI } from "../../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return forgeSuccess(
      getAssetRecommendationsForAI({
        projectId: searchParams.get("projectId") ?? undefined,
        taskPackId: searchParams.get("taskPackId") ?? undefined,
        stage: searchParams.get("stage") as
          | "项目接入"
          | "方案与任务包"
          | "开发执行"
          | "测试验证"
          | "交付发布"
          | "归档复用"
          | undefined,
        query: searchParams.get("query") ?? undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
