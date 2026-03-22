import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import ForgeHomePage from "../src/components/forge-home-page";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("Forge console shell", () => {
  it("uses top-left icon navigation instead of a separate left icon rail", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.queryByLabelText(/返回仪表盘/i)).not.toBeInTheDocument();

    const mainNavigation = screen.getByRole("navigation", { name: /主模块/i });
    expect(mainNavigation).toBeInTheDocument();

    const links = within(mainNavigation).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(within(mainNavigation).getByRole("link", { name: /仪表盘/i })).toBeInTheDocument();
    expect(within(mainNavigation).getByRole("link", { name: /项目管理/i })).toBeInTheDocument();
    expect(within(mainNavigation).getByRole("link", { name: /AI员工/i })).toBeInTheDocument();
    expect(within(mainNavigation).getByRole("link", { name: /资产管理/i })).toBeInTheDocument();
  });

  it("does not render a dedicated mobile primary navigation for the desktop MVP shell", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 1080px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    try {
      render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

      expect(screen.queryByRole("navigation", { name: /移动主模块/i })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia
      });
    }
  });

  it("shows a shared sidebar collapse toggle when navigation is enabled", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    expect(screen.getByTestId("sidebar-rail-toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /收起侧边栏/i }));
    expect(screen.getByRole("button", { name: /展开侧边栏/i })).toBeInTheDocument();
  });

  it("opens a shared system settings dialog from the sidebar footer", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              providers: [
                {
                  id: "kimi",
                  label: "Moonshot Kimi",
                  vendor: "Moonshot AI",
                  enabled: false,
                  hasApiKey: false,
                  apiKeyHint: null,
                  modelPriority: ["kimi-k2.5"],
                  defaultModelPriority: ["kimi-k2.5"],
                  catalogModels: ["kimi-k2.5", "kimi-thinking-preview"],
                  docsUrl: "https://platform.moonshot.cn/console/api-keys",
                  baseUrl: "https://api.moonshot.cn/v1",
                  status: "untested",
                  lastTestedAt: null,
                  lastTestMessage: null,
                  supportsCustomModels: true,
                  summary: "接入 Moonshot 官方 Kimi 模型。"
                },
                {
                  id: "kimi-coding",
                  label: "Kimi Coding",
                  vendor: "Kimi",
                  enabled: false,
                  hasApiKey: false,
                  apiKeyHint: null,
                  modelPriority: ["k2p5"],
                  defaultModelPriority: ["k2p5"],
                  catalogModels: ["k2p5"],
                  docsUrl: "https://www.kimi.com/",
                  baseUrl: "https://api.kimi.com/coding/v1",
                  status: "untested",
                  lastTestedAt: null,
                  lastTestMessage: null,
                  supportsCustomModels: true,
                  summary: "接入 Kimi Coding 模型，适合代码生成与修复建议。"
                },
                {
                  id: "openai",
                  label: "OpenAI",
                  vendor: "OpenAI",
                  enabled: false,
                  hasApiKey: false,
                  apiKeyHint: null,
                  modelPriority: ["gpt-5.4"],
                  defaultModelPriority: ["gpt-5.4"],
                  catalogModels: ["gpt-5.4", "gpt-4.1-mini"],
                  docsUrl: "https://platform.openai.com/api-keys",
                  baseUrl: "https://api.openai.com/v1",
                  status: "untested",
                  lastTestedAt: null,
                  lastTestMessage: null,
                  supportsCustomModels: true,
                  summary: "接入 OpenAI 通用模型，可作为项目工作台的高泛化补充。"
                },
                {
                  id: "anthropic",
                  label: "Anthropic Claude",
                  vendor: "Anthropic",
                  enabled: false,
                  hasApiKey: false,
                  apiKeyHint: null,
                  modelPriority: ["claude-sonnet-4-5"],
                  defaultModelPriority: ["claude-sonnet-4-5"],
                  catalogModels: ["claude-sonnet-4-5", "claude-opus-4-1"],
                  docsUrl: "https://console.anthropic.com/settings/keys",
                  baseUrl: "https://api.anthropic.com/v1",
                  status: "untested",
                  lastTestedAt: null,
                  lastTestMessage: null,
                  supportsCustomModels: true,
                  summary: "接入 Anthropic Claude 模型，适合长文推理和审阅型回复。"
                },
                {
                  id: "google",
                  label: "Google Gemini",
                  vendor: "Google",
                  enabled: false,
                  hasApiKey: false,
                  apiKeyHint: null,
                  modelPriority: ["gemini-2.5-pro"],
                  defaultModelPriority: ["gemini-2.5-pro"],
                  catalogModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
                  docsUrl: "https://aistudio.google.com/app/apikey",
                  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                  status: "untested",
                  lastTestedAt: null,
                  lastTestMessage: null,
                  supportsCustomModels: true,
                  summary: "接入 Google Gemini 模型，适合多模态扩展和快速实验。"
                }
              ]
            }
          }),
          { status: 200 }
        )
    );

    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    const settingsButton = screen.getByRole("button", { name: /系统设置/i });
    expect(settingsButton).toHaveTextContent("系统设置");
    expect(settingsButton.closest("aside")).toBeNull();
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /系统设置/i })).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog", { name: /系统设置/i });

    expect(within(dialog).getByRole("heading", { name: /Moonshot Kimi/i })).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(/输入 Moonshot Kimi API 密钥/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /测试连接/i })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: /已连接|连接失败|已配置|未配置/i }).length).toBe(5);

    fireEvent.click(within(dialog).getByRole("button", { name: /Kimi Coding/i }));
    await waitFor(() => {
      expect(within(dialog).getByRole("heading", { name: /Kimi Coding/i })).toBeInTheDocument();
    });
    expect(within(dialog).getByPlaceholderText(/输入 Kimi Coding API 密钥/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /OpenAI/i }));
    await waitFor(() => {
      expect(within(dialog).getByRole("heading", { name: /^OpenAI$/i })).toBeInTheDocument();
    });
    expect(within(dialog).getByPlaceholderText(/输入 OpenAI API 密钥/i)).toBeInTheDocument();
  });

  it("keeps the shared system settings entry available even when navigation is hidden", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            providers: [
              {
                id: "kimi",
                label: "Moonshot Kimi",
                vendor: "Moonshot AI",
                enabled: false,
                hasApiKey: false,
                apiKeyHint: null,
                modelPriority: ["kimi-latest"],
                docsUrl: "https://platform.moonshot.cn/console/api-keys",
                baseUrl: "https://api.moonshot.cn/v1",
                status: "untested",
                lastTestedAt: null,
                lastTestMessage: null,
                supportsCustomModels: true,
                summary: "接入 Moonshot 官方 Kimi 模型。"
              }
            ]
          }
        }),
        { status: 200 }
      )
    );

    render(<ForgeHomePage snapshot={forgeSnapshotFixture} />);

    const settingsButton = screen.getByRole("button", { name: /系统设置/i });
    expect(settingsButton).toHaveTextContent("系统设置");
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /系统设置/i })).toBeInTheDocument();
    });
  });

  it("opens CEO chat in a dedicated dialog shell", () => {
    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /打开 CEO 对话/i }));

    expect(screen.getByRole("dialog", { name: /CEO 对话/i })).toBeInTheDocument();
  });

  it("sends CEO chat as portfolio scope even when the current url contains a projectId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          reply: "CEO 已完成全局判断。"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/projects?projectId=retail-support");

    render(<ForgeHomePage snapshot={forgeSnapshotFixture} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /打开 CEO 对话/i }));
    fireEvent.change(screen.getByPlaceholderText(/直接问 CEO/i), {
      target: { value: "现在最该优先推进哪个项目？" }
    });
    fireEvent.click(screen.getByRole("button", { name: /^发送$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/forge/ceo-chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        })
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      prompt: "现在最该优先推进哪个项目？",
      scope: "portfolio",
      triggeredBy: "Forge · 仪表盘 · CEO 对话"
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/forge/ceo-chat",
      expect.objectContaining({
        body: expect.stringContaining("retail-support")
      })
    );
  });
});
