import React from "react";
import { forgeNavigationItems, type ForgePrimaryView } from "../lib/forge-views";

type ForgeChromeMetric = {
  label: string;
  value: string | number;
};

export default function ForgeChrome({
  view,
  eyebrow,
  title,
  description,
  metrics,
  children,
  showNavigation = false,
  footLabel = "系统说明",
  footText = "人看项目，AI 做协作，资产做沉淀。前台只保留推进决策需要的信息。"
}: {
  view: ForgePrimaryView;
  eyebrow: string;
  title: string;
  description: string;
  metrics: ForgeChromeMetric[];
  children: React.ReactNode;
  showNavigation?: boolean;
  footLabel?: string;
  footText?: string;
}) {
  return (
    <main className="forge-shell">
      {showNavigation ? (
        <aside className="nav-rail">
          <div className="brand">
            <span className="brand-label">Forge Delivery OS</span>
            <h1>Forge</h1>
            <p>本地优先 AI 研发交付系统</p>
          </div>

          <div className="nav-block">
            <p className="nav-title">主模块</p>
            <nav className="nav">
              {forgeNavigationItems.map((item, index) => (
                <a
                  key={item.view}
                  href={item.href}
                  className={`nav-item ${item.view === view ? "active" : ""}`.trim()}
                >
                  <span>{item.label}</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </a>
              ))}
            </nav>
          </div>

          <section className="side-card" aria-label="系统提示">
            <h3>{footLabel}</h3>
            <p>{footText}</p>
          </section>
        </aside>
      ) : null}

      <section className="main-grid">
        <div className="chrome-topbar">
          <div className="search">
            <span>搜索</span>
            <strong>项目、任务、交付物</strong>
          </div>

          <div className="filter-row" aria-label="全局筛选">
            <span className="chip active">全部项目</span>
            <span className="chip">关注项目</span>
            <span className="chip">异常项目</span>
          </div>

          <div className="top-actions">
            <button className="secondary" type="button">
              筛选
            </button>
            <button className="primary" type="button">
              新建项目
            </button>
          </div>
        </div>

        <header className="hero-card dashboard-hero">
          <div className="hero-copy-block">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p className="hero-copy">{description}</p>
          </div>

          <div className="hero-metrics hero-metrics-grid">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <p className="metric-label">{metric.label}</p>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </header>

        <div className="chrome-content">{children}</div>
      </section>
    </main>
  );
}
