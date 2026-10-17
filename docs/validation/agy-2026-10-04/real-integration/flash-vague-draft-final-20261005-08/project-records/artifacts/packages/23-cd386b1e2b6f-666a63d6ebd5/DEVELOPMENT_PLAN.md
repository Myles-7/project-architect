# 真实集成验证-flash-vague-20261004-03 — 全阶段开发任务

版本：23；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

## 快速捕获组件与标签即时提取开发任务

ID：task-quick-capture；关联需求：feature-quick-capture、flow-quick-capture、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-quick-capture、flow-quick-capture

### 秒级灵感极速捕获组件与交互实现规范

1. **组件设计与自适应交互**：
   - 实现 `QuickCaptureCard` 组件，常驻主工作区最顶部。
   - 输入框初始为单行文本域（高度约 44px），带占位提示“随手记下新灵感... 按 Ctrl+Enter 保存，输入 #添加标签”。
   - 随输入行数自适应增高（最大限制展开至 8 行约 200px），超出后内部平滑滚动。
   - 全局快捷键监听：当视口未处于其他表单输入焦点时，按下 `N` 键平滑滚动至顶部并自动聚焦捕获输入框。

2. **智能行内标签提取算法**：
   - 用户输入文本时支持就地键入 `#标签名`（如“调研 Rolldown 静态编译 #打包 #构建”）。
   - 提交时通过正则 `/(?:^|\\s)#([\\w\\u4e00-\\u9fa5-]+)/g` 动态匹配提取所有标签名，自动去除 `#` 前缀并执行去重处理。
   - 输入框下方动态展示当前提取到的标签预览胶囊，同时展示最近使用的高频标签胶囊，点击即可一键追加。

3. **快捷键提交与状态联动**：
   - 监听键盘组合键 `Ctrl + Enter`（Windows/Linux）或 `Cmd + Enter`（macOS），或点击右下角“记录灵感”按钮触发提交。
   - 空文本拦截：去除首尾空白字符后若长度为 0，阻止提交，触发输入框左右轻微抖动动画（CSS Shake 300ms），焦点保持不变。
   - 成功提交：构造 `Note` 实体（生成 UUID v4、注入当前时间戳、设置 status='active'、isPinned=false、isFavorite=false），调用 `StorageService.saveNote()`；成功后输入框清空并平滑折叠回单行状态，列表首部以淡入下移动效插入新卡片，未备份变更计数器 `unbackedChangesCount` 递增 1。

4. **异常防御与输入保留机制**：
   - 若本地持久化层写入抛出 `StorageQuotaExceededError`（存储配额满）：
     - 输入框内的正在编辑的文本与提取标签完全保留，组件保持展开状态，不予清空。
     - “记录灵感”按钮恢复可点击态，输入卡片顶部浮出醒目琥珀色告警横幅：“本地存储空间已满，灵感未能保存，请清理空间或立即导出备份”。
     - 横幅内提供“一键导出备份”快捷操作，用户处理完毕后可再次点击保存，确保正在键入的内容不丢失。

目标：实现单页应用顶部的随手灵感极速捕获功能，完成输入自适应、快捷提交、智能标签提取及存储写入失败状态保留。

范围：QuickCaptureCard 组件开发、键盘事件监听（N 键与 Ctrl/Cmd+Enter）、正文标签提取算法、空输入校验与轻微抖动、写入 StorageService 及未备份计数器联动。

排除：不包含便签长文的详情模态阅读，不包含卡片拖拽排版

模块：QuickCaptureCard、NoteService、StorageService

正常行为：打开页面或按 N 键自动聚焦输入框；输入多行平滑撑开；按 Ctrl/Cmd+Enter 瞬间提取正文与 #标签，生成实体并持久化，输入框清空复位，列表头部插入新卡片，未备份计数 +1。

异常行为：提交遇配额满或写入异常时，输入框内容与标签完整保留在文本域中，卡片不关闭，弹出错误横幅与立即备份入口，按钮恢复可点击状态供重试

验证：
- 单元测试验证 #标签 正则提取算法准确性（中英文、数字、非法字符过滤）
- 组件测试验证快捷键提交与空内容拦截抖动
- 注入存储失败模拟，验证输入框文本不被清空且错误横幅正确渲染

完成条件：
- 快速捕获交互、快捷键提交与标签提取单元测试通过率 100%
- 输入内容为空时抖动拦截率 100%
- 存储满载注入测试中文本保留在文本域中不被清空，输入域不关闭不重置

假设：用户具备常规键盘与点击输入环境；浏览器支持标准 DOM Focus 与 Input 事件

来源：evidence-user-inp-01、evidence-capture-modality、evidence-mdn-storage-estimate-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 静态构建打包与本地离线部署任务

ID：task-build-and-deploy；关联需求：deployment-and-build-specification、tech-core-architecture；依赖：task-foundation-and-storage、task-quick-capture、task-note-card-view、task-data-portability

### 纯前端静态构建优化与部署交付规范

1. **Vite 生产构建优化配置**：
   - 生产构建命令：`npm run build`（调用 `vite build`），编译输出 `dist/` 纯静态文件夹。
   - **代码拆分（Code Splitting）策略**：
     - `vendor-react`: 拆分 `react`, `react-dom`。
     - `vendor-storage`: 拆分 `dexie`, `dexie-react-hooks`。
     - `vendor-markdown`: 拆分 `marked`, `dompurify`, `prismjs`。
     - `vendor-icons`: 拆分 `lucide-react`。
   - **静态资源相对路径**：配置 `base: './'`，确保产物既可部署在任意子路径域名下，亦可在本地直接使用文件协议或静态服务器运行，规避绝对路径导致的 404 资源加载异常。
   - **体积控制基准**：全量静态产物经 gzip 压缩后总体积控制在 150KB 以内，保障 3G 弱网或常规宽带下首屏加载能在 300ms 内完成。

2. **多形态部署方案落地**：
   - **本地开箱运行**：提供 `npm run preview` 启动本地静态测试服务，开箱即用。
   - **纯静态免服务端托管**：直接支持推送到 GitHub Pages、Cloudflare Pages、Vercel 或 Netlify，零服务端配置，具备天然的高并发与极低运维成本。
   - **PWA 脱机访问就绪**：配置标准 Web App Manifest，为用户提供“安装到桌面”与全脱机离线缓存基础。

3. **安全上下文与依赖检查**：
   - 生产部署环境强制启用 HTTPS 或在本地使用 `localhost` 访问，确保现代浏览器 StorageManager API 与 Clipboard API 完整可用。

目标：完成 Vite 生产构建优化与打包配置，输出纯静态无后端依赖产物包，支持本地即开即用与免服务器静态托管部署。

范围：vite.config.ts 构建优化配置、生产打包产物验证、本地预览脚本配置、单页静态路由与静态资源相对路径测试。

排除：不包含服务端 Dockerfile 编写与后端运维编排（坚持纯前端单页架构）

模块：ViteBuildConfig、DeploymentScripts

正常行为：执行 npm run build 极速完成打包；输出 dist/ 静态目录；资源引用使用相对路径；使用 npm run preview 或静态服务器启动后应用完整可用且无离线报错。

异常行为：构建若遇到 TypeScript 类型错误或未解析依赖时，构建命令立即阻断并输出明确错误行号，不输出半成品损坏产物

验证：
- 执行 npm run build 检查构建产物与 exit code
- 检查 dist/ 目录产物体积报告（确保 gzip 压缩后总体积 < 150KB）
- 使用本地静态服务加载产物验证功能完整性与控制台零报错

完成条件：
- 生产构建 0 错误 0 告警顺利通过
- 输出产物完全可在纯静态 HTTP 服务器下独立运行
- 首屏资源在无缓存本地加载耗时 < 300ms

假设：构建环境具备 Node.js 18+ 与 npm / pnpm

来源：evidence-vite-official、evidence-vite-static-deploy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 便签卡片流展示、回收区 7 天生命周期与操作开发任务

ID：task-note-card-view；关联需求：feature-note-card-view、flow-note-card-actions、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-note-card-view、flow-note-card-actions

### 便签卡片流展示、回收区 7 天生命周期与操作开发任务

1. **便签流容器与双布局形态**：
   - 开发 `NoteFeed` 与 `NoteCard` 组件，支持网格（Grid）与紧凑列表（Compact List）双布局切换与持久化偏好恢复。
   - 卡片呈现置顶图钉、收藏星标、相对时间、5 行正文摘要及标签胶囊。
2. **回收区生命周期（RecycleBinView）与 7 天保留状态实现**：
   - 彻底移除原 5 秒撤销软删除逻辑，实现回收区视图组件 `RecycleBinView`。
   - 卡片删除交互改为移入回收区：更新 `status='trashed'`, `trashedAt=Date.now()`，从活跃流移除并移入回收区，侧边栏回收区徽标 +1，未备份变更计数 +1，底部弹出“便签已移入回收区（保留7天）[查看回收区]” Toast。
   - 回收区卡片展示剩余天数：计算 `Math.max(0, 7 - Math.floor((Date.now() - trashedAt) / 86400000))`，显示“还剩 X 天”胶囊。
   - 卡片操作栏提供【还原】与【彻底删除】按钮：
     - 点击【还原】：调用 `StorageService.restoreNote(id)`，便签恢复为 active，原标签及置顶收藏状态完整保留，平滑插回活跃流。
     - 点击【彻底删除】：调用二次确认对话框 `ConfirmDialog`，用户确认后调用 `StorageService.hardDeleteNote(id)` 物理删除。
3. **超期便签常驻横幅与一键清空（依据 dec-cd105627-1e53-4251-9f8e-9422bdfbbd5c）**：
   - 监听回收区便签数据，当存在便签满足 `Date.now() - trashedAt > 7 * 86400 * 1000` 时，侧边栏回收区入口点亮琥珀色预警圆点。
   - 用户切入回收区视图时，顶部常驻琥珀色提示横幅“有 X 条便签已超过 7 天保留期限”，提供【清空已过期便签】与【一键彻底清空】按钮。
   - 点击后弹出带红色警告文案的二次确认对话框，用户确认后开启物理删除事务批量删除，写入失败自动回滚。

目标：交付便签双布局流展示、回收区 7 天生命周期管理、状态还原、超期常驻横幅提示与二次确认清空能力。

范围：NoteCard、NoteFeed、RecycleBinView 组件开发，7 天保留天数计算，还原与彻底删除交互，超期常驻横幅与二次确认对话框，失败回滚保护。

排除：不包含富文本绘图与多用户协同光标

模块：NoteFeed、NoteCard、RecycleBinView、NoteService、WorkspaceUI

正常行为：便签按置顶与时间排版；点击删除移入回收区保留 7 天；回收区显示剩余保留天数；点击还原恢复活跃态与关联标签；超过 7 天显示常驻横幅提示，经二次确认彻底删除。

异常行为：移入回收区或还原失败时卡片状态立刻回滚至操作前并提示错误；彻底删除失败事务回滚，便签保留在回收区中，绝不损坏或丢弃数据

验证：
- 组件交互测试验证移入回收区与 7 天剩余天数展示
- 测试超过 7 天过期横幅展示与清空超期便签二次确认流
- 测试还原便签后原标签与置顶收藏属性无损恢复
- 模拟底层写入中断测试事务回滚与卡片恢复机制

完成条件：
- 便签移入回收区、7天剩余天数计算与还原功能测试通过率 100%
- 超过 7 天过期横幅常驻渲染与二次确认彻底清空通过验证
- 彻底删除与还原失败时回滚保护测试全部通过

假设：客户端本地系统时间准确且运行于标准现代浏览器环境

来源：evidence-platform-form、evidence-org-model、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be、evidence-aa854fb0-c683-487b-9f19-90974f40bc8e；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 多维标签聚合、交集筛选与全局重命名开发任务

ID：task-tag-organization；关联需求：feature-tag-organization、flow-tag-organization、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-tag-organization、flow-tag-organization

### 多维标签聚合、交集筛选与全局重命名实现任务（排除回收区便签）

1. **侧边栏标签聚合统计逻辑加固**：
   - 修改标签聚合管道，仅统计 `status !== 'trashed'`（活跃及归档）的便签，排除回收区便签。
   - 当便签在活跃流与回收区之间流转（删除/还原）时，标签统计数据毫秒级派生重算。
2. **单选与多标签交集筛选**：
   - 实现单标签过滤与 `Ctrl/Cmd` 多标签交集（AND）过滤，交集结果仅展示同时包含选中标签的非回收区便签。
3. **标签全局重命名事务与异常回滚**：
   - 实现全局重命名批量更新事务，涵盖活跃、归档及回收区便签，确保便签还原后标签名称一致。
   - 遭遇写入中断时底层事务自动回滚，保持原有标签不变。

目标：实现侧边栏标签云聚合（排除回收区便签）、多标签交集过滤及事务级标签全局重命名。

范围：TagRail 组件优化、标签派生统计过滤、单选与多选交集算法、事务级批量重命名与同名合并。

排除：不设计树状层级目录与无限嵌套标签

模块：TagRail、NoteService、StorageService

正常行为：标签栏实时统计非回收区便签中的标签频次；便签移入回收区扣减标签数；还原便签增加标签数；重命名时事务级批量更新关联便签。

异常行为：批量重命名失败时事务整体回滚，关联便签保持原标签名称，界面提示失败

验证：
- 单元测试验证便签移入回收区前后标签计数变化
- 测试 Dexie 事务中 batchUpdateTags 原子性与回滚机制

完成条件：
- 标签云聚合排除回收区便签测试通过率 100%
- 便签移入回收区与还原时标签计数动态增减验证通过
- 标签批量重命名事务原子性与回滚测试通过

假设：便签 tags 属性为去重字符串数组

来源：evidence-org-model、evidence-indexeddb-spec、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 全文模糊检索引擎与关键词高亮开发任务（回收区范围隔离）

ID：task-search-filter；关联需求：feature-search-filter、flow-search-filter、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-search-filter、flow-search-filter

### 全文模糊检索引擎与关键词高亮开发任务（回收区范围隔离）

1. **检索引擎与防抖管道**：
   - 开发 `SearchBar` 与 `SearchEngine`，挂载 80ms 轻度防抖，执行关键词分词与模糊匹配。
2. **检索作用域隔离实现**：
   - 常规视图检索：严格从活跃及归档便签集合中匹配，自动过滤排除 `status === 'trashed'` 便签。
   - 回收区限定检索：当用户切换至 `RecycleBinView` 时，检索引擎自动将数据源切换为回收区便签集合，实现回收区内部快速查找。
3. **关键词黄色 `<mark>` 安全高亮**：
   - 安全转义所有正则特殊字符，使用安全文本节点分割包裹 `<mark class="highlight">`，防范 XSS 与非法正则崩溃。
4. **快捷键唤醒与快捷重置**：
   - 监听 `/` 键聚焦全选，监听 `Esc` 键清空重置。

目标：实现具备 80ms 防抖的全局全文检索与关键词高亮，并建立常规检索与回收区范围隔离机制。

范围：SearchBar 开发、SearchEngine 模糊匹配算法、检索范围视图感知隔离、安全高亮 HTML 生成、快捷键绑定。

排除：不引入重量级服务端检索引擎，纯前端轻量内存匹配

模块：SearchBar、SearchEngine、WorkspaceUI

正常行为：输入检索词经 80ms 防抖过滤卡片；命中词高亮显示；常规视图不展示回收区便签；回收区视图限定在回收区检索；按 / 聚焦，按 Esc 重置。

异常行为：特殊字符自动转义，无匹配展示空状态与重置按钮；高亮失败降级展示纯文本

验证：
- 单元测试验证常规检索严格排除回收区便签
- 测试回收区视图内部检索命中与高亮
- 测试各类特殊字符安全转义防崩

完成条件：
- 模糊匹配与高亮算法测试通过率 100%
- 常规检索排除回收区便签及回收区内部检索验证通过
- 连续正则符号安全转义零崩溃验证通过

假设：待检索便签常驻内存状态镜像受控在浏览器常规限制内

来源：evidence-org-model、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 详情模态弹窗与 Markdown 编辑器开发任务（回收区只读保护）

ID：task-note-detail-edit；关联需求：feature-note-detail-edit、flow-note-detail-edit、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-note-detail-edit、flow-note-detail-edit

### 详情模态弹窗与轻量 Markdown 编辑器实现任务（回收区只读保护）

1. **模态弹窗与 Markdown 排版渲染**：
   - 开发 `NoteDetailModal` 组件，集成 marked 与 DOMPurify 安全白名单过滤，集成 Prism.js 语法着色与代码一键复制。
2. **回收区只读保护与快捷操作实现**：
   - 弹窗打开时检测便签 `status`：若处于回收区（`status === 'trashed'`），弹窗自动切为强制只读模式，禁用内联编辑及 Todo Checkbox 勾选。
   - 弹窗顶部常驻展示黄色警示条：“此便签处于回收区，不可直接编辑。请先【还原】后再行修改，或点击【彻底删除】物理清理”。
   - 弹窗底部提供【还原便签】与【彻底删除】操作按钮，点击【还原】后立即恢复活跃状态并解锁编辑。
3. **编辑草稿保护与失败拦截**：
   - 活跃便签编辑保存时，若遇存储配额超限异常，弹窗绝对不关闭，编辑文本完整保留在编辑域中，顶部展示重试按钮。

目标：交付便签详情阅读与编辑模态弹窗，集成 Markdown 安全排版、回收区便签只读保护及失败草稿保留。

范围：NoteDetailModal 组件开发、MarkdownRenderer 白名单管道、回收区只读防护条、还原与彻底删除触发、保存失败草稿保留。

排除：不集成富文本绘图画板与复杂公式排版

模块：NoteDetailModal、MarkdownRenderer、NoteService、WorkspaceUI

正常行为：点击卡片弹出详情弹窗；排版展示 Markdown 与高亮代码；常规便签可直接编辑并保存；回收区便签强制只读展示，提示先还原再编辑。

异常行为：编辑保存失败时弹窗不关闭，草稿保留在文本框中；剪贴板受阻时降级为 execCommand 提示手动复制

验证：
- 测试 DOMPurify 防 XSS 注入
- 验证回收区便签弹窗只读保护与还原触发
- 模拟存储配额满测试编辑草稿保留与弹窗防关闭

完成条件：
- Markdown 安全渲染与 DOMPurify 白名单过滤测试通过率 100%
- 回收区便签详情弹窗只读保护与还原入口验证通过
- 保存失败弹窗防关闭与草稿保留验证通过

假设：宿主环境支持 DOM 模态弹窗事件与 Clipboard API

来源：evidence-capture-modality、evidence-react-official、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 宿主浏览器端持久化容量与全文检索性能实测验证任务

ID：val-browser-storage-and-search-perf；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability、feature-note-card-view；依赖：tech-storage-and-search、interface-service-contracts

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、超期便签批量查询与清空延迟）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，移交交付阶段在真实浏览器中闭环验证。

目标：在真实宿主浏览器中实测验证 IndexedDB (Dexie.js) 本地持久化稳定性、1,000 条便签基准下的全文检索端到端延迟（含 80ms 防抖）、回收区 7 天超期便签批量清理性能及配额满载状态保留机制。

范围：覆盖 Chrome、Edge、Firefox 真实浏览器；利用测试脚本自动批量注入 1,000 条便签样本集（涵盖活跃、归档及处于回收区的超期便签）；执行检索、高亮、回收区清理性能及稳定性检验。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量灌入 1,000 条便签耗时 < 800ms；键入检索词后端到端渲染延迟稳定在 150ms 以内；超期便签批量查询与清空流畅无卡顿；首屏冷启动 TTI < 1.0s。

异常行为：若实测检索响应时间超过 250ms，触发长列表虚拟滚动优化；若超期便签查询慢，加固 trashedAt 复合索引；若配额异常未捕获，加固存储事务失败监听

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 校验配额估算与拦截流程
- 测试脚本核对超期便签批量删除前后数据一致性

完成条件：
- 1,000 条便签基准下，10 次搜索的平均响应时间小于 150ms（含 80ms 防抖）
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 回收区超 7 天便签查询（listExpiredTrashedNotes）执行时间 < 50ms
- 配额超限注入时输入框与编辑弹窗文本保留率达到 100%

假设：测试硬件不低于常规个人电脑基准（4核 CPU，8GB 内存）；应用运行于标准安全上下文（localhost 或 HTTPS）

环境：主流桌面 PC（Windows 11 / macOS 14 / Ubuntu 22.04），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器环境

步骤：
- 1. 运行构建命令并在真实 Chrome 浏览器中启动本地预览页面
- 2. 执行基准数据灌入脚本，批量生成 1,000 条混合格式便签（含 100 条回收区便签，部分超 7 天）写入 IndexedDB
- 3. 开启 Performance 性能分析，记录关键词检索时间与回收区切换时间
- 4. 测试 listExpiredTrashedNotes 与 purgeExpiredTrashedNotes 执行耗时与事务原子性
- 5. 模拟存储配额满状态，验证输入框与编辑弹窗文本保留情况

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 回收区超期便签批量删除事务通过率 100%
- 配额超限注入时文本 100% 完整保留未丢失

证据：Chrome DevTools Performance 性能面板记录分析文件；控制台自动化基准测试脚本运行耗时日志截图与数据文本；回收区批量清理事务回滚测试报告

失败后：若性能未达标，将检索算法升级为基于内存倒排索引，并引入分页虚拟滚动；若配额异常处理失败，补齐跨标签页存储状态同步。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 工程基座搭建与 Dexie 存储驱动封装实现任务

ID：task-foundation-and-storage；关联需求：tech-core-architecture、data-model-core-entities、interface-service-contracts、error-architecture-and-recovery；依赖：tech-core-architecture、data-model-core-entities、interface-service-contracts

### 基础工程脚手架与 Dexie.js 存储驱动实现规范（回收区生命周期）

1. **工程基座与工具链**：
   - React 19 + TypeScript 5.x + Vite 初始化纯前端工程，启用 `strict: true`。
   - 安装配置 Dexie.js、marked、DOMPurify、Prism.js、Lucide React 及 Tailwind CSS。
2. **IndexedDB 强类型 Schema 与 Dexie 实例封装**：
   - 数据库类 `SparkNotesDB extends Dexie`：
     - `notes`: `id, updatedAt, createdAt, status, trashedAt, *tags, isPinned, isFavorite`。
     - `meta`: `key`（存储备份追踪、存储持久化模式与用户偏好）。
   - 实现 `IStorageService` 完整方法集，确保所有更新时间戳 `updatedAt` 在服务层自动注入。
3. **回收区 7 天生命周期底层方法集实现**：
   - `trashNote(id)`：原子更新 `status = 'trashed'`, `trashedAt = Date.now()`, `updatedAt = Date.now()`。
   - `restoreNote(id)`：原子更新 `status = 'active'`, `trashedAt = null`, `updatedAt = Date.now()`，保留原有 tags、isPinned、isFavorite。
   - `hardDeleteNote(id)`：调用 `db.notes.delete(id)` 物理清除。
   - `listExpiredTrashedNotes(retentionDays = 7)`：查询 `db.notes.where('status').equals('trashed').and(n => n.trashedAt && (Date.now() - n.trashedAt > retentionDays * 86400 * 1000)).toArray()`。
   - `purgeExpiredTrashedNotes(retentionDays = 7)`：采用 `db.transaction('rw', db.notes, async () => { ... })` 事务批量删除超期便签，失败自动回滚。
   - `emptyTrash()`：事务清空全部 `status === 'trashed'` 便签。
4. **StorageManager API 配额感知与持久化授权**：实现 `requestPersistence()` 与 `getStorageQuota()`。
5. **异常防御与事务回滚**：底层抛出 `QuotaExceededError` 封装为 `StorageQuotaExceededError`，批量更新与清理失败触发事务回滚。

目标：完成工程脚手架搭建，实现基于 Dexie.js 的存储服务，涵盖回收区 7 天生命周期方法集与事务保障。

范围：项目脚手架配置、Dexie.js Schema 定义与数据库初始化、IStorageService 全部接口（含回收区生命周期）实现、事务与异常封装。

排除：不包含具体的页面 UI 渲染与样式，不包含外部备份文件解析算法

模块：StorageService、SparkNotesDB

正常行为：数据库连接建立毫秒级响应；CRUD、移入回收区、还原及超期便签筛选精准执行；配额正常查询。

异常行为：存储超限抛出受控异常，不损坏既有数据；清理中断时执行 Rollback，保持数据原子性

验证：
- 使用 fake-indexeddb 执行 StorageService 单元测试，覆盖移入回收区、还原与超期筛选
- 测试 purgeExpiredTrashedNotes 事务中途失败回滚逻辑
- 验证 StorageManager 配额与持久化调用分支

完成条件：
- StorageService 基础 CRUD 及回收区方法集单元测试通过率 100%
- trashedAt 索引及 7 天过期筛选查询正确率 100%
- 超期便签批量清理事务回滚验证全部通过

假设：运行环境支持标准 IndexedDB 2.0+ 与 StorageManager API；应用运行于标准安全上下文（HTTPS 或 localhost）

来源：evidence-vite-official、evidence-indexeddb-spec、evidence-mdn-indexeddb、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 真实宿主浏览器端存储基准与全文检索性能交付验证任务

ID：val-storage-and-search-benchmark；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability、val-browser-storage-and-search-perf、feature-note-card-view；依赖：task-foundation-and-storage、task-search-filter、task-data-portability

### 真实宿主浏览器端存储基准与全文检索性能交付验证任务

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下全文检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、超期便签批量查询与清空延迟）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，在交付阶段真实浏览器环境中闭环实测验收。

1. **未验证能力与性能目标界定**：
   - **检索性能**：在灌入 1,000 条混合格式便签（含常规及处于回收区的便签）的数据规模下，连续执行 10 次模糊搜索，测量从击键结束、经过 80ms 防抖、到检索计算完成及 DOM 重新排版渲染完成的真实端到端时间，验证平均耗时是否小于 150ms。
   - **回收区超期查询与批量清空性能**：在 100 条回收区便签规模下，验证 `listExpiredTrashedNotes` 执行耗时是否小于 50ms，验证清空超期便签批量删除事务耗时是否小于 200ms。
   - **首屏加载**：在无本地 HTTP 缓存状态下，应用冷启动加载至首屏 6 块骨架屏消失且便签列表可交互时间（TTI）实测验证是否小于 1.0 秒。
   - **存储满载状态保留**：模拟存储满载异常抛出，验证输入框与编辑弹窗在报错横幅出现后的文本草稿保留情况，确保文本保留在输入区域未被清空且弹窗维持开启。

目标：在真实浏览器环境中实测验证 1,000 条便签规模下的全文检索端到端响应时间、回收区 7 天超期清理事务耗时、首屏冷启动 TTI 及存储配额满载状态保留机制。

范围：覆盖主流桌面浏览器；利用脚本自动注入 1,000 条测试样本（含超 7 天回收区便签）；执行检索、高亮、回收区清理、导出导入及配额防御全链路检验。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量灌入 1,000 条便签耗时 < 800ms；全文检索端到端平均延迟 < 150ms；超期便签批量清理事务 < 200ms；首屏可交互 TTI < 1.0s。

异常行为：检索延迟若超 250ms 引入虚拟滚动；回收区查询若超时优化 trashedAt 索引复合条件；配额异常捕获失败加固全局错误监听

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 校验配额估算与拦截流程
- 通过测试脚本核对回收区清理事务数据一致性

完成条件：
- 1,000 条便签基准下，10 次搜索平均端到端响应时间小于 150ms（含 80ms 防抖）
- 回收区超期便签筛选与清空事务执行时间小于 200ms
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 模拟存储配额满载时，输入框与编辑弹窗文本保留在输入区未被清空，弹窗维持开启

假设：测试宿主机器为常规 PC（4核 CPU，8GB 内存以上）；测试浏览器为最新稳定版 Chrome / Edge / Firefox

环境：主流桌面 PC（Windows 11 / macOS / Ubuntu），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器，标准安全上下文

步骤：
- 1. 执行 npm run build 并通过本地静态服务器启动应用
- 2. 运行基准脚本注入 1,000 条便签（含超期回收便签）并验证写入完成
- 3. 开启 Performance 性能记录，连续执行 10 组搜索，记录耗时
- 4. 测量回收区超期便签常驻横幅渲染及清空事务耗时
- 5. 测量冷启动 TTI 与配额超限注入时的文本保留情况

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 超期便签批量清理事务执行稳定且无数据遗失
- 配额超限异常注入时文本完整保留未丢失

证据：Chrome DevTools 性能录制与度量数据报告；自动化测试脚本控制台输出耗时日志；回收区清理事务前后数据一致性核对报告

失败后：若检索耗时在 150~250ms 之间，分析瓶颈并引入 React.memo 与 useDeferredValue；若超 250ms，重构为倒排索引并加入虚拟滚动。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 数据备份导出、导入恢复、回收区策略与防丢提醒开发任务

ID：task-data-portability；关联需求：feature-data-portability、flow-data-portability、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-data-portability、flow-data-portability

### 数据备份导出、导入恢复、回收区策略与防丢提醒开发任务

1. **JSON Schema v1 导出与回收区策略实现**：
   - 开发 `BackupManager` 与 `DataManagementModal` 面板。
   - 实现 `exportJsonBackup({ includeTrash?: boolean })`：默认导出包含处于回收区（`status === 'trashed'`）的便签，保留其 `trashedAt` 移入时间戳与标签；在导出面板提供【包含回收区便签】复选框，允许用户按需排除回收区便签。
   - 文件命名为 `spark-notes-backup-YYYY-MM-DD.json`。
2. **备份文件强校验与智能增量合并**：
   - 拖拽上传与文件选择器读取，校验 Schema v1 规范，严格校验 `status` 与 `trashedAt`。格式错误强行阻断报错，绝不污染本地数据。
   - 智能增量合并逐条比对 ID 与 `updatedAt` 时间戳；导入后自动识别存在驻留超 7 天的回收区便签，立即激活侧边栏过期预警点与常驻横幅。
   - 全量覆盖前自动生成内存快照，异常时安全回滚。
3. **变更追踪与温和防丢提醒**：
   - 移入回收区、还原及彻底删除操作均自增 `unbackedChangesCount`；达到 20 条或超 7 天未备份时在侧边栏点亮琥珀色提示点，导出成功后清零复位。

目标：交付本地数据 JSON/Markdown 规范导出（含回收区数据策略）、外部备份强校验与导入恢复、超 7 天回收便签即时警示及防丢提醒。

范围：BackupManager 服务开发、DataManagementModal 界面开发、包含/排除回收区便签导出逻辑、导入格式强校验与增量合并、超期回收便签即时预警触发、未备份变更追踪器。

排除：不搭建远程云端中心化存储同步，保持纯客户端离线自主掌控

模块：BackupManager、DataManagementModal、StorageService、WorkspaceUI

正常行为：点击导出生成 JSON 文件并触发下载，未备份计数归零；支持排除回收区便签；导入合法文件增量合并，若含超期便签立即点亮过期预警；累积 20 条变更侧边栏显示温和提示点。

异常行为：导入损坏文件强行拦截报错，不写入脏数据；事务中断自动回滚还原；导出受阻保持面板并提示重试

验证：
- 单元测试验证合法及畸形 JSON 备份文件的校验拦截
- 测试导出中包含与排除回收区便签选项对产物的影响
- 测试导入含超 7 天便签后侧边栏过期预警点与横幅的激活
- 测试变更计数递增与导出后复位清零

完成条件：
- JSON 备份导出默认包含回收区便签及排除选项单元测试通过率 100%
- 导入校验拦截非法文件且无脏写入测试通过率 100%
- 导入超 7 天回收便签后即时点亮预警点与横幅验证通过
- 未备份变更计数与防丢提醒触发复位测试全部通过

假设：浏览器支持标准 Blob, File 与 FileReader API

来源：evidence-platform-form、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-6ddb77ee-acc4-4ae3-a560-e67f902a47ad、evidence-file-api、evidence-mdn-storage-eviction-01、evidence-cdc2a53a-bffa-464b-8462-2e4714cea48d；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046
