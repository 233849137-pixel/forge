import { getRunTimelineForAI, upsertRunForAI } from "../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonBody
} from "../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    return forgeSuccess(upsertRunForAI(body));
  } catch (error) {
    return forgeError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return forgeSuccess(
      getRunTimelineForAI({
        projectId: searchParams.get("projectId") ?? undefined,
        runId: searchParams.get("runId") ?? undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
