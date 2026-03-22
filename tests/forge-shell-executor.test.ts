import { describe, expect, it } from "vitest";
import { executeShellPlan } from "../scripts/lib/forge-shell-executor.mjs";

describe("forge shell executor", () => {
  it("runs a local shell plan and captures stdout", async () => {
    const result = await executeShellPlan({
      mode: "external-shell",
      cwd: process.cwd(),
      command: ["/bin/sh", "-lc", "printf 'plan-ok'"],
      expectedArtifacts: []
    });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.summary).toContain("plan-ok");
  });

  it("parses JSON stdout and prefers the structured summary", async () => {
    const result = await executeShellPlan({
      mode: "external-shell",
      cwd: process.cwd(),
      command: [
        "/bin/sh",
        "-lc",
        "printf '{\"ok\":true,\"mode\":\"playwright-ready\",\"summary\":\"QA runner passed\",\"checks\":[{\"name\":\"workspace\",\"status\":\"pass\"}]}'"
      ],
      expectedArtifacts: []
    });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("QA runner passed");
    expect(result.data).toMatchObject({
      mode: "playwright-ready",
      checks: [{ name: "workspace", status: "pass" }]
    });
  });

  it("returns a failed result when the executable is missing", async () => {
    const result = await executeShellPlan({
      mode: "external-shell",
      cwd: process.cwd(),
      command: ["/definitely-missing-binary", "--version"],
      expectedArtifacts: []
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("无法启动");
  });
});
