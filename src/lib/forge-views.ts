export type AppShellView =
  | "home"
  | "intake"
  | "task-pack"
  | "execution"
  | "verification"
  | "delivery"
  | "archive"
  | "team";

export type ForgePrimaryView =
  | "home"
  | "projects"
  | "team"
  | "artifacts"
  | "execution"
  | "assets"
  | "governance";

export const forgeNavigationItems: Array<{
  href: string;
  label: string;
  view: ForgePrimaryView;
}> = [
  { href: "/", label: "仪表盘", view: "home" },
  { href: "/projects", label: "项目管理", view: "projects" },
  { href: "/team", label: "AI员工", view: "team" },
  { href: "/assets", label: "资产管理", view: "assets" }
];

export function resolveAppShellView(value: string): AppShellView | null {
  const legacyViews: AppShellView[] = [
    "home",
    "intake",
    "task-pack",
    "execution",
    "verification",
    "delivery",
    "archive",
    "team"
  ];

  if (legacyViews.includes(value as AppShellView)) {
    return value as AppShellView;
  }

  return null;
}

const primaryViewAliases: Record<string, ForgePrimaryView> = {
  home: "home",
  projects: "projects",
  intake: "projects",
  team: "team",
  artifacts: "artifacts",
  "task-pack": "artifacts",
  delivery: "artifacts",
  execution: "execution",
  assets: "assets",
  archive: "assets",
  governance: "governance",
  verification: "governance"
};

export function resolveForgePrimaryView(value: string): ForgePrimaryView | null {
  return primaryViewAliases[value] ?? null;
}
