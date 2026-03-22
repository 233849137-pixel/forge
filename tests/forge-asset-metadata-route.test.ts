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
import { POST as postAssetMetadata } from "../app/api/forge/assets/metadata/route";

const createdDirectories: string[] = [];

afterEach(() => {
  while (createdDirectories.length > 0) {
    rmSync(createdDirectories.pop() as string, { force: true, recursive: true });
  }

  vi.unstubAllEnvs();
});

function createVaultNote(content: string) {
  const root = mkdtempSync(join(tmpdir(), "forge-asset-metadata-"));
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

describe("forge asset metadata route", () => {
  it("writes edited asset frontmatter back into the obsidian note", async () => {
    const { absolutePath, relativePath } = createVaultNote(`---
asset: true
asset_group: "启动资产"
asset_label: "启动模板"
type: template
---
# 开发并行派工模板（D0）v2.1

正文内容
`);

    const response = await postAssetMetadata(
      new Request("http://127.0.0.1:3000/api/forge/assets/metadata", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourcePath: relativePath,
          asset: true,
          assetGroup: "规则资产",
          assetLabel: "共享规范",
        }),
      }),
    );
    const payload = await response.json();
    const updated = readFileSync(absolutePath, "utf8");

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.asset).toBe(true);
    expect(payload.data.assetGroup).toBe("规则资产");
    expect(payload.data.assetLabel).toBe("共享规范");
    expect(updated).toContain('asset: true');
    expect(updated).toContain('asset_group: "规则资产"');
    expect(updated).toContain('asset_label: "共享规范"');
    expect(updated).toContain('type: template');
    expect(updated).toContain("# 开发并行派工模板（D0）v2.1");
    expect(updated).toContain("正文内容");
  });

  it("can remove a note from the asset library by writing asset false", async () => {
    const { absolutePath, relativePath } = createVaultNote(`---
asset: true
asset_group: "启动资产"
asset_label: "启动模板"
---
# 开发并行派工模板（D0）v2.1
`);

    const response = await postAssetMetadata(
      new Request("http://127.0.0.1:3000/api/forge/assets/metadata", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourcePath: relativePath,
          asset: false,
          assetGroup: null,
          assetLabel: null,
        }),
      }),
    );
    const updated = readFileSync(absolutePath, "utf8");

    expect(response.status).toBe(200);
    expect(updated).toContain("asset: false");
    expect(updated).not.toContain("asset_group:");
    expect(updated).not.toContain("asset_label:");
  });
});
