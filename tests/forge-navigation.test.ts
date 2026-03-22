import { describe, expect, it } from "vitest";
import { forgeNavigationItems } from "../src/lib/forge-views";

describe("forge navigation", () => {
  it("uses the new human-facing top-level modules", () => {
    expect(forgeNavigationItems.map((item) => item.label)).toEqual([
      "仪表盘",
      "项目管理",
      "AI员工",
      "资产管理"
    ]);

    expect(forgeNavigationItems.map((item) => item.label)).not.toContain("工作台");
    expect(forgeNavigationItems.map((item) => item.label)).not.toContain("执行");
    expect(forgeNavigationItems.map((item) => item.label)).not.toContain("命令中心");
  });
});
