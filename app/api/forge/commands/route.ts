import {
  executeCommandWithModelForAI,
  generateWorkbenchChatReplyForAI,
  getCommandCenterForAI,
  recordCommandExecutionForAI
} from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getCommandCenterForAI());
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (payload?.mode === "chat") {
      return forgeSuccess(await generateWorkbenchChatReplyForAI(payload));
    }

    if (payload?.mode === "execute") {
      return forgeSuccess(await executeCommandWithModelForAI(payload));
    }

    return forgeSuccess(recordCommandExecutionForAI(payload));
  } catch (error) {
    return forgeError(error);
  }
}
