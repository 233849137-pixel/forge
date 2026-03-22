"use client";

import Link from "next/link";
import React, { useState } from "react";
import type { ForgePrimaryView } from "../lib/forge-views";
import { forgeNavigationItems } from "../lib/forge-views";
import type { Tone } from "./forge-console-utils";
import projectStyles from "./forge-projects-page.module.css";
import styles from "./forge-console-shell.module.css";
import ForgeSystemSettings from "./forge-system-settings";

type SidebarSectionItem = {
  icon?: string;
  title: string;
  meta?: string;
  badge?: string;
  tone?: Tone;
  href?: string;
  active?: boolean;
  onSelect?: () => void;
};

type SidebarSection = {
  label: string;
  action?: React.ReactNode;
  items: SidebarSectionItem[];
};

const navIconMap: Record<ForgePrimaryView, string> = {
  home: "◫",
  projects: "▣",
  team: "◎",
  artifacts: "◧",
  execution: "▷",
  assets: "◈",
  governance: "◌"
};

const toneClassName: Record<Tone, string> = {
  neutral: styles.badgeNeutral,
  good: styles.badgeGood,
  warn: styles.badgeWarn,
  risk: styles.badgeRisk,
  info: styles.badgeInfo
};

export function getToneBadgeClassName(tone: Tone = "neutral") {
  return `${styles.badge} ${toneClassName[tone]}`;
}

type ForgeConsoleShellProps = {
  activeView: ForgePrimaryView;
  sidebarTitle: string;
  sidebarDescription?: string;
  breadcrumb: string[];
  sidebarAction?: React.ReactNode;
  sidebarSections?: SidebarSection[];
  sidebarFooter?: {
    label: string;
    title: string;
    body: string;
  };
  headerActions?: React.ReactNode;
  hideHeader?: boolean;
  children: React.ReactNode;
  showNavigation?: boolean;
  sidebarCollapsible?: boolean;
  defaultSidebarCollapsed?: boolean;
  contentLayout?: "default" | "full-bleed";
};

export default function ForgeConsoleShell({
  activeView,
  sidebarTitle,
  sidebarDescription,
  breadcrumb,
  sidebarAction,
  sidebarSections = [],
  sidebarFooter,
  headerActions,
  hideHeader = false,
  children,
  showNavigation = false,
  sidebarCollapsible = showNavigation,
  defaultSidebarCollapsed = false,
  contentLayout = "default"
}: ForgeConsoleShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isCeoChatOpen, setIsCeoChatOpen] = useState(false);
  const [ceoPrompt, setCeoPrompt] = useState("");
  const [isCeoChatSending, setIsCeoChatSending] = useState(false);
  const [ceoChatError, setCeoChatError] = useState<string | null>(null);
  const [ceoMessages, setCeoMessages] = useState<
    Array<{ id: string; role: "human" | "ai"; text: string }>
  >([
    {
      id: "ceo-welcome",
      role: "ai",
      text: "我是 CEO 视角助手。你可以直接问我：项目优先级、当前卡点、谁该接棒、资源怎么调配。"
    }
  ]);
  const activeNavigationItem = forgeNavigationItems.find((item) => item.view === activeView);
  const resolvedSidebarTitle =
    activeNavigationItem?.label ??
    (sidebarTitle === "Forge" ? breadcrumb.at(-1) ?? sidebarTitle : sidebarTitle);
  const sidebarDisplayTitle = `Forge · ${resolvedSidebarTitle}`;
  const shellClassName = showNavigation
    ? `${styles.shell} ${styles.shellWithSidebar} ${
        isSidebarCollapsed ? styles.shellWithSidebarCollapsed : ""
      }`
    : styles.shell;

  const renderPrimaryNavLink = (item: (typeof forgeNavigationItems)[number]) => {
    const isActive = item.view === activeView;

    return (
      <Link
        aria-current={isActive ? "page" : undefined}
        aria-label={item.label}
        className={`${styles.iconNavItem} ${isActive ? styles.iconNavItemActive : ""}`}
        href={item.href}
        key={item.view}
        title={item.label}
      >
        <span aria-hidden="true" className={styles.iconGlyph}>
          {navIconMap[item.view]}
        </span>
        <span className={styles.srOnly}>{item.label}</span>
      </Link>
    );
  };

  const handleSendCeoMessage = async () => {
    const prompt = ceoPrompt.trim();
    if (!prompt || isCeoChatSending) {
      return;
    }

    const now = Date.now();
    setCeoChatError(null);
    setCeoPrompt("");
    setIsCeoChatSending(true);
    setCeoMessages((current) => [
      ...current,
      { id: `human-${now}`, role: "human", text: prompt },
      { id: `ai-pending-${now}`, role: "ai", text: "CEO 正在整理判断..." }
    ]);

    try {
      const response = await fetch("/api/forge/ceo-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          scope: "portfolio",
          triggeredBy: `Forge · ${resolvedSidebarTitle} · CEO 对话`
        })
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data?: {
              reply?: string;
            };
          }
        | {
            ok: false;
            error?: {
              message?: string;
            };
          };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "CEO 对话失败" : payload.error?.message || "CEO 对话失败");
      }

      const reply = payload.data?.reply?.trim() || "CEO 暂时没有新的判断。";
      setCeoMessages((current) =>
        current.map((item) =>
          item.id === `ai-pending-${now}` ? { ...item, text: reply } : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "CEO 对话失败";
      setCeoChatError(message);
      setCeoMessages((current) =>
        current.map((item) =>
          item.id === `ai-pending-${now}` ? { ...item, text: message } : item
        )
      );
    } finally {
      setIsCeoChatSending(false);
    }
  };

  const handleCeoPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleSendCeoMessage();
  };

  return (
    <div className={shellClassName}>
      {showNavigation ? (
        <>
          <aside
            className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ""}`}
          >
            <div className={styles.sidebarBrand}>
              <div className={styles.sidebarBrandRow}>
                <div className={styles.sidebarTopLeft}>
                  {isSidebarCollapsed ? null : <h2>{sidebarDisplayTitle}</h2>}
                  <nav aria-label="主模块" className={styles.iconNav}>
                    {forgeNavigationItems.map((item) => renderPrimaryNavLink(item))}
                  </nav>
                </div>
                {sidebarCollapsible ? null : <span className={styles.searchButton}>⌕</span>}
              </div>
              {!isSidebarCollapsed && sidebarDescription ? <p>{sidebarDescription}</p> : null}
            </div>

            {!isSidebarCollapsed ? sidebarAction ?? null : null}

            {!isSidebarCollapsed
              ? sidebarSections.map((section) => (
                  <section
                    aria-label={section.label}
                    className={styles.sidebarSection}
                    key={section.label}
                    role="region"
                  >
                    <p className={styles.sidebarLabel}>{section.label}</p>
                    {section.action ? (
                      <div className={styles.sidebarSectionAction}>{section.action}</div>
                    ) : null}
                    <div className={styles.sidebarList}>
                      {section.items.map((item) => {
                        const className = `${styles.sidebarListItem} ${
                          item.active ? styles.sidebarListItemActive : ""
                        }`;
                        const body = (
                          <>
                            <span className={styles.sidebarListLead}>
                              {item.icon ? (
                                <span aria-hidden="true" className={styles.sidebarListIcon}>
                                  {item.icon}
                                </span>
                              ) : null}
                              <span className={styles.sidebarListPrimary}>
                                <strong>{item.title}</strong>
                                {item.meta ? <small>{item.meta}</small> : null}
                              </span>
                            </span>
                            {item.badge ? (
                              <span className={getToneBadgeClassName(item.tone)}>{item.badge}</span>
                            ) : null}
                          </>
                        );

                        if (item.href) {
                          return (
                            <Link
                              className={className}
                              href={item.href}
                              key={`${section.label}-${item.title}`}
                            >
                              {body}
                            </Link>
                          );
                        }

                        if (item.onSelect) {
                          return (
                            <button
                              aria-pressed={item.active}
                              className={`${className} ${styles.sidebarListButton}`}
                              key={`${section.label}-${item.title}`}
                              onClick={item.onSelect}
                              type="button"
                            >
                              {body}
                            </button>
                          );
                        }

                        return (
                          <div className={className} key={`${section.label}-${item.title}`}>
                            {body}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              : null}

            {!isSidebarCollapsed && sidebarFooter ? (
              <section className={styles.sidebarFoot}>
                <p className={styles.sidebarLabel}>{sidebarFooter.label}</p>
                <strong>{sidebarFooter.title}</strong>
                <p>{sidebarFooter.body}</p>
              </section>
            ) : null}

          </aside>
          {sidebarCollapsible ? (
            <button
              aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              className={`${styles.sidebarRailToggle} ${
                isSidebarCollapsed ? styles.sidebarRailToggleCollapsed : ""
              }`}
              data-testid="sidebar-rail-toggle"
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              type="button"
            >
              {isSidebarCollapsed ? "›" : "‹"}
            </button>
          ) : null}
        </>
      ) : null}

      <main
        className={`${styles.main} ${
          contentLayout === "full-bleed" ? styles.mainFullBleed : ""
        }`}
        data-content-layout={contentLayout}
      >
        {hideHeader ? null : (
          <header className={styles.mainHeader}>
            <div className={styles.breadcrumb}>
              {breadcrumb.map((item, index) => (
                <React.Fragment key={`${item}-${index}`}>
                  {index > 0 ? <span>/</span> : null}
                  {index === breadcrumb.length - 1 ? <strong>{item}</strong> : <span>{item}</span>}
                </React.Fragment>
              ))}
            </div>
            <div className={styles.buttonRow}>{headerActions}</div>
          </header>
        )}

        <div
          className={`${styles.pageStack} ${
            contentLayout === "full-bleed" ? styles.pageStackFullBleed : ""
          }`}
        >
          {children}
        </div>
      </main>
      <button
        aria-label="系统设置"
        className={`${styles.systemSettingsDock} ${
          showNavigation
            ? isSidebarCollapsed
              ? styles.systemSettingsDockCollapsed
              : styles.systemSettingsDockSidebar
            : ""
        }`}
        onClick={() => setIsSystemSettingsOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className={styles.sidebarUtilityIcon}>
          ⚙
        </span>
        <span className={styles.systemSettingsDockLabel}>系统设置</span>
      </button>
      <ForgeSystemSettings
        onClose={() => setIsSystemSettingsOpen(false)}
        open={isSystemSettingsOpen}
      />
      <button
        aria-expanded={isCeoChatOpen}
        aria-label="打开 CEO 对话"
        className={styles.ceoChatDock}
        onClick={() => setIsCeoChatOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true" className={styles.ceoChatDockIcon}>
          🦞
        </span>
      </button>
      {isCeoChatOpen ? (
        <aside
          aria-label="CEO 对话"
          aria-modal="false"
          className={styles.ceoChatDrawer}
          role="dialog"
        >
          <div className={styles.ceoChatDrawerHeader}>
            <div>
              <span className={styles.ceoChatEyebrow}>OpenClaw</span>
              <strong>CEO 对话</strong>
            </div>
            <button
              aria-label="关闭 CEO 对话"
              className={styles.ceoChatClose}
              onClick={() => setIsCeoChatOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <div className={styles.ceoChatMessages}>
            {ceoMessages.map((message) => (
              <div
                className={`${styles.ceoChatBubble} ${
                  message.role === "human" ? styles.ceoChatBubbleHuman : styles.ceoChatBubbleAi
                }`}
                key={message.id}
              >
                {message.text}
              </div>
            ))}
          </div>
          {ceoChatError ? <p className={styles.ceoChatError}>{ceoChatError}</p> : null}
          <div className={projectStyles.composer}>
            <div className={projectStyles.composerShell}>
              <textarea
                aria-label="继续输入内容"
                className={projectStyles.composerTextarea}
                onChange={(event) => setCeoPrompt(event.target.value)}
                onKeyDown={handleCeoPromptKeyDown}
                placeholder="直接问 CEO：现在最该推进哪个项目，谁该接棒，哪里有风险？"
                rows={3}
                value={ceoPrompt}
              />
              <div className={projectStyles.composerToolbar}>
                <div className={projectStyles.composerToolbarLeft}>
                  <span className={styles.ceoChatScope}>组合视角</span>
                </div>
                <div className={projectStyles.composerToolbarRight}>
                  <button
                    className={projectStyles.composerSendButton}
                    disabled={isCeoChatSending || !ceoPrompt.trim()}
                    onClick={handleSendCeoMessage}
                    type="button"
                  >
                    {isCeoChatSending ? "发送中..." : "发送"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
