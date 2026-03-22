import { getPromptTemplatesForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getPromptTemplatesForAI());
  } catch (error) {
    return forgeError(error);
  }
}
