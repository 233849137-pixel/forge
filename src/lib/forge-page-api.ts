import type { ForgeStablePageContract, ForgeStablePageView } from "./forge-page-contract";

type ForgeApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

export async function fetchForgePageContract<V extends ForgeStablePageView>(
  view: V
): Promise<ForgeStablePageContract<V>> {
  const response = await fetch(`/api/forge/pages?view=${encodeURIComponent(view)}`, {
    method: "GET"
  });
  const payload = (await response.json()) as ForgeApiEnvelope<ForgeStablePageContract<V>>;

  if (!response.ok || !payload.ok) {
    throw new Error(("error" in payload ? payload.error?.message : undefined) ?? "页面合同加载失败。");
  }

  return payload.data;
}
