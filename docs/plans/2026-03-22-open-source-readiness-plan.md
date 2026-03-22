# Forge Open Source Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Forge 整理成一个可以公开发布、首次克隆即可启动、默认不会暴露作者本地数据和环境假设的开源仓库。

**Architecture:** 采用“双数据源、单控制面”策略。默认使用仓库内置示例数据与 OSS-safe 首页能力，只有显式配置本地路径时才读取作者或用户自己的真实数据库、工作区和本机增强能力；控制面、工作台与 API 继续共用现有 SQLite/Next.js 架构，不额外引入新的服务层。

**Tech Stack:** Next.js 15、React 19、Electron、better-sqlite3、Vitest、Node.js CLI scripts

---

## Current Status

- 首页已经进入 OSS-safe 模式：
  - `view=home` 默认不做真实技能注水
  - 首页右侧默认不暴露实时 AI 汇报刷新入口
  - 首页默认优先使用静态项目动态
- 数据源底层已经支持：
  - 显式 `dbPath` 优先
  - `FORGE_DB_PATH`
  - `FORGE_DATA_MODE=local|demo|auto`
  - `auto` 模式下优先现有 `data/forge.db`，不存在时才回退 `data/forge-demo.db`
- 仓库公开基线已经补齐：
  - `.gitignore`
  - `Apache-2.0 LICENSE`
  - README `Open Source Notes`
- 项目页与示例数据已经做过一轮机器痕迹收口：
  - 默认不再硬编码 `localhost` 调试页映射
  - 示例 runner 工作区路径改成仓库内动态生成
- 首次启动体验已补基础材料：
  - `.env.example`
  - README `Quick Start`
- 文档与测试里的作者机器绝对路径已经做过一轮清理：
  - `docs/plans` 的仓库绝对路径已改成仓库相对写法
  - README/测试中已不再残留仓库根目录绝对路径
- 生产构建阻塞已经解除：
  - `packages/core/src/selectors.ts` 的空值类型收窄已修复
  - `npm run build` 已通过
  - `npx next start -p 3322` 已可稳定启动首页
- 当前仍有明确开源收尾项：
  - 仍存在作者机器痕迹与演示专属内容需要逐步清理
  - 首页/项目页还缺少更明确的“示例模式 / 本地模式”前端标识

---

## Scope

这轮开源工作只做下面四件事：

1. 仓库可以安全公开
2. 新用户第一次克隆后能稳定打开首页
3. 默认模式不会读取作者真实项目数据
4. 贡献者能看懂如何启动、如何切到本地模式

不在这轮范围内：

- 把所有页面都做成完全无本机依赖
- 把 Nano/OpenClaw 真实运行链做成零配置
- 清空作者本机实际数据库内容之外的全部产品能力
- 完整 CI/CD 发布流水线

---

## Phase 0: Release Gate

### Task 1: 明确仓库公开基线

**Files:**
- Modify: `../../README.md`
- Create: `../../LICENSE`
- Create: `../../.gitignore`

**Steps:**
1. 定义仓库公开目标：演示版控制面、示例数据、可选本地模式。
2. 选定开源许可证。
3. 增加 `.gitignore`，至少覆盖：
   - `.env.local`
   - `.next`
   - `.next-*`
   - `node_modules`
   - `dist-desktop`
   - `dist-electron`
   - `output`
   - `tsconfig.tsbuildinfo`
   - `.playwright-cli`
   - `.DS_Store`
   - `data/forge.db`
   - `data/workspaces`
4. 在 README 顶部补充“示例模式”和“本地模式”的区别。

**Expected Outcome:**
- 仓库不再默认包含作者本地构建产物和真实数据库。

---

## Phase 1: Data Isolation

### Task 2: 把示例数据和本地数据的边界做透

**Files:**
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../src/server/forge-page-data.ts`
- Modify: `../../src/components/forge-home-page.tsx`
- Test: `../../tests/forge-db.test.ts`
- Test: `../../tests/forge-page-data.test.ts`
- Test: `../../tests/forge-home-page.test.tsx`

**Steps:**
1. 保持首页默认使用示例/内置数据增强能力。
2. 增加前端只读提示：
   - `示例模式`
   - `本地模式`
3. 首页、项目页、工作区 API 在示例模式下不要误指向作者本机目录。
4. 让 README 清楚说明：
   - 默认模式：适合开箱体验
   - 本地模式：需要用户自己配置 `FORGE_DB_PATH` 或 `FORGE_DATA_MODE=local`

**Expected Outcome:**
- 仓库默认运行时，不会读取作者自己的 `forge.db` 或真实工作区。

---

## Phase 2: Sensitive Path and Local Assumption Scrub

### Task 3: 清掉作者机器耦合

**Files:**
- Search/Modify: `../../src/components/forge-projects-page.tsx`
- Search/Modify: `../../src/server/**/*.ts`
- Search/Modify: `../../app/api/**/*.ts`
- Search/Modify: `../../README.md`
- Search/Modify: `../../docs/**/*.md`

**Steps:**
1. 搜索绝对路径和作者机器目录，例如：
   - `/absolute/path/...`
   - `localhost:<port>`
   - 专属工作区路径
   - 手工绑定的真实项目目录
2. 搜索敏感展示信息，例如：
   - 登录账号
   - 手机号
   - 外部项目地址
   - 客户真实名称（如果不打算公开）
3. 把这些内容替换为：
   - 示例地址
   - 环境变量
   - 配置项
   - 文档说明

**Expected Outcome:**
- 代码库里不再含明显的作者机器路径和个人/客户敏感信息。

---

## Phase 3: Build and Bootstrap Reliability

### Task 4: 修复生产构建阻塞

**Files:**
- Modify: `../../packages/core/src/selectors.ts`
- Test: `../../tests/**/*selectors*.test.ts`

**Status:**
- 已完成，当前已无已知生产构建阻塞。

**Steps:**
1. 写最小回归测试覆盖空值路径。
2. 修复类型收窄或默认值。
3. 重新跑：
   - `npm run build`
   - 首页相关 vitest

**Expected Outcome:**
- 开源版可以用 `build + start` 方式稳定启动，而不是只靠 `next dev`。
- 当前状态：已达成。

---

## Phase 4: First-Time Contributor Experience

### Task 5: 写最小启动说明

**Files:**
- Modify: `../../README.md`
- Create: `../../.env.example`
- Optional: `../../docs/open-source-quickstart.md`

**Steps:**
1. 在 README 增加 `Quick Start`：
   - `npm install`
   - `npm run dev`
   - 默认打开示例模式首页
2. 增加 `本地模式` 说明：
   - `FORGE_DATA_MODE=local`
   - `FORGE_DB_PATH=/path/to/forge.db`
3. 增加 `可选外部能力` 说明：
   - Nano/OpenClaw
   - Obsidian
   - 本地工作区
   - 真实模型 Provider
4. 增加 `不开这些能力也能跑什么`

**Expected Outcome:**
- 新用户不需要读源码，也知道怎么第一次跑起来。

---

## Phase 5: Public Demo Packaging

### Task 6: 准备开源默认演示集

**Files:**
- Modify: `../../src/data/mock-data.ts`
- Optional: `../../data/forge-demo.db`
- Optional: `../../public/**/*`

**Steps:**
1. 统一示例项目命名和行业分布。
2. 清理过强的个人项目痕迹。
3. 保留 3 到 5 个最能解释 Forge 价值的示例项目。
4. 确保首页、项目页、工作台都能围绕示例项目讲清楚：
   - 从需求到工作台
   - 从工作台到产物
   - 从产物到交付

**Expected Outcome:**
- 开源仓库自带一套可演示的默认体验。

---

## Recommended Order

建议执行顺序：

1. `.gitignore + LICENSE + README 开源说明`
2. 绝对路径/敏感信息清理
3. 生产构建修复
4. 示例模式/本地模式前端标识
5. `.env.example + Quick Start`
6. 开源默认演示集打磨

---

## Immediate Next Action

如果要继续按最小风险往下推，下一步优先做：

1. 新建 `.gitignore`
2. 决定 `LICENSE`
3. 修复 `packages/core/src/selectors.ts:2457` 的 build 阻塞

这三件做完，仓库就从“本地研发态”进入“可准备公开”的状态。
