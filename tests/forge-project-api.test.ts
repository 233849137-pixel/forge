import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateForgeProject,
  createForgeProject,
  deleteForgeProject,
  generateForgePrdDraft,
  saveForgeProjectWorkbenchState
} from "../src/lib/forge-project-api";

describe("forge project api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("activates a forge project through the active project route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            activeProjectId: "clinic-rag",
            project: {
              id: "clinic-rag",
              name: "诊所知识助手"
            }
          }
        }),
        { status: 200 }
      )
    );

    const result = await activateForgeProject("clinic-rag");

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/projects/active", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        projectId: "clinic-rag"
      })
    });
    expect(result.activeProjectId).toBe("clinic-rag");
    expect(result.project.name).toBe("诊所知识助手");
  });

  it("creates a forge project through the projects route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            activeProjectId: "new-project",
            project: {
              id: "new-project",
              name: "售后退款救援台"
            }
          }
        }),
        { status: 201 }
      )
    );

    const result = await createForgeProject({
      name: "售后退款救援台",
      templateId: "template-smart-service",
      sector: "智能客服 / 电商售后",
      owner: "Iris"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "售后退款救援台",
        templateId: "template-smart-service",
        sector: "智能客服 / 电商售后",
        owner: "Iris"
      })
    });
    expect(result.project.name).toBe("售后退款救援台");
  });

  it("generates a PRD draft through the prd route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            activeProjectId: "retail-support",
            document: {
              id: "prd-retail-support",
              title: "零售客服副驾驶 PRD 草案"
            },
            template: {
              id: "template-smart-service",
              title: "客服 PRD 草案模板"
            }
          }
        }),
        { status: 201 }
      )
    );

    const result = await generateForgePrdDraft({
      projectId: "retail-support",
      templateId: "template-smart-service",
      extraNotes: "强调退款失败、转人工和知识库回退。"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/prd", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        projectId: "retail-support",
        templateId: "template-smart-service",
        extraNotes: "强调退款失败、转人工和知识库回退。"
      })
    });
    expect(result.document.title).toContain("PRD 草案");
  });

  it("saves the project workbench state through the project-workbench-state route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            state: {
              "retail-support": {
                drafts: {
                  "DEMO测试": ""
                },
                nodePanels: {
                  "DEMO测试": {
                    conversationTabs: [
                      {
                        id: "demo-testing-conversation-primary",
                        label: "主会话",
                        messages: [
                          {
                            id: "saved-message-1",
                            speaker: "测试 Agent",
                            role: "ai",
                            text: "已保存工作台会话。",
                            time: "刚刚"
                          }
                        ]
                      }
                    ],
                    activeConversationTabId: "demo-testing-conversation-primary",
                    documentTabs: [
                      {
                        id: "demo-testing-document-primary",
                        label: "结果 1",
                        document: {
                          title: "已保存结果",
                          body: "# 已保存结果",
                          updatedAt: "刚刚"
                        }
                      }
                    ],
                    activeDocumentTabId: "demo-testing-document-primary"
                  }
                }
              }
            }
          }
        }),
        { status: 200 }
      )
    );

    const input = {
      "retail-support": {
        drafts: {
          "DEMO测试": ""
        },
        nodePanels: {
          "DEMO测试": {
            conversationTabs: [
              {
                id: "demo-testing-conversation-primary",
                label: "主会话",
                messages: [
                  {
                    id: "saved-message-1",
                    speaker: "测试 Agent",
                    role: "ai" as const,
                    text: "已保存工作台会话。",
                    time: "刚刚"
                  }
                ]
              }
            ],
            activeConversationTabId: "demo-testing-conversation-primary",
            documentTabs: [
              {
                id: "demo-testing-document-primary",
                label: "结果 1",
                document: {
                  title: "已保存结果",
                  body: "# 已保存结果",
                  updatedAt: "刚刚"
                }
              }
            ],
            activeDocumentTabId: "demo-testing-document-primary"
          }
        }
      }
    };

    const result = await saveForgeProjectWorkbenchState(input as any);

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/project-workbench-state", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });
    expect(result.state["retail-support"].nodePanels["DEMO测试"].conversationTabs).toHaveLength(1);
  });

  it("deletes a forge project through the projects route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            deletedProjectId: "retail-support",
            activeProjectId: "clinic-rag"
          }
        }),
        { status: 200 }
      )
    );

    const result = await deleteForgeProject("retail-support");

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/projects", {
      method: "DELETE",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        projectId: "retail-support"
      })
    });
    expect(result.deletedProjectId).toBe("retail-support");
    expect(result.activeProjectId).toBe("clinic-rag");
  });

  it("throws the backend message when project activation fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORGE_NOT_FOUND",
            message: "项目不存在"
          }
        }),
        { status: 404 }
      )
    );

    await expect(activateForgeProject("missing-project")).rejects.toThrow("项目不存在");
  });
});
