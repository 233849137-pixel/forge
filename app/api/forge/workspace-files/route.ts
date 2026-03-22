import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readRequiredString
} from "../../../../src/lib/forge-api-response";
import { ForgeApiError } from "../../../../src/lib/forge-ai";
import {
  createForgeWorkspaceDirectory,
  createForgeWorkspaceMarkdown,
  deleteForgeWorkspaceEntry,
  listForgeWorkspaceFiles,
  readForgeWorkspaceFile,
  saveForgeWorkspaceFile
} from "../../../../src/server/forge-workspace-files";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId")?.trim();

    if (!projectId) {
      throw new ForgeApiError("项目 ID 不能为空", "FORGE_VALIDATION_ERROR", 400);
    }

    const path = searchParams.get("path")?.trim();

    if (path) {
      return forgeSuccess(readForgeWorkspaceFile(projectId, path));
    }

    return forgeSuccess(listForgeWorkspaceFiles(projectId));
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const projectId = readRequiredString(body, "projectId", "项目 ID");
    const path = readRequiredString(body, "path", "文件路径");

    if (action === "create-directory") {
      return forgeSuccess(
        createForgeWorkspaceDirectory({
          projectId,
          path
        })
      );
    }

    if (action === "create-markdown") {
      return forgeSuccess(
        createForgeWorkspaceMarkdown({
          projectId,
          path,
          body: typeof body.body === "string" ? body.body : undefined
        })
      );
    }

    return forgeSuccess(
      saveForgeWorkspaceFile({
        projectId,
        path,
        body: readRequiredString(body, "body", "正文内容")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      deleteForgeWorkspaceEntry({
        projectId: readRequiredString(body, "projectId", "项目 ID"),
        path: readRequiredString(body, "path", "文件路径")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
