import { retryEscalationForAI } from "../../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      taskId?: string;
      triggeredBy?: string;
    };

    return forgeSuccess(
      retryEscalationForAI({
        taskId: body.taskId ?? "",
        triggeredBy: body.triggeredBy
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
