import type { ForgeStablePageView } from "./forge-page-contract";

export const FORGE_PAGE_CONTRACT_REFRESH_EVENT = "forge:page-contract-refresh";

export type ForgePageContractRefreshDetail = {
  views: ForgeStablePageView[];
};

export function dispatchForgePageContractRefresh(views: ForgeStablePageView[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ForgePageContractRefreshDetail>(FORGE_PAGE_CONTRACT_REFRESH_EVENT, {
      detail: { views }
    })
  );
}

export function subscribeForgePageContractRefresh(
  view: ForgeStablePageView,
  onRefresh: () => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ForgePageContractRefreshDetail>).detail;

    if (!detail?.views?.includes(view)) {
      return;
    }

    onRefresh();
  };

  window.addEventListener(FORGE_PAGE_CONTRACT_REFRESH_EVENT, listener);

  return () => {
    window.removeEventListener(FORGE_PAGE_CONTRACT_REFRESH_EVENT, listener);
  };
}
