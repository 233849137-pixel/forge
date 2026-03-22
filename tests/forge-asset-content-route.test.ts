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
import { POST as postAssetContent } from "../app/api/forge/assets/content/route";

const createdDirectories: string[] = [];

afterEach(() => {
  while (createdDirectories.length > 0) {
    rmSync(createdDirectories.pop() as string, { force: true, recursive: true });
  }

  vi.unstubAllEnvs();
});

function createVaultNote(content: string) {
  const root = mkdtempSync(join(tmpdir(), "forge-asset-content-"));
  const vaultPath = join(root, "forge-knowledge-vault");
  const relativePath =
    "20-共享资产SharedAssets/02-通用模块/开发并行派工模板（D0）v2.1.md";
  const absolutePath = join(vaultPath, relativePath);

  createdDirectories.push(root);
  mkdirSync(join(vaultPath, "20-共享资产SharedAssets/02-通用模块"), {
    recursive: true,
  });
  writeFileSync(absolutePath, content, "utf8");
  vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);

  return { absolutePath, relativePath };
}

describe("forge asset content route", () => {
  it("writes edited markdown body back into the obsidian note while preserving frontmatter", async () => {
    const { absolutePath, relativePath } = createVaultNote(`---
asset: true
asset_group: "启动资产"
asset_label: "启动模板"
type: template
---
# 开发并行派工模板（D0）v2.1

旧正文
`);

    const response = await postAssetContent(
      new Request("http://127.0.0.1:3000/api/forge/assets/content", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourcePath: relativePath,
          body: "# 开发并行派工模板（D0）v2.1\n\n新正文第一段\n\n- 新条目",
        }),
      }),
    );
    const payload = await response.json();
    const updated = readFileSync(absolutePath, "utf8");

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourcePath).toBe(relativePath);
    expect(payload.data.body).toContain("新正文第一段");
    expect(updated).toContain('asset_group: "启动资产"');
    expect(updated).toContain('asset_label: "启动模板"');
    expect(updated).toContain('type: template');
    expect(updated).toContain("新正文第一段");
    expect(updated).toContain("- 新条目");
    expect(updated).not.toContain("旧正文");
  });
});
