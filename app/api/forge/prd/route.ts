import { generatePrdDraftForAI } from "../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonBody
} from "../../../../src/lib/forge-api-response";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    return forgeSuccess(generatePrdDraftForAI(body), { status: 201 });
  } catch (error) {
    return forgeError(error);
  }
}
