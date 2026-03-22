import { describe, expect, it } from "vitest";

import { agents, artifactReviews, artifacts, tasks, teamTemplates } from "../src/data/mock-data";
import {
  defaultTeamWorkbenchSelectedTemplateId,
  defaultTeamWorkbenchTemplates
} from "../src/lib/forge-team-defaults";

describe("forge AI team roster", () => {
  it("uses an agency-agents inspired R&D roster instead of demo specialists", () => {
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));

    expect(agentById.get("agent-pm")?.name).toBe("产品策略 Agent");
    expect(agentById.get("agent-engineer")?.name).toBe("后端研发 Agent");
    expect(agentById.get("agent-qa")?.name).toBe("测试策略 Agent");

    expect(agentById.get("agent-service-strategy")?.name).toBe("项目牧羊人 Agent");
    expect(agentById.get("agent-service-strategy")?.role).toBe("pm");

    expect(agentById.get("agent-ux")?.name).toBe("体验架构 Agent");
    expect(agentById.get("agent-ux")?.role).toBe("design");

    expect(agentById.get("agent-frontend")?.name).toBe("前端开发 Agent");
    expect(agentById.get("agent-frontend")?.role).toBe("engineer");

    expect(agentById.get("agent-qa-automation")?.name).toBe("现实校验 Agent");
    expect(agentById.get("agent-qa-automation")?.role).toBe("qa");

    expect(agentById.get("agent-knowledge-ops")?.name).toBe("流程优化 Agent");
    expect(agentById.get("agent-knowledge-ops")?.role).toBe("knowledge");

    expect(agentById.get("agent-discovery")?.name).toBe("需求洞察 Agent");
    expect(agentById.get("agent-discovery")?.role).toBe("pm");

    expect(agentById.get("agent-solution-architect")?.name).toBe("方案统筹 Agent");
    expect(agentById.get("agent-solution-architect")?.role).toBe("architect");

    expect(agentById.get("agent-ux-research")?.name).toBe("体验研究 Agent");
    expect(agentById.get("agent-ux-research")?.role).toBe("design");

    expect(agentById.get("agent-backend-integration")?.name).toBe("后端集成 Agent");
    expect(agentById.get("agent-backend-integration")?.role).toBe("engineer");

    expect(agentById.get("agent-security-gate")?.name).toBe("安全门禁 Agent");
    expect(agentById.get("agent-security-gate")?.role).toBe("qa");

    expect(agentById.get("agent-delivery-ops")?.name).toBe("交付运营 Agent");
    expect(agentById.get("agent-delivery-ops")?.role).toBe("release");

    expect(agentById.get("agent-asset-curator")?.name).toBe("资产编目 Agent");
    expect(agentById.get("agent-asset-curator")?.role).toBe("knowledge");

    expect(agents.some((agent) => agent.name === "客服策略 Agent")).toBe(false);
    expect(agents.some((agent) => agent.name === "体验设计 Agent")).toBe(false);
    expect(agents.some((agent) => agent.name === "自动化测试 Agent")).toBe(false);
    expect(agents.some((agent) => agent.name === "知识运营 Agent")).toBe(false);
  });

  it("keeps delivery templates aligned to the current engineering team", () => {
    const templateById = new Map(teamTemplates.map((template) => [template.id, template]));

    expect(templateById.get("team-standard-delivery")?.agentIds).toEqual(
      expect.arrayContaining([
        "agent-service-strategy",
        "agent-discovery",
        "agent-architect",
        "agent-solution-architect",
        "agent-ux",
        "agent-ux-research",
        "agent-frontend",
        "agent-backend-integration",
        "agent-qa-automation",
        "agent-security-gate",
        "agent-release",
        "agent-delivery-ops",
        "agent-knowledge-ops",
        "agent-asset-curator"
      ])
    );

    expect(templateById.get("team-lean-validation")?.agentIds).toEqual(
      expect.arrayContaining([
        "agent-service-strategy",
        "agent-discovery",
        "agent-frontend",
        "agent-backend-integration",
        "agent-qa-automation",
        "agent-release",
        "agent-knowledge-ops"
      ])
    );

    expect(templateById.get("team-design-sprint")?.agentIds).toEqual(
      expect.arrayContaining([
        "agent-service-strategy",
        "agent-discovery",
        "agent-architect",
        "agent-solution-architect",
        "agent-ux",
        "agent-ux-research",
        "agent-frontend"
      ])
    );
  });

  it("derives demo team templates from the shared team defaults", () => {
    const templateById = new Map(teamTemplates.map((template) => [template.id, template]));

    expect(templateById.has(defaultTeamWorkbenchSelectedTemplateId)).toBe(true);

    expect(teamTemplates).toHaveLength(defaultTeamWorkbenchTemplates.length);

    defaultTeamWorkbenchTemplates.forEach((templateSeed) => {
      expect(templateById.get(templateSeed.id)).toMatchObject({
        id: templateSeed.id,
        name: templateSeed.name,
        summary: templateSeed.summary,
        agentIds: templateSeed.agentIds,
        leadAgentId: templateSeed.leadAgentId
      });
    });
  });

  it("keeps seeded demo artifacts and tasks owned by the current lead engineering roster", () => {
    const artifactOwnerById = new Map(artifacts.map((artifact) => [artifact.id, artifact.ownerAgentId]));
    const taskOwnerById = new Map(tasks.map((task) => [task.id, task.ownerAgentId]));
    const reviewOwnerById = new Map(
      artifactReviews.map((review) => [review.id, review.reviewerAgentId])
    );

    expect(artifactOwnerById.get("artifact-prd-retail")).toBe("agent-service-strategy");
    expect(artifactOwnerById.get("artifact-ui-retail")).toBe("agent-ux");
    expect(artifactOwnerById.get("artifact-patch-retail")).toBe("agent-frontend");
    expect(artifactOwnerById.get("artifact-demo-retail")).toBe("agent-frontend");

    expect(reviewOwnerById.get("review-retail-demo")).toBe("agent-qa-automation");

    expect(taskOwnerById.get("task-retail-playwright")).toBe("agent-qa-automation");
    expect(taskOwnerById.get("task-retail-demo-review")).toBe("agent-frontend");
    expect(taskOwnerById.get("task-ops-knowledge-card")).toBe("agent-knowledge-ops");
  });
});
