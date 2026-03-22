import { probeRunnersForAI } from "../../../../../packages/ai/src";
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
      probeRunnersForAI({
        runnerId: readOptionalString(body, "runnerId", "Runner ID")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
