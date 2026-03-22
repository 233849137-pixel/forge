import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultTeamWorkbenchAgentOrder } from "../src/lib/forge-team-defaults";
import { getForgeAgentDisplayLabel } from "../packages/core/src";
import {
  createProject,
  ensureForgeDatabase,
  generatePrdDraft,
  getModelProviderSettings,
  loadDashboardSnapshot,
  recordCommandExecution,
  resolveForgeDbPath,
  updateModelProviderSettings,
  setActiveProject,
  updateProjectWorkflowState,
  updateAgentProfile,
  upsertRun
} from "../packages/db/src";
describe("forge sqlite repository", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the explicit dbPath ahead of data mode selection", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const explicitPath = join(directory, "custom", "explicit.db");

    try {
      vi.stubEnv("FORGE_DATA_MODE", "demo");

      ensureForgeDatabase(explicitPath);

      expect(resolveForgeDbPath(explicitPath)).toBe(explicitPath);
      expect(existsSync(explicitPath)).toBe(true);
      expect(existsSync(join(directory, "data", "forge-demo.db"))).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates the demo database by default when no local database exists", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));

    try {
      vi.spyOn(process, "cwd").mockReturnValue(directory);

      ensureForgeDatabase();

      expect(resolveForgeDbPath()).toBe(join(directory, "data", "forge-demo.db"));
      expect(existsSync(join(directory, "data", "forge-demo.db"))).toBe(true);
      expect(existsSync(join(directory, "data", "forge.db"))).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps using the local database in auto mode when one already exists", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const localDbPath = join(directory, "data", "forge.db");

    try {
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      ensureForgeDatabase(localDbPath);

      expect(resolveForgeDbPath()).toBe(localDbPath);
      ensureForgeDatabase();
      expect(existsSync(localDbPath)).toBe(true);
      expect(existsSync(join(directory, "data", "forge-demo.db"))).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("supports forcing demo mode through FORGE_DATA_MODE", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const localDbPath = join(directory, "data", "forge.db");

    try {
      vi.spyOn(process, "cwd").mockReturnValue(directory);
      ensureForgeDatabase(localDbPath);
      vi.stubEnv("FORGE_DATA_MODE", "demo");

      ensureForgeDatabase();

      expect(resolveForgeDbPath()).toBe(join(directory, "data", "forge-demo.db"));
      expect(existsSync(join(directory, "data", "forge-demo.db"))).toBe(true);
      expect(existsSync(localDbPath)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("initializes and seeds a new local database", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.projects).toHaveLength(3);
      expect((snapshot as { projectTemplates?: unknown[] }).projectTemplates).toHaveLength(3);
      expect((snapshot as { workflowStates?: unknown[] }).workflowStates).toHaveLength(3);
      expect((snapshot as { workflowTransitions?: unknown[] }).workflowTransitions).toHaveLength(3);
      expect(snapshot.assets).toHaveLength(3);
      expect(snapshot.runs).toHaveLength(3);
      expect(snapshot.deliveryGate).toHaveLength(4);
      expect(snapshot.promptTemplates).toHaveLength(3);
      expect(snapshot.prdDocuments).toHaveLength(1);
      expect((snapshot as { projectProfiles?: unknown[] }).projectProfiles).toHaveLength(3);
      expect((snapshot as { projectAssetLinks?: unknown[] }).projectAssetLinks).toHaveLength(9);
      expect((snapshot as { agents?: unknown[] }).agents).toHaveLength(19);
      expect((snapshot as { skills?: unknown[] }).skills).toHaveLength(15);
      expect((snapshot as { sops?: unknown[] }).sops).toHaveLength(8);
      expect((snapshot as { teamTemplates?: unknown[] }).teamTemplates).toHaveLength(3);
      expect((snapshot as { artifacts?: unknown[] }).artifacts).toHaveLength(7);
      expect((snapshot as { tasks?: unknown[] }).tasks).toHaveLength(5);
      expect(snapshot.projects[0]?.name).toBe("零售客服副驾驶");
      expect(snapshot.agents.find((agent) => agent.id === "agent-pm")?.runnerId).toBe(
        "runner-local-main"
      );
      expect(snapshot.agents.find((agent) => agent.id === "agent-backend-integration")?.role).toBe(
        "engineer"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates a new project and persists it as the active workspace", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      createProject(
        {
          id: "local-recovery-desk",
          name: "Local Recovery Desk",
          sector: "支付修复 / 本地交付",
          owner: "Iris",
          templateId: "template-smart-service"
        } as never,
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath) as {
        activeProjectId?: string;
        projects: { id: string; name: string }[];
        projectProfiles?: {
          projectId: string;
          templateId: string;
          teamTemplateId?: string;
          teamTemplateTitle?: string;
          workspacePath: string;
          dnaSummary: string;
        }[];
      };
      const profile = snapshot.projectProfiles?.find(
        (item) => item.projectId === "local-recovery-desk"
      );

      expect(snapshot.activeProjectId).toBe("local-recovery-desk");
      expect(
        snapshot.projects.some((project) => project.name === "Local Recovery Desk")
      ).toBe(true);
      expect(profile?.templateId).toBe("template-smart-service");
      expect(profile?.teamTemplateId).toBe("team-standard-delivery");
      expect(profile?.teamTemplateTitle).toBe("标准交付团队");
      expect(profile?.workspacePath).toBe(join(directory, "workspaces", "local-recovery-desk"));
      expect(profile?.dnaSummary).toContain("客服");
      expect(existsSync(join(directory, "workspaces", "local-recovery-desk", "README.md"))).toBe(
        true
      );
      const createdArtifacts = snapshot.artifacts.filter(
        (artifact) => artifact.projectId === "local-recovery-desk"
      );
      const createdTasks = snapshot.tasks.filter((task) => task.projectId === "local-recovery-desk");
      const createdLinks = snapshot.projectAssetLinks?.filter(
        (link) => link.projectId === "local-recovery-desk"
      );

      expect(createdArtifacts.map((artifact) => artifact.type)).toEqual(
        expect.arrayContaining(["prd", "architecture-note", "ui-spec", "task-pack"])
      );
      expect(createdTasks.map((task) => task.title)).toEqual(
        expect.arrayContaining([
          "确认需求摘要与成功标准",
          "生成 PRD 初稿",
          "产出原型与架构基线",
          "初始化本地执行与门禁"
        ])
      );
      expect(createdLinks).toHaveLength(3);
      expect(
        existsSync(join(directory, "workspaces", "local-recovery-desk", "context", "project-dna.json"))
      ).toBe(true);
      expect(
        existsSync(join(directory, "workspaces", "local-recovery-desk", "notes", "intake.md"))
      ).toBe(true);

      const dna = JSON.parse(
        readFileSync(
          join(directory, "workspaces", "local-recovery-desk", "context", "project-dna.json"),
          "utf8"
        )
      ) as { templateId?: string; sector?: string };

      expect(dna.templateId).toBe("template-smart-service");
      expect(dna.sector).toBe("支付修复 / 本地交付");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("prunes stale team templates and falls back to canonical team workbench defaults on sync", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare(`
        INSERT INTO team_templates (id, name, summary, agent_ids_json, lead_agent_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        "team-ui-constraint",
        "UI 强约束团队",
        "历史模板，不应继续出现在当前 UI 中。",
        JSON.stringify(["agent-service-strategy", "agent-ux", "agent-frontend"]),
        "agent-ux"
      );
      db.prepare(`
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(
        "team_workbench_state",
        JSON.stringify({
          selectedTemplateId: "team-ui-constraint",
          roleAssignments: {
            pm: "agent-qa-automation",
            architect: "agent-pm",
            design: "agent-ux",
            engineer: "agent-frontend",
            qa: "agent-qa",
            release: "agent-release",
            knowledge: "agent-knowledge-ops"
          }
        })
      );
      db.close();

      ensureForgeDatabase(dbPath, "sync-demo");

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.teamTemplates.map((item) => item.id)).toEqual([
        "team-standard-delivery",
        "team-lean-validation",
        "team-design-sprint"
      ]);
      expect(snapshot.teamWorkbenchState?.selectedTemplateId).toBe("team-standard-delivery");
      expect(snapshot.teamWorkbenchState?.selectedAgentId).toBe("agent-service-strategy");
      expect(snapshot.teamWorkbenchState?.selectedPoolAgentId).toBe("agent-service-strategy");
      expect(snapshot.teamWorkbenchState?.roleAssignments.pm).toBe("agent-service-strategy");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("hydrates managed agents and org chart members from canonical roster labels", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare(`
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(
        "team_workbench_state",
        JSON.stringify({
          managedAgents: [
            {
              id: "agent-pm",
              name: "产品经理 Agent",
              role: "pm",
              runnerId: "runner-local-main",
              departmentLabel: "管理层",
              persona: "旧 persona",
              systemPrompt: "旧 prompt",
              responsibilities: ["旧职责"],
              skillIds: ["skill-prd"],
              sopIds: [],
              knowledgeSources: ["旧知识"],
              promptTemplateId: "prompt-prd-customer-service",
              policyId: "policy-product",
              permissionProfileId: "perm-collaborator",
              ownerMode: "human-approved"
            }
          ],
          orgChartMembers: [
            {
              id: "agent-pm",
              name: "产品经理 Agent",
              role: "pm",
              departmentLabel: "管理层"
            }
          ]
        })
      );
      db.close();

      const snapshot = loadDashboardSnapshot(dbPath);
      const canonicalPmLabel = getForgeAgentDisplayLabel({ id: "agent-pm" });

      expect(
        snapshot.teamWorkbenchState?.managedAgents.find((agent) => agent.id === "agent-pm")?.name
      ).toBe(canonicalPmLabel);
      expect(
        snapshot.teamWorkbenchState?.orgChartMembers.find((member) => member.id === "agent-pm")?.name
      ).toBe(canonicalPmLabel);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns managed agents in the shared canonical roster order", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath, "sync-demo");

      const snapshot = loadDashboardSnapshot(dbPath);
      const managedAgentIds =
        snapshot.teamWorkbenchState?.managedAgents.map((agent) => agent.id) ?? [];

      expect(managedAgentIds).toEqual(defaultTeamWorkbenchAgentOrder);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("resets the selected agent to the active template lead when persisted context points outside the template", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare(`
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(
        "team_workbench_state",
        JSON.stringify({
          selectedTemplateId: "team-design-sprint",
          selectedAgentId: "agent-pm",
          selectedPoolAgentId: "agent-pm",
          roleAssignments: {
            pm: "agent-service-strategy",
            architect: "agent-architect",
            design: "agent-ux",
            engineer: "agent-frontend",
            qa: null,
            release: null,
            knowledge: null
          }
        })
      );
      db.close();

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.teamWorkbenchState?.selectedTemplateId).toBe("team-design-sprint");
      expect(snapshot.teamWorkbenchState?.selectedAgentId).toBe("agent-service-strategy");
      expect(snapshot.teamWorkbenchState?.selectedPoolAgentId).toBe("agent-service-strategy");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("resets team workbench state back to the demo baseline when sync-demo runs", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare(`
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(
        "team_workbench_state",
        JSON.stringify({
          selectedTemplateId: "team-design-sprint",
          selectedAgentId: "agent-architect",
          selectedPoolAgentId: "agent-engineer",
          selectedAbilityLine: "开发工具",
          selectedCustomPackId: "custom-pack-demo",
          customAbilityPacks: [
            {
              id: "custom-pack-demo",
              name: "临时技能包",
              line: "开发工具",
              category: "开发",
              summary: "临时技能包",
              skillIds: ["spec-miner"],
              source: "custom"
            }
          ]
        })
      );
      db.close();

      ensureForgeDatabase(dbPath, "sync-demo");

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.teamWorkbenchState?.selectedTemplateId).toBe("team-standard-delivery");
      expect(snapshot.teamWorkbenchState?.selectedAgentId).toBe("agent-service-strategy");
      expect(snapshot.teamWorkbenchState?.selectedPoolAgentId).toBe("agent-service-strategy");
      expect(snapshot.teamWorkbenchState?.selectedAbilityLine).toBe("全部");
      expect(snapshot.teamWorkbenchState?.selectedCustomPackId).toBeNull();
      expect(snapshot.teamWorkbenchState?.customAbilityPacks).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("persists an explicitly selected active project", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      setActiveProject("ops-briefing", dbPath);

      const snapshot = loadDashboardSnapshot(dbPath) as { activeProjectId?: string };

      expect(snapshot.activeProjectId).toBe("ops-briefing");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("falls back to the first project when active app state is missing", { timeout: 10000 }, () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare("DELETE FROM app_state WHERE key = 'active_project_id'").run();
      db.close();

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.activeProjectId).toBe("retail-support");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("persists local model provider settings without returning the raw api key", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const provider = updateModelProviderSettings(
        {
          providerId: "kimi",
          enabled: true,
          apiKey: "sk-kimi-local-1234567890",
          modelPriority: ["kimi-latest", "kimi-thinking-preview"]
        },
        dbPath
      );
      const storedProviders = getModelProviderSettings(dbPath);

      expect(provider.id).toBe("kimi");
      expect(provider.enabled).toBe(true);
      expect(provider.hasApiKey).toBe(true);
      expect(provider.apiKeyHint).toContain("7890");
      expect((provider as { apiKey?: string }).apiKey).toBeUndefined();
      expect(storedProviders.find((item) => item.id === "kimi")?.modelPriority).toEqual([
        "kimi-latest",
        "kimi-thinking-preview"
      ]);

      const db = new Database(dbPath);
      const appState = db
        .prepare("SELECT value FROM app_state WHERE key = 'model_provider_settings'")
        .get() as { value?: string } | undefined;
      db.close();

      expect(appState?.value).toContain("sk-kimi-local-1234567890");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("auto-enables a local model provider when a new api key is saved", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const provider = updateModelProviderSettings(
        {
          providerId: "kimi",
          enabled: false,
          apiKey: "sk-kimi-local-activate-1234",
          modelPriority: ["kimi-latest"]
        },
        dbPath
      );

      expect(provider.enabled).toBe(true);
      expect(provider.hasApiKey).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns a five-provider local model catalog while keeping the existing kimi storage contract", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const providers = getModelProviderSettings(dbPath);

      expect(providers.map((provider) => provider.id)).toEqual([
        "kimi",
        "kimi-coding",
        "openai",
        "anthropic",
        "google"
      ]);
      expect(providers.find((provider) => provider.id === "kimi-coding")).toEqual(
        expect.objectContaining({
          defaultModelPriority: ["k2p5"],
          catalogModels: expect.arrayContaining(["k2p5"])
        })
      );
      expect(providers.find((provider) => provider.id === "openai")).toEqual(
        expect.objectContaining({
          defaultModelPriority: ["gpt-5.4"],
          catalogModels: expect.arrayContaining(["gpt-5.4", "gpt-4.1-mini"])
        })
      );
      expect(providers.find((provider) => provider.id === "anthropic")).toEqual(
        expect.objectContaining({
          defaultModelPriority: ["claude-sonnet-4-5"],
          catalogModels: expect.arrayContaining(["claude-sonnet-4-5"])
        })
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("persists an openai provider configuration without exposing the raw api key", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const provider = updateModelProviderSettings(
        {
          providerId: "openai",
          enabled: true,
          apiKey: "sk-openai-local-1234567890",
          modelPriority: ["gpt-5.4", "gpt-4.1-mini"]
        },
        dbPath
      );

      expect(provider).toEqual(
        expect.objectContaining({
          id: "openai",
          enabled: true,
          hasApiKey: true,
          modelPriority: ["gpt-5.4", "gpt-4.1-mini"]
        })
      );
      expect(provider.apiKeyHint).toContain("7890");
      expect((provider as { apiKey?: string }).apiKey).toBeUndefined();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("does not overwrite runtime task state when the database is re-initialized", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const db = new Database(dbPath);
      db.prepare(`
        UPDATE tasks
        SET status = ?, summary = ?
        WHERE id = ?
      `).run("done", "manually completed", "task-retail-playwright");
      db.close();

      const updatedSnapshot = loadDashboardSnapshot(dbPath);
      const updatedTask = updatedSnapshot.tasks.find((task) => task.id === "task-retail-playwright");

      expect(updatedTask?.status).toBe("done");
      expect(updatedTask?.summary).toBe("manually completed");

      ensureForgeDatabase(dbPath);

      const snapshot = loadDashboardSnapshot(dbPath);
      const task = snapshot.tasks.find((item) => item.id === "task-retail-playwright");

      expect(task?.status).toBe("done");
      expect(task?.summary).toBe("manually completed");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("generates and persists a PRD draft from a prompt template", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const document = generatePrdDraft(
        {
          projectId: "retail-support",
          templateId: "prompt-prd-customer-service",
          extraNotes: "强调退款失败、转人工和知识库回退策略。"
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const template = snapshot.promptTemplates.find(
        (item) => item.id === "prompt-prd-customer-service"
      );

      expect(document.title).toContain("零售客服副驾驶");
      expect(document.content).toContain("退款失败");
      expect(snapshot.prdDocuments[0]?.id).toBe(document.id);
      expect(template?.useCount).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("writes an output event when a run upsert includes structured telemetry", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const result = upsertRun(
        {
          id: "run-qa-telemetry",
          projectId: "retail-support",
          title: "零售客服副驾驶 测试门禁",
          executor: "浏览器验证执行器",
          cost: "$0.00",
          state: "done",
          outputSummary: "已检测到 Playwright，可继续执行浏览器门禁。",
          outputMode: "playwright-ready",
          outputChecks: [{ name: "playwright", status: "pass" }]
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const outputEvent = snapshot.runEvents.find(
        (event) => event.runId === "run-qa-telemetry" && event.type === "output"
      );

      expect(result.run.id).toBe("run-qa-telemetry");
      expect(result.run.outputMode).toBe("playwright-ready");
      expect(result.run.outputChecks).toEqual([{ name: "playwright", status: "pass" }]);
      expect(outputEvent?.summary).toContain("Runtime:playwright-ready");
      expect(outputEvent?.summary).toContain("checks:playwright=pass");
      expect(outputEvent?.summary).toContain("已检测到 Playwright");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates an agent prompt profile and persists knowledge bindings", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const updated = updateAgentProfile(
        {
          agentId: "agent-pm",
          name: "产品策略 Agent",
          role: "architect",
          runnerId: "runner-reviewer",
          departmentLabel: "产品与方案",
          persona: "你是会优先收敛验收范围和业务风险的产品经理 Agent。",
          policyId: "policy-product-strict",
          permissionProfileId: "perm-review",
          promptTemplateId: "prompt-prd-rag",
          skillIds: ["skill-prd", "skill-delivery-gate"],
          systemPrompt: "你是更强调验收收口的产品经理 Agent。",
          ownerMode: "review-required",
          knowledgeSources: ["新版产品手册", "客服行业案例库"]
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const agent = snapshot.agents.find((item) => item.id === "agent-pm");

      expect(updated.promptTemplateId).toBe("prompt-prd-rag");
      expect(updated.name).toBe("产品策略 Agent");
      expect(updated.role).toBe("architect");
      expect(updated.runnerId).toBe("runner-reviewer");
      expect(updated.departmentLabel).toBe("产品与方案");
      expect(updated.persona).toContain("验收范围");
      expect(updated.policyId).toBe("policy-product-strict");
      expect(updated.permissionProfileId).toBe("perm-review");
      expect(updated.skillIds).toEqual(["skill-prd", "skill-delivery-gate"]);
      expect(updated.ownerMode).toBe("review-required");
      expect(agent?.name).toBe("产品策略 Agent");
      expect(agent?.role).toBe("architect");
      expect(agent?.runnerId).toBe("runner-reviewer");
      expect(agent?.departmentLabel).toBe("产品与方案");
      expect(agent?.systemPrompt).toContain("验收收口");
      expect(agent?.persona).toContain("验收范围");
      expect(agent?.policyId).toBe("policy-product-strict");
      expect(agent?.permissionProfileId).toBe("perm-review");
      expect(agent?.skillIds).toEqual(["skill-prd", "skill-delivery-gate"]);
      expect(agent?.ownerMode).toBe("review-required");
      expect(agent?.knowledgeSources).toEqual(["新版产品手册", "客服行业案例库"]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("updates and persists project workflow state", { timeout: 10000 }, () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const updated = updateProjectWorkflowState(
        {
          projectId: "retail-support",
          currentStage: "开发执行",
          state: "blocked",
          blockers: ["等待研发补丁重新提交"],
          updatedBy: "pm"
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const workflow = snapshot.workflowStates.find((item) => item.projectId === "retail-support");

      expect(updated.currentStage).toBe("开发执行");
      expect(workflow?.currentStage).toBe("开发执行");
      expect(workflow?.blockers).toContain("等待研发补丁重新提交");
      expect(workflow?.updatedBy).toBe("pm");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("writes run events and failure attribution when a run is blocked", { timeout: 10000 }, () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      upsertRun(
        {
          id: "run-retail-playwright-blocked",
          projectId: "retail-support",
          title: "回归退款失败主流程",
          executor: "Playwright",
          cost: "$0.41",
          state: "blocked",
          failureCategory: "test-failure",
          failureSummary: "登录态失效，主流程在支付确认页超时。"
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath);
      const runEvent = snapshot.runEvents.find(
        (event) => event.runId === "run-retail-playwright-blocked"
      );

      expect(runEvent?.type).toBe("failure");
      expect(runEvent?.failureCategory).toBe("test-failure");
      expect(runEvent?.summary).toContain("登录态失效");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("loads command registry and hook policy baseline from the dashboard snapshot", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      const snapshot = loadDashboardSnapshot(dbPath);

      expect(snapshot.commands.length).toBeGreaterThan(0);
      expect(snapshot.commands.some((command) => command.name === "生成 PRD")).toBe(true);
      expect(snapshot.commandHooks.some((hook) => hook.name === "beforeRun")).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("writes command executions and policy decisions for governance audit", () => {
    const directory = mkdtempSync(join(tmpdir(), "forge-db-"));
    const dbPath = join(directory, "forge.db");

    try {
      ensureForgeDatabase(dbPath);

      recordCommandExecution(
        {
          id: "command-execution-gate-run",
          commandId: "command-gate-run",
          projectId: "retail-support",
          status: "blocked",
          summary: "发起测试门禁时被 beforeRelease 策略阻止。",
          triggeredBy: "测试 Agent",
          followUpTaskIds: ["task-retail-support-gate-escalation"],
          decisions: [
            {
              id: "policy-decision-before-release",
              hookId: "hook-before-release",
              outcome: "block",
              summary: "存在失败门禁，禁止推进交付发布。"
            }
          ]
        },
        dbPath
      );

      const snapshot = loadDashboardSnapshot(dbPath) as typeof loadDashboardSnapshot extends (
        ...args: never[]
      ) => infer TResult
        ? TResult & {
            commandExecutions?: Array<{ id: string; status: string; followUpTaskIds: string[] }>;
            policyDecisions?: Array<{ id: string; outcome: string }>;
          }
        : never;
      const execution = snapshot.commandExecutions?.find(
        (item) => item.id === "command-execution-gate-run"
      );
      const decision = snapshot.policyDecisions?.find(
        (item) => item.id === "policy-decision-before-release"
      );

      expect(execution?.status).toBe("blocked");
      expect(execution?.followUpTaskIds).toContain("task-retail-support-gate-escalation");
      expect(decision?.outcome).toBe("block");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
