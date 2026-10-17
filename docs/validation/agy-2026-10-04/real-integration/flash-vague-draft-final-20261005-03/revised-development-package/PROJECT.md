# 真实集成验证-flash-vague-20261004-03 — 目标与边界

版本：23；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

## 目标用户画像与核心使用场景

ID：block-target-user-scenarios；关联需求：项目目标；依赖：无

### 目标用户群体与特征画像
1. **主要目标用户**：面向具备高频碎片灵感记录诉求的个人开发者、技术爱好者、产品设计人员及日常数字创作者。
2. **核心行为特征**：
   - 习惯于在 PC 桌面或移动端浏览器中长时间保持工作状态。
   - 对记录阻力极其敏感，追求从产生想法到输入完成的秒级流畅感。
   - 排斥必须强制输入标题、强制多层级目录归类或强制登录远程账号的重量级应用。
   - 偏好数据掌控感，重视本地数据隐私与轻量备份能力。

### 典型使用场景与上下文
1. **编码/查阅资料时的瞬时灵感捕捉**：
   - 场景：在阅读开源代码或技术文档时突发奇想，切换至常驻标签页或按下全局快捷键，立刻键入想法、临时代码片段或参考网址，按快捷键瞬间保存，不打断主工作流。
2. **零碎便签的轻量归类与回顾**：
   - 场景：每日工作结束或每周闲暇时打开应用，浏览近期卡片瀑布流，为未分类的便签打上业务标签（如 `#灵感`、`#待验证`），将重要便签加星收藏或置顶。
3. **针对特定任务或主题的毫秒级检索**：
   - 场景：在启动新模块开发时，通过顶部搜索框输入关键词或点击标签，即时筛选出过往记录的相关备忘与碎片思考。
4. **纯前端离线与本地自主使用**：
   - 场景：在出差、弱网或无网络环境下正常打开网页应用并记录，全部数据保存在浏览器本地持久化存储中，支持随时导出结构化备份。

来源：evidence-user-inp-01、evidence-f6a799ab-824c-4197-bcce-744889c62ef3、evidence-user-input-inp-01、evidence-platform-form；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 随手灵感碎片化与整理负担痛点

ID：block-problem-fragmented-ideas；关联需求：项目目标；依赖：block-target-user-scenarios

### 用户面临的核心痛点与现状分析
1. **记录启动门槛过高，灵感容易瞬时遗忘**：
   - 现状：现有综合类笔记软件往往体积庞大、启动慢，要求用户先选择笔记本、创建页面、撰写标题、甚至等待云端加载同步。
   - 影响：随手产生的碎片化灵感在繁琐的前置交互中迅速消散，导致用户放弃记录。
2. **无序堆积导致灵感沉没与查找困难**：
   - 现状：若使用系统自带记事本或简单草稿纸，零散文本迅速膨胀成灾，缺乏标签分类、模糊检索与状态标记。
   - 影响：记录之后极难回顾，灵感无法形成有效线索，沦为数字废料。
3. **层级文件夹模型带来的认知焦虑与维护负担**：
   - 现状：传统的树状文件夹分类要求用户在记录当下就预判其未来归属，分类标准极易模糊与重叠。
   - 影响：每次记录都伴随分类选择困难，后期整理成本甚至超过灵感本身的价值。
4. **数据隐私、托管下线风险与格式绑定**：
   - 现状：许多轻量记录工具依赖中心化后端或要求手机号登录，存在服务下线关停、数据泄漏风险，且导出格式复杂或受限。
   - 影响：用户无法完全拥有自己的灵感资产，缺乏长期安全感。

来源：evidence-user-inp-01、evidence-f6a799ab-824c-4197-bcce-744889c62ef3、evidence-user-input-inp-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 即开即用、零阻力捕获与敏捷整理的核心成效

ID：block-outcomes-lightweight-experience；关联需求：项目目标；依赖：block-problem-fragmented-ideas

### 预期交付的业务成效与核心体验成果
1. **即开即用的极速输入体验（待验证目标）**：
   - 在主流桌面 PC 浏览器（Chrome/Edge/Firefox 最新稳定版）常规硬件环境下，应用冷启动至首屏可交互时间（TTI）目标小于 1 秒。
   - 用户打开页面即刻自动聚焦输入框，从键入内容到按键保存完成的端到端交互流目标在 3 秒内闭环。
2. **低心智负担的高效整理与检索（待验证目标）**：
   - 采用扁平便签卡片流展示，无需预先规划目录层级。
   - 引入灵活标签（Tags）与快速收藏/置顶（Favorites/Pin），在 1,000 条本地灵感基准规模下，纯前端全文检索响应时间（含 80ms 输入防抖）目标小于 150ms。
3. **纯本地离线优先与数据自主安全（防御静默驱逐与 Safari 7 天清理）**：
   - 数据完全保存在用户浏览器本地持久化存储（IndexedDB）中，在无网络连接状态下所有本地读写、检索、打标、编辑功能均可离线运行，无阻断性网络报错。
   - 结合 StorageManager.persist() 权限申请与标准 JSON/Markdown 备份导出能力，配合“超20条变更或超7天未备份”温和防丢提醒，有效防御浏览器 LRU 驱逐与 Safari 7 天无交互清理风险，用户对自身数据拥有完全导出控制权。
4. **极致清爽、无干扰的专注界面**：
   - 无广告、无社交分享诱导、无强制注册登录拦截，保持纯粹的开发者工具属性。

来源：evidence-user-inp-01、evidence-platform-form、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-mdn-storage-eviction-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 明确的非目标与版本功能边界

ID：block-non-goals-exclusions；关联需求：项目目标；依赖：block-scope-core-boundaries

### 本版本明确排除的非目标（Non-Goals）
1. **不做多用户账户体系与云端认证登录**：
   - 不引入 JWT/OAuth/手机号/邮箱注册登录体系，坚决不做远程数据库强制鉴权，避免破坏即开即用特性。
2. **不做复杂树形文件夹体系与无限嵌套目录**：
   - 不设计树形文件夹导航，所有内容完全由扁平便签、多维标签与全文检索承接，避免多层级分类的认知负担。
3. **不做重量级富文本 WYSIWYG 排版编辑器**：
   - 不集成重型富文本编辑器（如复杂的表格编辑、嵌入视频流、实时协同光标画板等），保持编辑器毫秒级加载与极简纯文本/Markdown 体验。
4. **不做多人在线实时协同编辑与冲突解决机制**：
   - 专注单人本地工具属性，不引入 CRDT/OT 复杂的分布式网络协同算法。
5. **不做大体积多媒体二进制云端存储托管**：
   - 不提供图片/音视频的云存储上传服务，仅支持外链图片或文本链接引用。

来源：evidence-platform-form；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 轻量 Web 单页灵感工具的功能范围

ID：block-scope-core-boundaries；关联需求：项目目标；依赖：block-outcomes-lightweight-experience

### 功能范围界定（In Scope - 响应 7 天回收区生命周期变更）
1. **即时灵感捕获（Quick Capture）**：
   - 常驻页面顶部的快速输入卡片，支持多行文本自适应展开。
   - 支持键盘快捷键提交（`Ctrl/Cmd + Enter`）与快捷唤起（`N` 键聚焦）。
   - 支持正文中直接键入 `#标签名` 智能提取标签。
2. **便签流式浏览与多状态视图（Feed & Views）**：
   - 响应式便签卡片流（支持瀑布流/网格与紧凑列表切换）。
   - 便签状态流转：置顶（Pinned）、收藏（Favorite）、活跃（Active）、归档（Archived）、回收区暂存（Trashed）。
   - 视图过滤器：全部灵感、已加星收藏、已归档、回收区（Recycle Bin）。
3. **灵感回收区生命周期与 7 天保留保护（Recycle Bin & 7-Day Retention）**：
   - 删除便签不再直接丢弃或仅提供短时撤销，而是统一移入独立【回收区】暂存，标记 `status='trashed'` 与移入时间戳 `trashedAt`。
   - 回收区便签默认保留 7 天，期间支持用户一览查看、随时一键还原至原活跃状态与关联标签。
   - 超期提示与永久清理（依据已确认决策 dec-cd105627-1e53-4251-9f8e-9422bdfbbd5c）：侧边栏回收区入口展示过期预警状态点；用户切换至回收区视图时，顶部常驻琥珀色提示横幅“有 X 条便签已超过 7 天保留期限”，提供【清空已过期便签】与【一键彻底清空】按钮，经二次确认弹窗后执行物理删除。
4. **灵活标签组织体系（Tag Organization）**：
   - 标签云侧边栏聚合，自动统计各标签关联便签数量（严格排除处于回收区的便签，防止污染活跃标签池）。
   - 支持单标签精准过滤与多标签交集（AND）组合过滤。
   - 支持标签重命名（全局原子更新关联便签）与未使用标签清理。
5. **即时模糊搜索与高亮（Instant Search）**：
   - 前端全文模糊匹配（主工作区全局检索默认仅覆盖活跃与归档便签，回收区便签隔离于常规搜索结果之外；切换至回收区视图时限定在回收区内搜索）。
   - 命中关键字动态黄色高亮（`<mark>`），支持 `Esc` 键一键重置。
6. **便签详情与 Markdown 排版（Detail & Markdown Preview）**：
   - 点击卡片展开居中模态弹窗，展示完整便签内容。
   - 支持轻量 Markdown 格式化渲染（标题、列表、待办 Checkbox、外链、代码块语法高亮）。
   - 代码块右上角一键复制，外部超链接安全外跳。回收区便签进入详情弹窗时提供只读保护与【还原】/【彻底删除】入口。
7. **本地数据资产管理与温和防丢提醒（Data Portability & Backup Reminder）**：
   - 一键全量导出为结构化 JSON 备份文件及 Markdown 文档（JSON 备份默认包含回收区暂存便签并提供排除选项）。
   - 支持导入外部备份文件，提供校验与增量合并/全量覆盖策略，导入后自动识别超期回收便签并触发预警。
   - 基于已确认决策 dec-b17f49d8-86c3-4a74-baee-856b5d753129，追踪未备份变更数（如超20条）与未备份时间（如超7天），在界面侧边/底部温和显示“未备份”状态点与一键导出快捷入口。

来源：evidence-platform-form、evidence-org-model、evidence-capture-modality、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-vite-static-deploy、evidence-mdn-storage-persist-01、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be、evidence-aa854fb0-c683-487b-9f19-90974f40bc8e；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 已批准关键决定

- 这个随手灵感小工具的主要运行形态与使用场景偏向哪种？
轻量 Web 单页应用（浏览器即开即用）：开发本地运行或静态托管的轻量 Web 应用，通过浏览器书签或常驻标签页随手记录与整理。（product.platform_form；来源 answer:simulated-answer-flash-vague-20261004-03-1791125950709）
- 基于浏览器本地存储（IndexedDB）无服务端数据库的特性，您偏好哪种本地数据备份与导入恢复策略？
标准 JSON 导入导出 + 温和防丢备份提醒（推荐）：提供标准的 JSON 导出与导入校验能力，同时在前端追踪自上次备份以来的新增/修改灵感数量与时间；当积累较多未备份内容（如新增超20条或超7天未备份）时，在侧边/底部状态栏温和显示‘未备份’状态点与一键导出快捷操作。（product.backup_restore_strategy；来源 answer:simulated-answer-flash-vague-resume-20261004-04-1791127308730）
- 随手灵感采用‘无层级扁平便签卡片 + 灵活多标签（Tags）+ 快捷置顶收藏（Pin & Favorite）+ 即时全文模糊检索’的轻量组织模型。（product.organization_model；来源 change-b43fc7a4-b1c0-4938-a16a-87ed154de2c2-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-04-product-1791127537555）
- 随手记录的内容形态采用‘纯文本与轻量 Markdown 混合排版便签，支持单行/多行自适应极速输入、超链接自动识别、待办清单勾选与代码块语法高亮’。（product.capture_modality；来源 change-b43fc7a4-b1c0-4938-a16a-87ed154de2c2-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-04-product-1791127537555）
- 在前端 IndexedDB 客户端持久化层的技术实现上，您偏好哪种封装策略？
Dexie.js 响应式封装库（推荐）：引入 Dexie.js 作为客户端数据库管理层，声明强类型 Schema 与复合索引，配合 useLiveQuery 或事件驱动实现 UI 自动响应更新。（technical.storage_driver；来源 answer:simulated-answer-flash-vague-resume-20261004-04-1791127943827）
- 采用 React 19 + TypeScript 5.x + Vite 现代化工程架构作为轻量 Web 单页应用的核心开发基座。（technical.frontend_framework；来源 change-a28bf7b6-44c3-4461-be52-0f24fe6081f4-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-05-technical-1791129525256）
- 以浏览器原生 IndexedDB 作为本地数据唯一持久化存储介质，采用已确认决策 dec-22c4d85c-5b93-4fe2-846c-b47a8a67fbca 的 Dexie.js 响应式封装库管理对象仓库、强类型 Schema 与复合索引，辅以 StorageManager API 进行配额与用量感知。（technical.storage_baseline；来源 change-a28bf7b6-44c3-4461-be52-0f24fe6081f4-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-05-technical-1791129525256）
- 采用标准 JSON Schema v1 导出与强校验规范，结合 W3C File API（Blob 与 FileReader）实现纯客户端无后端依赖的导入导出，并在持久化元数据中维护 unbackedChangesCount 与 lastBackupAt 驱动温和防丢提醒。（technical.backup_format_and_verification；来源 change-a28bf7b6-44c3-4461-be52-0f24fe6081f4-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-05-technical-1791129525256）
- 采用 marked + DOMPurify 轻量安全组合作为便签详情与预览的 Markdown 编译与 XSS 消毒方案，配合 Prism.js 实现代码语法高亮。（technical.markdown_engine；来源 change-a28bf7b6-44c3-4461-be52-0f24fe6081f4-delivery-2:api-automated-acceptance-flash-vague-resume-20261004-05-technical-1791129525256）
- 采用 Vitest + React Testing Library + fake-indexeddb 构建端到端与单元测试体系。（delivery.test_framework；来源 change-9163513e-9744-4972-b64c-6bb5a56ce5f6-delivery-0:api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040）
- 采用按领域与特性模块解耦的工程目录架构（src/services, src/modules, src/components, src/hooks, src/types）。（delivery.code_organization；来源 change-9163513e-9744-4972-b64c-6bb5a56ce5f6-delivery-0:api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040）
- 在回收区便签超过 7 天保留期限时，您偏好哪种提示时机与永久删除触发机制？
回收区常驻提示横幅 + 用户主动确认一键清空（推荐）：在侧边栏“回收区”入口展示过期预警状态点；用户切换至回收区视图时，顶部常驻琥珀色提示横幅“有 X 条便签已超过 7 天保留期限”，提供【清空已过期便签】与【一键彻底清空】按钮，经二次确认弹窗后执行物理删除。（product.trash_expiry_behavior；来源 answer:simulated-answer-flash-vague-resume-20261005-06-1791131582735）
- 在全量 JSON 备份导出时，默认包含回收区暂存便签（完整保留 status='trashed' 与 trashedAt 时间戳），同时在导出面板提供【排除回收区便签】复选框开关供按需排除；导入时按原状态还原，若处于回收区且已超过 7 天，则在导入完成后立即纳入过期提示范围。（product.backup_trash_inclusion_policy；来源 change-65c5ee22-af96-4d2c-b6f2-d2b4e9126daf-delivery-1:api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046）
