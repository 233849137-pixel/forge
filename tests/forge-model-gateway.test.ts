import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgeModelProviderSetting } from "../packages/core/src/types";
import {
  FORGE_LOCAL_FALLBACK_MODEL_OPTION,
  generateModelGatewayChatReply,
  generateModelGatewayReply,
  getModelGatewayProviderCatalog,
  resolveModelGatewaySelection,
  testModelGatewayConnection
} from "../packages/model-gateway/src";

function createProviderSetting(
  input: Partial<ForgeModelProviderSetting> & Pick<ForgeModelProviderSetting, "id" | "label">
): ForgeModelProviderSetting {
  return {
    id: input.id,
    label: input.label,
    vendor: input.vendor ?? `${input.label} Vendor`,
    summary: input.summary ?? `${input.label} summary`,
    enabled: input.enabled ?? true,
    hasApiKey: input.hasApiKey ?? true,
    apiKeyHint: input.apiKeyHint ?? "sk-••••",
    modelPriority: input.modelPriority ?? [],
    defaultModelPriority: input.defaultModelPriority ?? input.modelPriority ?? [],
    catalogModels: input.catalogModels ?? [],
    docsUrl: input.docsUrl ?? "https://example.com",
    baseUrl: input.baseUrl ?? "https://example.com/v1",
    status: input.status ?? "untested",
    lastTestedAt: input.lastTestedAt ?? null,
    lastTestMessage: input.lastTestMessage ?? null,
    supportsCustomModels: input.supportsCustomModels ?? true
  };
}

describe("forge model gateway", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a four-provider catalog for local model configuration", () => {
    const catalog = getModelGatewayProviderCatalog();

    expect(catalog.map((provider) => provider.id)).toEqual([
      "kimi",
      "kimi-coding",
      "openai",
      "anthropic",
      "google"
    ]);
    expect(catalog.find((provider) => provider.id === "kimi")?.defaultModelPriority).toEqual([
      "kimi-k2.5"
    ]);
    expect(catalog.find((provider) => provider.id === "kimi-coding")?.defaultModelPriority).toEqual([
      "k2p5"
    ]);
    expect(catalog.find((provider) => provider.id === "openai")?.catalogModels).toEqual(
      expect.arrayContaining(["gpt-5.4", "gpt-4.1-mini"])
    );
    expect(catalog.find((provider) => provider.id === "anthropic")?.catalogModels).toEqual(
      expect.arrayContaining(["claude-sonnet-4-5", "claude-opus-4-1"])
    );
    expect(catalog.find((provider) => provider.id === "google")?.catalogModels).toEqual(
      expect.arrayContaining(["gemini-2.5-pro", "gemini-2.5-flash"])
    );
  });

  it("resolves a selected model to the matching enabled provider", () => {
    const selection = resolveModelGatewaySelection("gpt-5.4", [
      createProviderSetting({
        id: "openai",
        label: "OpenAI",
        modelPriority: ["gpt-5.4", "gpt-4.1-mini"],
        defaultModelPriority: ["gpt-5.4"],
        catalogModels: ["gpt-5.4", "gpt-4.1-mini"]
      }),
      createProviderSetting({
        id: "anthropic",
        label: "Anthropic Claude",
        modelPriority: ["claude-sonnet-4-5"],
        defaultModelPriority: ["claude-sonnet-4-5"],
        catalogModels: ["claude-sonnet-4-5"]
      })
    ]);

    expect(selection).toEqual({
      providerId: "openai",
      providerLabel: "OpenAI",
      model: "gpt-5.4"
    });
  });

  it("can infer the provider from a known model family even if it is not manually prioritized", () => {
    const selection = resolveModelGatewaySelection("gemini-2.5-pro", [
      createProviderSetting({
        id: "google",
        label: "Google Gemini",
        modelPriority: ["gemini-2.5-flash"],
        defaultModelPriority: ["gemini-2.5-pro"],
        catalogModels: ["gemini-2.5-pro", "gemini-2.5-flash"]
      })
    ]);

    expect(selection).toEqual({
      providerId: "google",
      providerLabel: "Google Gemini",
      model: "gemini-2.5-pro"
    });
  });

  it("resolves kimi coding selections from configured catalog models", () => {
    const selection = resolveModelGatewaySelection("k2p5", [
      createProviderSetting({
        id: "kimi-coding",
        label: "Kimi Coding",
        modelPriority: ["k2p5"],
        defaultModelPriority: ["k2p5"],
        catalogModels: ["k2p5"]
      })
    ]);

    expect(selection).toEqual({
      providerId: "kimi-coding",
      providerLabel: "Kimi Coding",
      model: "k2p5"
    });
  });

  it("treats the explicit local fallback option as opting out of external model calls", () => {
    const selection = resolveModelGatewaySelection(FORGE_LOCAL_FALLBACK_MODEL_OPTION, [
      createProviderSetting({
        id: "kimi",
        label: "Moonshot Kimi",
        modelPriority: ["kimi-k2.5"],
        defaultModelPriority: ["kimi-k2.5"],
        catalogModels: ["kimi-k2.5"]
      })
    ]);

    expect(selection).toBeNull();
  });

  it("builds the anthropic connection request with the expected headers and endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "OK" }]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const result = await testModelGatewayConnection({
      providerId: "anthropic",
      apiKey: "sk-ant-local-123456",
      model: "claude-sonnet-4-5"
    });

    expect(result).toEqual({
      status: "success",
      message: "Anthropic Claude 连接成功，可用于工作台模型调用。"
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-local-123456",
          "anthropic-version": "2023-06-01"
        })
      })
    );
  });

  it("maps google api errors into a readable connection message", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "API key not valid. Please pass a valid API key."
          }
        }),
        { status: 400 }
      )
    ) as typeof global.fetch;

    const result = await testModelGatewayConnection({
      providerId: "google",
      apiKey: "google-key-123",
      model: "gemini-2.5-pro"
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("API key not valid");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=google-key-123",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("parses anthropic workbench replies into plain text content", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Claude 已输出一版结构化 PRD 建议。" }]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const result = await generateModelGatewayReply({
      providerId: "anthropic",
      apiKey: "sk-ant-local-123456",
      model: "claude-sonnet-4-5",
      projectName: "零售客服副驾驶",
      commandName: "生成 PRD",
      commandType: "prd.generate",
      executionSummary: "已生成 PRD 草案。",
      prompt: "补充退款失败口径",
      thinkingBudget: "高"
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        content: "Claude 已输出一版结构化 PRD 建议。"
      })
    );
  });

  it("builds the kimi coding connection request with the expected headers and endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "OK" }]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const result = await testModelGatewayConnection({
      providerId: "kimi-coding",
      apiKey: "sk-kimi-coding-local-123456",
      model: "k2p5"
    });

    expect(result).toEqual({
      status: "success",
      message: "Kimi Coding 连接成功，可用于工作台模型调用。"
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.kimi.com/coding/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "sk-kimi-coding-local-123456",
          "anthropic-version": "2023-06-01",
          "User-Agent": "claude-code/0.1.0"
        })
      })
    );
  });

  it("builds workbench prompts that prioritize answering the latest user request", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "可以，我现在工作正常。" }]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    await generateModelGatewayReply({
      providerId: "kimi-coding",
      apiKey: "sk-kimi-coding-local-123456",
      model: "k2p5",
      projectName: "零售客服副驾驶",
      commandName: "生成 PRD",
      commandType: "prd.generate",
      executionSummary: "已生成 PRD 草案。",
      prompt: "请先一句话告诉我你现在能不能正常工作",
      thinkingBudget: "高"
    });

    const request = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      system: string;
      messages: Array<{ content: string }>;
    };

    expect(body.system).toContain("优先直接回答用户刚刚提出的明确问题");
    expect(body.messages[0]?.content).toContain("请先一句话告诉我你现在能不能正常工作");
  });

  it("builds pure workbench chat prompts without injecting fake execution context", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "在的，我现在可以正常回复你。" }]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    await generateModelGatewayChatReply({
      providerId: "kimi-coding",
      apiKey: "sk-kimi-coding-local-123456",
      model: "k2p5",
      projectName: "零售客服副驾驶",
      workbenchNode: "DEMO测试",
      prompt: "在吗",
      thinkingBudget: "自动"
    });

    const request = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      system: string;
      messages: Array<{ content: string }>;
    };

    expect(body.system).toContain("像真实对话一样先直接回答用户刚刚这句输入");
    expect(body.messages[0]?.content).toContain("用户当前输入：在吗");
    expect(body.messages[0]?.content).not.toContain("执行摘要：");
    expect(body.messages[0]?.content).not.toContain("当前动作：");
  });

  it("injects resolved agent context blocks into workbench chat prompts", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "可以，当前上下文已经完整。"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    await generateModelGatewayChatReply({
      providerId: "openai",
      apiKey: "sk-openai-local-123456",
      model: "gpt-5.4",
      projectName: "零售客服副驾驶",
      workbenchNode: "后端研发",
      prompt: "现在做到哪了？",
      agentContext: {
        identity: {
          agentId: "agent-engineer",
          name: "后端研发 Agent",
          role: "engineer",
          persona: "接口、数据链路和服务稳定性优先。",
          ownerMode: "auto-execute"
        },
        rolePrompt:
          "你是后端研发 Agent。核心使命：根据 TaskPack 快速产出可运行的服务实现、接口能力和数据持久化结果。",
        skills: [
          {
            id: "skill-codegen",
            name: "任务包代码生成",
            summary: "根据 TaskPack 和架构说明生成最小可运行补丁。",
            usageGuide: "仅在 TaskPack 完整且架构说明已 ready 时调用。"
          },
          {
            id: "skill-db",
            name: "本地数据层集成",
            summary: "处理 SQLite、本地状态和数据对象持久化。",
            usageGuide: "涉及状态落盘、迁移或快照结构调整时调用。"
          }
        ],
        sops: [
          {
            id: "sop-taskpack-execution",
            name: "TaskPack 执行 SOP",
            summary: "基于 TaskPack 逐项实现和提交补丁。",
            checklist: ["先读 TaskPack", "再看架构说明", "最后输出补丁"]
          }
        ],
        knowledgeSources: ["服务治理规范", "数据库集成手册"],
        knowledgeSnippets: [
          {
            label: "服务治理规范",
            summary: "优先对齐接口边界、错误语义和降级策略。",
            sourceTitle: "服务治理规范",
            matchReason: "工作区知识命中"
          }
        ],
        projectContext: {
          projectId: "retail-support",
          projectName: "零售客服副驾驶",
          goal: "修复支付失败链路并补齐接口与回归说明。",
          currentNode: "后端研发",
          currentStage: "开发执行",
          blockers: ["等待补齐支付失败异常态说明"]
        },
        deliverables: [
          {
            id: "artifact-taskpack-retail",
            type: "task-pack",
            label: "TaskPack",
            title: "支付失败修复任务包",
            status: "ready",
            updatedAt: "今天 10:10",
            summary: "任务包已 ready，允许进入实现阶段。"
          }
        ],
        tools: [
          {
            id: "workspace-write",
            label: "文件写入",
            summary: "允许在工作区内写入补丁、脚本和交付说明。",
            mode: "write"
          },
          {
            id: "shell-run",
            label: "命令执行",
            summary: "允许在工作区内执行研发和回归相关命令。",
            mode: "execute"
          }
        ],
        paths: {
          workspaceRoot: "/tmp/forge/retail-support",
          artifactsRoot: "/tmp/forge/retail-support/artifacts",
          uploadsRoot: "/tmp/forge/retail-support/uploads",
          knowledgeRoot: "/tmp/forge/retail-support/knowledge",
          skillsRoot: "/tmp/forge/retail-support/skills"
        },
        budget: {
          maxSkills: 3,
          maxSops: 2,
          maxKnowledgeSnippets: 3,
          maxDeliverables: 4
        }
      }
    });

    const request = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };

    expect(body.messages[0]?.content).toContain("岗位设定");
    expect(body.messages[1]?.content).toContain("技能摘要");
    expect(body.messages[1]?.content).toContain("任务包代码生成");
    expect(body.messages[1]?.content).toContain("TaskPack 执行 SOP");
    expect(body.messages[1]?.content).toContain("当前交付物");
    expect(body.messages[1]?.content).toContain("支付失败修复任务包");
    expect(body.messages[1]?.content).toContain("关键阻塞");
    expect(body.messages[1]?.content).toContain("可用工具");
    expect(body.messages[1]?.content).toContain("文件写入");
    expect(body.messages[1]?.content).toContain("命令执行");
    expect(body.messages[1]?.content).toContain("工作区路径");
    expect(body.messages[1]?.content).toContain("/tmp/forge/retail-support/artifacts");
  });
});
