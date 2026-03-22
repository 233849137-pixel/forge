import { afterEach, describe, expect, it, vi } from "vitest";
import {
  saveForgeAgentProfile,
  saveForgeTeamWorkbenchState
} from "../src/lib/forge-team-api";

describe("forge team api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves an agent profile through the team registry route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            agent: {
              id: "agent-pm",
              name: "产品策略 Agent",
              role: "architect",
              runnerId: "runner-reviewer",
              departmentLabel: "产品与方案",
              ownerMode: "review-required",
              persona: "你是负责范围收口与验收标准的产品经理 Agent。",
              policyId: "policy-product-strict",
              permissionProfileId: "perm-review",
              promptTemplateId: "prompt-prd-rag",
              skillIds: ["skill-prd", "skill-code"],
              systemPrompt: "你是负责需求澄清与 PRD 输出的产品经理 Agent。",
              knowledgeSources: ["产品手册", "行业案例库"]
            }
          }
        }),
        { status: 200 }
      )
    );

    const result = await saveForgeAgentProfile({
      agentId: "agent-pm",
      name: "产品策略 Agent",
      role: "architect",
      runnerId: "runner-reviewer",
      departmentLabel: "产品与方案",
      ownerMode: "review-required",
      persona: "你是负责范围收口与验收标准的产品经理 Agent。",
      policyId: "policy-product-strict",
      permissionProfileId: "perm-review",
      promptTemplateId: "prompt-prd-rag",
      skillIds: ["skill-prd", "skill-code"],
      systemPrompt: "你是负责需求澄清与 PRD 输出的产品经理 Agent。",
      knowledgeSources: ["产品手册", "行业案例库"]
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/team-registry", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        agentId: "agent-pm",
        name: "产品策略 Agent",
        role: "architect",
        runnerId: "runner-reviewer",
        departmentLabel: "产品与方案",
        ownerMode: "review-required",
        persona: "你是负责范围收口与验收标准的产品经理 Agent。",
        policyId: "policy-product-strict",
        permissionProfileId: "perm-review",
        promptTemplateId: "prompt-prd-rag",
        skillIds: ["skill-prd", "skill-code"],
        systemPrompt: "你是负责需求澄清与 PRD 输出的产品经理 Agent。",
        knowledgeSources: ["产品手册", "行业案例库"]
      })
    });
    expect(result.agent.skillIds).toEqual(["skill-prd", "skill-code"]);
    expect(result.agent.ownerMode).toBe("review-required");
    expect(result.agent.runnerId).toBe("runner-reviewer");
  });

  it("throws the backend message when saving an agent profile fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "FORGE_NOT_FOUND",
            message: "Agent 不存在"
          }
        }),
        { status: 404 }
      )
    );

    await expect(
      saveForgeAgentProfile({
        agentId: "missing-agent",
        name: "缺失 Agent",
        role: "pm",
        runnerId: "runner-local-main",
        departmentLabel: "管理层",
        ownerMode: "human-approved",
        persona: "缺失 Agent",
        policyId: "policy-missing",
        permissionProfileId: "perm-readonly",
        promptTemplateId: "prompt-prd-rag",
        skillIds: ["skill-prd"],
        systemPrompt: "缺失 Agent",
        knowledgeSources: ["产品手册"]
      })
    ).rejects.toThrow("Agent 不存在");
  });

  it("saves the team workbench state through the team-workbench-state route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            state: {
              selectedTemplateId: "team-design-sprint",
              activeCategory: "templates",
              employeeDetailTab: "ability",
              abilityTemplateTab: "packs",
              selectedAgentId: "agent-pm",
              selectedBuilderRole: "engineer",
              selectedPoolAgentId: "agent-pm",
              selectedPoolDepartment: "管理层",
              selectedManagementDepartment: "管理层",
              selectedTemplateDepartment: "技术研发",
              selectedGovernanceDepartment: "管理层",
              selectedAbilityLine: "AI智能",
              selectedRecommendedPackId: "pack-support",
              selectedCustomPackId: "custom-pack-support",
              isCurrentPackListCollapsed: true,
              roleAssignments: {
                pm: "agent-pm",
                architect: "agent-architect",
                design: null,
                engineer: "agent-dev",
                qa: "agent-qa",
                release: "agent-release",
                knowledge: null
              },
              manualSkillIdsByAgentId: {
                "agent-pm": ["skill-prd", "skill-rag"]
              },
              manualKnowledgeSourcesByAgentId: {
                "agent-pm": ["产品手册", "行业案例库"]
              },
              removedPackSkillIdsByAgentId: {
                "agent-pm": {
                  "preset:pack-support": ["skill-rag"]
                }
              },
              equippedPackByAgentId: {
                "agent-pm": [{ source: "preset", id: "pack-support" }]
              },
              managedAgents: [],
              orgDepartments: [{ label: "管理层" }],
              orgChartMembers: [],
              skillCatalogOverrides: {
                "skill-rag": {
                  name: "知识检索增强",
                  summary: "补强知识检索与问答。",
                  line: "AI智能",
                  category: "知识"
                }
              },
              hiddenSkillIds: ["skill-archive"],
              governanceOverridesByAgentId: {
                "agent-pm": {
                  enabled: ["project.advance"],
                  disabled: ["team.configure"]
                }
              },
              customAbilityPacks: [
                {
                  id: "custom-pack-support",
                  name: "客服增强包",
                  line: "智能客服",
                  category: "通用",
                  summary: "补强 FAQ 与知识检索。",
                  skillIds: ["skill-rag"],
                  updatedAt: "刚刚"
                }
              ]
            }
          }
        }),
        { status: 200 }
      )
    );

    const input = {
      selectedTemplateId: "team-design-sprint",
      activeCategory: "templates" as const,
      employeeDetailTab: "ability" as const,
      abilityTemplateTab: "packs" as const,
      selectedAgentId: "agent-pm",
      selectedBuilderRole: "engineer" as const,
      selectedPoolAgentId: "agent-pm",
      selectedPoolDepartment: "管理层",
      selectedManagementDepartment: "管理层",
      selectedTemplateDepartment: "技术研发",
      selectedGovernanceDepartment: "管理层",
      selectedAbilityLine: "AI智能",
      selectedRecommendedPackId: "pack-support",
      selectedCustomPackId: "custom-pack-support",
      isCurrentPackListCollapsed: true,
      roleAssignments: {
        pm: "agent-pm",
        architect: "agent-architect",
        design: null,
        engineer: "agent-dev",
        qa: "agent-qa",
        release: "agent-release",
        knowledge: null
      },
      manualSkillIdsByAgentId: {
        "agent-pm": ["skill-prd", "skill-rag"]
      },
      manualKnowledgeSourcesByAgentId: {
        "agent-pm": ["产品手册", "行业案例库"]
      },
      removedPackSkillIdsByAgentId: {
        "agent-pm": {
          "preset:pack-support": ["skill-rag"]
        }
      },
      equippedPackByAgentId: {
        "agent-pm": [{ source: "preset" as const, id: "pack-support" }]
      },
      managedAgents: [],
      orgDepartments: [{ label: "管理层" }],
      orgChartMembers: [],
      skillCatalogOverrides: {
        "skill-rag": {
          name: "知识检索增强",
          summary: "补强知识检索与问答。",
          line: "AI智能",
          category: "知识"
        }
      },
      hiddenSkillIds: ["skill-archive"],
      governanceOverridesByAgentId: {
        "agent-pm": {
          enabled: ["project.advance"],
          disabled: ["team.configure"]
        }
      },
      customAbilityPacks: [
        {
          id: "custom-pack-support",
          name: "客服增强包",
          line: "智能客服",
          category: "通用",
          summary: "补强 FAQ 与知识检索。",
          skillIds: ["skill-rag"],
          updatedAt: "刚刚"
        }
      ]
    };

    const result = await saveForgeTeamWorkbenchState(input);

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/team-workbench-state", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });
    expect(result.state.selectedTemplateId).toBe("team-design-sprint");
    expect(result.state.activeCategory).toBe("templates");
    expect(result.state.abilityTemplateTab).toBe("packs");
    expect(result.state.equippedPackByAgentId["agent-pm"]).toEqual([
      { source: "preset", id: "pack-support" }
    ]);
    expect(result.state.skillCatalogOverrides?.["skill-rag"]?.name).toBe("知识检索增强");
    expect(result.state.hiddenSkillIds).toEqual(["skill-archive"]);
    expect(result.state.governanceOverridesByAgentId?.["agent-pm"]).toEqual({
      enabled: ["project.advance"],
      disabled: ["team.configure"]
    });
  });
});
