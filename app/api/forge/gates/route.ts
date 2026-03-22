import { getGateStatusForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getGateStatusForAI());
  } catch (error) {
    return forgeError(error);
  }
}
