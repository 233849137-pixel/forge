import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildNanoClawManagerCommand,
  parseNanoClawManagerArgs,
  probeNanoClawManagerHealth,
  runNanoClawManagerCommand
} from "../scripts/lib/forge-nanoclaw-manager.mjs";

describe("forge nanoclaw manager wrapper", () => {
  afterEach(() => {
    delete process.env.FORGE_EXECUTION_PAYLOAD;
    delete process.env.FORGE_NANO_EXEC_BIN;
    delete process.env.FORGE_NANO_MANAGE_COMMAND;
    delete process.env.FORGE_NANO_HEALTHCHECK_COMMAND;
  });

  it("parses manager arguments with required routing fields", () => {
    const parsed = parseNanoClawManagerArgs([
      "--command",
      "review.run",
      "--project-id",
      "retail-support",
      "--stage",
      "测试验证",
      "--taskpack-id",
      "artifact-taskpack-retail",
      "--agent-id",
      "agent-architect",
      "--controller-id",
      "agent-service-strategy",
      "--provider",
      "Nano CEO",
      "--workspace",
      "/tmp/forge/workspaces/retail-support"
    ]);

    expect(parsed.commandType).toBe("review.run");
    expect(parsed.projectId).toBe("retail-support");
    expect(parsed.stage).toBe("测试验证");
    expect(parsed.taskPackId).toBe("artifact-taskpack-retail");
    expect(parsed.agentId).toBe("agent-architect");
    expect(parsed.controllerId).toBe("agent-service-strategy");
    expect(parsed.provider).toBe("Nano CEO");
    expect(parsed.workspace).toBe("/tmp/forge/workspaces/retail-support");
  });

  it("builds a nanoclaw manage command and writes a payload file when execution context exists", () => {
    process.env.FORGE_NANO_EXEC_BIN = "/usr/local/bin/nanoclaw";
    process.env.FORGE_EXECUTION_PAYLOAD = JSON.stringify({
      projectId: "retail-support",
      commandType: "review.run",
      controllerAgent: {
        id: "agent-service-strategy",
        name: "项目牧羊人 Agent"
      }
    });

    const prepared = buildNanoClawManagerCommand({
      commandType: "review.run",
      projectId: "retail-support",
      stage: "测试验证",
      taskPackId: "artifact-taskpack-retail",
      agentId: "agent-architect",
      controllerId: "agent-service-strategy",
      provider: "Nano CEO",
      workspace: "/tmp/forge/workspaces/retail-support"
    });

    expect(prepared.cwd).toBe("/tmp/forge/workspaces/retail-support");
    expect(prepared.command[0]).toBe("/usr/local/bin/nanoclaw");
    expect(prepared.command).toEqual(
      expect.arrayContaining([
        "manage",
        "--command",
        "review.run",
        "--project",
        "retail-support",
        "--agent",
        "agent-architect",
        "--controller",
        "agent-service-strategy",
        "--provider",
        "Nano CEO",
        "--payload-file"
      ])
    );
    expect(prepared.payloadFilePath).toBeTruthy();
  });

  it("normalizes a NanoClaw JSON health handshake through the manager wrapper", async () => {
    const result = await probeNanoClawManagerHealth({
      FORGE_NANO_HEALTHCHECK_COMMAND:
        'node -e "process.stdout.write(JSON.stringify({status:\'ready\',summary:\'Nano 在线握手成功\',details:[\'CEO manager ready\'],version:\'nano-1.0.0\'}))"'
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "ready",
        summary: "Nano 在线握手成功",
        details: expect.arrayContaining(["CEO manager ready"]),
        version: "nano-1.0.0"
      })
    );
  });

  it("normalizes a NanoClaw execution receipt through the manager wrapper", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "forge-nano-manager-"));
    const result = await runNanoClawManagerCommand(
      {
        commandType: "review.run",
        projectId: "retail-support",
        stage: "测试验证",
        taskPackId: "artifact-taskpack-retail",
        agentId: "agent-architect",
        controllerId: "agent-service-strategy",
        provider: "Nano CEO",
        workspace
      },
      {
        FORGE_NANO_MANAGE_COMMAND:
          'node -e "process.stdout.write(JSON.stringify({ok:true,status:\'done\',summary:\'Nano 审查回执已生成\',artifacts:[{type:\'review-report\',title:\'Nano 审查记录\',ownerAgentId:\'agent-architect\',status:\'ready\'}],checks:[{name:\'receipt\',status:\'pass\'}],details:[\'review lane complete\']}))"'
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "done",
        summary: "Nano 审查回执已生成",
        artifacts: [
          {
            type: "review-report",
            title: "Nano 审查记录",
            ownerAgentId: "agent-architect",
            status: "ready"
          }
        ],
        checks: [{ name: "receipt", status: "pass" }],
        details: expect.arrayContaining(["review lane complete"])
      })
    );
  });
});
