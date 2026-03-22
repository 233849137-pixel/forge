import { retryRemediationForAI } from "../../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return forgeSuccess(
      retryRemediationForAI({
        remediationId: body.remediationId,
        triggeredBy: body.triggeredBy
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
