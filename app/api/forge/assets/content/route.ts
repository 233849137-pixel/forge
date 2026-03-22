import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readRequiredString
} from "../../../../../src/lib/forge-api-response";
import { saveForgeKnowledgeAssetContent } from "../../../../../src/server/forge-knowledge-asset-writeback";

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      saveForgeKnowledgeAssetContent({
        sourcePath: readRequiredString(body, "sourcePath", "资产路径"),
        body: readRequiredString(body, "body", "正文内容")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
