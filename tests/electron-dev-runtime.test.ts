import { describe, expect, test, vi } from "vitest";
import { shouldStartLocalDevServer } from "../scripts/lib/dev-server.mjs";

describe("electron dev server runtime", () => {
  test("skips launching next dev when an existing server is already reachable", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      shouldStartLocalDevServer("http://127.0.0.1:3000", fetcher)
    ).resolves.toBe(false);
  });

  test("starts next dev when the existing server is unavailable", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("connect refused"));

    await expect(
      shouldStartLocalDevServer("http://127.0.0.1:3000", fetcher)
    ).resolves.toBe(true);
  });

  test("starts next dev when the existing server returns a bad response", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });

    await expect(
      shouldStartLocalDevServer("http://127.0.0.1:3000", fetcher)
    ).resolves.toBe(true);
  });
});
