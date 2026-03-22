"use client";

import React from "react";
import { useEffect, useState } from "react";
import type { ForgeExternalComponentCandidate } from "../../packages/core/src/types";
import { SummaryList } from "./forge-os-shared";

type ExternalSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  warning: string | null;
  items: ForgeExternalComponentCandidate[];
};

export default function ExternalComponentSearchBridge({
  projectId,
  taskPackId
}: {
  projectId?: string | null;
  taskPackId?: string | null;
}) {
  const [state, setState] = useState<ExternalSearchState>({
    status: process.env.NODE_ENV === "test" ? "ready" : "idle",
    warning: process.env.NODE_ENV === "test" ? "测试环境下跳过 GitHub 候选搜索。" : null,
    items: []
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const resolvedProjectId = projectId ?? "";

    if (!resolvedProjectId) {
      setState({
        status: "error",
        warning: "当前没有激活项目，无法搜索外部候选资源。",
        items: []
      });
      return;
    }

    let cancelled = false;

    async function load() {
      setState((previous) => ({ ...previous, status: "loading", warning: null }));

      try {
        const searchParams = new URLSearchParams();

        searchParams.set("projectId", resolvedProjectId);

        if (taskPackId) {
          searchParams.set("taskPackId", taskPackId);
        }

        searchParams.set("maxItems", "4");

        const response = await fetch(`/api/forge/components/search?${searchParams.toString()}`);
        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            warning?: string | null;
            items?: ForgeExternalComponentCandidate[];
          };
          error?: {
            message?: string;
          };
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message || "外部候选资源搜索失败。");
        }

        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          warning: payload.data?.warning ?? null,
          items: payload.data?.items ?? []
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          warning: error instanceof Error ? error.message : "外部候选资源搜索失败。",
          items: []
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, taskPackId]);

  if (state.status === "loading") {
    return (
      <SummaryList
        items={[{ label: "正在搜索 GitHub 候选资源", value: "根据当前项目和 TaskPack 拉取外部候选仓库。" }]}
      />
    );
  }

  if (state.items.length === 0) {
    return (
      <SummaryList
        items={[
          {
            label: state.status === "error" ? "外部候选资源暂不可用" : "暂无外部候选资源",
            value: state.warning ?? "当前没有可展示的 GitHub 候选仓库。"
          }
        ]}
      />
    );
  }

  return (
    <SummaryList
      items={state.items.map((item) => ({
        label: `${item.repoFullName} · ${item.maturity}`,
        value: `${item.summary} · stars ${item.stars}${item.language ? ` · ${item.language}` : ""} · ${item.recommendationReason}`
      }))}
    />
  );
}
