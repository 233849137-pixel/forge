import { dispatchExecutionBackendRequestForAI } from "../../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readOptionalString
} from "../../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      dispatchExecutionBackendRequestForAI({
        remediationId: readOptionalString(body, "remediationId", "整改入口 ID"),
        taskId: readOptionalString(body, "taskId", "任务 ID"),
        projectId: readOptionalString(body, "projectId", "项目 ID"),
        triggeredBy: readOptionalString(body, "triggeredBy", "触发人")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
