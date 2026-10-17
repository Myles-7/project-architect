# 全生命周期 4~6 地毯式深度审计与 UX 穿透报告 (Lifecycle 4-6 Deep Audit)

> **审计对象**：Project Architect 本地优先 AI 辅助系统架构设计与规范生成平台  
> **审计范围**：Lifecycle 4（拓扑空间化呈现与架构图谱）、Lifecycle 5（准备度门禁与阻断排查）、Lifecycle 6（文档编译、合并保护与导出交付）  
> **执行智能体**：Lifecycle 4-6 Deep Explorer  
> **审计基准**：`AGENTS.md`、`docs/blueprint/01` ~ `12`、`ORIGINAL_REQUEST.md`  
> **代码覆盖路径**：`apps/web/`、`apps/server/`、`packages/core/`、`packages/contracts/`、`packages/agent/`、`frontend/`

---

## 一、 执行摘要与问题总览矩阵 (Executive Summary & 2D Matrix)

本报告对 Project Architect 在 **生命周期 4（拓扑空间化呈现与架构图谱）**、**生命周期 5（准备度门禁与阻断排查）**、**生命周期 6（文档编译、合并保护与离线交付）** 进行了全链路静态穿透、代码断点追踪、数学模型演算与交互审查。

本次审计共发掘并精确定位了 **17 个具体缺陷与设计断点**，其中包括 **2 个 P0 级严重架构/数据损坏缺陷**、**7 个 P1 级核心交互断点与逻辑不一致**、**6 个 P2 级渲染/边界缺陷**、**2 个 P3 级体验改善点**。

### 问题严重度二维统计表 (Lifecycle × Severity Matrix)

| 流程环节 / 生命周期 | P0 (阻断/数据错乱) | P1 (核心断点/逻辑不一致) | P2 (细节瑕疵/边界缺陷) | P3 (体验优化) | 合计 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Lifecycle 4: 空间拓扑与图谱呈现 (DAG & Diagrams)** | 0 | 4 | 4 | 1 | **9** |
| **Lifecycle 5: 准备度门禁与阻断排查 (Readiness Gate)** | 0 | 2 | 1 | 0 | **3** |
| **Lifecycle 6: 文档编译、合并保护与离线交付 (Docs & Export)** | 2 | 1 | 1 | 1 | **5** |
| **总计** | **2** | **7** | **6** | **2** | **17** |

---

## 二、 Lifecycle 4: 空间拓扑与架构图谱深度审计 (Spatial Topology & Diagrams)

### 4.1 边界治理图硬编码平台元规则，污染任意用户项目的系统架构 (P1)
- **触发场景**：用户在「架构图谱 (ArchitectureDiagramsView)」中切换至「边界治理与依赖约束图 (Boundary Governance)」视口。
- **源码定位**：`packages/core/src/diagrams/MermaidGenerator.ts` 行 180-196
  ```ts
  private static generateBoundaryGovernanceDiagram(snapshot: ProjectSnapshot): string {
    const lines: string[] = ['graph TB'];
    lines.push('  subgraph Boundaries ["系统边界与不可逾越铁律"]');
    lines.push('    R1["Rule 1: Zero Centralized DB<br/>全系统纯本地文件 + 两阶段 Commit"]');
    lines.push('    R2["Rule 2: User Authority First<br/>AI 仅产出建议，用户裁决确立"]');
    lines.push('    R3["Rule 3: Single Inference Turn<br/>严格单次调用与结构化输出"]');
    lines.push('    R4["Rule 4: Monorepo Boundary<br/>Web/Server/Core 严格分层契约"]');
    lines.push('  end');
  ```
- **复现路径与现象**：
  1. 用户创建一个云原生电商系统或基于 PostgreSQL 的分布式后台项目；
  2. 进入「架构图谱」页面，点击「边界治理图」；
  3. 图表中强制出现 Project Architect 自身代码仓库的开发准则：“Rule 1: Zero Centralized DB”、“Rule 3: Single Inference Turn”、“Rule 4: Monorepo Boundary”。
- **危害与用户体感**：
  将开发本软件的元准则硬塞给最终用户，导致用户的项目蓝图出现完全荒谬的错误约束，极大损害工具的专业度与可信度。

### 4.2 组件时序流图伪造拓扑，将文档章节串联为无意义链表 (P1)
- **触发场景**：用户查看「组件流与时序图 (Component Flow)」视图。
- **源码定位**：`packages/core/src/diagrams/MermaidGenerator.ts` 行 117-125
  ```ts
  const sections = snapshot.document_plan?.sections || [];
  if (sections.length > 1) {
    for (let i = 0; i < sections.length - 1; i++) {
      const from = this.sanitizeNodeId(sections[i].id);
      const to = this.sanitizeNodeId(sections[i + 1].id);
      lines.push(`  ${from} -->|调用/依赖| ${to}`);
    }
  }
  ```
- **复现路径与现象**：
  不管用户在项目中定义了什么模块，组件流图简单粗暴地将 `01_PRODUCT_BOUNDARY` 指向 `02_SYSTEM_ARCHITECTURE`，再指向 `03_AGENT_RUNTIME`，绘制成一条单向贪吃蛇链表。
- **危害与用户体感**：
  所谓“组件调用/依赖流”完全是伪造的线性关系，无法体现微服务、前端-后端、数据库-API 之间的真实依赖拓扑。

### 4.3 架构图谱缩放无平移控制，放大后内容永久截断 (P1)
- **触发场景**：在「架构图谱」中缩放到 150% ~ 250% 细看复杂架构节点。
- **源码定位**：`apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx` 行 41, 295-307
  ```tsx
  const [zoomScale, setZoomScale] = useState<number>(1);
  ...
  <div className="relative min-h-[420px] bg-slate-950 p-6 flex items-center justify-center overflow-hidden">
    <div
      style={{
        transform: `scale(${zoomScale})`,
        transformOrigin: 'center center',
      }}
    >
  ```
- **复现路径与现象**：
  外层容器设置了 `overflow-hidden`，但组件内没有任何平移偏移量状态（`panOffset`）或鼠标拖拽平移事件绑定。当用户点击放大按钮（或进入全屏放大）时，图形边界超出容器，四周的所有节点直接被不可逆地裁切隐藏，无法拖拽移动视野。
- **危害与用户体感**：
  放大功能完全不可用，用户无法在大图中看清细部文字。

### 4.4 SVG 导出未内联计算样式，外部矢量软件打开为空白黑块 (P1)
- **触发场景**：用户点击「导出 SVG」并在 Figma、Illustrator 或浏览器外部打开。
- **源码定位**：
  - `apps/web/src/features/dag/DecisionDAGExplorer.tsx` 行 432-447
  - `apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx` 行 126-141
  ```ts
  const svgEl = containerRef.current.querySelector('svg');
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgEl);
  ```
- **复现路径与现象**：
  DAG 图的节点与连线使用了 Tailwind CSS 类名（如 `stroke-emerald-400`、`fill-slate-800`、`text-xs`）。直接通过 `XMLSerializer` 序列化出的 SVG 字符串并不包含外部 CSS 样式表，且缺少 `xmlns="http://www.w3.org/2000/svg"` 命名空间。用 Figma 或本地图片查看器打开导出的 `.svg` 文件时，所有节点显示为全黑方块或文本不可见。
- **危害与用户体感**：
  导出的设计资产无法用于架构汇报材料、PPT 或二次编辑。

### 4.5 快速平移时丢失鼠标捕获与拖拽中断 (P2)
- **触发场景**：在 DAG 画布上按住左键快速拖拽画布。
- **源码定位**：`apps/web/src/features/dag/DecisionDAGExplorer.tsx` 行 254-285
  ```tsx
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  ```
- **复现路径与现象**：
  鼠标移动事件直接绑定在局部容器 `div` 上。当用户快速拖拽时，光标极易滑出容器边缘，直接触发 `onMouseLeave` 强制重置 `isPanning = false`，导致拖拽手势瞬间掉落断开。
- **解决标准**：应在 `onMouseDown` 时在 `window` 对象上添加 `mousemove` 和 `mouseup` 监听，或使用 Pointer Capture (`setPointerCapture`)。

### 4.6 Ctrl+滚轮缩放触发浏览器 Passive Event 警告且未居中对齐 (P2)
- **触发场景**：在 DAG 视口按住 Ctrl 滚动鼠标滚轮缩放。
- **源码定位**：`apps/web/src/features/dag/DecisionDAGExplorer.tsx` 行 291-302
  ```tsx
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); // 触发控制台警告
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.max(0.4, Math.min(2.5, z + delta)));
    }
  };
  ```
- **复现路径与现象**：
  React 合成滚轮事件默认是 passive 的，调用 `e.preventDefault()` 会在 DevTools 控制台打印 `[Intervention] Unable to preventDefault inside passive event listener invocation`。同时缩放变换以绝对中心点进行，没有跟随光标物理坐标计算 `panOffset` 补偿，滚轮缩放时视野会剧烈向未知方向漂移。

### 4.7 环路依赖节点错误归入根节点层级 (P2)
- **触发场景**：决策网络中存在相互依赖的环路。
- **源码定位**：`packages/core/src/dag/DecisionGraphProjection.ts` 行 93-120
  ```ts
  // Kahn's algorithm for topological layering
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });
  // 环中节点的 inDegree 永远大于 0，无法入队！
  ```
- **复现路径与现象**：
  当决策 A 依赖 B，B 依赖 A 时，它们的入度永远不为 0。Kahn 算法结束后，未入队的节点保留了默认的 `depth = 0`。在分层视图或按层级布局时，环路节点被直接堆叠在最左侧的 Root 根层级（与完全无依赖的顶层决策并列），彻底破坏了层级逻辑。

### 4.8 环路闭包中波及分析将自身标记为自身下游 (P2)
- **触发场景**：选中一个处于环路中的决策，查看「波及分析 (Blast Radius)」。
- **源码定位**：`packages/core/src/dag/DecisionGraphProjection.ts` 行 230-241
  ```ts
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const downstream of downstreamMap.get(current) || []) {
      if (!visited.has(downstream)) {
        visited.add(downstream);
        allTransitiveDependents.push(downstream);
        queue.push(downstream);
      }
    }
  }
  ```
- **复现路径与现象**：
  若存在 A -> B -> A 循环依赖，当选中 A 并计算 `allTransitiveDependents` 时，BFS 遍历将沿着环路访问到 A，并将 A 自身推入 `allTransitiveDependents`。前端界面显示的下游受影响列表包含了自己，下游统计数量发生重影。

### 4.9 全屏模态框缺失 Escape 键盘退出与自适应高度塌陷 (P3)
- **触发场景**：用户点击「全屏」查看 DAG 或架构图，并按下键盘 `Escape` 键。
- **源码定位**：
  - `apps/web/src/features/dag/DecisionDAGExplorer.tsx` 行 479-482
  - `apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx` 行 174
- **复现路径与现象**：
  全屏状态为 `fixed inset-0 z-50` 覆盖层，但没有添加 `window.addEventListener('keydown', ...)` 来监听 `Escape` 键。用户习惯性按 Esc 无法退出，必须手动寻找右上角的小图标。同时容器高度使用了 `min-h-[500px]` 配合外层滚动条，在小屏幕笔记本上容易产生双重滚动条。

---

## 三、 Lifecycle 5: 准备度门禁与阻断排查深度审计 (Readiness Gates & Blocking Audits)

### 5.1 准备度信誉评分模型存在双重算法与数值分裂 (P1)
- **触发场景**：查看「准备度审计 (ReadinessView)」顶部的总体得分与下方细分扣分项。
- **源码定位**：
  - `packages/core/src/readiness/ReadinessEvaluator.ts` 行 94
  - `packages/core/src/view/ReadinessProjection.ts` 行 191-198
  - `apps/web/src/features/readiness/ReadinessView.tsx` 行 280, 320-352
- **复现路径与现象**：
  - `ReadinessEvaluator` 定义的计算逻辑：
    `score = Math.max(0, 100 - missingAreaPenalty - conflictPenalty - assumptionPenalty)`（从 100 分依次扣减）。
  - `ReadinessProjection` 却使用了加权拼接公式：
    `baseScore = (coveredAreas.length / 8) * 60`（满分 60）；  
    `conflictBonus = Math.max(0, 40 - criticalConflicts * 15 - minorConflicts * 5)`（满分 40）；  
    `assumptionPenalty = unconfirmedAssumptions * 5`；  
    `score = baseScore + conflictBonus - assumptionPenalty`。
  - 前端界面在仪表盘大字显示了 `projection.readiness.credibilityScore`，下方表格却把各个分项分列展示。当存在多个假设但没有冲突时，两套算法计算出的数值偏差可达 20 分以上，用户发现细项相加与总分完全对不上！
- **危害与用户体感**：
  数值模型不严密，用户怀疑系统的准确性与可信度。

### 5.2 行内快速修复连续点击引发 409 竞态与静默挂起 (P1)
- **触发场景**：在准备度问题列表中，用户连续快速点击两个未闭环领域的「采纳建议 (Quick Fix)」按钮。
- **源码定位**：`apps/web/src/features/readiness/ReadinessView.tsx` 行 96-121
  ```tsx
  const handleInlineFix = async (item: ReadinessProblemItem) => {
    try {
      await client.decide(projectId, {
        area: item.area,
        statement: item.suggestion,
        expectedRevision: project.meta.revision, // 闭包中的陈旧 Revision
      });
      await refetch();
    } catch (err) {
      console.error(err); // 静默捕获，无任何 Toast 提示
    }
  };
  ```
- **复现路径与现象**：
  当用户连续点击第一项与第二项时，两次请求几乎同时发出，携带相同的 `expectedRevision`。第一个请求成功提交，服务端版本号自增；第二个请求触发 HTTP 409 `STATE_REVISION_CONFLICT`。前端 `catch` 块仅打印 `console.error`，没有弹窗提示，没有重试机制，也不弹出冲突比对浮层。用户看到按钮处于禁用或毫无反应的假死状态。

### 5.3 严重冲突阻断放行分支在前端 UI 无法激活 (P2)
- **触发场景**：项目存在严重未决冲突（Critical Conflict），用户在准备度审查阶段尝试强行放行。
- **源码定位**：
  - 服务端契约：`packages/core/src/readiness/ReadinessGate.ts` 行 100-106, 194-204
  - 前端渲染：`packages/core/src/view/ReadinessProjection.ts` 行 241-243
  ```ts
  // ReadinessGate.ts:
  if (hasCriticalConflicts) {
    if (!overrides.includes('approved-with-critical-conflicts')) {
      throw new Error('Project contains unresolved critical conflicts. Explicit override required.');
    }
  }
  // ReadinessProjection.ts:
  allowedDispositions: ['approved-with-known-issues', 'return-to-discovery']
  ```
- **复现路径与现象**：
  底层状态引擎明确区分了 `approved-with-known-issues`（常规已知问题签署）和 `approved-with-critical-conflicts`（严重冲突特批签署）。但在 `ReadinessProjection` 中，给前端透出的放行选项列表中永远漏掉了 `approved-with-critical-conflicts`。一旦项目被判定包含严重冲突，用户在前端无论如何点击“已知晓并强行推进”，服务端一律抛出验证失败，前端无法给出解决出路。

---

## 四、 Lifecycle 6: 文档编译、合并保护与离线交付深度审计 (Docs & Export)

### 6.1 AST 标题解析器无代码块感知，注释行撕裂文档结构 (P0 - 严重数据损坏)
- **触发场景**：用户在架构蓝图（如 `02_SYSTEM_ARCHITECTURE.md`、`03_AGENT_RUNTIME.md`）的代码块中包含以 `#` 开头的代码注释（如 Python、Bash、YAML、Dockerfile），随后触发文档重编译。
- **源码定位**：`packages/core/src/documents/SectionMergeGuard.ts` 行 36-64
  ```ts
  export class SectionMergeGuard {
    static parseSections(content: string): SectionBlock[] {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          // 致命缺陷：完全没有判断当前行是否在 ``` 代码围栏内部！
          sections.push({ ... });
        }
      }
    }
  }
  ```
- **复现路径与现象**：
  1. 用户在系统架构文档中编写一段示例代码：
     ````markdown
     ```python
     # Step 1: Initialize client
     client = MongoClient()
     # Step 2: Query records
     docs = client.find()
     ```
     ````
  2. 触发重编译，三方合并保护引擎 `SectionMergeGuard` 将 `# Step 1...` 和 `# Step 2...` 误识别为 Markdown H1 一级标题，并以此为界强制将代码块从中间切断！
  3. 切割后的前一部分包含代码块开头的 ```` ```python ````，而后一部分包含结尾的 ```` ``` ````。
  4. 随后在三方合并重组时，代码块格式完全错乱，导致导出的 Markdown 文件语法崩溃，整个文档的代码高亮和排版全面损毁。
- **危害与用户体感**：
  极其严重的技术文档数据破坏，任何包含 Bash 或 Python 脚本的技术规范一经合并即被粉碎。

### 6.2 差异对比引擎使用粗暴 1:1 行索引比较，1 行空行引发全文件伪差异级联爆炸 (P0 - 核心体验阻断)
- **触发场景**：用户在本地磁盘物理文件开头插入了 1 行空行或一个简短说明段落，然后在前端点击「重新编译文档」。
- **源码定位**：`packages/core/src/documents/DocumentDiffEngine.ts` 行 125-154
  ```ts
  export class DocumentDiffEngine {
    computeFileDiff(diskContent: string, newContent: string, filename: string): { hasDiff: boolean; unifiedDiff: string } {
      const diskLines = diskContent.split('\n');
      const newLines = newContent.split('\n');
      const maxLen = Math.max(diskLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        if (diskLines[i] !== newLines[i]) {
          diffLines.push({ type: 'deleted', line: diskLines[i] });
          diffLines.push({ type: 'added', line: newLines[i] });
        }
      }
    }
  }
  ```
- **复现路径与现象**：
  该算法不是 Myers Diff 算法，也不是最长公共子序列（LCS）算法，而是最基础的“单指针等长对比”！如果用户在第 1 行插入了 1 行空行，则后续每一行：
  `diskLines[1]`（原第1行内容）与 `newLines[1]`（新第2行内容）全都不匹配！
  结果导致原本 1 行的小修改，在差异对比弹窗中将整个 1000 行文件的每一行都标红标绿，生成全量被删除、全量被重新添加的伪差异灾难。
- **危害与用户体感**：
  差异弹窗完全失去审查价值，用户根本无法识别自己到底改动了哪一行，并产生严重恐慌。

### 6.3 3-Way 合并冲突标记直接物理写入磁盘，编译成功返回却留毒 (P1)
- **触发场景**：磁盘物理文件与 AI 生成蓝图修改了同一段落内容，触发冲突。
- **源码定位**：
  - `packages/core/src/documents/SectionMergeGuard.ts` 行 134-142
  - `packages/core/src/documents/DocumentCompiler.ts` 行 144-154
  ```ts
  // SectionMergeGuard.ts:
  mergedLines.push('<<<<<<< DISK (User Edit)');
  mergedLines.push(diskSection.content);
  mergedLines.push('=======');
  mergedLines.push(nextSection.content);
  mergedLines.push('>>>>>>> GENERATED (AI Specification)');
  
  // DocumentCompiler.ts:
  await this.storage.writeText(targetAbs, finalContent);
  ```
- **复现路径与现象**：
  当冲突发生时，`SectionMergeGuard` 将包含 Git 冲突标记的字符串直接拼接到最终正文中。`DocumentCompiler` 毫不校验，将其直接写入磁盘文件，并返回编译成功状态（`success: true`）。前端给用户弹出绿色的“蓝图生成完成”提示。用户在 IDE 中打开文件时才发现里面充斥着未解决的冲突标记。
- **危害与用户体感**：
  破坏了交付物的整洁度与可用性，下游构建脚本或 CI 工具在读取这些 Markdown 时会抛出语法解析异常。

### 6.4 单文件离线 HTML 导出包遗漏 Mermaid 引擎与 DAG 空间渲染 (P1)
- **触发场景**：用户在文档页面点击「导出单文件 HTML 离线交付包 (`exportDocumentsHtml`)」，并在没有网络连接的环境中用浏览器打开。
- **源码定位**：`packages/core/src/export/StandaloneHtmlExporter.ts` 行 420, 463-470
  ```ts
  // StandaloneHtmlExporter.ts:
  // 没有内嵌 mermaid.min.js，代码块直接输出为：
  `<pre class="code-block" data-lang="mermaid"><code>${escapeHtml(code)}</code></pre>`
  ```
- **复现路径与现象**：
  导出的单文件 HTML 将决策图谱数据以 `const dagData = ...` 挂载在 `<script>` 标签中，但页面内根本没有引入任何用于绘制 SVG/Canvas DAG 图的运行时代码！而架构图部分，所有 Mermaid 代码均被作为普通的纯文本代码块展示，既没有加载 Mermaid 库，也没有执行任何渲染逻辑。
- **危害与用户体感**：
  离线 HTML 规范包被宣传为“全要素离线交互包”，但最重要的拓扑空间呈现与动态架构图全部变成了枯燥的未渲染纯代码，严重影响离线交付效果。

### 6.5 规范漂移模态框缺少跨标签状态联动与热失效机制 (P2)
- **触发场景**：用户在「规范漂移审计 (`SpecDriftModal`)」中发现有 3 处与代码库不一致，随后在其他标签页更新了决策并重新编译了文档。
- **源码定位**：`apps/web/src/features/audit/SpecDriftModal.tsx` 行 46-67
- **复现路径与现象**：
  `SpecDriftModal` 维护了本地的 `auditReport` 状态，但并没有订阅全局的 `stateRevision` 变化。当文档完成重编译或决策变更时，模态框依然展示上一次审计的旧结果，用户必须手动再次点击“重新审计”按钮才能刷新。

---

## 五、 全量问题清单与精细化定位索引表 (Exhaustive Problem Inventory)

| ID | 流程环节与触发场景 | 严重级别 | 涉及核心文件与代码行号 | 问题现象与缺陷本质 | 用户体感与潜在危害 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **BUG-L4-01** | 架构图谱 -> 边界治理图 | **P1** | `packages/core/src/diagrams/MermaidGenerator.ts:180-196` | 边界治理图将本工具自身的开发规范（零DB/单轮推演）硬编码为任意项目的系统规则 | 极大混淆用户项目架构，损害蓝图权威性 |
| **BUG-L4-02** | 架构图谱 -> 组件流与时序图 | **P1** | `packages/core/src/diagrams/MermaidGenerator.ts:117-125` | 组件流图未根据实际模块依赖分析，而是将文档目录章节按顺序硬连成一条直线链表 | 伪造组件依赖关系，无法用于实际架构评审 |
| **BUG-L4-03** | 架构图谱 -> 缩放查看大图 | **P1** | `apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx:41,295-307` | 画布缩放缺乏平移偏移量（`panOffset`）及拖拽手势，放大后超出视口的内容永久截断 | 放大功能名存实亡，复杂图表无法阅读 |
| **BUG-L4-04** | DAG / 架构图谱 -> 导出 SVG | **P1** | `apps/web/src/features/dag/DecisionDAGExplorer.tsx:432-447`<br/>`ArchitectureDiagramsView.tsx:126-141` | 直接序列化 DOM 未内嵌 CSS 样式与命名空间，外部软件打开呈全黑方块或透明乱码 | 导出的设计资产无法二次使用与排版汇报 |
| **BUG-L4-05** | 决策 DAG -> 鼠标快速拖拽画布 | **P2** | `apps/web/src/features/dag/DecisionDAGExplorer.tsx:254-285` | 鼠标移动事件绑定在局部 div 上且在 `onMouseLeave` 强制重置，快速拖拽极易断开 | 画布拖拽体验卡顿、掉帧、容易中断 |
| **BUG-L4-06** | 决策 DAG -> 滚轮缩放控制 | **P2** | `apps/web/src/features/dag/DecisionDAGExplorer.tsx:291-302` | 合成滚轮事件触发 passive event 警告，且未根据光标坐标进行中心变换偏移补偿 | 控制台报错，缩放时画布焦点剧烈漂移 |
| **BUG-L4-07** | 决策 DAG -> 拓扑分层排版 | **P2** | `packages/core/src/dag/DecisionGraphProjection.ts:93-120` | Kahn 拓扑排序对环路节点的入度无法清零，导致环路节点被直接归入 Rank 0 顶层 | 循环依赖节点与无依赖根节点混杂，层级失真 |
| **BUG-L4-08** | 决策 DAG -> 波及范围分析 | **P2** | `packages/core/src/dag/DecisionGraphProjection.ts:230-241` | 当存在循环依赖闭包时，波及分析 BFS 遍历会将目标节点自身推入下游受波及集合 | 决策被标记为“自身受自身影响”，统计数字翻倍 |
| **BUG-L4-09** | DAG / 架构图谱 -> 全屏模式 | **P3** | `DecisionDAGExplorer.tsx:479-482`<br/>`ArchitectureDiagramsView.tsx:174` | 全屏浮层未监听键盘 `Escape` 事件，移动端/笔记本视口易发生内容塌陷与双重滚动条 | 快捷键失效，全屏退出交互不顺畅 |
| **BUG-L5-01** | 准备度门禁 -> 评分与扣分面板 | **P1** | `ReadinessEvaluator.ts:94`<br/>`ReadinessProjection.ts:191-198`<br/>`ReadinessView.tsx:280,320-352` | `ReadinessEvaluator`（满分扣减法）与 `ReadinessProjection`（加权合成法）算法不一致，总分与细分项相加对不上 | 评分数学逻辑混乱，用户产生信任危机 |
| **BUG-L5-02** | 准备度门禁 -> 未闭环领域快速采纳 | **P1** | `apps/web/src/features/readiness/ReadinessView.tsx:96-121` | 连续快速点击采纳建议时携带陈旧版本号，触发 409 冲突后静默失败无任何提示 | 快速采纳按钮无响应假死，阻塞闭环流程 |
| **BUG-L5-03** | 准备度门禁 -> 严重冲突强制签署 | **P2** | `ReadinessGate.ts:100-106`<br/>`ReadinessProjection.ts:241-243` | 服务端门禁要求特批凭证，但投影视图透出的选项集未包含该签署项，用户无法放行 | 流程被死锁阻断，无法通过 UI 决策突破阻碍 |
| **BUG-L6-01** | 文档三方合并 -> 结构化代码块解析 | **P0** | `packages/core/src/documents/SectionMergeGuard.ts:36-64` | 正则匹配 Markdown 标题未剔除代码围栏，Python/Bash/YAML 文件的 `# 注释` 会将代码块劈成两半 | 严重毁损代码示例格式，重编译导致语法错乱 |
| **BUG-L6-02** | 文档重新编译 -> 差异保护拦截 (Diff) | **P0** | `packages/core/src/documents/DocumentDiffEngine.ts:125-154` | 差异计算采用粗暴的同索引单指针逐行比对，插入 1 行空行会导致后续整篇文档全部被判定为增删差异 | 伪差异全面爆发，Diff 弹窗完全失去对比意义 |
| **BUG-L6-03** | 文档编译 -> 冲突标记持久化 | **P1** | `packages/core/src/documents/SectionMergeGuard.ts:134-142`<br/>`DocumentCompiler.ts:144-154` | 合并冲突标记（`<<<<<<<` 等）直接回写磁盘且接口返回编译成功，无任何预警机制 | 用户本地规范文件中混入破坏性冲突标记 |
| **BUG-L6-04** | 文档导出 -> 离线单文件 HTML | **P1** | `packages/core/src/export/StandaloneHtmlExporter.ts:420,463-470` | 离线 HTML 未内嵌 Mermaid.js 渲染引擎，且未提供 DAG 渲染脚本，图表退化为纯文本代码 | 离线交付包失去核心可视化功能与交互体验 |
| **BUG-L6-05** | 规范漂移审计 -> 重新编译文档联动 | **P2** | `apps/web/src/features/audit/SpecDriftModal.tsx:46-67` | 规范漂移模态框未响应全局 `stateRevision` 刷新，文档重编译后仍显示历史过期的漂移报告 | 用户需要反复手动点击重新审计，交互割裂 |
| **BUG-L6-06** | 离线单文件 HTML -> 标签切换事件绑定 | **P3** | `StandaloneHtmlExporter.ts:435-460` | 内联 HTML 中的 `onclick="showDecisionsView()"` 尝试访问 `event.currentTarget` 未传参，严格模式报错 | 离线 HTML 页面在部分现代浏览器中切换失败 |

---

## 六、 针对性最优改善方案与实施验证方案 (Targeted Optimal Solutions)

### 6.1 针对 BUG-L6-01（代码注释被误判为 Markdown 标题）的 AST 解析加固
- **改造思路**：在 `SectionMergeGuard.parseSections` 中引入行级状态机，维护 `inCodeBlock` 状态。当行首出现 ```` ``` ```` 或 `~~~` 时切换代码块状态；只有在 `inCodeBlock === false` 时，才执行 `/^(#{1,6})\s+(.*)$/` 标题匹配。
- **核心伪代码**：
  ```ts
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        // 安全切分章节
      }
    }
  }
  ```

### 6.2 针对 BUG-L6-02（差异对比引擎索引级联假阳性）的 LCS 差异算法替换
- **改造思路**：废弃 `maxLen` 单指针双重下标遍历方式，改用基于动态规划的最长公共子序列（Longest Common Subsequence, LCS）或标准 Myers 差异算法。将每一行作为一个 token，生成准确的块级增、删、改 unified diff，避免偏移量错位引起的伪差异。

### 6.3 针对 BUG-L4-01 & BUG-L4-02（架构图硬编码元规则与伪造时序流）的领域数据驱动生成
- **改造思路**：
  1. 边界治理图必须读取用户项目真实的 `snapshot.overview.sections` 与 `snapshot.decisions`，提取标有 `technical_boundary`、`data-storage` 的决策，展示用户自定义的项目架构边界；
  2. 组件时序流图必须基于决策中的依赖项（`dependsOn`、`evidenceRefs`）以及领域标签关系绘制真实拓扑，若依赖数据为空，则提供结构清晰的领域层级图，绝不串联文档章节为虚假链表。

### 6.4 针对 BUG-L4-03（架构图缩放截断与缺乏平移）的平移矩阵注入
- **改造思路**：在 `ArchitectureDiagramsView.tsx` 中为画布添加 `panOffset: { x: number; y: number }` 状态，使用 `style={{ transform: \`translate(\${panOffset.x}px, \${panOffset.y}px) scale(\${zoomScale})\` }}`，并在容器上挂载标准鼠标按住拖拽与按住空格键拖拽平移事件。

### 6.5 针对 BUG-L5-01（评分计算模型分裂）的单一事实源（SSOT）对齐
- **改造思路**：废除 `ReadinessProjection.ts` 中自创的加权计分分支，让前端视图统一直接消费 `ReadinessEvaluator.evaluate(snapshot)` 输出的权威评分与分项 Breakdown 结构，保证顶部总分与各项明细百分之百严密吻合。

---

## 七、 结论 (Conclusion)

通过对生命周期 4、5、6 的全方位静态穿透与逻辑推演，可以确认：
1. **Lifecycle 4** 具备扎实的 SVG/Mermaid 展现框架，但存在**硬编码元准则污染用户蓝图**、**组件流图造假**以及**图表平移缩放交互残缺**等关键问题；
2. **Lifecycle 5** 的 8 大领域门禁与阻断链机制完整，但存在**两套评分数学模型冲突**及**行内修复 409 竞态静默挂起**的断点；
3. **Lifecycle 6** 的双阶段安全编译与离线交付设计架构精良，但底层存在 **AST 解析器切碎代码块（P0）** 与 **差异算法单指针假阳性级联（P0）** 两个阻断级隐患，必须优先修复。
