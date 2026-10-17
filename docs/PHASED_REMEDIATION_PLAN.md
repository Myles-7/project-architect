# Project Architect 前端与全链路体验缺陷治理方案及分阶段实施规划

> **规划版本**：1.0.0 (Formal Implementation Plan)  
> **制定时间**：2026-09-25  
> **指导基准**：`AGENTS.md` (宪法级工程准则)、`docs/FRONTEND_UX_ALL_ROUND_AUDIT.md` (全景审查报告)  
> **实施边界**：聚焦桌面宽屏（1440px / 1920px / 4K）、轻薄本（1024px ~ 1280px）与通用工作台；按照用户明确决议，**明确排除移动端特定适配**（如 375px 挤压、触控热区 < 44px 等），但对于核心数据完整性、算法鲁棒性、空间拓扑可视化、准备度一致性与桌面交互体验，必须**一一论证最优可行性方案并严格落到实处**。

---

## 目录

- [一、 治理原则与边界裁定 (Governance Principles & Scope Filtering)](#一-治理原则与边界裁定-governance-principles--scope-filtering)
  - [1.1 宪法级架构铁律守则](#11-宪法级架构铁律守则)
  - [1.2 视口范围裁定与移动端缺陷剥离清单](#12-视口范围裁定与移动端缺陷剥离清单)
  - [1.3 分阶段交付总览 (P0 -> P1 -> P2)](#13-分阶段交付总览-p0---p1---p2)
- [二、 Stage P0：数据完整性保护、算法鲁棒性与核心阻塞消除](#二-stage-p0数据完整性保护算法鲁棒性与核心阻塞消除)
  - [P0-1 重构文档 AST 章节解析器（代码块语法围栏保护）](#p0-1-重构文档-ast-章节解析器代码块语法围栏保护)
  - [P0-2 文档 Diff 对比引擎升级为行级 Myers LCS 算法](#p0-2-文档-diff-对比引擎升级为行级-myers-lcs-算法)
  - [P0-3 恢复 ChatView 顶层自适应弹性滚动与输入视口保护](#p0-3-恢复-chatview-顶层自适应弹性滚动与输入视口保护)
  - [P0-4 冷启动二进制非文本材料 Base64 安全转码与上传防护](#p0-4-冷启动二进制非文本材料-base64-安全转码与上传防护)
  - [P0-5 本地 ZIP 项目导入同名冲突拦截与时间戳重命名保护](#p0-5-本地-zip-项目导入同名冲突拦截与时间戳重命名保护)
  - [P0-6 消除冷启动首轮推演 30~90 秒无反馈幽灵假死感知](#p0-6-消除冷启动首轮推演-3090-秒无反馈幽灵假死感知)
  - [P0-7 问题卡片草稿 LocalStorage Key 注入项目 ID 隔离命名空间](#p0-7-问题卡片草稿-localstorage-key-注入项目-id-隔离命名空间)
  - [P0-8 首页存量代码库逆向扫描接入逐项复选审查授权抽屉](#p0-8-首页存量代码库逆向扫描接入逐项复选审查授权抽屉)
- [三、 Stage P1：架构空间拓扑、模型单一事实源 (SSOT) 与设计系统校准](#三-stage-p1架构空间拓扑模型单一事实源-ssot-与设计系统校准)
  - [P1-1 架构边界拓扑图彻底剥离宿主元准则硬编码，对齐用户项目领域规约](#p1-1-架构边界拓扑图彻底剥离宿主元准则硬编码对齐用户项目领域规约)
  - [P1-2 组件时序流图基于真实决策依赖建模，废除章节贪吃蛇伪链表](#p1-2-组件时序流图基于真实决策依赖建模废除章节贪吃蛇伪链表)
  - [P1-3 架构图与决策 DAG 接入统一画布平移拖拽引擎与大图动态自适应](#p1-3-架构图与决策-dag-接入统一画布平移拖拽引擎与大图动态自适应)
  - [P1-4 统一准备度评分算法为单一事实源 (SSOT: ReadinessEvaluator)](#p1-4-统一准备度评分算法为单一事实源-ssot-readinessevaluator)
  - [P1-5 全景概览补全“架构假设”资产映射与内存直出响应加速](#p1-5-全景概览补全架构假设资产映射与内存直出响应加速)
  - [P1-6 WCAG 2.1 AA 核心文本对比度全局合规升级](#p1-6-wcag-21-aa-核心文本对比度全局合规升级)
  - [P1-7 单文件独立离线 HTML 交付包接入 CDN 优先与纯文本优雅降级](#p1-7-单文件独立离线-html-交付包接入-cdn-优先与纯文本优雅降级)
  - [P1-8 首页冷启动预设底线保护与多模态表单校验逻辑同步](#p1-8-首页冷启动预设底线保护与多模态表单校验逻辑同步)
- [四、 Stage P2：视觉海拔深度、字阶规范化、大屏利用率与微交互打磨](#四-stage-p2视觉海拔深度字阶规范化大屏利用率与微交互打磨)
  - [P2-1 清除硬编码色值，全面恢复 5 阶 Elevation 空间海拔与纵深感](#p2-1-清除硬编码色值全面恢复-5-阶-elevation-空间海拔与纵深感)
  - [P2-2 消除微字号中文笔画粘连，统一字阶底线为 12px (text-xs)](#p2-2-消除微字号中文笔画粘连统一字阶底线为-12px-text-xs)
  - [P2-3 重构 StatusBadge 多维状态识别体系（消除纯色彩依赖）](#p2-3-重构-statusbadge-多维状态识别体系消除纯色彩依赖)
  - [P2-4 桌面超宽屏 (1440px / 1920px / 4K) 布局自适应与全高阅读器优化](#p2-4-桌面超宽屏-1440px--1920px--4k-布局自适应与全高阅读器优化)
  - [P2-5 深浅色主题自定义偏好持久化至本地缓存](#p2-5-深浅色主题自定义偏好持久化至本地缓存)
  - [P2-6 全屏交互模态框补齐 Escape 快捷键退出与无障碍属性对齐](#p2-6-全屏交互模态框补齐-escape-快捷键退出与无障碍属性对齐)
- [五、 全阶段质量验收指标与自动化验证门禁](#五-全阶段质量验收指标与自动化验证门禁)

---

## 一、 治理原则与边界裁定 (Governance Principles & Scope Filtering)

### 1.1 宪法级架构铁律守则
本治理方案严格受控于 `AGENTS.md` 铁律，所有技术方案与代码实施必须保证：
1. **零中心化数据库 (Zero Centralized DB)**：严禁引入 SQLite、PostgreSQL、Prisma 或 TypeORM 等第三方数据库，全系统坚持本地规范文件目录与双阶段原子 State Commit；
2. **用户授权第一 (User Authority First)**：AI 提出的推演、分析、候选与修复永远是“建议”。仅有用户明确选择、勾选或手动提交才能转为系统决策，严禁越权静默写入；
3. **Core 引擎零外部重依赖**：`packages/core` 必须保持纯 TypeScript 纯函数逻辑，算法（如 Diff、AST 解析、拓扑排序）自研最小化闭环，避免引入臃肿庞杂的第三方运行时；
4. **单向数据流与单一规范事实源 (SSOT)**：所有派生数据必须由 `packages/core` 计算并单向流向前端，消除前端重复计算导致的数据分裂。

### 1.2 视口范围裁定与移动端缺陷剥离清单
根据用户决议：“**不适配移动端，相关问题可以无视，但其余问题要一一落到实处**”。  
我们对照 `docs/FRONTEND_UX_ALL_ROUND_AUDIT.md` 所列的 71 项缺陷，将**仅在移动端（≤ 480px 手机屏）发生、对桌面及平板毫无负面影响的 7 项特定缺陷予以安全裁剪**；其余涉及数据安全、引擎算法、桌面排版、拓扑绘图、色彩无障碍及核心交互的 **64 项核心问题全量纳入**治理范畴：

| 裁剪代号 | 审计原问题 | 严重度 | 裁剪原因说明 |
|:---:|:---|:---:|:---|
| **EXC-01** | DEF-CROSS-01: 移动端建项输入框被压缩至 113px 导致 Placeholder 截断 | P1 | 仅发生在 375px 窄屏，桌面与平板视口输入框均大于 320px，完全正常 |
| **EXC-02** | DEF-CROSS-03: 移动端 (375px) 顶栏、工具栏与 Toast 严重横向泄漏 | P1 | 移动端专有横滑问题；桌面端已采用居中/固定网格，无横向泄漏 |
| **EXC-03** | DEF-CROSS-06: 移动端软键盘呼出导致底部遮挡 | P2 | 移动端虚拟键盘交互特性，桌面端无此场景 |
| **EXC-04** | DEF-CROSS-13: 触控热区小于 44px 人机工效学缺陷 | P2 | 针对指尖触控的移动规范；桌面环境鼠标悬停与点击热区完全精准 |
| **EXC-05** | DEF-CROSS-15: 移动端抽屉全屏遮罩旋转后点击穿透拦截 | P2 | 仅在移动设备横竖屏切换时触发 |
| **EXC-06** | DEF-LC1-08: 首页项目卡片底部密集图标在移动端拥挤 | P2 | 桌面端卡片宽度充裕（≥ 360px），操作图标水平间距健康 |
| **EXC-07** | DEF-LC4-02: 架构图移动端双指手势缩放缺失 | P2 | 桌面端统一通过鼠标拖拽与滚轮/工具栏缩放 |

---

### 1.3 分阶段交付总览 (P0 -> P1 -> P2)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PROJECT ARCHITECT 缺陷治理分阶段实施路线图                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  阶段一：Stage P0 紧急阻断修复与数据完整性守护 (8 项核心任务)                    │
│  - 目标：彻底杜绝数据损坏、解决流程假死死锁、落实用户授权第一铁律             │
│  - 核心突破：AST代码围栏感知、行级 Myers LCS 引擎、ChatView滚动、Base64上传防护 │
├─────────────────────────────────────────────────────────────────────────────┤
│  阶段二：Stage P1 架构拓扑、模型 SSOT 与无障碍校准 (8 项核心任务)                │
│  - 目标：消除蓝图虚假信息、统一评分分歧、恢复拓扑平移操作、WCAG 对比度达标       │
│  - 核心突破：边界图剥离宿主元准则、时序图真实依赖建模、图表平移拖拽、SSOT 评分 │
├─────────────────────────────────────────────────────────────────────────────┤
│  阶段三：Stage P2 视觉海拔、字阶规范化与工匠级打磨 (6 项核心任务)                │
│  - 目标：消除视觉扁平化压平、消灭中文笔画粘连、提升大屏利用率、完善键盘快捷操作 │
│  - 核心突破：清除 #17181D 恢复 5 阶 Elevation、字阶统一 12px、状态多维指示       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、 Stage P0：数据完整性保护、算法鲁棒性与核心阻塞消除

### P0-1 重构文档 AST 章节解析器（代码块语法围栏保护）
- **对应审计缺陷**：`DEF-LC6-01` (致命级 P0)
- **底层原因深度剖析**：
  在 [`packages/core/src/documents/SectionMergeGuard.ts`](file:///d:/桌面/项目构思/packages/core/src/documents/SectionMergeGuard.ts#L36-L64) 的 `splitSections` 方法中，文档章节切分使用了正则 `/(?=^#{1,3}\s+)/m`。该正则仅检测行首是否包含 1~3 个 `#`，完全无法感知代码围栏状态。若用户项目在架构规约、API 样例或脚本示例中编写了以 `#` 开头的注释（如 Python、Shell、YAML、Dockerfile 注释代码段），AST 解析器会将代码块在注释处粗暴切开，使后半截代码脱离原代码围栏，破坏 Markdown AST 结构，导致合并保护机制写入坏损文档。
- **最优可行性技术方案**：
  重构 `splitSections`，引入极简行遍历状态机：
  1. 维护布尔标记 `inCodeFence = false`；
  2. 逐行匹配 `^```[a-zA-Z0-9_-]*` 与 `^~~~`；当命中围栏行时，反转 `inCodeFence` 状态；
  3. 仅当 `!inCodeFence` 时，行首命中的 `^#{1,3}\s+(.+)` 才视为合法的章节划分锚点；
  4. 保持纯函数、零第三方依赖，单次遍历复杂度为 \(O(N)\)。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/documents/SectionMergeGuard.ts`](file:///d:/桌面/项目构思/packages/core/src/documents/SectionMergeGuard.ts)
  ```ts
  export function splitSections(markdown: string): DocumentSection[] {
    const lines = markdown.split(/\r?\n/);
    const sections: DocumentSection[] = [];
    let currentTitle = 'Introduction';
    let currentLines: string[] = [];
    let inCodeFence = false;

    for (const line of lines) {
      if (/^(```|~~~)/.test(line.trimStart())) {
        inCodeFence = !inCodeFence;
      }
      const headingMatch = !inCodeFence ? line.match(/^(#{1,3})\s+(.+)$/) : null;
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({ title: currentTitle, content: currentLines.join('\n') });
          currentLines = [];
        }
        currentTitle = headingMatch[2].trim();
      }
      currentLines.push(line);
    }
    if (currentLines.length > 0) {
      sections.push({ title: currentTitle, content: currentLines.join('\n') });
    }
    return sections;
  }
  ```
- **测试验收准则**：在 `packages/core/tests/SectionMergeGuard.test.ts` 中补充包含含有 `# python comment`、`# bash script` 的多段代码块，验证其重编译前后代码围栏完整性 100% 保持，章节无误分。

---

### P0-2 文档 Diff 对比引擎升级为行级 Myers LCS 算法
- **对应审计缺陷**：`DEF-LC6-02` (致命级 P0)
- **底层原因深度剖析**：
  在 [`packages/core/src/documents/DocumentDiffEngine.ts`](file:///d:/桌面/项目构思/packages/core/src/documents/DocumentDiffEngine.ts#L125-L154) 中，`computeLineDiff` 采用了粗暴的单指针等长遍历：
  `for (let i = 0; i < maxLen; i++) { if (oldLines[i] !== newLines[i]) ... }`。
  只要用户或 AI 在第 1 行插入 1 行空行，后续即使 1000 行内容完全一致，也会因下标整体错位 1 行而被全量误判为“删除旧行、新增新行”，触发严重的红绿伪差异假阳性，使合并审查完全失去可读性。
- **最优可行性技术方案**：
  在 `DocumentDiffEngine.ts` 内部自研极简高效的行级 **最长公共子序列 (LCS / Myers)** 对比算法：
  1. 将输入行哈希为整型数组（加速字符串等值比对）；
  2. 采用标准动态规划或对角线 Myers LCS 查找最长一致行序列；
  3. 回溯生成由 `unchanged`、`added`、`removed` 构成的最小编辑距离块；
  4. 保证算法为本地纯函数，无需引入 `diff-match-patch` 等外部体积，时间与空间复杂度在千行文档下仅需 2~5ms。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/documents/DocumentDiffEngine.ts`](file:///d:/桌面/项目构思/packages/core/src/documents/DocumentDiffEngine.ts)
  - 替换 `computeLineDiff` 的循环逻辑为两阶段 LCS 求解与回溯。
- **测试验收准则**：新增 `packages/core/tests/DocumentDiffEngine.test.ts` 测试：在包含 200 行文字的文档首行插入 1 行空行，生成的 Diff 结果仅且仅有 1 处 `added`，其余 200 行全部为 `unchanged`，伪差异彻底归零。

---

### P0-3 恢复 ChatView 顶层自适应弹性滚动与输入视口保护
- **对应审计缺陷**：`DEF-LC2-02` (致命级 P0)
- **底层原因深度剖析**：
  在 [`apps/web/src/app/WorkspaceView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/WorkspaceView.tsx#L72,L80-L84) 中，当激活推演视图（`activeTab === 'chat'`）时，其父容器被赋予了 `h-full overflow-hidden flex flex-col`，而内部承载组件 [`ChatView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/ChatView.tsx) 的根级 div 缺乏 `min-h-0 flex-1 overflow-y-auto`。当推演产生多张问题卡片时，页面内容总高超出屏幕，但滚动条被外层 `overflow-hidden` 硬生生吃掉。底部的“自由补充输入框”与提交按钮沉底至视口外，且无法向下滚动，用户工作流彻底阻断死锁。
- **最优可行性技术方案**：
  1. 在 `WorkspaceView.tsx` 中将 `isChatTab` 容器声明为弹性伸缩滚动列：`flex-1 min-h-0 flex flex-col overflow-hidden`；
  2. 在 `ChatView.tsx` 中建立严格的视口双层结构：
     - **主内容流动区**：`flex-1 min-h-0 overflow-y-auto px-4 py-6 scroll-smooth`，承载提词器与所有历史问题卡片；
     - **底部操作停靠区**：`shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-surface-base/95 backdrop-blur-sm p-4`，始终锁定停靠在视口底部，确保在任意屏幕高度下输入框永远处于可见与可聚焦状态。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/app/WorkspaceView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/WorkspaceView.tsx#L72)
  - 文件：[`apps/web/src/features/chat/ChatView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/ChatView.tsx#L618-L640)
- **测试验收准则**：在 768px 高度视口下注入 5 张问题卡片，验证主聊天区出现顺滑滚动条，底部输入框牢牢贴底显示，输入文字并按 Enter 提交顺畅。

---

### P0-4 冷启动二进制非文本材料 Base64 安全转码与上传防护
- **对应审计缺陷**：`DEF-LC1-06` (致命级 P0)
- **底层原因深度剖析**：
  在 [`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx#L405-L422) 中，冷启动文件拖拽上传处理逻辑针对所有扩展名均直接调用 `reader.readAsText(file)`。当用户上传 `.pdf` 或 `.docx` 二进制架构参考材料时，浏览器强制按 UTF-8 文本解码，将其二进制字节全部替换为乱码（Unicode Replacement Character `\uFFFD`），导致传至后端的 Base64 提取器因格式头全毁而抛错解析失败。
- **最优可行性技术方案**：
  在前端构建文件类型分流器（Type Dispatcher）：
  1. 定义纯文本扩展名白名单：`const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.yaml', '.yml', '.ts', '.js', '.py'])`；
  2. 若为纯文本，调用 `reader.readAsText(file)`；
  3. 若为 `.pdf`、`.docx`、`.doc` 等二进制材料，调用 `reader.readAsDataURL(file)`，提取其标准的 `data:application/pdf;base64,...` Payload，确保文件魔数与二进制完整性 100% 保持；
  4. 校验单文件体积不超过 20MB，超过时即时提示拦截。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx#L405-L425)
- **测试验收准则**：在冷启动界面拖拽上传一份 `sample.pdf`，验证网络面板发送的 Payload 具有完整 `data:application/pdf;base64,JVBERi0...` 前缀，服务端成功解析提取出文档目录。

---

### P0-5 本地 ZIP 项目导入同名冲突拦截与时间戳重命名保护
- **对应审计缺陷**：`DEF-LC1-07` (致命级 P0)
- **底层原因深度剖析**：
  在 [`packages/core/src/projects/ProjectExportImportService.ts`](file:///d:/桌面/项目构思/packages/core/src/projects/ProjectExportImportService.ts#L140-L162) 中，`importProjectFromZip` 读取 ZIP 内的 `manifest.json` 后，直接以其 `manifest.id` 作为存储目录路径调用保存。如果本地已有同 ID 项目（例如多次导入同一备份），服务端直接覆盖现有状态与文档，无同名检测与确认机制。
- **最优可行性技术方案**：
  1. 在保存解压项目前，先调用 `this.storage.exists(projectDir)`；
  2. 若目录已存在，禁止粗暴覆盖，自动重命名策略为时间戳安全后缀：`manifest.id = `${manifest.id}-imported-${Date.now().toString(36)}`;
  3. 同步修正 `manifest.name = `${manifest.name} (导入副本)`;
  4. 返回包含 `renamed: boolean` 标记的导入结果，并在前端弹出温馨提示。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/projects/ProjectExportImportService.ts`](file:///d:/桌面/项目构思/packages/core/src/projects/ProjectExportImportService.ts#L140-L165)
- **测试验收准则**：连续两次导入相同 ZIP 压缩包，验证本地项目列表中生成了两个相互独立的项目实例，第一份数据完好无损。

---

### P0-6 消除冷启动首轮推演 30~90 秒无反馈幽灵假死感知
- **对应审计缺陷**：`DEF-LC2-01` (致命级 P0)
- **底层原因深度剖析**：
  首页创建项目后，通过全局 `ProjectSessionContext` 触发首轮推演异步请求。但跳转至工作区后，[`ChatView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/ChatView.tsx#L646) 仅依赖其自身组件内部的局部 `isSending` 状态控制加载转轮。由于该局部状态在首轮并未被赋值，且此时首轮问题尚未落盘返回，`questions.length === 0`，导致整个视图展现为完全空白的死寂状态，给用户造成“应用已卡死”的错觉。
- **最优可行性技术方案**：
  1. `ChatView` 接入全局上下文的 `requestState` 与 `isInferring` 信号；
  2. 当 `questions.length === 0` 且全局处于推演中（`isInferring === true`）时，渲染居中的沉浸式**“架构推演进行中 (Architectural Reasoning)”**提词器动画卡片；
  3. 展示动态四阶段指示（`[1/4 提取上下文] -> [2/4 识别张力] -> [3/4 权衡依赖] -> [4/4 生成决策卡片]`），并提供流光动效与预计耗时说明，彻底消除用户假死焦虑。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/features/chat/ChatView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/ChatView.tsx#L640-L670)
- **测试验收准则**：在创建新项目进入工作台的瞬间，立即看到优雅的提词器步进动画与呼吸流光，无任何空白帧。

---

### P0-7 问题卡片草稿 LocalStorage Key 注入项目 ID 隔离命名空间
- **对应审计缺陷**：`DEF-LC2-03` (致命级 P0)
- **底层原因深度剖析**：
  在 [`apps/web/src/features/chat/QuestionCard.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/QuestionCard.tsx#L50) 中，草稿缓存键被硬编码为：
  `const storageKey = `question_draft_${question.id}`;`。
  由于不同项目的初始阶段问题由固定模板或相近决策树衍生（如均为 `q-domain-boundary`），在同一浏览器中切换项目时，前一个项目的未提交草稿与选中项会被带入后一个项目，造成严重的表单串号与数据污染。
- **最优可行性技术方案**：
  从项目上下文中提取 `projectId`，将 Storage Key 重构为严格的项目命名空间隔离：
  `const storageKey = `pa_${activeProjectId}_draft_${question.id}`;`。
  并在问题提交成功后自动清除该特定 Key。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/features/chat/QuestionCard.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/QuestionCard.tsx#L50-L60)
- **测试验收准则**：在项目 A 的问题 1 输入未保存文本，切换至项目 B 的同名问题，输入框显示为空白；切换回项目 A，文本正常保留。

---

### P0-8 首页存量代码库逆向扫描接入逐项复选审查授权抽屉
- **对应审计缺陷**：`DEF-LC1-05` (致命级 P0)
- **底层原因深度剖析**：
  在 [`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx#L471,L620-L655) 中，首页代码库逆向扫描完成后，提交建项时粗暴地将 `brownfieldAnalysis?.candidateDecisions` 全部灌入新工程，未提供任何复选控件，完全剥夺了用户的审查与过滤权，直接违反 `AGENTS.md`“用户授权第一”铁律。
- **最优可行性技术方案**（已获用户明确决议确认）：
  **抽屉复选审查模式**：
  1. 首页逆向扫描解析完成后，不直接静默提交，而是展开与工作区内部一致的候选审查抽屉或模态列表；
  2. 每一条扫描出的决策候选（如技术栈选型、模块边界）默认带有勾选框，并清晰展示置信度与证据代码；
  3. 用户可按需逐项勾选或“一键反选”，只有用户明确勾选的条目才会组装入创建 Payload；未勾选条目作为丢弃项，确保新项目状态库绝对纯净。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx#L465-L480, L620-L660)
  - 引入与复用类似 [`BrownfieldScanModal.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/brownfield/BrownfieldScanModal.tsx) 的复选状态管理。
- **测试验收准则**：在首页选择包含 10 个候选决策的代码库扫描，仅勾选其中 3 个，创建项目后进入决策总览，验证决策列表中确实仅有这 3 条，其余 7 条未被灌入。

---

## 三、 Stage P1：架构空间拓扑、模型单一事实源 (SSOT) 与设计系统校准

### P1-1 架构边界拓扑图彻底剥离宿主元准则硬编码，对齐用户项目领域规约
- **对应审计缺陷**：`DEF-LC4-01` (严重级 P1)
- **底层原因深度剖析**：
  在 [`packages/core/src/diagrams/MermaidGenerator.ts`](file:///d:/桌面/项目构思/packages/core/src/diagrams/MermaidGenerator.ts#L180-L196) 中，`generateBoundaryDiagram` 函数硬编码了当前宿主工具自身的开发宪法：
  `subgraph Constraints ["Core Constraints & Governance"] ... "Zero Centralized DB" ... "B3 Single Structured Turn"`。
  这导致用户在构思任何业务系统（如电商、金融、社交系统）时，生成的架构边界图强行显示本工具的开发铁律，严重破坏了用户架构白皮书的专业性与真实性。
- **最优可行性技术方案**：
  1. 彻底删除 `MermaidGenerator.ts` 中硬编码的宿主工程规则；
  2. 改为从 `snapshot.metadata.constraints` 及用户项目分类为 `boundary` 或 `governance` 的决策项中动态提取；
  3. 若用户项目暂未确立边界决策，则展示通用的“用户领域边界（Domain Boundaries Under Discovery）”，绝不泄漏宿主元规则。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/diagrams/MermaidGenerator.ts`](file:///d:/桌面/项目构思/packages/core/src/diagrams/MermaidGenerator.ts#L180-L210)
- **测试验收准则**：运行测试生成图表，验证生成的 Mermaid DSL 中不再包含任何 "Zero Centralized DB" 或 "B3 Single Structured Turn" 字样，而是反映该项目真实的业务边界。

---

### P1-2 组件时序流图基于真实决策依赖建模，废除章节贪吃蛇伪链表
- **对应审计缺陷**：`DEF-LC4-02` (严重级 P1)
- **底层原因深度剖析**：
  在 [`packages/core/src/diagrams/MermaidGenerator.ts`](file:///d:/桌面/项目构思/packages/core/src/diagrams/MermaidGenerator.ts#L117-L125) 中，组件时序与数据流图仅简单地将文档章节首尾串联：
  `A[01_PRODUCT_BOUNDARY] --> B[02_SYSTEM_ARCHITECTURE] --> C[...]`，
  造成完全失真的“文档章节贪吃蛇长链”，对微服务拓扑与前后端调用流毫无参考价值。
- **最优可行性技术方案**：
  基于真实决策依赖有向无环图建模：
  1. 过滤出分类为 `module`、`service`、`component` 的架构决策；
  2. 提取其真实 `dependsOn` 关系，生成真正的系统依赖调用拓扑；
  3. 若无显式依赖，则按照经典四层分层模型（`Client Layer` -> `Gateway Layer` -> `Service Core` -> `Data Store`）进行归类拓扑。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/diagrams/MermaidGenerator.ts`](file:///d:/桌面/项目构思/packages/core/src/diagrams/MermaidGenerator.ts#L110-L145)
- **测试验收准则**：在包含前后端分离决策的项目中，生成的时序与组件图清晰反映前端调用网关、网关调用微服务的真实层级拓扑。

---

### P1-3 架构图与决策 DAG 接入统一画布平移拖拽引擎与大图动态自适应
- **对应审计缺陷**：`DEF-LC4-03` / `DEF-LC4-04` (严重级 P1)
- **底层原因深度剖析**：
  目前 [`ArchitectureDiagramsView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx) 中的 Mermaid 图表仅提供了粗糙的缩放倍率，缺失鼠标平移拖拽机制；放大后边缘节点被视口截断。而在 50+ 节点大型拓扑下，SVG 被外部 `max-w-full` 强行限制宽度，整个图表被压平至 1px 细线，文字完全无法辨识。
- **最优可行性技术方案**：
  1. 封装通用的轻量 React 视口变换 Hook：`useCanvasPanZoom`，统一接管 `scale`、`panOffset: { x, y }`；
  2. 监听鼠标左键按住拖拽、滚轮自适应缩放（以鼠标光标所在点为缩放中心）；
  3. 解除对内部 SVG 的硬性压平，设置动态内联样式 `minWidth: Math.max(100%, calculatedWidth)`，保证节点文字永远清晰可见；
  4. 工具栏提供一键居中复位（Reset to Center）与适合窗口（Fit to Window）。
- **核心文件与精确改动**：
  - 新建 Hook：`apps/web/src/components/common/useCanvasPanZoom.ts`
  - 重构：[`apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx#L40-L90)
  - 联动升级：[`apps/web/src/features/dag/DecisionDAGExplorer.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/dag/DecisionDAGExplorer.tsx)
- **测试验收准则**：在 1440px 桌面加载 50+ 节点拓扑图，拖拽鼠标画布平滑移动，滚轮缩放到 200% 时依然可清晰查看任意节点文字与依赖箭头。

---

### P1-4 统一准备度评分算法为单一事实源 (SSOT: ReadinessEvaluator)
- **对应审计缺陷**：`DEF-LC5-01` (严重级 P1)
- **底层原因深度剖析**：
  目前系统中存在两套准备度评分逻辑：
  - Core 核心引擎：[`packages/core/src/readiness/ReadinessEvaluator.ts`](file:///d:/桌面/项目构思/packages/core/src/readiness/ReadinessEvaluator.ts#L94)（满分 100 扣减法，考虑 Blocker、Gap、Tension）；
  - 前端投影引擎：[`packages/core/src/projections/ReadinessProjection.ts`](file:///d:/桌面/项目构思/packages/core/src/projections/ReadinessProjection.ts#L191-L198)（分项加权平均法）。
  这导致顶栏仪表盘大字分数（82 分）与分项明细表格累加值（61 分）出现数学上的严重分歧。
- **最优可行性技术方案**：
  贯彻单向数据流与单一事实源铁律：
  1. 废除 `ReadinessProjection.ts` 中的私有加权计算公式；
  2. `ReadinessProjection` 统一调用并直接透传 `ReadinessEvaluator.evaluate(snapshot)` 的计算结果；
  3. 顶栏仪表盘分数、分项进度条、门禁准入状态 100% 绑定自同一个评估对象，从数学根源上消灭分歧。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/projections/ReadinessProjection.ts`](file:///d:/桌面/项目构思/packages/core/src/projections/ReadinessProjection.ts#L190-L205)
- **测试验收准则**：运行测试，验证在不同阶段的 Snapshot 下，`ReadinessProjection` 产出的 `overallScore` 与 `ReadinessEvaluator` 产出的 `score` 严格相等（Delta = 0）。

---

### P1-5 全景概览补全“架构假设”资产映射与内存直出响应加速
- **对应审计缺陷**：`DEF-LC3-01` / `DEF-LC3-02` (严重级 P1)
- **底层原因深度剖析**：
  在 [`packages/core/src/projections/ProjectOverviewProjection.ts`](file:///d:/桌面/项目构思/packages/core/src/projections/ProjectOverviewProjection.ts#L34-L67) 中，概览项仅组装了决策、风险和冲突，彻底遗漏了 `snapshot.assumptions`，导致概览抽屉中“架构假设”计数永远为 0。且每次在抽屉中快捷编辑一个决策，都会触发全量 HTTP 重新拉取投影，导致列表剧烈闪烁重绘。
- **最优可行性技术方案**：
  1. 在 `ProjectOverviewProjection` 中将 `snapshot.assumptions` 规整为标准项（类型为 `assumption`）并入条目数组；
  2. 前端抽屉接入本地 `useMemo` 内存直出，编辑决策状态时进行乐观更新（Optimistic Update），异步同步至后端，彻底消除闪烁。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/projections/ProjectOverviewProjection.ts`](file:///d:/桌面/项目构思/packages/core/src/projections/ProjectOverviewProjection.ts#L50-L75)
  - 文件：[`apps/web/src/features/overview/OverviewDrawer.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/overview/OverviewDrawer.tsx#L103-L125)
- **测试验收准则**：存在 3 条假设的项目，在概览抽屉顶部清晰显示“假设 (3)”药丸，点击仅展示假设卡片；行内点击“确认决策”时无白屏闪烁。

---

### P1-6 WCAG 2.1 AA 核心文本对比度全局合规升级
- **对应审计缺陷**：`DEF-THEME-01` (严重级 P1)
- **底层原因深度剖析**：
  暗色模式下，大量副标题、表单 Label、状态徽章与弱元数据直接使用了 `dark:text-zinc-600`（色值 `#52525B`）。在 `#090A0F` 或 `#12131A` 暗色底板上，其实测对比度仅为 **2.31:1**，远远低于 W3C WCAG 2.1 AA 规范对正文与关键信息的最低 4.5:1 要求，造成肉眼可读性极差。
- **最优可行性技术方案**：
  全局设计系统颜色 Token 语义化重校：
  1. 在全局 CSS 变量中校准暗色弱化文本：将弱辅助文本底线由 `zinc-600` 升级为 `zinc-400`（色值 `#A1A1AA`，在暗黑底板对比度高达 **7.2:1**，远超 4.5:1）；
  2. 针对必须保持次级的极弱文字，使用 `zinc-500`（对比度 **4.8:1**，依旧稳稳达标 4.5:1）；
  3. 批量修正视图组件中的硬编码类名。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/styles/index.css`](file:///d:/桌面/项目构思/apps/web/src/styles/index.css)
  - 文件：[`apps/web/src/components/common/TopNav.tsx`](file:///d:/桌面/项目构思/apps/web/src/components/common/TopNav.tsx#L91)
  - 文件：[`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx)
- **测试验收准则**：通过自动化脚本计算全站文字色彩亮度对比度，暗色模式下所有文本节点对比度均严格 $\ge 4.5:1$。

---

### P1-7 单文件独立离线 HTML 交付包接入 CDN 优先与纯文本优雅降级
- **对应审计缺陷**：`DEF-LC6-04` (严重级 P1)
- **底层原因深度剖析**：
  导出的独立 HTML 包中，架构图表仅保留为 `<pre class="code-block" data-lang="mermaid">`，离线打开时没有内置解析脚本。
- **最优可行性技术方案**（已获用户明确决议确认）：
  **CDN 优先与代码块优雅降级**：
  1. 在导出的单文件 HTML `<head>` 中引入主流高速 CDN（如 unpkg / cdnjs）的 Mermaid.js；
  2. 并在页面加载脚本中加入网络连通性与渲染捕获防护：
     ```html
     <script>
       if (window.mermaid) {
         try { mermaid.init(undefined, '.mermaid-diagram'); } catch (e) { fallback(); }
       } else {
         fallback();
       }
       function fallback() {
         // 脱网时优雅降级：保留带语法高亮与复制功能的清晰 Mermaid DSL 源码卡片
         document.querySelectorAll('.mermaid-diagram').forEach(el => el.classList.add('dsl-fallback'));
       }
     </script>
     ```
  3. 产物体积完全不膨胀，保持在 400KB 以内的极轻体量，联网时呈现高品质矢量图，脱网时优雅展示结构清晰的架构 DSL 源码。
- **核心文件与精确改动**：
  - 文件：[`packages/core/src/export/StandaloneHtmlExporter.ts`](file:///d:/桌面/项目构思/packages/core/src/export/StandaloneHtmlExporter.ts#L410-L440)
- **测试验收准则**：脱网打开导出的 HTML，页面不报错，图表区域呈现整洁的代码高亮块与“已降级为 DSL 源码”友好提示。

---

### P1-8 首页冷启动预设底线保护与多模态表单校验逻辑同步
- **对应审计缺陷**：`DEF-LC1-01` / `DEF-LC1-02` (严重级 P1)
- **底层原因深度剖析**：
  1. 用户选定系统架构预设（如“CLI 运维工具”）后，切换到灵感模板时，代码硬编码执行了 `setSelectedPresetId(null)`，将已选底层架构悄然清空；
  2. 提交按钮的 `disabled` 判定使用了 `&&`，而提交函数内部却使用了 `||`，造成“按钮看似可点击，点击后却静默拦截无反应”的死锁体验。
- **最优可行性技术方案**：
  1. 移除 `setSelectedPresetId(null)`，灵感模板聚焦业务场景，架构预设聚焦技术底线，二者正交共存；
  2. 统一表单校验逻辑为短路逻辑闭环：当必填字段未满足时，提交按钮显示禁用，表单下方显示清晰的必填提示；点击预设卡片时自动填充示范内容。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/app/HomeView.tsx`](file:///d:/桌面/项目构思/apps/web/src/app/HomeView.tsx#L367-L376, L440, L1063-L1068)
- **测试验收准则**：先选架构预设，再选灵感模板，预设卡片保持激活高亮；直接点击“开始推演”顺畅提交，无静默拦截。

---

## 四、 Stage P2：视觉海拔深度、字阶规范化、大屏利用率与微交互打磨

### P2-1 清除硬编码色值，全面恢复 5 阶 Elevation 空间海拔与纵深感
- **对应审计缺陷**：`DEF-THEME-02` (次要级 P2)
- **底层原因深度剖析**：
  在 [`Modal.tsx`](file:///d:/桌面/项目构思/apps/web/src/components/common/Modal.tsx#L60)、[`OverviewDrawer.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/overview/OverviewDrawer.tsx#L280) 等 35+ 处组件中，开发者硬编码了 `bg-[#17181D]`。导致视口背景底板、中间内容卡片、右侧弹出抽屉、顶层模态框的颜色完全相同，设计系统定义精美的 5 阶 Elevation 海拔层级被全部压平塌缩，界面失去空间进深与视觉焦点。
- **最优可行性技术方案**：
  全面回归设计系统语义 Token：
  - **Level 0 (Canvas Base)**：`bg-surface-base` (`#090A0F`)
  - **Level 1 (Card/Container)**：`bg-surface-card` (`#12131A`) 带微弱边框 `border-border-subtle`
  - **Level 2 (Drawer/Sidebar)**：`bg-surface-elevated` (`#181922`) 带有向左投影 `shadow-2xl`
  - **Level 3 (Modal/Dialog)**：`bg-surface-overlay` (`#1F202B`) 带有大模糊投影 `shadow-elevation-modal`
- **核心文件与精确改动**：
  - 批量清理业务组件中的 `bg-[#17181D]`，替换为语义化原子类。
- **测试验收准则**：在暗色模式下展开抽屉并弹出模态框，背景底板、抽屉与弹窗三者具有清晰可辨的明暗梯级与阴影景深。

---

### P2-2 消除微字号中文笔画粘连，统一字阶底线为 12px (text-xs)
- **对应审计缺陷**：`DEF-THEME-04` (次要级 P2)
- **底层原因深度剖析**：
  界面中存在上百处 `text-[10px]` 与 `text-[9px]` 的微字号写法。在标准 1080P 或非 Retina 显示屏上，中文汉字因像素网格限制发生严重的横竖笔画粘连、模糊不清，严重损害阅读体验。
- **最优可行性技术方案**：
  贯彻现代前端字阶规范：
  1. 全局中文排版最低字阶严格定格为 **12px (`text-xs`)**；
  2. 对于次级小标签（如徽章、计数器），通过缩小 `padding`（如 `px-1.5 py-0.5`）或字母间距（`tracking-wide uppercase`）实现紧凑精致感，绝不牺牲 12px 基础物理可读性。
- **核心文件与精确改动**：
  - 全局业务组件（搜索 `text-[10px]` 与 `text-[9px]`）批量归正为 `text-xs`。
- **测试验收准则**：全站所有中文标签在 100% 缩放的 1080P 屏幕上笔画根根分明，无粘连模糊。

---

### P2-3 重构 StatusBadge 多维状态识别体系（消除纯色彩依赖）
- **对应审计缺陷**：`DEF-THEME-03` (次要级 P2)
- **底层原因深度剖析**：
  在 [`StatusBadge.tsx`](file:///d:/桌面/项目构思/apps/web/src/components/common/StatusBadge.tsx#L23-L41) 中，不同状态（锁定、草稿、冲突、待定）完全依赖一个直径 6px 的圆形小色点进行区分，严重违反 WCAG 1.4.1“不单纯依赖颜色传递信息”的无障碍准则，色弱、色盲用户完全无法分辨。
- **最优可行性技术方案**：
  升级为“**几何图标 + 语义微底色 + 文字标签**”三位一体识别体系：
  - **锁定状态 (Locked)**：带微暗蓝底色，内置精确的 `Lock` 矢量锁形图标；
  - **已确认状态 (Confirmed)**：带翠绿底色，内置 `Check` 对勾图标；
  - **冲突/风险状态 (Conflict)**：带琥珀黄底色，内置 `AlertTriangle` 三角警告图标；
  - **候选状态 (Candidate)**：带虚线边框与 `Clock` 待定图标。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/components/common/StatusBadge.tsx`](file:///d:/桌面/项目构思/apps/web/src/components/common/StatusBadge.tsx)
- **测试验收准则**：在开启灰度单色滤镜（模拟全色盲）下，用户依然能 100% 凭借图标形状与文字标签准确区分所有资产状态。

---

### P2-4 桌面超宽屏 (1440px / 1920px / 4K) 布局自适应与全高阅读器优化
- **对应审计缺陷**：`DEF-CROSS-04` / `DEF-CROSS-05` (次要级 P2)
- **底层原因深度剖析**：
  在 1920px 及 4K 宽屏下，推演中央容器被死死卡在 `max-w-2xl`，两侧出现大面积苍白或空洞的无效留白（留白占比超 40%）；同时，文档阅读器的高度被定死在 `h-[500px]`，导致在 1440px 高度的大屏上出现“外屏空空荡荡、内框疯狂滚动”的局促窘境。
- **最优可行性技术方案**：
  1. 中央流式容器在超宽屏下优雅放宽：`max-w-3xl xl:max-w-4xl 2xl:max-w-5xl`，兼顾阅读舒适度与空间利用率；
  2. 文档阅读器采用视口动态贴合：`h-[calc(100vh-200px)]`，充分利用纵向视野，免去不必要的局部滚动。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/features/chat/ChatView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/chat/ChatView.tsx#L618)
  - 文件：[`apps/web/src/features/documents/DocumentsView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/documents/DocumentsView.tsx#L606)
- **测试验收准则**：在 1920×1080 浏览器全屏窗口下，文档内容自然撑满纵向可用高度，无需小窗口滚动。

---

### P2-5 深浅色主题自定义偏好持久化至本地缓存
- **对应审计缺陷**：`DEF-CROSS-07` (次要级 P2)
- **底层原因深度剖析**：
  用户在顶栏切换为浅色模式后，一旦按下 F5 刷新页面或重新打开工程，系统立刻重置为默认暗色模式，用户自定义的视觉习惯无法保持。
- **最优可行性技术方案**：
  在 `ProjectSessionContext` 与 `ThemeToggle` 之间接入 `localStorage` 管道：
  1. 初始化时优先读取 `localStorage.getItem('pa_theme_preference')`；
  2. 用户点击切换时，同步写入本地缓存并修改 `document.documentElement.classList`；
  3. 彻底避免页面加载时的白色闪屏（FOUC）。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/components/common/ThemeToggle.tsx`](file:///d:/桌面/项目构思/apps/web/src/components/common/ThemeToggle.tsx#L15-L30)
  - 文件：[`apps/web/src/context/projectSessionReducer.ts`](file:///d:/桌面/项目构思/apps/web/src/context/projectSessionReducer.ts#L115-L125)
- **测试验收准则**：切换为浅色主题，按 F5 强制刷新浏览器 3 次，页面均稳定保持浅色主题不变。

---

### P2-6 全屏交互模态框补齐 Escape 快捷键退出与无障碍属性对齐
- **对应审计缺陷**：`DEF-LC4-05` / `DEF-CROSS-09` (优化级 P3)
- **底层原因深度剖析**：
  部分全屏模态框（如架构图全屏大图预览、探活弹窗）缺少全局 `keydown` 监听，按 `Escape` 键无法退出；且内部关闭按钮与公共 Modal 的 `aria-label="关闭"` 发生无障碍重名冲突，触发 Playwright 严格模式定位报错。
- **最优可行性技术方案**：
  1. 架构图大图预览全量复用公共 `Modal.tsx` 或统一注入 `useEscapeKey(onClose)`；
  2. 为不同业务模态框的关闭按钮提供专有的语义 Accessible Name（如 `aria-label="关闭探活弹窗"`、`aria-label="退出大图全屏"`），消除严格模式定位歧义。
- **核心文件与精确改动**：
  - 文件：[`apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx#L185-L210)
  - 文件：[`apps/web/src/features/home/ProviderHealthModal.tsx`](file:///d:/桌面/项目构思/apps/web/src/features/home/ProviderHealthModal.tsx#L65-L75)
- **测试验收准则**：打开任意全屏弹窗或图表，敲击键盘 Escape 键瞬时平滑关闭；Playwright 严格模式定位选择器 0 冲突报错。

---

## 五、 全阶段质量验收指标与自动化验证门禁

在每一阶段的代码实施完成后，必须严格执行并全部通过以下四大刚性门禁，方可宣布该阶段治理完成：

```bash
# 1. 架构宪法与规范漂移静态审计 (0 违规，严守 Zero-DB 与单向契约)
pnpm verify

# 2. 全库静态语法与代码质量检查 (覆盖 270+ 源码文件，0 错误，0 警告)
pnpm lint

# 3. 跨包完整编译构建 (覆盖 6 个工作区包，tsc + vite 干净构建)
pnpm build

# 4. 全量自动化单元测试与端到端回归测试 (保持 480+ 测试 100% 通过率)
pnpm test
```

本规划方案已将所有问题深度解构为切实可行的算法改良、布局重构与状态修复，彻底杜绝浮于表面的空泛修改，为接下来的分阶段落地开发提供了绝对清晰、严密的工程蓝图。
