import {
  getRunnerRegistryForAI,
  updateRunnerHeartbeatForAI
} from "../../../../packages/ai/src";
import {
  forgeError,
  forgeSuccess,
  readJsonObjectBody,
  readNullableString,
  readRequiredString
} from "../../../../src/lib/forge-api-response";

export async function GET() {
  try {
    return forgeSuccess(getRunnerRegistryForAI());
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObjectBody(request);

    return forgeSuccess(
      updateRunnerHeartbeatForAI({
        runnerId: readRequiredString(body, "runnerId", "Runner ID"),
        status: readRequiredString(body, "status", "Runner 状态") as
          | "idle"
          | "busy"
          | "blocked"
          | "offline",
        currentRunId: readNullableString(body, "currentRunId", "当前运行 ID") ?? null,
        lastHeartbeat: readRequiredString(body, "lastHeartbeat", "心跳时间")
      })
    );
  } catch (error) {
    return forgeError(error);
  }
}
