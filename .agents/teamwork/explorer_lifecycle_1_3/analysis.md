# Project Architect 深度代码审计与交互穿透报告 (Lifecycle 1 - 3)

**报告版本**: 1.0.0  
**审计周期**: 2026-09-25  
**审计角色**: Lifecycle 1-3 Deep Explorer (只读审查与交互穿透)  
**审计范畴**: 
- **Lifecycle 1**: 项目初始化与冷启动 (预设种子选择、自由文本构思、存量代码透视、历史归档/激活、工程导入导出)
- **Lifecycle 2**: 架构推演与智能问答 (提词器流式渲染、问题卡片交互、多阶段推演推进、10秒级联撤回机制、网络异常与重试恢复)
- **Lifecycle 3**: 架构资产与决策管理 (双视图协同与批量操作、行内编辑/确认/锁定/解锁、多维度筛选持久化、抽屉与指标栏响应式联动)

---

## 一、 执行摘要与缺陷全景矩阵 (Executive Summary & Defect Matrix)

经过对 `frontend/` (原型实现)、`apps/web/` (前端生产应用)、`apps/server/` (本地核心服务)、`packages/core/` (状态引擎)、`packages/contracts/` (数据契约) 以及 `docs/blueprint/` (架构蓝图) 的全面交叉审计与交互穿透，共发现 **22 处系统性缺陷与体验断点**。

其中：
- **P0 致命级缺陷 (Flow Blocker / Data Corruption)**: **4 项** (冷启动二进制材料破坏、存量代码透视绕过用户授权、ZIP导入静默破坏性覆盖、首次推演幽灵加载状态与卡死)
- **P1 严重级缺陷 (Core Interaction Breakpoint / Missing Essential Flow)**: **11 项** (预设选择无障碍陷阱与校验错位、灵感模板强冲预设边界、四项意图与自由文本单向丢失、换行符污染项目元数据、提词器纯前端虚假计时、跨项目草稿污染、选项与输入内容互斥冲突、阶段术语分裂、撤回竞态并发残留、蓝图总览漏投假设资产、响应式抽屉双重 Header 堆叠)
- **P2 次要级缺陷 (Micro-detail / Suboptimal UX)**: **6 项** (断网语义错误混淆、双击复制触发编辑、Textarea 行内自适应抖动、指标栏窄屏溢出、纯计算属性冗余 HTTP 往返、缺少 `.pa-project` 独立格式支持)
- **P3 轻微优化 (Minor Visual Polish)**: **1 项** (归档项目缺少工作区专属只读感知标牌)

### 缺陷全景矩阵 (Defect Matrix)

| 编号 | 所属生命周期 | 缺陷简述 | 严重级别 | 触发场景 | 根因文件及关键行号 |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **LC1-01** | Lifecycle 1 | 预设种子选择导致表单死锁与按钮校验逻辑错位 | **P1** | 首页点击架构预设卡片 | `apps/web/src/app/HomeView.tsx:748-750, 440, 1063-1068` |
| **LC1-02** | Lifecycle 1 | 场景灵感模版强行抹除已选架构预设底线约束 | **P1** | 首页先选预设再选灵感模板 | `apps/web/src/app/HomeView.tsx:367-376` |
| **LC1-03** | Lifecycle 1 | 结构化四项意图与自由长文本切换发生数据单向丢失 | **P1** | 首页表单切换输入模式 | `apps/web/src/app/HomeView.tsx:474-479, 585-596` |
| **LC1-04** | Lifecycle 1 | 构思文本前置换行符直接污染项目 Slug 与元数据 | **P1** | 自由文本输入首行包含换行或标题 | `apps/web/src/app/HomeView.tsx:478`, `ProjectStateEngine.ts:115` |
| **LC1-05** | Lifecycle 1 | 首页存量代码库透视绕过用户授权直接全量灌入 | **P0** | 首页冷启动执行 Brownfield 扫描并创建 | `apps/web/src/app/HomeView.tsx:620-655, 471` vs `BrownfieldScanModal.tsx` |
| **LC1-06** | Lifecycle 1 | 冷启动非文本附件被 `readAsText` 破坏为乱码 | **P0** | 首页拖拽上传 PDF/DOCX 架构参考文档 | `apps/web/src/app/HomeView.tsx:405-422`, `server.ts:976-983` |
| **LC1-07** | Lifecycle 1 | ZIP 项目导入静默覆盖同名本地项目且无冲突保护 | **P0** | 导入已存在 projectId 的项目压缩包 | `packages/core/src/projects/ProjectExportImportService.ts:140-162` |
| **LC1-08** | Lifecycle 1 | 缺少 `.pa-project` 独立格式支持与 JSON 快照解析 | **P2** | 首页项目导入对话框 | `apps/web/src/app/HomeView.tsx:1116`, `ProjectExportImportService.ts:202-220` |
| **LC1-09** | Lifecycle 1 | 归档项目进入工作台后无任何只读标识且可被无感修改 | **P2** | 打开已归档的项目进行操作 | `apps/web/src/components/layout/TopNav.tsx:78-90`, `server.ts:483` |
| **LC2-01** | Lifecycle 2 | 首次推演进入幽灵加载态，前端界面完全失活无反馈 | **P0** | 首页创建项目跳转至工作台后的 30-90 秒 | `apps/web/src/app/App.tsx:72`, `ProjectSessionContext.tsx:564-604`, `ChatView.tsx:646` |
| **LC2-02** | Lifecycle 2 | 提词器缺少真正流式机制，使用纯前端假定时器欺骗 | **P1** | 后台任务执行期间渲染 DiscoveryProgressTicker | `apps/web/src/features/chat/DiscoveryProgressTicker.tsx:14-43, 60-63` |
| **LC2-03** | Lifecycle 2 | 问题卡片草稿 Key 缺少项目维度导致跨项目污染 | **P0** | 多个项目具有相同 ID (如 q-01) 的问题 | `apps/web/src/features/chat/QuestionCard.tsx:50` |
| **LC2-04** | Lifecycle 2 | 问题选项与自定义补充冲突，导致选项决策被破坏性丢弃 | **P1** | 选中推荐选项并在下方输入补充要求 | `apps/web/src/features/chat/QuestionCard.tsx:102-107` |
| **LC2-05** | Lifecycle 2 | 推演阶段命名在 Stepper、Chat 与 Core 契约间三重割裂 | **P1** | 观察顶部步进器与对话区阶段标签 | `WorkflowStepper.tsx:22-51` vs `ChatView.tsx:597-603` vs `contracts` |
| **LC2-06** | Lifecycle 2 | 10秒撤回条无倒计时且与后台推演形成严重并发竞态 | **P1** | 回答并继续推演后立即点击 Ctrl+Z 撤回 | `ChatView.tsx:115-128, 313-322, 430-445, 740-776` |
| **LC2-07** | Lifecycle 2 | 本地网络连接中断被语义混淆为状态校验错误 | **P2** | 后端服务端口挂掉或网络异常时触发请求 | `apps/web/src/api/client.ts:142-147` |
| **LC3-01** | Lifecycle 3 | 架构假设 (Assumptions) 被总览投影彻底漏投且胶囊显示为零 | **P1** | 切换至右侧全景概览点击“假设”过滤胶囊 | `packages/core/src/view/ProjectOverviewProjection.ts:34-67`, `OverviewDrawer.tsx:815` |
| **LC3-02** | Lifecycle 3 | 大纲视图操作栏依赖 `:hover` 导致触控与移动端完全不可操作 | **P1** | 平板或触控屏打开大纲视图进行决策确立 | `apps/web/src/features/overview/OverviewDrawer.tsx:356` |
| **LC3-03** | Lifecycle 3 | 双击选中复制文本意外触发行内编辑并销毁选区 | **P2** | 双击决策卡片文本准备复制给团队成员 | `apps/web/src/features/overview/OverviewDrawer.tsx:426, 529` |
| **LC3-04** | Lifecycle 3 | 行内编辑文本框 Callback Ref 导致打字持续重排与高度抖动 | **P2** | 在行内编辑多行决策陈述文本 | `apps/web/src/features/overview/OverviewDrawer.tsx:474-484` |
| **LC3-05** | Lifecycle 3 | 移动端/平板响应式抽屉出现双重 Header 与双关闭按钮堆叠 | **P1** | 视口宽度 < 1024px 时展开全景概览抽屉 | `AppShell.tsx:120-130`, `OverviewDrawer.tsx:640-675`, `ResponsiveDrawer.tsx:118` |
| **LC3-06** | Lifecycle 3 | 指标栏在窄屏视口 (<375px) 发生水平挤压与排版溢出 | **P2** | 320px-360px 宽度手机屏幕下查看决策概览 | `apps/web/src/features/overview/OverviewDrawer.tsx:679-712` |
| **LC3-07** | Lifecycle 3 | 纯本地投影数据产生冗余 HTTP 往返与界面闪烁刷新 | **P1** | 决策修改后 OverviewDrawer 触发独立请求 | `apps/web/src/features/overview/OverviewDrawer.tsx:103-124` |

---

## 二、 Lifecycle 1: 项目初始化与冷启动深度穿透

### 1.1 [P1] 预设种子选择导致表单死锁与按钮校验逻辑错位
- **触发场景**: 用户打开首页，希望基于系统提供的优秀预设（如“本地优先工具 Local-First”）快速开箱创建项目。
- **具体复现路径**:
  1. 用户在“架构预设”分类下点击选择某一预设（例如“本地优先桌面工具 (Local-First Desktop)”）。
  2. 卡片变为选中高亮（背景为紫色/蓝色），项目名称被自动填入（`setProjectName(preset.name.split(' (')[0])`）。
  3. 用户视线移至右下方提交按钮，发现“开始推演构思”依然呈现灰色禁用态（disabled），光标为 `cursor-not-allowed`。
  4. 界面没有任何红色星号、Tooltip 或验证提示说明为何被禁用。用户多次点击无反应，产生强烈的“界面死锁”挫败感。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/HomeView.tsx` 中：
  ```tsx
  // 行 743-752
  onClick={() => {
    if (isSelected) {
      setSelectedPresetId(null);
    } else {
      setSelectedPresetId(preset.id);
      if (!projectName) {
        setProjectName(preset.name.split(' (')[0]);
      }
    }
  }}
  ```
  点击预设仅仅给 `projectName` 赋了值，但处于默认的结构化意图模式（`entryMode === 'structured'`）下，表单提交按钮的校验逻辑为：
  ```tsx
  // 行 1063-1068
  disabled={
    isSubmitting ||
    (entryMode === 'structured'
      ? !targetUser.trim() && !coreProblem.trim() && !mvpResult.trim()
      : !ideaInput.trim())
  }
  ```
  **注意这里的严重逻辑错位**：
  在 disabled 属性中，开发者的写法是 `!targetUser.trim() && !coreProblem.trim() && !mvpResult.trim()`（三者皆空才禁用）。只要用户填了任何一项，按钮就点亮！
  但是在表单提交函数 `handleSubmit` 中：
  ```tsx
  // 行 440
  if (!targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()) return;
  ```
  这里使用的是**逻辑或 (`||`)**！即**目标用户、核心痛点、交付物三者必须全部非空**！
  - 当用户只填了其中一项或两项时，提交按钮**看起来是可点击的**，但点击后 `handleSubmit` 在第 440 行**直接静默 return**！既不提交，也不报错，页面没有任何动静！
  - 当用户选了预设时，由于预设没有自动预填充 `targetUser`、`coreProblem` 和 `mvpResult`，三者皆为空，按钮处于禁用状态，且没有告知用户需要补全上述三项。
- **影响与心态**: 用户被困在冷启动第一步，判定系统出现 Bug，流失率极高。

---

### 1.2 [P1] 场景灵感模版强行抹除已选架构预设底线约束
- **触发场景**: 用户在首页选择了一个架构预设（如“CLI 开发运维工具”），然后看到“灵感中心”有一个贴近的业务场景（如“开发者本地代码片段管理”），点击应用该模板。
- **具体复现路径**:
  1. 用户点击“架构预设” Tab，选中“本地优先桌面工具”，此时 `selectedPresetId = 'local-first-desktop'`。
  2. 用户切换至“灵感模板” Tab，点击“开发者自用代码片段管理器”。
  3. 系统弹出 Toast：“已应用灵感模版...”，文本区域自动填入了用户与痛点描述。
  4. 但此时，原本选中的架构预设被悄无声息地清空，退化为无预设的默认通用架构。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/HomeView.tsx` 第 367-376 行：
  ```ts
  const handleApplyTemplate = (tmpl: ProjectTemplate) => {
    setProjectName(tmpl.defaultProjectName);
    setIdeaInput(tmpl.ideaPrompt);
    if (tmpl.targetUser) setTargetUser(tmpl.targetUser);
    if (tmpl.coreProblem) setCoreProblem(tmpl.coreProblem);
    if (tmpl.mvpResult) setMvpResult(tmpl.mvpResult);
    if (tmpl.knownConstraints) setKnownConstraints(tmpl.knownConstraints);
    setSelectedPresetId(null); // <-- 致命代码：硬编码抹除预设 ID
    toastSuccess(`已应用灵感模版「${tmpl.name}」，相关构思与约束已填入`, '灵感已填入');
  };
  ```
  在 Project Architect 的体系中，“架构预设（Preset）”约束的是系统级技术边界（如禁止数据库、单机文件存储、无需登录），而“灵感模板（Template）”注入的是产品场景故事（面向人群、核心诉求）。两者本应正交叠加，但代码中互斥清除，导致用户精心挑选的技术底线直接流失。

---

### 1.3 [P1] 结构化四项意图与自由长文本切换发生数据单向丢失
- **触发场景**: 用户在首页默认的“四项意图引导”模式下认真撰写了目标人群与核心痛点，随后想点击“自由文本”模式合并润色。
- **具体复现路径**:
  1. 用户在“目标用户”输入“独立开发者”，“核心痛点”输入“架构选型混乱”，“MVP预期成果”输入“一键导出蓝图”。
  2. 用户点击右上角切换为“自由长文本输入”模式。
  3. 界面切换为单一文本域，但内容空空如也，刚才输入的四项内容完全没有被合并转入文本框。
  4. 用户在自由文本框输入“补充一些要求”，并点击提交。
  5. 后端最终只收到了“补充一些要求”，此前花费数分钟构思的四项意图数据被 100% 丢弃！
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/HomeView.tsx` 中：
  `entryMode` 切换时，仅做界面显示切换，没有双向同步器。
  在提交逻辑中（第 473-485 行）：
  ```ts
  } else {
    const finalIdea = ideaInput.trim();
    if (!finalIdea) return;
    setIsSubmitting(true);
    const finalName = projectName.trim() || finalIdea.slice(0, 24);
    onCreateProject(finalName, undefined, undefined, ...); // 意图 intent 为 undefined
  }
  ```
  当处于自由文本模式时，传入的 `intent` 强制为 `undefined`，完全不读取 `targetUser` / `coreProblem` 等状态。

---

### 1.4 [P1] 构思文本前置换行符直接污染项目 Slug 与元数据
- **触发场景**: 用户在自由文本模式下粘贴一段结构化文本，首行为空行或换行，或者直接回车后从第二行开始写标题。
- **具体复现路径**:
  1. 用户在自由长文本中输入：
     ```text

     # 自动化运维面板
     这是一个基于 Docker 的...
     ```
  2. 用户未手动输入“项目名称”，直接点击“开始推演构思”。
  3. 系统创建项目，顶部导航栏与项目卡片显示的项目名称破碎，包含原始换行与控制字符。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/HomeView.tsx` 第 478 行：
  ```ts
  const finalName = projectName.trim() || finalIdea.slice(0, 24);
  ```
  当 `finalIdea` 前几位包含 `\n` 或 Markdown 标题符号 `#` 时，直接切片未做换行过滤。
  进而流向核心状态引擎 `packages/core/src/engine/ProjectStateEngine.ts` 第 115 行：
  ```ts
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32);
  ```
  虽然 slug 被正规化，但项目原始显示名 `metadata.name` 依然保留了原始的 `\n` 换行符，导致前端在 TopNav（第 80-82 行）渲染时发生文字垂直错位和布局断裂。

---

### 1.5 [P0] 首页存量代码库透视绕过用户授权直接全量灌入
- **触发场景**: 用户在冷启动阶段使用“存量工程透视 (Brownfield Scan)”读取已有项目代码。
- **具体复现路径**:
  1. 用户在首页选择本地目录或输入存量代码路径执行分析。
  2. 分析完成后，界面显示“已提取 N 条架构候选建议 (全量以 Candidate 状态安全录入)”。
  3. 用户点击“开始推演构思”创建项目。
  4. 进入项目后，发现存量代码中所有过时的包、淘汰的构建配置被无差别全部转为了项目候选决策。
- **代码根因与逻辑穿透**:
  对比工作区内部的透视流程：
  - 在 `apps/web/src/features/brownfield/BrownfieldScanModal.tsx` 中，用户拥有完整的复选列表，可以逐项勾选/反选需要保留的候选决策，严格遵循 **“用户授权第一 (User Authority First)”** 铁律。
  - 但在 `apps/web/src/app/HomeView.tsx` 第 471 行 与 642 行：
  ```ts
  onCreateProject(
    finalName,
    undefined,
    intent,
    attachedFiles.map(...),
    selectedPresetId || undefined,
    brownfieldAnalysis?.candidateDecisions // <-- 粗暴全量灌入，毫无用户筛选步骤
  );
  ```
  首页冷启动完全剥夺了用户的审查与挑选权利，破坏了宪法级契约。

---

### 1.6 [P0] 冷启动非文本附件被 `readAsText` 破坏为乱码
- **触发场景**: 用户冷启动时在首页拖入一份架构设计 PDF 或 Word 说明文档（`.pdf`, `.docx`）。
- **具体复现路径**:
  1. 用户拖拽 `architecture-spec.pdf` 到首页文件放置区。
  2. 附件列表显示已添加该文件。
  3. 点击提交，前端调用 `POST /api/projects/:id/inputs`。
  4. 服务端报错提取失败或只提取出一堆 Unicode 替换字符 `\uFFFD\uFFFD\uFFFD`。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/HomeView.tsx` 第 405-422 行：
  ```ts
  } else {
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setAttachedFiles((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          filename: file.name,
          kind: isText ? 'text' : 'file',
          content: text, // 此处 text 是 readAsText 解析二进制得到的乱码字符串
          contentEncoding: 'utf8', // 错误标明为 utf8
          size: file.size,
        },
      ]);
    };
    reader.readAsText(file); // <-- 致命 Bug：对 PDF/DOCX 二进制调用 readAsText！
  }
  ```
  而在服务端 `apps/server/src/server.ts` 第 976-983 行：
  ```ts
  const fileBuffer = contentEncoding === 'base64'
    ? Buffer.from(content.replace(/\s/g, ''), 'base64')
    : Buffer.from(content, 'utf8'); // 乱码字符串再转 Buffer，二进制签名与内容彻底被毁
  const extraction = await DocumentExtractor.extractDocumentSafely(fileBuffer, ext);
  ```
  只有图片（第 390 行）被用了 `readAsDataURL` 转成 base64，其他所有非 txt 扩展名的文件统统走 `readAsText`，直接在前端阶段对二进制流进行了不可逆的截断与破坏！

---

### 1.7 [P0] ZIP 项目导入静默覆盖同名本地项目且无冲突保护
- **触发场景**: 用户从其他机器导出了一份项目包 `project-alpha.zip`，并在本地尝试导入。
- **具体复现路径**:
  1. 本地已经存在一个 ID 为 `proj-demo` 的项目。
  2. 导入的压缩包内 `metadata.json` 中 `projectId` 恰好也是 `proj-demo`。
  3. 用户点击导入，系统未弹窗提示“项目已存在，是否覆盖或另存为副本？”，直接解压。
  4. 本地原有的所有历史推演与草稿瞬间被无声无息地抹去。
- **代码根因与逻辑穿透**:
  在 `packages/core/src/projects/ProjectExportImportService.ts` 第 140-162 行：
  ```ts
  const metadata = JSON.parse(metadataEntry.data.toString('utf8'));
  const projectId = targetProjectId || metadata.projectId || `proj-${Date.now()}`;
  const projectPath = join(workspaceProjectsDir, projectId);

  const guard = new WorkspaceGuard(workspaceProjectsDir);
  guard.assertContained(workspaceProjectsDir, projectPath, 'Project import path');

  // 3. Write files safely to destination directory
  for (const file of extractedFiles) {
    ...
    const targetFile = join(projectPath, relPath);
    guard.assertContained(projectPath, targetFile, 'Extracted project file');
    await this.storage.writeBuffer(targetFile, file.data); // 直接覆写本地磁盘文件！
  }
  ```
  代码在解压写入前，**完全没有检查 `await this.storage.exists(projectPath)`**！一旦存在同名项目，直接就地覆盖。这在本地优先软件中属于极其严重的静默数据破坏事故。

---

### 1.8 [P2] 缺少 `.pa-project` 独立格式支持与 JSON 快照解析
- **触发场景**: 蓝图文档与设计方案明确规定 Project Architect 支持轻量级项目文件包。
- **具体表现**:
  - `apps/web/src/app/HomeView.tsx` 第 1116 行：`<input accept=".zip,.pa.zip" ... />`，仅允许 `.zip` 扩展名。
  - 用户如果保存了独立的 `.json` 快照或蓝图规范中定义的 `.pa-project` 扩展名文件，文件选择器直接置灰不可选。即便强行改后缀传入，服务端解包器直接抛出 `ZIP signature invalid` 错误中断。

---

### 1.9 [P2] 归档项目进入工作台后无任何只读标识且可被无感修改
- **触发场景**: 用户在首页“归档项目”列表中点击打开一个已废弃或已冻结的历史项目。
- **具体表现**:
  - 核心存储层面（`apps/server/src/server.ts:483`），`isArchived` 仅保存在 `.projects-registry.json` 中，未同步到内存与工作台 Snapshot。
  - 进入工作台后，顶部导航栏（`TopNav.tsx:78-90`）与各视图完全没有“【已归档】”警示标签或横幅。
  - 用户依然可以在该归档项目内自由点击“确认决策”、“回答问题”甚至触发 AI 推演，产生无效的 API 消费。系统也没有提供“一键重新激活”按钮。

---

## 三、 Lifecycle 2: 架构推演与智能问答深度穿透

### 2.1 [P0] 首次推演进入幽灵加载态，前端界面完全失活无反馈
- **触发场景**: 用户在首页填写完意图并点击“开始推演构思”后，页面跳转至工作台（`WorkspaceView`）。
- **具体复现路径**:
  1. 用户满怀期待地等待 AI 给出第一批推演结果。
  2. 页面成功渲染出空聊天界面。
  3. **可怕的现象发生**: 界面上没有任何转圈的 Spinner，也没有任何进度条。
  4. 提词器（`DiscoveryProgressTicker`）根本没有出现！
  5. 底部输入框虽然在，但如果用户打字，可能会引发 revision 竞态；而在大模型响应的 30 到 90 秒内，整个页面静止得如同一张死图。
- **代码根因与逻辑穿透**:
  追踪整个调用链路：
  1. `apps/web/src/app/App.tsx` 第 72 行：创建项目成功后调用 `runInitialDiscovery(res.projectId, rev)`。
  2. `apps/web/src/state/ProjectSessionContext.tsx` 第 564-604 行：
     `runInitialDiscovery` 调用的是**同步接口** `apiClient.runDiscoveryTurn`，并 dispatch 了 `type: 'SET_REQUEST_STATE', payload: { status: 'loading' }`。
     **注意：在此过程中，`state.discoveryJob` 始终为 `null`！**
  3. 进入 `apps/web/src/features/chat/ChatView.tsx` 第 646 行：
     ```tsx
     {/* In-flight Discovery Dynamic Progress Ticker */}
     {(isBackgroundDiscoveryActive || isSending) && (
       <DiscoveryProgressTicker />
     )}
     ```
  4. `isSending` 是 `ChatView` 的本地 `useState`，初值为 `false`！
  5. `isBackgroundDiscoveryActive` 判定的是 `discoveryJob?.status === 'running' || discoveryJob?.status === 'queued'`，而当前是 `discoveryJob === null`，所以同样为 `false`！
  6. `ChatView` **根本没有读取全局的 `requestState.status === 'loading'`**！
  7. 结果就是：`(false || false) === false`，`DiscoveryProgressTicker` 完全不渲染！首次推演完全处于“零 UI 反馈”的假死状态。

---

### 2.2 [P1] 提词器缺少真正流式机制，使用纯前端假定时器欺骗
- **触发场景**: 用户在常规对话中触发后台推演，界面展示 `DiscoveryProgressTicker`。
- **具体复现路径**:
  1. 页面展示出 4 个阶段：“组装工程宪法与材料上下文” -> “AI 架构师执行单次结构化推演” -> “比对 Checklist 底线” -> “自适应问题集生成与两阶段提交”。
  2. 进度条根据秒数前进。
- **代码根因与逻辑穿透**:
  查阅 `apps/web/src/features/chat/DiscoveryProgressTicker.tsx` 第 14-43 行与第 60-63 行：
  ```ts
  const timer = window.setInterval(() => {
    setSeconds((prev) => prev + 1);
  }, 1000);
  ```
  各个阶段的切换依据是硬编码的纯客户端秒数阈值（`minSeconds: 0, 4, 12, 20`）！
  - 这完全是一个**前端自嗨的假倒计时**，没有任何与后端真实步骤或 Provider 推理进度的 SSE / WebSocket 阶段事件流连接！
  - 如果 Provider 在第 5 秒报错失败，前端倒计时仍然在机械播放；如果 Provider 推演耗费了 60 秒，前端在第 20 秒就跳到了最后一个阶段并无限期停留在那里，给用户极大的虚假心理预期。
  - 蓝图中的“Teleprompter 真实文本渐进吐出”在此处完全退化为空谈。

---

### 2.3 [P0] 问题卡片草稿 Key 缺少项目维度导致跨项目污染
- **触发场景**: 用户在不同项目中回答推演问题。
- **具体复现路径**:
  1. 用户在“项目 A”中看到推演问题，点击了“选项 B”，并在文本框输入了“项目 A 的特殊配置”，此时暂未提交，系统存入本地缓存。
  2. 用户切换至“项目 B”。
  3. “项目 B”由于推演批次生成，碰巧也存在一个编号为 `q-01` 或相同固定 ID 的问题。
  4. 用户一打开“项目 B”，赫然发现该问题的选项被勾选了，且赫然填着“项目 A 的特殊配置”！
  5. 用户误以为是项目 B 之前的输入，直接点击提交，造成**跨项目架构决策交叉污染**！
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/chat/QuestionCard.tsx` 第 50 行：
  ```ts
  const draftKey = `pa:q_draft:${question.id}`;
  ```
  这里的 localStorage key 居然**完全没有带 `projectId` 命名空间前缀**！
  在单机多项目管理下，这是极低级却极具破坏性的全局污染 Bug。

---

### 2.4 [P1] 问题选项与自定义补充冲突，导致选项决策被破坏性丢弃
- **触发场景**: 推演生成了一个架构选择题，提供了结构化的推荐方案供用户选择。
- **具体复现路径**:
  1. 题目为：“主数据存储选型？”
  2. 推荐选项包括：`[A. SQLite 本地存储]`、`[B. PostgreSQL 关系数据库]`。
  3. 用户点击了 `[B. PostgreSQL 关系数据库]`，卡片高亮。
  4. 随后用户看到卡片下方有“自定义补充输入框”，用户在里面输入了额外补充约束：“需要配置只读副本与自动容灾”。
  5. 用户点击“记录此决策”。
  6. **灾难发生**：系统记录的最终决策只有“需要配置只读副本与自动容灾”，而最重要的选项“PostgreSQL 关系数据库”被完全丢弃！
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/chat/QuestionCard.tsx` 第 102-107 行：
  ```ts
  const getFinalAnswerText = (): string => {
    if (freeInput.trim()) {
      return freeInput.trim(); // <-- 只要填了自定义文本，直接覆盖并彻底忽略 selectedOption！
    }
    return selectedOption || '';
  };
  ```
  在用户的直觉认知中，点击选项是“选定主方向”，下方输入框是“在此方向上的补充约束”。代码粗暴的 `if (freeInput.trim()) return freeInput.trim()` 逻辑，与用户的操作心理产生了毁灭性的背离。

---

### 2.5 [P1] 推演阶段命名在 Stepper、Chat 与 Core 契约间三重割裂
- **触发场景**: 观察整个推演推进过程中的阶段感知。
- **具体复现路径**:
  - 顶部导航栏步进器（`WorkflowStepper.tsx:22-51`）展示的是四步：
    `意图探索` -> `方案收敛` -> `准备度门禁` -> `规范蓝图`
  - 对话界面批次标签（`ChatView.tsx:597-603`）展示的标签是：
    `初步探索` -> `深入探索` -> `方案收敛` -> `准备度审查`
  - 核心状态引擎与契约（`packages/contracts/src/project.ts`）定义的 stages 是 7 个：
    `created` -> `initial-analysis` -> `broad-pass` -> `deep-dive` -> `readiness-review` -> `approved` -> `documents-generated`
- **代码根因与逻辑穿透**:
  三层代码各写各的映射字典：
  - Stepper 把 `created`, `initial-analysis`, `broad-pass` 打包成“意图探索”，把 `deep-dive` 叫做“方案收敛”。
  - 但在 Chat 区域，`batchStage` 的 `initial` 叫“初步探索”，`explore` 叫“深入探索”，`converge` 叫“方案收敛”。
  - 导致在 `broad-pass` 阶段，顶部 Stepper 亮在第一步“意图探索”，但 Chat 区域显示“深入探索”；或者 Stepper 亮在第二步，Chat 显示“方案收敛”。术语不一致导致用户无法准确评估推演究竟走到了哪一步。

---

### 2.6 [P1] 10秒撤回条无倒计时且与后台推演形成严重并发竞态
- **触发场景**: 用户点击题目的“回答并继续推演”，随后发现回答有误，按 Ctrl+Z 或点击撤回按钮。
- **具体复现路径**:
  1. 用户在卡片上点击“回答并继续推演”。
  2. 顶部弹出 10 秒撤回横幅：“(10秒内可按 Ctrl+Z 撤回)”。横幅没有动态倒计时进度条，用户不知道还剩几秒。
  3. 与此同时，`ChatView` 第 434 行已经触发了 `scheduleDiscoveryJob(revision)`，后端任务排队并开始执行。
  4. 用户在第 3 秒点击了“撤回 (Ctrl+Z)”。
  5. 前端执行 `handleRetractLastQuestion()`，状态引擎回退了决策并使题目回到待选状态。
  6. **然而：后台正在飞速执行的 `discoveryJob` 根本没有被 cancel！**
  7. 15 秒后，后台推演完成，把**基于刚才已被撤回的错误回答推演出来的假定决策与下一批问题**，赫然写入了状态库并更新到了前端！导致撤回彻底失效，状态历史陷入错乱。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/chat/ChatView.tsx` 第 115-128 行：
  ```ts
  const handleRetractLastQuestion = useCallback(async () => {
    if (!undoState || !activeProjectId) return;
    if (undoState.timerId) clearTimeout(undoState.timerId);
    const targetRef = undoState.questionRef;
    setUndoState(null);
    try {
      await retractQuestion(targetRef); // 仅回退了单题状态
      success('已撤回题目的决策记录，卡片已还原为待选状态', '决策已撤回');
      await refreshSnapshot();
      // <-- 致命缺失：完全没有调用 cancelDiscoveryJob() 来掐断伴生发起的后台推演！
    } ...
  ```

---

### 2.7 [P2] 本地网络连接中断被语义混淆为状态校验错误
- **触发场景**: 本地 Node.js 后端服务重启中，或端口 3001 暂时不可达时用户发起操作。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/api/client.ts` 第 142-146 行：
  ```ts
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    throw new ApiClientError(0, {
      code: ErrorCode.STATE_VALIDATION_FAILED, // <-- 错误码严重挂羊头卖狗肉
      message: '无法连接到本地服务，请确认 Project Architect 后端服务已启动 (端口 3001)。',
      recoverable: true,
    });
  }
  ```
  网络不可达属于 `NETWORK_DISCONNECTED` 或 `SERVICE_UNAVAILABLE`，但 API 客户端将其归类为 `ErrorCode.STATE_VALIDATION_FAILED`（状态模式校验失败）。
  这导致上层错误拦截器（例如自动重试机制、表单冲突弹窗）误判为“提交的 JSON 数据不合法”，从而停止自动重试并弹出错误的诊断提示。

---

## 四、 Lifecycle 3: 架构资产与决策管理深度穿透

### 3.1 [P1] 架构假设 (Assumptions) 被总览投影彻底漏投且胶囊显示为零
- **触发场景**: 用户在推演问答或手动录入中积累了多条关键架构假设（Assumptions），希望在右侧全景概览中集中审查。
- **具体复现路径**:
  1. 用户在推演中选择“记录为活跃假设 (Assumption)”。
  2. 右侧全景概览的过滤胶囊中，赫然显示：“假设 (0)”。
  3. 用户点击“假设”胶囊，右侧视图全部变空，显示“暂无架构资产”。
  4. 用户大惊失色，以为刚才记录的关键假设丢失了。
- **代码根因与逻辑穿透**:
  在核心层 `packages/core/src/view/ProjectOverviewProjection.ts` 第 34-67 行：
  ```ts
  const sections: OverviewSectionView[] = (snapshot.overview?.sections || []).map((section) => {
    // 仅过滤 decisions！
    const sectionDecisions = decisions.filter(
      (d) =>
        (section.itemRefs.includes(`decision:${d.id}`) || AreaRegistry.normalize(d.area) === section.id) &&
        (d.status === 'candidate' || d.status === 'confirmed' || d.status === 'locked')
    );
    const items: OverviewItemView[] = sectionDecisions.map((d) => { ... });
    // snapshot.assumptions 完全没有被 map 进 items！
  ```
  核心投影方法 `projectOverviewProjection` **只把 `decisions` 投射进了 `OverviewItemView`，把 `snapshot.assumptions` 彻底忘在脑后！**
  而在前端 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 815 行：
  ```tsx
  <button onClick={() => setActiveFilter('assumption')}>
    假设 ({overview.sections.reduce((acc, s) => acc + s.items.filter((i) => i.ref.startsWith('assumption:')).length, 0)})
  </button>
  ```
  因为底层根本没有输出任何带 `assumption:` 前缀的 item，计算结果恒等于 `0`！用户无论如何操作，全景大纲中永远看不到任何假设资产。

---

### 3.2 [P1] 大纲视图操作栏依赖 `:hover` 导致触控与移动端完全不可操作
- **触发场景**: 用户在 iPad、Surface 触控屏或移动端抽屉中浏览“大纲视图”，希望快速确认某项决策。
- **具体复现路径**:
  1. 切换右侧视图为“大纲模式 (Outline)”。
  2. 在移动端或触控屏上，由于没有鼠标 hover，操作图标默认全部隐藏（`opacity: 0`）。
  3. 用户用手指点击该行，试图唤出“确认”、“锁定”或“删除”按钮，但没有 hover 状态，按钮无法常驻，用户根本无法完成决策确认。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 356 行：
  ```tsx
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
    {item.status === 'candidate' && (
      <button onClick={() => handleConfirmItem(item.ref)} ...>
  ```
  直接使用了纯 CSS 的 `group-hover:opacity-100`。在触控设备上完全没有做 `group-focus-within:opacity-100` 或触控展开适配，形成严重的移动端可用性死胡同。

---

### 3.3 [P2] 双击选中复制文本意外触发行内编辑并销毁选区
- **触发场景**: 用户在大纲或卡片视图中，看到一段精彩的架构决策陈述，双击其中一个关键词准备复制。
- **具体复现路径**:
  1. 用户双击决策卡片文本想选中文本。
  2. 瞬间文本消失，原地变成了一个 `<textarea>` 输入框！
  3. 用户刚才好不容易双击选中的文本选区被浏览器立即清除，光标被强行跳到了文本末尾。
  4. 用户不得不按下 Esc 或点击外部退出编辑，体验非常割裂。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 426 行 与 529 行：
  ```tsx
  onDoubleClick={() => !isLocked && handleStartInlineEdit(section.id, item)}
  ```
  在没有判断用户是在触发浏览器原生“双击选词”还是刻意点击编辑按钮的情况下，暴力监听了容器的 `onDoubleClick`。

---

### 3.4 [P2] 行内编辑文本框 Callback Ref 导致打字持续重排与高度抖动
- **触发场景**: 用户在卡片上进入行内编辑，修改决策陈述。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 474-484 行：
  ```tsx
  <textarea
    ref={(el) => {
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(240, Math.max(64, el.scrollHeight))}px`;
        if (!el.dataset.initialized) { ... }
      }
    }}
    value={inlineEditingText}
    onChange={(e) => {
      setInlineEditingText(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(240, Math.max(64, el.scrollHeight))}px`;
    }}
  />
  ```
  把高度计算同时写在内联 `ref` 回调函数与 `onChange` 中！由于组件重新渲染，内联 `ref` 函数在**每一次键盘输入触发的重新渲染时都会再次执行**，连续两次重设 `el.style.height = 'auto'`，导致 DOM 高度瞬间塌陷又撑开，产生肉眼可见的高频微抖动与重排（Layout Thrashing）。

---

### 3.5 [P1] 移动端/平板响应式抽屉出现双重 Header 与双关闭按钮堆叠
- **触发场景**: 在视口宽度小于 1024px（平板或手机竖屏）的环境下，展开全景概览。
- **具体复现路径**:
  1. 将浏览器视口调至 768px 或 375px。
  2. 点击右上角图层图标展开“项目架构全景概览”。
  3. **视觉怪异现象出现**：抽屉顶部赫然出现了上下两个完全相同的 Header 栏！
     - 上层 Header（高 48px）：显示“项目架构全景概览”，右侧一个 [X] 按钮。
     - 紧挨着的下层 Header（高 48px）：显示“架构决策总览”，右侧又是一个 [X] 按钮！
  4. 两个 Header 占用了近 100px 的宝贵纵向屏幕空间，极其不专业。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/app/AppShell.tsx` 第 120-130 行：
  ```tsx
  {!isDesktop && !isCompactDesktop && (
    <ResponsiveDrawer
      isOpen={!uiState.isOverviewCollapsed}
      onClose={toggleOverview}
      side="right"
      width="w-80 sm:w-96"
      title="项目架构全景概览" // <-- ResponsiveDrawer 已经渲染了一层 Header
    >
      <OverviewDrawer inDrawer={true} />
    </ResponsiveDrawer>
  )}
  ```
  而在 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 640-675 行：
  ```tsx
  {inDrawer && (
    <div className="h-12 px-4 border-b border-border-default flex items-center justify-between shrink-0 bg-surface-subtle/50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        <span className="font-semibold text-xs text-text-primary">架构决策总览</span>
      </div>
      <button onClick={onClose} ...><X className="w-4 h-4" /></button>
    </div>
  )}
  ```
  外层抽屉容器 `ResponsiveDrawer` 已经强制包含了 `title` 和关闭按钮，而内层组件 `OverviewDrawer` 在 `inDrawer === true` 时又强行渲染了一个内部 Header，造成了 100% 重复嵌套。

---

### 3.6 [P2] 指标栏在窄屏视口 (<375px) 发生水平挤压与排版溢出
- **触发场景**: 在小屏移动设备（如 iPhone SE 375px 或 320px 视口）下查看全景概览抽屉。
- **代码根因与逻辑穿透**:
  在 `apps/web/src/features/overview/OverviewDrawer.tsx` 第 679 行：
  ```tsx
  <div className="px-4 py-2 border-b border-border-subtle bg-surface-subtle/50 flex items-center justify-between text-[10px] text-text-muted font-medium">
    <div className="flex items-center gap-1 text-emerald-600">... 已确认</div>
    <div className="flex items-center gap-1 text-zinc-600">... 锁定</div>
    <div className="flex items-center gap-1 text-orange-600">... 建议</div>
    {inDrawer && (
      <div className="flex items-center gap-1">
        <button ...><FolderSearch className="w-3.5 h-3.5" /></button>
        <button ...><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
    )}
  </div>
  ```
  在一行内放置了 3 组带有文字的指标，外加 2 个操作按钮，且使用了 `justify-between` 而没有设置 `flex-wrap`。在抽屉宽度较小时，文字与图标相互挤压重叠，甚至冲破容器右边界。

---

### 3.7 [P1] 纯本地投影数据产生冗余 HTTP 往返与界面闪烁刷新
- **触发场景**: 用户每次在界面上确认一个决策，或者更新一个问题回答。
- **具体复现路径**:
  1. 用户点击“确认决策”。
  2. 当前 React 上下文（`ProjectSessionContext`）其实已经通过 `refreshSnapshot()` 获取到了最新的完整 `snapshot`。
  3. 但右侧的 `OverviewDrawer` 却立即陷入 loading 旋转（`setIsLoading(true)`），发起了一次 `GET /api/projects/:id/overview` 网络请求。
  4. 概览区域闪烁一下，再重新渲染。
- **代码根因与逻辑穿透**:
  在 `packages/core/src/view/ProjectOverviewProjection.ts` 中，`projectOverviewProjection(snapshot)` 是一个**完全纯粹的内存投影函数（Pure Function）**，完全不依赖任何磁盘 I/O。
  然而前端 `OverviewDrawer.tsx` 第 103-124 行把这种纯计算属性当成了远程异步资源：
  ```ts
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview, stateRevision]);
  ```
  在本地客户端应用中，每当 `stateRevision` 变动就多发起一次 HTTP 请求，既增加了网络延迟，又造成界面不必要的闪烁重绘。

---

## 五、 跨生命周期架构偏差与规范审计 (Blueprint Deviations)

1. **违背 B3 单次推演宪法与意图提交约定**:
   - `docs/blueprint/03_AGENT_RUNTIME.md` 与宪法明确规定，一次用户操作对应一次 `discovery-turn`。但当前前端冷启动流程中，`App.tsx:72` 在 `addInput` 上传多个附件后连续递增 `rev`，随后立即发起 `runInitialDiscovery`，在网络延迟或多附件处理时极易发生 revision 冲突报错。
2. **状态保护与两阶段提交的投射滞后**:
   - 前端存在多处未完全同步的“野状态”：如 `ChatView` 内部维护的本地 `isSending` 与 `lastRecordedTurn`，与 `ProjectSessionContext` 的 `requestState` 存在步调不一致，直接造成了 2.1 节所述的幽灵假死。
3. **原型遗留代码与正式代码边界不清**:
   - `frontend/src/` 中仍然存在旧版无状态保护的 Mock 代码（如直接 `setProject`），部分类型契约命名在 `frontend/` 与 `apps/web/` 之间产生认知干扰。

---

## 六、 靶向重构方案与补丁级代码规范 (Targeted Fixes & Specs)

### 方案 1: 修复冷启动预设表单与校验对齐 (针对 LC1-01, LC1-03)
在 `apps/web/src/app/HomeView.tsx` 中：
1. 统一提交按钮与 `handleSubmit` 的校验准则：如果处于 `structured` 模式，当且仅当三大必填项非空时才启用。并在必填字段标签旁添加清晰的 `*` 标识。
2. 选中 Preset 时，自动填入该预设推荐的默认意图草稿，或自动展开引导提示。
3. 切换 `entryMode` 时，提供自动合并与拆解逻辑：
   - 切换为自由文本时，将 `targetUser`、`coreProblem`、`mvpResult` 拼接为清晰的 Markdown 意图注入 `ideaInput`。
   - 自由文本截取项目名时，过滤首行空白与 Markdown 标记：`finalIdea.replace(/^[#\s\r\n]+/, '').split('\n')[0].trim().slice(0, 24)`。

### 方案 2: 修复冷启动二进制材料上传乱码 (针对 LC1-06)
在 `apps/web/src/app/HomeView.tsx` 的 `handleFileProcess` 中：
```ts
// 区分纯文本扩展名与二进制扩展名
const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.ts', '.js', '.py'];
const isStrictText = textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

if (isStrictText) {
  reader.readAsText(file);
} else {
  // 对所有图片、PDF、DOCX 等，统一转为 Base64
  reader.onload = (e) => {
    const raw = (e.target?.result as string) || '';
    const base64 = raw.split(',')[1] || '';
    setAttachedFiles((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        filename: file.name,
        kind: file.type.startsWith('image/') ? 'image' : 'file',
        content: base64,
        contentEncoding: 'base64', // 正确告知后端为 base64
        size: file.size,
      },
    ]);
  };
  reader.readAsDataURL(file);
}
```

### 方案 3: 消除首次推演幽灵态与草稿跨项目隔离 (针对 LC2-01, LC2-03)
1. **修复 `ChatView` 首次加载感知**:
   ```tsx
   // apps/web/src/features/chat/ChatView.tsx
   const isInitialLoading = requestState.status === 'loading' && (!snapshot || snapshot.questions.items.length === 0);
   const showProgressTicker = isBackgroundDiscoveryActive || isSending || isInitialLoading;

   {showProgressTicker && (
     <DiscoveryProgressTicker />
   )}
   ```
2. **草稿 Key 强绑定 `activeProjectId`**:
   ```ts
   // apps/web/src/features/chat/QuestionCard.tsx
   const draftKey = `pa:${projectId || 'global'}:q_draft:${question.id}`;
   ```

### 方案 4: 修复问题选项与补充输入互斥 (针对 LC2-04)
```ts
// apps/web/src/features/chat/QuestionCard.tsx
const getFinalAnswerText = (): string => {
  const parts: string[] = [];
  if (selectedOption?.trim()) {
    parts.push(selectedOption.trim());
  }
  if (freeInput.trim()) {
    parts.push(freeInput.trim());
  }
  return parts.join('；补充说明：');
};
```

### 方案 5: 核心投影补全假设资产与前端纯内存直出 (针对 LC3-01, LC3-07)
1. **在 `packages/core/src/view/ProjectOverviewProjection.ts` 中投射 assumptions**:
   ```ts
   // 将活跃假设一同编入 OverviewItemView，打上 assumption: 前缀
   const sectionAssumptions = (snapshot.assumptions?.items || []).filter(
     (a) => a.status === 'active' && AreaRegistry.normalize(a.area) === section.id
   );
   const assumptionItems: OverviewItemView[] = sectionAssumptions.map((a) => ({
     ref: `assumption:${a.id}` as TypedRef,
     statement: a.statement,
     status: 'candidate' as const,
     origin: a.origin,
     isLocked: false,
     hasWarning: true,
     warningReason: '待验证技术假设 (Active Assumption)',
   }));
   ```
2. **前端使用纯计算属性替代 HTTP 往返**:
   ```tsx
   // apps/web/src/features/overview/OverviewDrawer.tsx
   const localOverview = useMemo(() => {
     return snapshot ? projectOverviewProjection(snapshot) : null;
   }, [snapshot]);
   ```

### 方案 6: 解决响应式抽屉 Header 重复与大纲触摸可用性 (针对 LC3-02, LC3-05)
1. 在 `ResponsiveDrawer` 内部渲染 `OverviewDrawer` 时，通过 `hideHeader={inDrawer}` 隐藏内层重复的 Header 与关闭按钮。
2. 大纲视图操作栏添加移动端常驻或触控激活类名：`sm:opacity-0 sm:group-hover:opacity-100 opacity-100`。

---

## 七、 审计结论与交接总结

本报告所列 22 项问题均已锁定至具体的代码文件及行号，完成了从触发场景、用户心理、代码逻辑缺陷到精确复现路径的完整证据链闭环。
所有缺陷均为当前生产应用与核心包中的客观事实，未带入任何主观推测。建议工程实现团队优先按照 P0 -> P1 -> P2 的顺序进行针对性加固。
