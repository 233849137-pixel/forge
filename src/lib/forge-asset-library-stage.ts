export type ForgeAssetLibraryStage =
  | "立项起盘"
  | "需求方案"
  | "原型设计"
  | "开发联调"
  | "测试发布"
  | "复盘沉淀";

export const forgeAssetLibraryStages: ForgeAssetLibraryStage[] = [
  "立项起盘",
  "需求方案",
  "原型设计",
  "开发联调",
  "测试发布",
  "复盘沉淀",
];

export const forgeAssetLibraryStageDescriptions: Record<
  ForgeAssetLibraryStage,
  string
> = {
  立项起盘: "项目刚立项、起盘、多人协作启动时优先带上的共享资产。",
  需求方案: "需求澄清、方案定稿、任务包拆解前先看的共享资产。",
  原型设计: "原型绘制、交互定义、页面结构确认阶段使用的共享资产。",
  开发联调: "开发实现、接口联调、执行推进阶段直接调用的共享资产。",
  测试发布: "测试回归、验收放行、部署发布阶段要对照的共享资产。",
  复盘沉淀: "复盘归档、经验沉淀、后续复用阶段参考的共享资产。",
};
