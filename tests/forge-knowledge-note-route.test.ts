import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  GET as getKnowledgeNote,
  POST as postKnowledgeNote,
} from "../app/api/forge/knowledge-base/note/route";

const createdDirectories: string[] = [];

afterEach(() => {
  while (createdDirectories.length > 0) {
    rmSync(createdDirectories.pop() as string, { force: true, recursive: true });
  }

  vi.unstubAllEnvs();
});

function createVaultNote(content: string) {
  const root = mkdtempSync(join(tmpdir(), "forge-knowledge-note-"));
  const vaultPath = join(root, "forge-knowledge-vault");
  const relativePath = "10-项目Projects/Demo/NOTE-2026-03-15-知识库同步方案.md";
  const absolutePath = join(vaultPath, relativePath);

  createdDirectories.push(root);
  mkdirSync(join(vaultPath, "10-项目Projects/Demo"), {
    recursive: true,
  });
  writeFileSync(absolutePath, content, "utf8");
  vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);

  return { relativePath };
}

describe("forge knowledge note route", () => {
  it("reads the markdown body from obsidian and strips frontmatter", async () => {
    const { relativePath } = createVaultNote(`---
type: note
tags: "forge"
---
# 知识库同步方案

正文第一段

- 条目一
`);

    const response = await getKnowledgeNote(
      new Request(
        `http://127.0.0.1:3000/api/forge/knowledge-base/note?relativePath=${encodeURIComponent(relativePath)}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.relativePath).toBe(relativePath);
    expect(payload.data.body).toContain("# 知识库同步方案");
    expect(payload.data.body).toContain("正文第一段");
    expect(payload.data.body).toContain("- 条目一");
    expect(payload.data.body).not.toContain("type: note");
  });

  it("writes the edited markdown body back into the obsidian note while preserving frontmatter", async () => {
    const { relativePath } = createVaultNote(`---
type: note
tags: "forge"
---
# 知识库同步方案

旧正文
`);

    const response = await postKnowledgeNote(
      new Request("http://127.0.0.1:3000/api/forge/knowledge-base/note", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          relativePath,
          body: "# 知识库同步方案\n\n新的正文第一段\n\n- 新条目",
        }),
      }),
    );
    const payload = await response.json();
    const updated = readFileSync(
      join(process.env.FORGE_OBSIDIAN_VAULT_PATH as string, relativePath),
      "utf8",
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.relativePath).toBe(relativePath);
    expect(payload.data.body).toContain("新的正文第一段");
    expect(updated).toContain('type: note');
    expect(updated).toContain('tags: "forge"');
    expect(updated).toContain("新的正文第一段");
    expect(updated).toContain("- 新条目");
    expect(updated).not.toContain("旧正文");
  });
});
