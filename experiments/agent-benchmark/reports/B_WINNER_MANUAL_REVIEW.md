# B Winner Manual Review

Run: b-winner-validation-1. Review notes are flags only, not automatic conclusions.

# case-01: vague-cleaner

## Idea

我想做一个清理电脑空间的软件。

## Confirmed

- The user wants to create a software application to clean up and optimize computer disk space.

## Assumptions

- The target operating system is Windows, as the user is currently on Windows.
- The software will have a Graphical User Interface (GUI) rather than a Command Line Interface (CLI) to make it user-friendly.
- Data safety is the highest priority; the tool will not delete any system-critical files or user documents without explicit permission.

## Gaps

- [critical] Safety & Deletion Protection: Deleting system files can break the OS if not guarded by a strict whitelist of safe zones or a blacklist of system folders.
- [high] Platform Compatibility: Disk APIs, temporary file paths, and registry/system caches are completely OS-specific.

## Conflicts

- Simple one-click cleaning (for non-technical users) vs. advanced visual disk analyzer (for power users): Attempting to build both for the MVP could bloat the scope and design phase.

## Risks / Tensions

- Accidental deletion of system registry keys or operating system files, rendering the computer unbootable.
- Permission errors resulting in crash or incomplete cleanups if the user does not run the program with administrator rights.
- Performance issues (high CPU/IO) during deep directory scanning, leading to system freeze or application crashes.

## Review Notes

- None

## Questions

- [critical] Which operating system(s) do you want this software to support?
  - Recommendation: (Recommended) Windows only
  - Reason: System APIs and temporary file paths are completely different on Windows, macOS, and Linux.
- [high] Who is the primary user and what is the preferred UI/UX style for the MVP?
  - Recommendation: (Recommended) Simple one-click cleaning
  - Reason: This determines whether we build a simple 'one-click clean' interface or a complex directory-size visualization tool.
- [normal] Do you have a preferred technology stack or programming language?
  - Recommendation: (Recommended) Tauri (Rust + HTML/JS/CSS)
  - Reason: Different frameworks have significant trade-offs in build size, system performance, memory usage, and development speed.

## Usage

- Tokens: input 19829, output 6839, thinking 5637, total 26668
- Duration: 25071 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-02: ai-expense-tracker

## Idea

我想做一个AI记账工具，让AI帮我自动分析每天的钱都花到哪里了。

## Confirmed

- 核心功能：利用 AI 自动分类并分析每日消费去向。
- 核心价值：解决传统记账工具需要手动分类、缺乏深度洞察的问题。

## Assumptions

- 用户主要在手机端进行日常记账操作，界面设计优先考虑移动端体验。
- 初始 MVP 版本定位为个人单账本使用，暂不提供家庭协同或多账本共享功能。
- 分类标准由 AI 初步判定，用户可进行手动微调，系统将学习并记忆用户的分类偏好。

## Gaps

- [high] 用户纠错与确认闭环: 原始构想强调'自动'，忽略了 AI 准确率无法达到100%时必须具备的人工纠错兜底机制。
- [medium] 本地与云端数据同步: 本地存储虽然隐私性高，但缺乏可靠的云端备份机制会导致糟糕的用户体验。

## Conflicts

- ‘无感/全自动’记账的理想与微信/支付宝数据接口封闭的冲突：必须依赖用户主动输入或手动上传截图。
- 高频高质的 AI 交互与低运营/API 成本之间的冲突。

## Risks / Tensions

- 财务隐私泄露风险：用户对将财务敏感信息发送给云端 AI 存在信任顾虑。
- AI 识别幻觉与误差：如误读口语中的金额或误判截图内容，需设计轻量纠错机制。
- 大模型调用运营成本过高：记账行为属于高频操作，若没有优化模型调用，成本会激增。

## Review Notes

- May be a Risk/Tension rather than strict conflict (manual review needed): ‘无感/全自动’记账的理想与微信/支付宝数据接口封闭的冲突：必须依赖用户主动输入或手动上传截图。

## Questions

- [high] 这款 AI 记账工具首选运行在什么平台上？
  - Recommendation: (推荐) 微信小程序 或 移动端网页 (Mobile Web)
  - Reason: 平台选型直接决定了开发成本、用户的触达路径，以及语音/相机等原生硬件功能的调用复杂度。
- [high] 您希望用户以什么方式输入记账信息？
  - Recommendation: (推荐) 混合模式：平时用对话（语音/文字）记账，报销或批量记账时用账单截图识别
  - Reason: 输入方式是记账工具最核心的交互入口，不同方式所需的 AI 处理模型（OCR、语音识别、NLP）和开发复杂度差异巨大。
- [high] 您对用户财务数据的隐私和存储方案有什么考量？
  - Recommendation: (推荐) 本地优先存储（如设备本地缓存），可选云端同步；AI 请求时进行隐私数据脱敏
  - Reason: 财务数据极其敏感，安全与便利（多端同步）是一对矛盾，需要明确侧重点。

## Usage

- Tokens: input 19848, output 8874, thinking 7360, total 28722
- Duration: 27707 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-03: complete-study-planner

## Idea

我想为准备考研的中国大学生做一个 Web 学习计划工具，首版只支持中文和桌面浏览器。用户第一次进入时选择考试日期、科目、每周可学习时长和当前基础；系统按周生成可调整的复习计划。主页显示本周任务、完成进度和距离考试的倒计时；任务详情页可标记完成、延后或拆分。用户可以用邮箱注册，数据保存在云端并可在不同电脑登录。UI 希望安静、鼓励但不幼稚，类似日历和待办结合。MVP 不包含社交、课程市场、AI 聊天或移动端。我们先找 20 名同学试用，以连续两周完成任务的比例判断是否有价值。

## Confirmed

- 目标用户为中国考研大学生，首版仅支持中文和桌面浏览器。
- 用户首次进入需要选择考试日期、科目、每周可学习时长和当前基础。
- 主页核心展示：本周任务、完成进度、考试倒计时。
- 任务交互：支持标记完成、延后、拆分。
- 技术形态：Web 端，邮箱注册，云端同步。
- 排除范围：不包含社交、课程市场、AI 聊天、移动端 App。
- 验证指标：20 名同学试用，以连续两周任务完成率作为核心价值衡量标准。
- 视觉风格：安静、鼓励、不幼稚，日历与待办结合。

## Assumptions

- 考试日期默认为每年 12 月底的全国硕士研究生统一招生考试（初试）时间。
- 用户基础（如“零基础”、“有一定基础”、“已过一遍”）仅影响计划初期的任务密度和难度斜率，不涉及复杂的个性化自适应诊断。
- MVP 采用单体 Web 应用架构，前端使用 React/Vue，后端使用 Node.js/Python 配合关系型数据库（如 PostgreSQL），部署在云端。
- 暂不提供第三方社交账号快捷登录（如微信），仅使用邮箱进行身份验证，以降低首版复杂度。

## Gaps

- [high] 移动端查看与打卡: 考研学生多在图书馆或自习室等非电脑环境学习，纯桌面端打卡会导致数据收集不准且用户体验脱节。
- [high] 科目知识库与大纲数据: 系统按周生成计划需要具体的任务内容。若无科目知识库（如英语单词量、数学章节），系统将无法生成实质性任务。
- [medium] 任务延期与重新平摊逻辑: 任务拆分或延后时，后续计划的承载力计算缺失。如果只是简单向后推，会造成后期计划超载崩溃。

## Conflicts

- 【核心冲突】“桌面浏览器限制”与“高频、即时打卡行为”之间的冲突。由于自习室/图书馆场景下电脑并不总是方便打开，这与需要“连续两周完成任务打卡”的核心验证指标相违背。

## Risks / Tensions

- 【核心风险】计划生成不够精准：如果生成的周计划与学生的实际复习节奏严重脱节，学生会迅速放弃，导致测试指标失败。
- 【设备脱节风险】纯桌面端限制：考研学生多数时间在自习室，仅支持桌面端会导致记录滞后或遗忘，无法真实反映连续完成率。
- 【任务雪崩风险】计划延后堆积：考研复习极易发生拖延，若无合理的削峰填谷机制，延后和拆分任务会快速拖垮后续计划，导致系统失效。

## Review Notes

- Possible implementation-specific assumption (manual review needed): MVP 采用单体 Web 应用架构，前端使用 React/Vue，后端使用 Node.js/Python 配合关系型数据库（如 PostgreSQL），部署在云端。

## Questions

- [critical] 系统如何生成具体的复习任务？是由系统内置考研大纲/主流教材（如肖秀荣政治、红宝书英语等）自动填充具体章节，还是仅根据用户输入的科目生成抽象的时间块（如“英语学习 2 小时”），由用户自己填入具体内容？
  - Recommendation: （推荐）系统内置少数通用热门科目（如英语一、政治）的具体章节计划模板，其他科目允许自定义任务。
  - Reason: 这直接决定了计划生成器（Generator）的复杂度与所需的数据支撑。如果是具体章节，我们需要准备庞大的科目任务库；如果是时间块，开发极快但对用户的实用价值较低。
- [high] 首版虽然只支持桌面浏览器，是否需要支持移动端浏览器自适应（Responsive Web），以便学生在自习室/图书馆用手机查看和标记任务？
  - Recommendation: （推荐）桌面端为全功能版，但移动端浏览器可以自适应访问主页以查看和打卡。
  - Reason: 考研学生的大部分学习时间在图书馆或自习室，不一定方便随时打开电脑。如果完全无法在手机上方便地查看和打卡，会严重影响“连续两周任务完成率”这一核心验证指标。
- [high] 当用户在任务详情页标记“延后”（Postpone）或“拆分”（Split）任务时，系统如何处理未完成的部分？
  - Recommendation: （推荐）顺延时自动平摊到后续所有周的每日/每周剩余额度中，重新平衡计划。
  - Reason: 考研复习计划极易产生堆积。如何调整后续计划是整个工具的核心体验所在。如果只是简单推迟，可能会导致后面的周任务像滚雪球一样越来越重，最终导致计划崩溃。

## Usage

- Tokens: input 11828, output 7245, thinking 5194, total 19073
- Duration: 27005 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-04: oversized-mvp

## Idea

我要第一版做一个健身平台：iOS、Android、Web、Windows 和 Apple Watch 都要支持；有 AI 私教视频、实时动作识别、饮食拍照、热量识别、课程商城、教练直播、好友排行榜、私信、支付、可穿戴设备同步、企业健康后台和 12 种语言。三个月上线。

## Confirmed

- 第一版（MVP）定位为健身平台。
- 需要支持 iOS, Android, Web, Windows 和 Apple Watch。
- 功能包含：AI私教视频、实时动作识别、饮食拍照、热量识别、课程商城、教练直播、好友排行榜、私信、支付、可穿戴设备同步、企业健康后台。
- 支持 12 种语言。
- 项目必须在 3 个月内上线。

## Assumptions

- 移动端（iOS和Android）是用户的核心运动跟练场景，Windows桌面端优先级最低。
- AI饮食拍照与热量识别首期使用云端第三方多模态大模型API进行分析，而不是自研模型。
- 实时动作识别使用端侧开源计算机视觉SDK（如MediaPipe）进行轻量化开发，以降低服务器延迟和带宽成本。
- 企业健康后台为Web端的HR/管理员管理面板，功能聚焦在员工活跃度报表和企业福利套餐配置。
- 多语言支持在代码中采用标准国际化（i18n）框架实现，由翻译服务商提供文案包导入。

## Gaps

- [critical] 范围与发布规划: 多平台同时开发和测试（尤其是Watch端和Windows端）开发量呈指数级上升，且许多功能（如直播、AI）本身就是大型技术专题。
- [high] AI技术选型与性能: 视频动作识别对实时性和准确率要求极高，第一版未明确技术方案和模型边界。
- [medium] 数据合规与健康隐私: 健身平台属于个人健康隐私数据高敏感区，第一版规划未明确隐私策略。

## Conflicts

- 时间与范围冲突：在3个月内同时开发5个平台（含Watch和Desktop）并实现AI识别、直播、商城、IM、企业后台等多达10余项重度复杂功能，极其不切实际，属于严重的过度规划（Over-scoping）。
- MVP定义冲突：MVP（最小可行产品）的核心是快速验证核心价值，而当前规划属于功能齐备的完整企业级平台，与“第一版（MVP）”的定位相违背。

## Risks / Tensions

- 由于严重过载的开发范围和极短的3个月工期，项目面临极高的延期和完全失败风险。
- 在手机、手表、网页和桌面端（Windows）同时适配AI实时视频动作识别，存在极高的跨平台技术风险和性能调优瓶颈。
- 教练直播和AI私教视频的实时传输和推理将产生高昂的服务器带宽与算力成本，对早期资金链形成压力。
- 在首版中仓促支持12种语言，容易导致大量的翻译错误、多语言排版重叠以及非主打市场的合规与测试缺失。

## Review Notes

- Possible implementation-specific assumption (manual review needed): 多语言支持在代码中采用标准国际化（i18n）框架实现，由翻译服务商提供文案包导入。

## Questions

- [critical] 为了保证3个月内顺利上线，我们是否可以分阶段发布，第一版（MVP）聚焦于核心平台和功能？
  - Recommendation: (推荐) 采用移动端先行战略（iOS + Android + Apple Watch），首版仅保留核心训练跟练、可穿戴同步和基础饮食记录，其余功能（AI动作识别、直播、Windows端、企业后台等）延入第二阶段。
  - Reason: 在3个月内同时开发iOS、Android、Web、Windows和Apple Watch，并包含AI、直播、商城、社交和企业后台，开发量极大，极易导致项目延期或交付质量低下。
- [high] AI动作识别和饮食热量识别的技术路线如何规划？
  - Recommendation: (推荐) 首版采用成熟的第三方成熟API（如Google Gemini Multimodal API进行食物热量估算，开源MediaPipe进行动作姿态检测），避免自主研发模型。
  - Reason: 从零训练高精度的动作识别和食物热量估算模型开发周期极长，无法在3个月内完成。
- [normal] 这12种语言的具体语种以及首发的目标市场是哪里？
  - Recommendation: (推荐) 首版仅支持主打市场的1-2种语言（例如中/英），但在代码层面做好国际化（i18n）架构设计，后续在2-3周内逐步解锁其余语种。
  - Reason: 目标市场直接决定了支付网关（如Stripe/App Store IAP/支付宝/微信）、合规政策（如GDPR）以及服务器的部署节点，且12种语言的UI适配和内容翻译在首版中工作量巨大。

## Usage

- Tokens: input 41075, output 8262, thinking 6220, total 49337
- Duration: 27507 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-05: offline-sync-conflict

## Idea

我想做一个个人知识库，必须完全离线，任何内容都不能离开用户电脑；同时用户换电脑后数据要自动同步，且不用用户做任何设置。

## Confirmed

- 应用必须是完全离线的个人知识库 (Personal Knowledge Base)。
- 任何内容都不能离开用户的电脑 (No data can leave the user's computer via app-managed servers)。
- 用户更换电脑后，数据需要自动同步 (Data must sync automatically when switching computers)。
- 同步过程不需要用户做任何设置 (Zero configuration required from the user within the app)。

## Assumptions

- 用户更换的电脑运行的是主流桌面操作系统（Windows 或 macOS）。
- 所谓的“完全离线，内容不离开电脑”，其核心诉求是数据隐私安全，不希望数据被应用开发者的服务器收集或明文泄露。
- 目标用户是注重隐私、具有一定技术背景或日常使用桌面端电脑的知识工作者。
- 软件不需要支持多人协同编辑，仅限单个用户的多设备或换机同步。

## Gaps

- [critical] 同步架构与隐私诉求的冲突: 完全离线且数据不离开电脑，与多端自动同步在物理上是矛盾的。必须在此处做方案权衡。
- [medium] 目标运行平台: 不同操作系统对本地文件系统的 API 支持和沙盒限制不同，会直接影响如何利用系统同步盘。
- [medium] 数据存储格式: Markdown 文件对云盘同步非常友好，而 SQLite 数据库文件极易在云盘同步中损坏。

## Conflicts

- 完全离线且数据不离开电脑 vs 换电脑自动同步：同步需要数据在设备间流动，物理上必须妥协为“数据只保存在用户可控的存储中（如其云盘或局域网）”。
- 自动同步 vs 不做任何设置：跨设备安全同步需要身份认证/配对，完全不做任何设置会导致数据安全性极低（如局域网内广播暴露数据）。

## Risks / Tensions

- 多端同时修改导致的文件版本冲突和数据丢失风险。
- 若使用 P2P 局域网同步且完全无配置，可能存在局域网内其他设备未授权接入的安全风险。
- 云盘同步延迟或冲突文件在本地生成时，应用可能无法及时感知，导致数据不一致。
- 如果使用单一数据库文件（如 SQLite），云盘同步极易导致数据库文件损坏。

## Review Notes

- May be a Risk/Tension rather than strict conflict (manual review needed): 自动同步 vs 不做任何设置：跨设备安全同步需要身份认证/配对，完全不做任何设置会导致数据安全性极低（如局域网内广播暴露数据）。

## Questions

- [critical] 如何权衡“数据完全不离机”与“免配置自动同步”之间的技术冲突？
  - Recommendation: (Recommended) 方案 A：使用系统级同步盘（iCloud Drive / OneDrive）。应用完全离线且免配置，直接读写本地的云盘同步目录，数据随系统账号自动同步。
  - Reason: 完全离线与跨设备自动同步物理上是冲突的，需要确定用户的真实底线是“不通过应用开发者的云服务”还是“绝对不连接互联网”。
- [normal] 该知识库需要支持哪些操作系统平台？
  - Recommendation: (Recommended) 仅支持主流桌面端（macOS 与 Windows）。
  - Reason: 操作系统的不同会极大影响如何获取本地同步目录以及应用的开发框架选择。
- [normal] 知识库的数据应该以何种格式在本地存储？
  - Recommendation: (Recommended) 本地 Markdown 文件夹（纯文本文件树）。
  - Reason: 存储格式直接决定了在发生同步冲突时的恢复能力以及数据的通用性。

## Usage

- Tokens: input 19860, output 8826, thinking 7100, total 28686
- Duration: 27683 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-06: windows-desktop-inventory

## Idea

为小型维修店做一个 Windows 桌面库存和维修单工具。店员离线录入配件、客户和维修单，老板每天导出 Excel 看库存和收入；一台前台电脑先用，未来可能加局域网共享。

## Confirmed

- 目标平台为 Windows 桌面应用 (Windows Desktop Application)
- 支持完全离线运行，日常录入无需网络连接 (Fully offline operation support)
- 包含配件库存管理、客户管理、维修单管理三大核心模块 (Core modules: Inventory, Customers, Repair Orders)
- 老板需每日导出包含库存和收入数据的 Excel 报表 (Daily Excel export for inventory and revenue)
- 首期部署为前台单机版，但需预留局域网共享的设计空间 (Single PC initially, with extensibility for LAN sharing)

## Assumptions

- 运行环境：目标 Windows 系统为 Windows 10 或 Windows 11，不兼容 XP/7 等老旧系统 (Target Windows 10/11)
- 数据规模：小型维修店日均维修单量小于 50 笔，库存配件小于 5000 种，本地数据库性能无压力 (Small data volume, under 50 orders/day, under 5000 parts)
- 并发访问：首期仅有一台电脑，不存在多用户并发读写数据库的冲突问题 (Single-user execution in Phase 1, no concurrency issues)
- 数据敏感性：店员无需查看进货价格或总收入，财务明细仅老板可接触 (Clerks don't need access to cost price or total revenue)

## Gaps

- [high] 数据备份与防灾 (Data Backup & Disaster Recovery): 用户想法中未提及任何数据备份机制。 (No backup mechanism mentioned in original idea)
- [medium] 权限与数据安全 (Permissions & Data Security): 店员与老板共享同一台电脑操作，没有提及账户隔离与权限限制。 (Single shared computer with no user/role isolation mentioned)
- [low] 单据流转与物理打印 (Receipt Printing & Barcode Scanning): 维修行业通常需要给客户提供实体接机单，并在修好后打印结算小票。 (Normal repair shops require physical receipts/tags)

## Conflicts

- 『完全离线/单机版 SQLite』与『未来局域网共享』的冲突：SQLite 并不擅长处理跨网络文件的多客户端并发写入。如果未来需要多台电脑同时录入，必须将架构重构为 C/S 模式（如一台电脑跑 PostgreSQL/SQL Server，或跑一个本地 Web API 服务），这会增加前期的设计复杂度或后期的迁移成本。 ('Offline Single-User SQLite' vs 'Concurrent LAN Sharing' conflict)

## Risks / Tensions

- 单点故障与数据丢失风险：若前台电脑硬盘损坏或中病毒，由于是完全离线单机版，所有客户和维修历史将永久丢失 (Single point of failure: complete data loss on hardware crash)
- 共享升级时的技术债务：若前期直接通过局域网共享 SQLite file，极易在未来多机并发写入时造成数据库损坏和锁冲突 (SQLite corruption risk under multi-user LAN file sharing)
- 财务数据泄露：若无本地登录权限控制，店员可直接查看或篡改老板的收入报表以及配件成本 (Financial data manipulation/leak without local access control)
- 人工对账错误：若 Excel 导出模板没有严格定义，老板在多店或跨天手动对账时可能出现数据不一致 (Manual accounting errors due to loose Excel report schema)

## Review Notes

- Possible implementation-specific assumption (manual review needed): 数据规模：小型维修店日均维修单量小于 50 笔，库存配件小于 5000 种，本地数据库性能无压力 (Small data volume, under 50 orders/day, under 5000 parts)
- Possible implementation-specific assumption (manual review needed): 并发访问：首期仅有一台电脑，不存在多用户并发读写数据库的冲突问题 (Single-user execution in Phase 1, no concurrency issues)

## Questions

- [high] 关于未来『局域网共享』，您希望以哪种方式实现多台电脑协同？
  - Recommendation: (Recommended) 方案 A：首期使用单机 SQLite，但代码架构上对数据访问层进行抽象，未来只需在局域网主电脑上运行一个轻量级 API 服务进程，其他客户端通过网络访问该服务。
  - Reason: SQLite 局限于单机运行，跨局域网直接共享文件极易损坏。了解您的预期有助于我们在前期设计中预留合适的接口抽象，避免未来推倒重来。
- [high] 系统完全离线运行，一旦电脑损坏数据将无法恢复。您希望采用什么样的数据备份方案？
  - Recommendation: (Recommended) 方案 A：软件在每日首次启动或关闭时，自动将数据库备份到另一个本地盘符或检测到的外接 U 盘中。
  - Reason: 本地单机系统的最大痛点是硬件故障导致的数据丢失。提供自动化的本地/半离线备份可以大幅降低风险。
- [high] 前台电脑由店员和老板共同使用，是否需要实现登录账号与权限隔离？
  - Recommendation: (Recommended) 方案 A：设立简单的本地用户登录系统，区分『店员』与『老板/管理员』角色。店员只能看日常业务，老板才能看营业报表和导出 Excel。
  - Reason: 店员日常录入配件和维修单，老板需要看收入。如果不做限制，店员可以直接查看或修改敏感的财务报表和配件进价。
- [normal] 维修单业务流程中，是否需要打印实体单据（如给顾客的接机凭证）或使用扫码枪？
  - Recommendation: (Recommended) 方案 A：支持导出/打印 A4 或 A5 规格的标准 PDF 格式维修单（使用普通激光打印机），暂不支持扫码枪。
  - Reason: 许多维修店需要打印接机单让客户签字，修好后打印结算单；配件出入库也可能用到扫码枪。这决定了是否需要集成外设驱动和特定的页面版式。

## Usage

- Tokens: input 19876, output 13675, thinking 11012, total 33551
- Duration: 32712 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-07: agency-saas

## Idea

我想做一个给小型营销代理商使用的 Web SaaS，把客户项目、内容日历、审批意见和月度报告放在一起。代理商按团队订阅，客户只能看到并评论自己项目的内容。

## Confirmed

- 面向小型营销代理商的 Web SaaS，以团队/机构（Agency Team）为单位进行订阅。
- 核心模块包含：客户项目管理、内容日历（Content Calendar）、审批/意见反馈系统、月度报告（Monthly Reports）。
- 严格的客户数据隔离：客户只能看到并评论属于自己项目的内容，无法查看其他客户的数据。

## Assumptions

- 产品首期采用 Web 端响应式设计（Mobile-friendly Web），暂不开发原生移动 App。
- 内容日历主要用于规划、协作与审批流流转，不包含社交媒体平台的直接 API 自动发布（Auto-publishing）。
- 月度报告采用手动上传文件或在线富文本编辑排版的方式，而非完全自动拉取第三方广告/社媒数据生成。
- 系统采用多租户（Multi-tenant）架构，租户级别为代理商团队，下设代理商管理员、创作者和客户成员等不同角色。

## Gaps

- [high] 通知与提醒机制: 用户想法中未提及如何通知客户有新内容需要审批，以及如何通知代理商有新意见反馈。
- [medium] 报告数据来源: 未明确月度报告的数据来源是自动对接平台集成，还是由代理商人工录入/上传。

## Conflicts

- 全功能 MVP 与快速上线的冲突：在一个工具中同时解决项目、日历、审批、报告，相当于四个独立模块的集成，与小团队快速验证 MVP 的目标存在冲突，容易导致开发周期过长。

## Risks / Tensions

- 越权漏洞导致客户数据泄露：由于系统采用多租户且包含敏感客户数据，若权限控制逻辑（ACL/RBAC）出现漏洞，可能导致客户 A 看到客户 B 的项目，造成严重商业纠纷。
- MVP 范围过大导致开发周期失控：同时开发项目、日历、审批和报告四个复杂模块，容易导致 MVP 周期拉得太长，建议在首期对日历和报告功能进行极致简化。
- 客户使用意愿低：如果审批和查看流程对客户来说过于繁琐，客户可能会拒绝使用，继续使用微信沟通，导致 SaaS 失去其核心协同价值。

## Review Notes

- None

## Questions

- [high] 对于“内容日历”，我们是否需要对接社交媒体平台（如微信公众号、小红书、抖音）的 API 实现一键发布，还是仅将其作为内部协作和客户确认的工具？
  - Recommendation: (推荐) 仅作为协作与审批工具，审批通过后由代理商手动发布。
  - Reason: 对接第三方平台 API 会引入极大的接口变动风险和开发工作量，且许多平台对第三方 API 的权限审核非常严格。
- [high] “月度报告”模块，您期望的实现方式是哪一种？
  - Recommendation: (推荐) 支持代理商手动上传报告文件（如 PDF/PPT）或提供富文本编辑器供代理商手动录入关键指标。
  - Reason: 月度报告如果需要自动抓取各渠道的广告或运营数据，技术实现极为复杂；如果是文件上传或在线编辑，则简单得多。
- [normal] 客户（Client）查看和评论时，需要强制注册/登录账号吗？
  - Recommendation: (推荐) 支持代理商生成带有“有效期 + 密码/验证码”的安全免登录分享链接，客户通过链接直接查看并评论。
  - Reason: 客户的使用门槛是代理商能否成功推行该 SaaS 的关键。强制注册可能导致客户反感，而免登录需要实现安全的防泄露访问机制。

## Usage

- Tokens: input 19866, output 6699, thinking 5124, total 26565
- Duration: 24054 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-08: local-first-notes

## Idea

我想做一个 local-first 的团队会议笔记应用。笔记默认存在本机，没网也可编辑；恢复网络后团队成员要看到合并后的内容，并且不能轻易覆盖别人的修改。

## Confirmed

- The application is a team meeting notes application.
- The application must be local-first, default storing data locally.
- The application must support offline editing.
- Upon reconnecting, offline modifications must sync and merge with team members' content.
- The sync process must not easily overwrite others' changes.

## Assumptions

- The primary platform is Web/Desktop (laptops/desktops) since meeting notes are typically typed.
- Meeting notes contain rich text (paragraphs, headings, lists, tasks) rather than heavy binary attachments like video or long audio in the MVP.
- Synchronization happens via the internet using a centralized relay/backup database when online, rather than P2P local network discovery.
- A simple shared workspace/document model is sufficient for the MVP instead of fine-grained role-based access control.

## Gaps

- [medium] Conflict Resolution UX: CRDTs merge text cleanly at the byte level, but semantic changes may still clash (e.g., two people editing the same sentence).
- [high] Offline Authorization Policies: Local-first systems struggle with instant revocation without online validation.

## Conflicts

- Offline Edit Freedom vs Strict Access Control: Ensuring users can edit offline conflicts with preventing unauthorized edits in real-time.
- Automatic Merge vs Content Coherence: Automatically merging text ensures no overwrites but can lead to unreadable sentences if edits overlap closely.

## Risks / Tensions

- CRDT history state bloat over time leading to high memory usage and slow loading on local client devices.
- Security vulnerabilities where offline edits from unauthorized/revoked users are merged into the document because verification can only happen after reconnection.
- Coherence issues where automated character-by-character merging results in grammatically incorrect or overlapping sentences.

## Review Notes

- None

## Questions

- [critical] How should conflict resolution behave when offline edits overlap? Do you want seamless automatic merging (like Google Docs) or a visual version comparison/approval flow?
  - Recommendation: (Recommended) Seamless automatic merging (CRDT-based) with a 'Version History' panel to inspect and restore past changes.
  - Reason: Determines the synchronization and data structures (CRDTs vs custom version logs).
- [high] Where should the synchronization occur? Over the public internet via a secure cloud coordinator, or locally via peer-to-peer (LAN/Wi-Fi) without internet?
  - Recommendation: (Recommended) Centralized secure cloud relay (e.g., WebSocket sync server) with local caching.
  - Reason: Defines network requirements and connection reliability.

## Usage

- Tokens: input 19863, output 6904, thinking 5722, total 26767
- Duration: 22903 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-09: password-manager

## Idea

我想做一个密码管理器，可以保存网站账号、密码、信用卡信息和安全笔记，还能自动填充；支持 Windows、浏览器插件和手机，并在设备间同步。

## Confirmed

- 数据存储支持：保存网站账号、密码、信用卡信息和安全笔记。
- 核心交互：支持在网页/应用表单中自动填充凭证（Auto-fill）。
- 目标平台：支持 Windows 桌面端、浏览器插件和手机端（iOS/Android）。
- 核心功能：支持多设备间的数据同步。

## Assumptions

- 手机端指代同时支持 iOS 和 Android 两个主流操作系统。
- 浏览器插件首要支持 Chromium 内核浏览器（如 Chrome, Edge），Firefox 等其他浏览器视进度兼容。
- 系统基于“零知识安全模型”（Zero-Knowledge），即所有解密和加密操作均在客户端本地进行，服务器不掌握主密码或解密后的明文数据。
- 初期暂不考虑团队共享、组织管理等多用户协作功能，仅关注单用户的多设备同步。

## Gaps

- [critical] 加密与密钥管理架构 (Cryptography & Key Management): 用户想法仅提及‘保存和同步’，但未规定任何加密协议与密钥推导标准，这是安全类软件最核心的基石。
- [high] 设备同步协议与冲突解决机制 (Sync Protocol & Conflict Resolution): 设备间同步若无明确的设计（如基于时间戳的版本控制或 CRDT），多设备同时离线修改会导致数据覆盖或丢失。
- [medium] 离线访问支持 (Offline Access Support): 未明确在没有网络连接的情况下，各客户端是否能使用本地缓存的加密数据库解锁和查询密码。
- [medium] 主密码找回与紧急恢复 (Account Recovery): 零知识架构下，服务器无法帮用户重置密码。用户遗忘主密码时的恢复流程尚未定义。

## Conflicts

- 【多端覆盖 vs 快速交付】用户期望同时支持 Windows、浏览器插件、手机端并实现同步，这与快速验证概念（MVP）相冲突。四端并进极易导致项目周期过长甚至烂尾。
- 【零知识安全 vs 云端同步便利性】完全的客户端零知识解密意味着所有冲突合并逻辑都必须在客户端进行（服务器无法解密数据进行合并），增加了同步协议的设计复杂度。

## Risks / Tensions

- 【高风险】安全漏洞：任何加密协议实现缺陷或内存残留都有可能导致用户密码泄露，带来灾难性的信任危机。
- 【高风险】MVP 范围过大：同时开发 Windows 客户端、手机 App、浏览器插件及同步后端，会使首期开发和测试周期极其漫长，难以快速交付。
- 【中风险】多端同步冲突：在离线或弱网下，多端并发修改同一凭证，如果同步冲突处理不当会导致数据被覆盖或丢失。
- 【中风险】平台适配与自动填充维护成本：Windows 凭证提供程序和手机系统的安全自动填充 API 经常随系统版本更新而变化，维护成本高。

## Review Notes

- May be a Risk/Tension rather than strict conflict (manual review needed): 【零知识安全 vs 云端同步便利性】完全的客户端零知识解密意味着所有冲突合并逻辑都必须在客户端进行（服务器无法解密数据进行合并），增加了同步协议的设计复杂度。

## Questions

- [high] 首期 MVP（最简可行产品）您倾向于聚焦在哪些平台？目前的设想（Windows + 插件 + 手机 + 同步）范围很大，建议分阶段交付。
  - Recommendation: (Recommended) 第一阶段：浏览器插件 + 基础同步服务器
  - Reason: 多平台并行开发难度极高，分阶段能以最快速度让您用上可用的产品并收集反馈。
- [high] 设备间的数据同步，您倾向于哪种托管与同步模式？
  - Recommendation: (Recommended) 自建零知识（E2EE）同步后台，支持 Docker 自托管
  - Reason: 这决定了后端的开发工作量、服务器成本以及用户隐私控制程度。
- [normal] 在零知识安全模型下，若用户遗忘主密码，系统应采用何种账号恢复策略？
  - Recommendation: (Recommended) 注册时本地生成并下载「离线紧急恢复密钥」
  - Reason: 在零知识架构中，服务器不持有任何密钥，因此绝对无法在后台重置密码，必须提前确立恢复方案。

## Usage

- Tokens: input 19855, output 10740, thinking 8713, total 30595
- Duration: 28446 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现

# case-10: delegated-decisions

## Idea

我想做一个给自由职业设计师记录项目时间的小网页：开始/暂停计时、按客户查看本周工时、导出 CSV。先做桌面浏览器。配色、空状态文案和其他不重要的东西你帮我决定，但重要的产品方向请明确告诉我需要确认。

## Confirmed

- 目标用户：自由职业设计师
- 首期目标平台：桌面端浏览器
- 核心计时功能：支持计时器的开始和暂停
- 核心统计展示：按客户维度查看本周累计工时
- 核心数据处理：支持将工时数据导出为 CSV 文件
- 非核心视觉与文案（如配色、空状态占位图/文案）授权 AI 自主决定

## Assumptions

- 自然周定义：本周工时默认按周一至周日计算
- 无需用户登录：MVP 阶段不需要账号注册、登录或第三方社交登录
- 单计时器原则：同一时间只允许启动一个计时器，启动新计时器会自动暂停当前计时器
- 视觉风格设定：采用适合设计师的现代、极简、高质感色调（如暗色/亮色中性灰，搭配亮色单色点缀）

## Gaps

- [medium] 工时纠错机制: 设计师在忙碌中经常忘记点击开始或结束计时，如果不能手动补录或修改，系统将失去实用价值。
- [high] 数据丢失预防: 浏览器 LocalStorage 非常容易被误清理（如清理历史记录、隐私模式运行等）。
- [medium] 工时组织维度: 设计师的计费往往细化到具体项目，而非仅仅是一个宽泛的客户。

## Conflicts

- 极简本地存储与数据安全性的冲突：为了不上后端而选择本地存储，但本地存储又无法提供安全的数据持久化与多端同步

## Risks / Tensions

- 数据丢失风险：若使用 LocalStorage 且用户清理浏览器缓存/隐私数据，所有历史工时将永久丢失
- 浏览器异常关闭风险：如果用户直接关闭浏览器或电脑断电，正在运行的计时器数据可能损坏或丢失
- 周统计跨时区问题：若用户跨时区工作，按周统计可能会产生边界时间偏差

## Review Notes

- May be a Risk/Tension rather than strict conflict (manual review needed): 极简本地存储与数据安全性的冲突：为了不上后端而选择本地存储，但本地存储又无法提供安全的数据持久化与多端同步

## Questions

- [critical] 数据存储方案：你希望工时数据保存在哪里？
  - Recommendation: (Recommended) 纯本地存储 + CSV 导出备份
  - Reason: 作为自由职业者，工时数据是你的计费依据。保存在浏览器本地（无需服务器）开发最快且免费，但一旦清理浏览器缓存数据就会丢失；保存在云端需要引入账号系统，开发成本会增加。
- [high] 工时漏记与纠错：如果忘记开关计时器，你需要手动修改或补录工时吗？
  - Recommendation: (Recommended) 支持手动补录与对历史工时进行编辑
  - Reason: 实际使用中，漏记、多记是极高频发生的场景。
- [normal] 工时层级结构：你希望如何组织你的时间记录？
  - Recommendation: (Recommended) 客户 - 项目双层结构
  - Reason: 自由职业设计师通常会为一个客户同时进行多个不同的项目（如官网设计、海报设计等），单纯按客户分类可能会混淆。

## Usage

- Tokens: input 19883, output 7622, thinking 6099, total 27505
- Duration: 24298 ms
- Structured success: true

## Reviewer Checklist

- [ ] 是否遗漏关键 Gap
- [ ] 是否重复询问
- [ ] 是否过度 Assumption
- [ ] Conflict 是否准确
- [ ] 是否主动质疑
- [ ] 推荐是否有价值
- [ ] 是否问题过多
- [ ] 是否过早进入技术实现