import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postCeoChat } from "../app/api/forge/ceo-chat/route";
import { ensureForgeDatabase } from "../packages/db/src";

describe("forge ceo chat route", () => {
  const cwdSpies: Array<ReturnType<typeof vi.spyOn>> = [];
  const directories: string[] = [];

  afterEach(() => {
    while (cwdSpies.length > 0) {
      cwdSpies.pop()?.mockRestore();
    }

    while (directories.length > 0) {
      rmSync(directories.pop() as string, { force: true, recursive: true });
    }

    vi.unstubAllEnvs();
  });

  function prepareWorkspace() {
    const directory = mkdtempSync(join(tmpdir(), "forge-ceo-chat-"));
    const dbPath = join(directory, "data", "forge.db");

    directories.push(directory);
    cwdSpies.push(vi.spyOn(process, "cwd").mockReturnValue(directory));
    ensureForgeDatabase(dbPath);

    return { directory, dbPath };
  }

  it("always treats CEO chat as portfolio scope even if project scope and projectId are provided", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_PM_EXEC_PROVIDER", "OpenClaw PM");
    vi.stubEnv("FORGE_PM_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_PM_EXEC_BACKEND_COMMAND",
      `python3 -c "import json; print(json.dumps({'payloads':[{'text':'CEO portfolio ok'}]}))"`
    );

    const response = await postCeoChat(
      new Request("http://127.0.0.1:3000/api/forge/ceo-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          prompt: "现在最该优先推进哪个项目？",
          projectId: "retail-support",
          scope: "project",
          triggeredBy: "Forge · 仪表盘 · CEO 对话"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.projectId).toBe("portfolio");
    expect(payload.data.projectName).toBe("全部项目");
    expect(payload.data.stage).toBe("组合视图");
    expect(payload.data.reply).toBe("CEO portfolio ok");
    expect(payload.data.commandPreview).toContain("全部项目");
    expect(payload.data.commandPreview).not.toContain("当前面对的是项目《零售客服副驾驶》");
    expect(payload.data.commandPreview).toContain("当前面对的是全部项目组合");
  });
});
