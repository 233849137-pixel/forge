import type {
  ForgeCommandModelExecution,
  ForgeModelProviderConnectionResult,
  ForgeModelProviderId,
  ForgeResolvedAgentContext,
  ForgeModelProviderSetting,
  ForgeTokenUsage
} from "../../core/src/types";

export const FORGE_LOCAL_FALLBACK_MODEL_OPTION = "Forge 本机默认回复";

type ForgeModelGatewayProviderCatalogEntry = Pick<
  ForgeModelProviderSetting,
  | "id"
  | "label"
  | "vendor"
  | "summary"
  | "docsUrl"
  | "baseUrl"
  | "supportsCustomModels"
  | "defaultModelPriority"
  | "catalogModels"
>;

type ForgeModelGatewaySelection = {
  providerId: ForgeModelProviderId;
  providerLabel: string;
  model: string;
};

type ProviderPromptConfig = {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
};

type ProviderResponse = {
  status: ForgeCommandModelExecution["status"];
  message: string;
  content?: string;
  tokenUsage?: ForgeTokenUsage | null;
};

const providerCatalog: readonly ForgeModelGatewayProviderCatalogEntry[] = Object.freeze([
  {
    id: "kimi",
    label: "Moonshot Kimi",
    vendor: "Moonshot AI",
    summary: "接入 Moonshot Kimi 模型，适合中文工作台回复和交付整理。",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    baseUrl: "https://api.moonshot.cn/v1",
    supportsCustomModels: true,
    defaultModelPriority: ["kimi-k2.5"],
    catalogModels: ["kimi-k2.5", "kimi-thinking-preview"]
  },
  {
    id: "kimi-coding",
    label: "Kimi Coding",
    vendor: "Kimi",
    summary: "接入 Kimi Coding 模型，适合代码生成、修复建议和工程型工作台回复。",
    docsUrl: "https://www.kimi.com/",
    baseUrl: "https://api.kimi.com/coding/v1",
    supportsCustomModels: true,
    defaultModelPriority: ["k2p5"],
    catalogModels: ["k2p5", "kimi-for-coding"]
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    summary: "接入 OpenAI 通用模型，可作为项目工作台的高泛化补充。",
    docsUrl: "https://platform.openai.com/api-keys",
    baseUrl: "https://api.openai.com/v1",
    supportsCustomModels: true,
    defaultModelPriority: ["gpt-5.4"],
    catalogModels: ["gpt-5.4", "gpt-4.1-mini"]
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    vendor: "Anthropic",
    summary: "接入 Anthropic Claude 模型，适合长文推理和审阅型回复。",
    docsUrl: "https://console.anthropic.com/settings/keys",
    baseUrl: "https://api.anthropic.com/v1",
    supportsCustomModels: true,
    defaultModelPriority: ["claude-sonnet-4-5"],
    catalogModels: ["claude-sonnet-4-5", "claude-opus-4-1"]
  },
  {
    id: "google",
    label: "Google Gemini",
    vendor: "Google",
    summary: "接入 Google Gemini 模型，适合多模态扩展和快速实验。",
    docsUrl: "https://aistudio.google.com/app/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    supportsCustomModels: true,
    defaultModelPriority: ["gemini-2.5-pro"],
    catalogModels: ["gemini-2.5-pro", "gemini-2.5-flash"]
  }
]);

const providerCatalogMap = Object.freeze(
  providerCatalog.reduce(
    (accumulator, provider) => {
      accumulator[provider.id] = provider;
      return accumulator;
    },
    {} as Record<ForgeModelProviderId, ForgeModelGatewayProviderCatalogEntry>
  )
);

const providerFamilyMatchers: Record<ForgeModelProviderId, (model: string) => boolean> = {
  kimi: (model) => model.startsWith("kimi-"),
  "kimi-coding": (model) =>
    model === "k2p5" ||
    model === "kimi-for-coding" ||
    model.startsWith("kimi-coding/"),
  openai: (model) =>
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4"),
  anthropic: (model) => model.startsWith("claude"),
  google: (model) => model.startsWith("gemini")
};

const connectionHealthPrompt: ProviderPromptConfig = {
  systemPrompt: "You are a connection health checker.",
  userPrompt: "Reply with OK only.",
  temperature: 0,
  maxTokens: 8
};

function normalizeModelName(value: string) {
  return value.trim().toLowerCase();
}

function cloneCatalogEntry(
  provider: ForgeModelGatewayProviderCatalogEntry
): ForgeModelGatewayProviderCatalogEntry {
  return {
    ...provider,
    defaultModelPriority: [...provider.defaultModelPriority],
    catalogModels: [...provider.catalogModels]
  };
}

function buildWorkbenchPrompt(input: {
  projectName: string;
  commandName: string;
  commandType: string;
  executionSummary: string;
  prompt: string;
  thinkingBudget?: string;
  agentName?: string;
  agentPersona?: string;
  agentSystemPrompt?: string;
  agentKnowledgeSources?: string[];
  agentOwnerMode?: string;
  agentContext?: ForgeResolvedAgentContext | null;
}): ProviderPromptConfig {
  const agentKnowledgeLabel =
    input.agentKnowledgeSources && input.agentKnowledgeSources.length > 0
      ? input.agentKnowledgeSources.join("、")
      : null;
  const resolvedContextSections = buildResolvedAgentContextSections(input.agentContext);
  return {
    systemPrompt: [
      "你是 Forge 工作台里的中文交付助手。请优先直接回答用户刚刚提出的明确问题或指令，再结合执行摘要补充当前结论和下一步建议。输出要可以直接展示在工作台对话区，保持专业、具体、可执行，不要提 API、密钥或模型供应商。如果用户要求一句话回复，先用一句话正面作答。",
      input.agentName ? `当前代表的 AI 员工是 ${input.agentName}。` : null,
      resolvedContextSections.rolePrompt ? `岗位设定：${resolvedContextSections.rolePrompt}` : null,
      input.agentSystemPrompt ?? null,
      input.agentPersona ? `工作风格：${input.agentPersona}` : null,
      input.agentOwnerMode ? `执行边界：${input.agentOwnerMode}` : null
    ]
      .filter(Boolean)
      .join(" "),
    userPrompt: [
      `用户当前输入：${input.prompt || "无"}`,
      `项目：${input.projectName}`,
      `当前动作：${input.commandName}（${input.commandType}）`,
      `执行摘要：${input.executionSummary || "暂无执行摘要"}`,
      input.agentName ? `当前负责人：${input.agentName}` : null,
      resolvedContextSections.projectContext,
      resolvedContextSections.skills,
      resolvedContextSections.sops,
      resolvedContextSections.deliverables,
      resolvedContextSections.tools,
      resolvedContextSections.paths,
      resolvedContextSections.knowledgeSnippets,
      agentKnowledgeLabel ? `可参考知识源：${agentKnowledgeLabel}` : null,
      input.thinkingBudget ? `思考预算：${input.thinkingBudget}` : null,
      "请先回应用户当前输入，再给出适合回写到工作台对话区的中文回复。必要时补充最多 3 条短清单。"
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.3,
    maxTokens: 600
  };
}

function buildWorkbenchChatPrompt(input: {
  projectName: string;
  workbenchNode?: string;
  prompt: string;
  thinkingBudget?: string;
  agentName?: string;
  agentPersona?: string;
  agentSystemPrompt?: string;
  agentKnowledgeSources?: string[];
  agentOwnerMode?: string;
  agentContext?: ForgeResolvedAgentContext | null;
}): ProviderPromptConfig {
  const agentKnowledgeLabel =
    input.agentKnowledgeSources && input.agentKnowledgeSources.length > 0
      ? input.agentKnowledgeSources.join("、")
      : null;
  const resolvedContextSections = buildResolvedAgentContextSections(input.agentContext);
  return {
    systemPrompt: [
      "你是 Forge 项目工作台里的中文 AI 助手。请像真实对话一样先直接回答用户刚刚这句输入，再在必要时给出很短的下一步建议。不要擅自声称已经生成了 PRD、测试报告、任务包或交付物，除非用户明确要求且输入里已经提供了足够上下文。不要提 API、密钥或模型供应商。",
      input.agentName ? `你当前以 ${input.agentName} 的身份参与这个节点。` : null,
      resolvedContextSections.rolePrompt ? `岗位设定：${resolvedContextSections.rolePrompt}` : null,
      input.agentSystemPrompt ?? null,
      input.agentPersona ? `工作风格：${input.agentPersona}` : null,
      input.agentOwnerMode ? `执行边界：${input.agentOwnerMode}` : null
    ]
      .filter(Boolean)
      .join(" "),
    userPrompt: [
      `用户当前输入：${input.prompt || "无"}`,
      `当前项目：${input.projectName}`,
      input.workbenchNode ? `当前工作节点：${input.workbenchNode}` : null,
      input.agentName ? `当前负责人：${input.agentName}` : null,
      resolvedContextSections.projectContext,
      resolvedContextSections.skills,
      resolvedContextSections.sops,
      resolvedContextSections.deliverables,
      resolvedContextSections.tools,
      resolvedContextSections.paths,
      resolvedContextSections.knowledgeSnippets,
      agentKnowledgeLabel ? `可参考知识源：${agentKnowledgeLabel}` : null,
      input.thinkingBudget ? `思考预算：${input.thinkingBudget}` : null,
      "请只围绕用户这句输入作答，不要把系统里已有的项目草案、演示数据或历史产物当成刚刚发生的新事实。"
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.3,
    maxTokens: 600
  };
}

function buildResolvedAgentContextSections(agentContext?: ForgeResolvedAgentContext | null) {
  if (!agentContext) {
    return {
      rolePrompt: null,
      projectContext: null,
      skills: null,
      sops: null,
      deliverables: null,
      tools: null,
      paths: null,
      knowledgeSnippets: null
    };
  }

  const projectContext = [
    `项目目标：${agentContext.projectContext.goal}`,
    agentContext.projectContext.currentStage
      ? `当前阶段：${agentContext.projectContext.currentStage}`
      : null,
    agentContext.projectContext.currentNode
      ? `当前节点：${agentContext.projectContext.currentNode}`
      : null,
    agentContext.projectContext.blockers.length > 0
      ? `关键阻塞：${agentContext.projectContext.blockers.join("；")}`
      : null
  ]
    .filter(Boolean)
    .join("\n");

  const skills =
    agentContext.skills.length > 0
      ? `技能摘要：\n${agentContext.skills
          .map(
            (skill, index) =>
              `${index + 1}. ${skill.name}：${skill.summary} 使用方式：${skill.usageGuide}`
          )
          .join("\n")}`
      : null;
  const sops =
    agentContext.sops.length > 0
      ? `SOP 摘要：\n${agentContext.sops
          .map(
            (sop, index) =>
              `${index + 1}. ${sop.name}：${sop.summary} 检查项：${sop.checklist.join("、")}`
          )
          .join("\n")}`
      : null;
  const deliverables =
    agentContext.deliverables.length > 0
      ? `当前交付物：\n${agentContext.deliverables
          .map(
            (deliverable, index) =>
              `${index + 1}. ${deliverable.label}《${deliverable.title}》(${deliverable.status}，${deliverable.updatedAt})：${deliverable.summary}`
          )
          .join("\n")}`
      : null;
  const tools =
    agentContext.tools.length > 0
      ? `可用工具：\n${agentContext.tools
          .map(
            (tool, index) =>
              `${index + 1}. ${tool.label}（${tool.mode}）：${tool.summary}`
          )
          .join("\n")}`
      : null;
  const paths = `工作区路径：\n- workspace: ${agentContext.paths.workspaceRoot}\n- artifacts: ${agentContext.paths.artifactsRoot}\n- uploads: ${agentContext.paths.uploadsRoot}\n- knowledge: ${agentContext.paths.knowledgeRoot}\n- skills: ${agentContext.paths.skillsRoot}`;
  const knowledgeSnippets =
    agentContext.knowledgeSnippets.length > 0
      ? `知识摘录：\n${agentContext.knowledgeSnippets
          .map(
            (item, index) =>
              `${index + 1}. ${item.label}（来源：${item.sourceTitle}；命中：${item.matchReason}）：${item.summary}`
          )
          .join("\n")}`
      : null;

  return {
    rolePrompt: agentContext.rolePrompt || null,
    projectContext: projectContext || null,
    skills,
    sops,
    deliverables,
    tools,
    paths,
    knowledgeSnippets
  };
}

function tryParseProviderErrorMessage(text: string): string | null {
  if (!text.trim()) {
    return null;
  }

  try {
    const payload = JSON.parse(text) as
      | {
          error?: {
            message?: string;
          };
          message?: string;
        }
      | undefined;

    return payload?.error?.message?.trim() || payload?.message?.trim() || text.trim();
  } catch {
    return text.trim();
  }
}

function extractModelMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text.trim();
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractProviderResponseContent(
  providerId: ForgeModelProviderId,
  payload: unknown
): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (providerId === "anthropic" || providerId === "kimi-coding") {
    return extractModelMessageContent((payload as { content?: unknown }).content);
  }

  if (providerId === "google") {
    const candidate = (payload as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    }).candidates?.[0];

    return (
      candidate?.content?.parts
        ?.map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
        .filter(Boolean)
        .join("\n") ?? ""
    );
  }

  return extractModelMessageContent(
    (payload as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    }).choices?.[0]?.message?.content
  );
}

function normalizeTokenUsageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function buildTokenUsage(input: {
  inputTokens?: unknown;
  outputTokens?: unknown;
  totalTokens?: unknown;
}): ForgeTokenUsage | null {
  const inputTokens = normalizeTokenUsageCount(input.inputTokens);
  const outputTokens = normalizeTokenUsageCount(input.outputTokens);
  const totalTokens =
    normalizeTokenUsageCount(input.totalTokens) ??
    (inputTokens !== null || outputTokens !== null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null);

  if (totalTokens === null || totalTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function extractProviderTokenUsage(
  providerId: ForgeModelProviderId,
  payload: unknown
): ForgeTokenUsage | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (providerId === "anthropic" || providerId === "kimi-coding") {
    const usage = (payload as {
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    }).usage;

    return buildTokenUsage({
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens
    });
  }

  if (providerId === "google") {
    const usage = (payload as {
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    }).usageMetadata;

    return buildTokenUsage({
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount
    });
  }

  const usage = (payload as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  }).usage;

  return buildTokenUsage({
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens
  });
}

function buildProviderRequest(
  providerId: ForgeModelProviderId,
  apiKey: string,
  model: string,
  prompt: ProviderPromptConfig
): {
  url: string;
  init: RequestInit;
} {
  const provider = providerCatalogMap[providerId];

  if (providerId === "anthropic" || providerId === "kimi-coding") {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };

    if (providerId === "kimi-coding") {
      headers["User-Agent"] = "claude-code/0.1.0";
    }

    return {
      url: `${provider.baseUrl}/messages`,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          system: prompt.systemPrompt,
          messages: [
            {
              role: "user",
              content: prompt.userPrompt
            }
          ],
          temperature: prompt.temperature,
          max_tokens: prompt.maxTokens
        })
      }
    };
  }

  if (providerId === "google") {
    return {
      url: `${provider.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: prompt.systemPrompt }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt.userPrompt }]
            }
          ],
          generationConfig: {
            temperature: prompt.temperature,
            maxOutputTokens: prompt.maxTokens
          }
        })
      }
    };
  }

  return {
    url: `${provider.baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: prompt.systemPrompt
          },
          {
            role: "user",
            content: prompt.userPrompt
          }
        ],
        temperature: prompt.temperature,
        max_tokens: prompt.maxTokens
      })
    }
  };
}

async function requestProviderResponse(input: {
  providerId: ForgeModelProviderId;
  apiKey: string;
  model: string;
  prompt: ProviderPromptConfig;
  mode: "connection" | "workbench";
}): Promise<ProviderResponse> {
  const provider = providerCatalogMap[input.providerId];
  const request = buildProviderRequest(input.providerId, input.apiKey, input.model, input.prompt);

  try {
    const response = await fetch(request.url, request.init);

    if (!response.ok) {
      const responseText = await response.text();

      return {
        status: "error",
        message:
          tryParseProviderErrorMessage(responseText) ||
          `${provider.label} 请求失败（HTTP ${response.status}）`
      };
    }

    const payload = (await response.json()) as unknown;

    if (input.mode === "connection") {
      return {
        status: "success",
        message: `${provider.label} 连接成功，可用于工作台模型调用。`
      };
    }

    const content = extractProviderResponseContent(input.providerId, payload);
    const tokenUsage = extractProviderTokenUsage(input.providerId, payload);

    if (!content) {
      return {
        status: "error",
        message: `${provider.label} 没有返回可展示的工作台回复。`
      };
    }

    return {
      status: "success",
      message: `${provider.label} 已生成工作台回复。`,
      content,
      tokenUsage
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : `${provider.label} ${input.mode === "connection" ? "连接失败" : "工作台回复失败"}`
    };
  }
}

export function getModelGatewayProviderCatalog(): ForgeModelGatewayProviderCatalogEntry[] {
  return providerCatalog.map(cloneCatalogEntry);
}

export function getModelGatewayProviderDefinition(
  providerId: ForgeModelProviderId
): ForgeModelGatewayProviderCatalogEntry {
  return cloneCatalogEntry(providerCatalogMap[providerId]);
}

export function isForgeModelProviderId(value: string): value is ForgeModelProviderId {
  return Object.hasOwn(providerCatalogMap, value);
}

export function getConfiguredModelGatewayOptions(
  providerSettings: ForgeModelProviderSetting[] = []
): string[] {
  const configuredOptions = providerSettings
    .filter((provider) => provider.enabled && provider.hasApiKey && provider.status !== "error")
    .flatMap((provider) => provider.modelPriority)
    .map((model) => model.trim())
    .filter(Boolean);

  return configuredOptions.length > 0
    ? Array.from(new Set(configuredOptions))
    : [FORGE_LOCAL_FALLBACK_MODEL_OPTION];
}

export function resolveModelGatewaySelection(
  selectedModel: string | undefined,
  providerSettings: ForgeModelProviderSetting[] = []
): ForgeModelGatewaySelection | null {
  const requestedModel = selectedModel?.trim();
  const normalizedModel = requestedModel ? normalizeModelName(requestedModel) : "";

  if (!normalizedModel || normalizedModel === normalizeModelName(FORGE_LOCAL_FALLBACK_MODEL_OPTION)) {
    return null;
  }

  const resolvedModel = requestedModel || normalizedModel;

  for (const provider of providerSettings) {
    if (!provider.enabled || !provider.hasApiKey) {
      continue;
    }

    const configuredModels = provider.modelPriority.map(normalizeModelName);
    const catalogModels = (provider.catalogModels ?? []).map(normalizeModelName);

    if (
      configuredModels.includes(normalizedModel) ||
      catalogModels.includes(normalizedModel) ||
      providerFamilyMatchers[provider.id](normalizedModel)
    ) {
      return {
        providerId: provider.id,
        providerLabel: provider.label,
        model: resolvedModel
      };
    }
  }

  return null;
}

export async function testModelGatewayConnection(input: {
  providerId: ForgeModelProviderId;
  apiKey: string;
  model: string;
}): Promise<{
  status: ForgeModelProviderConnectionResult["status"];
  message: string;
}> {
  const result = await requestProviderResponse({
    providerId: input.providerId,
    apiKey: input.apiKey,
    model: input.model,
    prompt: connectionHealthPrompt,
    mode: "connection"
  });

  return {
    status: result.status,
    message: result.message
  };
}

export async function generateModelGatewayReply(input: {
  providerId: ForgeModelProviderId;
  apiKey: string;
  model: string;
  projectName: string;
  commandName: string;
  commandType: string;
  executionSummary: string;
  prompt: string;
  thinkingBudget?: string;
  agentName?: string;
  agentPersona?: string;
  agentSystemPrompt?: string;
  agentKnowledgeSources?: string[];
  agentOwnerMode?: string;
  agentContext?: ForgeResolvedAgentContext | null;
}): Promise<ProviderResponse> {
  return requestProviderResponse({
    providerId: input.providerId,
    apiKey: input.apiKey,
    model: input.model,
    prompt: buildWorkbenchPrompt(input),
    mode: "workbench"
  });
}

export async function generateModelGatewayChatReply(input: {
  providerId: ForgeModelProviderId;
  apiKey: string;
  model: string;
  projectName: string;
  prompt: string;
  workbenchNode?: string;
  thinkingBudget?: string;
  agentName?: string;
  agentPersona?: string;
  agentSystemPrompt?: string;
  agentKnowledgeSources?: string[];
  agentOwnerMode?: string;
  agentContext?: ForgeResolvedAgentContext | null;
}): Promise<ProviderResponse> {
  return requestProviderResponse({
    providerId: input.providerId,
    apiKey: input.apiKey,
    model: input.model,
    prompt: buildWorkbenchChatPrompt(input),
    mode: "workbench"
  });
}
