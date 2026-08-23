import { DocumentBlueprint } from '../types/project';

export const MOCK_DOCUMENTS: DocumentBlueprint[] = [
  {
    id: 'doc-agents',
    filename: 'AGENTS.md',
    title: 'Coding Agent 入口导航与系统边界',
    badge: 'Gateway',
    targetAudience: 'Coding Agent (Antigravity, Cursor, Claude Code) 与 开发者',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# AGENTS.md - Project Architect Implementation Contract

> **文档性质**：Coding Agent 入口导航、架构边界与文档索引  
> **来源状态版本**：\`rev-20260822-04 (Approved with Warnings)\`  
> **适用代理**：Antigravity, Cursor, Claude Code, GitHub Copilot

---

## 1. 项目核心定位与目标

**Project Architect** 是一个本地运行的 AI 项目构思工作台。它帮助开发者在开始编写代码之前，将模糊想法转化为结构化决策、成熟度概览以及工程级开发规范。

- **核心目标**：减少错误开工、保留用户主导权、将零散对话沉淀为单一可信规范源。
- **目标用户**：独立全栈开发者、Solo Founder 与技术产品经理。

---

## 2. 核心架构约束与不可突破的边界 (Locked Decisions)

| 决策项 | 锁定状态 | 核心要求与限制 |
| :--- | :--- | :--- |
| **单机无服务** | \`LOCKED\` | 严禁引入外部后端云服务或数据库依赖，全部状态保存在本地 \`.json\`。 |
| **单一专门 Agent** | \`LOCKED\` | 采用单次推理闭环，严禁引入黑盒多 Agent 投票或隐蔽的连续链式调用。 |
| **文档单向派生** | \`LOCKED\` | 生成的 Markdown 为只读派生产物，修改需求必须通过 Overview 或 Chat 推进。 |
| **Linear 暖中性色调** | \`LOCKED\` | 侧边栏主动后退，低饱和暖灰，绝不使用花哨彩虹渐变或侵入式动画。 |

---

## 3. 规范文档索引与推荐阅读/实现顺序

Coding Agent 在执行开发前，必须按以下顺序查阅具体规范文档：

\`\`\`mermaid
flowchart TD
    A["AGENTS.md\n入口与不可突破约束"] --> B["docs/PROJECT.md\n项目定义与范围边界"]
    B --> C["docs/PRODUCT.md\n用户、价值与核心功能"]
    C --> D["docs/USER_FLOWS.md\n主流程与异常状态"]
    D --> E["docs/UX_UI_SPEC.md\n三栏布局与设计准则"]
    E --> F["docs/DEVELOPMENT_PLAN.md\n阶段规划与实施步骤"]
    F --> G["docs/ACCEPTANCE.md\n验收条件与可验证清单"]
\`\`\`

---

## 4. 当前仍保留的 Warning 与 Active Assumptions

- **Warning 1**：本地 JSON 存储在单项目数据量极大时建议建立内存索引。
- **Assumption 1**：多材料上传时采用分段摘要算法（不超过 8k tokens）。
- **Issue 1**：当前版本无自动 Schema Migration，字段升级需向后兼容。
`
  },
  {
    id: 'doc-project',
    filename: 'docs/PROJECT.md',
    title: '项目整体定义与范围边界',
    badge: 'Core',
    targetAudience: '项目负责人、开发者、Coding Agent',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/PROJECT.md

## 1. 项目概述
Project Architect 是一款帮助开发者在写代码前把项目想清楚的专业工作台。

## 2. MVP 边界 (Scope Boundary)
### 包含能力 (In-Scope)
1. 首页 Idea 快速捕获与材料拖拽解析。
2. 三栏工作台（左侧导航 + 中栏决策流 + 右侧实时 Overview）。
3. 结构化分析输出（Confirmed / Candidate / Assumption / Gap / Warning）。
4. Gap-first 关键提问卡片（含影响分析与自由输入）。
5. 准备度（Readiness Review）4 级健康度评估。
6. 7 份标准 Markdown 开发蓝图装配与导出。

### 明确不做 (Out-of-Scope)
- 不做自动写代码与代码执行引擎。
- 不做云端多租户、团队权限与看板敏捷系统。
- 不做企业级审批流。
`
  },
  {
    id: 'doc-product',
    filename: 'docs/PRODUCT.md',
    title: '产品价值、用户画像与核心功能',
    badge: 'Core',
    targetAudience: '产品经理、全栈开发者',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/PRODUCT.md

## 1. 目标用户
- **独立开发者 / 个人 Hacker**：需要快速将点子拆解为可靠的技术蓝图。
- **AI Coding 使用者**：需要高质量的 \`AGENTS.md\` 与上下文文档给 Cursor / Antigravity 喂料。

## 2. 核心问题与解决方案
- **问题**：在需求边界未明确时草率编码，导致大量返工。
- **方案**：以 Gap-first 为核心，系统识别最高价值的不确定性，主动启发澄清，而非被动闲聊。

## 3. 功能特性明细
- **首次理解分析**：区分已知事实与 AI 推测，不悄悄把推论变成既定事实。
- **双向同步 Overview**：用户可随时锁定重要决策，AI 不得主动推翻锁定项。
`
  },
  {
    id: 'doc-userflows',
    filename: 'docs/USER_FLOWS.md',
    title: '核心用户旅程与状态流转',
    badge: 'Flow',
    targetAudience: '产品设计、前端开发者',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/USER_FLOWS.md

## 1. 核心闭环流程
1. **首页启动**：输入 Idea / 拖入参考材料 -> 点击“开始构思”。
2. **工作台首轮分析**：展示 Confirmed / Candidate / Assumptions / Risk 概览。
3. **Gap-first 提问**：展示高优先级单题卡片，用户选择选项或自由输入。
4. **状态实时投影**：右栏 Overview 随决策实时更新，支持随时编辑或锁定。
5. **准备度审阅**：进入 Readiness Review，检查 4 个健康分桶。
6. **蓝图生成**：用户点击批准，装配生成 Markdown 并支持一键复制给 Coding Agent。
`
  },
  {
    id: 'doc-ux-ui',
    filename: 'docs/UX_UI_SPEC.md',
    title: 'UX/UI 设计准则与色彩规范',
    badge: 'UX/UI',
    targetAudience: 'UI/UX 设计师、前端开发者',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/UX_UI_SPEC.md

## 1. 视觉风格哲学 (Linear Inspired)
- **Calmer, Consistent, Easier to Scan**：降低界面的自我表现欲，侧边栏主动后退，工作区自然站前。
- **高级感来自可预测**：顶部栏高度一致，Tab 紧凑，不让用户找按钮。
- **色彩 Token**：
  - Surface: \`#FAF9F6\` (Light) / \`#16171B\` (Dark)
  - Ink: \`#0F1115\` (Light) / \`#EDEDED\` (Dark)
  - Muted: \`#71717A\`
  - Border: \`#E8E5DF\` / \`#272930\`
  - Accent: \`#F97316\` (Warm Amber/Orange)
`
  },
  {
    id: 'doc-dev-plan',
    filename: 'docs/DEVELOPMENT_PLAN.md',
    title: '开发阶段实施路线图',
    badge: 'Plan',
    targetAudience: '工程团队、Coding Agent',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/DEVELOPMENT_PLAN.md

## 阶段规划
- **Phase 1 (Done)**：UI 视觉原型与 3 栏交互闭环体验。
- **Phase 2**：本地 Project State Engine（JSON 文件读写、Schema 校验、Lock 保护）。
- **Phase 3**：Single Agent Runtime 接入（Gemini 3.7 / Antigravity 单次推理与结构化解析）。
- **Phase 4**：Document Compiler 模版引擎与一键复制导出。
`
  },
  {
    id: 'doc-acceptance',
    filename: 'docs/ACCEPTANCE.md',
    title: '验收标准与可验证清单',
    badge: 'Acceptance',
    targetAudience: '测试人员、开发者',
    stateRevision: 'rev-20260822-04',
    updatedAt: '刚刚',
    isCurrent: true,
    contentMarkdown: `# docs/ACCEPTANCE.md

## 验收条件
1. 首页到工作台跳转流畅无白屏。
2. 三栏布局均支持独立折叠，窄屏自动降级。
3. 状态标签（Confirmed, Candidate, Assumption, Unresolved, Warning, Locked）清晰对应。
4. Readiness Review 准确展示 4 个分桶，支持批准操作。
5. Documents 视图完整呈现 \`AGENTS.md\` 等 7 份核心蓝图。
`
  }
];
