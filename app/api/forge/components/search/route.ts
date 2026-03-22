import { searchExternalComponentResourcesForAI } from "../../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tags = (searchParams.get("tags") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return forgeSuccess(
      await searchExternalComponentResourcesForAI({
        projectId: searchParams.get("projectId") ?? undefined,
        taskPackId: searchParams.get("taskPackId") ?? undefined,
        query: searchParams.get("query") ?? undefined,
        tags,
        category: searchParams.get("category") as
          | "auth"
          | "payment"
          | "file"
          | "data"
          | "communication"
          | undefined,
        sector: searchParams.get("sector") ?? undefined,
        sourceType: searchParams.get("sourceType") as "internal" | "github" | undefined,
        language: searchParams.get("language") ?? undefined,
        maturity: searchParams.get("maturity") as "seed" | "active" | "established" | undefined,
        maxItems: searchParams.get("maxItems") ? Number(searchParams.get("maxItems")) : undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
