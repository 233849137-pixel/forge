import { activateProjectForAI } from "../../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readRequiredString
} from "../../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(activateProjectForAI(readRequiredString(body, "projectId", "项目 ID")));
  } catch (error) {
    return forgeError(error);
  }
}
