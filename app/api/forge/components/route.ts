import { getComponentRegistryForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return forgeSuccess(
      getComponentRegistryForAI({
        projectId: searchParams.get("projectId") ?? undefined,
        taskPackId: searchParams.get("taskPackId") ?? undefined,
        query: searchParams.get("query") ?? undefined,
        category: searchParams.get("category") as
          | "auth"
          | "payment"
          | "file"
          | "data"
          | "communication"
          | undefined,
        sector: searchParams.get("sector") ?? undefined,
        sourceType: searchParams.get("sourceType") as "internal" | "github" | undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
