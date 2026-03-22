"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  getForgeWorkspaceFileTree,
  type ForgeWorkspaceTreeNode
} from "../lib/forge-workspace-api";
import styles from "./forge-project-workspace-drawer.module.css";

type ForgeProjectWorkspaceDrawerProps = {
  open: boolean;
  projectId: string;
  reloadToken: number;
  selectedFilePath: string | null;
  expandedDirectories: Record<string, boolean>;
  workspaceLabel?: string | null;
  onClose: () => void;
  onCreateDirectory: () => void;
  onCreateMarkdown: () => void;
  onDeleteEntry: (entry: { path: string; name: string; kind: "directory" | "file" }) => void;
  onExpandedDirectoriesChange: (nextState: Record<string, boolean>) => void;
  onOpen: () => void;
  onSelectFile: (path: string) => void;
};

function collectExpandedDirectories(
  nodes: ForgeWorkspaceTreeNode[],
  accumulator: Record<string, boolean> = {}
) {
  nodes.forEach((node) => {
    if (node.kind !== "directory") {
      return;
    }

    accumulator[node.path] = true;
    collectExpandedDirectories(node.children ?? [], accumulator);
  });

  return accumulator;
}

function findPreferredWorkspaceFilePath(nodes: ForgeWorkspaceTreeNode[]): string | null {
  for (const node of nodes) {
    if (node.kind === "file" && node.name.toLowerCase() === "readme.md") {
      return node.path;
    }

    if (node.kind === "directory") {
      const nestedMatch = findPreferredWorkspaceFilePath(node.children ?? []);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  for (const node of nodes) {
    if (node.kind === "file" && [".md", ".mdx"].includes(node.extension ?? "")) {
      return node.path;
    }

    if (node.kind === "directory") {
      const nestedMatch = findPreferredWorkspaceFilePath(node.children ?? []);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  for (const node of nodes) {
    if (node.kind === "file") {
      return node.path;
    }

    if (node.kind === "directory") {
      const nestedMatch = findPreferredWorkspaceFilePath(node.children ?? []);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  return null;
}

function getWorkspaceTreeIconClassName(node: ForgeWorkspaceTreeNode) {
  if (node.kind === "directory") {
    return styles.workspaceTreeIcon;
  }

  if ((node.extension ?? "").toLowerCase() === ".md" || (node.extension ?? "").toLowerCase() === ".mdx") {
    return `${styles.workspaceTreeIcon} ${styles.workspaceTreeMarkdownIcon}`;
  }

  return `${styles.workspaceTreeIcon} ${styles.workspaceTreeFileIcon}`;
}

function getWorkspaceTreeIconLabel(node: ForgeWorkspaceTreeNode) {
  if (node.kind === "directory") {
    return "DIR";
  }

  const extension = (node.extension ?? "").toLowerCase();
  if (extension === ".md" || extension === ".mdx") {
    return "MD";
  }

  if (extension === ".json") {
    return "JS";
  }

  return "TXT";
}

export default function ForgeProjectWorkspaceDrawer({
  open,
  projectId,
  reloadToken,
  selectedFilePath,
  expandedDirectories,
  workspaceLabel,
  onClose,
  onCreateDirectory,
  onCreateMarkdown,
  onDeleteEntry,
  onExpandedDirectoriesChange,
  onOpen,
  onSelectFile
}: ForgeProjectWorkspaceDrawerProps) {
  const [tree, setTree] = useState<ForgeWorkspaceTreeNode[]>([]);
  const [treeStatus, setTreeStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [treeError, setTreeError] = useState("");
  const onSelectFileRef = useRef(onSelectFile);
  const onExpandedDirectoriesChangeRef = useRef(onExpandedDirectoriesChange);

  useEffect(() => {
    onSelectFileRef.current = onSelectFile;
  }, [onSelectFile]);

  useEffect(() => {
    onExpandedDirectoriesChangeRef.current = onExpandedDirectoriesChange;
  }, [onExpandedDirectoriesChange]);

  useEffect(() => {
    setTree([]);
    setTreeStatus("idle");
    setTreeError("");
  }, [projectId, reloadToken, workspaceLabel]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadWorkspaceTree = async () => {
      setTreeStatus("loading");
      setTreeError("");

      try {
        const result = await getForgeWorkspaceFileTree(projectId);

        if (cancelled) {
          return;
        }

        setTree(result.tree);
        if (Object.keys(expandedDirectories).length === 0 && !selectedFilePath) {
          onExpandedDirectoriesChangeRef.current(collectExpandedDirectories(result.tree));
        }
        setTreeStatus("ready");

        const preferredFilePath = findPreferredWorkspaceFilePath(result.tree);

        if (preferredFilePath && !selectedFilePath) {
          onSelectFileRef.current(preferredFilePath);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setTree([]);
        setTreeStatus("error");
        setTreeError(error instanceof Error ? error.message : "工作区文件结构加载失败");
      }
    };

    void loadWorkspaceTree();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, reloadToken, workspaceLabel]);

  const handleToggleDirectory = (path: string) => {
    onExpandedDirectoriesChange({
      ...expandedDirectories,
      [path]: !expandedDirectories[path]
    });
  };

  const renderWorkspaceTree = (nodes: ForgeWorkspaceTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === "directory") {
        const expanded = expandedDirectories[node.path] ?? false;

        return (
          <div className={styles.workspaceTreeItem} key={node.id}>
            <div className={styles.workspaceTreeRow}>
              <button
                aria-expanded={expanded}
                aria-label={node.name}
                className={styles.workspaceTreeButton}
                onClick={() => handleToggleDirectory(node.path)}
                style={{ "--workspace-tree-depth": depth } as React.CSSProperties}
                type="button"
              >
                <span className={styles.workspaceTreeChevron}>{expanded ? "▾" : "▸"}</span>
                <span className={getWorkspaceTreeIconClassName(node)}>{getWorkspaceTreeIconLabel(node)}</span>
                <span className={styles.workspaceTreeName}>{node.name}</span>
              </button>
              <button
                aria-label={`删除 ${node.name}`}
                className={styles.workspaceTreeDeleteButton}
                onClick={() => onDeleteEntry({ path: node.path, name: node.name, kind: "directory" })}
                title={`删除 ${node.name}`}
                type="button"
              >
                ×
              </button>
            </div>
            {expanded && (node.children?.length ?? 0) > 0 ? (
              <div className={styles.workspaceTreeChildren}>{renderWorkspaceTree(node.children ?? [], depth + 1)}</div>
            ) : null}
          </div>
        );
      }

      return (
        <div className={styles.workspaceTreeItem} key={node.id}>
          <div className={styles.workspaceTreeRow}>
            <button
              aria-label={node.name}
              aria-pressed={selectedFilePath === node.path}
              className={`${styles.workspaceTreeButton} ${
                selectedFilePath === node.path ? styles.workspaceTreeButtonActive : ""
              }`}
              onClick={() => {
                onSelectFileRef.current(node.path);
              }}
              style={{ "--workspace-tree-depth": depth } as React.CSSProperties}
              type="button"
            >
              <span className={styles.workspaceTreeChevron}>•</span>
              <span className={getWorkspaceTreeIconClassName(node)}>{getWorkspaceTreeIconLabel(node)}</span>
              <span className={styles.workspaceTreeName}>{node.name}</span>
            </button>
            <button
              aria-label={`删除 ${node.name}`}
              className={styles.workspaceTreeDeleteButton}
              onClick={() => onDeleteEntry({ path: node.path, name: node.name, kind: "file" })}
              title={`删除 ${node.name}`}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      );
    });

  return (
    <div
      className={`${styles.workspaceDrawerHost} ${open ? styles.workspaceDrawerHostOpen : ""}`}
    >
      {!open ? (
        <button
          aria-label="打开工作区文件"
          className={styles.workspaceDrawerToggle}
          onClick={onOpen}
          title="打开工作区文件"
          type="button"
        >
          <span aria-hidden="true" className={styles.workspaceDrawerToggleGlyph}>◂</span>
        </button>
      ) : (
        <section aria-label="工作区文件" className={styles.workspaceDrawer} role="region">
          <header className={styles.workspaceDrawerHeader}>
            <div className={styles.workspaceDrawerHeaderText}>
              <p>工作区文件</p>
            </div>
            <div className={styles.workspaceDrawerHeaderActions}>
              <button
                aria-label="新建 Markdown"
                className={styles.workspaceDrawerActionButton}
                onClick={onCreateMarkdown}
                title="新建 Markdown"
                type="button"
              >
                MD+
              </button>
              <button
                aria-label="新建文件夹"
                className={styles.workspaceDrawerActionButton}
                onClick={onCreateDirectory}
                title="新建文件夹"
                type="button"
              >
                DIR+
              </button>
              <button
                aria-label="收起工作区文件"
                className={styles.workspaceDrawerCloseButton}
                onClick={onClose}
                title="收起工作区文件"
                type="button"
              >
                <span aria-hidden="true">▸</span>
              </button>
            </div>
          </header>

          <div className={styles.workspaceDrawerCanvas}>
            <section className={styles.workspaceDrawerSection}>
              <div className={styles.workspaceTreeScroll}>
                {treeStatus === "loading" ? (
                  <div className={styles.workspaceLoadingState}>
                    <p>正在载入工作区结构…</p>
                  </div>
                ) : treeStatus === "error" ? (
                  <div className={styles.workspaceErrorState}>
                    <p>{treeError}</p>
                  </div>
                ) : tree.length > 0 ? (
                  <div className={styles.workspaceTreeList}>{renderWorkspaceTree(tree)}</div>
                ) : (
                  <div className={styles.workspaceEmptyState}>
                    <p>当前工作区还没有可展示的文件。</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
