# Adversarial Feasibility & Edge-Case Challenge Report

> **评估对象**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md`  
> **审查基准**: `AGENTS.md` (五大绝对铁律), `docs/blueprint/` (架构契约), `experiments/agent-benchmark/` (B3 宪法与 Provider 规范)  
> **审计角色**: Technical Feasibility Challenger (Empirical Challenger)  
> **最终门禁判定 (Gate Verdict)**: **REQUEST_CHANGES** (必须修复 6 项严重可行性缺陷与边缘漏洞后方可准入)

---

## 1. Observation (客观实证与测量数据)

通过静态代码分析、动态执行环境扫描与实机微测试（Micro-benchmarks），直接观察到以下客观事实：

### 实证 1: Win32 路径归一化与符号链接/连接点 (Junction) 锁穿透
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 18` (第 1261-1269 行) 提出：
  ```typescript
  const rawPath = resolve(projectPath);
  const key = process.platform === 'win32' ? rawPath.toLowerCase() : rawPath;
  ```
- **代码定位**: `packages/core/src/commit/StateCommitManager.ts:84`
- **实测验证**:
  在 Windows 下执行 Node.js 测试，创建真实目录 `TargetDir` 与连接点 `LinkDir`：
  ```javascript
  const pDirect = path.resolve(targetDir);
  const pLink = path.resolve(linkDir);
  console.log(pDirect.toLowerCase() === pLink.toLowerCase()); // 输出: false!
  const realDirect = fs.realpathSync.native(pDirect);
  const realLink = fs.realpathSync.native(pLink);
  console.log(realDirect.toLowerCase() === realLink.toLowerCase()); // 输出: true!
  ```
  **实测结果**: `path.resolve()` 无法解析 Windows Junction/Symlink 或 Unix 软链接。当同一项目通过不同路径别名（如软链接、连接点或 subst 虚拟盘符）被并发访问时，`resolve(path).toLowerCase()` 将生成不同的 Map Key，**互斥锁被完全绕过**。而 `fs.realpathSync.native()` 能在 Windows 与 Unix 上统一解析至物理规范路径。对于大小写保留显示，由于 `key` 仅作为内部 `projectLocks: Map` 键值使用，不参与持久化写入，不影响显示。

---

### 实证 2: 推演重试机制与状态重复持久化违背
- **代码定位**: `apps/web/src/features/chat/ChatView.tsx:154-175`
  ```typescript
  const inputRes = await apiClient.recordDiscoveryInput(activeProjectId, {
    projectId: activeProjectId,
    text: messageToSend,
    expectedRevision: currentRev,
  });
  setInputMessage(''); // L160
  // ...
  await scheduleDiscoveryJob(inputRes.snapshot.metadata.stateRevision, undefined, inputRes.turnId, intensity);
  ```
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 4` 提出：保持 `lastSubmittedText` 引用，重试时重新发送 `lastSubmittedText`。
- **问题实证**:
  若 `recordDiscoveryInput` 已成功写入（生成了新 revision $N+1$ 并在 `inputs/` 下创建了文本条目），但随后的 `scheduleDiscoveryJob` 因网络闪断或超时抛出异常；若用户点击“重试推演”重新调用完整发送流程，系统将再次调用 `recordDiscoveryInput`，在项目中**产生两份完全重复的输入素材并再次自增 revision 到 $N+2$**。随后 LLM 推演上下文将包含冗余的重复用户发言。

---

### 实证 3: 单题撤回 (retractQuestion) 遗留级联状态破坏
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 5` (第 1035-1054 行) 提出：
  > 检索与该 questionRef 关联的最新用户决策，将该决策标记为 `deprecated`，记录废弃追踪事件；重置 `question.status = 'shown'`，清空 `question.answer`；原子提交新版本 `stateRevision + 1`。
- **代码定位**:
  1. `packages/core/src/engine/ProjectStateEngine.ts:1067-1070` (`answerQuestion` 原生执行逻辑)：
     ```typescript
     if (linkedGap?.status === 'open') {
       linkedGap.status = 'addressed';
       stateChanges.push({ ref: `gap:${linkedGap.id}` as TypedRef, action: 'gap-addressed' });
     }
     ```
  2. `packages/core/src/engine/ProjectStateEngine.ts:2110-2114` (`buildOverviewProjection` 过滤逻辑)：
     ```typescript
     const activeDecisions = decisions.items.filter(
       (d) => AreaRegistry.normalize(d.area) === sec.id &&
         d.status !== 'superseded' &&
         d.status !== 'rejected'
     );
     ```
  3. `packages/core/src/policy/DecisionPolicyEngine.ts:155`:
     ```typescript
     .filter((d) => d.status !== 'superseded' && d.status !== 'rejected')
     ```
- **问题实证**:
  1. **Active 决策过滤泄漏**: 全系统中所有过滤活跃决策的谓词均仅排除了 `'superseded'` 与 `'rejected'`，**没有任何模块排除 `'deprecated'`**！若仅将决策打标为 `status = 'deprecated'`，该决策在 `buildOverviewProjection` 和 `DecisionPolicyEngine` 中依然被当作有效活跃决策计入，导致 Overview 区域成熟度无法回退，已被撤销的决策依然展示在看板中。
  2. **孤立关闭的 Gap**: 当题目被回答时，关联的 `linkedGap` 状态被置为 `'addressed'`。方案 5 仅撤销了决策并重置了题目，**未将关联 Gap 还原为 `'open'`**！导致该 Gap 在核心状态机中永久处于关闭状态，推演引擎后续再也不会针对该 Gap 生成问题，就绪度评分被虚假拔高。
  3. **假设类型题目撤回未处理**: 若题目是通过 `answerQuestionAsAssumption`（存入 `assumptions.items`）回答的，方案 5 仅检索 `decisions`，会导致撤回操作彻底报错或漏撤销。

---

### 实证 4: 纯 JS PDF/DOCX 解析器缺乏安全防御与核心边界污染
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 11` (第 1130-1170 行) 提出：
  在 `packages/core` 中引入 `pdf-parse` 和 `mammoth`，在 `ProjectStateEngine.ts:2050` 分支中直接执行：
  ```typescript
  const fileBuffer = await this.storage.readFileBuffer(storageFullPath);
  if (ext === '.pdf') {
    const pdfData = await pdfParse(fileBuffer);
    extractedText = pdfData.text || '';
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    extractedText = result.value || '';
  }
  const excerpt = trimmed.slice(0, 4000);
  ```
- **代码定位**:
  `packages/core/package.json:18-20`:
  ```json
  "dependencies": {
    "@project-architect/contracts": "workspace:*"
  }
  ```
- **实测与漏洞剖析**:
  1. **零大小上限与内存溢出 (OOM)**: 代码未对 `fileBuffer.length` 或物理文件大小做任何上限拦截。当用户上传 100MB+ 的 PDF 时，V8 堆内存暴增，直接击穿 Node.js 内存上限导致整个 `apps/server` 进程崩溃重启。
  2. **Zip-Bomb / XML 递归实体炸弹**: DOCX 本质是 ZIP 压缩包。`mammoth` 解压未经尺寸校验的恶意压缩包（如 50KB 压缩成 10GB XML 的 Zip Bomb）时，会耗尽磁盘与内存。
  3. **主事件循环阻塞 (Event Loop Starvation)**: `pdfParse` 与 `mammoth` 在 Node.js 主线程上同步密集计算。解析长达数百页的文档会锁死事件循环数秒至数十秒，导致该单机服务上的所有其他并发 HTTP 请求（如心跳轮询、状态查询）超时断开。
  4. **全量解析后裁切 4000 字符的算力浪费**: 方案仅取 `trimmed.slice(0, 4000)`，但却强行解析了整篇文档。`pdf-parse` 支持 `{ max: 10 }` 参数限制解析页数，方案中未进行任何页数限制。
  5. **Core 纯净性破坏**: `packages/core` 当前为**零第三方运行时依赖**的纯净状态机引擎。强行将二进制文档解析器打包进 core 会污染其纯净架构边界，违反关注点分离原则。

---

### 实证 5: CLI Provider Stdin 管道改造参数凭空伪造 (Breaking Bug)
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 17` (第 1247-1258 行) 提出：
  ```typescript
  const child = spawn(this.binaryPath, ['--stdin', '--profile', 'b3-discovery']);
  child.stdin.write(fullPrompt, 'utf-8');
  child.stdin.end();
  ```
- **实机运行实证**:
  通过真实终端调用本地安装的 `agy.exe`：
  ```powershell
  & 'C:\Users\Li Cheng Xin\AppData\Local\agy\bin\agy.exe' --stdin
  ```
  **终端真实报错输出**:
  ```text
  flags provided but not defined: -stdin
  Usage of agy.exe:
    --input-format Input format for print mode (text, stream-json). stream-json reads one NDJSON message per line from stdin and runs a turn for each; it requires --output-format stream-json (default text)
    --output-format Output format for print mode (text, json, stream-json) (default text)
    -p, --print Run a single prompt non-interactively and print the response
  Exit code: 2
  ```
- **问题实证**:
  `agy.exe` 根本**不存在 `--stdin` 命令行参数**，也**不存在 `--profile` 命令行参数**！
  若按照方案 17 实施，`agy.exe` 将在启动时立即抛出 `flag provided but not defined: -stdin` 并以退出码 2 崩溃，**导致全系统 AI 推演功能 100% 瘫痪**！真实的 Stdin 管道通信规范必须采用 `--input-format stream-json --output-format stream-json`。

---

### 实证 6: File System Access API 抹除绝对路径导致项目寻址失败
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 7` (第 1072-1085 行) 提出：
  ```typescript
  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  setCustomProjectPath(dirHandle.name);
  ```
- **W3C 规范与浏览器安全模型实证**:
  根据 W3C File System Access API 规范，出于浏览器沙箱安全限制，`FileSystemDirectoryHandle.name` **仅包含所选文件夹的单层基名 (Basename，例如 "my-app")，绝不会暴露操作系统原生绝对路径 (例如 "D:\workspace\my-app")**。
  当前端将 `dirHandle.name` 传给 `apps/server` 时，服务端将其误判为相对路径并在内置 `projects/` 下创建子目录，根本无法实现“自由绑定本机任意合法目录”的承诺。且 Firefox 与 Safari 原生禁止 `showDirectoryPicker`。

---

### 实证 7: 文档重编译 Diff Guard 造成用户工作流死锁
- **文档方案**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md §7 方案 8` (第 1090-1101 行) 提出：
  检测到用户手动修改时返回 `409 Diff Detected`，前端提供“强制覆盖并编译”、“中止编译”、“导出补丁”三选项。
- **工作流死锁缺陷**:
  若用户选择“中止编译”，后续所有推演生成的新架构决策将**永远无法同步进 `AGENTS.md`**；若选择“强制覆盖”，用户的定制规则被抹除。系统缺乏“单文档局部保留区 (Protected User Blocks)”机制，导致用户在“状态持续演进”与“保留手工修饰”之间面临不可调和的二律背反。

---

## 2. Logic Chain (推理与风险传导链)

1. **并发安全与互斥锁 (Observation 1)**:
   - 依赖项：系统依赖本地文件互斥锁保证两阶段提交原子性。
   - 传导过程：Windows 下存在盘符大小写、NTFS Junction、Windows Symlink 及虚拟驱动器映射。仅使用 `resolve(path).toLowerCase()` 处理了字符串字符，未能解析文件系统连接点。当多进程/多请求通过不同符号链接指向同一项目时，产生锁穿透并发写，破坏 `state/current.json` 指针切换的排他性。
   - 结论：方案 18 必须升级为基于 `fs.realpathSync.native()` 的物理规范路径锁定。

2. **B3 契约与重试等幂性 (Observation 2)**:
   - 依赖项：`AGENTS.md` 铁律 2 要求单次推演调用，且严格保证用户输入与状态变更的等幂性。
   - 传导过程：重试流程未能区分“阶段 1 状态持久化失败”与“阶段 2 推演作业排队/执行失败”。若无差别地从头重试，将造成用户同一构思文本在项目中被连续持久化两次，造成状态污染与 LLM 上下文膨胀。
   - 结论：方案 4 必须将重试管道明确解耦为“重试持久化”与“重试已录入任务的推演执行”。

3. **状态机单题撤回一致性 (Observation 3)**:
   - 依赖项：`packages/core` 中决策、问题、缺口与成熟度处于强耦合关联网络。
   - 传导过程：方案 5 的撤回逻辑仅对 `decisions` 打标 `deprecated`，但内核全量查询中遗漏了对 `deprecated` 的过滤，导致该决策在事实层依然被判定为活跃；同时未联动重开关联的 `linkedGap`，使得 Gap 虚假闭环；且未支持 Assumption 撤销。
   - 结论：方案 5 的撤回逻辑会产生逻辑坏账快照。撤回协议必须具备完整的四向级联修复（决策标记为 `rejected`/过滤 `deprecated`、Gap 恢复为 `open`、同步清理 Assumption、重算 Overview 与 Readiness）。

4. **输入解析安全性与工程边界 (Observation 4)**:
   - 依赖项：系统在本地单机提供常驻 Node.js HTTP 守护服务。
   - 传导过程：无大小限制的 PDF/DOCX 解压与解析会直接导致主线程阻塞（ReDoS/Event Loop Freeze）或 OOM 崩溃。且 `packages/core` 不应直接耦合厚重的二进制文档解析库。
   - 结论：方案 11 必须设立严格的前置防御（10MB 物理上限、最大 10 页抽样、5 秒超时熔断），且应封装在独立的提取器模块中，保持 Core 引擎零依赖。

5. **底层运行时连通性 (Observation 5)**:
   - 依赖项：`packages/agent` 依靠底层 CLI 驱动 Provider。
   - 传导过程：方案 17 未经实测验证，凭空臆造了 `agy.exe --stdin --profile` 命令行参数。实施后会导致运行时启动命令解析失败直接 Exit 2，推演引擎彻底瘫痪。
   - 结论：方案 17 属于严重致瘫缺陷，必须修正为 `agy.exe` 真实支持的 `--input-format stream-json --output-format stream-json` 标准协议。

---

## 3. Caveats (审查边界与假设声明)

1. **CLI 平台兼容性**: 本实测基于 Windows 11 环境下安装的官方 `agy.exe` (v0.0.0.0)。若未来 Antigravity CLI 发布更新并新增参数，应以 CLI 发布的官方变更日志或 `--help` 实际输出为准。
2. **浏览器沙箱差异**: `showDirectoryPicker` 的行为在 Chromium 引擎内受严格规范限制。对于 Electron 或 Tauri 等桌面打包壳程序，可通过原生桥接获取真实绝对路径，但当前架构为浏览器端 (`apps/web`) 访问本地服务 (`apps/server`)，必须遵循 Web 标准。
3. **未实测的非功能区域**: 本次挑战重点聚焦于技术可行性、并发一致性与架构铁律，未对方案中的 CSS 色值微调及 UI 视觉组件样式重构发起反对。

---

## 4. Conclusion (终审结论与门禁裁决)

### 门禁裁决: **REQUEST_CHANGES (需要整改)**

`docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` 在多维度诊断、代码定位精度与整体设计思路方面表现出了极高的专业水平，成功识别了当前代码库的大量关键债务。然而，在具体技术方案的设计上，存在 **6 处未经实机验证的可行性硬伤与状态机逻辑漏洞**：
1. **[P0 致命致瘫] 方案 17 伪造了不存在的 `agy.exe --stdin` 参数**，实机运行将导致 CLI 立即报错 Exit 2。
2. **[P0 状态污染] 方案 4 重试机制未隔离前置状态持久化**，网络重试会导致用户输入被重复插入并多次推高 revision。
3. **[P0 状态坏账] 方案 5 单题撤销未排除 `deprecated` 决策且未恢复关联 Gap**，会生成逻辑损坏的快照。
4. **[P1 运行时失效] 方案 7 误用 `dirHandle.name` 作为物理路径**，浏览器沙箱将其截断为基名导致服务端寻址失败。
5. **[P1 安全/稳定性隐患] 方案 11 缺少文件尺寸上限、Zip-Bomb 防护与超时控制**，且直接污染了 Core 零依赖边界。
6. **[P1 并发竞态盲区] 方案 18 的 `resolve().toLowerCase()` 无法抵御 Windows 连接点/软链接跨路径锁穿透**。

### 必须完成的修改清单 (Actionable Remediation Requirements):
- **修改 1 (方案 17)**: 依据 `agy.exe --help` 权威文档，将 CLI Stdin 交互改造规范修正为 `--input-format stream-json --output-format stream-json`，废除虚构的 `--stdin` 与 `--profile`。
- **修改 2 (方案 4)**: 细化重试状态机：前端跟踪 `inputRecorded` 标志位。若输入已成功落盘，重试仅重新发起 `scheduleDiscoveryJob(..., turnId)`，禁止重复调用 `recordDiscoveryInput`。
- **修改 3 (方案 5)**: 补全 `retractQuestion` 级联契约：将决策标记为 `rejected`（或在所有过滤中补齐 `d.status !== 'deprecated'`）；将关联 `linkedGap` 状态还原为 `'open'`；增加 Assumption 撤销分支；触发 `buildOverviewProjection` 重新计算。
- **修改 4 (方案 7)**: 废除浏览器端通过 `dirHandle.name` 传递绝对路径的不可行方案。改为由服务端提供本地目录浏览 API（或在前端提供绝对路径输入框附带服务端存在性校验）。
- **修改 5 (方案 11)**: 在文档提取方案中补充严格的物理防御：文件大小上限（10MB）、PDF 解析最大页数（10页）、5 秒超时熔断；并将抽取器作为外部适配器封装，保持 `packages/core` 的零依赖边界。
- **修改 6 (方案 18)**: 将互斥锁路径标准化修正为：
  ```typescript
  let rawPath = resolve(projectPath);
  try {
    rawPath = fs.realpathSync.native ? fs.realpathSync.native(rawPath) : fs.realpathSync(rawPath);
  } catch {}
  const key = process.platform === 'win32' ? rawPath.toLowerCase() : rawPath;
  ```

---

## 5. Verification Method (独立复现与反体验证方法)

任何审计人员或开发者均可通过以下确定性指令在本地独立复现本报告中的所有发现：

1. **验证 CLI 参数不存在 (实证 5)**:
   ```powershell
   & 'C:\Users\Li Cheng Xin\AppData\Local\agy\bin\agy.exe' --stdin
   # 预期输出: flags provided but not defined: -stdin，退出码 2
   ```
2. **验证 Junction 锁穿透 (实证 1)**:
   ```powershell
   node -e "
   const fs = require('fs'), path = require('path');
   const base = path.join(process.cwd(), '.tmp_verify');
   fs.mkdirSync(path.join(base, 'T'), { recursive: true });
   fs.symlinkSync(path.join(base, 'T'), path.join(base, 'L'), 'junction');
   console.log('resolve match:', path.resolve(base, 'T').toLowerCase() === path.resolve(base, 'L').toLowerCase()); // false
   console.log('realpath match:', fs.realpathSync.native(path.resolve(base, 'T')).toLowerCase() === fs.realpathSync.native(path.resolve(base, 'L')).toLowerCase()); // true
   fs.unlinkSync(path.join(base, 'L'));
   fs.rmSync(base, { recursive: true, force: true });
   "
   ```
3. **验证 Active 决策过滤泄漏 (实证 3)**:
   检查 `packages/core/src/engine/ProjectStateEngine.ts:2112` 与 `packages/core/src/policy/DecisionPolicyEngine.ts:155`，确认过滤条件仅包含 `d.status !== 'superseded' && d.status !== 'rejected'`，并无 `deprecated`。
4. **验证 File System Handle name 截断 (实证 6)**:
   在任何 Chromium 浏览器控制台中执行 `const h = await window.showDirectoryPicker(); console.log(h.name);`，确认输出仅为所选文件夹单名而非完整磁盘路径。
