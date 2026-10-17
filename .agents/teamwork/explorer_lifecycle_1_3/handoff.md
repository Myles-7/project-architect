# Handoff Report: Lifecycle 1-3 Deep Static Audit & UX Penetration

**Author**: Lifecycle 1-3 Deep Explorer  
**Recipient**: Parent Agent (`941edfa1-fed0-49e2-96ca-e33b00dfc5e7`)  
**Date**: 2026-09-25  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation (客观观察与直接代码证据)

本次审计全面覆盖了 `apps/web/`、`apps/server/`、`packages/core/`、`packages/contracts/`、`frontend/` 及 `docs/blueprint/`。直接观察到的关键代码事实与行号如下：

1. **冷启动表单逻辑错位 (LC1-01)**:
   - 文件: `apps/web/src/app/HomeView.tsx`
   - 观察: 第 1063-1068 行的按钮禁用校验为：
     ```tsx
     disabled={
       isSubmitting ||
       (entryMode === 'structured'
         ? !targetUser.trim() && !coreProblem.trim() && !mvpResult.trim()
         : !ideaInput.trim())
     }
     ```
     而第 440 行提交处理函数为：
     ```tsx
     if (!targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()) return;
     ```
     此外第 748-750 行预设点击仅设置 `setProjectName`，未填充任何意图三要素。

2. **冷启动非文本附件二进制破坏 (LC1-06)**:
   - 文件: `apps/web/src/app/HomeView.tsx` 第 405-422 行 与 `apps/server/src/server.ts` 第 976-983 行
   - 观察: `HomeView.tsx` 中只有图片使用 `readAsDataURL`，所有其他格式均走 `reader.readAsText(file)` 并将 `contentEncoding` 标为 `'utf8'`。在 `server.ts` 中以 `Buffer.from(content, 'utf8')` 反序列化并调用 `DocumentExtractor.extractDocumentSafely`，二进制数据被 `\uFFFD` 替代破坏。

3. **ZIP 导入破坏性覆盖 (LC1-07)**:
   - 文件: `packages/core/src/projects/ProjectExportImportService.ts`
   - 观察: 第 140-162 行直接获取 `projectId` 并解压写入 `targetFile = join(projectPath, relPath)`，完全未检查 `await this.storage.exists(projectPath)`，存在同名项目时直接覆盖。

4. **首次推演幽灵加载状态 (LC2-01)**:
   - 文件: `apps/web/src/app/App.tsx:72`、`apps/web/src/state/ProjectSessionContext.tsx:564-604`、`apps/web/src/features/chat/ChatView.tsx:646`
   - 观察: `App.tsx` 创建项目后调用 `runInitialDiscovery`，在 `ProjectSessionContext` 中通过 `apiClient.runDiscoveryTurn` 发起同步调用，`discoveryJob` 保持为 `null`；而 `ChatView` 仅判断 `isBackgroundDiscoveryActive || isSending`，未读取 `requestState.status === 'loading'`，导致进入工作台后前 30-90 秒没有任何加载提示。

5. **问题卡片草稿全局碰撞 (LC2-03)**:
   - 文件: `apps/web/src/features/chat/QuestionCard.tsx`
   - 观察: 第 50 行定义 `const draftKey = 'pa:q_draft:' + question.id;`，缺少 `projectId` 命名空间，不同项目中 ID 相同的卡片共享同一 localStorage 草稿。

6. **问题选项与输入内容互斥丢失 (LC2-04)**:
   - 文件: `apps/web/src/features/chat/QuestionCard.tsx`
   - 观察: 第 102-107 行定义：
     ```ts
     const getFinalAnswerText = (): string => {
       if (freeInput.trim()) {
         return freeInput.trim();
       }
       return selectedOption || '';
     };
     ```
     只要填写了补充文本，用户点击选中的架构选项被无条件直接丢弃。

7. **撤回与后台推演竞态 (LC2-06)**:
   - 文件: `apps/web/src/features/chat/ChatView.tsx`
   - 观察: 第 433-435 行在回答问题后触发 `scheduleDiscoveryJob(revision)`；而在第 115-128 行的 `handleRetractLastQuestion` 撤回处理中，只调用了 `retractQuestion(targetRef)`，未调用 `cancelDiscoveryJob()`，后台仍基于被撤回的前提继续推演。

8. **全景概览漏投架构假设 (LC3-01)**:
   - 文件: `packages/core/src/view/ProjectOverviewProjection.ts:34-67` 与 `apps/web/src/features/overview/OverviewDrawer.tsx:815`
   - 观察: `ProjectOverviewProjection.ts` 的 `items` 仅遍历了 `decisions`，完全遗漏了 `snapshot.assumptions.items`；`OverviewDrawer.tsx` 中假设计数基于 `i.ref.startsWith('assumption:')`，由于底层从未投射该类型，因此恒等于 `0`。

9. **响应式抽屉 Header 冗余堆叠 (LC3-05)**:
   - 文件: `apps/web/src/app/AppShell.tsx:120-130`、`apps/web/src/features/overview/OverviewDrawer.tsx:640-675`、`apps/web/src/components/layout/ResponsiveDrawer.tsx:118-130`
   - 观察: 平板与移动端（<1024px）下，`ResponsiveDrawer` 自身渲染了 48px Header，而其子组件 `OverviewDrawer` 在 `inDrawer=true` 时又渲染了自身的 48px Header，导致抽屉顶部出现两套 Header 与两个关闭 [X] 按钮。

---

## 2. Logic Chain (推导逻辑链)

1. **由 [观察 1] 推导**: `disabled` 属性使用的是 `&&`（任一非空即亮起），而 `handleSubmit` 使用的是 `||`（三者必须全非空）。当用户填入 1~2 项时，按钮处于激活状态，但点击后静默退出；选择预设种子时，未补齐三要素导致按钮禁用且无提示。从而形成“表单死锁与无提示校验缺陷”。
2. **由 [观察 2] 推导**: 浏览器原生 `readAsText` 解析 PDF/DOCX 时，会将非法字节替换为 `\uFFFD`。该字符串经由网络传至服务端再以 UTF-8 编码转 Buffer 时，破坏了文件头（如 `%PDF-` 或 PK 压缩魔数），致使 `pdf-parse` / `mammoth` 提取失败，造成冷启动二进制资料永久损坏。
3. **由 [观察 3] 推导**: 项目导入直接根据解压包内 `projectId` 写入目标目录，缺少目标路径已存在性判断与重命名备份策略，直接破坏本地持久化数据。
4. **由 [观察 4] 推导**: `ProjectSessionContext` 对初始化推演使用同步调用并置 `requestState='loading'`，但未生成 `discoveryJob`；`ChatView` 只监听 `discoveryJob`，导致两者状态失联，产生长达 30-90 秒的完全无响应界面。
5. **由 [观察 5] 推导**: 推演问题卡片 ID（如 `q-01`）在多项目推演中高度重复，因缓存键未隔离 `projectId`，导致跨项目切换时草稿数据相互篡改。
6. **由 [观察 6] 推导**: 用户操作习惯是将选项作为主体结论、补充框作为限定说明。现有代码二选一覆盖，直接导致主体结论在提交时蒸发。
7. **由 [观察 7] 推导**: 撤回操作只改变了状态引擎的决策版本，未中断正在服务端执行的推演任务，推演任务完成后将陈旧前提的推演结果提交回状态库，引发状态错乱与竞态。
8. **由 [观察 8] 推导**: 全景蓝图的资产聚合函数只消费了 decisions，忽略了 assumptions，导致前端对应的筛选与呈现完全失效。
9. **由 [观察 9] 推导**: 容器组件与内容组件未约定 Header 责任边界，在抽屉模式下分别自绘 Header，产生视觉上的双 Header 堆叠。

---

## 3. Caveats (审计边界与局限说明)

1. **只读审计约束**: 本次探索未直接修改 `apps/`、`packages/` 或 `frontend/` 中的任何源码，所有漏洞定位均通过静态符号追踪、AST结构审查与逻辑对齐完成。
2. **硬件/真机视口范围**: 响应式断点分析基于 CSS 类名（`max-w-[...]`, `hidden sm:block`, `@media`）及 Tailwind 配置推导，未在真实硬件设备（如 iOS Safari 物理真机）上进行手势兼容性测试。
3. **Provider LLM 差异**: 针对提词器与首次推演超时的分析基于标准 LLM 响应时延（30-90秒），不同 Provider（如本地模型 vs 云端模型）的时延差异不影响前端缺乏 Loading 状态这一事实。

---

## 4. Conclusion (审计结论)

系统在数据状态两阶段提交与宪法级单向流方面架构设计良好，但在 **Lifecycle 1 (冷启动可用性与文件安全性)**、**Lifecycle 2 (首次加载反馈与推演并发保护)**、**Lifecycle 3 (核心资产投影完整度与响应式可用性)** 上存在多处严重的工程断裂与体验断点。
报告在 `analysis.md` 中收录的 **22 项缺陷（4 项 P0、11 项 P1、6 项 P2、1 项 P3）** 均具备扎实的代码证据链与明确的修复建议，建议优先推进 P0 级致命缺陷的补丁修复。

---

## 5. Verification Method (独立复现与验证方式)

后续实现团队与测试验证人员可采用以下路径独立验证各项事实：

1. **冷启动表单死锁复现**:
   - 打开首页，仅在“目标用户”填入 `测试用户`，“核心痛点”和“MVP成果”留空。
   - 观察右下角“开始推演构思”按钮呈现启用状态，点击按钮，观察控制台无网络请求，表单无反应（验证 `HomeView.tsx:440` 的 `return;` 拦截）。
2. **二进制附件乱码验证**:
   - 在首页拖入任意 `.pdf` 文件，打开 Chrome DevTools Network 标签。
   - 点击提交，检查 `POST /api/projects/:id/inputs` 的 Request Payload，可直接观察到 `contentEncoding: 'utf8'` 且 `content` 包含大量 `\uFFFD`。
3. **首次推演假死复现**:
   - 在首页正常填写三要素创建项目，点击提交跳转进入 `/workspace`。
   - 观察页面无 Spinner、无进度条，直至大模型返回结果前页面处于完全静止状态。
4. **假设资产丢失验证**:
   - 在聊天区回答一个问题并选择“记录为活跃假设 (Assumption)”。
   - 打开右侧“架构决策总览”，观察“假设”胶囊数字恒为 `(0)`，点击后列表为空。
5. **单元与集成测试验证**:
   - 运行项目现有测试命令：
     ```bash
     npm test
     ```
   - 检查 `apps/server/tests/p2-material-extractor.test.ts` 及各包单元测试。
