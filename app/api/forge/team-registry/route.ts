import {
  getTeamRegistryForAI,
  updateAgentProfileForAI
} from "../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonBody
} from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getTeamRegistryForAI());
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    return forgeSuccess(updateAgentProfileForAI(body));
  } catch (error) {
    return forgeError(error);
  }
}
