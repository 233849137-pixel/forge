# Workbench Agent Context Injection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让每个 AI 员工在项目工作台执行或聊天时，稳定获得自己的岗位设定、技能摘要、必要文档摘要，以及当前项目与交付物上下文，同时控制 token 成本。

**Architecture:** 采用“分层注入 + 预算控制”的混合方案，而不是把所有技能、SOP、文档全文塞进 prompt。新增一层 `resolved agent context`，在工作台调用模型或外部执行后端前，先把员工档案里的引用字段解析成结构化上下文：岗位设定、技能摘要、SOP 摘要、项目目标、当前节点、当前关键交付物、按需知识摘录。模型网关和 execution backend 都统一消费这层解析结果。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, SQLite-backed Forge snapshot, model gateway

---

## Recommended Approach

### Option A: 全量文档注入

把 `promptTemplate`、`skills`、`SOP`、`knowledgeSources`、项目产物全文一次性注入到每次工作台模型调用。

**优点**
- 实现表面上最直接

**问题**
- token 成本会快速失控
- 对话越长越容易重复注入相同信息
- 模型更容易被长文噪音干扰

### Option B: 纯检索式注入

什么都不常驻，只在每次调用前做检索，按 query 命中结果拼上下文。

**优点**
- token 最省

**问题**
- 岗位稳定性差
- 员工“像同一个人”的感觉不稳定
- 当前节点需要的固定规则可能检索不到

### Option C: 分层注入 + 检索摘录（Recommended）

每次调用固定注入员工岗位设定与项目最小闭环上下文，再按节点补 2 到 3 个必要 skill/SOP 摘要；真正长文档仅在命中时注入摘录。

**优点**
- 员工身份稳定
- 节点上下文清楚
- token 成本可控
- 兼容工作台聊天与 execution backend

**Recommendation:** 选 Option C。

---

### Task 1: 定义“员工上下文解析结果”类型与预算规则

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Create: `../../packages/ai/src/agent-context.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing test**

为“解析员工上下文”增加测试，断言输出至少包含：
- `identity`：员工名称、角色、persona、ownerMode
- `rolePrompt`：system prompt + prompt template 展开结果
- `skills`：技能摘要列表
- `sops`：SOP 摘要列表
- `projectContext`：项目目标、当前节点、当前阶段
- `deliverables`：当前关键交付物摘要
- `knowledgeSnippets`：预算内摘录

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: FAIL because no resolved agent context builder exists yet.

**Step 3: Write minimal implementation**

在 `packages/ai/src/agent-context.ts` 新增：
- `resolveWorkbenchAgentContext(snapshot, projectId, nodeOrCommand)`
- `buildAgentContextBudget()`

新增预算上限：
- 常驻岗位设定：始终注入
- skill 摘要：最多 3 条
- SOP 摘要：最多 2 条
- 知识摘录：最多 3 条
- 交付物摘要：最多 4 条

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/ai/src/agent-context.ts tests/forge-ai.test.ts
git commit -m "feat: add resolved workbench agent context model"
```

### Task 2: 把员工档案里的引用字段真正展开

**Files:**
- Modify: `../../packages/ai/src/agent-context.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing test**

断言以下映射会被展开：
- `promptTemplateId` -> prompt template 正文/摘要
- `skillIds` -> skill `name + summary + usageGuide`
- `sopIds` -> SOP `name + checklist`
- `knowledgeSources` -> 知识来源标签列表

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: FAIL because current workbench path only carries `systemPrompt` and `knowledgeSources` labels.

**Step 3: Write minimal implementation**

在上下文解析层完成：
- prompt template 展开
- skill 引用展开
- SOP 引用展开
- knowledge source 仍先保留字符串来源，但转成结构化项

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/agent-context.ts packages/ai/src/forge-ai.ts tests/forge-ai.test.ts
git commit -m "feat: resolve prompt, skill, and SOP references for workbench agents"
```

### Task 3: 定义“必要文档”策略，只注入当前节点最小闭环

**Files:**
- Modify: `../../packages/ai/src/agent-context.ts`
- Modify: `../../packages/core/src/selectors.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing test**

为每个工作台节点定义最小必要文档集合，至少覆盖：
- `需求确认`：原始需求 + PRD
- `项目原型`：PRD + 架构说明 + TaskPack
- `UI设计`：PRD + 原型/交互规范
- `后端研发`：PRD + 架构说明 + UI 规格 + TaskPack
- `DEMO测试`：TaskPack + patch/demo-build + 验收/测试摘要
- `交付发布`：测试报告 + Playwright 结果 + release brief

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: FAIL because no node-based required-doc resolver exists.

**Step 3: Write minimal implementation**

新增：
- `getRequiredWorkbenchArtifacts(node)`
- `buildProjectDeliverableSummary(snapshot, projectId, node)`

规则：
- 只取当前节点必需文档
- 只保留标题、状态、更新时间、3 到 6 行摘要
- 不注入全文

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/agent-context.ts packages/core/src/selectors.ts tests/forge-ai.test.ts
git commit -m "feat: add node-scoped deliverable summaries for workbench agents"
```

### Task 4: 让工作台聊天和命令执行真正消费解析后的上下文

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../packages/model-gateway/src/index.ts`
- Test: `../../tests/forge-model-gateway.test.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing test**

断言工作台这两条链都会消费同一份上下文：
- `executeCommandWithModelForAI()`
- `generateWorkbenchChatReplyForAI()`

并且 prompt 里不再只有：
- `agentSystemPrompt`
- `agentKnowledgeSources`

而是会出现：
- 角色设定摘要
- skill/SOP 摘要
- 当前项目与节点摘要
- 当前交付物摘要

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-model-gateway.test.ts tests/forge-ai.test.ts`
Expected: FAIL because current prompt builder still uses only lightweight fields.

**Step 3: Write minimal implementation**

修改模型网关 prompt builder：
- system prompt 放岗位稳定信息
- user prompt 放当前节点、当前目标、必要交付物、必要知识摘录
- 明确预算裁剪

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-model-gateway.test.ts tests/forge-ai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts packages/model-gateway/src/index.ts tests/forge-model-gateway.test.ts tests/forge-ai.test.ts
git commit -m "feat: inject resolved agent context into workbench model calls"
```

### Task 5: 让 execution backend 也拿到同一份上下文

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing test**

断言 execution backend payload 里不再只是原始：
- `skillIds`
- `knowledgeSources`

而会带：
- `resolvedSkills`
- `resolvedSops`
- `projectContext`
- `deliverableSummary`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: FAIL because current payload only carries raw IDs and labels.

**Step 3: Write minimal implementation**

在 execution backend payload 中增加：
- `agent.resolvedSkills`
- `agent.resolvedSops`
- `agent.rolePrompt`
- `projectContext`
- `deliverableSummary`

同时保留原始 `skillIds` 和 `knowledgeSources`，保证兼容已有 runner。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts tests/forge-ai.test.ts
git commit -m "feat: include resolved agent context in execution backend payloads"
```

### Task 6: 提供可视化校验，确保“员工拿到了什么”可验证

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/components/forge-projects-page.tsx`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-projects-page.test.tsx`

**Step 1: Write the failing test**

增加一个最小“上下文预览”入口，至少能看到：
- 当前员工使用的 prompt template
- 已解析 skills
- 已解析 knowledge snippets
- 当前项目/节点/交付物摘要

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-team-page.test.tsx tests/forge-projects-page.test.tsx`
Expected: FAIL because no preview UI exists.

**Step 3: Write minimal implementation**

做一个只读预览，不要引入新复杂交互：
- 团队页：员工详情里可看“将注入工作台的上下文”
- 工作台：调试状态下可展开“当前 AI 上下文”

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-team-page.test.tsx tests/forge-projects-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/agent-team-page.tsx src/components/forge-projects-page.tsx tests/agent-team-page.test.tsx tests/forge-projects-page.test.tsx
git commit -m "feat: add resolved agent context preview surfaces"
```

### Task 7: 跑最终回归，确认 token 策略和主链路不回退

**Files:**
- Verify: `../../tests/forge-ai.test.ts`
- Verify: `../../tests/forge-model-gateway.test.ts`
- Verify: `../../tests/forge-projects-page.test.tsx`
- Verify: `../../tests/agent-team-page.test.tsx`

**Step 1: Run focused suites**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-model-gateway.test.ts tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx`
Expected: PASS

**Step 2: Run full regression**

Run: `npm test`
Expected: PASS, or only pre-existing unrelated failures.

**Step 3: Manual verification checklist**

验证 3 条主链：
- 团队页修改员工 skill / 知识来源后，工作台上下文预览同步变化
- 工作台聊天调用能看到当前员工技能摘要和项目交付物摘要
- 命令执行与 execution backend payload 共享同一份解析结果

**Step 4: Commit**

```bash
git add -A
git commit -m "test: verify resolved agent context across workbench flows"
```

---

## Minimal Context Policy

默认只注入这 4 类必要信息：

1. **员工身份层**
- name
- role
- persona
- ownerMode
- systemPrompt
- promptTemplate 摘要

2. **能力层**
- 最多 3 个 skill 摘要
- 最多 2 个 SOP 摘要

3. **项目层**
- 项目目标摘要
- 当前节点
- 当前阶段
- 当前阻塞/待确认

4. **交付物层**
- 当前节点必需交付物摘要
- 最多 4 个项目关键产物

长文档正文、历史报告全文、全量知识库内容不默认注入。只有命中时才摘录。

## Expected Outcome

完成后，系统应满足：

- 每个员工都知道自己是谁、该怎么干、边界是什么
- 每个员工都能拿到自己的 skill / SOP 摘要，而不是只有 ID
- 每个员工都知道当前项目在做什么、当前节点要产出什么
- 每次调用不会因为上下文全量注入而把 token 打爆
- 团队页和工作台都能验证“这个员工实际拿到了什么上下文”
