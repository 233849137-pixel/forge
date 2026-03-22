import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createForgeWorkspaceDirectory,
  createForgeWorkspaceMarkdown,
  deleteForgeWorkspaceEntry,
  getForgeWorkspaceFile,
  getForgeWorkspaceFileTree
} from "../src/lib/forge-workspace-api";

describe("forge workspace api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the workspace tree without reusing stale GET responses", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            projectId: "retail-support",
            workspaceLabel: "retail-support",
            tree: []
          }
        }),
        { status: 200 }
      )
    );

    await getForgeWorkspaceFileTree("retail-support");

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/workspace-files?projectId=retail-support", {
      method: "GET",
      cache: "no-store"
    });
  });

  it("reads workspace file content without reusing stale GET responses", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            file: {
              projectId: "retail-support",
              path: "README.md",
              name: "README.md",
              body: "# 零售客服副驾驶",
              editable: true,
              language: "markdown",
              updatedAt: "2026-03-16T00:00:00.000Z"
            }
          }
        }),
        { status: 200 }
      )
    );

    await getForgeWorkspaceFile("retail-support", "README.md");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forge/workspace-files?projectId=retail-support&path=README.md",
      {
        method: "GET",
        cache: "no-store"
      }
    );
  });

  it("creates a markdown workspace file through the workspace files route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            projectId: "retail-support",
            workspaceLabel: "retail-support",
            tree: [],
            file: {
              projectId: "retail-support",
              path: "notes/summary.md",
              name: "summary.md",
              body: "# 交接说明",
              editable: true,
              language: "markdown",
              updatedAt: "2026-03-16T00:00:00.000Z"
            }
          }
        }),
        { status: 200 }
      )
    );

    await createForgeWorkspaceMarkdown({
      projectId: "retail-support",
      path: "notes/summary.md",
      body: "# 交接说明"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/workspace-files", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        action: "create-markdown",
        projectId: "retail-support",
        path: "notes/summary.md",
        body: "# 交接说明"
      })
    });
  });

  it("creates a workspace directory through the workspace files route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            projectId: "retail-support",
            workspaceLabel: "retail-support",
            tree: []
          }
        }),
        { status: 200 }
      )
    );

    await createForgeWorkspaceDirectory({
      projectId: "retail-support",
      path: "notes/handoff"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/workspace-files", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        action: "create-directory",
        projectId: "retail-support",
        path: "notes/handoff"
      })
    });
  });

  it("deletes a workspace entry through the workspace files route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            projectId: "retail-support",
            workspaceLabel: "retail-support",
            tree: []
          }
        }),
        { status: 200 }
      )
    );

    await deleteForgeWorkspaceEntry({
      projectId: "retail-support",
      path: "notes/obsolete"
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forge/workspace-files", {
      method: "DELETE",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        projectId: "retail-support",
        path: "notes/obsolete"
      })
    });
  });
});
