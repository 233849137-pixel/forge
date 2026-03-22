import { describe, expect, it } from "vitest";
import { forgeCommandContracts, getForgeCommandContract } from "../packages/core/src";

describe("forge command contracts", () => {
  it("defines the delivery chain as formal command contracts", () => {
    expect(forgeCommandContracts).toHaveLength(8);
    expect(getForgeCommandContract("prd.generate")?.runnerProfile).toBe("pm-orchestrator");
    expect(getForgeCommandContract("taskpack.generate")?.outputArtifacts).toContain("task-pack");
    expect(getForgeCommandContract("component.assemble")?.runnerProfile).toBe("architect-runner");
    expect(getForgeCommandContract("component.assemble")?.inputArtifacts).toContain("task-pack");
    expect(getForgeCommandContract("component.assemble")?.outputArtifacts).toContain("assembly-plan");
    expect(getForgeCommandContract("execution.start")?.runnerProfile).toBe("engineer-runner");
    expect(getForgeCommandContract("review.run")?.inputArtifacts).toEqual(
      expect.arrayContaining(["patch", "demo-build"])
    );
    expect(getForgeCommandContract("review.run")?.outputArtifacts).toContain("review-report");
    expect(getForgeCommandContract("gate.run")?.inputArtifacts).toEqual(
      expect.arrayContaining(["demo-build", "review-report"])
    );
    expect(getForgeCommandContract("release.prepare")?.outputArtifacts).toEqual(
      expect.arrayContaining(["release-brief", "review-decision"])
    );
    expect(getForgeCommandContract("archive.capture")?.outputArtifacts).toEqual(
      expect.arrayContaining(["knowledge-card", "release-audit"])
    );
  });
});
