import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgeExecutionPageData } from "../src/lib/forge-execution-page-data";
import ForgeExecutionPageBridge from "../src/components/forge-execution-page-bridge";
import { dispatchForgePageContractRefresh } from "../src/lib/forge-page-refresh-events";

function createExecutionPageData(externalExecutionSummary: string): ForgeExecutionPageData {
  return {
    metrics: {
      totalRuns: 1,
      runningRuns: 0,
      blockedRuns: 0
    },
    focus: {
      badge: "Reviewer",
      items: [
        { label: "当前任务", value: "执行退款失败补丁规则审查" },
        { label: "执行器", value: "Reviewer" },
        { label: "状态", value: "已完成" },
        { label: "模型执行器", value: "Claude Code Review" }
      ]
    },
    blockers: {
      badge: "0 项",
      items: [{ label: "当前状态", value: "没有执行阻塞，可以继续推进。" }]
    },
    taskQueue: {
      badge: "0 项",
      items: [{ label: "当前状态", value: "没有待处理执行任务，可以继续推进后续交付。" }]
    },
    evidence: {
      badge: "1 类",
      items: [{ label: "外部模型执行器", value: "Claude Code Review" }]
    },
    remediation: {
      badge: "0 项",
      items: [{ label: "当前状态", value: "当前没有待回放整改任务。" }]
    },
    runnerRegistry: {
      badge: "0 个",
      items: [{ label: "当前状态", value: "还没有注册本地 Runner。" }]
    },
    runnerProbe: {
      badge: "0 个",
      items: [{ label: "当前状态", value: "还没有 Runner 探测记录。" }]
    },
    failureAttribution: {
      badge: "暂无失败",
      items: [{ label: "当前状态", value: "最近没有新的执行失败，可继续推进。" }]
    },
    timeline: {
      badge: "0 条",
      items: [{ label: "当前状态", value: "还没有执行事件记录。" }]
    },
    runQueue: {
      runs: [],
      projects: [],
      artifacts: [],
      components: []
    },
    localContext: {
      badge: "local-first",
      items: [
        { label: "当前项目", value: "零售客服副驾驶" },
        { label: "外部执行准备度", value: externalExecutionSummary }
      ]
    }
  };
}

describe("forge execution page bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial execution page data without an immediate contract refresh", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: null }), { status: 200 })
    );

    render(
      <ForgeExecutionPageBridge
        initialData={createExecutionPageData("初始外部执行准备度")}
        showNavigation
        enableLiveSync
      />
    );

    expect(screen.getByText(/初始外部执行准备度/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/初始外部执行准备度/i)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refreshes the execution page when a contract refresh event is dispatched", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              view: "execution",
              contractVersion: "2026-03-15.phase-1",
              page: createExecutionPageData("事件刷新后的外部执行准备度")
            }
          }),
          { status: 200 }
        )
      );

    render(
      <ForgeExecutionPageBridge
        initialData={createExecutionPageData("初始外部执行准备度")}
        showNavigation
        enableLiveSync
      />
    );

    dispatchForgePageContractRefresh(["execution"]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/事件刷新后的外部执行准备度/i)).toBeInTheDocument();
    });
  });
});
