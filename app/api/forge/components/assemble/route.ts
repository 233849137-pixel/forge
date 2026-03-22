import { applyComponentAssemblyForAI, getComponentAssemblyPlanForAI } from "../../../../../packages/ai/src";
import { forgeError, forgeSuccess } from "../../../../../src/lib/forge-api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return forgeSuccess(
      getComponentAssemblyPlanForAI({
        projectId: searchParams.get("projectId") ?? undefined,
        taskPackId: searchParams.get("taskPackId") ?? undefined,
        maxItems: searchParams.get("maxItems")
          ? Number(searchParams.get("maxItems"))
          : undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return forgeSuccess(
      applyComponentAssemblyForAI({
        projectId: typeof body.projectId === "string" ? body.projectId : undefined,
        taskPackId: typeof body.taskPackId === "string" ? body.taskPackId : undefined,
        componentIds: Array.isArray(body.componentIds) ? body.componentIds : [],
        triggeredBy: typeof body.triggeredBy === "string" ? body.triggeredBy : undefined
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
