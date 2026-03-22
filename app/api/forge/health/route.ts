import { forgeSuccess } from "../../../../src/lib/forge-api-response";

export async function GET() {
  return forgeSuccess({
    service: "forge-local-api",
    status: "ok"
  });
}
