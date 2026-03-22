import { getProjectTemplatesForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getProjectTemplatesForAI());
  } catch (error) {
    return forgeError(error);
  }
}
