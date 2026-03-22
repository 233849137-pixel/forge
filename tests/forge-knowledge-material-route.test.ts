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
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GET as getKnowledgeMaterial } from "../app/api/forge/knowledge-base/material/route";

const createdDirectories: string[] = [];

afterEach(() => {
  while (createdDirectories.length > 0) {
    rmSync(createdDirectories.pop() as string, { force: true, recursive: true });
  }

  vi.unstubAllEnvs();
});

function createVaultMaterial(content: string) {
  const root = mkdtempSync(join(tmpdir(), "forge-knowledge-material-"));
  const vaultPath = join(root, "forge-knowledge-vault");
  const relativePath = "99-附件Attachments/设计稿/零售客服副驾驶-首页高保真稿.svg";
  const absolutePath = join(vaultPath, relativePath);

  createdDirectories.push(root);
  mkdirSync(join(vaultPath, "99-附件Attachments/设计稿"), {
    recursive: true,
  });
  writeFileSync(absolutePath, content, "utf8");
  vi.stubEnv("FORGE_OBSIDIAN_VAULT_PATH", vaultPath);

  return { relativePath };
}

describe("forge knowledge material route", () => {
  it("streams the requested image material from obsidian attachments", async () => {
    const { relativePath } = createVaultMaterial(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#111"/></svg>',
    );

    const response = await getKnowledgeMaterial(
      new Request(
        `http://127.0.0.1:3000/api/forge/knowledge-base/material?relativePath=${encodeURIComponent(relativePath)}`,
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(body).toContain("<svg");
    expect(body).toContain("rect");
  });
});
