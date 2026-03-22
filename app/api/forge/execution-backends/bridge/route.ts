import { bridgeExecutionBackendDispatchForAI } from "../../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readOptionalString
} from "../../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);
    const strategy = readOptionalString(body, "strategy", "桥接策略");

    return forgeSuccess(
      await bridgeExecutionBackendDispatchForAI({
        remediationId: readOptionalString(body, "remediationId", "整改入口 ID"),
        taskId: readOptionalString(body, "taskId", "任务 ID"),
        projectId: readOptionalString(body, "projectId", "项目 ID"),
        triggeredBy: readOptionalString(body, "triggeredBy", "触发人"),
        strategy: strategy as "stub" | "local-shell" | undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
