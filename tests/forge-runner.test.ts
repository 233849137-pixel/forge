import { afterEach, describe, expect, it, vi } from "vitest";
import { executeRunnerCommand, parseRunnerArgs } from "../scripts/lib/forge-runner.mjs";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("forge runner cli", () => {
  it("parses runner arguments with sensible defaults", () => {
    const parsed = parseRunnerArgs([
      "--runner-id",
      "runner-reviewer",
      "--command-id",
      "command-review-run",
      "--project-id",
      "retail-support",
      "--execute-plan"
    ]);

    expect(parsed.runnerId).toBe("runner-reviewer");
    expect(parsed.commandId).toBe("command-review-run");
    expect(parsed.projectId).toBe("retail-support");
    expect(parsed.baseUrl).toBe("http://127.0.0.1:3000");
    expect(parsed.executePlan).toBe(true);
  });

  it("parses remediation task replay arguments", () => {
    const parsed = parseRunnerArgs([
      "--runner-id",
      "runner-browser-qa",
      "--task-id",
      "task-retail-playwright",
      "--project-id",
      "retail-support"
    ]);

    expect(parsed.runnerId).toBe("runner-browser-qa");
    expect(parsed.taskId).toBe("task-retail-playwright");
    expect(parsed.commandId).toBe("");
    expect(parsed.projectId).toBe("retail-support");
  });

  it("parses unified remediation replay arguments", () => {
    const parsed = parseRunnerArgs([
      "--remediation-id",
      "task-retail-playwright",
      "--project-id",
      "retail-support"
    ]);

    expect(parsed.remediationId).toBe("task-retail-playwright");
    expect(parsed.taskId).toBe("");
    expect(parsed.commandId).toBe("");
    expect(parsed.projectId).toBe("retail-support");
  });

  it("parses explicit component ids for runner replay", () => {
    const parsed = parseRunnerArgs([
      "--task-id",
      "task-retail-playwright",
      "--project-id",
      "retail-support",
      "--component-ids",
      "component-payment-checkout,component-auth-email"
    ]);

    expect(parsed.componentIds).toBe("component-payment-checkout,component-auth-email");
  });

  it("updates heartbeat before and after executing a command", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-review-run", type: "review.run", name: "发起规则审查" }],
              commandContracts: [{ type: "review.run", runnerProfile: "reviewer-runner" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-reviewer", profiles: ["reviewer-runner"], name: "代码评审执行器" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      runnerId: "runner-reviewer",
      commandId: "command-review-run",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionStatus).toBe("done");
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runners") &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.runnerId ===
            "runner-reviewer" &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.status === "busy"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/commands") &&
          (call.body as { mode?: string } | undefined)?.mode === "execute"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runners") &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.runnerId ===
            "runner-reviewer" &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.status === "idle"
      )
    ).toBe(true);
  });

  it("auto-selects a runner from command contracts and writes run lifecycle events", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, method: init?.method });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-review-run", type: "review.run", name: "发起规则审查" }],
              commandContracts: [{ type: "review.run", runnerProfile: "reviewer-runner" }],
              runtimeAdapters: [
                {
                  commandType: "review.run",
                  runnerProfile: "reviewer-runner",
                  executionMode: "external-shell",
                  commandTemplate: ["forge-review", "--project", "{projectId}"],
                  expectedArtifacts: ["review-report"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-reviewer", profiles: ["reviewer-runner"], status: "idle" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      commandId: "command-review-run",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionStatus).toBe("done");
    expect(result.runnerId).toBe("runner-reviewer");
    expect(result.executionPlan?.command.join(" ")).toContain("forge-review");
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          typeof (call.body as { title?: string } | undefined)?.title === "string"
      )
    ).toBe(true);
    expect(calls[0]?.url).toContain("/api/forge/commands");
    expect(calls[1]?.url).toContain("/api/forge/runners");
  });

  it("resolves a remediation entry before replaying through runner cli", async () => {
    const calls = [];

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, method: init?.method });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-gate-run", type: "gate.run", name: "发起测试门禁" }],
              commandContracts: [{ type: "gate.run", runnerProfile: "qa-runner" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-browser-qa", profiles: ["qa-runner"], name: "浏览器验证执行器" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/remediations/retry")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done", commandId: "command-gate-run" }
            }
          }),
          { status: 200 }
        );
      }

      if (url.includes("/api/forge/remediations")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "task-retail-playwright",
                  kind: "task",
                  retryCommandId: "command-gate-run",
                  retryApiPath: "/api/forge/tasks/retry"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners")) {
        return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
          status: 200
        });
      }

      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    });

    const result = await executeRunnerCommand({
      remediationId: "task-retail-playwright",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionStatus).toBe("done");
    expect(
      calls.some((call) => call.url.includes("/api/forge/remediations?projectId=retail-support"))
    ).toBe(true);
    expect(calls.some((call) => call.url.endsWith("/api/forge/remediations/retry"))).toBe(true);
  });

  it("injects linked component ids when replaying a task through runner cli", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, method: init?.method });

      if (url.endsWith("/api/forge/tasks?projectId=retail-support")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "task-retail-playwright",
                  retryCommandId: "command-execution-start",
                  taskPackId: "artifact-taskpack-retail-support",
                  linkedComponentIds: ["component-payment-checkout"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-execution-start", type: "execution.start", name: "启动研发执行" }],
              commandContracts: [{ type: "execution.start", runnerProfile: "engineer-runner" }],
              runtimeAdapters: [
                {
                  commandType: "execution.start",
                  runnerProfile: "engineer-runner",
                  executionMode: "external-shell",
                  commandTemplate: [
                    "node",
                    "{repoRoot}/scripts/forge-engineer-runner.mjs",
                    "--project-id",
                    "{projectId}",
                    "--workspace",
                    "{cwd}",
                    "--taskpack-id",
                    "{taskPackId}",
                    "--component-ids",
                    "{componentIds}"
                  ],
                  expectedArtifacts: ["patch", "demo-build"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-local-main", profiles: ["engineer-runner"], workspacePath: "/tmp/forge/workspace" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      taskId: "task-retail-playwright",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionPlan?.command.join(" ")).toContain(
      "--component-ids component-payment-checkout"
    );
    expect(result.resolvedInputs?.componentIds).toBe("component-payment-checkout");
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          Array.isArray((call.body as { linkedComponentIds?: string[] } | undefined)?.linkedComponentIds) &&
          (call.body as { linkedComponentIds?: string[] } | undefined)?.linkedComponentIds?.includes(
            "component-payment-checkout"
          )
      )
    ).toBe(true);
  });

  it("injects the latest task pack id into the engineer execution plan", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-execution-start", type: "execution.start", name: "启动研发执行" }],
              commandContracts: [{ type: "execution.start", runnerProfile: "engineer-runner" }],
              runtimeAdapters: [
                {
                  commandType: "execution.start",
                  runnerProfile: "engineer-runner",
                  executionMode: "external-shell",
                  commandTemplate: [
                    "node",
                    "{repoRoot}/scripts/forge-engineer-runner.mjs",
                    "--project-id",
                    "{projectId}",
                    "--workspace",
                    "{cwd}",
                    "--taskpack-id",
                    "{taskPackId}",
                    "--component-ids",
                    "{componentIds}"
                  ],
                  expectedArtifacts: ["patch", "demo-build"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-local-main", profiles: ["engineer-runner"], workspacePath: "/tmp/forge/workspace" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/snapshot")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              artifacts: [
                {
                  id: "artifact-taskpack-retail-support",
                  projectId: "retail-support",
                  type: "task-pack",
                  status: "ready",
                  updatedAt: "刚刚"
                }
              ],
              projectAssetLinks: [
                {
                  id: "link-retail-component-payment",
                  projectId: "retail-support",
                  targetType: "component",
                  targetId: "component-payment-checkout"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      commandId: "command-execution-start",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionPlan?.command.join(" ")).toContain(
      "--taskpack-id artifact-taskpack-retail-support"
    );
    expect(result.executionPlan?.command.join(" ")).toContain(
      "--component-ids component-payment-checkout"
    );
    expect(result.resolvedInputs?.taskPackId).toBe("artifact-taskpack-retail-support");
    expect(result.resolvedInputs?.componentIds).toBe("component-payment-checkout");
  });

  it("passes through an explicit task pack id to command execution", async () => {
    const calls = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-execution-start", type: "execution.start", name: "启动研发执行" }],
              commandContracts: [{ type: "execution.start", runnerProfile: "engineer-runner" }],
              runtimeAdapters: [
                {
                  commandType: "execution.start",
                  runnerProfile: "engineer-runner",
                  executionMode: "external-shell",
                  commandTemplate: [
                    "node",
                    "{repoRoot}/scripts/forge-engineer-runner.mjs",
                    "--project-id",
                    "{projectId}",
                    "--workspace",
                    "{cwd}",
                    "--taskpack-id",
                    "{taskPackId}"
                  ],
                  expectedArtifacts: ["patch", "demo-build"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-local-main", profiles: ["engineer-runner"], workspacePath: "/tmp/forge/workspace" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runs")) {
        return new Response(JSON.stringify({ ok: true, data: { run: { state: "done" } } }), {
          status: 200
        });
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done", taskPackId: "artifact-taskpack-explicit" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      commandId: "command-execution-start",
      projectId: "retail-support",
      taskPackId: "artifact-taskpack-explicit",
      baseUrl: "http://127.0.0.1:3000"
    });

    const commandCall = calls.find(
      (call) => call.url.endsWith("/api/forge/commands") && call.init?.method === "POST"
    );
    const payload = JSON.parse(String(commandCall?.init?.body));

    expect(result.resolvedInputs?.taskPackId).toBe("artifact-taskpack-explicit");
    expect(payload.taskPackId).toBe("artifact-taskpack-explicit");
  });

  it("surfaces a clear error when the local forge api is unavailable", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    await expect(
      executeRunnerCommand({
        commandId: "command-review-run",
        projectId: "retail-support",
        baseUrl: "http://127.0.0.1:3000"
      })
    ).rejects.toThrow(/Forge 本地 API 不可用/);
  });

  it("can execute the runtime plan before recording forge command results", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const executedPlans: Array<{ command: string[]; cwd: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-gate-run", type: "gate.run", name: "发起测试门禁" }],
              commandContracts: [{ type: "gate.run", runnerProfile: "qa-runner" }],
              runtimeAdapters: [
                {
                  commandType: "gate.run",
                  runnerProfile: "qa-runner",
                  executionMode: "external-shell",
                  commandTemplate: [
                    "node",
                    "{repoRoot}/scripts/forge-qa-runner.mjs",
                    "--project-id",
                    "{projectId}",
                    "--workspace",
                    "{cwd}",
                    "--strict-playwright",
                    "--execute-if-ready"
                  ],
                  expectedArtifacts: ["test-report", "playwright-run"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "runner-browser-qa",
                  profiles: ["qa-runner"],
                  name: "浏览器验证执行器",
                  workspacePath: "/tmp/forge/workspace"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand(
      {
        commandId: "command-gate-run",
        projectId: "retail-support",
        baseUrl: "http://127.0.0.1:3000",
        executePlan: true
      },
      {
        executeExternalPlan: async (plan) => {
          executedPlans.push({ command: plan.command, cwd: plan.cwd });
          return {
            ok: true,
            exitCode: 0,
            summary: "QA 本地执行器完成。",
            data: {
              mode: "playwright-ready",
              summary: "已检测到 Playwright，可继续执行浏览器门禁。",
              checks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
            }
          };
        }
      }
    );

    expect(result.executionStatus).toBe("done");
    expect(result.planExecution?.status).toBe("succeeded");
    expect(result.planExecution?.mode).toBe("playwright-ready");
    expect(result.planExecution?.evidenceStatus).toBe("tool-ready");
    expect(result.planExecution?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "evidence", status: "tool-ready" }),
        expect.objectContaining({ name: "playwright", status: "pass", summary: "Version 1.55.0" })
      ])
    );
    expect(executedPlans[0]?.command.join(" ")).toContain("forge-qa-runner.mjs");
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          (call.body as { outputSummary?: string } | undefined)?.outputSummary?.includes(
            "已检测到 Playwright，可继续执行浏览器门禁。"
          )
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          Array.isArray((call.body as { outputChecks?: unknown[] } | undefined)?.outputChecks) &&
          ((call.body as { outputChecks?: Array<{ summary?: string }> } | undefined)?.outputChecks?.[0]
            ?.summary === "Version 1.55.0")
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/commands") &&
          (call.body as { extraNotes?: string } | undefined)?.extraNotes?.includes(
            "Runtime:playwright-ready"
          ) &&
          (call.body as { extraNotes?: string } | undefined)?.extraNotes?.includes(
            "playwright=pass"
          ) &&
          (call.body as { extraNotes?: string } | undefined)?.extraNotes?.includes(
            "Version 1.55.0"
          ) &&
          (call.body as { extraNotes?: string } | undefined)?.extraNotes?.includes(
            "已检测到 Playwright，可继续执行浏览器门禁。"
          )
      )
    ).toBe(true);
    expect(calls.some((call) => call.url.endsWith("/api/forge/runs"))).toBe(true);
  });

  it("preserves executed QA evidence when the external plan actually runs", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-gate-run", type: "gate.run", name: "发起测试门禁" }],
              commandContracts: [{ type: "gate.run", runnerProfile: "qa-runner" }],
              runtimeAdapters: [
                {
                  commandType: "gate.run",
                  runnerProfile: "qa-runner",
                  executionMode: "external-shell",
                  commandTemplate: [
                    "node",
                    "{repoRoot}/scripts/forge-qa-runner.mjs",
                    "--project-id",
                    "{projectId}",
                    "--workspace",
                    "{cwd}",
                    "--strict-playwright",
                    "--execute-if-ready"
                  ],
                  expectedArtifacts: ["test-report", "playwright-run"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "runner-browser-qa",
                  profiles: ["qa-runner"],
                  name: "浏览器验证执行器",
                  workspacePath: "/tmp/forge/workspace"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              execution: { status: "done" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand(
      {
        commandId: "command-gate-run",
        projectId: "retail-support",
        baseUrl: "http://127.0.0.1:3000",
        executePlan: true
      },
      {
        executeExternalPlan: async () => ({
          ok: true,
          exitCode: 0,
          summary: "QA 本地执行器已执行。",
          data: {
            mode: "playwright-executed",
            evidenceStatus: "executed",
            evidenceLabel: "已执行",
            executedCommand: "node -e process.stdout.write('qa')",
            summary: "已执行 node -e process.stdout.write('qa')，浏览器门禁已完成。",
            checks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
          }
        })
      }
    );

    expect(result.executionStatus).toBe("done");
    expect(result.planExecution?.status).toBe("succeeded");
    expect(result.planExecution?.mode).toBe("playwright-executed");
    expect(result.planExecution?.evidenceStatus).toBe("executed");
    expect(result.planExecution?.evidenceLabel).toBe("已执行");
    expect(result.planExecution?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "evidence", status: "executed" }),
        expect.objectContaining({ name: "playwright", status: "pass", summary: "Version 1.55.0" })
      ])
    );
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          Array.isArray((call.body as { outputChecks?: unknown[] } | undefined)?.outputChecks) &&
          (
            (call.body as { outputChecks?: Array<{ name?: string; status?: string }> } | undefined)?.outputChecks ??
            []
          ).some((check) => check.name === "evidence" && check.status === "executed")
      )
    ).toBe(true);
  });

  it("preserves normalized evidence state when external execution plan fails", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, method: init?.method });

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-review-run", type: "review.run", name: "发起规则审查" }],
              commandContracts: [{ type: "review.run", runnerProfile: "reviewer-runner" }],
              runtimeAdapters: [
                {
                  commandType: "review.run",
                  runnerProfile: "reviewer-runner",
                  executionMode: "external-shell",
                  commandTemplate: ["node", "{repoRoot}/scripts/forge-review-runner.mjs", "--project-id", "{projectId}"],
                  expectedArtifacts: ["review-report"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "runner-reviewer",
                  profiles: ["reviewer-runner"],
                  name: "代码评审执行器",
                  workspacePath: "/tmp/forge/workspace"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "blocked" } } }), {
        status: 200
      });
    }) as typeof fetch;

    await expect(
      executeRunnerCommand(
        {
          commandId: "command-review-run",
          projectId: "retail-support",
          baseUrl: "http://127.0.0.1:3000",
          executePlan: true
        },
        {
          executeExternalPlan: async () => ({
            ok: false,
            exitCode: 1,
            summary: "外部审查执行失败。",
            data: {
              mode: "contract-review",
              evidenceStatus: "contract",
              evidenceLabel: "合同模式",
              checks: [{ name: "review-policy", status: "pass", summary: "基础规则审查策略已加载" }]
            }
          })
        }
      )
    ).rejects.toThrow("外部审查执行失败。");

    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          (call.body as { outputMode?: string } | undefined)?.outputMode === "contract-review"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runs") &&
          Array.isArray((call.body as { outputChecks?: unknown[] } | undefined)?.outputChecks) &&
          ((call.body as { outputChecks?: Array<{ name?: string; status?: string }> } | undefined)?.outputChecks ?? [])
            .some((check) => check.name === "evidence" && check.status === "contract")
      )
    ).toBe(true);
  });

  it("can replay a remediation task through the local runner", async () => {
    const calls: Array<{ url: string; body?: unknown; method?: string }> = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body, method: init?.method });

      if (url.includes("/api/forge/tasks?") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "task-retail-playwright",
                  projectId: "retail-support",
                  title: "补齐 Playwright 回归",
                  retryCommandId: "command-gate-run"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/commands") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              commands: [{ id: "command-gate-run", type: "gate.run", name: "发起测试门禁" }],
              commandContracts: [{ type: "gate.run", runnerProfile: "qa-runner" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/runners") && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [{ id: "runner-browser-qa", profiles: ["qa-runner"], name: "浏览器验证执行器" }]
            }
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/forge/tasks/retry")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              taskId: "task-retail-playwright",
              execution: { status: "done", summary: "整改任务已重新触发。" }
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, data: { runner: { status: "idle" } } }), {
        status: 200
      });
    }) as typeof fetch;

    const result = await executeRunnerCommand({
      taskId: "task-retail-playwright",
      projectId: "retail-support",
      baseUrl: "http://127.0.0.1:3000"
    });

    expect(result.executionStatus).toBe("done");
    expect(result.runnerId).toBe("runner-browser-qa");
    expect(result.commandId).toBe("command-gate-run");
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/tasks/retry") &&
          (call.body as { taskId?: string } | undefined)?.taskId === "task-retail-playwright"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runners") &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.runnerId ===
            "runner-browser-qa" &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.status === "busy"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.endsWith("/api/forge/runners") &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.runnerId ===
            "runner-browser-qa" &&
          (call.body as { runnerId?: string; status?: string } | undefined)?.status === "idle"
      )
    ).toBe(true);
  });
});
