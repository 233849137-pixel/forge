import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeForgeCommand,
  sendForgeWorkbenchChatMessage
} from "../src/lib/forge-command-api";

describe("forge command api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes a forge command through the command route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            execution: {
              id: "command-execution-gate-run-new",
              commandId: "command-gate-run",
              status: "done",
              summary: "测试门禁已执行完成。"
            }
          }
        }),
        { status: 200 }
      )
    );

    const result = await executeForgeCommand({
      commandId: "command-gate-run",
      projectId: "retail-support",
      extraNotes: "补充一版退款失败的回归口径",
      selectedModel: "Claude Code Review",
      thinkingBudget: "高",
      triggeredBy: "项目工作台"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/commands", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        mode: "execute",
        commandId: "command-gate-run",
        projectId: "retail-support",
        extraNotes: "补充一版退款失败的回归口径",
        selectedModel: "Claude Code Review",
        thinkingBudget: "高",
        triggeredBy: "项目工作台"
      })
    });
    expect(result.execution.commandId).toBe("command-gate-run");
    expect(result.execution.summary).toContain("测试门禁");
  });

  it("throws the backend message when command execution fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORGE_NOT_FOUND",
            message: "命令不存在"
          }
        }),
        { status: 404 }
      )
    );

    await expect(
      executeForgeCommand({
        commandId: "command-missing",
        projectId: "retail-support",
        triggeredBy: "项目工作台"
      })
    ).rejects.toThrow("命令不存在");
  });

  it("sends a pure workbench chat request through the command route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            modelExecution: {
              providerId: "kimi-coding",
              providerLabel: "Kimi Coding",
              model: "k2p5",
              status: "success",
              summary: "Kimi Coding · k2p5",
              message: "Kimi Coding 已生成工作台回复。",
              content: "在的，我现在可以正常回复你。",
              tokenUsage: {
                inputTokens: 128,
                outputTokens: 256,
                totalTokens: 384
              }
            }
          }
        }),
        { status: 200 }
      )
    );

    const result = await sendForgeWorkbenchChatMessage({
      projectId: "retail-support",
      prompt: "在吗",
      selectedModel: "k2p5",
      thinkingBudget: "自动",
      triggeredBy: "项目工作台",
      workbenchNode: "DEMO测试"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/commands", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        mode: "chat",
        projectId: "retail-support",
        prompt: "在吗",
        selectedModel: "k2p5",
        thinkingBudget: "自动",
        triggeredBy: "项目工作台",
        workbenchNode: "DEMO测试"
      })
    });
    expect(result.modelExecution.content).toContain("我现在可以正常回复你");
    expect((result.modelExecution as any).tokenUsage).toEqual({
      inputTokens: 128,
      outputTokens: 256,
      totalTokens: 384
    });
  });
});
