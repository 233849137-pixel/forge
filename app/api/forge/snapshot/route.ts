import { getSnapshotForAI } from "../../../../packages/ai/src/forge-ai";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getSnapshotForAI());
  } catch (error) {
    return forgeError(error);
  }
}
