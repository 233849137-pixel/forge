import type { ForgeMaterialAsset } from "../components/forge-assets-page.types";

const curatedExternalMaterialAssets: ForgeMaterialAsset[] = [
  {
    id: "material-external-flowbite-dashboard",
    title: "Flowbite 仪表盘 UI Kit",
    typeLabel: "设计效果图",
    summary: "开源可编辑的 Tailwind / Figma 后台套件，适合 AI 工作台和资产驾驶舱改造。",
    relativePath: "external/flowbite-dashboard-ui-kit",
    sourceLabel: "外部精选 / Flowbite",
    modifiedAt: "2026-03-19T10:20:00.000Z",
    openUri: "https://github.com/themesberg/tailwind-figma-ui-kit",
    previewSrc: "/forge/material-assets/curated/flowbite-dashboard-ui-kit.png",
    actionLabel: "打开来源",
    sourceKind: "external",
  },
  {
    id: "material-external-themesberg-admin",
    title: "Themesberg 管理后台模板",
    typeLabel: "设计效果图",
    summary: "适合项目驾驶舱和后台骨架的免费 Figma dashboard 模板，可直接二次改造。",
    relativePath: "external/themesberg-admin-dashboard-template",
    sourceLabel: "外部精选 / Themesberg",
    modifiedAt: "2026-03-19T10:10:00.000Z",
    openUri: "https://themesberg.com/product/figma/admin-dashboard-template",
    previewSrc: "/forge/material-assets/curated/themesberg-admin-dashboard-template.png",
    actionLabel: "打开来源",
    sourceKind: "external",
  },
  {
    id: "material-external-emviui-dark",
    title: "EmviUI 深色 SaaS UI Kit",
    typeLabel: "设计效果图",
    summary: "深色 SaaS / 控制台风格的可编辑 UI Kit，适合统一工作台和面板视觉层级。",
    relativePath: "external/emviui-dark-saas-ui-kit",
    sourceLabel: "外部精选 / EmviUI",
    modifiedAt: "2026-03-19T10:00:00.000Z",
    openUri: "https://emviui.com/",
    previewSrc: "/forge/material-assets/curated/emviui-dark-saas-ui-kit.jpg",
    actionLabel: "打开来源",
    sourceKind: "external",
  },
  {
    id: "material-external-sublima-webapp",
    title: "Sublima Web App UI Kit",
    typeLabel: "设计效果图",
    summary: "更轻更现代的 web app 组件与页面素材，适合资产页和项目概览页参考。",
    relativePath: "external/sublima-web-app-ui-kit",
    sourceLabel: "外部精选 / Sublima UI",
    modifiedAt: "2026-03-19T09:50:00.000Z",
    openUri: "https://www.sublimaui.com/free-figma-ui-kit",
    previewSrc: "/forge/material-assets/curated/sublima-web-app-ui-kit.jpg",
    actionLabel: "打开来源",
    sourceKind: "external",
  },
];

export function buildForgeCuratedExternalMaterialAssets(): ForgeMaterialAsset[] {
  return curatedExternalMaterialAssets.map((item) => ({ ...item }));
}
