# B vs E Manual Review

Run: `b-vs-e-smoke-1`. Do not treat this checklist as auto-scored.

# case-01

## Idea

我想做一个清理电脑空间的软件。

## B

**Tokens:** 26958 total; 19824 input.  
**Duration:** 25906 ms.  
**Prompt/context/user-input chars:** 1016 / 26 / 15.

**Confirmed**
- 目标是开发一款清理电脑存储空间的软件。

**Assumptions**
- 主开发与测试环境默认为 Windows 操作系统（匹配用户当前的运行环境）。
- 该软件为单机本地运行，不涉及云端存储、备份或云端后端服务。
- 目标用户为普通电脑用户，需要直观、低门槛的操作界面。

**Gaps**
- [critical] 清理范围与安全边界 (Scope & Safety): 用户仅提出“清理电脑空间”，但没有界定哪些文件可以被删除，哪些绝对不能动（如系统关键dll、未保存的文档等）。
- [high] 用户界面与交互形式 (UI/UX): 清理工具需要向用户清晰展示哪些文件被扫描出来，以及清理进度。需要确定是单键一键清理，还是分类勾选清理。
- [medium] 技术栈与打包体积 (Tech Stack): 不同的开发框架会带来截然不同的开发难度和包体大小。

**Conflicts**
- ‘最大化释放空间’与‘保障系统绝对安全’之间的冲突：深度清理（如注册表、Windows更新备份、系统还原点）能释放更多空间，但极易造成系统损坏或软件运行异常。

**Tensions**
- None

**Risks**
- 误删系统关键文件或用户尚未保存的重要文档，导致系统崩溃或数据丢失（高风险）。
- 清理操作（尤其是涉及删除文件和修改注册表）容易被主流杀毒软件误报为恶意软件或木马（中风险）。
- 若软件没有管理员权限（UAC），将无法扫描或清理系统级临时目录，导致清理不彻底（中风险）。

**Questions and recommendations**
- [high] 你希望这款软件主要在哪个操作系统上运行？ — Recommendation: Windows (推荐)
- [high] 你希望这款清理软件面向哪类目标用户，采用什么样的界面形式？ — Recommendation: GUI 图形界面 (推荐)
- [critical] 对于首个版本 (MVP)，你希望支持清理哪些类别的文件？ — Recommendation: 仅安全无风险文件 + 大文件扫描 (推荐)

**Overview updates**
- None

## E

**Tokens:** 23276 total; 20227 input.  
**Duration:** 16618 ms.  
**Prompt/context/user-input chars:** 1986 / 264 / 15.

**Confirmed**
- The user wants to develop a software application designed to clean up computer storage space.

**Assumptions**
- The software will run as a local desktop application (not a web or mobile application) to access local file systems.

**Gaps**
- [critical] Target Platform: We do not know which operating system the software needs to clean, which dictates the filesystem paths and API dependencies.
- [high] Cleanup Scope & Safety: Cleanup software ranges from simple temp-file deletion to aggressive registry and duplicate file analysis.

**Conflicts**
- None

**Tensions**
- Aggressive Cleanup vs. System Safety: Deleting more files frees up more space but increases the risk of deleting critical system/application files, leading to software malfunction or OS instability.

**Risks**
- Accidental deletion of user data or critical system files during cleanup processes.
- Elevated privilege requirement (e.g., Administrator/UAC on Windows, Root on Unix-like systems) needed to scan/delete system-level folders.

**Questions and recommendations**
- [critical] 您的清理软件主要针对哪个操作系统运行？ — Recommendation: (Recommended) Windows 操作系统

**Overview updates**
- Product Goal: A desktop storage cleanup utility to scan and remove unnecessary files.

## Reviewer checklist

- [ ] 是否重复询问已明确信息
- [ ] 是否发现真正关键 Gap
- [ ] 是否把风险误判成 Conflict
- [ ] 是否存在过度具体 Assumption
- [ ] 是否主动质疑不合理需求
- [ ] 推荐是否真正有价值
- [ ] 问题是否值得占用用户注意力
- [ ] 是否过早进入技术实现

# case-03

## Idea

我想为准备考研的中国大学生做一个 Web 学习计划工具，首版只支持中文和桌面浏览器。用户第一次进入时选择考试日期、科目、每周可学习时长和当前基础；系统按周生成可调整的复习计划。主页显示本周任务、完成进度和距离考试的倒计时；任务详情页可标记完成、延后或拆分。用户可以用邮箱注册，数据保存在云端并可在不同电脑登录。UI 希望安静、鼓励但不幼稚，类似日历和待办结合。MVP 不包含社交、课程市场、AI 聊天或移动端。我们先找 20 名同学试用，以连续两周完成任务的比例判断是否有价值。

## B

**Tokens:** 27979 total; 19968 input.  
**Duration:** 26406 ms.  
**Prompt/context/user-input chars:** 1240 / 250 / 239.

**Confirmed**
- Targeted at Chinese postgraduate entrance exam (考研) candidates.
- Language support: Chinese (Simplified) only.
- Platform support: Desktop web browsers only.
- Onboarding inputs: Exam date, chosen subjects, weekly study hours, and current foundation level.
- Core engine: System automatically generates a weekly-based review plan.
- Core feature: Generated plan must be adjustable by the user.
- Homepage components: Current week's tasks, weekly completion progress, and exam countdown.
- Task detail options: Mark as completed, postpone (延后), or split (拆分).
- Data storage: Email registration/login with cloud database synchronization.
- UI/UX theme: Quiet, encouraging, professional, combining calendar and to-do lists.
- Out of MVP Scope: Social features, course marketplace, AI chat, and mobile application/web version.
- Validation strategy: Test with 20 students, success measured by the proportion of students who continuously complete tasks for two weeks.

**Assumptions**
- Target users (college students) have regular access to a desktop or laptop computer during their daily study routine.
- The 20 trial users can be easily reached and assisted with email registration issues if needed.
- The exam syllabus and materials are already sourced by the users themselves; the tool acts only as a planner, not a content provider.
- A weekly granularity is sufficient for tracking progress without requiring hourly schedules in the MVP.
- A 2-week continuous task completion rate is a reliable early indicator of long-term product value.

**Gaps**
- [high] Mobile Accessibility / Responsive Layout: While a full mobile app is excluded from MVP, complete lack of mobile accessibility might prevent students from logging tasks completed while studying in libraries.
- [critical] Onboarding Plan Content / Syllabus Database: The generation logic for the plans is undefined. If the system doesn't know the syllabus of the subjects, it cannot generate tasks.
- [medium] Postponement Impact Logic: There is no rule for how a postponed task is rescheduled. Does it push everything back or compress the schedule?

**Conflicts**
- User Demographics vs. Authentication Choice: Email registration is chosen for ease of MVP development, but Chinese college students heavily prefer WeChat/SMS logins, which may affect trial onboarding completion.
- Desktop Only vs. Library Study Habit: 考研 students spend most of their study time in libraries or study rooms where opening a laptop just to check off a task is inconvenient compared to checking it on a mobile screen.

**Tensions**
- None

**Risks**
- Device Disconnect Risk (High): Students study in libraries where they might not open a laptop. Lacking a mobile-friendly view to log tasks could lead to under-reporting and artificial validation failure.
- Onboarding/Setup Friction (Medium): If the system cannot generate realistic tasks immediately, manually setting up a 6-month schedule on day one will cause users to drop out before the 2-week trial starts.
- Login Friction (Medium): Chinese college students rarely check email, leading to forgotten passwords, missed verification links, and activation drop-offs.
- Rescheduling Burnout (Medium): Continuous postponement without a smart consolidation logic will lead to an overwhelming backlog, making the UI feel stressful rather than quiet.

**Questions and recommendations**
- [critical] How should the system generate the initial study plan for the MVP? — Recommendation: Predefine standard weekly milestones for common public subjects (Math, English, Politics), and let users manually enter tasks for professional subjects.
- [high] How should the system handle rescheduled (postponed) tasks? — Recommendation: Move postponed tasks to a 'Backlog' or 'Inbox' for manual redistribution, showing a gentle warning if the backlog grows too large.
- [normal] What authentication method should be used for the 20-student trial? — Recommendation: Stick to Email registration for the 20-student MVP to bypass Chinese regulatory/corporate verification, adding direct onboarding support.

**Overview updates**
- None

## E

**Tokens:** 29751 total; 20368 input.  
**Duration:** 26780 ms.  
**Prompt/context/user-input chars:** 2210 / 488 / 239.

**Confirmed**
- 目标用户为备考研究生入学考试（考研）的中国大学生。
- 首版（MVP）仅支持桌面浏览器（Desktop Web）和中文界面。
- 首次进入流程：用户输入考试日期、选择科目、每周可学习时长、当前基础。
- 核心功能：系统按周生成可调整的复习计划。主页显示本周任务、进度及倒计时。任务详情页支持标记完成、延后或拆分。
- 账号与存储：使用邮箱注册，数据存储在云端，支持跨电脑登录同步。
- UI风格：安静、鼓励、不幼稚，日历与待办（To-Do）结合。
- 排除范围：MVP不包含社交、课程市场、AI聊天或移动端。
- 验证标准：寻找20名同学试用，以连续两周完成任务的比例评估产品价值。

**Assumptions**
- 科目选择仅限于考研常见公共课（政治、英语、数学）及通用的专业课类别，而非覆盖全国所有高校所有专业的细分专业课。
- 邮箱注册采用基础的账号密码方式，暂不需要复杂的第三方社交登录或短信验证码。
- 任务的拆分和延后完全由用户手动操作和确认，系统不自动进行复杂的跨周任务智能重排。

**Gaps**
- [critical] 复习计划生成算法与内容数据源: 用户输入『科目』和『当前基础』后，系统如何具体生成周任务？是否存在一个考研公共课知识点及建议用时的知识库？
- [high] 任务延后与拆分后的重排策略: 当用户在详情页操作『延后』或『拆分』任务时，系统需要明确这些变动如何传导并影响整体进度和倒计时。
- [medium] 科目与基础的输入颗粒度: 『当前基础』如何量化（如：四六级分数、期末绩点，或自我评估的百分比）？『科目』是否支持统考以外的自命题科目？

**Conflicts**
- None

**Tensions**
- 桌面端网页（Desktop Web）的物理访问限制与用户高频记录、查看任务需求之间的张力: 考研学生备考场景（图书馆、自习室）可能不方便随时使用电脑。如果只能在桌面浏览器上标记完成、延后或拆分，可能会导致用户数据更新延迟，从而影响验证核心价值（『连续两周完成任务』的比例）的准确性。
- 系统预设『生成计划』与考研专业课极高多样性（学校自命题）之间的张力: 全国硕士研究生招生考试中，专业课存在大量高校自主命题，大纲各异。系统若要为用户『生成复习计划』，难以全面覆盖这些特异性的专业课内容，导致部分用户的『生成计划』体验可能沦为纯手动的任务添加。

**Risks**
- 核心指标（连续两周完成任务）门槛过高导致MVP验证产生假阴性（即产品有价值，但因任务定得不合理或更新不便而未达到指标）。
- 缺乏防挫败机制：考研任务积压是常态，如果计划不断延后导致本周任务无限堆积，用户可能会产生畏难情绪而直接放弃（即『摆烂』）。
- 首版纯靠邮箱和密码登录，缺乏防作弊或账号共用限制（但在MVP阶段属于低风险，可暂时忽略）。

**Questions and recommendations**
- [critical] 系统如何根据用户选择的『科目』和『当前基础』生成复习计划？ — Recommendation: (推荐) 采用『标准公共课内置里程碑 + 专业课通用框架』的混合方案：针对考研人数最多的公共课（英语、政治、数学）内置主流的复习轮次与阶段任务模板；对于专业课，提供通用的复习时间切分模板（如基础期、强化期、冲刺期比例分配），并允许用户自行输入或调整具体任务。

**Overview updates**
- 产品定位：面向考研学生的安静、日历+待办结合的桌面Web复习规划工具，专注于首版价值验证。
- 验证方案：通过招募20名考研学生进行为期两周的试用，以『连续两周完成计划任务的比例』作为产品核心价值的衡量指标。
- 范围界定：MVP版本严格排除社交、课程市场、AI聊天以及移动端，确保敏捷开发与快速上线。

## Reviewer checklist

- [ ] 是否重复询问已明确信息
- [ ] 是否发现真正关键 Gap
- [ ] 是否把风险误判成 Conflict
- [ ] 是否存在过度具体 Assumption
- [ ] 是否主动质疑不合理需求
- [ ] 推荐是否真正有价值
- [ ] 问题是否值得占用用户注意力
- [ ] 是否过早进入技术实现

# case-05

## Idea

我想做一个个人知识库，必须完全离线，任何内容都不能离开用户电脑；同时用户换电脑后数据要自动同步，且不用用户做任何设置。

## B

**Tokens:** 26565 total; 19862 input.  
**Duration:** 26118 ms.  
**Prompt/context/user-input chars:** 1060 / 70 / 59.

**Confirmed**
- 项目目标是构建一个个人知识库。
- 知识库必须具备完全的离线使用能力。
- 数据需要能够同步到新电脑上。

**Assumptions**
- 用户对‘数据不能离开用户电脑’的核心诉求是隐私安全与数据控制权（即任何第三方不可知、不可控），而非绝对的物理断网。
- 用户更换电脑时，旧电脑在短期内依然可开机使用，或者用户能够将旧电脑的本地数据导出。
- 知识库以文本和中小型附件（如图片、PDF）为主，数据总体积通常在数 GB 以内，适合快速的网络或物理传输。

**Gaps**
- [critical] 数据传输与安全通道建立: 在不进行任何配置（如配对、扫码或登录）的情况下，无法建立安全的加密传输信道，局域网广播同步会带来严重的数据泄露风险。

**Conflicts**
- ‘完全离线、内容不离开电脑’与‘换电脑自动同步’存在物理冲突。数据若要到达新电脑，必须通过某种网络或物理介质离开原有电脑。
- ‘零设置’与‘数据安全性（隐私）’存在逻辑冲突。安全的数据传输必须建立在双向信任（如配对、登录、密钥交换）的基础上。如果完全‘零设置’，系统将无法区分新电脑与局域网内的恶意监听设备，导致极高的数据泄露风险。

**Tensions**
- None

**Risks**
- 【数据丢失风险】如果采用纯本地/局域网同步且旧电脑突然彻底损坏，在无任何云端备份的情况下，数据将永久丢失。
- 【数据泄露风险】如果为了追求‘零设置’而免去配对或身份验证，局域网内的其他设备可能会恶意伪装成‘新电脑’，从而轻易同步并窃取用户的全部个人知识库内容。

**Questions and recommendations**
- [critical] ‘数据完全不离机’与‘新机自动同步且零设置’在物理和安全逻辑上存在根本性冲突。为了实现数据同步，您倾向于采用哪种折中方案？ — Recommendation: (Recommended) 采用端到端加密（E2EE）云同步。

**Overview updates**
- None

## E

**Tokens:** 27672 total; 20248 input.  
**Duration:** 25383 ms.  
**Prompt/context/user-input chars:** 2030 / 308 / 59.

**Confirmed**
- 定位为个人知识库产品
- 核心安全红线：内容绝对私密且不能被未经授权的第三方获取
- 核心体验需求：更换电脑时数据能自动同步且无繁琐的手动配置

**Assumptions**
- 用户拥有多台可联网的个人设备（如工作电脑与个人电脑）
- 用户所谓的“不离开电脑”本质上是要求“数据绝对私密，不被任何第三方（包括软件开发商和云服务商）窥探”

**Gaps**
- [critical] 数据同步的物理与隐私边界: 由于这两个需求在绝对物理意义上是冲突的，必须先明确隐私与便利性的边界才能进行下一步设计。

**Conflicts**
- [critical] “完全离线且任何内容不离开电脑”与“换电脑数据自动同步且无任何设置”存在逻辑与物理冲突。: 如果数据完全不能离开电脑，那么新电脑在物理上无法获取数据。要实现同步，数据必须传输。若使用云端则数据离开了电脑；若使用局域网直连则数据离开了原电脑传输给新电脑；若使用物理介质则需要用户手动插拔，违背了“无任何设置/操作”的初衷。

**Tensions**
- 极致的隐私安全（物理隔离）与极致的无感用户体验（自动同步）之间的设计权衡。: 为了达到绝对的物理离线安全，通常需要牺牲跨设备同步的便利性；而为了实现完全无感的自动同步，通常需要引入网络传输或云端中介，这在用户心智上可能会挑战“绝对离线”的安全感。

**Risks**
- 在没有云端备份且用户未配置其他同步设备的情况下，一旦当前电脑损坏或丢失，数据将永久丢失。
- 如果采用纯局域网 P2P 同步，若两台电脑没有同时处于同一局域网且开机，同步将无法进行，导致两端数据不一致。

**Questions and recommendations**
- [critical] 当您提到“任何内容都不能离开用户电脑”与“换电脑自动同步且无需设置”时，我们面临一个物理上的同步冲突。为了解决这一冲突，您更倾向于以下哪种折中方案？ — Recommendation: (Recommended) 方案 1：采用端到端加密（E2EE）的云端自动同步。

**Overview updates**
- 项目定位：完全本地化的个人知识库，重点解决多设备零配置同步与绝对隐私的矛盾。

## Reviewer checklist

- [ ] 是否重复询问已明确信息
- [ ] 是否发现真正关键 Gap
- [ ] 是否把风险误判成 Conflict
- [ ] 是否存在过度具体 Assumption
- [ ] 是否主动质疑不合理需求
- [ ] 推荐是否真正有价值
- [ ] 问题是否值得占用用户注意力
- [ ] 是否过早进入技术实现