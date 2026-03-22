import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getCapabilities } from "../app/api/forge/capabilities/route";
import { GET as getAgentMarkdown } from "../app/api/forge/agents/[agentId]/markdown/route";
import { GET as getAssetRecommendations } from "../app/api/forge/assets/recommend/route";
import { GET as getCommandCenter, POST as postCommandCenter } from "../app/api/forge/commands/route";
import { GET as getComponentAssembly, POST as postComponentAssembly } from "../app/api/forge/components/assemble/route";
import { GET as getComponentSearch } from "../app/api/forge/components/search/route";
import { GET as getComponents } from "../app/api/forge/components/route";
import { GET as getControlPlane } from "../app/api/forge/control-plane/route";
import { GET as getPages } from "../app/api/forge/pages/route";
import {
  DELETE as deleteWorkspaceFiles,
  GET as getWorkspaceFiles,
  POST as postWorkspaceFiles
} from "../app/api/forge/workspace-files/route";
import * as workspaceFilesRoute from "../app/api/forge/workspace-files/route";
import { POST as postExecutionBackendBridge } from "../app/api/forge/execution-backends/bridge/route";
import { POST as postExecutionBackendBridgeWriteback } from "../app/api/forge/execution-backends/bridge/writeback/route";
import { POST as postExecutionBackendDispatch } from "../app/api/forge/execution-backends/dispatch/route";
import { POST as postExecutionBackendExecute } from "../app/api/forge/execution-backends/execute/route";
import { POST as postExecutionBackendPrepare } from "../app/api/forge/execution-backends/prepare/route";
import { POST as postSkillImport } from "../app/api/forge/skills/import/route";
import { POST as postPrd } from "../app/api/forge/prd/route";
import { POST as postActiveProject } from "../app/api/forge/projects/active/route";
import {
  DELETE as deleteProjects,
  PATCH as patchProjects,
  POST as postProjects
} from "../app/api/forge/projects/route";
import { GET as getPrompts } from "../app/api/forge/prompts/route";
import { GET as getReadiness } from "../app/api/forge/readiness/route";
import { GET as getRemediations } from "../app/api/forge/remediations/route";
import { POST as postRemediationRetry } from "../app/api/forge/remediations/retry/route";
import { GET as getRuns, POST as postRuns } from "../app/api/forge/runs/route";
import { GET as getSnapshot } from "../app/api/forge/snapshot/route";
import { POST as postEscalationRetry } from "../app/api/forge/escalations/retry/route";
import {
  GET as getModelProviders,
  POST as postModelProviders
} from "../app/api/forge/model-providers/route";
import { POST as postRunnerProbe } from "../app/api/forge/runners/probe/route";
import { GET as getRunners, POST as postRunners } from "../app/api/forge/runners/route";
import { GET as getTasks } from "../app/api/forge/tasks/route";
import { POST as postTaskRetry } from "../app/api/forge/tasks/retry/route";
import { GET as getTeamRegistry, POST as postTeamRegistry } from "../app/api/forge/team-registry/route";
import {
  GET as getProjectWorkbenchState,
  POST as postProjectWorkbenchState
} from "../app/api/forge/project-workbench-state/route";
import {
  GET as getTeamWorkbenchState,
  POST as postTeamWorkbenchState
} from "../app/api/forge/team-workbench-state/route";
import { GET as getWorkflow, POST as postWorkflow } from "../app/api/forge/workflow/route";
import { GET as getTemplates } from "../app/api/forge/templates/route";
import {
  createProjectForAI,
  executeCommandForAI,
  recordCommandExecutionForAI,
  upsertRunForAI
} from "../packages/ai/src";
import * as forgeRealSkills from "../src/server/forge-real-skills";
import {
  ensureForgeDatabase,
  updateModelProviderSettings,
  upsertProjectArtifact,
  upsertProjectComponentLink,
  upsertProjectTask
} from "../packages/db/src";

const cwdSpies: Array<ReturnType<typeof vi.spyOn>> = [];
const directories: string[] = [];
const originalFetch = global.fetch;

afterEach(() => {
  while (cwdSpies.length > 0) {
    cwdSpies.pop()?.mockRestore();
  }

  while (directories.length > 0) {
    rmSync(directories.pop() as string, { force: true, recursive: true });
  }

  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

function prepareWorkspace() {
  const directory = mkdtempSync(join(tmpdir(), "forge-route-"));
  const dbPath = join(directory, "data", "forge.db");

  directories.push(directory);
  cwdSpies.push(vi.spyOn(process, "cwd").mockReturnValue(directory));
  ensureForgeDatabase(dbPath);

  return { directory, dbPath };
}

function overrideCanonicalTeamTemplateAgents(
  dbPath: string,
  templateId: string,
  agentIds: string[],
  leadAgentId: string
) {
  const db = new Database(dbPath);

  try {
    db.prepare(`
      UPDATE team_templates
      SET agent_ids_json = ?,
          lead_agent_id = ?
      WHERE id = ?
    `).run(JSON.stringify(agentIds), leadAgentId, templateId);
  } finally {
    db.close();
  }
}

async function expectValidationErrorResponse(
  response: Response,
  code: string,
  message: string
) {
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.ok).toBe(false);
  expect(payload.error.code).toBe(code);
  expect(payload.error.message).toBe(message);
}

describe("forge api routes", () => {
  it("returns agency-style markdown for an agent profile section", async () => {
    const { directory } = prepareWorkspace();
    const docsDir = join(directory, "docs", "agents");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, "agent-pm.md"),
      "# 产品策略 Agent\n\n## Identity\n\n## Core Mission\n\n## Critical Rules\n\n## Deliverables\n\n## Success Metrics\n- PRD 包含主流程、异常流和验收标准\n",
      "utf8"
    );

    const response = await getAgentMarkdown(
      new Request("http://127.0.0.1:3000/api/forge/agents/agent-pm/markdown?section=ability"),
      { params: Promise.resolve({ agentId: "agent-pm" }) }
    );
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(payload).toContain("# 产品策略 Agent");
    expect(payload).toContain("## Identity");
    expect(payload).toContain("## Core Mission");
    expect(payload).toContain("## Critical Rules");
    expect(payload).toContain("## Deliverables");
    expect(payload).toContain("## Success Metrics");
  });

  it("downloads a GitHub skill repository zip into the local skill download directory", async () => {
    prepareWorkspace();
    const downloadDir = mkdtempSync(join(tmpdir(), "forge-skill-download-"));
    directories.push(downloadDir);
    vi.stubEnv("FORGE_SKILL_DOWNLOAD_DIR", downloadDir);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          default_branch: "main"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([80, 75, 3, 4]).buffer
      }) as typeof global.fetch;

    const response = await postSkillImport(
      new Request("http://127.0.0.1:3000/api/forge/skills/import", {
        method: "POST",
        body: JSON.stringify({
          githubUrl: "https://github.com/crossoverJie/SkillDeck",
          skillName: "PRD 结构化生成"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.repository).toBe("crossoverJie/SkillDeck");
    expect(payload.data.downloadPath).toContain(downloadDir);
    expect(existsSync(payload.data.downloadPath)).toBe(true);
    expect(Array.from(readFileSync(payload.data.downloadPath))).toEqual([80, 75, 3, 4]);
  });

  it("returns prompt templates through the prompts route", async () => {
    prepareWorkspace();

    const response = await getPrompts();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(3);
    expect(payload.data.items[0].title).toContain("模板");
  });

  it("creates a standard project from a one-sentence requirement by default", async () => {
    prepareWorkspace();

    const response = await postProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
          enterpriseName: "百川零售",
          projectType: "客服副驾驶",
          teamTemplateId: "team-design-sprint",
          deliveryDate: "2026-03-22",
          note: "正常新建项目，不直接进入演示闭环。",
          owner: "Demo Owner"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);

    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const createdProjectId = payload.data.activeProjectId;
    const createdProject = snapshotPayload.data.projects.find(
      (item: { id: string }) => item.id === createdProjectId
    );
    const createdArtifactTypes = snapshotPayload.data.artifacts
      .filter((artifact: { projectId: string }) => artifact.projectId === createdProjectId)
      .map((artifact: { type: string; status: string }) => `${artifact.type}:${artifact.status}`);
    const createdWorkflow = snapshotPayload.data.workflowStates.find(
      (item: { projectId: string }) => item.projectId === createdProjectId
    );
    const createdRuns = snapshotPayload.data.runs.filter(
      (item: { projectId: string }) => item.projectId === createdProjectId
    );

    expect(createdProject).toEqual(
      expect.objectContaining({
        enterpriseName: "百川零售",
        projectType: "客服副驾驶",
        deliveryDate: "2026-03-22",
        note: "正常新建项目，不直接进入演示闭环。",
        status: "active",
        progress: 0
      })
    );
    expect(createdArtifactTypes).toEqual(
      expect.arrayContaining([
        "prd:draft",
        "architecture-note:draft",
        "ui-spec:draft",
        "task-pack:draft"
      ])
    );
    expect(createdArtifactTypes).not.toEqual(expect.arrayContaining(["release-brief:ready", "review-decision:ready"]));
    expect(createdWorkflow).toEqual(
      expect.objectContaining({
        currentStage: "项目接入",
        state: "current"
      })
    );
    expect(createdRuns).toHaveLength(0);
  });

  it("creates and seeds a demo-safe project from a one-sentence requirement when demoSeed is enabled", async () => {
    prepareWorkspace();

    const response = await postProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
          demoSeed: true,
          enterpriseName: "百川零售",
          projectType: "客服副驾驶",
          teamTemplateId: "team-design-sprint",
          deliveryDate: "2026-03-22",
          note: "演示场景优先走支付失败处理。",
          owner: "Demo Owner"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.project.name).toContain("零售客服副驾驶");
    expect(payload.data.project.owner).toBe("Demo Owner");
    expect(payload.data.project.enterpriseName).toBe("百川零售");
    expect(payload.data.project.projectType).toBe("客服副驾驶");
    expect(payload.data.project.deliveryDate).toBe("2026-03-22");
    expect(payload.data.project.note).toBe("演示场景优先走支付失败处理。");

    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const createdProjectId = payload.data.activeProjectId;
    const createdProject = snapshotPayload.data.projects.find(
      (item: { id: string }) => item.id === createdProjectId
    );
    const createdArtifactTypes = snapshotPayload.data.artifacts
      .filter((artifact: { projectId: string }) => artifact.projectId === createdProjectId)
      .map((artifact: { type: string }) => artifact.type);
    const createdWorkflow = snapshotPayload.data.workflowStates.find(
      (item: { projectId: string }) => item.projectId === createdProjectId
    );
    const createdProfile = snapshotPayload.data.projectProfiles.find(
      (item: { projectId: string }) => item.projectId === createdProjectId
    );
    const createdPrd = snapshotPayload.data.prdDocuments.find(
      (item: { projectId: string }) => item.projectId === createdProjectId
    );
    const createdRuns = snapshotPayload.data.runs
      .filter((item: { projectId: string }) => item.projectId === createdProjectId)
      .map((item: { title: string }) => item.title);

    expect(createdArtifactTypes).toEqual(
      expect.arrayContaining([
        "prd",
        "architecture-note",
        "ui-spec",
        "task-pack",
        "release-brief",
        "review-decision"
      ])
    );
    expect(createdPrd?.title).toContain("PRD");
    expect(createdProject).toEqual(
      expect.objectContaining({
        enterpriseName: "百川零售",
        projectType: "客服副驾驶",
        deliveryDate: "2026-03-22",
        note: "演示场景优先走支付失败处理。"
      })
    );
    expect(createdProfile).toEqual(
      expect.objectContaining({
        teamTemplateId: "team-design-sprint",
        teamTemplateTitle: "设计冲刺团队"
      })
    );
    expect(createdRuns).toEqual(
      expect.arrayContaining(["主流程回归验证"])
    );
    expect(createdWorkflow).toEqual(
      expect.objectContaining({
        currentStage: "交付发布"
      })
    );
  });

  it("updates persisted project information through the projects route", async () => {
    prepareWorkspace();

    const createResponse = await postProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
          enterpriseName: "百川零售",
          projectType: "客服副驾驶",
          deliveryDate: "2026-03-22",
          note: "演示场景优先走支付失败处理。",
          owner: "Demo Owner"
        })
      })
    );
    const createPayload = await createResponse.json();

    const response = await patchProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: createPayload.data.activeProjectId,
          requirement: "升级零售客服副驾驶，补齐退款与支付异常闭环。",
          enterpriseName: "百川零售集团",
          name: "零售客服副驾驶 Pro",
          sector: "零售电商",
          projectType: "智能客服中台",
          teamTemplateId: "team-lean-validation",
          owner: "Ariel",
          deliveryDate: "2026-03-28",
          note: "补充支付失败回访话术与演示账号。"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project).toEqual(
      expect.objectContaining({
        id: createPayload.data.activeProjectId,
        name: "零售客服副驾驶 Pro",
        enterpriseName: "百川零售集团",
        sector: "零售电商",
        projectType: "智能客服中台",
        owner: "Ariel",
        deliveryDate: "2026-03-28",
        note: "补充支付失败回访话术与演示账号。"
      })
    );

    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const updatedProject = snapshotPayload.data.projects.find(
      (item: { id: string }) => item.id === createPayload.data.activeProjectId
    );
    const updatedProfile = snapshotPayload.data.projectProfiles.find(
      (item: { projectId: string }) => item.projectId === createPayload.data.activeProjectId
    );

    expect(updatedProject).toEqual(
      expect.objectContaining({
        requirement: "升级零售客服副驾驶，补齐退款与支付异常闭环。",
        enterpriseName: "百川零售集团",
        name: "零售客服副驾驶 Pro",
        sector: "零售电商",
        projectType: "智能客服中台",
        owner: "Ariel",
        deliveryDate: "2026-03-28",
        note: "补充支付失败回访话术与演示账号。"
      })
    );
    expect(updatedProfile).toEqual(
      expect.objectContaining({
        teamTemplateId: "team-lean-validation",
        teamTemplateTitle: "最小验证团队"
      })
    );
  });

  it("deletes a project through the projects route", async () => {
    prepareWorkspace();

    const createResponse = await postProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
          enterpriseName: "百川零售",
          projectType: "客服副驾驶",
          deliveryDate: "2026-03-22",
          note: "演示场景优先走支付失败处理。",
          owner: "Demo Owner"
        })
      })
    );
    const createPayload = await createResponse.json();
    const createdProjectId = createPayload.data.activeProjectId as string;

    const response = await deleteProjects(
      new Request("http://127.0.0.1:3000/api/forge/projects", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: createdProjectId
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.deletedProjectId).toBe(createdProjectId);

    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const deletedProject = snapshotPayload.data.projects.find(
      (item: { id: string }) => item.id === createdProjectId
    );

    expect(deletedProject).toBeUndefined();
  });

  it("returns four local model provider settings through the model providers route", async () => {
    prepareWorkspace();

    const response = await getModelProviders();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "kimi",
          label: "Moonshot Kimi",
          hasApiKey: false,
          modelPriority: ["kimi-k2.5"]
        }),
        expect.objectContaining({
          id: "kimi-coding",
          label: "Kimi Coding",
          hasApiKey: false,
          modelPriority: ["k2p5"]
        }),
        expect.objectContaining({
          id: "openai",
          label: "OpenAI",
          hasApiKey: false,
          modelPriority: ["gpt-5.4"]
        }),
        expect.objectContaining({
          id: "anthropic",
          label: "Anthropic Claude",
          hasApiKey: false,
          modelPriority: ["claude-sonnet-4-5"]
        }),
        expect.objectContaining({
          id: "google",
          label: "Google Gemini",
          hasApiKey: false,
          modelPriority: ["gemini-2.5-pro"]
        })
      ])
    );
  });

  it("saves local kimi provider settings through the model providers route", async () => {
    prepareWorkspace();

    const response = await postModelProviders(
      new Request("http://127.0.0.1:3000/api/forge/model-providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "save",
          providerId: "kimi",
          enabled: true,
          apiKey: "sk-kimi-local-123456",
          modelPriority: ["kimi-k2.5", "kimi-thinking-preview"]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.provider).toEqual(
      expect.objectContaining({
        id: "kimi",
        enabled: true,
        hasApiKey: true,
        modelPriority: ["kimi-k2.5", "kimi-thinking-preview"]
      })
    );
    expect(payload.data.provider.apiKeyHint).toContain("3456");
    expect(payload.data.provider.apiKey).toBeUndefined();
  });

  it("tests the kimi provider connection through the model providers route", async () => {
    prepareWorkspace();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl-healthcheck",
          choices: [
            {
              message: {
                role: "assistant",
                content: "OK"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postModelProviders(
      new Request("http://127.0.0.1:3000/api/forge/model-providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "test",
          providerId: "kimi",
          apiKey: "sk-kimi-local-123456",
          model: "kimi-k2.5"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.connection).toEqual(
      expect.objectContaining({
        providerId: "kimi",
        model: "kimi-k2.5",
        status: "success"
      })
    );
    expect(payload.data.provider.enabled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-kimi-local-123456"
        })
      })
    );
  });

  it("tests the openai provider connection through the model providers route", async () => {
    prepareWorkspace();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl-openai-healthcheck",
          choices: [
            {
              message: {
                role: "assistant",
                content: "OK"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postModelProviders(
      new Request("http://127.0.0.1:3000/api/forge/model-providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "test",
          providerId: "openai",
          apiKey: "sk-openai-local-123456",
          model: "gpt-5.4"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.connection).toEqual(
      expect.objectContaining({
        providerId: "openai",
        model: "gpt-5.4",
        status: "success"
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-openai-local-123456"
        })
      })
    );
  });

  it("saves local kimi coding provider settings through the model providers route", async () => {
    prepareWorkspace();

    const response = await postModelProviders(
      new Request("http://127.0.0.1:3000/api/forge/model-providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "save",
          providerId: "kimi-coding",
          enabled: true,
          apiKey: "sk-kimi-coding-local-123456",
          modelPriority: ["k2p5"]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.provider).toEqual(
      expect.objectContaining({
        id: "kimi-coding",
        enabled: true,
        hasApiKey: true,
        modelPriority: ["k2p5"]
      })
    );
    expect(payload.data.provider.apiKeyHint).toContain("3456");
    expect(payload.data.provider.apiKey).toBeUndefined();
  });

  it("tests the kimi coding provider connection through the model providers route", async () => {
    prepareWorkspace();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg-healthcheck",
          content: [
            {
              type: "text",
              text: "OK"
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postModelProviders(
      new Request("http://127.0.0.1:3000/api/forge/model-providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "test",
          providerId: "kimi-coding",
          apiKey: "sk-kimi-coding-local-123456",
          model: "k2p5"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.connection).toEqual(
      expect.objectContaining({
        providerId: "kimi-coding",
        model: "k2p5",
        status: "success"
      })
    );
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

  it("returns project templates through the templates route", async () => {
    prepareWorkspace();

    const response = await getTemplates();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBe(3);
    expect(payload.data.items[0].title).toContain("模板");
  });

  it("returns task items through the tasks route", async () => {
    prepareWorkspace();

    const response = await getTasks(
      new Request("http://127.0.0.1:3000/api/forge/tasks?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.releaseGate?.overallLabel).toBeTruthy();
    expect(payload.data.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.capabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.total).toBeGreaterThan(0);
    expect(payload.data.items[0].projectId).toBe("retail-support");
    expect(payload.data.items[0].sourceCommandLabel).toBe("发起测试门禁");
    expect(payload.data.items[0].sourceCommandAction).toContain("来源命令：发起测试门禁");
    expect(payload.data.items[0].relatedArtifactLabels).toEqual([]);
    expect(payload.data.items[0].missingArtifactLabels).toEqual(
      expect.arrayContaining(["测试报告", "Playwright 回归记录"])
    );
    expect(payload.data.items[0].relatedRunId).toBe("run-2");
    expect(payload.data.items[0].relatedRunLabel).toContain("回归客服退款流程");
    expect(payload.data.items[0].remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
    expect(payload.data.items[0].remediationSummary).toContain("优先补齐");
    expect(payload.data.items[0].remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
    expect(payload.data.items[0].retryCommandId).toBe("command-gate-run");
    expect(payload.data.items[0].retryCommandLabel).toBe("发起测试门禁");
    expect(payload.data.items[0].taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.items[0].taskPackLabel).toBe("支付失败修复任务包");
    expect(payload.data.items[0].linkedComponentLabels).toEqual(expect.any(Array));
    expect(payload.data.items[0].linkedComponentIds).toEqual(expect.any(Array));
    expect(payload.data.items[0].pendingComponentLabels).toEqual(
      expect.arrayContaining(["支付结算组件"])
    );
    expect(payload.data.items[0].pendingComponentIds).toEqual(
      expect.arrayContaining(["component-payment-checkout"])
    );
    expect(payload.data.items[0].componentAssemblyAction).toContain("待装配组件");
    expect(payload.data.items[0].retryApiPath).toBe("/api/forge/tasks/retry");
    expect(payload.data.items[0].unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.items[0].retryRunnerCommand).toContain("--task-id task-retail-playwright");
    expect(payload.data.items[0].retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    expect(payload.data.items[0].unifiedRetryRunnerCommand).toContain(
      "--remediation-id task-retail-playwright"
    );
    expect(payload.data.items[0].runtimeExecutionBackendInvocation).toBeNull();
    expect(payload.data.items[0].evidenceAction).toContain("证据缺口");
    expect(payload.data.summary.dispatchCount).toBeGreaterThan(0);
    expect(payload.data.summary.remediationCount).toBeGreaterThan(0);
    expect(payload.data.summary.topProject?.name).toBe("零售客服副驾驶");
    expect(payload.data.summary.busyAgent?.name).toEqual(expect.any(String));
    expect(payload.data.summary.topRemediationOwner).toBe("测试开发工程师 · Monkey");
  });

  it("returns the control-plane snapshot through the snapshot route", async () => {
    prepareWorkspace();

    const response = await getSnapshot();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.controlPlane?.unifiedRemediationApiPath).toBe(
      "/api/forge/remediations/retry"
    );
    expect(payload.data.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.runtimeSummary?.capabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.controlPlane?.readiness?.statusLabel).toBeTruthy();
    expect(payload.data.controlPlane?.releaseGate?.overallLabel).toBeTruthy();
    expect(Array.isArray(payload.data.controlPlane?.blockingTasks)).toBe(true);
    expect(Array.isArray(payload.data.controlPlane?.remediationQueue)).toBe(true);
    expect(Array.isArray(payload.data.controlPlane?.evidenceTimeline)).toBe(true);
    expect(Array.isArray(payload.data.controlPlane?.recentExecutions)).toBe(true);
  });

  it("returns the dedicated control-plane payload through the control-plane route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-dev",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    upsertRunForAI(
      {
        id: "run-retail-review-provider",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        linkedComponentIds: ["component-auth-email"],
        title: "执行退款失败补丁规则审查",
        executor: "Reviewer",
        cost: "$0.28",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [
          {
            name: "model-execution",
            status: "pass",
            summary:
              "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
          },
          { name: "evidence", status: "tool-ready", summary: "已检测到外部审查执行器" }
        ]
      },
      dbPath
    );

    const response = await getControlPlane(
      new Request("http://127.0.0.1:3000/api/forge/control-plane?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project?.id).toBe("retail-support");
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.readiness?.statusLabel).toBeTruthy();
    expect(payload.data.releaseGate?.overallLabel).toBeTruthy();
    expect(payload.data.componentRegistry?.project?.id).toBe("retail-support");
    expect(payload.data.componentRegistry?.taskPack?.id).toBe("artifact-taskpack-retail");
    expect(payload.data.componentRegistry?.recommendedCount).toBeGreaterThan(0);
    expect(payload.data.componentRegistry?.pendingCount).toBeGreaterThanOrEqual(0);
    expect(payload.data.componentRegistry?.assemblySuggestions?.[0]?.componentId).toBe(
      "component-payment-checkout"
    );
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "engineer-execution-backend",
          runnerProfile: "engineer-runner",
          supportedCommandTypes: ["execution.start"],
          expectedArtifacts: ["patch", "demo-build"]
        })
      ])
    );
    expect(Array.isArray(payload.data.componentRegistry?.items)).toBe(true);
    expect(Array.isArray(payload.data.blockingTasks)).toBe(true);
    expect(Array.isArray(payload.data.remediationQueue)).toBe(true);
    expect(Array.isArray(payload.data.evidenceTimeline)).toBe(true);
    expect(Array.isArray(payload.data.recentExecutions)).toBe(true);
    expect(payload.data.currentHandoff).toEqual(
      expect.objectContaining({
        stage: expect.any(String),
        source: expect.any(String),
        nextAction: expect.any(String)
      })
    );
    expect(payload.data.formalArtifactCoverage).toEqual({
      count: 0,
      summary: "当前还没有沉淀正式工件。",
      detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
    });
    expect(Array.isArray(payload.data.pendingApprovals)).toBe(true);
    expect(Array.isArray(payload.data.escalationItems)).toBe(true);
    expect(
      payload.data.remediationQueue.find((item: { id: string }) => item.id === "task-retail-review-remediation")
        ?.runtimeExecutionBackendInvocation
    ).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        commandType: "review.run",
        artifactType: "patch",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
    expect(
      payload.data.recentExecutions.find((item: { commandId: string }) => item.commandId === "command-review-run")
        ?.followUpTasks?.[0]?.runtimeExecutionBackendInvocation
    ).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        commandType: "review.run",
        artifactType: "patch",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
  });

  it("returns a stable execution page contract through the pages route", async () => {
    prepareWorkspace();

    const response = await getPages(
      new Request("http://127.0.0.1:3000/api/forge/pages?view=execution")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.view).toBe("execution");
    expect(payload.data.contractVersion).toBeTruthy();
    expect("snapshot" in payload.data.page).toBe(false);
    expect(payload.data.page.metrics.totalRuns).toBeGreaterThan(0);
    expect(Array.isArray(payload.data.page.localContext.items)).toBe(true);
    expect(payload.data.page.currentHandoffControllerLabel).toBe("项目经理 · Lion");
    expect(payload.data.page.currentHandoffOwnerLabel).toEqual(expect.any(String));
    expect(payload.data.page.currentHandoffOwnerRoleLabel).toEqual(expect.any(String));
  });

  it("returns a stable home page contract through the pages route without invoking real-skill hydration", async () => {
    prepareWorkspace();
    const hydrateSpy = vi.spyOn(forgeRealSkills, "hydrateSnapshotWithRealSkills").mockImplementation(() => {
      throw new Error("real skills unavailable");
    });

    try {
      const response = await getPages(
        new Request("http://127.0.0.1:3000/api/forge/pages?view=home")
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.data.view).toBe("home");
      expect(payload.data.page.projects.length).toBeGreaterThan(0);
      expect(payload.data.page.agents.length).toBeGreaterThan(0);
      expect(payload.data.page.dataMode).toBe("local");
      expect(payload.data.page.dataModeLabel).toBe("本地模式");
      expect(hydrateSpy).not.toHaveBeenCalled();
    } finally {
      hydrateSpy.mockRestore();
    }
  });

  it("resolves stable page aliases through the pages route", async () => {
    prepareWorkspace();

    const response = await getPages(
      new Request("http://127.0.0.1:3000/api/forge/pages?view=intake")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.view).toBe("projects");
    expect(payload.data.page.runEvents).toEqual(expect.any(Array));
  });

  it("rejects missing page view through the pages route", async () => {
    prepareWorkspace();

    const response = await getPages(new Request("http://127.0.0.1:3000/api/forge/pages"));

    await expectValidationErrorResponse(response, "FORGE_VALIDATION_ERROR", "页面视图不能为空");
  });

  it("returns a stable governance page contract through the pages route", async () => {
    prepareWorkspace();

    const response = await getPages(
      new Request("http://127.0.0.1:3000/api/forge/pages?view=governance")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.view).toBe("governance");
    expect(payload.data.contractVersion).toBeTruthy();
    expect(payload.data.page.snapshot).toBeTruthy();
    expect(payload.data.page.approvalHandoffSummary).toBeTruthy();
    expect(payload.data.page.currentHandoffControllerLabel).toBe("项目经理 · Lion");
    expect(payload.data.page.currentHandoffOwnerLabel).toEqual(expect.any(String));
    expect(payload.data.page.currentHandoffOwnerRoleLabel).toEqual(expect.any(String));
  });

  it("prepares an execution backend adapter request through the prepare route", { timeout: 10000 }, async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("remediation");
    expect(payload.data.sourceId).toBe("task-retail-review-remediation");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Review",
        commandType: "review.run",
        artifactType: "patch",
        taskPackId: "artifact-taskpack-retail",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
  });

  it("prepares a review remediation through the global NanoClaw manager backend when lane-specific backends are absent", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv(
      "FORGE_NANO_EXEC_BACKEND_COMMAND",
      'nanoclaw manage --command "{commandType}" --project "{projectId}" --stage "{stage}" --taskpack "{taskPackId}" --agent "{agentId}" --controller "{controllerAgentId}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("remediation");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "NanoClaw",
        provider: "Nano CEO",
        commandType: "review.run",
        artifactType: "patch",
        taskPackId: "artifact-taskpack-retail",
        commandPreview: expect.stringContaining('nanoclaw manage --command "review.run"'),
        payload: expect.objectContaining({
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          controllerAgent: expect.objectContaining({
            id: "agent-service-strategy",
            name: "项目经理 · Lion"
          })
        })
      })
    );
    expect(payload.data.invocation.commandPreview).toContain('--controller "agent-service-strategy"');
    expect(payload.data.invocation.commandPreview).toContain('--provider "Nano CEO"');
  });

  it("falls back to the built-in NanoClaw manager wrapper when no global backend command template is provided", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.invocation.backend).toBe("NanoClaw");
    expect(payload.data.invocation.commandPreview).toContain("forge-nanoclaw-manager.mjs");
    expect(payload.data.invocation.commandPreview).toContain('--command "review.run"');
    expect(payload.data.invocation.commandPreview).toContain('--controller-id "agent-service-strategy"');
  });

  it("prepares a NanoClaw CEO handoff project through the execution backend prepare route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_PM_EXEC_COMMAND",
      'forge ceo --project "{projectId}" --stage "{stage}"'
    );
    vi.stubEnv("FORGE_PM_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_PM_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv(
      "FORGE_PM_EXEC_BACKEND_COMMAND",
      'nanoclaw run-ceo --project "{projectId}" --stage "{stage}" --agent "{agentId}" --provider "{provider}"'
    );

    const db = new Database(dbPath);
    db.prepare(`
      UPDATE team_templates
      SET agent_ids_json = ?,
          lead_agent_id = ?
      WHERE id = ?
    `).run(
      JSON.stringify([
        "agent-pm",
        "agent-architect",
        "agent-design",
        "agent-engineer",
        "agent-qa",
        "agent-release",
        "agent-knowledge"
      ]),
      "agent-pm",
      "team-standard-delivery"
    );
    db.close();

    const created = createProjectForAI(
      {
        name: "Nano CEO 接入台",
        sector: "智能客服 / 零售",
        owner: "Iris",
        templateId: "template-smart-service",
        teamTemplateId: "team-standard-delivery"
      },
      dbPath
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("project-handoff");
    expect(payload.data.retryCommandId).toBe("command-prd-generate");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "pm-execution-backend",
        backend: "NanoClaw",
        provider: "Nano CEO",
        commandType: "prd.generate",
        commandPreview: `nanoclaw run-ceo --project "${created.project.id}" --stage "项目接入" --agent "agent-service-strategy" --provider "Nano CEO"`
      })
    );
    expect(payload.data.invocation.payload).toEqual(
      expect.objectContaining({
        projectId: created.project.id,
        stage: "项目接入",
        commandType: "prd.generate",
        agent: expect.objectContaining({
          id: "agent-service-strategy",
          name: "项目经理 · Lion"
        })
      })
    );
  });

  it("rejects non-object request bodies through the execution backend prepare route", async () => {
    prepareWorkspace();

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("task-retail-review-remediation")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("prepares a review handoff project directly through the execution backend prepare route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "桥接规则审查路由台",
        sector: "智能客服 / 研发",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接规则审查路由台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("project-handoff");
    expect(payload.data.sourceId).toBe(created.project.id);
    expect(payload.data.retryCommandId).toBe("command-review-run");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Review",
        commandType: "review.run",
        artifactType: "patch",
        taskPackId: expect.any(String),
        commandPreview:
          `openclaw run-review --project "${created.project.id}" --taskpack "${payload.data.taskPackId}" --artifact "patch" --provider "Claude Code Review"`
      })
    );
  });

  it(
    "prepares a qa handoff project directly through the execution backend prepare route",
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_QA_EXEC_COMMAND",
      'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_QA_EXEC_BACKEND_COMMAND",
      'openclaw run-gate --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "桥接测试门禁路由台",
        sector: "智能客服 / 测试",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接测试门禁路由台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("project-handoff");
    expect(payload.data.sourceId).toBe(created.project.id);
    expect(payload.data.retryCommandId).toBe("command-gate-run");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "qa-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code QA",
        commandType: "gate.run",
        taskPackId: expect.any(String),
        expectedArtifacts: ["test-report", "playwright-run"],
        commandPreview:
          `openclaw run-gate --project "${created.project.id}" --taskpack "${payload.data.taskPackId}" --provider "Claude Code QA"`
      })
    );
    },
    10000
  );

  it("dispatches an execution backend adapter request through the dispatch route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendDispatch(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("queued");
    expect(payload.data.mode).toBe("stub");
    expect(payload.data.sourceKind).toBe("remediation");
    expect(payload.data.backend).toBe("OpenClaw");
    expect(payload.data.provider).toBe("Claude Code Review");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        commandType: "review.run",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
  });

  it("rejects non-object request bodies through the execution backend dispatch route", async () => {
    prepareWorkspace();

    const response = await postExecutionBackendDispatch(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("task-retail-review-remediation")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("builds an execution backend shell plan through the execute route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendExecute(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("ready");
    expect(payload.data.mode).toBe("external-shell-stub");
    expect(payload.data.backend).toBe("OpenClaw");
    expect(payload.data.provider).toBe("Claude Code Review");
    expect(payload.data.execution.command).toEqual([
      "openclaw",
      "run-review",
      "--project",
      "retail-support",
      "--taskpack",
      "artifact-taskpack-retail",
      "--artifact",
      "patch",
      "--provider",
      "Claude Code Review"
    ]);
    expect(payload.data.execution.commandPreview).toBe(
      'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
    );
  });

  it("rejects non-object request bodies through the execution backend execute route", async () => {
    prepareWorkspace();

    const response = await postExecutionBackendExecute(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("task-retail-review-remediation")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("returns an execution backend bridge stub through the bridge route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendBridge(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("ready");
    expect(payload.data.mode).toBe("external-shell-bridge-stub");
    expect(payload.data.bridgeStatus).toBe("stub");
    expect(payload.data.outputMode).toBe("external-shell-bridge-ready");
    expect(payload.data.evidenceStatus).toBe("tool-ready");
    expect(payload.data.evidenceLabel).toBe("工具就绪");
    expect(payload.data.outputChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "execution-backend",
          status: "pass"
        }),
        expect.objectContaining({
          name: "evidence",
          status: "tool-ready"
        })
      ])
    );
    expect(payload.data.execution.commandPreview).toBe(
      'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
    );
    expect(payload.data.executionResult).toBeNull();
  }, 10000);

  it("rejects non-object request bodies through the execution backend bridge route", async () => {
    prepareWorkspace();

    const response = await postExecutionBackendBridge(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("task-retail-review-remediation")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("executes an execution backend bridge through the local shell strategy", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendBridge(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("executed");
    expect(payload.data.mode).toBe("external-shell-bridge");
    expect(payload.data.bridgeStatus).toBe("executed");
    expect(payload.data.outputMode).toBe("external-shell-bridge-executed");
    expect(payload.data.evidenceStatus).toBe("executed");
    expect(payload.data.evidenceLabel).toBe("已执行");
    expect(payload.data.outputChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "execution-backend",
          status: "pass"
        }),
        expect.objectContaining({
          name: "bridge-execution",
          status: "pass"
        }),
        expect.objectContaining({
          name: "evidence",
          status: "executed"
        })
      ])
    );
    expect(payload.data.execution.command).toEqual(["/bin/sh", "-lc", "printf bridge-ok"]);
    expect(payload.data.executionResult.ok).toBe(true);
    expect(payload.data.executionResult.summary).toContain("bridge-ok");
  });

  it("executes a NanoClaw manager bridge through the built-in wrapper and returns a structured receipt", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv(
      "FORGE_NANO_MANAGE_COMMAND",
      'node -e "process.stdout.write(JSON.stringify({ok:true,status:\'done\',summary:\'Nano 审查回执已生成\',artifacts:[{type:\'review-report\',title:\'Nano 审查记录\',ownerAgentId:\'agent-architect\',status:\'ready\'}],checks:[{name:\'receipt\',status:\'pass\'}],details:[\'review lane complete\']}))"'
    );
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const response = await postExecutionBackendBridge(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("executed");
    expect(payload.data.backend).toBe("NanoClaw");
    expect(payload.data.execution.command[0]).toBe("node");
    expect(payload.data.execution.command.join(" ")).toContain("forge-nanoclaw-manager.mjs");
    expect(payload.data.executionResult).toMatchObject({
      ok: true,
      summary: "Nano 审查回执已生成"
    });
    expect(payload.data.executionResult.data).toMatchObject({
      status: "done",
      artifacts: [
        {
          type: "review-report",
          title: "Nano 审查记录",
          ownerAgentId: "agent-architect",
          status: "ready"
        }
      ],
      checks: [{ name: "receipt", status: "pass" }]
    });
  });

  it("writes back an execution backend bridge result into the runs route surface", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );

    const writebackResponse = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell",
          runId: "run-bridge-route-review"
        })
      })
    );
    const writebackPayload = await writebackResponse.json();

    expect(writebackResponse.status).toBe(200);
    expect(writebackPayload.ok).toBe(true);
    expect(writebackPayload.data.run.id).toBe("run-bridge-route-review");
    expect(writebackPayload.data.run.outputMode).toBe("external-shell-bridge-executed");
    expect(writebackPayload.data.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "retail-support",
          type: "review-report",
          status: "ready"
        })
      ])
    );

    const runsResponse = await getRuns(
      new Request("http://127.0.0.1:3000/api/forge/runs?projectId=retail-support")
    );
    const runsPayload = await runsResponse.json();
    const bridgeItem = runsPayload.data.items.find((item: { id: string }) => item.id === "run-bridge-route-review");
    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const reviewArtifact = snapshotPayload.data.artifacts.find(
      (item: { projectId: string; type: string }) =>
        item.projectId === "retail-support" && item.type === "review-report"
    );

    expect(bridgeItem?.outputMode).toBe("external-shell-bridge-executed");
    expect(bridgeItem?.evidenceStatus).toBe("executed");
    expect(bridgeItem?.evidenceLabel).toBe("已执行");
    expect(reviewArtifact?.status).toBe("ready");
  });

  it("rejects non-object request bodies through the execution backend bridge writeback route", async () => {
    prepareWorkspace();

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("task-retail-review-remediation")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("writes back an engineer bridge result from runner gates into review-ready artifacts", { timeout: 10000 }, async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "桥接研发交付台",
        sector: "智能客服 / 研发",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接研发交付台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.bridge.invocation.commandType).toBe("execution.start");
    expect(payload.data.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: created.project.id, type: "patch" }),
        expect.objectContaining({ projectId: created.project.id, type: "demo-build" })
      ])
    );

    const controlPlaneResponse = await getControlPlane(
      new Request(`http://127.0.0.1:3000/api/forge/control-plane?projectId=${created.project.id}`)
    );
    const controlPlanePayload = await controlPlaneResponse.json();

    expect(controlPlaneResponse.status).toBe(200);
    expect(controlPlanePayload.data.currentHandoff.source).toBe("review-handoff");
    expect(controlPlanePayload.data.currentHandoff.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(controlPlanePayload.data.currentHandoff.runtimeExecutionBackendCommandPreview).toContain(
      `openclaw run-review --project "${created.project.id}"`
    );
    expect(controlPlanePayload.data.currentHandoff.runtimeExecutionBackendInvocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        commandType: "review.run",
        artifactType: "patch"
      })
    );
    expect(controlPlanePayload.data.formalArtifactCoverage).toEqual({
      count: 0,
      summary: "当前还没有沉淀正式工件。",
      detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
    });
    expect(controlPlanePayload.data.formalArtifactGap).toEqual({
      missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
      missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
      summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
      ownerLabel: "技术架构师 · Eagle",
      ownerRoleLabel: "架构师",
      nextAction: "桥接研发执行已完成，先由技术架构师 · Eagle 发起规则审查并补齐规则审查记录。"
    });
    expect(controlPlanePayload.data.formalArtifactResponsibility).toEqual(
      expect.objectContaining({
        coverage: {
          count: 0,
          summary: "当前还没有沉淀正式工件。",
          detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
        },
        gap: {
          missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
          missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
          summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
          ownerLabel: "技术架构师 · Eagle",
          ownerRoleLabel: "架构师",
          nextAction: "桥接研发执行已完成，先由技术架构师 · Eagle 发起规则审查并补齐规则审查记录。"
        },
        approvalHandoff: expect.objectContaining({
          summary: "当前无需等待审批后接棒。",
          detail: "当前没有待人工确认事项。"
        }),
        pendingApprovals: expect.any(Array),
        provenance: expect.any(Array)
      })
    );
    expect(controlPlanePayload.data.approvalHandoff).toEqual(
      expect.objectContaining({
        summary: "当前无需等待审批后接棒。",
        detail: "当前没有待人工确认事项。"
      })
    );

    const database = new Database(dbPath, { readonly: true });

    try {
      const artifactReview = database
        .prepare(
          `SELECT reviewer_agent_id AS reviewerAgentId, decision FROM artifact_reviews
           WHERE artifact_id = (
             SELECT id FROM artifacts WHERE project_id = ? AND type = 'demo-build' ORDER BY rowid DESC LIMIT 1
           )`
        )
        .get(created.project.id) as { reviewerAgentId: string; decision: string } | undefined;
      const runnerGateTask = database
        .prepare(`SELECT status, summary FROM tasks WHERE id = ?`)
        .get(`task-${created.project.id}-runner-gates`) as
        | { status: string; summary: string }
        | undefined;

      expect(artifactReview?.reviewerAgentId).toBe("agent-qa-automation");
      expect(artifactReview?.decision).toBe("pending");
      expect(runnerGateTask?.status).toBe("done");
      expect(runnerGateTask?.summary).toContain("外部执行桥已写回 Patch 与 Demo");
    } finally {
      database.close();
    }
  });

  it("writes back a review handoff project directly into command audit and qa handoff", { timeout: 10000 }, async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

    const created = createProjectForAI(
      {
        name: "桥接规则审查直连台",
        sector: "智能客服 / 研发",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接规则审查直连台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.commandExecution?.commandId).toBe("command-review-run");
    expect(payload.data.commandExecution?.status).toBe("done");
    expect(payload.data.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-review`);
    expect(payload.data.commandExecution?.summary).toContain("已通过 OpenClaw Bridge 完成规则审查");

    const commandCenterResponse = await getCommandCenter();
    const commandCenterPayload = await commandCenterResponse.json();
    const reviewExecution = commandCenterPayload.data.recentExecutions.find(
      (item: { commandId: string }) => item.commandId === "command-review-run"
    );

    expect(commandCenterResponse.status).toBe(200);
    expect(reviewExecution?.summary).toContain("已通过 OpenClaw Bridge 完成规则审查");
    expect(reviewExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-review`);
  });

  it(
    "writes back a qa handoff project directly into command audit and release candidate",
    { timeout: 10000 },
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_QA_EXEC_COMMAND",
      'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

    const created = createProjectForAI(
      {
        name: "桥接测试门禁直连台",
        sector: "智能客服 / 测试",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接测试门禁直连台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        })
      })
    );
    const payload = await response.json();
    const readinessResponse = await getReadiness(
      new Request(`http://127.0.0.1:3000/api/forge/readiness?projectId=${created.project.id}`)
    );
    const readinessPayload = await readinessResponse.json();
    const commandCenterResponse = await getCommandCenter(
      new Request(`http://127.0.0.1:3000/api/forge/commands?projectId=${created.project.id}`)
    );
    const commandCenterPayload = await commandCenterResponse.json();
    const releaseExecution = commandCenterPayload.data.recentExecutions.find(
      (item: { commandId: string }) => item.commandId === "command-release-prepare"
    );
    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.bridge.retryCommandId).toBe("command-gate-run");
    expect(payload.data.bridge.invocation.commandType).toBe("gate.run");
    expect(payload.data.commandExecution?.commandId).toBe("command-gate-run");
    expect(payload.data.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-gate`);
    expect(payload.data.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: created.project.id, type: "test-report", status: "ready" }),
        expect.objectContaining({ projectId: created.project.id, type: "playwright-run", status: "ready" })
      ])
    );
    expect(
      snapshotPayload.data.artifacts.some(
        (item: { projectId: string; type: string; status: string }) =>
          item.projectId === created.project.id && item.type === "release-brief" && item.status === "draft"
      )
    ).toBe(true);
    expect(readinessResponse.status).toBe(200);
    expect(readinessPayload.data.currentHandoff.source).toBe("release-candidate");
    }
  );

  it("prepares a release candidate project directly through the execution backend prepare route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_QA_EXEC_COMMAND",
      'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_RELEASE_EXEC_COMMAND",
      'claude release --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_RELEASE_EXEC_PROVIDER", "Claude Code Release");
    vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_RELEASE_EXEC_BACKEND_COMMAND",
      'openclaw run-release --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "桥接交付说明路由台",
        sector: "智能客服 / 发布",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接交付说明路由台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        })
      })
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("project-handoff");
    expect(payload.data.retryCommandId).toBe("command-release-prepare");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "release-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Release",
        commandType: "release.prepare",
        expectedArtifacts: ["release-brief", "review-decision"],
        taskPackId: expect.any(String),
        commandPreview:
          `openclaw run-release --project "${created.project.id}" --taskpack "${payload.data.taskPackId}" --provider "Claude Code Release"`
      })
    );
  }, 10000);

  it(
    "writes back a release candidate project directly into command audit and pending approval",
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_QA_EXEC_COMMAND",
      'claude gate --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Claude Code QA");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_RELEASE_EXEC_COMMAND",
      'claude release --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_RELEASE_EXEC_PROVIDER", "Claude Code Release");
    vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

    const created = createProjectForAI(
      {
        name: "桥接交付说明直连台",
        sector: "智能客服 / 发布",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接交付说明直连台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        })
      })
    );

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-release`
        })
      })
    );
    const payload = await response.json();
    const readinessResponse = await getReadiness(
      new Request(`http://127.0.0.1:3000/api/forge/readiness?projectId=${created.project.id}`)
    );
    const readinessPayload = await readinessResponse.json();
    const commandCenterResponse = await getCommandCenter(
      new Request(`http://127.0.0.1:3000/api/forge/commands?projectId=${created.project.id}`)
    );
    const commandCenterPayload = await commandCenterResponse.json();
    const releaseExecution = commandCenterPayload.data.recentExecutions.find(
      (item: { commandId: string }) => item.commandId === "command-release-prepare"
    );
    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.bridge.retryCommandId).toBe("command-release-prepare");
    expect(payload.data.commandExecution?.commandId).toBe("command-release-prepare");
    expect(payload.data.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-release`);
    expect(payload.data.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: created.project.id, type: "release-brief", status: "in-review" }),
        expect.objectContaining({ projectId: created.project.id, type: "review-decision", status: "in-review" })
      ])
    );
    expect(readinessResponse.status).toBe(200);
    expect(readinessPayload.data.currentHandoff.source).toBe("approval");
    expect(commandCenterResponse.status).toBe(200);
    expect(releaseExecution?.approvalHandoffSummary).toBe("确认后将继续进入归档沉淀。");
    expect(releaseExecution?.approvalHandoffDetail).toContain(
      "确认交付说明与放行口径后，继续沉淀知识卡与归档审计。"
    );
    expect(releaseExecution?.approvalHandoffOwnerLabel).toBe("流程运营专员 · Duck");
    expect(releaseExecution?.approvalHandoffNextAction).toBe("沉淀交付知识卡与归档审计记录");
    expect(releaseExecution?.releaseClosureSummary).toContain("发布链已经进入人工确认");
    expect(releaseExecution?.releaseClosureDetail).toContain("确认责任：确认交付说明与放行口径");
    expect(releaseExecution?.releaseClosureNextAction).toBe("确认交付说明与放行口径");
    expect(releaseExecution?.releaseClosureResponsibilitySummary).toContain(
      "当前动作：确认交付说明与放行口径"
    );
    expect(releaseExecution?.releaseClosureResponsibilityDetail).toContain(
      "确认责任：确认交付说明与放行口径"
    );
    expect(releaseExecution?.releaseClosureResponsibilityNextAction).toBe("确认交付说明与放行口径");
    expect(releaseExecution?.releaseClosureResponsibilitySourceLabel).toContain("整理交付说明");
    expect(releaseExecution?.releaseClosureResponsibilitySourceLabel).toContain(
      "来源命令：整理交付说明"
    );
    expect(
      snapshotPayload.data.tasks.some(
        (item: { id: string; status: string }) =>
          item.id === `task-${created.project.id}-release-approval` && item.status === "todo"
      )
    ).toBe(true);
    },
    15000
  );

  it(
    "prepares an archive-stage project directly through the execution backend prepare route",
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ARCHIVE_EXEC_COMMAND",
      'claude archive --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ARCHIVE_EXEC_PROVIDER", "Claude Code Archive");
    vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ARCHIVE_EXEC_BACKEND_COMMAND",
      'openclaw run-archive --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "桥接归档直连台",
        sector: "智能客服 / 归档",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接归档直连台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );
    upsertProjectComponentLink(
      {
        projectId: created.project.id,
        componentId: "component-auth-email",
        reason: "研发执行前先装入账号与登录组件。",
        usageGuide: "先接邮箱登录，再补异常兜底。"
      },
      dbPath
    );

    executeCommandForAI({ commandId: "command-execution-start", projectId: created.project.id }, dbPath);
    executeCommandForAI({ commandId: "command-review-run", projectId: created.project.id }, dbPath);
    const db = new Database(dbPath);
    db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
    db.close();
    executeCommandForAI({ commandId: "command-gate-run", projectId: created.project.id }, dbPath);
    executeCommandForAI({ commandId: "command-release-prepare", projectId: created.project.id }, dbPath);
    upsertRunForAI(
      {
        id: `run-${created.project.id}-approval-runtime`,
        projectId: created.project.id,
        title: "放行阶段 Runtime 审计",
        executor: "交付编排执行器",
        cost: "$0.00",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [{ name: "git", status: "pass" }]
      },
      dbPath
    );
    executeCommandForAI({ commandId: "command-release-approve", projectId: created.project.id }, dbPath);

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: created.project.id })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceKind).toBe("project-handoff");
    expect(payload.data.retryCommandId).toBe("command-archive-capture");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "archive-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Archive",
        commandType: "archive.capture",
        expectedArtifacts: ["knowledge-card", "release-audit"],
        taskPackId: expect.any(String),
        commandPreview:
          `openclaw run-archive --project "${created.project.id}" --taskpack "${payload.data.taskPackId}" --provider "Claude Code Archive"`
      })
    );
    },
    15000
  );

  it(
    "writes back an archive-stage project directly into command audit and archive artifacts",
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ARCHIVE_EXEC_COMMAND",
      'claude archive --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ARCHIVE_EXEC_PROVIDER", "Claude Code Archive");
    vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_ARCHIVE_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

    const created = createProjectForAI(
      {
        name: "桥接归档直连台",
        sector: "智能客服 / 归档",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接归档直连台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );
    upsertProjectComponentLink(
      {
        projectId: created.project.id,
        componentId: "component-auth-email",
        reason: "研发执行前先装入账号与登录组件。",
        usageGuide: "先接邮箱登录，再补异常兜底。"
      },
      dbPath
    );

    executeCommandForAI({ commandId: "command-execution-start", projectId: created.project.id }, dbPath);
    executeCommandForAI({ commandId: "command-review-run", projectId: created.project.id }, dbPath);
    const db = new Database(dbPath);
    db.prepare(`UPDATE delivery_gates SET status = 'pass'`).run();
    db.close();
    executeCommandForAI({ commandId: "command-gate-run", projectId: created.project.id }, dbPath);
    executeCommandForAI({ commandId: "command-release-prepare", projectId: created.project.id }, dbPath);
    upsertRunForAI(
      {
        id: `run-${created.project.id}-approval-runtime`,
        projectId: created.project.id,
        title: "放行阶段 Runtime 审计",
        executor: "交付编排执行器",
        cost: "$0.00",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [{ name: "git", status: "pass" }]
      },
      dbPath
    );
    executeCommandForAI({ commandId: "command-release-approve", projectId: created.project.id }, dbPath);

    const response = await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-archive`
        })
      })
    );
    const payload = await response.json();
    const snapshotResponse = await getSnapshot();
    const snapshotPayload = await snapshotResponse.json();
    const readinessResponse = await getReadiness(
      new Request(`http://127.0.0.1:3000/api/forge/readiness?projectId=${created.project.id}`)
    );
    const readinessPayload = await readinessResponse.json();
    const controlPlaneResponse = await getControlPlane(
      new Request(`http://127.0.0.1:3000/api/forge/control-plane?projectId=${created.project.id}`)
    );
    const controlPlanePayload = await controlPlaneResponse.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.bridge.retryCommandId).toBe("command-archive-capture");
    expect(payload.data.commandExecution?.commandId).toBe("command-archive-capture");
    expect(payload.data.commandExecution?.relatedRunId).toBe(`run-bridge-${created.project.id}-archive`);
    expect(payload.data.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: created.project.id, type: "knowledge-card", status: "ready" }),
        expect.objectContaining({ projectId: created.project.id, type: "release-audit", status: "ready" })
      ])
    );
    expect(
      snapshotPayload.data.tasks.some(
        (item: { id: string; status: string }) =>
          item.id === `task-${created.project.id}-knowledge-card` && item.status === "done"
      )
    ).toBe(true);
    expect(readinessResponse.status).toBe(200);
    expect(readinessPayload.data.archiveProvenance?.artifactType).toBe("release-audit");
    expect(readinessPayload.data.archiveProvenance?.archiveCommandId).toBe("command-archive-capture");
    expect(readinessPayload.data.archiveProvenance?.archiveRunId).toBe(
      `run-bridge-${created.project.id}-archive`
    );
    expect(readinessPayload.data.archiveProvenance?.handoffCommandId).toBe("command-release-prepare");
    expect(readinessPayload.data.releaseGate.archiveProvenance?.archiveCommandId).toBe(
      "command-archive-capture"
    );
    expect(readinessPayload.data.releaseClosure).toEqual(
      expect.objectContaining({
        status: "archive-recorded",
        summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        nextAction: null,
        sourceCommandId: "command-archive-capture",
        sourceCommandLabel: "触发归档沉淀",
        relatedRunLabel: expect.stringContaining("触发归档沉淀")
      })
    );
    expect(readinessPayload.data.releaseClosureResponsibility).toEqual(
      expect.objectContaining({
        summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        sourceLabel: expect.stringContaining("触发归档沉淀"),
        nextAction: "沉淀交付知识卡与归档审计记录"
      })
    );
    expect(controlPlaneResponse.status).toBe(200);
    expect(controlPlanePayload.data.archiveProvenance?.archiveCommandId).toBe(
      "command-archive-capture"
    );
    expect(controlPlanePayload.data.archiveProvenance?.handoffCommandId).toBe(
      "command-release-prepare"
    );
    expect(controlPlanePayload.data.releaseClosure).toEqual(
      expect.objectContaining({
        status: "archive-recorded",
        summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        nextAction: null,
        sourceCommandId: "command-archive-capture",
        sourceCommandLabel: "触发归档沉淀",
        relatedRunLabel: expect.stringContaining("触发归档沉淀")
      })
    );
    expect(controlPlanePayload.data.releaseClosureResponsibility).toEqual(
      expect.objectContaining({
        summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        sourceLabel: expect.stringContaining("触发归档沉淀"),
        nextAction: "沉淀交付知识卡与归档审计记录"
      })
    );

    const commandCenterResponse = await getCommandCenter();
    const commandCenterPayload = await commandCenterResponse.json();

    expect(commandCenterResponse.status).toBe(200);
    expect(commandCenterPayload.ok).toBe(true);
    expect(commandCenterPayload.data.archiveProvenance?.archiveCommandId).toBe(
      "command-archive-capture"
    );
    expect(commandCenterPayload.data.archiveProvenance?.archiveRunId).toBe(
      `run-bridge-${created.project.id}-archive`
    );
    expect(commandCenterPayload.data.releaseClosure).toEqual(
      expect.objectContaining({
        status: "archive-recorded",
        summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        nextAction: null,
        sourceCommandId: "command-archive-capture",
        sourceCommandLabel: "触发归档沉淀",
        relatedRunLabel: expect.stringContaining("触发归档沉淀")
      })
    );
    expect(commandCenterPayload.data.releaseClosureResponsibility).toEqual(
      expect.objectContaining({
        summary: expect.stringContaining("发布链已完成最终放行，归档沉淀已写回正式工件面。"),
        detail: expect.stringContaining("当前归档沉淀接棒来源于"),
        sourceLabel: expect.stringContaining("触发归档沉淀"),
        nextAction: "沉淀交付知识卡与归档审计记录"
      })
    );
    const archiveExecution = commandCenterPayload.data.recentExecutions.find(
      (item: { commandId: string }) => item.commandId === "command-archive-capture"
    );
    expect(archiveExecution?.archiveProvenanceSummary).toBe(
      "归档审计记录 已由 触发归档沉淀 写回正式工件面。"
    );
    expect(archiveExecution?.archiveProvenanceDetail).toContain("当前归档沉淀接棒来源于");
    expect(archiveExecution?.archiveProvenanceDetail).toContain("整理交付说明");
    expect(archiveExecution?.releaseClosureSummary).toBe(
      "发布链已完成最终放行，归档沉淀已写回正式工件面。"
    );
    expect(archiveExecution?.releaseClosureDetail).toContain("当前归档沉淀接棒来源于");
    expect(archiveExecution?.releaseClosureNextAction).toBeNull();
    expect(commandCenterPayload.data.archiveProvenance?.handoffCommandId).toBe(
      "command-release-prepare"
    );
    },
    15000
  );

  it("retries a remediation task through the task retry route", async () => {
    prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    await postComponentAssembly(
      new Request("http://127.0.0.1:3000/api/forge/components/assemble", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          componentIds: ["component-payment-checkout"]
        })
      })
    );

    const response = await postTaskRetry(
      new Request("http://127.0.0.1:3000/api/forge/tasks/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: "task-retail-playwright"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.command.id).toBe("command-gate-run");
    expect(payload.data.execution.commandId).toBe("command-gate-run");
    expect(payload.data.retryRunnerCommand).toContain("--task-id task-retail-playwright");
    expect(payload.data.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    expect(payload.data.linkedComponentLabels).toEqual(
      expect.arrayContaining(["支付结算组件"])
    );
    expect(payload.data.linkedComponentIds).toEqual(
      expect.arrayContaining(["component-payment-checkout"])
    );
    expect(payload.data.pendingComponentLabels.length).toBeGreaterThan(0);
    expect(payload.data.componentAssemblyAction).toMatch(/已装配组件|待装配组件/);
    expect(payload.data.retryRunnerCommand).toContain("--component-ids component-payment-checkout");
    expect(payload.data.retryRunnerArgs).toEqual([
      "--task-id",
      "task-retail-playwright",
      "--project-id",
      "retail-support",
      "--taskpack-id",
      "artifact-taskpack-retail",
      "--component-ids",
      "component-payment-checkout"
    ]);
  });

  it("surfaces controller agent metadata for a NanoClaw release handoff through the execution backend prepare route", async () => {
    const { dbPath } = prepareWorkspace();
    overrideCanonicalTeamTemplateAgents(
      dbPath,
      "team-standard-delivery",
      [
        "agent-service-strategy",
        "agent-architect",
        "agent-design",
        "agent-engineer",
        "agent-qa",
        "agent-release",
        "agent-knowledge"
      ],
      "agent-service-strategy"
    );
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'nanoclaw exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'nanoclaw review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_QA_EXEC_COMMAND",
      'nanoclaw gate --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_QA_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_QA_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    vi.stubEnv(
      "FORGE_RELEASE_EXEC_COMMAND",
      'nanoclaw release --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_RELEASE_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_RELEASE_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv(
      "FORGE_RELEASE_EXEC_BACKEND_COMMAND",
      'nanoclaw run-release --project "{projectId}" --taskpack "{taskPackId}" --agent "{agentId}" --controller "{controllerAgentId}" --provider "{provider}"'
    );

    const created = createProjectForAI(
      {
        name: "NanoClaw 交付说明路由台",
        sector: "智能客服 / 发布",
        owner: "Iris",
        templateId: "template-smart-service",
        teamTemplateId: "team-standard-delivery"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "NanoClaw 交付说明路由台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-runner-gates`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "启动研发执行并接通默认门禁",
        ownerAgentId: "agent-engineer",
        status: "in-progress",
        priority: "P0",
        category: "execution",
        summary: "TaskPack 已下发，等待启动研发执行并产出 Patch 与 Demo。"
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: `task-${created.project.id}-runner-gates`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-execution`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-gate`
        })
      })
    );

    const response = await postExecutionBackendPrepare(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.retryCommandId).toBe("command-release-prepare");
    expect(payload.data.invocation).toEqual(
      expect.objectContaining({
        backendId: "release-execution-backend",
        backend: "NanoClaw",
        provider: "Nano CEO",
        commandType: "release.prepare",
        commandPreview:
          `nanoclaw run-release --project "${created.project.id}" --taskpack "${payload.data.taskPackId}" --agent "agent-release" --controller "agent-service-strategy" --provider "Nano CEO"`
      })
    );
    expect(payload.data.invocation.payload).toEqual(
      expect.objectContaining({
        projectId: created.project.id,
        commandType: "release.prepare",
        agent: expect.objectContaining({
          id: "agent-release",
          role: "release"
        }),
        controllerAgent: expect.objectContaining({
          id: "agent-service-strategy",
          role: "pm"
        })
      })
    );
  });

  it("returns delivery readiness and release gate summary through the readiness route", async () => {
    prepareWorkspace();

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project?.id).toBe("retail-support");
    expect(payload.data.readiness.statusLabel).toBeTruthy();
    expect(Array.isArray(payload.data.readiness.runtimeNotes)).toBe(true);
    expect(Array.isArray(payload.data.readiness.runtimeCapabilityDetails)).toBe(true);
    expect(
      payload.data.readiness.runtimeCapabilityDetails.some(
        (item: string) => item.includes("Version 1.55.0")
      )
    ).toBe(true);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.capabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(Array.isArray(payload.data.blockingTasks)).toBe(true);
    expect(Array.isArray(payload.data.remediationQueue)).toBe(true);
    expect(payload.data.blockingTasks[0]?.sourceCommandLabel).toBe("发起测试门禁");
    expect(payload.data.blockingTasks[0]?.missingArtifactLabels).toEqual(
      expect.arrayContaining(["测试报告", "Playwright 回归记录"])
    );
    expect(payload.data.blockingTasks[0]?.relatedRunId).toBe("run-2");
    expect(payload.data.blockingTasks[0]?.relatedRunLabel).toContain("回归客服退款流程");
    expect(payload.data.blockingTasks[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
    expect(payload.data.blockingTasks[0]?.remediationSummary).toContain("优先补齐");
    expect(payload.data.blockingTasks[0]?.remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
    expect(payload.data.blockingTasks[0]?.retryCommandLabel).toBe("发起测试门禁");
    expect(payload.data.blockingTasks[0]?.taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.blockingTasks[0]?.taskPackLabel).toBe("支付失败修复任务包");
    expect(payload.data.blockingTasks[0]?.linkedComponentLabels).toEqual(expect.any(Array));
    expect(payload.data.blockingTasks[0]?.linkedComponentIds).toEqual(expect.any(Array));
    expect(payload.data.blockingTasks[0]?.pendingComponentLabels).toEqual(
      expect.arrayContaining(["支付结算组件"])
    );
    expect(payload.data.blockingTasks[0]?.pendingComponentIds).toEqual(
      expect.arrayContaining(["component-payment-checkout"])
    );
    expect(payload.data.blockingTasks[0]?.componentAssemblyAction).toContain("待装配组件");
    expect(payload.data.blockingTasks[0]?.retryApiPath).toBe("/api/forge/tasks/retry");
    expect(payload.data.blockingTasks[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.blockingTasks[0]?.retryRunnerCommand).toContain("--project-id retail-support");
    expect(payload.data.blockingTasks[0]?.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    expect(payload.data.blockingTasks[0]?.unifiedRetryRunnerCommand).toContain(
      "--remediation-id task-retail-playwright"
    );
    expect(payload.data.blockingTasks[0]?.runtimeCapabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.remediationQueue[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
    expect(payload.data.remediationQueue[0]?.remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
    expect(payload.data.remediationQueue[0]?.pendingComponentLabels).toEqual(
      expect.arrayContaining(["支付结算组件"])
    );
    expect(payload.data.remediationQueue[0]?.pendingComponentIds).toEqual(
      expect.arrayContaining(["component-payment-checkout"])
    );
    expect(payload.data.remediationQueue[0]?.taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.remediationQueue[0]?.taskPackLabel).toBe("支付失败修复任务包");
    expect(payload.data.remediationQueue[0]?.retryApiPath).toBe("/api/forge/tasks/retry");
    expect(payload.data.remediationQueue[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.remediationQueue[0]?.retryRunnerCommand).toContain("--task-id task-retail-playwright");
    expect(payload.data.remediationQueue[0]?.retryRunnerCommand).toContain("--taskpack-id artifact-taskpack-retail");
    expect(payload.data.remediationQueue[0]?.unifiedRetryRunnerCommand).toContain(
      "--remediation-id task-retail-playwright"
    );
    expect(payload.data.remediationQueue[0]?.runtimeCapabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.currentHandoff).toEqual(
      expect.objectContaining({
        stage: expect.any(String),
        source: expect.any(String),
        nextAction: expect.any(String)
      })
    );
    expect(payload.data.formalArtifactGap).toEqual({
      missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
      missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
      summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
      ownerLabel: "测试开发工程师 · Monkey",
      ownerRoleLabel: "测试",
      nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
    });
    expect(payload.data.formalArtifactResponsibility).toEqual(
      expect.objectContaining({
        coverage: {
          count: 0,
          summary: "当前还没有沉淀正式工件。",
          detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
        },
        gap: {
          missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
          missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
          summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
          ownerLabel: "测试开发工程师 · Monkey",
          ownerRoleLabel: "测试",
          nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
        },
        approvalHandoff: expect.objectContaining({
          summary: "当前无需等待审批后接棒。",
          detail: "当前没有待人工确认事项。"
        }),
        pendingApprovals: expect.any(Array),
        provenance: expect.any(Array)
      })
    );
    expect(payload.data.approvalHandoff).toEqual(
      expect.objectContaining({
        summary: "当前无需等待审批后接棒。",
        detail: "当前没有待人工确认事项。"
      })
    );
    expect(Array.isArray(payload.data.pendingApprovals)).toBe(true);
    expect(Array.isArray(payload.data.escalationItems)).toBe(true);
    expect(payload.data.releaseGate.overallLabel).toBeTruthy();
    expect(payload.data.releaseGate.formalArtifactGap).toEqual({
      missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
      missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
      summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
      ownerLabel: "测试开发工程师 · Monkey",
      ownerRoleLabel: "测试",
      nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
    });
    expect(payload.data.releaseGate.approvalHandoff).toEqual(
      expect.objectContaining({
        summary: "当前无需等待审批后接棒。",
        detail: "当前没有待人工确认事项。"
      })
    );
    expect(Array.isArray(payload.data.releaseGate.approvalTrace)).toBe(true);
    expect(
      payload.data.releaseGate.approvalTrace.some(
        (item: { ownerLabel?: string }) => Boolean(item.ownerLabel)
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.approvalTrace.some(
        (item: { slaLabel?: string }) => Boolean(item.slaLabel)
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.approvalTrace.some(
        (item: { breachLabel?: string }) => Boolean(item.breachLabel)
      )
    ).toBe(true);
    expect(Array.isArray(payload.data.releaseGate.escalationActions)).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { ownerLabel?: string }) => Boolean(item.ownerLabel)
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { blocking?: boolean }) => item.blocking === true
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { runtimeEvidenceLabel?: string }) =>
          item.runtimeEvidenceLabel?.includes("Version 1.55.0")
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { taskId?: string }) => Boolean(item.taskId)
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { label?: string; ownerLabel?: string; ownerRoleLabel?: string; nextAction?: string }) =>
          item.label === "交付说明 · 缺失" &&
          item.ownerLabel === "测试开发工程师 · Monkey" &&
          item.ownerRoleLabel === "测试" &&
          item.nextAction === "先处理 Playwright 失败项，再推进交付或归档。"
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { retryApiPath?: string }) => item.retryApiPath === "/api/forge/escalations/retry"
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { unifiedRetryApiPath?: string }) =>
          item.unifiedRetryApiPath === "/api/forge/remediations/retry"
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: { unifiedRetryRunnerCommand?: string }) =>
          item.unifiedRetryRunnerCommand?.includes("--remediation-id task-retail-playwright")
      )
    ).toBe(true);
    expect(Array.isArray(payload.data.evidenceTimeline)).toBe(true);
  });

  it("returns external execution contract readiness through the readiness route", async () => {
    prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.runtimeSummary.externalExecutionSummary).toContain(
      "已配置 2 条外部模型执行契约"
    );
    expect(payload.data.runtimeSummary.externalExecutionStatus).toBe("provider-active");
    expect(payload.data.runtimeSummary.externalExecutionContractCount).toBe(2);
    expect(payload.data.runtimeSummary.externalExecutionActiveProviderCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary.externalExecutionRecommendation).toContain(
      "后续执行、整改和回放优先沿现有外部执行链推进"
    );
    expect(payload.data.runtimeSummary.externalExecutionDetails).toEqual(
      expect.arrayContaining([
        "研发执行：Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
        "规则审查：Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      ])
    );
    expect(payload.data.runtimeSummary.executionBackendSummary).toContain("OpenClaw");
    expect(payload.data.runtimeSummary.executionBackendDetails).toEqual(
      expect.arrayContaining([
        "研发执行：OpenClaw · 承载 Claude Code · 来源 env:FORGE_ENGINEER_EXEC_COMMAND",
        "规则审查：OpenClaw · 承载 Claude Code Review · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
      ])
    );
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "engineer-execution-backend",
          runnerProfile: "engineer-runner",
          supportedCommandTypes: ["execution.start"],
          expectedArtifacts: ["patch", "demo-build"]
        })
      ])
    );
  });

  it("returns NanoClaw CEO manager readiness through the readiness route", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.runtimeSummary.nanoManagerStatus).toBe("ready");
    expect(payload.data.runtimeSummary.nanoManagerSummary).toContain("NanoClaw CEO 总控已就绪");
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pm-execution-backend",
          backend: "NanoClaw",
          probeStatus: "ready"
        })
      ])
    );
  });

  it("returns NanoClaw CEO manager degradation through the readiness route when healthcheck fails", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
    vi.stubEnv("FORGE_NANO_HEALTHCHECK_COMMAND", 'node -e "process.exit(7)"');

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.runtimeSummary.nanoManagerStatus).toBe("degraded");
    expect(payload.data.runtimeSummary.nanoManagerSummary).toContain("健康检查失败");
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pm-execution-backend",
          backend: "NanoClaw",
          probeStatus: "degraded"
        })
      ])
    );
  });

  it("returns the standardized NanoClaw handshake details through the readiness route", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
    vi.stubEnv(
      "FORGE_NANO_HEALTHCHECK_COMMAND",
      'node -e "process.stdout.write(JSON.stringify({status:\'ready\',summary:\'Nano 在线握手成功\',details:[\'CEO manager ready\'],version:\'nano-1.0.0\'}))"'
    );

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();
    const pmBackend = payload.data.executionBackends.find((item: { kind: string }) => item.kind === "pm");

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(pmBackend).toEqual(
      expect.objectContaining({
        backend: "NanoClaw",
        probeStatus: "ready",
        probeSummary: expect.stringContaining("Nano 在线握手成功"),
        probeDetails: expect.arrayContaining([expect.stringContaining("CEO manager ready")]),
        probeVersion: "nano-1.0.0"
      })
    );
  });

  it("returns bridge execution evidence through the readiness route", { timeout: 10000 }, async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell",
          runId: "run-bridge-route-summary"
        })
      })
    );

    const response = await getReadiness(
      new Request("http://127.0.0.1:3000/api/forge/readiness?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.runtimeSummary.bridgeExecutionCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary.bridgeExecutionSummary).toContain("已写回 1 条外部执行桥证据");
    expect(payload.data.runtimeSummary.bridgeExecutionDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("OpenClaw Bridge")])
    );
    expect(payload.data.readiness.bridgeHandoffStatus).toBe("qa-handoff");
    expect(payload.data.readiness.bridgeHandoffSummary).toContain("已移交 QA 门禁");
    expect(payload.data.releaseGate.bridgeHandoffStatus).toBe("qa-handoff");
    expect(payload.data.releaseGate.bridgeHandoffSummary).toContain("已移交 QA 门禁");
    expect(payload.data.releaseGate.bridgeReviewCommandId).toBe("command-review-run");
    expect(payload.data.releaseGate.bridgeReviewRunId).toBe("run-bridge-route-summary");
    expect(payload.data.releaseGate.bridgeReviewRunLabel).toContain("规则审查");
    expect(
      payload.data.releaseGate.approvalTrace.some(
        (item: { sourceCommandId?: string; relatedRunId?: string }) =>
          item.sourceCommandId === "command-review-run" &&
          item.relatedRunId === "run-bridge-route-summary"
      )
    ).toBe(true);
    expect(
      payload.data.releaseGate.escalationActions.some(
        (item: {
          bridgeHandoffStatus?: string;
          bridgeHandoffSummary?: string;
          relatedRunId?: string;
          nextAction?: string;
        }) =>
          item.bridgeHandoffStatus === "qa-handoff" &&
          item.bridgeHandoffSummary?.includes("已移交 QA 门禁") &&
          item.relatedRunId === "run-bridge-route-summary" &&
          item.nextAction?.includes("先由测试开发工程师 · Monkey 补齐")
      )
    ).toBe(true);
    expect(
      payload.data.escalationItems.some(
        (item: { sourceCommandId?: string; relatedRunId?: string }) =>
          item.sourceCommandId === "command-review-run" &&
          item.relatedRunId === "run-bridge-route-summary"
      )
    ).toBe(true);
  });

  it("returns command center with control-plane aggregation", async () => {
    prepareWorkspace();

    const response = await getCommandCenter();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.externalExecutionStatus).toBeTruthy();
    expect(payload.data.runtimeSummary?.externalExecutionRecommendation).toBeTruthy();
    expect(payload.data.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.recentExecutions).toEqual(expect.any(Array));
    expect(payload.data.controlPlane?.remediationQueue).toEqual(expect.any(Array));
    expect(payload.data.currentHandoff).toEqual(
      expect.objectContaining({
        stage: expect.any(String),
        source: expect.any(String),
        nextAction: expect.any(String)
      })
    );
    expect(Array.isArray(payload.data.pendingApprovals)).toBe(true);
    expect(Array.isArray(payload.data.escalationItems)).toBe(true);
  });

  it("returns remediations with control-plane aggregation", async () => {
    prepareWorkspace();

    const response = await getRemediations(
      new Request("http://127.0.0.1:3000/api/forge/remediations?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.externalExecutionStatus).toBeTruthy();
    expect(payload.data.runtimeSummary?.externalExecutionRecommendation).toBeTruthy();
    expect(payload.data.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.blockingTasks).toEqual(expect.any(Array));
    expect(payload.data.controlPlane?.releaseGate?.overallLabel).toBeTruthy();
    expect(payload.data.currentHandoff).toEqual(
      expect.objectContaining({
        stage: expect.any(String),
        source: expect.any(String),
        nextAction: expect.any(String)
      })
    );
    expect(Array.isArray(payload.data.pendingApprovals)).toBe(true);
    expect(Array.isArray(payload.data.escalationItems)).toBe(true);
  });

  it("returns runners with control-plane aggregation", async () => {
    prepareWorkspace();

    const response = await getRunners();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.controlPlane?.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.componentRegistry?.recommendedCount).toBeGreaterThan(0);
    expect(payload.data.controlPlane?.evidenceTimeline).toEqual(expect.any(Array));
  });

  it("returns unified remediation entries through the remediations route", async () => {
    prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    const response = await getRemediations(
      new Request("http://127.0.0.1:3000/api/forge/remediations?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project?.id).toBe("retail-support");
    expect(payload.data.total).toBeGreaterThan(0);
    expect(payload.data.items.some((item: { kind: string }) => item.kind === "task")).toBe(true);
    expect(payload.data.items.some((item: { kind: string }) => item.kind === "escalation")).toBe(true);
    expect(
      payload.data.items.some(
        (item: { retryApiPath?: string }) => item.retryApiPath === "/api/forge/tasks/retry"
      )
    ).toBe(true);
    expect(
      payload.data.items.some(
        (item: { retryApiPath?: string }) => item.retryApiPath === "/api/forge/escalations/retry"
      )
    ).toBe(true);
    expect(
      payload.data.items.some(
        (item: { unifiedRetryApiPath?: string }) =>
          item.unifiedRetryApiPath === "/api/forge/remediations/retry"
      )
    ).toBe(true);
    expect(
      payload.data.items.some(
        (item: { runtimeCapabilityDetails?: string[] }) =>
          item.runtimeCapabilityDetails?.some((detail) => detail.includes("Version 1.55.0"))
      )
    ).toBe(true);
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reviewer-execution-backend",
          runnerProfile: "reviewer-runner",
          supportedCommandTypes: ["review.run"],
          expectedArtifacts: ["review-report"]
        })
      ])
    );
  });

  it(
    "returns bridge handoff context through the remediations route",
    async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');
    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation",
          strategy: "local-shell",
          runId: "run-bridge-remediations-summary"
        })
      })
    );

    const response = await getRemediations(
      new Request("http://127.0.0.1:3000/api/forge/remediations?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(
      payload.data.items.some(
        (item: {
          kind: string;
          bridgeHandoffStatus?: string;
          bridgeHandoffSummary?: string;
        }) =>
          item.kind === "task" &&
          item.bridgeHandoffStatus === "qa-handoff" &&
          item.bridgeHandoffSummary?.includes("已移交 QA 门禁")
      )
    ).toBe(true);
    expect(
      payload.data.items.some(
        (item: {
          kind: string;
          bridgeHandoffStatus?: string;
          nextAction?: string;
        }) =>
          item.kind === "escalation" &&
          item.bridgeHandoffStatus === "qa-handoff" &&
          item.nextAction?.includes("先由测试开发工程师 · Monkey 补齐")
      )
    ).toBe(true);
    },
    10000
  );

  it("returns model execution provider context through the remediations route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-dev",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    upsertRunForAI(
      {
        id: "run-retail-review-provider",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        linkedComponentIds: ["component-auth-email"],
        title: "执行退款失败补丁规则审查",
        executor: "Reviewer",
        cost: "$0.28",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [
          {
            name: "model-execution",
            status: "pass",
            summary:
              "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
          },
          { name: "evidence", status: "tool-ready", summary: "已检测到外部审查执行器" }
        ]
      },
      dbPath
    );

    const response = await getRemediations(
      new Request("http://127.0.0.1:3000/api/forge/remediations?projectId=retail-support")
    );
    const payload = await response.json();
    const remediation = payload.data.items.find(
      (item: { id: string }) => item.id === "task-retail-review-remediation"
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(remediation?.runtimeModelProviderLabel).toBe("Claude Code Review");
    expect(remediation?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(remediation?.runtimeModelExecutionDetail).toBe(
      "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
    );
    expect(remediation?.nextAction).toContain("模型执行器：Claude Code Review");
    expect(remediation?.nextAction).toContain("执行后端：OpenClaw");
    expect(remediation?.runtimeExecutionBackendInvocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Review",
        commandType: "review.run",
        taskPackId: "artifact-taskpack-retail",
        artifactType: "patch",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
    expect(remediation?.runtimeExecutionBackendCommandPreview).toBe(
      'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
    );
  });

  it("retries a unified remediation entry through the remediations retry route", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    await postComponentAssembly(
      new Request("http://127.0.0.1:3000/api/forge/components/assemble", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          componentIds: ["component-payment-checkout"]
        })
      })
    );

    const response = await postRemediationRetry(
      new Request("http://127.0.0.1:3000/api/forge/remediations/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-playwright"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.command.id).toBe("command-gate-run");
    expect(payload.data.execution.commandId).toBe("command-gate-run");
    expect(payload.data.retryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.linkedComponentLabels).toEqual(
      expect.arrayContaining(["支付结算组件"])
    );
    expect(payload.data.linkedComponentIds).toEqual(
      expect.arrayContaining(["component-payment-checkout"])
    );
    expect(payload.data.pendingComponentLabels.length).toBeGreaterThan(0);
    expect(payload.data.componentAssemblyAction).toMatch(/已装配组件|待装配组件/);
    expect(payload.data.retryRunnerCommand).toContain("--component-ids component-payment-checkout");
    expect(payload.data.retryRunnerCommand).toContain("--remediation-id task-retail-playwright");

    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-dev",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    upsertRunForAI(
      {
        id: "run-retail-review-provider",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        linkedComponentIds: ["component-auth-email"],
        title: "执行退款失败补丁规则审查",
        executor: "Reviewer",
        cost: "$0.28",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [
          {
            name: "model-execution",
            status: "pass",
            summary:
              "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
          },
          { name: "evidence", status: "tool-ready", summary: "已检测到外部审查执行器" }
        ]
      },
      dbPath
    );

    const reviewRetryResponse = await postRemediationRetry(
      new Request("http://127.0.0.1:3000/api/forge/remediations/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: "task-retail-review-remediation"
        })
      })
    );
    const reviewRetryPayload = await reviewRetryResponse.json();

    expect(reviewRetryResponse.status).toBe(200);
    expect(reviewRetryPayload.ok).toBe(true);
    expect(reviewRetryPayload.data.runtimeExecutionBackendInvocation).toEqual(
      expect.objectContaining({
        backendId: "reviewer-execution-backend",
        backend: "OpenClaw",
        provider: "Claude Code Review",
        commandType: "review.run",
        artifactType: "patch",
        commandPreview:
          'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
      })
    );
    expect(reviewRetryPayload.data.runtimeExecutionBackendCommandPreview).toBe(
      'openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"'
    );
  });

  it("retries a release escalation through the escalation retry route", async () => {
    prepareWorkspace();

    const response = await postEscalationRetry(
      new Request("http://127.0.0.1:3000/api/forge/escalations/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          taskId: "task-retail-playwright"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.command.id).toBe("command-gate-run");
    expect(payload.data.execution.commandId).toBe("command-gate-run");
    expect(payload.data.retryApiPath).toBe("/api/forge/escalations/retry");
    expect(payload.data.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.retryRunnerCommand).toContain("--task-id task-retail-playwright");
    expect(payload.data.unifiedRetryRunnerCommand).toContain("--remediation-id task-retail-playwright");
  });

  it("returns the team registry through the team-registry route", async () => {
    prepareWorkspace();

    const response = await getTeamRegistry();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.totalAgents).toBe(19);
    expect(payload.data.totalSops).toBeGreaterThan(0);
  });

  it("returns the capability registry through the capabilities route", async () => {
    prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
      'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"'
    );
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
      'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"'
    );

    const response = await getCapabilities();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.totalPrompts).toBe(3);
    expect(payload.data.totalComponents).toBeGreaterThan(0);
    expect(payload.data.totalSkills).toBeGreaterThan(0);
    expect(payload.data.executionBackendCount).toBe(2);
    expect(payload.data.activeExecutionBackendCount).toBeGreaterThanOrEqual(1);
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "engineer-execution-backend",
          kind: "engineer",
          label: "研发执行",
          backend: "OpenClaw",
          provider: "Claude Code",
          source: "FORGE_ENGINEER_EXEC_COMMAND",
          commandKey: "FORGE_ENGINEER_EXEC_BACKEND_COMMAND",
          runnerProfile: "engineer-runner",
          backendCommandTemplate:
            'openclaw run --project "{projectId}" --taskpack "{taskPackId}" --provider "{provider}"',
          backendCommandPlaceholders: ["projectId", "taskPackId", "provider"],
          supportedCommandTypes: ["execution.start"],
          expectedArtifacts: ["patch", "demo-build"]
        }),
        expect.objectContaining({
          id: "reviewer-execution-backend",
          kind: "reviewer",
          label: "规则审查",
          backend: "OpenClaw",
          provider: "Claude Code Review",
          source: "FORGE_REVIEW_EXEC_COMMAND",
          commandKey: "FORGE_REVIEW_EXEC_BACKEND_COMMAND",
          runnerProfile: "reviewer-runner",
          backendCommandTemplate:
            'openclaw run-review --project "{projectId}" --taskpack "{taskPackId}" --artifact "{artifactType}" --provider "{provider}"',
          backendCommandPlaceholders: ["projectId", "taskPackId", "artifactType", "provider"],
          supportedCommandTypes: ["review.run"],
          expectedArtifacts: ["review-report"]
        })
      ])
    );
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandConfigured: true,
          commandSource: expect.stringMatching(/FORGE_.*_EXEC_BACKEND_COMMAND/)
        })
      ])
    );
    expect(payload.data.components[0]?.title).toBeTruthy();
  });

  it("returns unified asset recommendations through the recommend route", async () => {
    prepareWorkspace();

    const response = await getAssetRecommendations(
      new Request(
        "http://127.0.0.1:3000/api/forge/assets/recommend?projectId=retail-support&taskPackId=artifact-taskpack-retail&stage=%E6%B5%8B%E8%AF%95%E9%AA%8C%E8%AF%81&query=%E6%94%AF%E4%BB%98"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project.id).toBe("retail-support");
    expect(payload.data.stage).toBe("测试验证");
    expect(payload.data.taskPack.id).toBe("artifact-taskpack-retail");
    expect(payload.data.managementGroups).toEqual(
      expect.arrayContaining(["启动资产", "执行资产", "规则资产", "证据资产"])
    );
    expect(payload.data.requiredItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "project-template",
          priority: "required"
        })
      ])
    );
    expect(payload.data.recommendedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "支付结算组件",
          sourceKind: "component"
        })
      ])
    );
    expect(payload.data.referenceItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "artifact",
          priority: "reference"
        })
      ])
    );
  });

  it("returns the component registry through the components route", async () => {
    prepareWorkspace();

    const response = await getComponents(
      new Request(
        "http://127.0.0.1:3000/api/forge/components?projectId=retail-support&taskPackId=artifact-taskpack-retail&sourceType=github"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBeGreaterThan(0);
    expect(payload.data.project.id).toBe("retail-support");
    expect(payload.data.taskPack.id).toBe("artifact-taskpack-retail");
    expect(payload.data.recommendedCount).toBeGreaterThan(0);
    expect(payload.data.assemblySuggestions[0]?.componentId).toBe("component-payment-checkout");
    expect(payload.data.usageSignals[0]?.componentId).toBe("component-payment-checkout");
    expect(payload.data.usageSignals[0]?.blockedCount).toBeGreaterThanOrEqual(0);
    expect(payload.data.categories).toEqual(
      expect.arrayContaining(["auth", "payment", "file", "communication"])
    );
    expect(payload.data.items.every((item: { sourceType: string }) => item.sourceType === "github")).toBe(true);
  });

  it("returns the component assembly plan through the assemble route", async () => {
    prepareWorkspace();

    const response = await getComponentAssembly(
      new Request(
        "http://127.0.0.1:3000/api/forge/components/assemble?projectId=retail-support&taskPackId=artifact-taskpack-retail&maxItems=2"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.project.id).toBe("retail-support");
    expect(payload.data.taskPack.id).toBe("artifact-taskpack-retail");
    expect(payload.data.totalSuggested).toBeGreaterThan(0);
    expect(payload.data.selectedCount).toBe(2);
    expect(payload.data.pendingCount).toBe(2);
    expect(payload.data.linkedCount).toBe(0);
    expect(payload.data.items[0]?.componentId).toBe("component-payment-checkout");
    expect(payload.data.items[0]?.usageGuide).toContain("支付");
    expect(payload.data.pendingItems[0]?.componentId).toBe("component-payment-checkout");
    expect(payload.data.nextAction).toContain("TaskPack");
  });

  it("returns external component candidates through the search route", async () => {
    prepareWorkspace();
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 501,
              full_name: "acme/next-chat-console",
              name: "next-chat-console",
              description: "Chat support panel for Next.js projects.",
              html_url: "https://github.com/acme/next-chat-console",
              language: "TypeScript",
              stargazers_count: 820,
              pushed_at: "2026-02-24T08:00:00Z",
              topics: ["chat", "support", "nextjs"]
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    ) as unknown as typeof fetch;

    const response = await getComponentSearch(
      new Request(
        "http://127.0.0.1:3000/api/forge/components/search?projectId=retail-support&taskPackId=artifact-taskpack-retail&category=communication&language=TypeScript"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("ready");
    expect(payload.data.project.id).toBe("retail-support");
    expect(payload.data.taskPack.id).toBe("artifact-taskpack-retail");
    expect(payload.data.total).toBe(1);
    expect(payload.data.items[0]?.sourceType).toBe("github-candidate");
    expect(payload.data.items[0]?.repoFullName).toBe("acme/next-chat-console");
  });

  it("applies component assembly links through the assemble route", async () => {
    prepareWorkspace();

    const response = await postComponentAssembly(
      new Request("http://127.0.0.1:3000/api/forge/components/assemble", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          componentIds: ["component-payment-checkout", "component-auth-email"],
          triggeredBy: "资产页"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.linkedCount).toBe(2);
    expect(payload.data.items[0]?.component.id).toBe("component-payment-checkout");
    expect(payload.data.nextAction).toContain("Engineer Runner");
    expect(payload.data.execution.commandId).toBe("command-component-assemble");
    expect(payload.data.execution.taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.execution.followUpTaskIds).toContain("task-retail-support-component-assembly");
    expect(payload.data.execution.summary).toContain("待装配组件");
    expect(payload.data.execution.summary).toContain("组件装配清单");
    expect(payload.data.artifact.type).toBe("assembly-plan");
    expect(payload.data.assemblyManifest.installCommands).toEqual(
      expect.arrayContaining([
        "pnpm add @forge-components/payment-checkout",
        "pnpm --filter app add @forge-modules/auth-email-login"
      ])
    );
    expect(payload.data.assemblyManifest.requiredEnv).toEqual(
      expect.arrayContaining([
        "PAYMENT_CALLBACK_BASE_URL",
        "PAYMENT_PROVIDER_KEY",
        "AUTH_API_BASE_URL",
        "AUTH_SESSION_SECRET"
      ])
    );
  });

  it("returns command center and hook policy baseline through the commands route", async () => {
    prepareWorkspace();
    vi.stubEnv(
      "FORGE_ENGINEER_EXEC_COMMAND",
      'claude exec --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_ENGINEER_EXEC_PROVIDER", "Claude Code");
    vi.stubEnv("FORGE_ENGINEER_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");

    const response = await getCommandCenter();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.totalCommands).toBeGreaterThan(0);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.capabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.commands.some((command: { name: string }) => command.name === "生成 PRD")).toBe(true);
    expect(payload.data.hooks.some((hook: { name: string }) => hook.name === "beforeRun")).toBe(true);
    expect(payload.data.executionBackends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reviewer-execution-backend",
          runnerProfile: "reviewer-runner",
          supportedCommandTypes: ["review.run"],
          expectedArtifacts: ["review-report"]
        })
      ])
    );
    expect(payload.data.totalExecutions).toBeGreaterThan(0);
    expect(payload.data.recentExecutions[0]?.commandId).toBeTruthy();
    expect(payload.data.recentExecutions[0]?.relatedRunId).toBe("run-2");
    expect(payload.data.recentExecutions[0]?.runtimeEvidenceSummary).toContain("Version 1.55.0");
    expect(payload.data.recentExecutions[0]?.taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.recentExecutions[0]?.taskPackLabel).toBe("支付失败修复任务包");
    expect(payload.data.recentExecutions[0]?.pendingComponentLabels).toContain("支付结算组件");
    expect(payload.data.recentExecutions[0]?.componentAssemblyAction).toContain("待装配组件");
    expect(Array.isArray(payload.data.recentExecutions[0]?.followUpTasks)).toBe(true);
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.evidenceAction).toContain("证据缺口");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.relatedRunId).toBe("run-2");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.remediationSummary).toContain("优先补齐");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.remediationAction).toContain("由 测试开发工程师 · Monkey 补齐");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.retryCommandId).toBe("command-gate-run");
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.retryApiPath).toBe(
      "/api/forge/tasks/retry"
    );
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.unifiedRetryApiPath).toBe(
      "/api/forge/remediations/retry"
    );
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.runtimeCapabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.retryRunnerCommand).toContain(
      "--task-id task-retail-playwright"
    );
    expect(payload.data.recentExecutions[0]?.followUpTasks?.[0]?.unifiedRetryRunnerCommand).toContain(
      "--remediation-id task-retail-playwright"
    );
    expect(payload.data.formalArtifactCoverage).toEqual({
      count: 0,
      summary: "当前还没有沉淀正式工件。",
      detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
    });
    expect(payload.data.formalArtifactGap).toEqual({
      missingArtifactTypes: ["release-brief", "review-decision", "release-audit", "knowledge-card"],
      missingArtifactLabels: ["交付说明", "放行评审结论", "归档审计记录", "知识卡"],
      summary: "当前仍缺少 交付说明 / 放行评审结论 / 归档审计记录 / 知识卡。",
      ownerLabel: "测试开发工程师 · Monkey",
      ownerRoleLabel: "测试",
      nextAction: "先处理 Playwright 失败项，再推进交付或归档。"
    });
    expect(payload.data.recentDecisions[0]?.hookId).toBeTruthy();
    expect(Array.isArray(payload.data.remediationQueue)).toBe(true);
    expect(payload.data.remediationQueue[0]?.remediationOwnerLabel).toBe("测试开发工程师 · Monkey");
    expect(payload.data.remediationQueue[0]?.unifiedRetryApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.remediationQueue[0]?.unifiedRetryRunnerCommand).toContain(
      "--remediation-id task-retail-playwright"
    );
    expect(payload.data.remediationQueue[0]?.retryRunnerCommand).toContain("--project-id retail-support");
  });

  it("returns model execution provider context through the commands route", async () => {
    const { dbPath } = prepareWorkspace();

    upsertProjectTask(
      {
        id: "task-retail-review-remediation",
        projectId: "retail-support",
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-dev",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: "command-execution-review-run",
        commandId: "command-review-run",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: ["task-retail-review-remediation"]
      },
      dbPath
    );
    upsertRunForAI(
      {
        id: "run-retail-review-provider",
        projectId: "retail-support",
        taskPackId: "artifact-taskpack-retail",
        linkedComponentIds: ["component-auth-email"],
        title: "执行退款失败补丁规则审查",
        executor: "Reviewer",
        cost: "$0.28",
        state: "done",
        outputMode: "review-ready",
        outputChecks: [
          {
            name: "model-execution",
            status: "pass",
            summary:
              "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
          },
          { name: "evidence", status: "tool-ready", summary: "已检测到外部审查执行器" }
        ]
      },
      dbPath
    );

    const response = await getCommandCenter();
    const payload = await response.json();
    const reviewExecution = payload.data.recentExecutions.find(
      (item: { commandId: string }) => item.commandId === "command-review-run"
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(reviewExecution?.runtimeModelProviderLabel).toBe("Claude Code Review");
    expect(reviewExecution?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(reviewExecution?.runtimeModelExecutionDetail).toBe(
      "Claude Code Review · claude 2.1.34 · 后端 OpenClaw · 来源 env:FORGE_REVIEW_EXEC_COMMAND"
    );
    expect(reviewExecution?.followUpTasks?.[0]?.runtimeModelProviderLabel).toBe(
      "Claude Code Review"
    );
    expect(reviewExecution?.followUpTasks?.[0]?.runtimeExecutionBackendLabel).toBe("OpenClaw");
    expect(reviewExecution?.followUpTasks?.[0]?.remediationAction).toContain(
      "模型执行器：Claude Code Review"
    );
  });

  it("records a command execution and policy decisions through the commands route", async () => {
    prepareWorkspace();

    const commandResponse = await getCommandCenter();
    const initialPayload = await commandResponse.json();
    const initialCount = initialPayload.data.totalExecutions;

    const postResponse = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "command-execution-release-blocked",
          commandId: "command-gate-run",
          projectId: "retail-support",
          status: "blocked",
          summary: "测试开发工程师 · Monkey 发起门禁时被发布策略阻止。",
          triggeredBy: "测试开发工程师 · Monkey",
          decisions: [
            {
              id: "policy-decision-release-blocked",
              hookId: "hook-before-release",
              outcome: "block",
              summary: "Playwright 门禁失败，禁止推进发布。"
            }
          ]
        })
      })
    );
    const postPayload = await postResponse.json();

    expect(postResponse.status).toBe(200);
    expect(postPayload.ok).toBe(true);
    expect(postPayload.data.execution.id).toBe("command-execution-release-blocked");
    expect(postPayload.data.decisions[0].outcome).toBe("block");

    const updatedResponse = await getCommandCenter();
    const updatedPayload = await updatedResponse.json();

    expect(updatedPayload.data.totalExecutions).toBe(initialCount + 1);
  });

  it("executes a command through the commands route", async () => {
    prepareWorkspace();

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-prd-generate",
          projectId: "retail-support"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.execution.status).toBe("done");
    expect(payload.data.document.title).toContain("PRD 草案");
  });

  it("executes component assembly through the commands route", async () => {
    prepareWorkspace();

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-component-assemble",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          componentIds: ["component-payment-checkout"]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.execution.status).toBe("done");
    expect(payload.data.execution.commandId).toBe("command-component-assemble");
    expect(payload.data.execution.taskPackId).toBe("artifact-taskpack-retail");
    expect(payload.data.linkedCount).toBe(1);
  });

  it("returns follow-up tasks when a blocked command is executed through the commands route", async () => {
    prepareWorkspace();

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-release-approve",
          projectId: "retail-support"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.execution.status).toBe("blocked");
    expect(payload.data.execution.followUpTaskIds).toContain(
      "task-retail-support-release-escalation"
    );
  });

  it("returns bridge handoff guidance when release approval is attempted before qa finishes", async () => {
    const { dbPath } = prepareWorkspace();
    vi.stubEnv(
      "FORGE_REVIEW_EXEC_COMMAND",
      'claude review --project "{projectId}" --taskpack "{taskPackId}"'
    );
    vi.stubEnv("FORGE_REVIEW_EXEC_PROVIDER", "Claude Code Review");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND", "OpenClaw");
    vi.stubEnv("FORGE_REVIEW_EXEC_BACKEND_COMMAND", '/bin/sh -lc "printf bridge-ok"');

    const created = createProjectForAI(
      {
        name: "桥接放行等待台",
        sector: "智能客服 / 审查",
        owner: "Iris",
        templateId: "template-smart-service"
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId: created.project.id,
        type: "task-pack",
        title: "桥接放行等待台 首轮 TaskPack",
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );
    upsertProjectComponentLink(
      {
        projectId: created.project.id,
        componentId: "component-auth-email",
        reason: "研发执行前先装入账号组件。",
        usageGuide: "先接邮箱登录，再补异常兜底。"
      },
      dbPath
    );

    executeCommandForAI(
      {
        commandId: "command-execution-start",
        projectId: created.project.id
      },
      dbPath
    );

    upsertProjectTask(
      {
        id: `task-${created.project.id}-review-remediation`,
        projectId: created.project.id,
        stage: "开发执行",
        title: "复跑规则审查并确认补丁口径",
        ownerAgentId: "agent-engineer",
        status: "todo",
        priority: "P2",
        category: "review",
        summary: "根据最新补丁重新发起规则审查，确认异常态和回滚口径。"
      },
      dbPath
    );
    recordCommandExecutionForAI(
      {
        id: `command-execution-${created.project.id}-review-run`,
        commandId: "command-review-run",
        projectId: created.project.id,
        taskPackId: `artifact-${created.project.id}-task-pack`,
        status: "blocked",
        summary: "规则审查要求补齐异常态说明后再移交 QA。",
        triggeredBy: "Reviewer Agent",
        followUpTaskIds: [`task-${created.project.id}-review-remediation`]
      },
      dbPath
    );

    await postExecutionBackendBridgeWriteback(
      new Request("http://127.0.0.1:3000/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          remediationId: `task-${created.project.id}-review-remediation`,
          strategy: "local-shell",
          runId: `run-bridge-${created.project.id}-review`
        })
      })
    );

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-release-approve",
          projectId: created.project.id
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.execution.status).toBe("blocked");
    expect(payload.data.execution.summary).toContain("已移交 QA 门禁");
    expect(payload.data.execution.followUpTaskIds).toContain(
      `task-${created.project.id}-release-escalation`
    );
  }, 10000);

  it("auto-generates a blocking policy decision through the commands route when artifacts are missing", async () => {
    prepareWorkspace();

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "command-execution-auto-blocked",
          commandId: "command-execution-start",
          projectId: "clinic-rag",
          status: "blocked",
          summary: "尝试启动研发执行。",
          triggeredBy: "后端研发 Agent"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.decisions[0].hookId).toBe("hook-before-run");
    expect(payload.data.decisions[0].outcome).toBe("block");
  });

  it("returns a kimi model reply through the commands route when a configured local model is selected", async () => {
    const { dbPath } = prepareWorkspace();
    updateModelProviderSettings(
      {
        providerId: "kimi",
        enabled: true,
        apiKey: "sk-kimi-local-123456",
        modelPriority: ["kimi-k2.5"]
      },
      dbPath
    );
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Kimi 已根据退款失败链路给出测试补充建议。"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-prd-generate",
          projectId: "retail-support",
          extraNotes: "补充退款失败的回归口径",
          selectedModel: "kimi-k2.5",
          thinkingBudget: "高",
          triggeredBy: "项目工作台"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.modelExecution).toEqual(
      expect.objectContaining({
        providerId: "kimi",
        providerLabel: "Moonshot Kimi",
        model: "kimi-k2.5",
        status: "success"
      })
    );
    expect(payload.data.modelExecution.content).toContain("Kimi 已根据退款失败链路给出测试补充建议");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-kimi-local-123456"
        })
      })
    );
  });

  it("returns an openai model reply through the commands route when a configured local model is selected", async () => {
    const { dbPath } = prepareWorkspace();
    updateModelProviderSettings(
      {
        providerId: "openai",
        enabled: true,
        apiKey: "sk-openai-local-123456",
        modelPriority: ["gpt-5.4"]
      },
      dbPath
    );
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "OpenAI 已根据需求梳理出首版 PRD 结构和风险清单。"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-prd-generate",
          projectId: "retail-support",
          extraNotes: "整理退款失败主链路",
          selectedModel: "gpt-5.4",
          thinkingBudget: "高",
          triggeredBy: "项目工作台"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.modelExecution).toEqual(
      expect.objectContaining({
        providerId: "openai",
        providerLabel: "OpenAI",
        model: "gpt-5.4",
        status: "success"
      })
    );
    expect(payload.data.modelExecution.content).toContain("OpenAI 已根据需求梳理出首版 PRD 结构");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-openai-local-123456"
        })
      })
    );
  });

  it("returns a kimi coding reply through the commands route when a configured local model is selected", async () => {
    const { dbPath } = prepareWorkspace();
    updateModelProviderSettings(
      {
        providerId: "kimi-coding",
        enabled: true,
        apiKey: "sk-kimi-coding-local-123456",
        modelPriority: ["k2p5"]
      },
      dbPath
    );
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_kimi_coding",
          content: [
            {
              type: "text",
              text: "Kimi Coding 已给出一版代码修复和回归建议。"
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: "execute",
          commandId: "command-prd-generate",
          projectId: "retail-support",
          extraNotes: "整理退款失败回归口径",
          selectedModel: "k2p5",
          thinkingBudget: "高",
          triggeredBy: "项目工作台"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.modelExecution).toEqual(
      expect.objectContaining({
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success"
      })
    );
    expect(payload.data.modelExecution.content).toContain("Kimi Coding 已给出一版代码修复和回归建议");
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

  it("returns a pure workbench chat reply through the commands route without executing a node command", async () => {
    const { dbPath } = prepareWorkspace();
    updateModelProviderSettings(
      {
        providerId: "kimi-coding",
        enabled: true,
        apiKey: "sk-kimi-coding-local-123456",
        modelPriority: ["k2p5"]
      },
      dbPath
    );
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_kimi_coding_chat",
          content: [
            {
              type: "text",
              text: "在的，我现在可以正常回复你。"
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof global.fetch;

    const response = await postCommandCenter(
      new Request("http://127.0.0.1:3000/api/forge/commands", {
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
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.execution).toBeUndefined();
    expect(payload.data.modelExecution).toEqual(
      expect.objectContaining({
        providerId: "kimi-coding",
        providerLabel: "Kimi Coding",
        model: "k2p5",
        status: "success"
      })
    );
    expect(payload.data.modelExecution.content).toContain("在的，我现在可以正常回复你");
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
    const requestBody = JSON.parse(
      String(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body)
    ) as {
      system: string;
      messages: Array<{ content: string }>;
    };
    expect(requestBody.system).toContain("测试开发工程师 · Monkey");
    expect(requestBody.system).toContain("你是 测试开发工程师 · Monkey");
    expect(requestBody.messages[0]?.content).toContain("可参考知识源：自动化回归清单");
  });

  it("returns the runner registry through the runners route", async () => {
    prepareWorkspace();

    const response = await getRunners();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.totalRunners).toBeGreaterThan(0);
    expect(payload.data.unifiedRemediationApiPath).toBe("/api/forge/remediations/retry");
    expect(payload.data.runtimeSummary?.totalRunners).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.healthyRunnerCount).toBeGreaterThan(0);
    expect(payload.data.runtimeSummary?.capabilityDetails).toEqual(
      expect.arrayContaining([expect.stringContaining("Version 1.55.0")])
    );
    expect(payload.data.items[0].name).toContain("执行器");
  });

  it("rejects non-string project ids through the active project route", async () => {
    prepareWorkspace();

    const response = await postActiveProject(
      new Request("http://127.0.0.1:3000/api/forge/projects/active", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: 123
        })
      })
    );

    await expectValidationErrorResponse(response, "FORGE_VALIDATION_ERROR", "项目 ID必须是字符串");
  });

  it("updates a runner heartbeat through the runners route", async () => {
    prepareWorkspace();

    const response = await postRunners(
      new Request("http://127.0.0.1:3000/api/forge/runners", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runnerId: "runner-local-main",
          status: "blocked",
          currentRunId: "run-1",
          lastHeartbeat: "刚刚"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.runner.id).toBe("runner-local-main");
    expect(payload.data.runner.status).toBe("blocked");
  });

  it("requires a runner status when updating a runner heartbeat", async () => {
    prepareWorkspace();

    const response = await postRunners(
      new Request("http://127.0.0.1:3000/api/forge/runners", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runnerId: "runner-local-main",
          currentRunId: "run-1",
          lastHeartbeat: "刚刚"
        })
      })
    );

    await expectValidationErrorResponse(response, "FORGE_VALIDATION_ERROR", "Runner 状态不能为空");
  });

  it("rejects non-object request bodies through the runners route", async () => {
    prepareWorkspace();

    const response = await postRunners(
      new Request("http://127.0.0.1:3000/api/forge/runners", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("runner-local-main")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("probes runner capabilities through the runner probe route", async () => {
    const { dbPath, directory } = prepareWorkspace();
    const workspacePath = join(directory, "data", "workspaces", "retail-support");
    mkdirSync(workspacePath, { recursive: true });

    const db = new Database(dbPath);
    db.prepare(`
      UPDATE runners
      SET workspace_path = ?, capabilities_json = ?
      WHERE id = ?
    `).run(workspacePath, JSON.stringify(["Git", "文件写入"]), "runner-local-main");
    db.close();

    const response = await postRunnerProbe(
      new Request("http://127.0.0.1:3000/api/forge/runners/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runnerId: "runner-local-main"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.probedCount).toBe(1);
    expect(payload.data.items[0].runner.id).toBe("runner-local-main");
    expect(payload.data.items[0].probeStatus).toBe("healthy");
    expect(payload.data.items[0].detectedCapabilities).toEqual(
      expect.arrayContaining(["Git", "文件写入"])
    );
    expect(payload.data.items[0].detectedCapabilityDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "Git", status: "pass" })
      ])
    );
  });

  it("includes NanoClaw CEO manager readiness through the runner probe route", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");

    const response = await postRunnerProbe(
      new Request("http://127.0.0.1:3000/api/forge/runners/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runnerId: "runner-local-main"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.nanoManager).toEqual(
      expect.objectContaining({
        status: "ready"
      })
    );
    expect(payload.data.nanoManager.summary).toContain("NanoClaw CEO 总控已就绪");
  });

  it("includes NanoClaw CEO manager degradation through the runner probe route", async () => {
    prepareWorkspace();
    vi.stubEnv("FORGE_NANO_EXEC_PROVIDER", "Nano CEO");
    vi.stubEnv("FORGE_NANO_EXEC_BACKEND", "NanoClaw");
    vi.stubEnv("FORGE_NANO_EXEC_BIN", "node");
    vi.stubEnv("FORGE_NANO_HEALTHCHECK_COMMAND", 'node -e "process.exit(7)"');

    const response = await postRunnerProbe(
      new Request("http://127.0.0.1:3000/api/forge/runners/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runnerId: "runner-local-main"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.nanoManager).toEqual(
      expect.objectContaining({
        status: "degraded"
      })
    );
    expect(payload.data.nanoManager.summary).toContain("健康检查失败");
  });

  it("lists the current project workspace tree and reads file content through the workspace files route", async () => {
    prepareWorkspace();

    const treeResponse = await getWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files?projectId=retail-support")
    );
    const treePayload = await treeResponse.json();

    expect(treeResponse.status).toBe(200);
    expect(treePayload.ok).toBe(true);
    expect(treePayload.data.workspaceLabel).toBe("retail-support");
    expect(treePayload.data.tree).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "README.md", path: "README.md", kind: "file" }),
        expect.objectContaining({ name: "notes", path: "notes", kind: "directory" }),
        expect.objectContaining({ name: "context", path: "context", kind: "directory" })
      ])
    );

    const fileResponse = await getWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files?projectId=retail-support&path=README.md")
    );
    const filePayload = await fileResponse.json();

    expect(fileResponse.status).toBe(200);
    expect(filePayload.ok).toBe(true);
    expect(filePayload.data.file.path).toBe("README.md");
    expect(filePayload.data.file.editable).toBe(true);
    expect(filePayload.data.file.body).toContain("# 零售客服副驾驶");
  });

  it("marks the workspace files route as dynamic so new projects can read the latest workspace", () => {
    expect(workspaceFilesRoute.dynamic).toBe("force-dynamic");
    expect(workspaceFilesRoute.revalidate).toBe(0);
  });

  it("saves markdown files through the workspace files route", async () => {
    const { directory } = prepareWorkspace();
    const workspaceFilePath = join(directory, "data", "workspaces", "retail-support", "notes", "intake.md");

    const response = await postWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          path: "notes/intake.md",
          body: "# 更新后的接入记录\n\n- 已补充工作区说明"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.file.path).toBe("notes/intake.md");
    expect(payload.data.file.editable).toBe(true);
    expect(readFileSync(workspaceFilePath, "utf8")).toContain("更新后的接入记录");
  });

  it("creates workspace directories and markdown files through the workspace files route", async () => {
    const { directory } = prepareWorkspace();
    const workspaceDirectoryPath = join(directory, "data", "workspaces", "retail-support", "notes", "handoff");
    const workspaceFilePath = join(workspaceDirectoryPath, "summary.md");

    const directoryResponse = await postWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "create-directory",
          projectId: "retail-support",
          path: "notes/handoff"
        })
      })
    );
    const directoryPayload = await directoryResponse.json();

    expect(directoryResponse.status).toBe(200);
    expect(directoryPayload.ok).toBe(true);
    expect(existsSync(workspaceDirectoryPath)).toBe(true);

    const fileResponse = await postWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action: "create-markdown",
          projectId: "retail-support",
          path: "notes/handoff/summary.md",
          body: "# 交接说明\n\n- 已创建新的工作区文件"
        })
      })
    );
    const filePayload = await fileResponse.json();

    expect(fileResponse.status).toBe(200);
    expect(filePayload.ok).toBe(true);
    expect(filePayload.data.file.path).toBe("notes/handoff/summary.md");
    expect(filePayload.data.file.editable).toBe(true);
    expect(readFileSync(workspaceFilePath, "utf8")).toContain("已创建新的工作区文件");
  });

  it("deletes workspace files and directories through the workspace files route", async () => {
    const { directory } = prepareWorkspace();
    const workspaceDirectoryPath = join(directory, "data", "workspaces", "retail-support", "notes", "obsolete");
    const workspaceFilePath = join(workspaceDirectoryPath, "legacy.md");

    mkdirSync(workspaceDirectoryPath, { recursive: true });
    writeFileSync(workspaceFilePath, "# 待删除文档", "utf8");

    const response = await deleteWorkspaceFiles(
      new Request("http://127.0.0.1:3000/api/forge/workspace-files", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          path: "notes/obsolete"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(existsSync(workspaceDirectoryPath)).toBe(false);
  });

  it("rejects non-object request bodies through the runner probe route", async () => {
    prepareWorkspace();

    const response = await postRunnerProbe(
      new Request("http://127.0.0.1:3000/api/forge/runners/probe", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify("runner-local-main")
      })
    );

    await expectValidationErrorResponse(
      response,
      "FORGE_INVALID_JSON_OBJECT",
      "请求体必须是 JSON 对象"
    );
  });

  it("upserts a run result through the runs route", async () => {
    prepareWorkspace();

    const response = await postRuns(
      new Request("http://127.0.0.1:3000/api/forge/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "run-retail-patch",
          projectId: "retail-support",
          title: "生成退款失败补丁",
          executor: "Codex",
          cost: "$1.02",
          state: "done",
          failureCategory: null,
          failureSummary: ""
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.run.id).toBe("run-retail-patch");
    expect(payload.data.run.state).toBe("done");
    expect(payload.data.run.cost).toBe("$1.02");
    expect(payload.data.event.type).toBe("status");
  });

  it("returns run timeline and failure attribution through the runs route", async () => {
    prepareWorkspace();

    await postRuns(
      new Request("http://127.0.0.1:3000/api/forge/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "run-retail-playwright-blocked",
          projectId: "retail-support",
          taskPackId: "artifact-taskpack-retail",
          linkedComponentIds: ["component-payment-checkout"],
          title: "回归退款失败主流程",
          executor: "Playwright",
          cost: "$0.41",
          state: "blocked",
          failureCategory: "test-failure",
          failureSummary: "登录态失效，主流程在支付确认页超时。"
        })
      })
    );

    const response = await getRuns(
      new Request("http://127.0.0.1:3000/api/forge/runs?projectId=retail-support")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.events.length).toBeGreaterThan(0);
    expect(payload.data.latestFailure?.failureCategory).toBe("test-failure");
    const runtimeItem = payload.data.items.find((item: { id: string }) => item.id === "run-retail-playwright-blocked");
    expect(runtimeItem?.taskPackId).toBe("artifact-taskpack-retail");
    expect(runtimeItem?.taskPackLabel).toBe("支付失败修复任务包");
    expect(runtimeItem?.linkedComponentIds).toEqual(["component-payment-checkout"]);
    expect(runtimeItem?.linkedComponentLabels).toContain("支付结算组件");
  });

  it("updates an agent profile through the team-registry route", async () => {
    prepareWorkspace();

    const response = await postTeamRegistry(
      new Request("http://127.0.0.1:3000/api/forge/team-registry", {
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
          persona: "你是负责对齐业务目标、验收标准和上线风险的产品经理 Agent。",
          policyId: "policy-product-strict",
          permissionProfileId: "perm-review",
          promptTemplateId: "prompt-prd-rag",
          skillIds: ["skill-prd", "skill-delivery-gate"],
          systemPrompt: "你是负责范围收口与验收标准的产品经理 Agent。",
          ownerMode: "review-required",
          knowledgeSources: ["产品手册", "行业案例库"]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.agent.id).toBe("agent-pm");
    expect(payload.data.agent.name).toBe("产品策略 Agent");
    expect(payload.data.agent.role).toBe("architect");
    expect(payload.data.agent.runnerId).toBe("runner-reviewer");
    expect(payload.data.agent.departmentLabel).toBe("产品与方案");
    expect(payload.data.agent.persona).toContain("验收标准");
    expect(payload.data.agent.policyId).toBe("policy-product-strict");
    expect(payload.data.agent.permissionProfileId).toBe("perm-review");
    expect(payload.data.agent.promptTemplateId).toBe("prompt-prd-rag");
    expect(payload.data.agent.skillIds).toEqual(["skill-prd", "skill-delivery-gate"]);
    expect(payload.data.agent.ownerMode).toBe("review-required");
    expect(payload.data.agent.knowledgeSources).toContain("行业案例库");
  });

  it("rejects malformed knowledge source lists through the team-registry route", async () => {
    prepareWorkspace();

    const response = await postTeamRegistry(
      new Request("http://127.0.0.1:3000/api/forge/team-registry", {
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
          promptTemplateId: "prompt-prd-rag",
          systemPrompt: "你是负责范围收口与验收标准的产品经理 Agent。",
          knowledgeSources: "行业案例库"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("FORGE_VALIDATION_ERROR");
    expect(payload.error.message).toBe("知识来源必须是字符串数组");
  });

  it("updates and returns the team workbench state through the team-workbench-state route", async () => {
    prepareWorkspace();

    const updateResponse = await postTeamWorkbenchState(
      new Request("http://127.0.0.1:3000/api/forge/team-workbench-state", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          selectedTemplateId: "team-design-sprint",
          activeCategory: "templates",
          employeeDetailTab: "ability",
          abilityTemplateTab: "packs",
          selectedAgentId: "agent-service-strategy",
          selectedBuilderRole: "engineer",
          selectedPoolAgentId: "agent-service-strategy",
          selectedPoolDepartment: "管理层",
          selectedManagementDepartment: "管理层",
          selectedTemplateDepartment: "技术研发",
          selectedGovernanceDepartment: "管理层",
          selectedAbilityLine: "AI智能",
          selectedRecommendedPackId: "pack-support",
          selectedCustomPackId: "custom-pack-support",
          isCurrentPackListCollapsed: true,
          roleAssignments: {
            pm: "agent-service-strategy",
            architect: "agent-architect",
            design: "agent-ux",
            engineer: "agent-engineer",
            qa: "agent-qa-automation",
            release: "agent-release",
            knowledge: "agent-knowledge-ops"
          },
          manualSkillIdsByAgentId: {
            "agent-service-strategy": ["skill-prd", "skill-archive"]
          },
          manualKnowledgeSourcesByAgentId: {
            "agent-service-strategy": ["产品手册", "发布规范"]
          },
          removedPackSkillIdsByAgentId: {
            "agent-service-strategy": {
              "preset:pack-support": ["skill-archive"]
            }
          },
          equippedPackByAgentId: {
            "agent-service-strategy": [{ source: "preset", id: "pack-support" }]
          },
          managedAgents: [],
          orgDepartments: [{ label: "管理层" }],
          orgChartMembers: [],
          skillCatalogOverrides: {
            "skill-prd": {
              name: "PRD 结构化生成",
              summary: "补强需求收口与结构化输出。",
              line: "AI智能",
              category: "规划"
            }
          },
          hiddenSkillIds: ["skill-archive"],
          governanceOverridesByAgentId: {
            "agent-service-strategy": {
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
              summary: "补强 FAQ 和知识检索。",
              skillIds: ["skill-prd", "skill-archive"],
              updatedAt: "刚刚"
            }
          ]
        })
      })
    );
    const updatePayload = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.data.state.selectedTemplateId).toBe("team-design-sprint");
    expect(updatePayload.data.state.activeCategory).toBe("templates");
    expect(updatePayload.data.state.roleAssignments.pm).toBe("agent-service-strategy");
    expect(updatePayload.data.state.customAbilityPacks).toHaveLength(1);

    const readResponse = await getTeamWorkbenchState(
      new Request("http://127.0.0.1:3000/api/forge/team-workbench-state")
    );
    const readPayload = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readPayload.ok).toBe(true);
    expect(readPayload.data.selectedTemplateId).toBe("team-design-sprint");
    expect(readPayload.data.selectedBuilderRole).toBe("engineer");
    expect(readPayload.data.roleAssignments.engineer).toBe("agent-engineer");
    expect(readPayload.data.equippedPackByAgentId["agent-service-strategy"]).toEqual([
      { source: "preset", id: "pack-support" }
    ]);
    expect(readPayload.data.customAbilityPacks[0].name).toBe("客服增强包");
    expect(readPayload.data.skillCatalogOverrides["skill-prd"].line).toBe("AI智能");
    expect(readPayload.data.hiddenSkillIds).toEqual(["skill-archive"]);
    expect(readPayload.data.governanceOverridesByAgentId["agent-service-strategy"]).toEqual({
      enabled: ["project.advance"],
      disabled: ["team.configure"]
    });
  });

  it("returns a fully seeded team workbench state by default", async () => {
    prepareWorkspace();

    const response = await getTeamWorkbenchState(
      new Request("http://127.0.0.1:3000/api/forge/team-workbench-state")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.selectedTemplateId).toBe("team-standard-delivery");
    expect(payload.data.activeCategory).toBe("organization");
    expect(payload.data.employeeDetailTab).toBe("basic");
    expect(payload.data.abilityTemplateTab).toBe("equipped");
    expect(payload.data.selectedAgentId).toBe("agent-service-strategy");
    expect(payload.data.selectedPoolAgentId).toBe("agent-service-strategy");
    expect(payload.data.managedAgents.map((agent: { id: string }) => agent.id)).toEqual([
      "agent-service-strategy",
      "agent-discovery",
      "agent-architect",
      "agent-solution-architect",
      "agent-ux",
      "agent-ux-research",
      "agent-engineer",
      "agent-frontend",
      "agent-backend-integration",
      "agent-qa-automation",
      "agent-security-gate",
      "agent-release",
      "agent-delivery-ops",
      "agent-knowledge-ops",
      "agent-asset-curator"
    ]);
    expect(payload.data.roleAssignments).toMatchObject({
      pm: "agent-service-strategy",
      architect: "agent-architect",
      design: "agent-ux",
      engineer: "agent-engineer",
      qa: "agent-qa-automation",
      release: "agent-release",
      knowledge: "agent-knowledge-ops"
    });
    expect(payload.data.orgDepartments).toEqual(
      expect.arrayContaining([
        { label: "项目管理" },
        { label: "产品与方案" },
        { label: "技术研发" },
        { label: "运营支持" }
      ])
    );
    expect(payload.data.equippedPackByAgentId["agent-frontend"]).toEqual([
      { source: "preset", id: "pack-开发工具" }
    ]);
    expect(payload.data.equippedPackByAgentId["agent-knowledge-ops"]).toEqual([
      { source: "preset", id: "pack-数据分析" },
      { source: "preset", id: "pack-效率提升" }
    ]);
  });

  it("updates and returns the project workbench state through the project-workbench-state route", async () => {
    prepareWorkspace();

    const updateResponse = await postProjectWorkbenchState(
      new Request("http://127.0.0.1:3000/api/forge/project-workbench-state", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          "retail-support": {
            workspaceView: {
              isOpen: true,
              selectedFilePath: "notes/intake.md",
              expandedDirectories: ["notes", "context"]
            },
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
                        speaker: "测试开发工程师 · Monkey",
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
        })
      })
    );
    const updatePayload = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.data.state["retail-support"].nodePanels["DEMO测试"].conversationTabs).toHaveLength(1);

    const readResponse = await getProjectWorkbenchState(
      new Request("http://127.0.0.1:3000/api/forge/project-workbench-state")
    );
    const readPayload = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readPayload.ok).toBe(true);
    expect(readPayload.data["retail-support"].workspaceView.isOpen).toBe(true);
    expect(readPayload.data["retail-support"].workspaceView.selectedFilePath).toBe("notes/intake.md");
    expect(readPayload.data["retail-support"].workspaceView.expandedDirectories).toEqual(
      expect.arrayContaining(["notes", "context"])
    );
    expect(readPayload.data["retail-support"].nodePanels["DEMO测试"].documentTabs[0].document.title).toBe(
      "已保存结果"
    );
    expect(readPayload.data["retail-support"].nodePanels["DEMO测试"].conversationTabs[0].messages[0].text).toBe(
      "已保存工作台会话。"
    );
  });

  it("updates workflow state through the workflow route", async () => {
    prepareWorkspace();

    const response = await postWorkflow(
      new Request("http://127.0.0.1:3000/api/forge/workflow", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          currentStage: "开发执行",
          state: "blocked",
          blockers: ["等待研发补丁重新提交"],
          updatedBy: "pm"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.workflow.currentStage).toBe("开发执行");
    expect(payload.data.workflow.blockers).toContain("等待研发补丁重新提交");
  });

  it("rejects malformed blocker lists through the workflow route", async () => {
    prepareWorkspace();

    const response = await postWorkflow(
      new Request("http://127.0.0.1:3000/api/forge/workflow", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          currentStage: "开发执行",
          state: "blocked",
          blockers: "等待研发补丁重新提交",
          updatedBy: "pm"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("FORGE_VALIDATION_ERROR");
    expect(payload.error.message).toBe("阻塞项必须是字符串数组");
  });

  it("returns workflow states through the workflow route", async () => {
    prepareWorkspace();

    const response = await getWorkflow();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.total).toBeGreaterThan(0);
  });

  it("creates a prd draft through the prd route", async () => {
    prepareWorkspace();

    const response = await postPrd(
      new Request("http://127.0.0.1:3000/api/forge/prd", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          projectId: "retail-support",
          templateId: "prompt-prd-customer-service",
          extraNotes: "把退款失败流程写清楚。"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.document.title).toContain("零售客服副驾驶");
    expect(payload.data.document.content).toContain("退款失败");
    expect(payload.data.template.id).toBe("prompt-prd-customer-service");
  });
});
