import { listTasksForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    return forgeSuccess(
      listTasksForAI({
        projectId,
        status: status as "todo" | "in-progress" | "blocked" | "done" | undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
