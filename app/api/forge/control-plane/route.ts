import { getControlPlaneSnapshotForAI } from "../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;

    return forgeSuccess(getControlPlaneSnapshotForAI({ projectId }));
  } catch (error) {
    return forgeError(error);
  }
}
