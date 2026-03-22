"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ForgeAgent,
  ForgeCustomAbilityPack,
  ForgeDashboardSnapshot,
  ForgeEquippedPackRef,
  ForgeOrgChartMember,
  ForgeOrgDepartment,
  ForgeSkillCatalogOverride,
  ForgeTeamWorkbenchAbilityTab,
  ForgeTeamWorkbenchCategory,
  ForgeTeamWorkbenchEmployeeDetailTab,
  ForgeTeamTemplate,
  ForgeTeamWorkbenchState
} from "../../packages/core/src/types";
import {
  getForgeAgentDisplayLabel as getSharedForgeAgentDisplayLabel,
  getForgeAgentDisplayProfile as getSharedForgeAgentDisplayProfile
} from "../../packages/core/src/agent-display";
import { dispatchForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import {
  defaultTeamWorkbenchDepartmentOrder,
  defaultTeamWorkbenchDepartmentByRole,
  defaultTeamWorkbenchPackRefsByRole,
  defaultTeamWorkbenchPrimaryAgentId,
  defaultTeamWorkbenchRoleAssignments,
  defaultTeamWorkbenchSelectedTemplateId,
  defaultTeamWorkbenchTemplates,
  defaultTeamWorkbenchTemplateRolesById,
  normalizeTeamWorkbenchDepartmentLabel,
  resolveTeamWorkbenchDepartmentLabel
} from "../lib/forge-team-defaults";
import type {
  SaveForgeAgentProfileInput,
  SaveForgeAgentProfileResult,
  SaveForgeTeamWorkbenchStateInput,
  SaveForgeTeamWorkbenchStateResult
} from "../lib/forge-team-api";
import type { ForgeTeamPageData } from "../server/forge-page-dtos";
import ForgeConfirmDialog from "./forge-confirm-dialog";
import ForgeConsoleShell, { getToneBadgeClassName } from "./forge-console-shell";
import ForgeEditDialog from "./forge-edit-dialog";
import shellStyles from "./forge-console-shell.module.css";
import {
  getActiveProject,
  getAgentStatusLabel,
  getAgentStatusTone,
  getCurrentTask,
  getLatestArtifact,
  getOwnerModeLabel,
  getRoleLabel,
  getWorkflowState
} from "./forge-console-utils";
import styles from "./agent-team-page.module.css";

type AgentTeamPageProps = {
  data?: ForgeTeamPageData;
  saveAgentProfile?: (
    input: SaveForgeAgentProfileInput
  ) => Promise<SaveForgeAgentProfileResult>;
  saveTeamWorkbenchState?: (
    input: SaveForgeTeamWorkbenchStateInput
  ) => Promise<SaveForgeTeamWorkbenchStateResult>;
  snapshot?: ForgeTeamPageData;
  showNavigation?: boolean;
};

type TeamCategoryId = ForgeTeamWorkbenchCategory;

type EmployeeDetailTabId = ForgeTeamWorkbenchEmployeeDetailTab;

type AbilityTemplateTabId = ForgeTeamWorkbenchAbilityTab;

type GovernanceLevelId =
  | "observer"
  | "collaborator"
  | "executor"
  | "manager";

type GovernancePermissionGroupId =
  | "project"
  | "skills"
  | "execution"
  | "knowledge"
  | "governance";

type GovernancePermissionItem = {
  id: string;
  label: string;
  summary: string;
};

type GovernancePermissionGroup = {
  id: GovernancePermissionGroupId;
  label: string;
  items: GovernancePermissionItem[];
};

type ActionFeedbackTone = "success" | "info" | "warn";

type PendingDangerAction =
  | {
      kind: "delete-department";
      targetLabel: string;
    }
  | {
      kind: "delete-employee";
      targetId: string;
      targetLabel: string;
    }
  | {
      kind: "delete-skill-pack";
      targetId: string;
      targetLabel: string;
    };

const getDangerActionCopy = (action: PendingDangerAction | null) => {
  if (!action) return null;

  switch (action.kind) {
    case "delete-department":
      return {
        dialogLabel: "确认删除部门",
        title: "确认删除部门",
        description: `删除 ${action.targetLabel} 后，该部门会被移除，部门下的员工会自动并入其他现有部门。`
      };
    case "delete-employee":
      return {
        dialogLabel: "确认删除员工",
        title: "确认删除员工",
        description: `删除 ${action.targetLabel} 后，该员工会从团队配置、组织架构和员工管理里一起移除。`
      };
    case "delete-skill-pack":
      return {
        dialogLabel: "确认删除技能包",
        title: "确认删除技能包",
        description: `删除 ${action.targetLabel} 后，已装备到员工身上的同名技能包也会一并解除。`
      };
  }
};

type SkillCatalogItem = {
  id: string;
  name: string;
  line: string;
  category: string;
  summary: string;
  usageGuide?: string;
  sourceLabel?: string;
  recommendedRoles?: ForgeAgent["role"][];
};

type AbilityPack = {
  id: string;
  source: EquippedPackRef["source"];
  name: string;
  line: string;
  summary: string;
  category?: string;
  updatedAt?: string;
  roles: ForgeAgent["role"][];
  skillIds: string[];
  knowledgeSources: string[];
};

type CustomAbilityPack = ForgeCustomAbilityPack;
type EquippedPackRef = ForgeEquippedPackRef;

const getEquippedPackKey = (packRef: EquippedPackRef) => `${packRef.source}:${packRef.id}`;

const isSameEquippedPackRef = (left: EquippedPackRef, right: EquippedPackRef) =>
  left.source === right.source && left.id === right.id;

type TeamBuilderTemplate = {
  id: string;
  name: string;
  summary: string;
  roles: ForgeAgent["role"][];
};

const customTeamTemplateId = "__custom-team__";

const teamCategories: Array<{
  id: TeamCategoryId;
  label: string;
  icon: string;
  meta: string;
}> = [
  { id: "orgChart", label: "组织架构", icon: "◉", meta: "团队树状图" },
  { id: "organization", label: "团队配置", icon: "◎", meta: "模板与岗位绑定" },
  { id: "employees", label: "员工管理", icon: "◧", meta: "成员与状态" },
  { id: "templates", label: "技能配置", icon: "◫", meta: "Skill / 装备" },
  { id: "governance", label: "权限管理", icon: "◌", meta: "分级与审计" },
  { id: "automation", label: "自动化", icon: "↺", meta: "后续开放" }
];

const roleOrder: ForgeAgent["role"][] = [
  "pm",
  "architect",
  "design",
  "engineer",
  "qa",
  "release",
  "knowledge"
];

const builderStageLabelMap: Record<ForgeAgent["role"], string> = {
  pm: "需求确认",
  architect: "项目原型",
  design: "UI设计",
  engineer: "后端研发",
  qa: "DEMO测试",
  knowledge: "内测调优",
  release: "交付发布"
};

const builderStageIconMap: Record<ForgeAgent["role"], string> = {
  pm: "◍",
  architect: "◈",
  design: "◐",
  engineer: "▣",
  qa: "◌",
  knowledge: "◎",
  release: "✦"
};

const roleSummaryMap: Record<ForgeAgent["role"], string> = {
  pm: "需求收口与验收",
  architect: "信息架构与原型",
  design: "界面规范与设计稿",
  engineer: "功能实现与交付",
  qa: "测试验证与问题闭环",
  release: "放行判断与发布准备",
  knowledge: "归档沉淀与复盘"
};

const nextRoleMap: Record<ForgeAgent["role"], string> = {
  pm: "架构负责人",
  architect: "设计负责人",
  design: "工程执行员",
  engineer: "测试负责人",
  qa: "放行负责人",
  release: "知识沉淀员",
  knowledge: "已到归档终点"
};

function getAgentDisplayProfile(agent: Pick<ForgeAgent, "id" | "name" | "role">) {
  return getSharedForgeAgentDisplayProfile(agent);
}

function getAgentDisplayLabel(agent: Pick<ForgeAgent, "id" | "name" | "role">) {
  return getSharedForgeAgentDisplayLabel(agent);
}

function buildTeamBuilderTemplates(
  teamTemplates: ForgeTeamTemplate[],
  agents: ForgeAgent[]
): TeamBuilderTemplate[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const builtTemplates = teamTemplates.map((template) => {
    const roles = Array.from(
      new Set(
        template.agentIds
          .map((agentId) => agentById.get(agentId)?.role)
          .filter((role): role is ForgeAgent["role"] => Boolean(role))
      )
    ).sort((left, right) => roleOrder.indexOf(left) - roleOrder.indexOf(right));

    return {
      id: template.id,
      name: template.name,
      summary: template.summary,
      roles:
        roles.length > 0 ? roles : defaultTeamWorkbenchTemplateRolesById[template.id] ?? [...roleOrder]
    } satisfies TeamBuilderTemplate;
  });

  if (builtTemplates.length > 0) {
    return builtTemplates;
  }

  return [
    {
      id: defaultTeamWorkbenchSelectedTemplateId,
      name: defaultTeamWorkbenchTemplates[0]?.name ?? "标准交付团队",
      summary: defaultTeamWorkbenchTemplates[0]?.summary ?? "覆盖需求、原型、设计、研发、测试和发布的完整交付团队。",
      roles: [...roleOrder]
    }
  ];
}

const defaultOrgDepartments: ForgeOrgDepartment[] = defaultTeamWorkbenchDepartmentOrder.map((label) => ({
  label
}));

function normalizeDepartmentSelection(label: string | null | undefined) {
  if (!label) {
    return label ?? "";
  }

  return normalizeTeamWorkbenchDepartmentLabel(label);
}

function normalizeManagedAgentDepartment(agent: ForgeAgent): ForgeAgent {
  return {
    ...agent,
    departmentLabel: resolveTeamWorkbenchDepartmentLabel(agent)
  };
}

function normalizeOrgDepartmentLabels(
  departments: ForgeOrgDepartment[] | null | undefined
): ForgeOrgDepartment[] {
  if (!departments?.length) {
    return defaultOrgDepartments;
  }

  const normalized = departments.map((department) => ({
    ...department,
    label: normalizeTeamWorkbenchDepartmentLabel(department.label)
  }));

  return normalized.filter(
    (department, index) =>
      normalized.findIndex((candidate) => candidate.label === department.label) === index
  );
}

function normalizeOrgChartDepartment(
  member: ForgeOrgChartMember
): ForgeOrgChartMember {
  return {
    ...member,
    departmentLabel: resolveTeamWorkbenchDepartmentLabel(member)
  };
}

const teamCategoryIds: TeamCategoryId[] = [
  "orgChart",
  "organization",
  "employees",
  "templates",
  "automation",
  "governance"
];

const employeeDetailTabIds: EmployeeDetailTabId[] = [
  "basic",
  "ability",
  "runtime"
];

const abilityTemplateTabs: Array<{ id: AbilityTemplateTabId; label: string }> = [
  { id: "equipped", label: "已装技能" },
  { id: "skills", label: "技能库" },
  { id: "packs", label: "技能组合" },
  { id: "custom", label: "自定义组包" }
];

const agentContextToolModeLabel = {
  read: "读取",
  write: "写入",
  execute: "执行",
  review: "审阅"
} as const;

const skillLineOrder = [
  "AI智能",
  "开发工具",
  "效率提升",
  "数据分析",
  "内容创作",
  "安全合规",
  "通讯协作"
] as const;

const defaultSkillLine = skillLineOrder[0];

const skillLineCategorySuggestionsMap: Record<string, string[]> = {
  "AI智能": ["规划", "知识", "问答", "代理"],
  "开发工具": ["开发", "架构", "测试", "工程"],
  "效率提升": ["效率", "知识", "流程", "自动化"],
  "数据分析": ["分析", "指标", "洞察", "诊断"],
  "内容创作": ["文案策划", "设计", "视觉内容", "创意"],
  "安全合规": ["安全", "合规", "诊断", "风险"],
  "通讯协作": ["协作", "交付", "沟通", "发布"]
};

const legacySkillCatalogMetaMap: Record<
  string,
  Pick<SkillCatalogItem, "line" | "category" | "summary">
> = {
  "skill-prd": { line: "AI智能", category: "规划", summary: "输出标准 PRD 草案。" },
  "skill-acceptance": { line: "AI智能", category: "规划", summary: "补齐验收标准和边界约束。" },
  "skill-architecture": {
    line: "开发工具",
    category: "架构",
    summary: "推荐技术方案与边界划分。"
  },
  "skill-design-system": {
    line: "内容创作",
    category: "设计",
    summary: "约束页面结构与组件规范。"
  },
  "skill-code": { line: "开发工具", category: "开发", summary: "基于任务包生成可交付实现。" },
  "skill-playwright": { line: "开发工具", category: "测试", summary: "执行主流程回归和验证。" },
  "skill-release": { line: "通讯协作", category: "交付", summary: "整理发布说明与变更摘要。" },
  "skill-archive": { line: "效率提升", category: "知识", summary: "抽取模板与最佳实践。" },
  "skill-faq": { line: "通讯协作", category: "协作", summary: "处理高频问答与标准回复。" },
  "skill-rag": { line: "AI智能", category: "知识", summary: "检索知识库并生成答案。" },
  "skill-incident": { line: "安全合规", category: "诊断", summary: "快速定位问题并给出分诊结论。" }
};

const linePackConfigMap: Record<
  string,
  Pick<AbilityPack, "name" | "summary" | "knowledgeSources" | "roles">
> = {
  "AI智能": {
    name: "AI智能技能包",
    summary: "适合智能规划、知识增强和代理式问题求解。",
    knowledgeSources: ["岗位技能白名单", "核心技能索引"],
    roles: ["pm", "architect", "knowledge"]
  },
  "开发工具": {
    name: "开发工具技能包",
    summary: "适合编码实现、调试验证、部署发布和研发协作。",
    knowledgeSources: ["CTO / FE / BE / QA 白名单", "研发工具索引"],
    roles: ["architect", "design", "engineer", "qa", "release"]
  },
  "效率提升": {
    name: "效率提升技能包",
    summary: "适合流程编排、知识回收和日常效率增强。",
    knowledgeSources: ["工作流规范", "经验复盘索引"],
    roles: ["pm", "knowledge", "release"]
  },
  "数据分析": {
    name: "数据分析技能包",
    summary: "适合搜索检索、归纳总结和数据洞察。",
    knowledgeSources: ["检索与分析工具白名单", "研究资料库"],
    roles: ["pm", "qa", "knowledge"]
  },
  "内容创作": {
    name: "内容创作技能包",
    summary: "适合文案创作、视觉生成和内容排版发布。",
    knowledgeSources: ["内容创作工具索引", "品牌素材库"],
    roles: ["design", "pm", "knowledge"]
  },
  "安全合规": {
    name: "安全合规技能包",
    summary: "适合审查验证、风控检查和合规把关。",
    knowledgeSources: ["审查与合规规范", "风险控制手册"],
    roles: ["qa", "architect", "release"]
  },
  "通讯协作": {
    name: "通讯协作技能包",
    summary: "适合消息分发、外部协作和多渠道触达。",
    knowledgeSources: ["协作渠道说明", "发布与通知模板"],
    roles: ["pm", "release", "knowledge"]
  }
};

const roleCategoryLabelMap: Record<ForgeAgent["role"], string> = {
  pm: "规划",
  architect: "架构",
  design: "设计",
  engineer: "开发",
  qa: "测试",
  release: "交付",
  knowledge: "知识"
};

const roleLineLabelMap: Record<ForgeAgent["role"], string> = {
  pm: "AI智能",
  architect: "开发工具",
  design: "内容创作",
  engineer: "开发工具",
  qa: "开发工具",
  release: "通讯协作",
  knowledge: "数据分析"
};

const buildSkillCatalog = (skills: ForgeDashboardSnapshot["skills"]): SkillCatalogItem[] => {
  const catalog = new Map<string, SkillCatalogItem>();

  skills.forEach((skill) => {
    const legacyMeta = legacySkillCatalogMetaMap[skill.id];
    catalog.set(skill.id, {
      id: skill.id,
      name: skill.name,
      line: skill.line ?? legacyMeta?.line ?? roleLineLabelMap[skill.ownerRole] ?? defaultSkillLine,
      category:
        skill.displayCategory ??
        legacyMeta?.category ??
        roleCategoryLabelMap[skill.ownerRole] ??
        "通用",
      summary: skill.summary || legacyMeta?.summary || "当前没有摘要说明。",
      usageGuide: skill.usageGuide,
      sourceLabel: skill.sourceLabel,
      recommendedRoles: skill.recommendedRoles
    });
  });

  return Array.from(catalog.values());
};

const applyPersistedSkillCatalogState = (
  skillCatalog: SkillCatalogItem[],
  persistedWorkbenchState: ForgeTeamWorkbenchState | undefined
) => {
  const hiddenSkillIdSet = new Set(persistedWorkbenchState?.hiddenSkillIds ?? []);
  const overrides = persistedWorkbenchState?.skillCatalogOverrides ?? {};

  return skillCatalog
    .filter((skill) => !hiddenSkillIdSet.has(skill.id))
    .map((skill) => {
      const override = overrides[skill.id];
      if (!override) {
        return skill;
      }

      return {
        ...skill,
        name: override.name,
        summary: override.summary,
        line: override.line,
        category: override.category
      };
    });
};

const buildAbilityPackLibrary = (skillCatalog: SkillCatalogItem[]): AbilityPack[] => {
  const uniqueLines = Array.from(new Set(skillCatalog.map((skill) => skill.line)));
  const lines = [
    ...skillLineOrder.filter((line) => uniqueLines.includes(line)),
    ...uniqueLines.filter((line) => !skillLineOrder.includes(line as (typeof skillLineOrder)[number]))
  ];

  return lines
    .map((line) => {
      const config = linePackConfigMap[line] ?? {
        name: `${line}技能组合`,
        summary: `适合 ${line} 场景的真实技能组合。`,
        knowledgeSources: ["技能索引"],
        roles: ["engineer"] as ForgeAgent["role"][]
      };
      const skillIds = skillCatalog
        .filter((skill) => skill.line === line)
        .slice(0, 4)
        .map((skill) => skill.id);

      if (skillIds.length === 0) {
        return null;
      }

      return {
        id: `pack-${line}`,
        source: "preset",
        name: config.name,
        line,
        summary: config.summary,
        roles: config.roles,
        skillIds,
        knowledgeSources: config.knowledgeSources
      };
    })
    .filter(Boolean) as AbilityPack[];
};

const buildDefaultCustomAbilityPacks = (skillCatalog: SkillCatalogItem[]): CustomAbilityPack[] => {
  return buildAbilityPackLibrary(skillCatalog).map((pack) => {
    const firstSkill = skillCatalog.find((skill) => pack.skillIds.includes(skill.id));

    return {
      id: pack.id,
      name: pack.name,
      line: pack.line,
      category: firstSkill?.category ?? "通用",
      summary: pack.summary,
      skillIds: [...pack.skillIds],
      updatedAt: "内置"
    };
  });
};

const mergeCurrentAbilityPacks = (
  defaultPacks: CustomAbilityPack[],
  persistedPacks: CustomAbilityPack[] | undefined
) => {
  if (!persistedPacks?.length) return defaultPacks;

  const nextPacks = [...defaultPacks];
  const packIndexById = new Map(nextPacks.map((pack, index) => [pack.id, index]));
  const legacyDefaultIndexById = new Map(
    nextPacks.map((pack, index) => [`custom-pack-${pack.line}`, index])
  );

  persistedPacks.forEach((persistedPack) => {
    const matchedIndex =
      packIndexById.get(persistedPack.id) ?? legacyDefaultIndexById.get(persistedPack.id);

    if (matchedIndex !== undefined) {
      nextPacks[matchedIndex] = {
        ...nextPacks[matchedIndex],
        ...persistedPack,
        id: nextPacks[matchedIndex].id
      };
      return;
    }

    nextPacks.push(persistedPack);
  });

  return nextPacks;
};

const activeCategoryStorageKey = "forge-agent-team-active-category";
const employeeDetailTabStorageKey = "forge-agent-team-employee-tab";
const abilityTemplateTabStorageKey = "forge-agent-team-ability-tab";
const selectedAgentStorageKey = "forge-agent-team-selected-agent";
const selectedBuilderRoleStorageKey = "forge-agent-team-selected-builder-role";
const selectedPoolAgentStorageKey = "forge-agent-team-selected-pool-agent";
const selectedPoolDepartmentStorageKey = "forge-agent-team-selected-pool-department";
const selectedManagementDepartmentStorageKey = "forge-agent-team-selected-management-department";
const selectedTemplateDepartmentStorageKey = "forge-agent-team-selected-template-department";
const selectedGovernanceDepartmentStorageKey = "forge-agent-team-selected-governance-department";
const selectedAbilityLineStorageKey = "forge-agent-team-selected-ability-line";
const selectedRecommendedPackStorageKey = "forge-agent-team-selected-pack";
const selectedCustomPackStorageKey = "forge-agent-team-selected-custom-pack";
const currentPackListCollapsedStorageKey = "forge-agent-team-current-pack-list-collapsed";

const departmentByRoleMap = defaultTeamWorkbenchDepartmentByRole;

const governanceLevels: Array<{
  id: GovernanceLevelId;
  label: string;
  summary: string;
  riskHint: string;
}> = [
  {
    id: "observer",
    label: "L1 观察者",
    summary: "只看项目、员工和知识，不执行高风险动作。",
    riskHint: "当前为观察者权限，可查看信息和审计，但不能执行研发、治理或发布动作。"
  },
  {
    id: "collaborator",
    label: "L2 协作者",
    summary: "可编辑内容和技能，不做高风险执行。",
    riskHint: "当前为协作者权限，可编辑项目内容和技能配置，但不能写文件、执行命令或发布。"
  },
  {
    id: "executor",
    label: "L3 执行者",
    summary: "可写文件、跑测试、调用工具推进交付。",
    riskHint: "当前为执行者权限，可推进项目、写文件、运行测试和调用工具，但不能修改权限与最终放行。"
  },
  {
    id: "manager",
    label: "L4 管理者",
    summary: "可管理团队、权限、自动化与发布放行。",
    riskHint: "当前为管理者权限，可调整团队、权限、自动化和发布动作，请谨慎使用。"
  }
];

const governancePermissionGroups: GovernancePermissionGroup[] = [
  {
    id: "project",
    label: "项目协作",
    items: [
      { id: "project.view", label: "查看项目", summary: "查看项目、任务与交付物。" },
      { id: "project.edit", label: "编辑项目内容", summary: "修改项目文案、说明与配置。" },
      { id: "project.advance", label: "推进项目节点", summary: "推进项目到下一个工作节点。" },
      { id: "project.artifact", label: "修改交付物", summary: "更新 PRD、测试说明与发布文档。" }
    ]
  },
  {
    id: "skills",
    label: "技能与员工",
    items: [
      { id: "agent.view", label: "查看员工", summary: "查看员工信息与能力装配。" },
      { id: "agent.edit", label: "编辑员工配置", summary: "修改员工基础、能力和运行设置。" },
      { id: "skill.download", label: "下载技能", summary: "从 GitHub 等来源下载技能到本机。" },
      { id: "skill.equip", label: "装备技能", summary: "为员工装备单个技能或技能包。" },
      { id: "skill.bundle", label: "创建/编辑技能包", summary: "新建技能组合并维护包内容。" },
      { id: "team.configure", label: "调整团队配置", summary: "为团队节点绑定员工与模板。" }
    ]
  },
  {
    id: "execution",
    label: "研发执行",
    items: [
      { id: "exec.write", label: "写文件", summary: "写入代码、文档和配置文件。" },
      { id: "exec.command", label: "执行命令", summary: "运行终端命令与脚本。" },
      { id: "exec.install", label: "安装依赖", summary: "安装 npm/pnpm/bun 等依赖。" },
      { id: "exec.test", label: "运行测试", summary: "执行单测、集成测试与回归验证。" },
      { id: "exec.tooling", label: "调用研发工具", summary: "调用代码分析、构建与调试工具。" }
    ]
  },
  {
    id: "knowledge",
    label: "知识与外部能力",
    items: [
      { id: "knowledge.read", label: "访问知识库", summary: "读取本地或远程知识库内容。" },
      { id: "knowledge.mcp", label: "调用 MCP", summary: "通过 MCP 访问设计、数据库等工具。" },
      { id: "knowledge.network", label: "访问外部服务", summary: "请求外部 API 或联网检索。" },
      { id: "knowledge.upload", label: "上传附件", summary: "上传图片、文档和其他附件。" },
      { id: "knowledge.voice", label: "语音转写", summary: "使用语音输入和转写能力。" }
    ]
  },
  {
    id: "governance",
    label: "治理与放行",
    items: [
      { id: "governance.permissions", label: "修改权限", summary: "调整员工权限等级和例外权限。" },
      { id: "governance.automation", label: "配置自动化", summary: "维护接手、升级和触发时机。" },
      { id: "governance.approval", label: "人工审批放行", summary: "执行审批、放行和人工确认。" },
      { id: "governance.release", label: "发布交付", summary: "执行发布、放行与交付动作。" },
      { id: "governance.audit", label: "查看审计记录", summary: "查看权限变更和执行审计信息。" }
    ]
  }
];

const renderInlineEmptyState = (message: string) => (
  <div className={styles.inlineEmptyState}>
    <span className={styles.inlineEmptyStateLabel}>暂无内容</span>
    <p>{message}</p>
  </div>
);

const governancePermissionGroupIconMap: Record<
  GovernancePermissionGroupId,
  string
> = {
  project: "◇",
  skills: "◎",
  execution: "▣",
  knowledge: "◌",
  governance: "✦"
};

const permissionProfileToLevelMap: Record<string, GovernanceLevelId> = {
  "perm-readonly": "observer",
  "perm-review": "collaborator",
  "perm-execution": "executor",
  "perm-admin": "manager"
};

const governanceLevelToPermissionProfileMap: Record<GovernanceLevelId, string> = {
  observer: "perm-readonly",
  collaborator: "perm-review",
  executor: "perm-execution",
  manager: "perm-admin"
};

const governanceDefaultPermissions: Record<GovernanceLevelId, string[]> = {
  observer: [
    "project.view",
    "agent.view",
    "knowledge.read",
    "governance.audit"
  ],
  collaborator: [
    "project.view",
    "project.edit",
    "project.artifact",
    "agent.view",
    "agent.edit",
    "skill.equip",
    "skill.bundle",
    "knowledge.read",
    "knowledge.mcp",
    "knowledge.upload",
    "governance.audit"
  ],
  executor: [
    "project.view",
    "project.edit",
    "project.advance",
    "project.artifact",
    "agent.view",
    "skill.download",
    "skill.equip",
    "skill.bundle",
    "team.configure",
    "exec.write",
    "exec.command",
    "exec.install",
    "exec.test",
    "exec.tooling",
    "knowledge.read",
    "knowledge.mcp",
    "knowledge.network",
    "knowledge.upload",
    "knowledge.voice",
    "governance.audit"
  ],
  manager: governancePermissionGroups.flatMap((group) => group.items.map((item) => item.id))
};

export default function AgentTeamPage({
  data,
  saveAgentProfile,
  saveTeamWorkbenchState,
  snapshot: legacySnapshot,
  showNavigation = false
}: AgentTeamPageProps) {
  const snapshot = data ?? legacySnapshot;

  if (!snapshot) {
    throw new Error("AgentTeamPage requires page data.");
  }

  const customPackDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const actionFeedbackTimerRef = useRef<number | null>(null);
  const workbenchSaveTimerRef = useRef<number | null>(null);
  const hasMountedWorkbenchPersistenceRef = useRef(false);
  const activeProject = getActiveProject(snapshot);
  const currentTeamTemplate = snapshot.teamTemplates[0] ?? null;
  const persistedWorkbenchState = snapshot.teamWorkbenchState;
  const initialSkillCatalog = applyPersistedSkillCatalogState(
    buildSkillCatalog(snapshot.skills),
    persistedWorkbenchState
  );
  const defaultCustomAbilityPacks = buildDefaultCustomAbilityPacks(initialSkillCatalog);
  const initialManagedAgents =
    persistedWorkbenchState?.managedAgents?.length
      ? persistedWorkbenchState.managedAgents.map(normalizeManagedAgentDepartment)
      : snapshot.agents.map(normalizeManagedAgentDepartment);
  const initialAgentIdSet = new Set(initialManagedAgents.map((agent) => agent.id));
  const [managedAgents, setManagedAgents] = useState<ForgeAgent[]>(() => initialManagedAgents);
  const teamAgents = managedAgents;
  const poolAgents = managedAgents;
  const orgChartAgents = useMemo(
    () =>
      [...managedAgents].sort(
        (left, right) => roleOrder.indexOf(left.role) - roleOrder.indexOf(right.role)
      ),
    [managedAgents]
  );
  const [activeCategory, setActiveCategory] = useState<TeamCategoryId>(
    persistedWorkbenchState?.activeCategory ?? "organization"
  );
  const [selectedAgentId, setSelectedAgentId] = useState(
    persistedWorkbenchState?.selectedAgentId ??
      currentTeamTemplate?.leadAgentId ??
      defaultTeamWorkbenchPrimaryAgentId ??
      teamAgents[0]?.id ??
      ""
  );
  const [employeeDetailTab, setEmployeeDetailTab] = useState<EmployeeDetailTabId>(
    persistedWorkbenchState?.employeeDetailTab ?? "basic"
  );
  const [selectedBuilderRole, setSelectedBuilderRole] = useState<ForgeAgent["role"]>(
    persistedWorkbenchState?.selectedBuilderRole ?? "pm"
  );
  const [selectedPoolAgentId, setSelectedPoolAgentId] = useState(
    persistedWorkbenchState?.selectedPoolAgentId ??
      defaultTeamWorkbenchPrimaryAgentId ??
      poolAgents[0]?.id ??
      ""
  );
  const [selectedPoolDepartment, setSelectedPoolDepartment] = useState(
    normalizeDepartmentSelection(persistedWorkbenchState?.selectedPoolDepartment) || "全部"
  );
  const [selectedManagementDepartment, setSelectedManagementDepartment] = useState(
    normalizeDepartmentSelection(persistedWorkbenchState?.selectedManagementDepartment) || "全部"
  );
  const [selectedTemplateDepartment, setSelectedTemplateDepartment] = useState(
    normalizeDepartmentSelection(persistedWorkbenchState?.selectedTemplateDepartment) || "全部"
  );
  const [selectedGovernanceDepartment, setSelectedGovernanceDepartment] = useState(
    normalizeDepartmentSelection(persistedWorkbenchState?.selectedGovernanceDepartment) || "全部"
  );
  const [activeAbilityTemplateTab, setActiveAbilityTemplateTab] =
    useState<AbilityTemplateTabId>(persistedWorkbenchState?.abilityTemplateTab ?? "equipped");
  const [selectedAbilityLine, setSelectedAbilityLine] = useState(
    persistedWorkbenchState?.selectedAbilityLine ?? "全部"
  );
  const [selectedRecommendedPackId, setSelectedRecommendedPackId] = useState(
    persistedWorkbenchState?.selectedRecommendedPackId ?? ""
  );
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogItem[]>(() => initialSkillCatalog);
  const [skillCatalogOverrides, setSkillCatalogOverrides] = useState<
    Record<string, ForgeSkillCatalogOverride>
  >(() => persistedWorkbenchState?.skillCatalogOverrides ?? {});
  const [hiddenSkillIds, setHiddenSkillIds] = useState<string[]>(
    () => persistedWorkbenchState?.hiddenSkillIds ?? []
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    persistedWorkbenchState?.selectedTemplateId ??
      currentTeamTemplate?.id ??
      snapshot.teamTemplates[0]?.id ??
      defaultTeamWorkbenchSelectedTemplateId
  );
  const [manualSkillIdsByAgentId, setManualSkillIdsByAgentId] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      snapshot.agents.map((agent) => [
        agent.id,
        persistedWorkbenchState?.manualSkillIdsByAgentId?.[agent.id]
          ? [...persistedWorkbenchState.manualSkillIdsByAgentId[agent.id]]
          : [...agent.skillIds]
      ])
    )
  );
  const [manualKnowledgeSourcesByAgentId, setManualKnowledgeSourcesByAgentId] = useState<
    Record<string, string[]>
  >(() =>
    Object.fromEntries(
      snapshot.agents.map((agent) => [
        agent.id,
        persistedWorkbenchState?.manualKnowledgeSourcesByAgentId?.[agent.id]
          ? [...persistedWorkbenchState.manualKnowledgeSourcesByAgentId[agent.id]]
          : [...agent.knowledgeSources]
      ])
    )
  );
  const [removedPackSkillIdsByAgentId, setRemovedPackSkillIdsByAgentId] = useState<
    Record<string, Record<string, string[]>>
  >(() => persistedWorkbenchState?.removedPackSkillIdsByAgentId ?? {});
  const [expandedEquippedPackByAgentId, setExpandedEquippedPackByAgentId] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [equippedPackByAgentId, setEquippedPackByAgentId] = useState<
    Record<string, EquippedPackRef[]>
  >(() => persistedWorkbenchState?.equippedPackByAgentId ?? {});
  const [customAbilityPacks, setCustomAbilityPacks] = useState<CustomAbilityPack[]>(
    () =>
      mergeCurrentAbilityPacks(defaultCustomAbilityPacks, persistedWorkbenchState?.customAbilityPacks)
  );
  const [selectedCustomPackId, setSelectedCustomPackId] = useState(
    persistedWorkbenchState?.selectedCustomPackId ??
      mergeCurrentAbilityPacks(defaultCustomAbilityPacks, persistedWorkbenchState?.customAbilityPacks)[0]?.id ??
      defaultCustomAbilityPacks[0]?.id ??
      ""
  );
  const [customPackDraft, setCustomPackDraft] = useState<{
    name: string;
    line: string;
    category: string;
    summary: string;
    skillIds: string[];
  }>({
    name: "",
    line: defaultSkillLine,
    category: "通用",
    summary: "",
    skillIds: []
  });
  const [isCustomPackDialogOpen, setIsCustomPackDialogOpen] = useState(false);
  const [customPackDialogPosition, setCustomPackDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [orgDepartments, setOrgDepartments] = useState<ForgeOrgDepartment[]>(() =>
    persistedWorkbenchState?.orgDepartments?.length
      ? normalizeOrgDepartmentLabels(persistedWorkbenchState.orgDepartments)
      : defaultOrgDepartments
  );
  const [orgChartMembers, setOrgChartMembers] = useState<ForgeOrgChartMember[]>(() =>
    persistedWorkbenchState?.orgChartMembers?.length
      ? persistedWorkbenchState.orgChartMembers.map(normalizeOrgChartDepartment)
      : initialManagedAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          departmentLabel: resolveTeamWorkbenchDepartmentLabel(agent)
        })).map(normalizeOrgChartDepartment)
  );
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingDepartmentLabel, setEditingDepartmentLabel] = useState<string | null>(
    normalizeDepartmentSelection(persistedWorkbenchState?.orgDepartments?.[0]?.label) ||
      defaultOrgDepartments[0]?.label ||
      null
  );
  const [departmentDraftName, setDepartmentDraftName] = useState(
    normalizeDepartmentSelection(persistedWorkbenchState?.orgDepartments?.[0]?.label) ||
      defaultOrgDepartments[0]?.label ||
      ""
  );
  const [newOrgEmployeeName, setNewOrgEmployeeName] = useState("");
  const [newOrgEmployeeRole, setNewOrgEmployeeRole] = useState<ForgeAgent["role"]>("engineer");
  const [newOrgEmployeeDepartment, setNewOrgEmployeeDepartment] = useState("技术研发");
  const [isManageEmployeeDialogOpen, setIsManageEmployeeDialogOpen] = useState(false);
  const [newManagedEmployeeName, setNewManagedEmployeeName] = useState("");
  const [newManagedEmployeeRole, setNewManagedEmployeeRole] = useState<ForgeAgent["role"]>("engineer");
  const [isSkillImportDialogOpen, setIsSkillImportDialogOpen] = useState(false);
  const [skillImportGithubUrl, setSkillImportGithubUrl] = useState("");
  const [skillImportState, setSkillImportState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [skillImportMessage, setSkillImportMessage] = useState("");
  const [isSkillDetailDialogOpen, setIsSkillDetailDialogOpen] = useState(false);
  const [isCurrentPackListCollapsed, setIsCurrentPackListCollapsed] = useState(
    persistedWorkbenchState?.isCurrentPackListCollapsed ?? false
  );
  const [editingSkillId, setEditingSkillId] = useState("");
  const [skillDetailDraft, setSkillDetailDraft] = useState<{
    name: string;
    summary: string;
    line: string;
    category: string;
  }>({
    name: "",
    summary: "",
    line: defaultSkillLine,
    category: "通用"
  });
  const abilityPackLibrary = useMemo(
    () => buildAbilityPackLibrary(skillCatalog),
    [skillCatalog]
  );
  const teamBuilderTemplates = useMemo(
    () => buildTeamBuilderTemplates(snapshot.teamTemplates, managedAgents),
    [managedAgents, snapshot.teamTemplates]
  );
  const combinedAbilityPackLibrary = useMemo<AbilityPack[]>(() => {
    const presetPackIdSet = new Set(abilityPackLibrary.map((pack) => pack.id));

    return customAbilityPacks.map((pack) => {
      const roleSet = new Set<ForgeAgent["role"]>();
      const knowledgeSources = new Set<string>();

      pack.skillIds.forEach((skillId) => {
        const skill = skillCatalog.find((item) => item.id === skillId);
        skill?.recommendedRoles?.forEach((role) => roleSet.add(role));
        if (skill?.sourceLabel) knowledgeSources.add(skill.sourceLabel);
      });

      return {
        id: pack.id,
        source: (presetPackIdSet.has(pack.id) ? "preset" : "custom") as "preset" | "custom",
        name: pack.name,
        line: pack.line,
        summary: pack.summary,
        category: pack.category,
        updatedAt: pack.updatedAt,
        roles: Array.from(roleSet),
        skillIds: pack.skillIds,
        knowledgeSources: Array.from(knowledgeSources)
      };
    });
  }, [abilityPackLibrary, customAbilityPacks, skillCatalog]);
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    tone: ActionFeedbackTone;
  } | null>(null);
  const [isSavingAbilityDraft, setIsSavingAbilityDraft] = useState(false);
  const [pendingDangerAction, setPendingDangerAction] = useState<PendingDangerAction | null>(null);
  const [editingEmployeeSection, setEditingEmployeeSection] = useState<EmployeeDetailTabId | null>(null);
  const [basicDraft, setBasicDraft] = useState<{
    name: string;
    role: ForgeAgent["role"];
    departmentLabel: string;
    runnerId: string;
  }>({
    name: "",
    role: "pm",
    departmentLabel: defaultTeamWorkbenchDepartmentByRole.pm,
    runnerId: ""
  });
  const [abilityDraft, setAbilityDraft] = useState<{
    persona: string;
    promptTemplateId: string;
    systemPrompt: string;
    skillIdsText: string;
    knowledgeSourcesText: string;
  }>({
    persona: "",
    promptTemplateId: "",
    systemPrompt: "",
    skillIdsText: "",
    knowledgeSourcesText: ""
  });
  const [runtimeDraft, setRuntimeDraft] = useState<{
    ownerMode: ForgeAgent["ownerMode"];
    permissionProfileId: string;
    policyId: string;
  }>({
    ownerMode: "human-approved",
    permissionProfileId: "",
    policyId: ""
  });
  const [governanceLevelByAgentId, setGovernanceLevelByAgentId] = useState<
    Record<string, GovernanceLevelId>
  >(() =>
    Object.fromEntries(
      initialManagedAgents.map((agent) => [
        agent.id,
        permissionProfileToLevelMap[agent.permissionProfileId] ?? "observer"
      ])
    )
  );
  const [governanceOverridesByAgentId, setGovernanceOverridesByAgentId] = useState<
    Record<string, { enabled: string[]; disabled: string[] }>
  >(() => persistedWorkbenchState?.governanceOverridesByAgentId ?? {});
  const [draggingOrgMemberId, setDraggingOrgMemberId] = useState<string | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<ForgeAgent["role"], string | null>>(() =>
    roleOrder.reduce(
      (acc, role) => {
        const persistedAgentId = persistedWorkbenchState?.roleAssignments?.[role] ?? null;
        const defaultAgentId = defaultTeamWorkbenchRoleAssignments[role];
        acc[role] =
          persistedAgentId && initialAgentIdSet.has(persistedAgentId)
            ? persistedAgentId
            : defaultAgentId && initialAgentIdSet.has(defaultAgentId)
              ? defaultAgentId
              : poolAgents.find((agent) => agent.role === role)?.id ?? null;
        return acc;
      },
      {} as Record<ForgeAgent["role"], string | null>
    )
  );
  const selectedAgent =
    teamAgents.find((agent) => agent.id === selectedAgentId) ?? teamAgents[0] ?? null;
  const workflowState = getWorkflowState(snapshot, activeProject?.id);
  const promptTemplate =
    snapshot.promptTemplates.find((item) => item.id === selectedAgent?.promptTemplateId) ?? null;
  const isCustomTeamTemplate = selectedTemplateId === customTeamTemplateId;
  const selectedTemplate =
    (isCustomTeamTemplate
      ? {
          id: customTeamTemplateId,
          name: "自定义团队",
          summary: "从当前岗位编排开始，自定义团队成员与接棒关系。",
          roles: [...roleOrder]
        }
      : teamBuilderTemplates.find((template) => template.id === selectedTemplateId)) ??
    teamBuilderTemplates[0];

  const createManagedAgent = ({
    name,
    role,
    seed,
    departmentLabel
  }: {
    name: string;
    role: ForgeAgent["role"];
    seed?: ForgeAgent | null;
    departmentLabel?: string;
  }): ForgeAgent => {
    const fallbackSeed =
      seed ?? managedAgents.find((agent) => agent.role === role) ?? snapshot.agents[0] ?? null;
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id: `agent-${uniqueSuffix}`,
      name,
      role,
      departmentLabel: resolveTeamWorkbenchDepartmentLabel({
        id: `agent-${uniqueSuffix}`,
        role,
        departmentLabel:
          departmentLabel ?? fallbackSeed?.departmentLabel ?? departmentByRoleMap[role]
      }),
      persona: fallbackSeed?.persona ?? `${getRoleLabel(role)}，负责对应阶段的标准产出。`,
      systemPrompt: fallbackSeed?.systemPrompt ?? "",
      responsibilities: [...(fallbackSeed?.responsibilities ?? [])],
      skillIds: [...(fallbackSeed?.skillIds ?? [])],
      sopIds: [...(fallbackSeed?.sopIds ?? [])],
      knowledgeSources: [...(fallbackSeed?.knowledgeSources ?? [])],
      promptTemplateId: fallbackSeed?.promptTemplateId ?? snapshot.promptTemplates[0]?.id ?? "",
      policyId: fallbackSeed?.policyId ?? "",
      permissionProfileId: fallbackSeed?.permissionProfileId ?? "",
      ownerMode: fallbackSeed?.ownerMode ?? "human-approved",
      runnerId: fallbackSeed?.runnerId ?? snapshot.runners[0]?.id ?? ""
    };
  };

  const updateManagedAgent = (
    agentId: string,
    updater: (agent: ForgeAgent) => ForgeAgent
  ) => {
    setManagedAgents((current) =>
      current.map((agent) => (agent.id === agentId ? updater(agent) : agent))
    );
  };

  const getAgentDepartmentLabel = useCallback(
    (agent: ForgeAgent) =>
      resolveTeamWorkbenchDepartmentLabel({
        id: agent.id,
        role: agent.role,
        departmentLabel:
          orgChartMembers.find((member) => member.id === agent.id)?.departmentLabel ??
          agent.departmentLabel ??
          departmentByRoleMap[agent.role]
      }),
    [orgChartMembers]
  );

  const employeeRows = useMemo(
    () =>
      poolAgents.map((agent) => {
        const task = getCurrentTask(snapshot, agent.id, activeProject?.id);
        const artifact = getLatestArtifact(snapshot, agent.id, activeProject?.id);
        const statusLabel = getAgentStatusLabel(snapshot, agent, activeProject?.id);

        return {
          agent,
          departmentLabel: getAgentDepartmentLabel(agent),
          task,
          artifact,
          statusLabel
        };
      }),
    [activeProject?.id, getAgentDepartmentLabel, poolAgents, snapshot]
  );
  const employeeDepartments = useMemo(
    () => ["全部", ...Array.from(new Set(employeeRows.map(({ departmentLabel }) => departmentLabel)))],
    [employeeRows]
  );
  const filteredEmployeeRows = useMemo(() => {
    if (selectedPoolDepartment === "全部") return employeeRows;
    return employeeRows.filter(
      ({ departmentLabel }) => departmentLabel === selectedPoolDepartment
    );
  }, [employeeRows, selectedPoolDepartment]);
  const filteredManagementRows = useMemo(() => {
    if (selectedManagementDepartment === "全部") return employeeRows;
    return employeeRows.filter(
      ({ departmentLabel }) => departmentLabel === selectedManagementDepartment
    );
  }, [employeeRows, selectedManagementDepartment]);
  const filteredTemplateRows = useMemo(() => {
    if (selectedTemplateDepartment === "全部") return employeeRows;
    return employeeRows.filter(
      ({ departmentLabel }) => departmentLabel === selectedTemplateDepartment
    );
  }, [employeeRows, selectedTemplateDepartment]);
  const filteredGovernanceRows = useMemo(() => {
    if (selectedGovernanceDepartment === "全部") return employeeRows;
    return employeeRows.filter(
      ({ departmentLabel }) => departmentLabel === selectedGovernanceDepartment
    );
  }, [employeeRows, selectedGovernanceDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedPoolDepartment)) {
      setSelectedPoolDepartment("全部");
    }
  }, [employeeDepartments, selectedPoolDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedManagementDepartment)) {
      setSelectedManagementDepartment("全部");
    }
  }, [employeeDepartments, selectedManagementDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedTemplateDepartment)) {
      setSelectedTemplateDepartment("全部");
    }
  }, [employeeDepartments, selectedTemplateDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedGovernanceDepartment)) {
      setSelectedGovernanceDepartment("全部");
    }
  }, [employeeDepartments, selectedGovernanceDepartment]);
  const abilityLineOptions = useMemo(
    () => {
      const availableLines = new Set([
        ...combinedAbilityPackLibrary.map((pack) => pack.line),
        ...skillCatalog.map((skill) => skill.line)
      ]);

      return [
        "全部",
        ...skillLineOrder.filter((line) => availableLines.has(line)),
        ...Array.from(availableLines).filter(
          (line) => !skillLineOrder.includes(line as (typeof skillLineOrder)[number])
        )
      ];
    },
    [combinedAbilityPackLibrary, skillCatalog]
  );
  const abilityLineCounts = useMemo(() => {
    const counts = skillCatalog.reduce<Record<string, number>>((accumulator, skill) => {
      accumulator[skill.line] = (accumulator[skill.line] ?? 0) + 1;
      return accumulator;
    }, {});

    counts["全部"] = skillCatalog.length;
    return counts;
  }, [skillCatalog]);
  const resolveEquippedPack = (packRef: EquippedPackRef | null | undefined) => {
    if (!packRef) return null;
    if (packRef.source === "preset") {
      const pack = abilityPackLibrary.find((item) => item.id === packRef.id);
      if (!pack) return null;
      return {
        source: packRef.source,
        id: pack.id,
        name: pack.name,
        line: pack.line,
        summary: pack.summary,
        skillIds: pack.skillIds,
        knowledgeSources: pack.knowledgeSources
      };
    }

    const customPack = customAbilityPacks.find((item) => item.id === packRef.id);
    if (!customPack) return null;
    return {
      source: packRef.source,
      id: customPack.id,
      name: customPack.name,
      line: customPack.line,
      summary: customPack.summary,
      skillIds: customPack.skillIds,
      knowledgeSources: []
    };
  };
  const buildCombinedSkillIds = (
    manualSkillIds: string[],
    packRefs: EquippedPackRef[],
    removedPackSkillIdsByPackKey: Record<string, string[]> = {}
  ) => {
    const activePackSkillIds = packRefs.flatMap((packRef) => {
      const pack = resolveEquippedPack(packRef);
      if (!pack) return [];
      const removedSkillIds = removedPackSkillIdsByPackKey[getEquippedPackKey(packRef)] ?? [];
      return pack.skillIds.filter((skillId) => !removedSkillIds.includes(skillId));
    });

    return Array.from(new Set([...activePackSkillIds, ...manualSkillIds]));
  };
  const customPackCategoryOptions = useMemo(
    () => ["通用", ...Array.from(new Set(skillCatalog.map((skill) => skill.category)))],
    [skillCatalog]
  );
  const skillCategoryOptionsByLine = useMemo(() => {
    const optionsByLine = Object.fromEntries(
      skillLineOrder.map((line) => [line, [...(skillLineCategorySuggestionsMap[line] ?? [])]])
    ) as Record<string, string[]>;

    skillCatalog.forEach((skill) => {
      const nextOptions = new Set(optionsByLine[skill.line] ?? []);
      nextOptions.add(skill.category);
      optionsByLine[skill.line] = Array.from(nextOptions);
    });

    return optionsByLine;
  }, [skillCatalog]);
  const skillDetailCategoryOptions =
    skillCategoryOptionsByLine[skillDetailDraft.line] ?? skillLineCategorySuggestionsMap[defaultSkillLine];
  const skillLineOptions = useMemo(
    () => [
      ...skillLineOrder,
      ...Array.from(new Set(skillCatalog.map((skill) => skill.line))).filter(
        (line) => !skillLineOrder.includes(line as (typeof skillLineOrder)[number])
      )
    ],
    [skillCatalog]
  );
  const filteredAbilityPacks = useMemo(() => {
    const byLine =
      selectedAbilityLine === "全部"
        ? combinedAbilityPackLibrary
        : combinedAbilityPackLibrary.filter((pack) => pack.line === selectedAbilityLine);
    if (!selectedAgent) return byLine;
    return [...byLine].sort((left, right) => {
      const leftMatch = left.roles.includes(selectedAgent.role) ? 1 : 0;
      const rightMatch = right.roles.includes(selectedAgent.role) ? 1 : 0;
      return rightMatch - leftMatch;
    });
  }, [combinedAbilityPackLibrary, selectedAbilityLine, selectedAgent]);
  const selectedRecommendedPack =
    filteredAbilityPacks.find((pack) => pack.id === selectedRecommendedPackId) ?? null;

  const organizationRoles = useMemo(
    () =>
      selectedTemplate.roles.map((role) => {
        const assignedAgentId = roleAssignments[role];
        const assignedAgent = assignedAgentId
          ? poolAgents.find((agent) => agent.id === assignedAgentId) ?? null
          : null;
        const statusLabel = assignedAgent
          ? getAgentStatusLabel(snapshot, assignedAgent, activeProject?.id)
          : "待配置";
        const tone = assignedAgent ? getAgentStatusTone(statusLabel) : "neutral";

        return {
          role,
          roleLabel: builderStageLabelMap[role],
          summary: roleSummaryMap[role],
          isConfigured: Boolean(assignedAgent),
          assignedAgent,
          badge: statusLabel,
          tone,
          nextLabel: nextRoleMap[role]
        };
      }),
    [activeProject?.id, poolAgents, roleAssignments, selectedTemplate.roles, snapshot]
  );

  const projectTaskRows = useMemo(
    () =>
      activeProject?.id
        ? snapshot.tasks.filter((task) => task.projectId === activeProject.id)
        : [],
    [activeProject?.id, snapshot.tasks]
  );
  const projectArtifactRows = useMemo(
    () =>
      activeProject?.id
        ? snapshot.artifacts.filter((artifact) => artifact.projectId === activeProject.id)
        : [],
    [activeProject?.id, snapshot.artifacts]
  );

  const categoryItems = teamCategories.map((category) => ({
    icon: category.icon,
    title: category.label,
    meta: category.meta,
    active: activeCategory === category.id,
    onSelect: () => setActiveCategory(category.id)
  }));
  const selectedBuilderRoleState =
    organizationRoles.find((item) => item.role === selectedBuilderRole) ?? organizationRoles[0] ?? null;

  const persistedWorkbenchStateDraft = useMemo<ForgeTeamWorkbenchState>(
    () => ({
      managedAgents,
      selectedTemplateId,
      activeCategory,
      employeeDetailTab,
      abilityTemplateTab: activeAbilityTemplateTab,
      selectedAgentId: selectedAgentId || null,
      selectedBuilderRole,
      selectedPoolAgentId: selectedPoolAgentId || null,
      selectedPoolDepartment,
      selectedManagementDepartment,
      selectedTemplateDepartment,
      selectedGovernanceDepartment,
      selectedAbilityLine,
      selectedRecommendedPackId: selectedRecommendedPackId || null,
      selectedCustomPackId: selectedCustomPackId || null,
      isCurrentPackListCollapsed,
      roleAssignments: roleOrder.reduce(
        (next, role) => {
          next[role] = roleAssignments[role] ?? null;
          return next;
        },
        {} as Record<ForgeAgent["role"], string | null>
      ),
      manualSkillIdsByAgentId: Object.fromEntries(
        managedAgents.map((agent) => [agent.id, manualSkillIdsByAgentId[agent.id] ?? []])
      ),
      manualKnowledgeSourcesByAgentId: Object.fromEntries(
        managedAgents.map((agent) => [agent.id, manualKnowledgeSourcesByAgentId[agent.id] ?? []])
      ),
      removedPackSkillIdsByAgentId: Object.fromEntries(
        managedAgents.map((agent) => [agent.id, removedPackSkillIdsByAgentId[agent.id] ?? {}])
      ),
      equippedPackByAgentId: Object.fromEntries(
        managedAgents.map((agent) => [agent.id, equippedPackByAgentId[agent.id] ?? []])
      ),
      orgDepartments,
      orgChartMembers,
      customAbilityPacks,
      skillCatalogOverrides,
      hiddenSkillIds,
      governanceOverridesByAgentId: Object.fromEntries(
        managedAgents.flatMap((agent) => {
          const overrides = governanceOverridesByAgentId[agent.id];
          return overrides ? [[agent.id, overrides]] : [];
        })
      )
    }),
    [
      activeAbilityTemplateTab,
      activeCategory,
      customAbilityPacks,
      employeeDetailTab,
      equippedPackByAgentId,
      governanceOverridesByAgentId,
      hiddenSkillIds,
      isCurrentPackListCollapsed,
      managedAgents,
      manualKnowledgeSourcesByAgentId,
      manualSkillIdsByAgentId,
      orgChartMembers,
      orgDepartments,
      removedPackSkillIdsByAgentId,
      roleAssignments,
      selectedAbilityLine,
      selectedAgentId,
      selectedBuilderRole,
      selectedCustomPackId,
      selectedGovernanceDepartment,
      selectedManagementDepartment,
      selectedPoolAgentId,
      selectedPoolDepartment,
      selectedRecommendedPackId,
      selectedTemplateId,
      selectedTemplateDepartment,
      skillCatalogOverrides
    ]
  );
  const selectedPoolAgent =
    poolAgents.find((agent) => agent.id === selectedPoolAgentId) ?? poolAgents[0] ?? null;
  const selectedStatusLabel = selectedAgent
    ? getAgentStatusLabel(snapshot, selectedAgent, activeProject?.id)
    : "未配置";
  const selectedStatusTone = selectedAgent ? getAgentStatusTone(selectedStatusLabel) : "neutral";
  const selectedPromptTemplate =
    snapshot.promptTemplates.find((item) => item.id === selectedAgent?.promptTemplateId) ?? null;
  const selectedSkillNames =
    selectedAgent?.skillIds.map(
      (skillId) => skillCatalog.find((skill) => skill.id === skillId)?.name ?? skillId
    ) ?? [];
  const selectedDepartmentLabel = selectedAgent
    ? getAgentDepartmentLabel(selectedAgent)
    : "未归类部门";
  const selectedRunner =
    snapshot.runners.find((runner) => runner.id === selectedAgent?.runnerId) ?? snapshot.runners[0] ?? null;
  const selectedRunnerLabel = selectedRunner?.name ?? "当前没有可用 Runner";
  const selectedAgentContextPreview = selectedAgent
    ? snapshot.agentContextPreviewByAgentId?.[selectedAgent.id] ?? null
    : null;
  const isProjectShepherdSelected = selectedAgent?.id === "agent-service-strategy";
  const showCeoExecutionSummary =
    isProjectShepherdSelected &&
    Boolean(snapshot.ceoExecutionBackendLabel && snapshot.ceoExecutionRoleLabel && snapshot.ceoExecutionModeLabel);
  const selectedEquippedPackRefs = selectedAgent ? equippedPackByAgentId[selectedAgent.id] ?? [] : [];
  const selectedEquippedPacks = selectedEquippedPackRefs
    .map((packRef) => {
      const pack = resolveEquippedPack(packRef);
      if (!pack) return null;
      return {
        ref: packRef,
        pack,
        packKey: getEquippedPackKey(packRef),
        removedSkillIds:
          removedPackSkillIdsByAgentId[selectedAgent?.id ?? ""]?.[getEquippedPackKey(packRef)] ?? [],
        expanded:
          expandedEquippedPackByAgentId[selectedAgent?.id ?? ""]?.[getEquippedPackKey(packRef)] ?? false
      };
    })
    .filter(Boolean) as Array<{
    ref: EquippedPackRef;
    pack: NonNullable<ReturnType<typeof resolveEquippedPack>>;
    packKey: string;
    removedSkillIds: string[];
    expanded: boolean;
  }>;
  const selectedManualSkillCatalog = selectedAgent
    ? skillCatalog.filter((skill) =>
        (manualSkillIdsByAgentId[selectedAgent.id] ?? []).includes(skill.id)
      )
    : [];
  const currentAbilityPacks = combinedAbilityPackLibrary;
  const selectedCurrentPack =
    currentAbilityPacks.find((pack) => pack.id === selectedCustomPackId) ?? null;
  const selectedCustomPack =
    customAbilityPacks.find((pack) => pack.id === selectedCustomPackId) ?? null;
  const editingSkill =
    skillCatalog.find((skill) => skill.id === editingSkillId) ?? null;
  const currentPackSkillIds = selectedCurrentPack?.skillIds ?? customPackDraft.skillIds;
  const customPackSkills = currentPackSkillIds
    .map((skillId) => skillCatalog.find((item) => item.id === skillId))
    .filter(Boolean) as typeof skillCatalog;
  const availableCustomSkills = skillCatalog.filter(
    (skill) =>
      (selectedAbilityLine === "全部" || skill.line === selectedAbilityLine) &&
      !currentPackSkillIds.includes(skill.id)
  );
  const selectedGovernanceLevel = selectedAgent
    ? governanceLevelByAgentId[selectedAgent.id] ??
      permissionProfileToLevelMap[selectedAgent.permissionProfileId] ??
      "observer"
    : "observer";
  const selectedGovernanceLevelConfig =
    governanceLevels.find((level) => level.id === selectedGovernanceLevel) ?? governanceLevels[0];
  const selectedGovernanceOverrides =
    governanceOverridesByAgentId[selectedAgent?.id ?? ""] ?? { enabled: [], disabled: [] };
  const selectedGovernancePermissionIds = useMemo(() => {
    const permissionIds = new Set(governanceDefaultPermissions[selectedGovernanceLevel]);
    selectedGovernanceOverrides.enabled.forEach((permissionId) => permissionIds.add(permissionId));
    selectedGovernanceOverrides.disabled.forEach((permissionId) => permissionIds.delete(permissionId));
    return permissionIds;
  }, [selectedGovernanceLevel, selectedGovernanceOverrides]);
  const selectedGovernanceExceptions = useMemo(() => {
    const permissionById = new Map<
      string,
      (typeof governancePermissionGroups)[number]["items"][number]
    >(
      governancePermissionGroups.flatMap((group) => group.items.map((item) => [item.id, item] as const))
    );

    return [
      ...selectedGovernanceOverrides.enabled.map((permissionId) => ({
        type: "enabled" as const,
        permission: permissionById.get(permissionId)
      })),
      ...selectedGovernanceOverrides.disabled.map((permissionId) => ({
        type: "disabled" as const,
        permission: permissionById.get(permissionId)
      }))
    ].filter((item): item is { type: "enabled" | "disabled"; permission: (typeof governancePermissionGroups)[number]["items"][number] } => Boolean(item.permission));
  }, [selectedGovernanceOverrides]);

  const syncSelectedAgentAcrossChain = (agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedPoolAgentId(agentId);
  };

  const ensureDefaultPacksForRole = (agentId: string, role: ForgeAgent["role"]) => {
    const defaultPackRefs = defaultTeamWorkbenchPackRefsByRole[role] ?? [];
    if (defaultPackRefs.length === 0) return;

    setEquippedPackByAgentId((current) => {
      const existing = current[agentId] ?? [];
      if (existing.length > 0) return current;
      return {
        ...current,
        [agentId]: defaultPackRefs.map((packRef) => ({ ...packRef }))
      };
    });
  };

  const focusAgentAcrossEmployeeChain = useCallback(
    (agent: ForgeAgent, options?: { syncBuilderRole?: boolean }) => {
      const departmentLabel = getAgentDepartmentLabel(agent);
      syncSelectedAgentAcrossChain(agent.id);
      if (options?.syncBuilderRole !== false) {
        setSelectedBuilderRole(agent.role);
      }
      setSelectedPoolDepartment(departmentLabel);
      setSelectedManagementDepartment(departmentLabel);
      setSelectedTemplateDepartment(departmentLabel);
      setSelectedGovernanceDepartment(departmentLabel);
    },
    [getAgentDepartmentLabel]
  );

  const selectBuilderRoleWithContext = (role: ForgeAgent["role"]) => {
    setSelectedBuilderRole(role);

    const assignedAgentId = roleAssignments[role];
    if (assignedAgentId) {
      const assignedAgent = managedAgents.find((agent) => agent.id === assignedAgentId);
      if (assignedAgent) {
        focusAgentAcrossEmployeeChain(assignedAgent, { syncBuilderRole: false });
      } else {
        syncSelectedAgentAcrossChain(assignedAgentId);
      }
      return;
    }

    const roleMatchedAgent = poolAgents.find((agent) => agent.role === role);
    if (roleMatchedAgent) {
      focusAgentAcrossEmployeeChain(roleMatchedAgent, { syncBuilderRole: false });
    }
  };

  const openEmployeeSectionEditor = (section: EmployeeDetailTabId) => {
    if (!selectedAgent) return;

    if (section === "basic") {
      setBasicDraft({
        name: selectedAgent.name,
        role: selectedAgent.role,
        departmentLabel: selectedDepartmentLabel,
        runnerId: selectedAgent.runnerId || snapshot.runners[0]?.id || ""
      });
    }

    if (section === "ability") {
      setAbilityDraft({
        persona: selectedAgent.persona,
        promptTemplateId: selectedAgent.promptTemplateId,
        systemPrompt: selectedAgent.systemPrompt,
        skillIdsText: (manualSkillIdsByAgentId[selectedAgent.id] ?? selectedAgent.skillIds).join("\n"),
        knowledgeSourcesText: (
          manualKnowledgeSourcesByAgentId[selectedAgent.id] ?? selectedAgent.knowledgeSources
        ).join("\n")
      });
    }

    if (section === "runtime") {
      setRuntimeDraft({
        ownerMode: selectedAgent.ownerMode,
        permissionProfileId: selectedAgent.permissionProfileId,
        policyId: selectedAgent.policyId
      });
    }

    setEditingEmployeeSection(section);
  };

  const closeEmployeeSectionEditor = () => {
    setEditingEmployeeSection(null);
  };

  const showActionFeedback = (
    message: string,
    tone: ActionFeedbackTone = "success"
  ) => {
    if (actionFeedbackTimerRef.current !== null) {
      window.clearTimeout(actionFeedbackTimerRef.current);
    }
    setActionFeedback({ message, tone });
    actionFeedbackTimerRef.current = window.setTimeout(() => {
      setActionFeedback((current) => (current?.message === message ? null : current));
      actionFeedbackTimerRef.current = null;
    }, 2200);
  };

  const saveBasicDraft = async () => {
    if (!selectedAgent) return;
    const trimmedName = basicDraft.name.trim();
    if (!trimmedName) return;
    const previousRole = selectedAgent.role;

    if (!basicDraft.runnerId) {
      showActionFeedback("请先选择可用 Runner", "warn");
      return;
    }

    if (saveAgentProfile) {
      setIsSavingAbilityDraft(true);

      try {
        const result = await saveAgentProfile({
          agentId: selectedAgent.id,
          name: trimmedName,
          role: basicDraft.role,
          runnerId: basicDraft.runnerId,
          departmentLabel: basicDraft.departmentLabel,
          ownerMode: selectedAgent.ownerMode,
          persona: selectedAgent.persona,
          policyId: selectedAgent.policyId,
          permissionProfileId: selectedAgent.permissionProfileId,
          promptTemplateId: selectedAgent.promptTemplateId,
          skillIds: [...selectedAgent.skillIds],
          systemPrompt: selectedAgent.systemPrompt,
          knowledgeSources: [...selectedAgent.knowledgeSources]
        });

        updateManagedAgent(selectedAgent.id, (agent) => ({
          ...agent,
          name: result.agent.name,
          role: result.agent.role as ForgeAgent["role"],
          runnerId: result.agent.runnerId,
          departmentLabel: resolveTeamWorkbenchDepartmentLabel({
            id: result.agent.id,
            role: result.agent.role as ForgeAgent["role"],
            departmentLabel: result.agent.departmentLabel
          }),
          ownerMode: result.agent.ownerMode as ForgeAgent["ownerMode"],
          persona: result.agent.persona,
          policyId: result.agent.policyId,
          permissionProfileId: result.agent.permissionProfileId,
          promptTemplateId: result.agent.promptTemplateId,
          skillIds: [...result.agent.skillIds],
          systemPrompt: result.agent.systemPrompt,
          knowledgeSources: [...result.agent.knowledgeSources]
        }));
        setOrgChartMembers((current) =>
          current.map((member) =>
            member.id === selectedAgent.id
              ? {
                  ...member,
                  name: result.agent.name,
                  role: result.agent.role as ForgeAgent["role"],
                  departmentLabel: resolveTeamWorkbenchDepartmentLabel({
                    id: result.agent.id,
                    role: result.agent.role as ForgeAgent["role"],
                    departmentLabel: result.agent.departmentLabel ?? basicDraft.departmentLabel
                  })
                }
              : member
          )
        );
        if (result.agent.role !== previousRole) {
          setRoleAssignments((current) =>
            roleOrder.reduce(
              (next, role) => {
                if (current[role] === selectedAgent.id) {
                  next[role] = role === result.agent.role ? selectedAgent.id : null;
                } else {
                  next[role] = current[role];
                }
                return next;
              },
              {} as Record<ForgeAgent["role"], string | null>
            )
          );
          setSelectedBuilderRole(result.agent.role as ForgeAgent["role"]);
          ensureDefaultPacksForRole(selectedAgent.id, result.agent.role as ForgeAgent["role"]);
        }
        dispatchForgePageContractRefresh(["team", "home"]);
        showActionFeedback(`已保存 ${getAgentDisplayLabel(result.agent)} 的基础信息`);
        closeEmployeeSectionEditor();
      } catch (error) {
        showActionFeedback(error instanceof Error ? error.message : "保存基础信息失败", "warn");
      } finally {
        setIsSavingAbilityDraft(false);
      }

      return;
    }

    updateManagedAgent(selectedAgent.id, (agent) => ({
      ...agent,
      name: trimmedName,
      role: basicDraft.role,
      departmentLabel: normalizeTeamWorkbenchDepartmentLabel(basicDraft.departmentLabel),
      runnerId: basicDraft.runnerId
    }));
    setOrgChartMembers((current) =>
      current.map((member) =>
        member.id === selectedAgent.id
          ? {
              ...member,
              name: trimmedName,
              role: basicDraft.role,
              departmentLabel: normalizeTeamWorkbenchDepartmentLabel(basicDraft.departmentLabel)
            }
          : member
      )
    );
    if (basicDraft.role !== previousRole) {
      setRoleAssignments((current) =>
        roleOrder.reduce(
          (next, role) => {
            if (current[role] === selectedAgent.id) {
              next[role] = role === basicDraft.role ? selectedAgent.id : null;
            } else {
              next[role] = current[role];
            }
            return next;
          },
          {} as Record<ForgeAgent["role"], string | null>
        )
      );
      setSelectedBuilderRole(basicDraft.role);
      ensureDefaultPacksForRole(selectedAgent.id, basicDraft.role);
    }
    showActionFeedback(
      `已保存 ${getAgentDisplayLabel({
        id: selectedAgent.id,
        name: trimmedName,
        role: basicDraft.role
      })} 的基础信息`
    );
    closeEmployeeSectionEditor();
  };

  const saveAbilityDraft = async () => {
    if (!selectedAgent) return;

    const nextPersona = abilityDraft.persona.trim();
    const nextPromptTemplateId = abilityDraft.promptTemplateId.trim();
    const nextSystemPrompt = abilityDraft.systemPrompt.trim();
    const nextSkillIds = abilityDraft.skillIdsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const nextKnowledgeSources = abilityDraft.knowledgeSourcesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!nextPromptTemplateId || !nextSystemPrompt) {
      showActionFeedback("请先补全 Prompt 模板与默认提示词", "warn");
      return;
    }

    if (saveAgentProfile) {
      setIsSavingAbilityDraft(true);

      try {
        const result = await saveAgentProfile({
          agentId: selectedAgent.id,
          ownerMode: selectedAgent.ownerMode,
          persona: nextPersona,
          policyId: selectedAgent.policyId,
          permissionProfileId: selectedAgent.permissionProfileId,
          promptTemplateId: nextPromptTemplateId,
          skillIds: nextSkillIds,
          systemPrompt: nextSystemPrompt,
          knowledgeSources: nextKnowledgeSources
        });

        setManualSkillIdsByAgentId((current) => ({
          ...current,
          [selectedAgent.id]: [...result.agent.skillIds]
        }));
        setManualKnowledgeSourcesByAgentId((current) => ({
          ...current,
          [selectedAgent.id]: [...result.agent.knowledgeSources]
        }));
        updateManagedAgent(selectedAgent.id, (agent) => ({
          ...agent,
          ownerMode: result.agent.ownerMode,
          persona: result.agent.persona,
          policyId: result.agent.policyId,
          permissionProfileId: result.agent.permissionProfileId,
          promptTemplateId: result.agent.promptTemplateId,
          skillIds: [...result.agent.skillIds],
          systemPrompt: result.agent.systemPrompt,
          knowledgeSources: [...result.agent.knowledgeSources]
        }));
        dispatchForgePageContractRefresh(["team", "home"]);
        showActionFeedback(`已保存 ${getAgentDisplayLabel(result.agent)} 的能力配置`);
        closeEmployeeSectionEditor();
      } catch (error) {
        showActionFeedback(error instanceof Error ? error.message : "保存能力配置失败", "warn");
      } finally {
        setIsSavingAbilityDraft(false);
      }

      return;
    }

    setManualSkillIdsByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: nextSkillIds
    }));
    setManualKnowledgeSourcesByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: nextKnowledgeSources
    }));
    updateManagedAgent(selectedAgent.id, (agent) => ({
      ...agent,
      persona: nextPersona,
      promptTemplateId: nextPromptTemplateId,
      systemPrompt: nextSystemPrompt,
      skillIds: nextSkillIds,
      knowledgeSources: nextKnowledgeSources
    }));
    showActionFeedback(`已保存 ${getAgentDisplayLabel(selectedAgent)} 的能力配置`);
    closeEmployeeSectionEditor();
  };

  const saveRuntimeDraft = async () => {
    if (!selectedAgent) return;

    const nextOwnerMode = runtimeDraft.ownerMode;
    const nextPermissionProfileId = runtimeDraft.permissionProfileId.trim();
    const nextPolicyId = runtimeDraft.policyId.trim();

    if (!nextPermissionProfileId || !nextPolicyId) {
      showActionFeedback("请先补全权限配置与治理策略", "warn");
      return;
    }

    if (saveAgentProfile) {
      setIsSavingAbilityDraft(true);

      try {
        const result = await saveAgentProfile({
          agentId: selectedAgent.id,
          ownerMode: nextOwnerMode,
          persona: selectedAgent.persona,
          policyId: nextPolicyId,
          permissionProfileId: nextPermissionProfileId,
          promptTemplateId: selectedAgent.promptTemplateId,
          skillIds: [...selectedAgent.skillIds],
          systemPrompt: selectedAgent.systemPrompt,
          knowledgeSources: [...selectedAgent.knowledgeSources]
        });

        updateManagedAgent(selectedAgent.id, (agent) => ({
          ...agent,
          ownerMode: result.agent.ownerMode,
          policyId: result.agent.policyId,
          permissionProfileId: result.agent.permissionProfileId,
          persona: result.agent.persona,
          promptTemplateId: result.agent.promptTemplateId,
          skillIds: [...result.agent.skillIds],
          systemPrompt: result.agent.systemPrompt,
          knowledgeSources: [...result.agent.knowledgeSources]
        }));
        setGovernanceLevelByAgentId((current) => ({
          ...current,
          [selectedAgent.id]:
            permissionProfileToLevelMap[result.agent.permissionProfileId] ?? current[selectedAgent.id] ?? "observer"
        }));
        dispatchForgePageContractRefresh(["team", "home"]);
        showActionFeedback(`已保存 ${getAgentDisplayLabel(result.agent)} 的运行配置`);
        closeEmployeeSectionEditor();
      } catch (error) {
        showActionFeedback(error instanceof Error ? error.message : "保存运行配置失败", "warn");
      } finally {
        setIsSavingAbilityDraft(false);
      }

      return;
    }

    updateManagedAgent(selectedAgent.id, (agent) => ({
      ...agent,
      ownerMode: nextOwnerMode,
      permissionProfileId: nextPermissionProfileId,
      policyId: nextPolicyId
    }));
    showActionFeedback(`已保存 ${getAgentDisplayLabel(selectedAgent)} 的运行配置`);
    closeEmployeeSectionEditor();
  };

  const openEmployeeMarkdown = (section: EmployeeDetailTabId) => {
    if (!selectedAgent) return;
    window.open(
      `/api/forge/agents/${selectedAgent.id}/markdown?section=${section}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const applyGovernanceLevel = (level: GovernanceLevelId) => {
    if (!selectedAgent) return;

    setGovernanceLevelByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: level
    }));

    updateManagedAgent(selectedAgent.id, (agent) => ({
      ...agent,
      permissionProfileId: governanceLevelToPermissionProfileMap[level]
    }));
    const levelLabel = governanceLevels.find((item) => item.id === level)?.label.split(" ")[0] ?? "L1";
    showActionFeedback(`权限等级已切换为 ${levelLabel}`);
  };

  const toggleGovernancePermission = (permissionId: string) => {
    if (!selectedAgent) return;

    const defaultEnabled = governanceDefaultPermissions[selectedGovernanceLevel].includes(permissionId);
    const isEnabled = selectedGovernancePermissionIds.has(permissionId);
    const nextEnabled = !isEnabled;

    setGovernanceOverridesByAgentId((current) => {
      const currentOverrides = current[selectedAgent.id] ?? { enabled: [], disabled: [] };
      const enabled = currentOverrides.enabled.filter((item) => item !== permissionId);
      const disabled = currentOverrides.disabled.filter((item) => item !== permissionId);

      if (nextEnabled !== defaultEnabled) {
        if (nextEnabled) {
          enabled.push(permissionId);
        } else {
          disabled.push(permissionId);
        }
      }

      return {
        ...current,
        [selectedAgent.id]: {
          enabled,
          disabled
        }
      };
    });
    const permission = governancePermissionGroups
      .flatMap((group) => group.items)
      .find((item) => item.id === permissionId);
    showActionFeedback(
      `${nextEnabled ? "已放开" : "已收紧"} ${permission?.label ?? "权限"}`,
      nextEnabled ? "info" : "warn"
    );
  };

  const employeeDetailTabs: Array<{ id: EmployeeDetailTabId; label: string }> = [
    { id: "basic", label: "基础" },
    { id: "ability", label: "能力" },
    { id: "runtime", label: "运行" }
  ];

  useEffect(() => {
    if (!selectedTemplate.roles.includes(selectedBuilderRole)) {
      setSelectedBuilderRole(selectedTemplate.roles[0] ?? "pm");
    }
  }, [selectedBuilderRole, selectedTemplate.roles]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedPoolDepartment)) {
      setSelectedPoolDepartment("全部");
    }
  }, [employeeDepartments, selectedPoolDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedManagementDepartment)) {
      setSelectedManagementDepartment("全部");
    }
  }, [employeeDepartments, selectedManagementDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedTemplateDepartment)) {
      setSelectedTemplateDepartment("全部");
    }
  }, [employeeDepartments, selectedTemplateDepartment]);

  useEffect(() => {
    if (!employeeDepartments.includes(selectedGovernanceDepartment)) {
      setSelectedGovernanceDepartment("全部");
    }
  }, [employeeDepartments, selectedGovernanceDepartment]);

  useEffect(() => {
    if (filteredEmployeeRows.length === 0) return;
    if (!filteredEmployeeRows.some((item) => item.agent.id === selectedPoolAgentId)) {
      setSelectedPoolAgentId(filteredEmployeeRows[0].agent.id);
    }
  }, [filteredEmployeeRows, selectedPoolAgentId]);

  useEffect(() => {
    if (poolAgents.length === 0) {
      setSelectedAgentId("");
      return;
    }
    if (!poolAgents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(poolAgents[0].id);
    }
  }, [poolAgents, selectedAgentId]);

  useEffect(() => {
    if (filteredManagementRows.length === 0) return;
    if (!filteredManagementRows.some((item) => item.agent.id === selectedAgentId)) {
      setSelectedAgentId(filteredManagementRows[0].agent.id);
    }
  }, [filteredManagementRows, selectedAgentId]);

  useEffect(() => {
    if (!selectedRecommendedPackId) return;
    if (!filteredAbilityPacks.some((pack) => pack.id === selectedRecommendedPackId)) {
      setSelectedRecommendedPackId("");
    }
  }, [filteredAbilityPacks, selectedRecommendedPackId]);

  useEffect(() => {
    if (activeAbilityTemplateTab === "packs") return;
    if (!selectedRecommendedPackId) return;
    setSelectedRecommendedPackId("");
  }, [activeAbilityTemplateTab, selectedRecommendedPackId]);

  useEffect(() => {
    if (activeCategory !== "templates") return;
    if (filteredTemplateRows.length === 0) return;
    if (!filteredTemplateRows.some((item) => item.agent.id === selectedAgentId)) {
      setSelectedAgentId(filteredTemplateRows[0].agent.id);
    }
  }, [activeCategory, filteredTemplateRows, selectedAgentId]);

  useEffect(() => {
    if (activeCategory !== "governance") return;
    if (filteredGovernanceRows.length === 0) return;
    if (!filteredGovernanceRows.some((item) => item.agent.id === selectedAgentId)) {
      setSelectedAgentId(filteredGovernanceRows[0].agent.id);
    }
  }, [activeCategory, filteredGovernanceRows, selectedAgentId]);

  useEffect(() => {
    setEquippedPackByAgentId((current) => {
      const next = { ...current };
      Object.keys(next).forEach((agentId) => {
        if (!managedAgents.some((agent) => agent.id === agentId)) {
          delete next[agentId];
        }
      });
      const sameKeys = Object.keys(next).length === Object.keys(current).length;
      const sameValues = Object.entries(next).every(([agentId, packRefs]) => {
        const currentRefs = current[agentId] ?? [];
        return (
          currentRefs.length === packRefs.length &&
          currentRefs.every((packRef, index) => isSameEquippedPackRef(packRef, packRefs[index]))
        );
      });
      return sameKeys && sameValues ? current : next;
    });
  }, [managedAgents]);

  useEffect(() => {
    setManualSkillIdsByAgentId((current) => {
      const next: Record<string, string[]> = {};
      managedAgents.forEach((agent) => {
        next[agent.id] = current[agent.id] ? [...current[agent.id]] : [...agent.skillIds];
      });
      const same =
        Object.keys(next).length === Object.keys(current).length &&
        Object.entries(next).every(
          ([agentId, skillIds]) =>
            current[agentId] &&
            current[agentId].length === skillIds.length &&
            current[agentId].every((skillId, index) => skillId === skillIds[index])
        );
      return same ? current : next;
    });
  }, [managedAgents]);

  useEffect(() => {
    setManualKnowledgeSourcesByAgentId((current) => {
      const next: Record<string, string[]> = {};
      managedAgents.forEach((agent) => {
        next[agent.id] = current[agent.id]
          ? [...current[agent.id]]
          : [...agent.knowledgeSources];
      });
      const same =
        Object.keys(next).length === Object.keys(current).length &&
        Object.entries(next).every(
          ([agentId, knowledgeSources]) =>
            current[agentId] &&
            current[agentId].length === knowledgeSources.length &&
            current[agentId].every(
              (knowledgeSource, index) => knowledgeSource === knowledgeSources[index]
            )
        );
      return same ? current : next;
    });
  }, [managedAgents]);

  useEffect(() => {
    setManagedAgents((current) => {
      let changed = false;
      const nextAgents = current.map((agent) => {
        const manualSkillIds = manualSkillIdsByAgentId[agent.id] ?? [];
        const manualKnowledgeSources = manualKnowledgeSourcesByAgentId[agent.id] ?? [];
        const packRefs = equippedPackByAgentId[agent.id] ?? [];
        const resolvedPacks = packRefs
          .map((packRef) => resolveEquippedPack(packRef))
          .filter(Boolean) as Array<NonNullable<ReturnType<typeof resolveEquippedPack>>>;
        const nextSkillIds = buildCombinedSkillIds(
          manualSkillIds.filter((skillId) => skillCatalog.some((skill) => skill.id === skillId)),
          packRefs,
          removedPackSkillIdsByAgentId[agent.id] ?? {}
        );
        const nextKnowledgeSources = Array.from(
          new Set([
            ...manualKnowledgeSources,
            ...resolvedPacks.flatMap((pack) => pack.knowledgeSources)
          ])
        );

        const skillsUnchanged =
          agent.skillIds.length === nextSkillIds.length &&
          agent.skillIds.every((skillId, index) => skillId === nextSkillIds[index]);
        const knowledgeUnchanged =
          agent.knowledgeSources.length === nextKnowledgeSources.length &&
          agent.knowledgeSources.every((source, index) => source === nextKnowledgeSources[index]);

        if (skillsUnchanged && knowledgeUnchanged) return agent;
        changed = true;

        return {
          ...agent,
          skillIds: nextSkillIds,
          knowledgeSources: nextKnowledgeSources
        };
      });
      return changed ? nextAgents : current;
    });
  }, [
    equippedPackByAgentId,
    manualKnowledgeSourcesByAgentId,
    manualSkillIdsByAgentId,
    removedPackSkillIdsByAgentId,
    skillCatalog,
    customAbilityPacks
  ]);

  useEffect(() => {
    if (currentAbilityPacks.length === 0) {
      setSelectedCustomPackId("");
      return;
    }
    if (!currentAbilityPacks.some((pack) => pack.id === selectedCustomPackId)) {
      setSelectedCustomPackId(currentAbilityPacks[0].id);
    }
  }, [currentAbilityPacks, selectedCustomPackId]);

  useEffect(() => {
    if (!selectedCurrentPack) {
      setCustomPackDraft({
        name: "",
        line: selectedAbilityLine !== "全部" ? selectedAbilityLine : defaultSkillLine,
        category: "通用",
        summary: "",
        skillIds: []
      });
      return;
    }

    setCustomPackDraft({
      name: selectedCurrentPack.name,
      line: selectedCurrentPack.line,
      category: selectedCurrentPack.category ?? "通用",
      summary: selectedCurrentPack.summary,
      skillIds: [...selectedCurrentPack.skillIds]
    });
  }, [selectedAbilityLine, selectedCurrentPack]);

  useEffect(() => {
    if (!orgDepartments.some((department) => department.label === newOrgEmployeeDepartment)) {
      setNewOrgEmployeeDepartment(orgDepartments[0]?.label ?? defaultTeamWorkbenchDepartmentByRole.pm);
    }
  }, [newOrgEmployeeDepartment, orgDepartments]);

  useEffect(() => {
    const savedCategory = window.localStorage.getItem(activeCategoryStorageKey);
    if (!persistedWorkbenchState?.activeCategory && teamCategoryIds.includes(savedCategory as TeamCategoryId)) {
      setActiveCategory(savedCategory as TeamCategoryId);
    }

    const savedDetailTab = window.localStorage.getItem(employeeDetailTabStorageKey);
    if (
      !persistedWorkbenchState?.employeeDetailTab &&
      employeeDetailTabIds.includes(savedDetailTab as EmployeeDetailTabId)
    ) {
      setEmployeeDetailTab(savedDetailTab as EmployeeDetailTabId);
    }

    const savedAbilityTemplateTab = window.localStorage.getItem(abilityTemplateTabStorageKey);
    if (
      !persistedWorkbenchState?.abilityTemplateTab &&
      abilityTemplateTabs.some((tab) => tab.id === savedAbilityTemplateTab)
    ) {
      setActiveAbilityTemplateTab(savedAbilityTemplateTab as AbilityTemplateTabId);
    }

    const savedAgentId = window.localStorage.getItem(selectedAgentStorageKey);
    if (
      !persistedWorkbenchState?.selectedAgentId &&
      savedAgentId &&
      poolAgents.some((agent) => agent.id === savedAgentId)
    ) {
      setSelectedAgentId(savedAgentId);
      setSelectedPoolAgentId(savedAgentId);
    }

    const savedBuilderRole = window.localStorage.getItem(selectedBuilderRoleStorageKey);
    if (
      !persistedWorkbenchState?.selectedBuilderRole &&
      roleOrder.includes(savedBuilderRole as ForgeAgent["role"])
    ) {
      setSelectedBuilderRole(savedBuilderRole as ForgeAgent["role"]);
    }

    const savedPoolAgentId = window.localStorage.getItem(selectedPoolAgentStorageKey);
    if (
      !persistedWorkbenchState?.selectedPoolAgentId &&
      savedPoolAgentId &&
      poolAgents.some((agent) => agent.id === savedPoolAgentId)
    ) {
      setSelectedPoolAgentId(savedPoolAgentId);
    }

    const savedPoolDepartment = normalizeDepartmentSelection(
      window.localStorage.getItem(selectedPoolDepartmentStorageKey)
    );
    if (
      !persistedWorkbenchState?.selectedPoolDepartment &&
      employeeDepartments.includes(savedPoolDepartment ?? "")
    ) {
      setSelectedPoolDepartment(savedPoolDepartment ?? "全部");
    }

    const savedManagementDepartment = normalizeDepartmentSelection(
      window.localStorage.getItem(selectedManagementDepartmentStorageKey)
    );
    if (
      !persistedWorkbenchState?.selectedManagementDepartment &&
      employeeDepartments.includes(savedManagementDepartment ?? "")
    ) {
      setSelectedManagementDepartment(savedManagementDepartment ?? "全部");
    }

    const savedTemplateDepartment = normalizeDepartmentSelection(
      window.localStorage.getItem(selectedTemplateDepartmentStorageKey)
    );
    if (
      !persistedWorkbenchState?.selectedTemplateDepartment &&
      employeeDepartments.includes(savedTemplateDepartment ?? "")
    ) {
      setSelectedTemplateDepartment(savedTemplateDepartment ?? "全部");
    }

    const savedGovernanceDepartment = normalizeDepartmentSelection(
      window.localStorage.getItem(selectedGovernanceDepartmentStorageKey)
    );
    if (
      !persistedWorkbenchState?.selectedGovernanceDepartment &&
      employeeDepartments.includes(savedGovernanceDepartment ?? "")
    ) {
      setSelectedGovernanceDepartment(savedGovernanceDepartment ?? "全部");
    }

    const savedAbilityLine = window.localStorage.getItem(selectedAbilityLineStorageKey);
    if (!persistedWorkbenchState?.selectedAbilityLine && savedAbilityLine) {
      setSelectedAbilityLine(savedAbilityLine);
    }

    const savedRecommendedPackId = window.localStorage.getItem(selectedRecommendedPackStorageKey);
    if (!persistedWorkbenchState?.selectedRecommendedPackId && savedRecommendedPackId) {
      setSelectedRecommendedPackId(savedRecommendedPackId);
    }

    const savedCustomPackId = window.localStorage.getItem(selectedCustomPackStorageKey);
    if (!persistedWorkbenchState?.selectedCustomPackId && savedCustomPackId) {
      setSelectedCustomPackId(savedCustomPackId);
    }

    if (
      typeof persistedWorkbenchState?.isCurrentPackListCollapsed !== "boolean" &&
      window.localStorage.getItem(currentPackListCollapsedStorageKey) === "true"
    ) {
      setIsCurrentPackListCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(activeCategoryStorageKey, activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    window.localStorage.setItem(employeeDetailTabStorageKey, employeeDetailTab);
  }, [employeeDetailTab]);

  useEffect(() => {
    window.localStorage.setItem(abilityTemplateTabStorageKey, activeAbilityTemplateTab);
  }, [activeAbilityTemplateTab]);

  useEffect(() => {
    if (selectedAgentId) {
      window.localStorage.setItem(selectedAgentStorageKey, selectedAgentId);
      return;
    }
    window.localStorage.removeItem(selectedAgentStorageKey);
  }, [selectedAgentId]);

  useEffect(() => {
    if (selectedBuilderRole) {
      window.localStorage.setItem(selectedBuilderRoleStorageKey, selectedBuilderRole);
    }
  }, [selectedBuilderRole]);

  useEffect(() => {
    if (selectedPoolAgentId) {
      window.localStorage.setItem(selectedPoolAgentStorageKey, selectedPoolAgentId);
      return;
    }
    window.localStorage.removeItem(selectedPoolAgentStorageKey);
  }, [selectedPoolAgentId]);

  useEffect(() => {
    window.localStorage.setItem(selectedPoolDepartmentStorageKey, selectedPoolDepartment);
  }, [selectedPoolDepartment]);

  useEffect(() => {
    window.localStorage.setItem(
      selectedManagementDepartmentStorageKey,
      selectedManagementDepartment
    );
  }, [selectedManagementDepartment]);

  useEffect(() => {
    window.localStorage.setItem(selectedTemplateDepartmentStorageKey, selectedTemplateDepartment);
  }, [selectedTemplateDepartment]);

  useEffect(() => {
    window.localStorage.setItem(
      selectedGovernanceDepartmentStorageKey,
      selectedGovernanceDepartment
    );
  }, [selectedGovernanceDepartment]);

  useEffect(() => {
    window.localStorage.setItem(selectedAbilityLineStorageKey, selectedAbilityLine);
  }, [selectedAbilityLine]);

  useEffect(() => {
    if (selectedRecommendedPackId) {
      window.localStorage.setItem(selectedRecommendedPackStorageKey, selectedRecommendedPackId);
      return;
    }
    window.localStorage.removeItem(selectedRecommendedPackStorageKey);
  }, [selectedRecommendedPackId]);

  useEffect(() => {
    if (selectedCustomPackId) {
      window.localStorage.setItem(selectedCustomPackStorageKey, selectedCustomPackId);
      return;
    }
    window.localStorage.removeItem(selectedCustomPackStorageKey);
  }, [selectedCustomPackId]);

  useEffect(() => {
    window.localStorage.setItem(
      currentPackListCollapsedStorageKey,
      String(isCurrentPackListCollapsed)
    );
  }, [isCurrentPackListCollapsed]);

  useEffect(() => {
    if (!saveTeamWorkbenchState) {
      return;
    }

    if (!hasMountedWorkbenchPersistenceRef.current) {
      hasMountedWorkbenchPersistenceRef.current = true;
      return;
    }

    const nextState = persistedWorkbenchStateDraft;
    if (workbenchSaveTimerRef.current !== null) {
      window.clearTimeout(workbenchSaveTimerRef.current);
    }

    workbenchSaveTimerRef.current = window.setTimeout(() => {
      void saveTeamWorkbenchState(nextState).catch(() => {
        // Keep the local editing flow uninterrupted when silent persistence fails.
      });
    }, 250);

    return () => {
      if (workbenchSaveTimerRef.current !== null) {
        window.clearTimeout(workbenchSaveTimerRef.current);
        workbenchSaveTimerRef.current = null;
      }
    };
  }, [
    persistedWorkbenchStateDraft,
    saveTeamWorkbenchState
  ]);

  useEffect(() => {
    return () => {
      if (workbenchSaveTimerRef.current !== null) {
        window.clearTimeout(workbenchSaveTimerRef.current);
      }
      if (actionFeedbackTimerRef.current !== null) {
        window.clearTimeout(actionFeedbackTimerRef.current);
      }
    };
  }, []);

  const openDepartmentDialog = () => {
    const initialLabel = orgDepartments[0]?.label ?? null;
    setEditingDepartmentLabel(initialLabel);
    setDepartmentDraftName(initialLabel ?? "");
    setIsDepartmentDialogOpen(true);
  };

  const selectDepartmentForEditing = (label: string | null) => {
    setEditingDepartmentLabel(label);
    setDepartmentDraftName(label ?? "");
  };

  const saveDepartment = () => {
    const trimmedLabel = departmentDraftName.trim();
    if (!trimmedLabel) return false;

    if (editingDepartmentLabel === null) {
      if (orgDepartments.some((department) => department.label === trimmedLabel)) return false;
      setOrgDepartments((current) => [...current, { label: trimmedLabel }]);
      setEditingDepartmentLabel(trimmedLabel);
      setDepartmentDraftName(trimmedLabel);
      setNewOrgEmployeeDepartment(trimmedLabel);
      return true;
    }

    if (editingDepartmentLabel === trimmedLabel) return true;
    if (
      orgDepartments.some(
        (department) => department.label === trimmedLabel && department.label !== editingDepartmentLabel
      )
    ) {
      return false;
    }

    const nextDepartmentLabel = trimmedLabel;
    const previousDepartmentLabel = editingDepartmentLabel;

    setOrgDepartments((current) =>
      current.map((department) =>
        department.label === previousDepartmentLabel
          ? { ...department, label: nextDepartmentLabel }
          : department
      )
    );
    setOrgChartMembers((current) =>
      current.map((member) =>
        member.departmentLabel === previousDepartmentLabel
          ? { ...member, departmentLabel: nextDepartmentLabel }
          : member
      )
    );
    setManagedAgents((current) =>
      current.map((agent) =>
        getAgentDepartmentLabel(agent) === previousDepartmentLabel
          ? { ...agent, departmentLabel: nextDepartmentLabel }
          : agent
      )
    );
    setNewOrgEmployeeDepartment((current) =>
      current === previousDepartmentLabel ? nextDepartmentLabel : current
    );
    setBasicDraft((current) =>
      current.departmentLabel === previousDepartmentLabel
        ? { ...current, departmentLabel: nextDepartmentLabel }
        : current
    );
    setSelectedPoolDepartment((current) =>
      current === previousDepartmentLabel ? nextDepartmentLabel : current
    );
    setSelectedManagementDepartment((current) =>
      current === previousDepartmentLabel ? nextDepartmentLabel : current
    );
    setSelectedTemplateDepartment((current) =>
      current === previousDepartmentLabel ? nextDepartmentLabel : current
    );
    setSelectedGovernanceDepartment((current) =>
      current === previousDepartmentLabel ? nextDepartmentLabel : current
    );
    setEditingDepartmentLabel(nextDepartmentLabel);
    setDepartmentDraftName(nextDepartmentLabel);
    return true;
  };

  const deleteDepartment = () => {
    if (!editingDepartmentLabel || orgDepartments.length <= 1) return false;
    const deletingDepartmentLabel = editingDepartmentLabel;
    const fallbackDepartment =
      orgDepartments.find((department) => department.label !== deletingDepartmentLabel)?.label ?? null;
    if (!fallbackDepartment) return false;

    setOrgDepartments((current) =>
      current.filter((department) => department.label !== deletingDepartmentLabel)
    );
    setOrgChartMembers((current) =>
      current.map((member) =>
        member.departmentLabel === deletingDepartmentLabel
          ? { ...member, departmentLabel: fallbackDepartment }
          : member
      )
    );
    setManagedAgents((current) =>
      current.map((agent) =>
        getAgentDepartmentLabel(agent) === deletingDepartmentLabel
          ? { ...agent, departmentLabel: fallbackDepartment }
          : agent
      )
    );
    setNewOrgEmployeeDepartment((current) =>
      current === deletingDepartmentLabel ? fallbackDepartment : current
    );
    setBasicDraft((current) =>
      current.departmentLabel === deletingDepartmentLabel
        ? { ...current, departmentLabel: fallbackDepartment }
        : current
    );
    setSelectedPoolDepartment((current) =>
      current === deletingDepartmentLabel ? "全部" : current
    );
    setSelectedManagementDepartment((current) =>
      current === deletingDepartmentLabel ? "全部" : current
    );
    setSelectedTemplateDepartment((current) =>
      current === deletingDepartmentLabel ? "全部" : current
    );
    setSelectedGovernanceDepartment((current) =>
      current === deletingDepartmentLabel ? "全部" : current
    );
    setEditingDepartmentLabel(fallbackDepartment);
    setDepartmentDraftName(fallbackDepartment);
    showActionFeedback(`已删除部门 ${deletingDepartmentLabel}`, "warn");
    return true;
  };

  const addOrgEmployee = () => {
    const trimmedName = newOrgEmployeeName.trim();
    if (!trimmedName) return false;
    const nextAgent = createManagedAgent({
      name: trimmedName,
      role: newOrgEmployeeRole,
      departmentLabel: newOrgEmployeeDepartment
    });

    setManagedAgents((current) => [nextAgent, ...current]);
    setOrgChartMembers((current) => [
      ...current,
      {
        id: nextAgent.id,
        name: nextAgent.name,
        role: nextAgent.role,
        departmentLabel: newOrgEmployeeDepartment
      }
    ]);
    setSelectedAgentId(nextAgent.id);
    setSelectedPoolAgentId(nextAgent.id);
    setNewOrgEmployeeName("");
    showActionFeedback(
      `已新增员工 ${getAgentDisplayLabel({
        id: nextAgent.id,
        name: nextAgent.name,
        role: nextAgent.role
      })}`,
      "success"
    );
    return true;
  };

  const moveOrgMember = (memberId: string, nextDepartmentLabel: string) => {
    const movingMember = orgChartMembers.find((member) => member.id === memberId);
    setOrgChartMembers((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, departmentLabel: nextDepartmentLabel } : member
      )
    );
    setManagedAgents((current) =>
      current.map((agent) =>
        agent.id === memberId ? { ...agent, departmentLabel: nextDepartmentLabel } : agent
      )
    );
    if (movingMember) {
      showActionFeedback(
        `已将 ${getAgentDisplayLabel(movingMember)} 调整到 ${nextDepartmentLabel}`,
        "info"
      );
    }
  };

  const closeManagedEmployeeDialog = () => {
    setIsManageEmployeeDialogOpen(false);
    setNewManagedEmployeeName("");
    setNewManagedEmployeeRole("engineer");
  };

  const addManagedEmployee = () => {
    const trimmedName = newManagedEmployeeName.trim();
    if (!trimmedName) return false;
    const nextAgent = createManagedAgent({
      name: trimmedName,
      role: newManagedEmployeeRole,
      departmentLabel: departmentByRoleMap[newManagedEmployeeRole]
    });

    setManagedAgents((current) => [nextAgent, ...current]);
    setOrgChartMembers((current) => [
      ...current,
      {
        id: nextAgent.id,
        name: nextAgent.name,
        role: nextAgent.role,
        departmentLabel: departmentByRoleMap[nextAgent.role]
      }
    ]);
    setSelectedAgentId(nextAgent.id);
    setSelectedPoolAgentId(nextAgent.id);
    setSelectedManagementDepartment("全部");
    setSelectedPoolDepartment("全部");
    closeManagedEmployeeDialog();
    showActionFeedback(
      `已新增员工 ${getAgentDisplayLabel({
        id: nextAgent.id,
        name: nextAgent.name,
        role: nextAgent.role
      })}`,
      "success"
    );
    return true;
  };

  const duplicateManagedEmployee = () => {
    if (!selectedAgent) return;
    const nextAgent = createManagedAgent({
      name: `${selectedAgent.name} 副本`,
      role: selectedAgent.role,
      seed: selectedAgent,
      departmentLabel: selectedDepartmentLabel
    });

    setManagedAgents((current) => [nextAgent, ...current]);
    setOrgChartMembers((current) => [
      ...current,
      {
        id: nextAgent.id,
        name: nextAgent.name,
        role: nextAgent.role,
        departmentLabel: selectedDepartmentLabel
      }
    ]);
    setSelectedAgentId(nextAgent.id);
    setSelectedPoolAgentId(nextAgent.id);
    setSelectedManagementDepartment("全部");
    setSelectedPoolDepartment("全部");
    showActionFeedback(`已复制员工 ${getAgentDisplayLabel(selectedAgent)}`, "info");
  };

  const deleteManagedEmployee = () => {
    if (!selectedAgent) return;
    const deletedAgentId = selectedAgent.id;
    const deletedAgentLabel = getAgentDisplayLabel(selectedAgent);
    const fallbackAgent =
      managedAgents.find((agent) => agent.id !== deletedAgentId) ?? null;

    setManagedAgents((current) => current.filter((agent) => agent.id !== deletedAgentId));
    setOrgChartMembers((current) => current.filter((member) => member.id !== deletedAgentId));
    setGovernanceOverridesByAgentId((current) => {
      const next = { ...current };
      delete next[deletedAgentId];
      return next;
    });
    setGovernanceLevelByAgentId((current) => {
      const next = { ...current };
      delete next[deletedAgentId];
      return next;
    });
    setRoleAssignments((current) =>
      roleOrder.reduce(
        (next, role) => {
          next[role] = current[role] === deletedAgentId ? null : current[role];
          return next;
        },
        {} as Record<ForgeAgent["role"], string | null>
      )
    );
    setSelectedAgentId(fallbackAgent?.id ?? "");
    setSelectedPoolAgentId((current) => (current === deletedAgentId ? fallbackAgent?.id ?? "" : current));
    showActionFeedback(`已删除员工 ${deletedAgentLabel}`, "warn");
  };

  const equipAbilityPack = (pack: AbilityPack) => {
    if (!selectedAgent) return;
    const packRef: EquippedPackRef = { source: pack.source, id: pack.id };
    setEquippedPackByAgentId((current) => {
      const existing = current[selectedAgent.id] ?? [];
      if (existing.some((item) => isSameEquippedPackRef(item, packRef))) return current;
      return {
        ...current,
        [selectedAgent.id]: [...existing, packRef]
      };
    });
    setRemovedPackSkillIdsByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: {
        ...(current[selectedAgent.id] ?? {}),
        [getEquippedPackKey(packRef)]: []
      }
    }));
    setExpandedEquippedPackByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: {
        ...(current[selectedAgent.id] ?? {}),
        [getEquippedPackKey(packRef)]: false
      }
    }));
    setActiveAbilityTemplateTab("equipped");
    showActionFeedback(`已为 ${getAgentDisplayLabel(selectedAgent)} 装备 ${pack.name}`, "success");
  };

  const unequipSelectedPack = (packRef: EquippedPackRef) => {
    if (!selectedAgent) return;
    const packKey = getEquippedPackKey(packRef);
    const packName = resolveEquippedPack(packRef)?.name ?? "技能包";
    setEquippedPackByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: (current[selectedAgent.id] ?? []).filter(
        (item) => !isSameEquippedPackRef(item, packRef)
      )
    }));
    setRemovedPackSkillIdsByAgentId((current) => {
      const nextAgentState = { ...(current[selectedAgent.id] ?? {}) };
      delete nextAgentState[packKey];
      return {
        ...current,
        [selectedAgent.id]: nextAgentState
      };
    });
    setExpandedEquippedPackByAgentId((current) => {
      const nextAgentState = { ...(current[selectedAgent.id] ?? {}) };
      delete nextAgentState[packKey];
      return {
        ...current,
        [selectedAgent.id]: nextAgentState
      };
    });
    showActionFeedback(`已移除 ${packName}`, "warn");
  };

  const toggleEquippedPackExpanded = (packRef: EquippedPackRef) => {
    if (!selectedAgent) return;
    const packKey = getEquippedPackKey(packRef);
    setExpandedEquippedPackByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: {
        ...(current[selectedAgent.id] ?? {}),
        [packKey]: !(current[selectedAgent.id]?.[packKey] ?? false)
      }
    }));
  };

  const toggleEquippedPackSkillActivation = (packRef: EquippedPackRef, skillId: string) => {
    if (!selectedAgent) return;
    const packKey = getEquippedPackKey(packRef);
    const skill = skillCatalog.find((item) => item.id === skillId);
    const removedSkillIds = removedPackSkillIdsByAgentId[selectedAgent.id]?.[packKey] ?? [];
    const willReactivate = removedSkillIds.includes(skillId);
    setRemovedPackSkillIdsByAgentId((current) => {
      const existing = current[selectedAgent.id]?.[packKey] ?? [];
      const next = existing.includes(skillId)
        ? existing.filter((item) => item !== skillId)
        : [...existing, skillId];
      return {
        ...current,
        [selectedAgent.id]: {
          ...(current[selectedAgent.id] ?? {}),
          [packKey]: next
        }
      };
    });
    showActionFeedback(
      `${willReactivate ? "已激活" : "已移除"} ${skill?.name ?? "技能"}`,
      willReactivate ? "success" : "warn"
    );
  };

  const toggleAbilityPack = (packId: string) => {
    setSelectedRecommendedPackId((current) => (current === packId ? "" : packId));
  };

  const removeSkillFromSelectedAgent = (skillId: string) => {
    if (!selectedAgent) return;
    const skill = skillCatalog.find((item) => item.id === skillId);
    setManualSkillIdsByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: (current[selectedAgent.id] ?? []).filter((item) => item !== skillId)
    }));
    showActionFeedback(`已移除技能 ${skill?.name ?? "技能"}`, "warn");
  };

  const equipSingleSkill = (skillId: string) => {
    if (!selectedAgent) return;
    if (selectedAgent.skillIds.includes(skillId)) return;
    const skill = skillCatalog.find((item) => item.id === skillId);
    setManualSkillIdsByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: Array.from(
        new Set([...(current[selectedAgent.id] ?? []), skillId])
      )
    }));
    showActionFeedback(`已装备技能 ${skill?.name ?? "技能"}`, "success");
  };

  const createCustomAbilityPack = () => {
    const line =
      selectedAbilityLine !== "全部"
        ? selectedAbilityLine
        : selectedAgent
          ? skillCatalog.find((skill) => selectedAgent.skillIds.includes(skill.id))?.line ?? defaultSkillLine
          : defaultSkillLine;
    const id = `custom-pack-${Date.now()}`;
    const nextPack: CustomAbilityPack = {
      id,
      name: "新技能包",
      line,
      category: "通用",
      summary: "",
      skillIds: [],
      updatedAt: "刚刚"
    };

    setCustomAbilityPacks((current) => [nextPack, ...current]);
    setSelectedCustomPackId(id);
    setIsCustomPackDialogOpen(true);
    setCustomPackDialogPosition(null);
    showActionFeedback("已新建技能包", "info");
  };

  const syncCustomPackSkillIds = (nextSkillIds: string[]) => {
    if (!selectedCustomPack) return;

    setCustomPackDraft((current) => ({
      ...current,
      skillIds: nextSkillIds
    }));
    setCustomAbilityPacks((current) =>
      current.map((pack) =>
        pack.id === selectedCustomPack.id
          ? {
              ...pack,
              skillIds: nextSkillIds,
              updatedAt: "刚刚"
            }
          : pack
      )
    );
  };

  const addSkillToCustomPack = (skillId: string) => {
    if (customPackDraft.skillIds.includes(skillId)) return;
    syncCustomPackSkillIds([...customPackDraft.skillIds, skillId]);
  };

  const removeSkillFromCustomPack = (skillId: string) => {
    syncCustomPackSkillIds(customPackDraft.skillIds.filter((item) => item !== skillId));
  };

  const saveCustomAbilityPack = () => {
    if (!selectedCustomPack) return;
    const trimmedName = customPackDraft.name.trim();
    if (!trimmedName) return;

    setCustomAbilityPacks((current) =>
      current.map((pack) =>
        pack.id === selectedCustomPack.id
          ? {
              ...pack,
              name: trimmedName,
              line: customPackDraft.line,
              category: customPackDraft.category,
              summary: customPackDraft.summary.trim(),
              skillIds: [...customPackDraft.skillIds],
              updatedAt: "刚刚"
            }
          : pack
      )
    );
    setIsCustomPackDialogOpen(false);
    setCustomPackDialogPosition(null);
    showActionFeedback(`已保存技能包 ${trimmedName}`, "success");
  };

  const deleteCustomAbilityPack = () => {
    if (!selectedCustomPack) return;
    const deletingPackId = selectedCustomPack.id;
    const remainingPacks = customAbilityPacks.filter((pack) => pack.id !== deletingPackId);
    const deletingPackRef: EquippedPackRef = { source: "custom", id: deletingPackId };
    const deletingPackKey = getEquippedPackKey(deletingPackRef);

    setCustomAbilityPacks(remainingPacks);
    setEquippedPackByAgentId((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([agentId, packRefs]) => {
        next[agentId] = packRefs.filter((packRef) => !isSameEquippedPackRef(packRef, deletingPackRef));
      });
      return next;
    });
    setRemovedPackSkillIdsByAgentId((current) => {
      const next = { ...current };
      Object.keys(next).forEach((agentId) => {
        if (!next[agentId]) return;
        const nextAgentState = { ...next[agentId] };
        delete nextAgentState[deletingPackKey];
        next[agentId] = nextAgentState;
      });
      return next;
    });
    setExpandedEquippedPackByAgentId((current) => {
      const next = { ...current };
      Object.keys(next).forEach((agentId) => {
        if (!next[agentId]) return;
        const nextAgentState = { ...next[agentId] };
        delete nextAgentState[deletingPackKey];
        next[agentId] = nextAgentState;
      });
      return next;
    });
    setSelectedCustomPackId(remainingPacks[0]?.id ?? "");
    setIsCustomPackDialogOpen(false);
    setCustomPackDialogPosition(null);
    showActionFeedback(`已删除技能包 ${selectedCustomPack.name}`, "warn");
  };

  const openDangerAction = (action: PendingDangerAction) => {
    setPendingDangerAction(action);
  };

  const closeDangerAction = () => {
    setPendingDangerAction(null);
  };

  const confirmDangerAction = () => {
    if (!pendingDangerAction) return;

    if (pendingDangerAction.kind === "delete-department") {
      if (editingDepartmentLabel === pendingDangerAction.targetLabel && deleteDepartment()) {
        setIsDepartmentDialogOpen(false);
      }
      closeDangerAction();
      return;
    }

    if (pendingDangerAction.kind === "delete-employee") {
      if (selectedAgent?.id !== pendingDangerAction.targetId) {
        setSelectedAgentId(pendingDangerAction.targetId);
      }
      deleteManagedEmployee();
      closeDangerAction();
      return;
    }

    if (selectedCustomPack?.id !== pendingDangerAction.targetId) {
      setSelectedCustomPackId(pendingDangerAction.targetId);
    }
    deleteCustomAbilityPack();
    closeDangerAction();
  };

  const applyCustomSkillPack = () => {
    if (!selectedAgent) return;
    if (!selectedCustomPack) return;
    const packRef: EquippedPackRef = { source: "custom", id: selectedCustomPack.id };
    setEquippedPackByAgentId((current) => {
      const existing = current[selectedAgent.id] ?? [];
      if (existing.some((item) => isSameEquippedPackRef(item, packRef))) return current;
      return {
        ...current,
        [selectedAgent.id]: [...existing, packRef]
      };
    });
    setRemovedPackSkillIdsByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: {
        ...(current[selectedAgent.id] ?? {}),
        [getEquippedPackKey(packRef)]: []
      }
    }));
    setExpandedEquippedPackByAgentId((current) => ({
      ...current,
      [selectedAgent.id]: {
        ...(current[selectedAgent.id] ?? {}),
        [getEquippedPackKey(packRef)]: false
      }
    }));
    setActiveAbilityTemplateTab("equipped");
    showActionFeedback(
      `已为 ${getAgentDisplayLabel(selectedAgent)} 装备 ${selectedCustomPack.name}`,
      "success"
    );
  };

  const openSkillImportDialog = () => {
    setSkillImportGithubUrl("");
    setSkillImportState("idle");
    setSkillImportMessage("");
    setIsSkillImportDialogOpen(true);
  };

  const closeSkillImportDialog = () => {
    setIsSkillImportDialogOpen(false);
    setSkillImportGithubUrl("");
    setSkillImportState("idle");
    setSkillImportMessage("");
  };

  const openSkillDetailDialog = (skill: SkillCatalogItem) => {
    setEditingSkillId(skill.id);
    setSkillDetailDraft({
      name: skill.name,
      summary: skill.summary,
      line: skill.line,
      category: skill.category
    });
    setIsSkillDetailDialogOpen(true);
  };

  const updateSkillDetailLine = (line: string) => {
    const nextCategoryOptions = skillCategoryOptionsByLine[line] ?? [];

    setSkillDetailDraft((current) => ({
      ...current,
      line,
      category: nextCategoryOptions.includes(current.category)
        ? current.category
        : nextCategoryOptions[0] ?? current.category
    }));
  };

  const closeSkillDetailDialog = () => {
    setIsSkillDetailDialogOpen(false);
    setEditingSkillId("");
    setSkillDetailDraft({
      name: "",
      summary: "",
      line: defaultSkillLine,
      category: "通用"
    });
  };

  const saveSkillDetail = () => {
    if (!editingSkillId) return;
    const trimmedName = skillDetailDraft.name.trim();
    const trimmedSummary = skillDetailDraft.summary.trim();
    const trimmedCategory = skillDetailDraft.category.trim();
    if (!trimmedName || !trimmedSummary || !trimmedCategory) return;

    setSkillCatalog((current) =>
      current.map((skill) =>
        skill.id === editingSkillId
          ? {
              ...skill,
              name: trimmedName,
              summary: trimmedSummary,
              line: skillDetailDraft.line,
              category: trimmedCategory
            }
          : skill
      )
    );
    setHiddenSkillIds((current) => current.filter((skillId) => skillId !== editingSkillId));
    setSkillCatalogOverrides((current) => ({
      ...current,
      [editingSkillId]: {
        name: trimmedName,
        summary: trimmedSummary,
        line: skillDetailDraft.line,
        category: trimmedCategory
      }
    }));
    showActionFeedback(`已更新技能 ${trimmedName}`, "success");
    closeSkillDetailDialog();
  };

  const uninstallSkill = () => {
    if (!editingSkillId) return;
    const skillId = editingSkillId;
    const skillName = skillCatalog.find((skill) => skill.id === skillId)?.name ?? "技能";

    setSkillCatalog((current) => current.filter((skill) => skill.id !== skillId));
    setHiddenSkillIds((current) =>
      current.includes(skillId) ? current : [...current, skillId]
    );
    setManualSkillIdsByAgentId((current) =>
      Object.fromEntries(
        Object.entries(current).map(([agentId, skillIds]) => [
          agentId,
          skillIds.filter((item) => item !== skillId)
        ])
      )
    );
    setManagedAgents((current) =>
      current.map((agent) => ({
        ...agent,
        skillIds: agent.skillIds.filter((item) => item !== skillId)
      }))
    );
    setCustomAbilityPacks((current) =>
      current.map((pack) => ({
        ...pack,
        skillIds: pack.skillIds.filter((item) => item !== skillId)
      }))
    );
    setSkillCatalogOverrides((current) => {
      const nextOverrides = { ...current };
      delete nextOverrides[skillId];
      return nextOverrides;
    });
    setCustomPackDraft((current) => ({
      ...current,
      skillIds: current.skillIds.filter((item) => item !== skillId)
    }));
    showActionFeedback(`已卸载技能 ${skillName}`, "warn");
    closeSkillDetailDialog();
  };

  const submitSkillImport = async () => {
    const githubUrl = skillImportGithubUrl.trim();
    if (!githubUrl) return;

    setSkillImportState("submitting");
    setSkillImportMessage("");

    try {
      const response = await fetch("/api/forge/skills/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          githubUrl
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message || "Skill 下载失败");
      }

      setSkillImportState("success");
      setSkillImportMessage(`已下载到 ${payload.data.downloadPath}`);
      showActionFeedback("已下载技能到本机", "success");
    } catch (error) {
      setSkillImportState("error");
      setSkillImportMessage(
        error instanceof Error ? error.message : "Skill 下载失败，请稍后再试。"
      );
    }
  };

  const openCustomPackDialog = (packId: string) => {
    setSelectedCustomPackId(packId);
    setCustomPackDialogPosition(null);
    setIsCustomPackDialogOpen(true);
  };

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!customPackDragRef.current) return;
      const { startX, startY, originX, originY } = customPackDragRef.current;
      setCustomPackDialogPosition({
        x: originX + (event.clientX - startX),
        y: originY + (event.clientY - startY)
      });
    };

    const handlePointerUp = () => {
      customPackDragRef.current = null;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, []);

  const startCustomPackDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    customPackDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: customPackDialogPosition?.x ?? 0,
      originY: customPackDialogPosition?.y ?? 0
    };
  };

  const renderAgentSelector = () => (
    <div className={styles.agentSelectorRow}>
      {employeeRows.map((item) => (
        <button
          aria-pressed={item.agent.id === selectedAgent?.id}
          className={`${styles.agentSelectorButton} ${
            item.agent.id === selectedAgent?.id ? styles.agentSelectorButtonActive : ""
          }`}
          key={item.agent.id}
          onClick={() => focusAgentAcrossEmployeeChain(item.agent)}
          type="button"
        >
          <span className={styles.agentSelectorCopy}>
            <strong>{item.agent.name}</strong>
            <small>{getRoleLabel(item.agent.role)}</small>
          </span>
          <span className={getToneBadgeClassName(getAgentStatusTone(item.statusLabel))}>
            {item.statusLabel}
          </span>
        </button>
      ))}
    </div>
  );

  const renderEmployeePoolRow = useCallback(
    ({
      item,
      selected,
      onClick
    }: {
      item: (typeof employeeRows)[number];
      selected: boolean;
      onClick: () => void;
    }) => {
      const displayProfile = getAgentDisplayProfile(item.agent);
      const levelId =
        governanceLevelByAgentId[item.agent.id] ??
        permissionProfileToLevelMap[item.agent.permissionProfileId] ??
        "observer";
      const levelLabel =
        governanceLevels.find((level) => level.id === levelId)?.label ?? "L1 观察者";
      const levelBadgeLabel = levelLabel.split(" ")[0] ?? levelLabel;

      return (
        <button
          aria-label={`${item.agent.name} ${levelBadgeLabel} ${displayProfile.positionName} ${displayProfile.orgMetaLine}`}
          aria-pressed={selected}
          className={`${styles.employeePoolRow} ${selected ? styles.employeePoolRowActive : ""}`}
          key={item.agent.id}
          onClick={onClick}
          type="button"
        >
          <span className={styles.employeePoolPrimary}>
            <strong>{displayProfile.positionName}</strong>
            <span className={styles.employeePoolMeta}>
              <span className={styles.employeePoolLevel}>{levelBadgeLabel}</span>
              <small className={styles.employeePoolRole}>{displayProfile.orgMetaLine}</small>
            </span>
          </span>
          <span
            className={styles.employeePoolDepartment}
            data-department={item.departmentLabel}
          >
            <span aria-hidden="true" className={styles.employeePoolDepartmentDot} />
            {item.departmentLabel}
          </span>
        </button>
      );
    },
    [governanceLevelByAgentId]
  );

  const templateEmployeeListPanel = useMemo(
    () => (
      <section
        className={`${shellStyles.cardSoft} ${styles.templatesEmployees} ${styles.employeeListPanel}`}
      >
        <div className={styles.subsectionHeader}>
          <h3>员工列表</h3>
        </div>
        <div className={styles.departmentFilterRow}>
          {employeeDepartments.map((department) => (
            <button
              aria-pressed={selectedTemplateDepartment === department}
              className={`${styles.departmentFilterButton} ${
                selectedTemplateDepartment === department ? styles.departmentFilterButtonActive : ""
              }`}
              key={department}
              onClick={() => setSelectedTemplateDepartment(department)}
              type="button"
            >
              {department}
            </button>
          ))}
        </div>

        <div className={styles.employeePoolList} data-testid="template-employee-pool-list">
          {filteredTemplateRows.map((item) =>
            renderEmployeePoolRow({
              item,
              selected: item.agent.id === selectedAgent?.id,
              onClick: () => focusAgentAcrossEmployeeChain(item.agent)
            })
          )}
          {filteredTemplateRows.length === 0
            ? renderInlineEmptyState("当前部门下没有员工。")
            : null}
        </div>
      </section>
    ),
    [
      employeeDepartments,
      filteredTemplateRows,
      focusAgentAcrossEmployeeChain,
      renderEmployeePoolRow,
      selectedAgent?.id,
      selectedTemplateDepartment
    ]
  );

  const renderSkillListItem = ({
    skill,
    actionLabel,
    active = false,
    muted = false,
    onClick,
    actionNode,
    actionAriaLabel
  }: {
    skill: SkillCatalogItem;
    actionLabel?: string;
    active?: boolean;
    muted?: boolean;
    onClick?: () => void;
    actionNode?: React.ReactNode;
    actionAriaLabel?: string;
  }) => (
    <article
      aria-label={`查看技能详情 ${skill.name}`}
      className={`${styles.skillListItem} ${styles.skillListItemInteractive} ${
        active ? styles.skillListItemActive : ""
      } ${muted ? styles.skillListItemMuted : ""}`}
      key={skill.id}
      onClick={() => openSkillDetailDialog(skill)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openSkillDetailDialog(skill);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.skillListIcon} data-icon-kind="skill" aria-hidden="true">
        {skill.name.slice(0, 1).toUpperCase()}
      </div>
      <div className={styles.skillListBody}>
        <div className={styles.skillListHead}>
          <strong>{skill.name}</strong>
          <span className={styles.skillListCategory}>{skill.category}</span>
          {muted ? <span className={styles.skillListStateMuted}>已停用</span> : null}
        </div>
        <p className={styles.skillListSummary}>{skill.summary}</p>
        <div className={styles.skillListMeta}>
          <span>{skill.line}</span>
          {skill.usageGuide ? <span>{skill.usageGuide}</span> : null}
        </div>
      </div>
      {actionNode ? (
        <div
          className={styles.skillListAside}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actionNode}
        </div>
      ) : actionLabel ? (
        <button
          aria-label={actionAriaLabel ?? `${actionLabel}${skill.name}`}
          className={`${styles.skillListAction} ${
            muted && actionLabel === "激活" ? styles.skillListActionRestore : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </article>
  );

  const renderAbilityPackIcon = () => (
    <div className={styles.abilityPackMark} data-icon-kind="pack" aria-hidden="true">
      <span className={styles.abilityPackStack}>
        <span className={styles.abilityPackStackCard} />
        <span className={styles.abilityPackStackCard} />
        <span className={styles.abilityPackStackCard} />
      </span>
    </div>
  );

  const renderAbilityLineFilters = (options?: { showCounts?: boolean }) => (
    <div className={styles.departmentFilterRow}>
      {abilityLineOptions.map((line) => (
        <button
          aria-pressed={selectedAbilityLine === line}
          className={`${styles.departmentFilterButton} ${
            selectedAbilityLine === line ? styles.departmentFilterButtonActive : ""
          }`}
          key={line}
          onClick={() => setSelectedAbilityLine(line)}
          type="button"
        >
          {options?.showCounts ? `${line} ${abilityLineCounts[line] ?? 0}` : line}
        </button>
      ))}
    </div>
  );

  const renderOrganization = () => (
    <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>团队配置</h2>
        </div>
      </div>

      <div className={styles.builderLayout}>
        <section className={`${shellStyles.cardSoft} ${styles.builderResources} ${styles.employeeListPanel}`}>
          <div className={`${styles.builderSection} ${styles.employeeListPanel}`}>
            <div className={styles.subsectionHeader}>
              <h3>员工列表</h3>
            </div>
            <div className={styles.departmentFilterRow}>
              {employeeDepartments.map((department) => (
                <button
                  aria-pressed={selectedPoolDepartment === department}
                  className={`${styles.departmentFilterButton} ${
                    selectedPoolDepartment === department ? styles.departmentFilterButtonActive : ""
                  }`}
                  key={department}
                  onClick={() => setSelectedPoolDepartment(department)}
                  type="button"
                >
                  {department}
                </button>
              ))}
            </div>
            <div className={styles.employeePoolList}>
              {filteredEmployeeRows.map((item) => (
                renderEmployeePoolRow({
                  item,
                  selected: selectedPoolAgent?.id === item.agent.id,
                  onClick: () => {
                    syncSelectedAgentAcrossChain(item.agent.id);
                    setRoleAssignments((current) => ({
                      ...current,
                      [selectedBuilderRole]: item.agent.id
                    }));
                    ensureDefaultPacksForRole(item.agent.id, selectedBuilderRole);
                    showActionFeedback(
                      `已将 ${getAgentDisplayLabel(item.agent)} 绑定到 ${builderStageLabelMap[selectedBuilderRole]}`,
                      "success"
                    );
                  }
                })
              ))}
              {filteredEmployeeRows.length === 0 ? renderInlineEmptyState("没有匹配到员工。") : null}
            </div>
          </div>
        </section>

        <section className={`${shellStyles.cardSoft} ${styles.builderCanvas}`}>
          <div className={styles.managementToolbar}>
            <div>
              <h3>组建团队</h3>
            </div>
            <div className={styles.builderTemplateToolbar}>
              <div className={styles.builderTemplateModeSwitch}>
                <button
                  aria-pressed={!isCustomTeamTemplate}
                  className={`${styles.builderTemplateModeButton} ${
                    !isCustomTeamTemplate ? styles.builderTemplateModeButtonActive : ""
                  }`}
                  onClick={() =>
                    setSelectedTemplateId(
                      teamBuilderTemplates.find((template) => template.id !== customTeamTemplateId)?.id ??
                        defaultTeamWorkbenchSelectedTemplateId
                    )
                  }
                  type="button"
                >
                  选择团队
                </button>
                <button
                  aria-pressed={isCustomTeamTemplate}
                  className={`${styles.builderTemplateModeButton} ${
                    isCustomTeamTemplate ? styles.builderTemplateModeButtonActive : ""
                  }`}
                  onClick={() => setSelectedTemplateId(customTeamTemplateId)}
                  type="button"
                >
                  新建团队
                </button>
              </div>
              {!isCustomTeamTemplate ? (
                <div className={styles.builderTemplateRail}>
                  {teamBuilderTemplates.map((template) => (
                    <button
                      aria-pressed={selectedTemplate.id === template.id}
                      className={`${styles.templateChip} ${
                        selectedTemplate.id === template.id ? styles.templateChipActive : ""
                      }`}
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      type="button"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.builderCustomTemplateState}>
                  <strong>{selectedTemplate.name}</strong>
                  <span>{selectedTemplate.summary}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.builderChain} data-layout="wrapped" data-testid="team-builder-flow">
            {organizationRoles.map((roleItem) => {
                const assignedDisplayProfile = roleItem.assignedAgent
                  ? getAgentDisplayProfile(roleItem.assignedAgent)
                  : null;

                return (
                  <article
                    aria-label={`选择岗位 ${roleItem.roleLabel}`}
                    aria-pressed={selectedBuilderRoleState?.role === roleItem.role}
                    className={`${styles.builderRoleCard} ${
                      selectedBuilderRoleState?.role === roleItem.role ? styles.builderRoleCardActive : ""
                    } ${roleItem.assignedAgent ? "" : styles.builderRoleCardMissing}`}
                    key={roleItem.role}
                    onClick={() => selectBuilderRoleWithContext(roleItem.role)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectBuilderRoleWithContext(roleItem.role);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {roleItem.isConfigured ? (
                      <button
                        aria-label={`清空${roleItem.roleLabel}`}
                        className={styles.builderRoleDelete}
                        onClick={(event) => {
                          event.stopPropagation();
                          setRoleAssignments((current) => ({
                            ...current,
                            [roleItem.role]: null
                          }));
                          showActionFeedback(`已清空 ${roleItem.roleLabel}`, "warn");
                        }}
                        type="button"
                      >
                        ×
                      </button>
                    ) : null}
                    <div className={styles.builderRoleButton}>
                      <span className={styles.builderRoleHeading}>
                        <span aria-hidden="true" className={styles.builderRoleIcon}>
                          {builderStageIconMap[roleItem.role]}
                        </span>
                        <span className={styles.builderRoleTitle}>{roleItem.roleLabel}</span>
                      </span>
                      <span
                        className={`${styles.builderRolePerson} ${
                          roleItem.assignedAgent ? "" : styles.builderRolePersonMissing
                        }`}
                      >
                        {assignedDisplayProfile?.assignmentLabel ?? "未绑定员工"}
                      </span>
                    </div>
                  </article>
                );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  const renderOrgChart = () => {
    const departmentGroups = orgDepartments
      .map((department) => ({
        departmentLabel: department.label,
        members: orgChartMembers.filter((member) => member.departmentLabel === department.label)
      }));

    const closeDepartmentDialog = () => {
      setIsDepartmentDialogOpen(false);
      const initialLabel = orgDepartments[0]?.label ?? null;
      setEditingDepartmentLabel(initialLabel);
      setDepartmentDraftName(initialLabel ?? "");
    };

    const closeEmployeeDialog = () => {
      setIsEmployeeDialogOpen(false);
      setNewOrgEmployeeName("");
    };

    const renderOrgMemberCard = ({
      positionName,
      metaLine,
      ariaName,
      draggable = false,
      memberId,
      selectable = false,
      selected = false,
      onSelect,
      dropDepartmentLabel
    }: {
      positionName: string;
      metaLine: string;
      ariaName: string;
      draggable?: boolean;
      memberId?: string;
      selectable?: boolean;
      selected?: boolean;
      onSelect?: () => void;
      dropDepartmentLabel?: string;
    }) => (
      <article
        className={`${shellStyles.cardSoft} ${styles.orgTreeCard} ${
          selectable ? styles.orgTreeCardSelectable : ""
        } ${selected ? styles.orgTreeCardSelected : ""} ${
          draggable ? styles.orgTreeCardDraggable : ""
        }`}
        aria-label={selectable ? `选择员工 ${ariaName}` : undefined}
        aria-pressed={selectable ? selected : undefined}
        draggable={draggable}
        onClick={selectable ? onSelect : undefined}
        onDragEnd={draggable ? () => setDraggingOrgMemberId(null) : undefined}
        onDragStart={
          draggable && memberId
            ? (event) => {
                event.dataTransfer.setData("text/plain", memberId);
                event.dataTransfer.effectAllowed = "move";
                setDraggingOrgMemberId(memberId);
              }
            : undefined
        }
        onDragOver={
          dropDepartmentLabel
            ? (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            : undefined
        }
        onDrop={
          dropDepartmentLabel
            ? (event) => {
                event.preventDefault();
                const draggingMemberId = event.dataTransfer.getData("text/plain") || draggingOrgMemberId;
                if (draggingMemberId) {
                  moveOrgMember(draggingMemberId, dropDepartmentLabel);
                  setDraggingOrgMemberId(null);
                }
              }
            : undefined
        }
        onKeyDown={
          selectable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.();
                }
              }
            : undefined
        }
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
      >
        <strong>{positionName}</strong>
        <small>{metaLine}</small>
      </article>
    );

    return (
      <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>组织架构</h2>
        </div>
      </div>

        <section
          aria-label="组织架构图"
          className={`${shellStyles.cardSoft} ${styles.orgChartCanvas}`}
        >
          <div className={styles.orgActionBar}>
            <button
              className={shellStyles.secondaryButton}
              onClick={openDepartmentDialog}
              type="button"
            >
              编辑部门
            </button>
            <button
              className={shellStyles.primaryButton}
              onClick={() => setIsEmployeeDialogOpen(true)}
              type="button"
            >
              新增员工
            </button>
          </div>

          {isDepartmentDialogOpen ? (
            <ForgeEditDialog
              ariaLabel="编辑部门"
              dialogClassName={styles.orgDepartmentDialog}
              eyebrow="团队维护"
              footer={
                <>
                  {editingDepartmentLabel !== null ? (
                    <button
                      className={styles.orgDeleteButton}
                      disabled={orgDepartments.length <= 1}
                      onClick={() =>
                        openDangerAction({
                          kind: "delete-department",
                          targetLabel: editingDepartmentLabel
                        })
                      }
                      type="button"
                    >
                      删除部门
                    </button>
                  ) : null}
                  <button
                    className={shellStyles.secondaryButton}
                    onClick={closeDepartmentDialog}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className={shellStyles.primaryButton}
                    onClick={() => {
                      if (saveDepartment()) {
                        closeDepartmentDialog();
                      }
                    }}
                    type="button"
                  >
                    {editingDepartmentLabel === null ? "确认新增" : "保存修改"}
                  </button>
                </>
              }
              onClose={closeDepartmentDialog}
              title="编辑部门"
              variant="anchored"
            >
                <div className={styles.orgDepartmentEditor}>
                  <div className={styles.orgDepartmentList}>
                    {orgDepartments.map((department) => (
                      <button
                        aria-pressed={editingDepartmentLabel === department.label}
                        className={`${styles.orgDepartmentListButton} ${
                          editingDepartmentLabel === department.label
                            ? styles.orgDepartmentListButtonActive
                            : ""
                        }`}
                        key={department.label}
                        onClick={() => selectDepartmentForEditing(department.label)}
                        type="button"
                      >
                        {department.label}
                      </button>
                    ))}
                    <button
                      className={styles.orgDepartmentAddButton}
                      onClick={() => selectDepartmentForEditing(null)}
                      type="button"
                    >
                      + 新增部门
                    </button>
                  </div>
                  <div className={styles.orgDepartmentEditorForm}>
                    <label className={styles.orgFieldStack}>
                      <span className={shellStyles.fieldLabel}>部门名称</span>
                      <input
                        className={styles.orgTextInput}
                        onChange={(event) => setDepartmentDraftName(event.target.value)}
                        placeholder="请输入部门名称"
                        type="text"
                        value={departmentDraftName}
                      />
                    </label>
                  </div>
                </div>
            </ForgeEditDialog>
          ) : null}

          {isEmployeeDialogOpen ? (
            <ForgeEditDialog
              ariaLabel="新增员工"
              eyebrow="团队维护"
              footer={
                <>
                  <button
                    className={shellStyles.secondaryButton}
                    onClick={closeEmployeeDialog}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className={shellStyles.primaryButton}
                    onClick={() => {
                      if (addOrgEmployee()) {
                        closeEmployeeDialog();
                      }
                    }}
                    type="button"
                  >
                    确认新增员工
                  </button>
                </>
              }
              onClose={closeEmployeeDialog}
              title="新增员工"
              variant="anchored"
            >
                <div className={styles.orgDialogFormGrid}>
                  <label className={styles.orgFieldStack}>
                    <span className={shellStyles.fieldLabel}>员工名称</span>
                    <input
                      aria-label="员工名称"
                      className={styles.orgTextInput}
                      onChange={(event) => setNewOrgEmployeeName(event.target.value)}
                      type="text"
                      value={newOrgEmployeeName}
                    />
                  </label>
                  <label className={styles.orgFieldStack}>
                    <span className={shellStyles.fieldLabel}>员工角色</span>
                    <select
                      aria-label="员工角色"
                      className={styles.orgSelect}
                      onChange={(event) => setNewOrgEmployeeRole(event.target.value as ForgeAgent["role"])}
                      value={newOrgEmployeeRole}
                    >
                      {roleOrder.map((role) => (
                        <option key={role} value={role}>
                          {getRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.orgFieldStack}>
                    <span className={shellStyles.fieldLabel}>所属部门</span>
                    <select
                      aria-label="所属部门"
                      className={styles.orgSelect}
                      onChange={(event) => setNewOrgEmployeeDepartment(event.target.value)}
                      value={newOrgEmployeeDepartment}
                    >
                      {orgDepartments.map((department) => (
                        <option key={department.label} value={department.label}>
                          {department.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
            </ForgeEditDialog>
          ) : null}

          <div
            aria-label="AI 公司组织树"
            className={styles.orgTreeStage}
            role="tree"
          >
            <section className={styles.orgRootNode} aria-label="公司 CEO" role="region">
              {renderOrgMemberCard({
                positionName: "CEO",
                metaLine: "openclaw",
                ariaName: "openclaw"
              })}
            </section>

            {departmentGroups.length > 0 ? <div className={styles.orgCompanyConnector} aria-hidden="true" /> : null}

            <div className={styles.orgDepartmentGrid}>
              {departmentGroups.map((group) => (
                <section
                  aria-label={`部门 ${group.departmentLabel}`}
                  className={styles.orgDepartmentLane}
                  key={group.departmentLabel}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const memberId = event.dataTransfer.getData("text/plain") || draggingOrgMemberId;
                    if (memberId) {
                      moveOrgMember(memberId, group.departmentLabel);
                      setDraggingOrgMemberId(null);
                    }
                  }}
                  role="region"
                >
                  <div className={styles.orgDepartmentNode}>
                    <span className={styles.orgDepartmentNodeTitle}>{group.departmentLabel}</span>
                  </div>
                  <div className={styles.orgDepartmentMembers}>
                    {group.members.map((member) => (
                      <React.Fragment key={member.id}>
                        {(() => {
                          const displayProfile = getAgentDisplayProfile(member);

                          return renderOrgMemberCard({
                            positionName: displayProfile.positionName,
                            metaLine: displayProfile.orgMetaLine,
                            ariaName: member.name,
                            draggable: true,
                            memberId: member.id,
                            dropDepartmentLabel: group.departmentLabel,
                            selectable: true,
                            selected: member.id === selectedAgentId,
                            onSelect: () => {
                              const matchedAgent = managedAgents.find((agent) => agent.id === member.id);
                              if (matchedAgent) {
                                focusAgentAcrossEmployeeChain(matchedAgent);
                              }
                            }
                          });
                        })()}
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderEmployees = () => (
    <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>员工管理</h2>
        </div>
      </div>

      {isManageEmployeeDialogOpen ? (
        <ForgeEditDialog
          ariaLabel="新增员工"
          footer={
            <>
              <button
                className={shellStyles.secondaryButton}
                onClick={closeManagedEmployeeDialog}
                type="button"
              >
                取消
              </button>
              <button className={shellStyles.primaryButton} onClick={addManagedEmployee} type="button">
                确认新增
              </button>
            </>
          }
          onClose={closeManagedEmployeeDialog}
          title="新增员工"
          variant="anchored"
        >
            <div className={styles.orgDialogFormGrid}>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>员工名称</span>
                <input
                  aria-label="员工名称"
                  className={styles.orgTextInput}
                  onChange={(event) => setNewManagedEmployeeName(event.target.value)}
                  type="text"
                  value={newManagedEmployeeName}
                />
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>员工角色</span>
                <select
                  aria-label="员工角色"
                  className={styles.orgSelect}
                  onChange={(event) => setNewManagedEmployeeRole(event.target.value as ForgeAgent["role"])}
                  value={newManagedEmployeeRole}
                >
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
        </ForgeEditDialog>
      ) : null}

      {editingEmployeeSection === "basic" ? (
        <ForgeEditDialog
          ariaLabel="编辑基础"
          footer={
            <>
              <button
                className={shellStyles.secondaryButton}
                onClick={closeEmployeeSectionEditor}
                type="button"
              >
                取消
              </button>
              <button
                className={shellStyles.primaryButton}
                disabled={isSavingAbilityDraft}
                onClick={() => {
                  void saveBasicDraft();
                }}
                type="button"
              >
                {isSavingAbilityDraft ? "保存中..." : "保存基础"}
              </button>
            </>
          }
          onClose={closeEmployeeSectionEditor}
          title="编辑基础"
          variant="anchored"
        >
            <div className={styles.orgDialogFormGrid}>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>员工名称</span>
                <input
                  aria-label="员工名称"
                  className={styles.orgTextInput}
                  onChange={(event) =>
                    setBasicDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  type="text"
                  value={basicDraft.name}
                />
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>员工角色</span>
                <select
                  aria-label="员工角色"
                  className={styles.orgSelect}
                  onChange={(event) =>
                    setBasicDraft((current) => ({
                      ...current,
                      role: event.target.value as ForgeAgent["role"]
                    }))
                  }
                  value={basicDraft.role}
                >
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>所属部门</span>
                <select
                  aria-label="所属部门"
                  className={styles.orgSelect}
                  onChange={(event) =>
                    setBasicDraft((current) => ({
                      ...current,
                      departmentLabel: event.target.value
                    }))
                  }
                  value={basicDraft.departmentLabel}
                >
                  {orgDepartments.map((department) => (
                    <option key={department.label} value={department.label}>
                      {department.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>模型选项</span>
                <select
                  aria-label="模型选项"
                  className={styles.orgSelect}
                  onChange={(event) =>
                    setBasicDraft((current) => ({
                      ...current,
                      runnerId: event.target.value
                    }))
                  }
                  value={basicDraft.runnerId}
                >
                  {snapshot.runners.map((runner) => (
                    <option key={runner.id} value={runner.id}>
                      {runner.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
        </ForgeEditDialog>
      ) : null}

      {editingEmployeeSection === "ability" ? (
        <ForgeEditDialog
          ariaLabel="编辑能力"
          bodyClassName={styles.detailSection}
          footer={
            <>
              <button
                className={shellStyles.secondaryButton}
                onClick={closeEmployeeSectionEditor}
                type="button"
              >
                取消
              </button>
              <button
                className={shellStyles.primaryButton}
                disabled={isSavingAbilityDraft}
                onClick={() => {
                  void saveAbilityDraft();
                }}
                type="button"
              >
                {isSavingAbilityDraft ? "保存中..." : "保存能力"}
              </button>
            </>
          }
          onClose={closeEmployeeSectionEditor}
          title="编辑能力"
          variant="anchored"
        >
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>人格设定</span>
                <textarea
                  aria-label="人格设定"
                  className={shellStyles.textarea}
                  onChange={(event) =>
                    setAbilityDraft((current) => ({ ...current, persona: event.target.value }))
                  }
                  value={abilityDraft.persona}
                />
              </label>
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>Prompt 模板</span>
                <select
                  aria-label="Prompt 模板"
                  className={shellStyles.select}
                  onChange={(event) =>
                    setAbilityDraft((current) => ({
                      ...current,
                      promptTemplateId: event.target.value
                    }))
                  }
                  value={abilityDraft.promptTemplateId}
                >
                  {snapshot.promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>技能包</span>
                <textarea
                  aria-label="技能包"
                  className={shellStyles.textarea}
                  onChange={(event) =>
                    setAbilityDraft((current) => ({
                      ...current,
                      skillIdsText: event.target.value
                    }))
                  }
                  value={abilityDraft.skillIdsText}
                />
              </label>
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>知识来源</span>
                <textarea
                  aria-label="知识来源"
                  className={shellStyles.textarea}
                  onChange={(event) =>
                    setAbilityDraft((current) => ({
                      ...current,
                      knowledgeSourcesText: event.target.value
                    }))
                  }
                  value={abilityDraft.knowledgeSourcesText}
                />
              </label>
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>默认提示词</span>
                <textarea
                  aria-label="默认提示词"
                  className={shellStyles.textarea}
                  onChange={(event) =>
                    setAbilityDraft((current) => ({
                      ...current,
                      systemPrompt: event.target.value
                    }))
                  }
                  value={abilityDraft.systemPrompt}
                  />
                </label>
        </ForgeEditDialog>
      ) : null}

      {editingEmployeeSection === "runtime" ? (
        <ForgeEditDialog
          ariaLabel="编辑运行"
          footer={
            <>
              <button
                className={shellStyles.secondaryButton}
                onClick={closeEmployeeSectionEditor}
                type="button"
              >
                取消
              </button>
              <button
                className={shellStyles.primaryButton}
                disabled={isSavingAbilityDraft}
                onClick={() => {
                  void saveRuntimeDraft();
                }}
                type="button"
              >
                {isSavingAbilityDraft ? "保存中..." : "保存运行"}
              </button>
            </>
          }
          onClose={closeEmployeeSectionEditor}
          title="编辑运行"
          variant="anchored"
        >
            <div className={styles.orgDialogFormGrid}>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>运行方式</span>
                <select
                  aria-label="运行方式"
                  className={styles.orgSelect}
                  onChange={(event) =>
                    setRuntimeDraft((current) => ({
                      ...current,
                      ownerMode: event.target.value as ForgeAgent["ownerMode"]
                    }))
                  }
                  value={runtimeDraft.ownerMode}
                >
                  <option value="human-approved">人工确认</option>
                  <option value="review-required">复核后执行</option>
                  <option value="auto-execute">自动执行</option>
                </select>
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>权限配置</span>
                <input
                  aria-label="权限配置"
                  className={styles.orgTextInput}
                  onChange={(event) =>
                    setRuntimeDraft((current) => ({
                      ...current,
                      permissionProfileId: event.target.value
                    }))
                  }
                  type="text"
                  value={runtimeDraft.permissionProfileId}
                />
              </label>
              <label className={styles.orgFieldStack}>
                <span className={shellStyles.fieldLabel}>治理策略</span>
                <input
                  aria-label="治理策略"
                  className={styles.orgTextInput}
                  onChange={(event) =>
                    setRuntimeDraft((current) => ({
                      ...current,
                      policyId: event.target.value
                    }))
                  }
                  type="text"
                  value={runtimeDraft.policyId}
                />
              </label>
            </div>
        </ForgeEditDialog>
      ) : null}

      <div className={styles.managementLayout}>
        <section className={`${shellStyles.cardSoft} ${styles.managementList} ${styles.employeeListPanel}`}>
          <div className={styles.subsectionHeader}>
            <h3>员工列表</h3>
          </div>
          <div className={styles.departmentFilterRow}>
            {employeeDepartments.map((department) => (
              <button
                aria-pressed={selectedManagementDepartment === department}
                className={`${styles.departmentFilterButton} ${
                  selectedManagementDepartment === department ? styles.departmentFilterButtonActive : ""
                }`}
                key={department}
                onClick={() => setSelectedManagementDepartment(department)}
                type="button"
              >
                {department}
              </button>
            ))}
          </div>
          <div className={styles.employeePoolList}>
            {filteredManagementRows.map((item) =>
              renderEmployeePoolRow({
                item,
                selected: item.agent.id === selectedAgent?.id,
                onClick: () => focusAgentAcrossEmployeeChain(item.agent)
              })
            )}
            {filteredManagementRows.length === 0
              ? renderInlineEmptyState("当前部门下没有员工。")
              : null}
          </div>
        </section>

        <section className={`${shellStyles.cardSoft} ${styles.managementDetail}`}>
          <div className={styles.managementDetailTop}>
            <div>
              <h3>{selectedAgent?.name ?? "当前没有员工"}</h3>
              <span className={styles.managementMeta}>
                {selectedAgent
                  ? `${getRoleLabel(selectedAgent.role)} · ${selectedDepartmentLabel}`
                  : "未绑定角色"}
              </span>
            </div>
            <div className={styles.managementActions}>
              <span className={getToneBadgeClassName(selectedStatusTone)}>{selectedStatusLabel}</span>
              <button
                aria-label="新增员工"
                className={styles.managementIconButton}
                onClick={() => setIsManageEmployeeDialogOpen(true)}
                type="button"
              >
                +
              </button>
              <button
                aria-label="复制员工"
                className={styles.managementIconButton}
                onClick={duplicateManagedEmployee}
                type="button"
              >
                ⧉
              </button>
              <button
                aria-label="删除员工"
                className={styles.managementIconButton}
                onClick={() => {
                  if (!selectedAgent) return;
                  openDangerAction({
                    kind: "delete-employee",
                    targetId: selectedAgent.id,
                    targetLabel: getAgentDisplayLabel(selectedAgent)
                  });
                }}
                type="button"
              >
                ×
              </button>
            </div>
          </div>

          <div className={styles.detailTabRow}>
            {employeeDetailTabs.map((tab) => (
              <button
                aria-pressed={employeeDetailTab === tab.id}
                className={`${styles.detailTabButton} ${
                  employeeDetailTab === tab.id ? styles.detailTabButtonActive : ""
                }`}
                key={tab.id}
                onClick={() => setEmployeeDetailTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {employeeDetailTab === "basic" ? (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionActions}>
                <button
                  aria-label="编辑基础"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeSectionEditor("basic")}
                  type="button"
                >
                  <span aria-hidden="true">✎</span>
                  编辑
                </button>
                <button
                  aria-label="打开基础文档"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeMarkdown("basic")}
                  type="button"
                >
                  <span aria-hidden="true">↗</span>
                  打开文档
                </button>
              </div>
              <div className={styles.keyValueGrid}>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>姓名</span>
                  <strong>{selectedAgent?.name ?? "未配置"}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>角色</span>
                  <strong>{selectedAgent ? getRoleLabel(selectedAgent.role) : "未配置"}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>部门</span>
                  <strong>{selectedDepartmentLabel}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>模型</span>
                  <strong>{selectedRunnerLabel}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>状态</span>
                  <strong>{selectedStatusLabel}</strong>
                </article>
              </div>
            </div>
          ) : null}

          {employeeDetailTab === "ability" ? (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionActions}>
                <button
                  aria-label="编辑能力"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeSectionEditor("ability")}
                  type="button"
                >
                  <span aria-hidden="true">✎</span>
                  编辑
                </button>
                <button
                  aria-label="打开能力文档"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeMarkdown("ability")}
                  type="button"
                >
                  <span aria-hidden="true">↗</span>
                  打开文档
                </button>
              </div>
              <div className={styles.detailTextBlock}>
                <strong>人格设定</strong>
                <p>{selectedAgent?.persona ?? "当前没有配置人格描述。"}</p>
              </div>
              <div className={styles.keyValueGrid}>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>Prompt 模板</span>
                  <strong>{selectedPromptTemplate?.title ?? "未绑定 Prompt 模板"}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>技能包</span>
                  <strong>{selectedSkillNames.join(" / ") || "未绑定技能包"}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>知识来源</span>
                  <strong>{selectedAgent?.knowledgeSources.join(" / ") || "未配置知识来源"}</strong>
                </article>
              </div>
            </div>
          ) : null}

          {employeeDetailTab === "runtime" ? (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionActions}>
                <button
                  aria-label="编辑运行"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeSectionEditor("runtime")}
                  type="button"
                >
                  <span aria-hidden="true">✎</span>
                  编辑
                </button>
                <button
                  aria-label="打开运行文档"
                  className={styles.sectionActionButton}
                  onClick={() => openEmployeeMarkdown("runtime")}
                  type="button"
                >
                  <span aria-hidden="true">↗</span>
                  打开文档
                </button>
              </div>
              <div className={styles.keyValueGrid}>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>模型与后端</span>
                  <strong>{selectedRunnerLabel}</strong>
                </article>
                {showCeoExecutionSummary ? (
                  <article className={styles.keyValueCard}>
                    <span className={shellStyles.fieldLabel}>执行后端</span>
                    <strong>{snapshot.ceoExecutionBackendLabel}</strong>
                  </article>
                ) : null}
                {showCeoExecutionSummary && snapshot.ceoExecutionStatusLabel ? (
                  <article className={styles.keyValueCard}>
                    <span className={shellStyles.fieldLabel}>后端状态</span>
                    <strong>{snapshot.ceoExecutionStatusLabel}</strong>
                    {snapshot.ceoExecutionStatusSummary ? (
                      <span className={styles.keyValueMeta}>{snapshot.ceoExecutionStatusSummary}</span>
                    ) : null}
                  </article>
                ) : null}
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>运行方式</span>
                  <strong>{getOwnerModeLabel(selectedAgent?.ownerMode ?? "human-approved")}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>权限配置</span>
                  <strong>{selectedAgent?.permissionProfileId ?? "未配置权限"}</strong>
                </article>
                <article className={styles.keyValueCard}>
                  <span className={shellStyles.fieldLabel}>治理策略</span>
                  <strong>{selectedAgent?.policyId ?? "未配置治理策略"}</strong>
                </article>
                {showCeoExecutionSummary ? (
                  <article className={styles.keyValueCard}>
                    <span className={shellStyles.fieldLabel}>总控角色</span>
                    <strong>{snapshot.ceoExecutionRoleLabel}</strong>
                  </article>
                ) : null}
                {showCeoExecutionSummary ? (
                  <article className={styles.keyValueCard}>
                    <span className={shellStyles.fieldLabel}>执行模式</span>
                    <strong>{snapshot.ceoExecutionModeLabel}</strong>
                  </article>
                ) : null}
              </div>
              {selectedAgentContextPreview ? (
                <div className={styles.contextPreviewSection}>
                  <div className={styles.detailTextBlock}>
                    <strong>当前上下文预览</strong>
                    <p>
                      {selectedAgentContextPreview.projectContext.projectName} ·{" "}
                      {selectedAgentContextPreview.projectContext.currentNode ?? "未选中工作节点"} ·{" "}
                      {selectedAgentContextPreview.projectContext.currentStage ?? "待进入阶段"}
                    </p>
                    <span className={styles.keyValueMeta}>
                      {selectedAgentContextPreview.projectContext.goal || "当前没有可展示的项目目标摘要。"}
                    </span>
                  </div>
                  <div className={styles.keyValueGrid}>
                    <article className={styles.keyValueCard}>
                      <span className={shellStyles.fieldLabel}>当前项目</span>
                      <strong>{selectedAgentContextPreview.projectContext.projectName}</strong>
                    </article>
                    <article className={styles.keyValueCard}>
                      <span className={shellStyles.fieldLabel}>当前节点</span>
                      <strong>{selectedAgentContextPreview.projectContext.currentNode ?? "未选中节点"}</strong>
                    </article>
                    <article className={styles.keyValueCard}>
                      <span className={shellStyles.fieldLabel}>当前阶段</span>
                      <strong>{selectedAgentContextPreview.projectContext.currentStage ?? "待进入阶段"}</strong>
                    </article>
                    <article className={styles.keyValueCard}>
                      <span className={shellStyles.fieldLabel}>当前阻塞</span>
                      <strong>
                        {selectedAgentContextPreview.projectContext.blockers.length
                          ? selectedAgentContextPreview.projectContext.blockers.join(" / ")
                          : "当前没有阻塞"}
                      </strong>
                    </article>
                  </div>
                  <div className={styles.contextPreviewGrid}>
                    <article className={styles.contextPreviewCard}>
                      <span className={shellStyles.fieldLabel}>可用工具</span>
                      <div className={styles.contextPreviewList}>
                        {selectedAgentContextPreview.tools.map((tool) => (
                          <div className={styles.contextPreviewItem} key={tool.id}>
                            <strong>
                              {tool.label} · {agentContextToolModeLabel[tool.mode]}
                            </strong>
                            <span className={styles.keyValueMeta}>{tool.summary}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className={styles.contextPreviewCard}>
                      <span className={shellStyles.fieldLabel}>工作区路径</span>
                      <div className={styles.contextPreviewList}>
                        <div className={styles.contextPreviewItem}>
                          <strong>Workspace</strong>
                          <code className={styles.contextPathValue}>
                            {selectedAgentContextPreview.paths.workspaceRoot}
                          </code>
                        </div>
                        <div className={styles.contextPreviewItem}>
                          <strong>Artifacts</strong>
                          <code className={styles.contextPathValue}>
                            {selectedAgentContextPreview.paths.artifactsRoot}
                          </code>
                        </div>
                        <div className={styles.contextPreviewItem}>
                          <strong>Knowledge</strong>
                          <code className={styles.contextPathValue}>
                            {selectedAgentContextPreview.paths.knowledgeRoot}
                          </code>
                        </div>
                        <div className={styles.contextPreviewItem}>
                          <strong>Skills</strong>
                          <code className={styles.contextPathValue}>
                            {selectedAgentContextPreview.paths.skillsRoot}
                          </code>
                        </div>
                      </div>
                    </article>
                    <article className={styles.contextPreviewCard}>
                      <span className={shellStyles.fieldLabel}>关键交付物</span>
                      <div className={styles.contextPreviewList}>
                        {selectedAgentContextPreview.deliverables.length ? (
                          selectedAgentContextPreview.deliverables.map((deliverable) => (
                            <div className={styles.contextPreviewItem} key={deliverable.id}>
                              <strong>
                                {deliverable.label} · {deliverable.status}
                              </strong>
                              <span className={styles.keyValueMeta}>{deliverable.title}</span>
                            </div>
                          ))
                        ) : (
                          <div className={styles.contextPreviewItem}>
                            <strong>当前没有关键交付物</strong>
                            <span className={styles.keyValueMeta}>
                              当前项目还没有沉淀到该岗位可直接消费的交付物。
                            </span>
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>技能配置</h2>
        </div>
      </div>

      {isSkillImportDialogOpen ? (
        <ForgeEditDialog
          ariaLabel="下载技能"
          bodyClassName={styles.detailSection}
          footer={
            <>
              <button
                className={shellStyles.secondaryButton}
                onClick={closeSkillImportDialog}
                type="button"
              >
                取消
              </button>
              <button
                className={shellStyles.primaryButton}
                disabled={!skillImportGithubUrl.trim() || skillImportState === "submitting"}
                onClick={submitSkillImport}
                type="button"
              >
                {skillImportState === "submitting" ? "下载中..." : "确认下载"}
              </button>
            </>
          }
          onClose={closeSkillImportDialog}
          title="下载技能"
          variant="anchored"
        >
              <div className={styles.detailTextBlock}>
                <strong>从 GitHub 下载 skill</strong>
                <p>输入 GitHub 仓库链接后，会把该 skill ZIP 下载到本机。</p>
              </div>
              <label className={shellStyles.fieldStack}>
                <span className={shellStyles.fieldLabel}>GitHub 链接</span>
                <input
                  aria-label="GitHub 链接"
                  className={styles.orgTextInput}
                  onChange={(event) => setSkillImportGithubUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                  type="url"
                  value={skillImportGithubUrl}
                />
              </label>
              {skillImportMessage ? (
                <p
                  className={
                    skillImportState === "error"
                      ? styles.skillImportMessageError
                      : styles.skillImportMessage
                  }
                >
                  {skillImportMessage}
                </p>
              ) : null}
        </ForgeEditDialog>
      ) : null}

      {isSkillDetailDialogOpen && editingSkill ? (
        <ForgeEditDialog
          ariaLabel="技能详情"
          footer={
            <>
              <button
                className={styles.destructiveButton}
                onClick={uninstallSkill}
                type="button"
              >
                卸载技能
              </button>
              <div className={styles.customPackActionGroup}>
                <button
                  className={styles.sectionActionButton}
                  onClick={closeSkillDetailDialog}
                  type="button"
                >
                  取消
                </button>
                <button
                  className={styles.abilityPackButton}
                  onClick={saveSkillDetail}
                  type="button"
                >
                  保存修改
                </button>
              </div>
            </>
          }
          onClose={closeSkillDetailDialog}
          title="技能详情"
          variant="centered"
        >
            <div className={styles.detailSection}>
              <div className={styles.orgDialogFormGrid}>
                <label className={shellStyles.fieldStack}>
                  <span className={shellStyles.fieldLabel}>类别标签</span>
                  <select
                    aria-label="类别标签"
                    className={styles.orgTextInput}
                    onChange={(event) => updateSkillDetailLine(event.target.value)}
                    value={skillDetailDraft.line}
                  >
                    {skillLineOptions.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={shellStyles.fieldStack}>
                  <span className={shellStyles.fieldLabel}>技能分类</span>
                  <input
                    aria-label="技能分类"
                    className={styles.orgTextInput}
                    list="skill-detail-category-options"
                    onChange={(event) =>
                      setSkillDetailDraft((current) => ({
                        ...current,
                        category: event.target.value
                      }))
                    }
                    type="text"
                    value={skillDetailDraft.category}
                  />
                  <datalist id="skill-detail-category-options">
                    {skillDetailCategoryOptions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>
                <label className={shellStyles.fieldStack}>
                  <span className={shellStyles.fieldLabel}>技能名称</span>
                  <input
                    aria-label="技能名称"
                    className={styles.orgTextInput}
                    onChange={(event) =>
                      setSkillDetailDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    type="text"
                    value={skillDetailDraft.name}
                  />
                </label>
                <label className={shellStyles.fieldStack}>
                  <span className={shellStyles.fieldLabel}>技能介绍</span>
                  <textarea
                    aria-label="技能介绍"
                    className={shellStyles.textarea}
                    onChange={(event) =>
                      setSkillDetailDraft((current) => ({
                        ...current,
                        summary: event.target.value
                      }))
                    }
                    value={skillDetailDraft.summary}
                  />
                </label>
              </div>
            </div>
        </ForgeEditDialog>
      ) : null}

      <div className={styles.templatesLayout}>
        {templateEmployeeListPanel}

        <section className={`${shellStyles.cardSoft} ${styles.templatesWorkbench}`}>
          <div className={styles.detailTabRow}>
            {abilityTemplateTabs.map((tab) => (
              <button
                aria-pressed={activeAbilityTemplateTab === tab.id}
                className={`${styles.detailTabButton} ${
                  activeAbilityTemplateTab === tab.id ? styles.detailTabButtonActive : ""
                }`}
                key={tab.id}
                onClick={() => setActiveAbilityTemplateTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeAbilityTemplateTab === "skills" ? (
            <div className={styles.templatesBody}>
              <div className={styles.skillLibraryToolbar}>
                {renderAbilityLineFilters({ showCounts: true })}
                <button
                  aria-label="下载技能"
                  className={styles.skillLibraryAddButton}
                  onClick={() => openSkillImportDialog()}
                  type="button"
                >
                  +
                </button>
              </div>

              <div className={styles.skillList}>
                {skillCatalog
                  .filter((skill) => selectedAbilityLine === "全部" || skill.line === selectedAbilityLine)
                  .map((skill) =>
                    renderSkillListItem({
                      skill,
                      active: (selectedAgent?.skillIds.includes(skill.id) ?? false),
                      actionNode: (
                        <div className={styles.skillStoreAction}>
                          <button
                            aria-label={`${selectedAgent?.skillIds.includes(skill.id) ? "已装" : "装备"}${skill.name}`}
                            className={
                              selectedAgent?.skillIds.includes(skill.id)
                                ? styles.abilityPackButtonActive
                                : styles.skillListAction
                            }
                            disabled={selectedAgent?.skillIds.includes(skill.id)}
                            onClick={() => equipSingleSkill(skill.id)}
                            type="button"
                          >
                            {selectedAgent?.skillIds.includes(skill.id) ? "已装" : "装备"}
                          </button>
                        </div>
                      )
                    })
                  )}
              </div>
            </div>
          ) : null}

          {activeAbilityTemplateTab === "packs" ? (
            <div className={styles.templatesBody}>
              <div className={styles.abilityPackList}>
                {filteredAbilityPacks.map((pack) => {
                  const isEquipped = selectedEquippedPackRefs.some(
                    (packRef) => packRef.source === pack.source && packRef.id === pack.id
                  );
                  const isSelected = selectedRecommendedPack?.id === pack.id;
                  const roleLabels = pack.roles.length
                    ? pack.roles.map((role) => getRoleLabel(role)).join(" / ")
                    : pack.source === "custom"
                      ? "自定义组合"
                      : "推荐组合";
                  const expandedSkills = pack.skillIds
                    .map((skillId) => skillCatalog.find((item) => item.id === skillId))
                    .filter(Boolean) as typeof skillCatalog;

                  return (
                    <article
                      aria-expanded={isSelected}
                      aria-label={`切换技能组合 ${pack.name}`}
                      className={`${styles.abilityPackCard} ${
                        isSelected ? styles.abilityPackCardActive : ""
                      }`}
                      key={pack.id}
                      onClick={() => toggleAbilityPack(pack.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleAbilityPack(pack.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.abilityPackMain}>
                        {renderAbilityPackIcon()}
                        <div className={styles.abilityPackBody}>
                          <div className={styles.abilityPackHead}>
                            <strong>{pack.name}</strong>
                            <span className={styles.abilityPackBadge}>{pack.line}</span>
                          </div>
                          <p className={styles.abilityPackSummary}>{pack.summary}</p>
                          <div className={styles.abilityPackMeta}>
                            <span>{roleLabels}</span>
                            <span>{pack.skillIds.length} 个 skill</span>
                            <span>
                              {pack.source === "custom"
                                ? pack.category ?? "自定义"
                                : `${pack.knowledgeSources.length} 个知识来源`}
                            </span>
                          </div>
                        </div>
                        <div className={styles.abilityPackFooter}>
                          <button
                            aria-label={`装备${pack.name}`}
                            className={isEquipped ? styles.abilityPackButtonActive : styles.abilityPackButton}
                            onClick={(event) => {
                              event.stopPropagation();
                              equipAbilityPack(pack);
                            }}
                            type="button"
                          >
                            {isEquipped ? "已装备" : "装备"}
                          </button>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className={styles.abilityPackExpanded}>
                          <div className={styles.skillList}>
                            {expandedSkills.map((skill) => renderSkillListItem({ skill }))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeAbilityTemplateTab === "equipped" ? (
            <div className={styles.templatesBody}>
              {selectedEquippedPacks.length > 0 ? (
                <section className={styles.templatesBlock}>
                  <div className={styles.subsectionHeader}>
                    <h3>已装技能包</h3>
                  </div>
                  <div className={styles.abilityPackList}>
                    {selectedEquippedPacks.map(({ ref, pack, packKey, removedSkillIds, expanded }) => (
                      <article
                        aria-expanded={expanded}
                        aria-label={`切换已装技能包 ${pack.name}`}
                        className={`${styles.abilityPackCard} ${
                          expanded ? styles.abilityPackCardActive : ""
                        }`}
                        key={packKey}
                        onClick={() => toggleEquippedPackExpanded(ref)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleEquippedPackExpanded(ref);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.abilityPackMain}>
                          {renderAbilityPackIcon()}
                          <div className={styles.abilityPackBody}>
                            <div className={styles.abilityPackHead}>
                              <strong>{pack.name}</strong>
                              <span className={styles.abilityPackBadge}>{pack.line}</span>
                            </div>
                            <p className={styles.abilityPackSummary}>{pack.summary}</p>
                            <div className={styles.abilityPackMeta}>
                              <span>{pack.source === "preset" ? "推荐组合" : "自定义组合"}</span>
                              <span>{pack.skillIds.length} 个 skill</span>
                            </div>
                          </div>
                          <div className={styles.abilityPackFooter}>
                            <button
                              aria-label={`移除${pack.name}`}
                              className={styles.skillListAction}
                              onClick={(event) => {
                                event.stopPropagation();
                                unequipSelectedPack(ref);
                              }}
                              type="button"
                            >
                              移除
                            </button>
                          </div>
                        </div>

                        {expanded ? (
                          <div className={styles.abilityPackExpanded}>
                            <div className={styles.skillList}>
                              {pack.skillIds.map((skillId) => {
                                const skill = skillCatalog.find((item) => item.id === skillId);
                                if (!skill) return null;
                                const removed = removedSkillIds.includes(skill.id);
                                return renderSkillListItem({
                                  skill,
                                  muted: removed,
                                  actionLabel: removed ? "激活" : "移除",
                                  actionAriaLabel: `${removed ? "激活" : "移除"}${skill.name}`,
                                  onClick: () => toggleEquippedPackSkillActivation(ref, skill.id)
                                });
                              })}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.templatesBlock}>
                <div className={styles.subsectionHeader}>
                  <h3>单个技能</h3>
                </div>
                <div className={styles.skillList}>
                  {selectedManualSkillCatalog.length > 0 ? (
                    selectedManualSkillCatalog.map((skill) => (
                      renderSkillListItem({
                        skill,
                        active: true,
                        actionLabel: "移除",
                        onClick: () => removeSkillFromSelectedAgent(skill.id)
                      })
                    ))
                  ) : (
                    renderInlineEmptyState("当前还没有已装 skill。")
                  )}
                </div>
              </section>

            </div>
          ) : null}

          {activeAbilityTemplateTab === "custom" ? (
            <div className={styles.templatesBody}>
              {isCustomPackDialogOpen && selectedCustomPack ? (
                <ForgeEditDialog
                  ariaLabel="编辑技能包"
                  dialogClassName={styles.customPackDialog}
                  draggable
                  footer={
                    <>
                      <button
                        className={styles.destructiveButton}
                        disabled={!selectedCustomPack}
                        onClick={() => {
                          if (!selectedCustomPack) return;
                          openDangerAction({
                            kind: "delete-skill-pack",
                            targetId: selectedCustomPack.id,
                            targetLabel: selectedCustomPack.name
                          });
                        }}
                        type="button"
                      >
                        删除技能包
                      </button>
                      <div className={styles.customPackActionGroup}>
                        <button
                          className={styles.sectionActionButton}
                          onClick={() => {
                            setIsCustomPackDialogOpen(false);
                            setCustomPackDialogPosition(null);
                          }}
                          type="button"
                        >
                          取消
                        </button>
                        <button
                          className={styles.abilityPackButton}
                          onClick={saveCustomAbilityPack}
                          type="button"
                        >
                          保存修改
                        </button>
                      </div>
                    </>
                  }
                  headerClassName={styles.draggableDialogHeader}
                  onClose={() => {
                    setIsCustomPackDialogOpen(false);
                    setCustomPackDialogPosition(null);
                  }}
                  onHeaderMouseDown={startCustomPackDrag}
                  style={
                    customPackDialogPosition
                      ? {
                          transform: `translate(${customPackDialogPosition.x}px, ${customPackDialogPosition.y}px)`
                        }
                      : undefined
                  }
                  title="编辑技能包"
                  variant="centered"
                >
                    <div className={styles.orgDialogFormGrid}>
                      <label className={shellStyles.fieldStack}>
                        <span className={shellStyles.fieldLabel}>技能包名称</span>
                        <input
                          aria-label="技能包名称"
                          className={styles.orgTextInput}
                          onChange={(event) =>
                            setCustomPackDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          type="text"
                          value={customPackDraft.name}
                        />
                      </label>
                      <label className={shellStyles.fieldStack}>
                        <span className={shellStyles.fieldLabel}>业务线</span>
                        <select
                          aria-label="业务线"
                          className={styles.orgSelect}
                          onChange={(event) =>
                            setCustomPackDraft((current) => ({ ...current, line: event.target.value }))
                          }
                          value={customPackDraft.line}
                        >
                          {abilityLineOptions
                            .filter((line) => line !== "全部")
                            .map((line) => (
                              <option key={line} value={line}>
                                {line}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className={shellStyles.fieldStack}>
                        <span className={shellStyles.fieldLabel}>技能分类</span>
                        <select
                          aria-label="技能分类"
                          className={styles.orgSelect}
                          onChange={(event) =>
                            setCustomPackDraft((current) => ({ ...current, category: event.target.value }))
                          }
                          value={customPackDraft.category}
                        >
                          {customPackCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={`${shellStyles.fieldStack} ${styles.customPackFieldFull}`}>
                        <span className={shellStyles.fieldLabel}>简介</span>
                        <textarea
                          aria-label="技能包简介"
                          className={shellStyles.textarea}
                          onChange={(event) =>
                            setCustomPackDraft((current) => ({ ...current, summary: event.target.value }))
                          }
                          value={customPackDraft.summary}
                        />
                      </label>
                    </div>
                </ForgeEditDialog>
              ) : null}

              <div className={styles.customPackLayout}>
                <section className={styles.templatesBlock}>
                  <div className={styles.subsectionHeader}>
                    <div>
                      <h3>当前技能包</h3>
                      <p className={styles.subsectionMeta}>当前共 {currentAbilityPacks.length} 个技能包</p>
                    </div>
                    <div className={styles.subsectionActions}>
                      <button
                        aria-expanded={!isCurrentPackListCollapsed}
                        aria-label={`${isCurrentPackListCollapsed ? "展开" : "收起"}当前技能包`}
                        className={styles.sectionActionButton}
                        onClick={() => setIsCurrentPackListCollapsed((current) => !current)}
                        type="button"
                      >
                        {isCurrentPackListCollapsed ? "展开" : "收起"}
                      </button>
                      <button
                        className={styles.sectionActionButton}
                        onClick={createCustomAbilityPack}
                        type="button"
                      >
                        <span aria-hidden="true">＋</span>
                        新建技能包
                      </button>
                    </div>
                  </div>
                  {!isCurrentPackListCollapsed ? (
                    <div className={styles.customPackList} data-layout="wrapped" data-testid="current-pack-list">
                      {currentAbilityPacks.map((pack) => {
                        const isSelectedCurrentPack = pack.id === selectedCurrentPack?.id;
                        const isEditablePack = pack.source === "custom";

                        return (
                          <div
                            className={`${styles.customPackRow} ${
                              isSelectedCurrentPack ? styles.customPackRowActive : ""
                            }`}
                            key={pack.id}
                          >
                            <button
                              aria-pressed={isSelectedCurrentPack}
                              className={styles.customPackRowSelect}
                              onClick={() => {
                                setSelectedCustomPackId(pack.id);
                              }}
                              type="button"
                            >
                              <span className={styles.customPackRowPrimary}>
                                <strong>{pack.name}</strong>
                                <small>
                                  {pack.category ?? pack.line ?? "通用"} · {pack.skillIds.length} 个 skill
                                </small>
                              </span>
                            </button>
                            {isEditablePack ? (
                              <button
                                aria-label={`编辑技能包${pack.name}`}
                                className={styles.customPackRowEdit}
                                onClick={() => {
                                  openCustomPackDialog(pack.id);
                                }}
                                type="button"
                              >
                                编辑
                              </button>
                            ) : (
                              <span className={styles.customPackRowMeta}>预设</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className={styles.templatesBlock}>
                  <div className={styles.subsectionHeader}>
                    <h3>技能包编辑器</h3>
                  </div>

                  <div className={styles.customPackGrid}>
                    <section className={styles.customPackPanel}>
                      <div className={styles.subsectionHeader}>
                        <h3>当前选中的 skill</h3>
                      </div>
                      <div className={styles.customPackSkillList}>
                        {customPackSkills.length > 0 ? (
                          customPackSkills.map((skill) =>
                            renderSkillListItem({
                              skill,
                              active: true,
                              actionLabel: selectedCustomPack ? "移除" : undefined,
                              onClick: selectedCustomPack
                                ? () => removeSkillFromCustomPack(skill.id)
                                : undefined
                            })
                          )
                        ) : (
                          renderInlineEmptyState("当前技能包还没有 skill。")
                        )}
                      </div>
                      {!selectedCustomPack && selectedCurrentPack ? (
                        <p className={styles.subsectionHint}>预设技能包可查看内容，如需修改请先新建技能包。</p>
                      ) : null}
                    </section>

                    <section className={styles.customPackPanel}>
                      <div className={styles.subsectionHeader}>
                        <h3>可选 skill</h3>
                      </div>
                      {renderAbilityLineFilters()}
                      <div className={styles.customPackSkillList}>
                        {availableCustomSkills.map((skill) =>
                          renderSkillListItem({
                            skill,
                            actionLabel: selectedCustomPack ? "加入" : undefined,
                            onClick: selectedCustomPack
                              ? () => addSkillToCustomPack(skill.id)
                              : undefined
                          })
                        )}
                      </div>
                    </section>
                  </div>

                  <div className={styles.templatesActionBar}>
                    <span className={styles.templatesActionMeta}>
                      当前包包含 {currentPackSkillIds.length} 个 skill
                    </span>
                    <div className={styles.customPackActionGroup}>
                      {selectedCustomPack ? (
                        <button
                          className={styles.abilityPackButton}
                          onClick={applyCustomSkillPack}
                          type="button"
                        >
                          应用到当前员工
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );

  const renderAutomation = () => (
    <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>自动化</h2>
        </div>
      </div>

      <section className={`${shellStyles.cardSoft} ${styles.templatesBlock}`}>
        {renderInlineEmptyState(
          "MVP 阶段暂未开放。后续会在这里补齐接手、升级和执行时机等自动化规则。"
        )}
      </section>
    </div>
  );

  const renderGovernance = () => (
    <div className={styles.sectionStack}>
      <div className={styles.panelHeader}>
        <div>
          <h2>权限管理</h2>
        </div>
      </div>

      <div className={styles.templatesLayout}>
        <section className={`${shellStyles.cardSoft} ${styles.templatesEmployees} ${styles.employeeListPanel}`}>
          <div className={styles.subsectionHeader}>
            <h3>员工列表</h3>
          </div>
          <div className={styles.departmentFilterRow}>
            {employeeDepartments.map((department) => (
              <button
                aria-pressed={selectedGovernanceDepartment === department}
                className={`${styles.departmentFilterButton} ${
                  selectedGovernanceDepartment === department ? styles.departmentFilterButtonActive : ""
                }`}
                key={department}
                onClick={() => setSelectedGovernanceDepartment(department)}
                type="button"
              >
                {department}
              </button>
            ))}
          </div>
          <div className={styles.employeePoolList}>
            {filteredGovernanceRows.map((item) =>
              renderEmployeePoolRow({
                item,
                selected: item.agent.id === selectedAgent?.id,
                onClick: () => focusAgentAcrossEmployeeChain(item.agent)
              })
            )}
            {filteredGovernanceRows.length === 0
              ? renderInlineEmptyState("当前部门下没有员工。")
              : null}
          </div>
        </section>

        <div className={styles.templatesWorkbench}>
          <section className={`${shellStyles.cardSoft} ${styles.governanceLevelSection}`}>
            <div className={styles.subsectionHeader}>
              <h3>权限等级</h3>
            </div>
            <div className={styles.governanceLevelGrid}>
              {governanceLevels.map((level) => (
                <button
                  aria-pressed={selectedGovernanceLevel === level.id}
                  className={`${styles.governanceLevelCard} ${
                    selectedGovernanceLevel === level.id ? styles.governanceLevelCardActive : ""
                  }`}
                  key={level.id}
                  onClick={() => applyGovernanceLevel(level.id)}
                  type="button"
                >
                  <strong>{level.label}</strong>
                  <small>{level.summary}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={`${shellStyles.cardSoft} ${styles.governancePermissionsSection}`}>
            <div className={styles.subsectionHeader}>
              <h3>权限清单</h3>
            </div>
            <div className={styles.governancePermissionGroups}>
              {governancePermissionGroups.map((group) => (
                <article className={styles.governancePermissionCard} key={group.id}>
                  <div className={styles.governancePermissionHeader}>
                    <span
                      aria-hidden="true"
                      className={styles.governancePermissionIcon}
                    >
                      {governancePermissionGroupIconMap[group.id]}
                    </span>
                    <h3>{group.label}</h3>
                  </div>
                  <div className={styles.governancePermissionList}>
                    {group.items.map((item) => {
                      const enabled = selectedGovernancePermissionIds.has(item.id);
                      return (
                        <div className={styles.governancePermissionRow} key={item.id}>
                          <span className={styles.governancePermissionCopy}>
                            <strong>{item.label}</strong>
                            <small>{item.summary}</small>
                          </span>
                          <button
                            aria-label={`${enabled ? "禁用" : "允许"}${item.label}`}
                            className={`${styles.governancePermissionToggle} ${
                              enabled ? styles.governancePermissionToggleActive : ""
                            }`}
                            onClick={() => toggleGovernancePermission(item.id)}
                            type="button"
                          >
                            {enabled ? "已允许" : "已禁用"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.governanceSummaryGrid}>
            <article className={styles.keyValueCard}>
              <span className={shellStyles.fieldLabel}>例外权限</span>
              {selectedGovernanceExceptions.length > 0 ? (
                <div className={styles.governanceExceptionList}>
                  {selectedGovernanceExceptions.map((item) => (
                    <span className={styles.governanceExceptionChip} key={`${item.type}-${item.permission.id}`}>
                      {item.type === "enabled" ? "放开" : "收紧"} · {item.permission.label}
                    </span>
                  ))}
                </div>
              ) : (
                <strong>当前没有例外权限</strong>
              )}
            </article>
            <article className={styles.keyValueCard}>
              <span className={shellStyles.fieldLabel}>风险提示</span>
              <strong>{selectedGovernanceLevelConfig.riskHint}</strong>
              <span className={styles.governanceSummaryMeta}>
                审批方式：{getOwnerModeLabel(selectedAgent?.ownerMode ?? "human-approved")} · 治理策略：
                {selectedAgent?.policyId ?? "未配置"}
              </span>
            </article>
          </div>
        </div>
      </div>
    </div>
  );

  const dangerActionCopy = getDangerActionCopy(pendingDangerAction);

  return (
    <ForgeConsoleShell
      activeView="team"
      breadcrumb={[]}
      hideHeader
      showNavigation={showNavigation}
      sidebarSections={[
        {
          label: "团队配置",
          items: categoryItems
        }
      ]}
      sidebarTitle="AI员工"
    >
      <section className={shellStyles.card}>
        {activeCategory === "orgChart" ? renderOrgChart() : null}
        {activeCategory === "organization" ? renderOrganization() : null}
        {activeCategory === "employees" ? renderEmployees() : null}
        {activeCategory === "templates" ? renderTemplates() : null}
        {activeCategory === "automation" ? renderAutomation() : null}
        {activeCategory === "governance" ? renderGovernance() : null}
      </section>
      {actionFeedback ? (
        <div
          aria-live="polite"
          className={`${styles.actionFeedbackToast} ${
            actionFeedback.tone === "info"
              ? styles.actionFeedbackToastInfo
              : actionFeedback.tone === "warn"
                ? styles.actionFeedbackToastWarn
                : ""
          }`}
          role="status"
        >
          {actionFeedback.message}
        </div>
      ) : null}
      <ForgeConfirmDialog
        closeLabel="关闭危险操作确认"
        confirmButtonClassName={styles.destructiveButton}
        confirmLabel="确认删除"
        description={dangerActionCopy?.description ?? ""}
        label={dangerActionCopy?.dialogLabel ?? "确认危险操作"}
        onCancel={closeDangerAction}
        onConfirm={confirmDangerAction}
        open={Boolean(pendingDangerAction && dangerActionCopy)}
        title={dangerActionCopy?.title ?? "确认危险操作"}
      />
    </ForgeConsoleShell>
  );
}
