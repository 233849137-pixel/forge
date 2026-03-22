import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readRequiredString,
} from "../../../../../src/lib/forge-api-response";
import { ForgeApiError } from "../../../../../src/lib/forge-ai";
import {
  readForgeKnowledgeNoteContent,
  saveForgeKnowledgeNoteContent,
} from "../../../../../src/server/forge-knowledge-note-content";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get("relativePath")?.trim();

    if (!relativePath) {
      throw new ForgeApiError("笔记路径不能为空", "FORGE_VALIDATION_ERROR", 400);
    }

    return forgeSuccess(readForgeKnowledgeNoteContent(relativePath));
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      saveForgeKnowledgeNoteContent(
        readRequiredString(body, "relativePath", "笔记路径"),
        readRequiredString(body, "body", "正文内容"),
      ),
    );
  } catch (error) {
    return forgeError(error);
  }
}
