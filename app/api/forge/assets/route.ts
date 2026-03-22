import { searchAssetsForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") ?? undefined;
    const type = searchParams.get("type") ?? undefined;

    return forgeSuccess(
      searchAssetsForAI({
        query,
        type: type as "template" | "prompt" | "skill" | "gate" | undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
