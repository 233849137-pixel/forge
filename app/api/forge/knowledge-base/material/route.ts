import { forgeError } from "../../../../../src/lib/forge-api-response";
import { ForgeApiError } from "../../../../../src/lib/forge-ai";
import { readForgeKnowledgeMaterialContent } from "../../../../../src/server/forge-knowledge-material-content";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get("relativePath")?.trim();

    if (!relativePath) {
      throw new ForgeApiError("素材路径不能为空", "FORGE_VALIDATION_ERROR", 400);
    }

    const material = readForgeKnowledgeMaterialContent(relativePath);

    return new Response(material.body, {
      status: 200,
      headers: {
        "content-type": material.contentType,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return forgeError(error);
  }
}
