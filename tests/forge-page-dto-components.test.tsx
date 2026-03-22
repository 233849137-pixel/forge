import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AgentTeamPage from "../src/components/agent-team-page";
import ForgeArtifactsPage from "../src/components/forge-artifacts-page";
import ForgeAssetsPage from "../src/components/forge-assets-page";
import ForgeExecutionPage from "../src/components/forge-execution-page";
import ForgeGovernancePage from "../src/components/forge-governance-page";
import ForgeHomePage from "../src/components/forge-home-page";
import ForgeProjectsPage from "../src/components/forge-projects-page";
import {
  getForgeArtifactsPageData,
  getForgeAssetsPageData,
  getForgeHomePageData,
  getForgeProjectsPageData,
  getForgeTeamPageData
} from "../src/server/forge-page-dtos";
import { forgeSnapshotFixture } from "./fixtures/forge-snapshot";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

describe("forge page dto components", () => {
  it("renders the home page from page dto input", () => {
    render(<ForgeHomePage data={getForgeHomePageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("region", { name: /项目操盘台/i })).toBeInTheDocument();
  });

  it("renders the projects page from page dto input", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("region", { name: /AI 对话/i })).toBeInTheDocument();
  });

  it("renders the compact employee context action on the projects workbench", () => {
    render(<ForgeProjectsPage data={getForgeProjectsPageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("region", { name: /当前节点摘要/i })).toBeInTheDocument();
    expect(screen.getByText(/^AI 上下文$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /查看 AI 上下文/i })).toBeInTheDocument();
  });

  it("renders the team page from page dto input", () => {
    render(<AgentTeamPage data={getForgeTeamPageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("heading", { name: /团队配置/i })).toBeInTheDocument();
  });

  it("renders the resolved employee context preview on the team runtime panel", () => {
    render(<AgentTeamPage data={getForgeTeamPageData(forgeSnapshotFixture)} showNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /员工管理.*成员与状态/i }));
    fireEvent.click(screen.getByRole("button", { name: /^运行$/i }));

    expect(screen.getByText(/当前上下文预览/i)).toBeInTheDocument();
    expect(screen.getByText(/可用工具/i)).toBeInTheDocument();
    expect(screen.getByText(/工作区路径/i)).toBeInTheDocument();
    expect(screen.getByText(/关键交付物/i)).toBeInTheDocument();
  });

  it("renders the artifacts page from page dto input", () => {
    render(<ForgeArtifactsPage data={getForgeArtifactsPageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("heading", { name: /工件中心/i })).toBeInTheDocument();
  });

  it("renders the assets page from page dto input", () => {
    render(<ForgeAssetsPage data={getForgeAssetsPageData(forgeSnapshotFixture)} showNavigation />);

    expect(screen.getByRole("heading", { name: /资料列表/i })).toBeInTheDocument();
  });

  it("renders the execution page from page dto input", () => {
    render(
      React.createElement(ForgeExecutionPage as any, {
        data: {
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
            items: [
              { label: "当前项目", value: "零售客服副驾驶" },
              { label: "外部执行准备度", value: "已配置 2 条外部模型执行契约。" }
            ]
          }
        },
        showNavigation: true
      })
    );

    expect(screen.getByRole("heading", { name: /执行中枢/i })).toBeInTheDocument();
  });

  it("renders the governance page from page dto input", () => {
    render(
      React.createElement(ForgeGovernancePage as any, {
        data: {
          snapshot: forgeSnapshotFixture,
          externalExecutionSummary: "已配置 2 条外部模型执行契约。",
          executionBackendSummary: "当前外部执行后端为 OpenClaw。",
          bridgeExecutionSummary: "已写回 1 条外部执行桥证据。",
          approvalHandoffSummary: "规则审查已完成，等待产品负责人确认。",
          releaseClosureSummary: "交付说明与放行评审结论已齐备。"
        },
        showNavigation: true
      })
    );

    expect(screen.getByRole("heading", { name: /命令中心/i })).toBeInTheDocument();
  });
});
