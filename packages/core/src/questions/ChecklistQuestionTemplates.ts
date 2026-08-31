import type { GapItem, QuestionOption } from '@project-architect/contracts';

export interface ChecklistQuestionTemplate {
  question: (gap: GapItem) => string;
  reason: (gap: GapItem) => string;
  options: QuestionOption[];
  recommendedOptionKey?: string;
}

function normalizeTemplateKey(rawKey: string): string {
  let k = rawKey.trim().toLowerCase();
  if (k.startsWith('checklist:')) {
    k = k.slice('checklist:'.length);
  }
  if (k.startsWith('chk-')) {
    k = k.slice('chk-'.length);
  }

  // 1. Direct template match
  if (ChecklistQuestionTemplates[k]) {
    return k;
  }

  const areaMapping: Record<string, string> = {
    target_user: 'univ-target-user',
    target_users: 'univ-target-user',
    target_audience: 'univ-target-user',
    'target_user:primary_audience': 'univ-target-user',
    mvp_scope: 'univ-mvp-boundary',
    scope: 'univ-mvp-boundary',
    'mvp_scope:core_boundary': 'univ-mvp-boundary',
    core_features: 'univ-core-features',
    core_feature: 'univ-core-features',
    features: 'univ-core-features',
    capabilities: 'univ-core-features',
    user_flows: 'univ-primary-flow',
    user_flow: 'univ-primary-flow',
    primary_flow: 'univ-primary-flow',
    flows: 'univ-primary-flow',
    page_structure: 'univ-page-structure',
    pages: 'univ-page-structure',
    navigation: 'univ-page-structure',
    ux_ui_direction: 'univ-ux-ui-direction',
    ux_ui: 'univ-ux-ui-direction',
    user_interface: 'univ-ux-ui-direction',
    design_direction: 'univ-ux-ui-direction',
    technical_boundary: 'univ-platform-choice',
    technical_constraints: 'univ-platform-choice',
    trust_safety: 'localfirst-zero-server-dependency',
    security_boundary: 'localfirst-zero-server-dependency',
    delivery_plan: 'univ-success-signal',
    acceptance: 'univ-success-signal',
    milestones: 'univ-success-signal',
    success_signal: 'univ-success-signal',
  };

  const mapped = areaMapping[k];
  if (mapped && ChecklistQuestionTemplates[mapped]) {
    return mapped;
  }
  return k;
}

export const ChecklistQuestionTemplates: Record<string, ChecklistQuestionTemplate> = {
  // 1. Platform Choice
  'univ-platform-choice': {
    question: (_gap) => '首发版本优先面向哪个运行平台？',
    reason: (_gap) => '不同平台的交互范式、底层系统 API 与分发渠道差异巨大，需优先确定首发重点。',
    recommendedOptionKey: 'windows',
    options: [
      {
        key: 'windows',
        label: 'Windows 桌面原生应用',
        gain: '深度利用本地文件系统与高性能原生 API，支持离线运行',
        sacrifice: '首发版本无法直接在 Web 浏览器或 macOS 环境下使用',
        impact: '深度利用本地文件系统与系统 API，体验流畅，但无法直接在 Web 或 macOS 运行。',
        tradeoffs: '获得最高系统性能与离线控制力，牺牲跨平台灵活性。',
        reversibility: 'moderate',
      },
      {
        key: 'web',
        label: 'Web 浏览器网页端',
        gain: '免安装、随时随地访问，用户触达门槛最低',
        sacrifice: '受浏览器沙箱严格限制，无法自由读写本地任意磁盘文件',
        impact: '免安装且跨平台门槛最低，但受浏览器沙箱限制，无法自由访问本地任意文件。',
        tradeoffs: '获得最高分发效率与多端访问便利，牺牲深度本地系统权限。',
        reversibility: 'moderate',
      },
      {
        key: 'cross_platform',
        label: '跨平台桌面端 (Windows/macOS)',
        gain: '一套代码覆盖主流桌面操作系统生态',
        sacrifice: '安装包体积偏大，需要多环境构建、打包与代码签名测试',
        impact: '一次构建覆盖主流操作系统，但安装包体积较大且需要多平台适配与签名测试。',
        tradeoffs: '获得更广泛受众，增加打包分发与环境调试负担。',
        reversibility: 'moderate',
      },
    ],
  },

  // 2. Local-first Data Ownership
  'localfirst-ownership': {
    question: (_gap) => '用户数据在本地如何保存并确保完全所有权？',
    reason: (_gap) => '本地优先的核心是数据属于用户，底层存储格式直接决定透明度与导出迁移体验。',
    recommendedOptionKey: 'plain_files',
    options: [
      {
        key: 'plain_files',
        label: '标准可读文件 (Markdown/JSON)',
        gain: '透明度最高，用户可用任何第三方文本编辑器直接查看与备份',
        sacrifice: '多文件关系型复杂关联查询性能低于数据库',
        impact: '文件直接存放在用户磁盘目录，可使用外部编辑器自由查看与修改，但处理复杂关系型检索性能较低。',
        tradeoffs: '最大化透明度与防厂商锁定，放弃数据库高级索引能力。',
        reversibility: 'easy',
      },
      {
        key: 'embedded_db_with_export',
        label: '应用管理格式 (SQLite) 并提供完整导出',
        gain: '单机查询性能极高，内置 ACID 事务保障数据不损坏',
        sacrifice: '用户无法用文本编辑器直读底层文件，必须依赖应用提供的导出功能',
        impact: '本地数据库支持极速全文检索与复杂查询，但用户无法用普通记事本直接修改底层文件。',
        tradeoffs: '提升单机查询性能与事务安全性，需额外实现导入导出流程。',
        reversibility: 'moderate',
      },
    ],
  },

  // 3. MVP Scope Boundary
  'univ-mvp-boundary': {
    question: (_gap) => '首发版本的功能边界应如何取舍？',
    reason: (_gap) => '范围过大会导致交付严重拖延与架构返工，需明确首发核心与延后特性的界限。',
    recommendedOptionKey: 'lean_core',
    options: [
      {
        key: 'lean_core',
        label: '严格聚焦单一核心痛点闭环',
        gain: '以最小投入最快交付可验证的产品雏形，架构清晰易测试',
        sacrifice: '放弃周边边缘特性的便利性，部分操作需手动配合',
        impact: '砍掉周边辅助功能，以最小投入最快验证核心价值，但部分非核心场景需手动配合。',
        tradeoffs: '交付时间最短且架构清晰，放弃周边辅助功能的便利性。',
        reversibility: 'easy',
      },
      {
        key: 'broad_features',
        label: '覆盖上下游完整配套工具链',
        gain: '提供一站式开箱即用体验，满足端到端全套诉求',
        sacrifice: '开发周期成倍增加，测试与首发验证风险显著提升',
        impact: '提供一站式完整开箱体验，但开发周期成倍增加，首发验证风险显著提高。',
        tradeoffs: '用户体验更完整，但首发版本返工成本极高。',
        reversibility: 'hard',
      },
    ],
  },

  // 4. Primary Flow
  'univ-primary-flow': {
    question: (_gap) => '用户使用该产品的端到端核心操作路径是怎样的？',
    reason: (_gap) => '核心主流程决定了页面的信息架构、导航方式与组件交互层级。',
    recommendedOptionKey: 'guided_steps',
    options: [
      {
        key: 'guided_steps',
        label: '向导式逐步引导流程 (Step-by-step)',
        gain: '步骤清晰、操作心智负担低，新手不易出错',
        sacrifice: '操作路径较为线性，熟练用户批量处理时自由度略受限',
        impact: '逐步输入与校验，操作路径明确容错率高，但熟练用户批量处理时灵活性受限。',
        tradeoffs: '降低新手认知负担，牺牲高级自由探索速度。',
        reversibility: 'easy',
      },
      {
        key: 'free_workspace',
        label: '单屏自由工作台 (Canvas/Dashboard)',
        gain: '所有工具在单屏展开，操作效率与状态可视度极高',
        sacrifice: '首屏信息密度较大，新用户需要一定的上手熟悉过程',
        impact: '所有工具在单屏直接展开，熟练操作效率极高，但新用户需要一定的上手引导。',
        tradeoffs: '提升高效操作与状态可视度，增加首屏视觉复杂度。',
        reversibility: 'moderate',
      },
    ],
  },

  // 5. Success Signal / Acceptance
  'univ-success-signal': {
    question: (_gap) => '首发版本如何明确判定交付成功或任务完成？',
    reason: (_gap) => '缺少明确的完成信号会导致需求反复发散，测试无据可查。',
    recommendedOptionKey: 'automated_artifacts',
    options: [
      {
        key: 'automated_artifacts',
        label: '生成符合规范的产物文件并通过自动化校验',
        gain: '验收标准客观可度量，易于编写端到端自动化测试',
        sacrifice: '需要在前期严格定义产物结构与校验规则',
        impact: '以确定的本地输出文件和自动化验证为完成标准，结果客观可度量。',
        tradeoffs: '定义标准明确且易于自动化测试，前期需固化产物规范。',
        reversibility: 'easy',
      },
      {
        key: 'user_subjective_confirm',
        label: '用户主观交互体验验收并手动确认',
        gain: '对交互细节与感性体验包容度高，能随时根据使用感受调整',
        sacrifice: '缺乏客观硬性指标，难以通过自动化脚本回归防护',
        impact: '以用户在界面上的操作满意度为准，灵活适应感性需求，但难以自动化回归。',
        tradeoffs: '对设计细节包容度高，缺乏工程化的硬性衡量基线。',
        reversibility: 'moderate',
      },
    ],
  },

  // 6. Target User
  'univ-target-user': {
    question: (_gap) => '首发阶段最核心的目标用户群体是谁？',
    reason: (_gap) => '目标用户的专业背景与使用习惯直接决定了术语偏好、界面复杂度和默认配置。',
    recommendedOptionKey: 'individual_pro',
    options: [
      {
        key: 'individual_pro',
        label: '个人独立专业用户与极客开发者',
        gain: '追求极致单机性能与深度自定义，无需团队协作权限管理',
        sacrifice: '界面和概念允许一定专业门槛，不适配大众小白用户',
        impact: '强调单机性能、键盘快捷键与深度自定义，允许一定技术门槛，无需团队权限体系。',
        tradeoffs: '获得高黏性极客支持，放弃大众非技术群体的友好度。',
        reversibility: 'easy',
      },
      {
        key: 'general_consumer',
        label: '零技术门槛的普通大众用户',
        gain: '受众面极其广泛，产品潜在增长空间大',
        sacrifice: '需要大量的可视化引导与防呆校验，禁止暴露技术细节',
        impact: '要求极致开箱即用、防呆提示与可视化交互，禁止暴露任何技术术语或复杂配置。',
        tradeoffs: '扩大潜在用户基数，增加大量的交互防错与简化设计工作。',
        reversibility: 'moderate',
      },
    ],
  },

  // 7. Local-first Zero Server Dependency
  'localfirst-zero-server-dependency': {
    question: (_gap) => '产品是否允许存在任何中心化云端服务器依赖？',
    reason: (_gap) => '云端依赖会引入持续的网络可用性要求、隐私风险与长期运维开销。',
    recommendedOptionKey: 'zero_cloud',
    options: [
      {
        key: 'zero_cloud',
        label: '绝对零云端依赖 (纯本地单机运行)',
        gain: '完全离线、永久可用、零服务器成本，用户隐私安全最高',
        sacrifice: '无法实现多设备开箱即用的实时协同',
        impact: '无需登录注册与云端通信，断网即能使用全部功能，但无法进行多端实时协作。',
        tradeoffs: '获得绝对的隐私安全与终身可用性，放弃云端同步便利。',
        reversibility: 'easy',
      },
      {
        key: 'optional_cloud_sync',
        label: '本地优先为主，可选端到端加密同步服务',
        gain: '兼具本地极速响应与多端设备无缝切换便利',
        sacrifice: '需要处理多设备增量同步、网络离线重试与数据版本冲突',
        impact: '日常单机运行，联网时可跨设备增量同步，但需维护网络重试与冲突解决逻辑。',
        tradeoffs: '兼顾多设备使用，增加双端数据版本冲突处理复杂度。',
        reversibility: 'hard',
      },
    ],
  },

  // 8. Desktop Offline Lifecycle
  'desktop-offline-lifecycle': {
    question: (_gap) => '桌面客户端在离线与生命周期上如何响应？',
    reason: (_gap) => '需明确断网状态下的功能表现以及用户关闭主窗口时的进程驻留策略。',
    recommendedOptionKey: 'full_offline_exit',
    options: [
      {
        key: 'full_offline_exit',
        label: '完全离线可用，关闭窗口即彻底退出进程',
        gain: '系统资源占用极其干净透明，符合轻量单机工具预期',
        sacrifice: '无法在托盘后台监听全局事件或静默执行后台任务',
        impact: '不常驻系统后台，无网状态零降级，资源占用透明，但无法在托盘静默监听通知。',
        tradeoffs: '系统资源占用最轻且符合单机工具直觉，无法在后台持续常驻。',
        reversibility: 'easy',
      },
      {
        key: 'tray_background',
        label: '最小化到系统托盘常驻后台',
        gain: '随时通过全局快捷键极速呼出，支持后台持续监控',
        sacrifice: '持续占用系统内存与托盘空间，需要处理退出确认与托盘菜单',
        impact: '支持全局快捷键快速唤醒与后台静默任务，但会持续占用用户系统内存。',
        tradeoffs: '随时快速调出使用，增加了托盘事件与生命周期管理复杂度。',
        reversibility: 'moderate',
      },
    ],
  },

  // 9. Desktop Filesystem Permissions
  'desktop-fs-permission': {
    question: (_gap) => '应用在本地磁盘上的读写权限与工作目录范围是什么？',
    reason: (_gap) => '不受约束的任意磁盘读写会增加误操作风险，影响用户对桌面工具的安全信任。',
    recommendedOptionKey: 'workspace_sandbox',
    options: [
      {
        key: 'workspace_sandbox',
        label: '严格限制在用户显式选定的工作区目录内',
        gain: '安全边界清晰受控，杜绝任何越界修改用户系统文件的隐患',
        sacrifice: '涉及跨目录关联素材时，需要用户多次手动选择并授权',
        impact: '严格隔离文件边界，任何跨目录写入均需用户二次授权，极大降低误改风险。',
        tradeoffs: '获得极高的安全性与用户信任感，跨项目管理时需多次选择目录。',
        reversibility: 'easy',
      },
      {
        key: 'global_fs',
        label: '允许直接访问用户指定的任意本地绝对路径',
        gain: '操作自由度最高，无需受到固定文件夹结构的束缚',
        sacrifice: '需要完善的回收站机制与路径合法性防御，防止误删系统文件',
        impact: '用户可自由选取全局任何路径的文件，但需建立完善的回收站防误删保障。',
        tradeoffs: '最大化操作自由度，增加了路径越界与数据丢失防护负担。',
        reversibility: 'moderate',
      },
    ],
  },

  // 10. AI Fallback Policy
  'ai-fallback-policy': {
    question: (_gap) => '当 AI 接口超时、断网或返回格式异常时，系统应如何应对？',
    reason: (_gap) => '大模型服务存在偶发抖动与网络断连风险，必须建立明确的韧性降级方案。',
    recommendedOptionKey: 'explicit_error_retry',
    options: [
      {
        key: 'explicit_error_retry',
        label: '明确呈现错误诊断并允许用户一键重试',
        gain: '状态完全透明，保留用户已编辑材料，绝不进行隐蔽的错误吞吐',
        sacrifice: '遇到网络故障时需用户手动介入并点击重试',
        impact: '不隐瞒故障，保留已录入的输入材料，由用户决定重试或稍后处理。',
        tradeoffs: '状态完全透明受控，要求用户手动点击重试。',
        reversibility: 'easy',
      },
      {
        key: 'rule_fallback',
        label: '自动降级为本地预置确定性规则与模板库',
        gain: '断网或 AI 故障时流程完全不中断，保障基础闭环运作',
        sacrifice: '规则模板生成的建议缺乏针对当前项目的个性化深度',
        impact: '即便离线或 AI 故障，也能基于确定性规则给出基础建议，但内容缺乏个性化深度。',
        tradeoffs: '保障流程永不中断，需投入额外精力维护规则库。',
        reversibility: 'moderate',
      },
    ],
  },

  // 11. AI Cost Guardrail
  'ai-cost-guardrail': {
    question: (_gap) => '如何防护大上下文导致的 Token 消耗过量与调用超时？',
    reason: (_gap) => '未受控的长文档与多轮历史会导致单次调用耗时过长甚至模型响应超时。',
    recommendedOptionKey: 'strict_token_budget',
    options: [
      {
        key: 'strict_token_budget',
        label: '按阶段严格限制单次上下文 Token 预算与截断',
        gain: '调用耗时与成本高度确定，杜绝超时假死风险',
        sacrifice: '超出预算的材料仅提取核心摘要，可能损失部分细微背景',
        impact: '超出预算的材料仅提取结构化摘要，硬性保证调用速度与成本，但可能略微损失极细微背景。',
        tradeoffs: '保障响应时延稳定可控，需实现输入材料智能截断与提取。',
        reversibility: 'easy',
      },
      {
        key: 'full_context_warning',
        label: '允许全量原始上下文，仅在超大时弹窗预警',
        gain: '最大化保留材料中的每一句细节与长文本上下文',
        sacrifice: '调用等待时间显著增加，偶发长上下文超时概率上升',
        impact: '保留完整原始长文本信息，但调用耗时显著增长，偶发长文本超时风险增高。',
        tradeoffs: '保留全部上下文细节，需要用户承担偶发超时的等待成本。',
        reversibility: 'moderate',
      },
    ],
  },

  // 12. AI Structured Output
  'ai-structured-output': {
    question: (_gap) => 'AI 输出结果应采用何种协议进行解析与消费？',
    reason: (_gap) => '依赖自由文本正则提取极易产生字段错漏与解析崩溃，必须统一结构化契约。',
    recommendedOptionKey: 'json_schema',
    options: [
      {
        key: 'json_schema',
        label: '强制严格 JSON Schema 结构化验证',
        gain: '字段类型与约束 100% 严谨，彻底杜绝状态错乱与代码崩溃',
        sacrifice: '对不支持原生结构化输出的弱小模型要求较高',
        impact: '100% 拒绝任何不合规响应，彻底消除自然语言正则爬取隐患，但需对 Provider 做 Schema 约束。',
        tradeoffs: '数据解析绝对安全可靠，对不支持原生 Schema 的弱模型不够宽容。',
        reversibility: 'easy',
      },
      {
        key: 'flexible_json_repair',
        label: '宽松 JSON 提取并附带自动容错修复算法',
        gain: '对各类第三方推理模型与小参数模型的兼容容错度更高',
        sacrifice: '容错修复逻辑较为复杂，在极端畸形输出下仍有解析盲区',
        impact: '兼容各种轻量小模型输出，但容错解析仍有极端边缘异常的可能。',
        tradeoffs: '对弱小模型适配度更高，需编写复杂的防御性 JSON 清洗代码。',
        reversibility: 'moderate',
      },
    ],
  },

  // 13. DevTool Non-intrusive
  'devtool-non-intrusive': {
    question: (_gap) => '工具对开发者本地现有项目代码库的修改策略是什么？',
    reason: (_gap) => '未经审查的代码文件修改会破坏开发者的工作区整洁与信任感。',
    recommendedOptionKey: 'diff_preview_first',
    options: [
      {
        key: 'diff_preview_first',
        label: '仅在预览区展示 Diff，经用户显式确认才落盘',
        gain: '代码变更完全可审可控，绝对不发生意外文件覆写',
        sacrifice: '每次应用变更都多了一步人工确认点击',
        impact: '代码绝对安全可控，杜绝任何未经审查的代码覆写，但多了一步人工确认。',
        tradeoffs: '开发者掌控感与信任度最高，无法实现全自动无感知修改。',
        reversibility: 'easy',
      },
      {
        key: 'direct_write_with_git',
        label: '直接写入本地文件，依赖 Git 版本控制撤销',
        gain: '操作流畅无打断，自动化批量执行效率最高',
        sacrifice: '若当前工作区未提交 Git，有冲掉未保存代码的严重风险',
        impact: '自动化程度最高且操作流畅，但若用户未提交 Git 会引发未保存更改被冲掉的风险。',
        tradeoffs: '提升单次操作速度，对非 Git 管理目录极其危险。',
        reversibility: 'hard',
      },
    ],
  },

  // 14. DevTool CLI Predictability
  'devtool-cli-predictability': {
    question: (_gap) => 'CLI 命令行的标准输出与集成协议应如何设计？',
    reason: (_gap) => '命令行工具需要同时兼顾人类开发者排版直读与 CI/CD 脚本流水线自动化调用。',
    recommendedOptionKey: 'json_with_exit_code',
    options: [
      {
        key: 'json_with_exit_code',
        label: '结构化 JSON 输出与标准退出码 (Exit Codes)',
        gain: '与自动化运维脚本、CI/CD 流水线无缝对接，机器解析确定可靠',
        sacrifice: '人类直接在控制台查看时可读性略逊于带色彩的交互式输出',
        impact: '完美适配 CI/CD 流水线与脚本调用，退出码明确区分语法错误与业务中断。',
        tradeoffs: '机器集成极为方便，纯人类终端直读时需配合格式化工具。',
        reversibility: 'easy',
      },
      {
        key: 'rich_tui_terminal',
        label: '面向人类排版的丰富颜色与动态交互组件',
        gain: '终端视觉直观醒目，操作体验非常现代化',
        sacrifice: '在非 TTY 管道或重定向文件时输出夹杂 ANSI 转义字符，难以脚本解析',
        impact: '终端视觉交互美观直观，但在非 TTY 或管道脚本中解析非常痛苦。',
        tradeoffs: '终端交互体验极佳，自动化脚本捕获输出成本高。',
        reversibility: 'moderate',
      },
    ],
  },

  // 15. Utility Single Purpose
  'util-single-purpose': {
    question: (_gap) => '工具的功能范围与定位应如何保持克制？',
    reason: (_gap) => '轻量实用小工具容易因衍生需求蔓延而膨胀成庞大笨重的系统。',
    recommendedOptionKey: 'single_task',
    options: [
      {
        key: 'single_task',
        label: '严格单一用途，只把核心功能做到极致',
        gain: '启动极快、零心智负担、代码精简可靠，极佳的单任务体验',
        sacrifice: '无法直接处理衍生周边需求，需与其他小工具组合搭配',
        impact: '体积小巧、启动极快、零心智负担，但无法直接承接边缘衍生需求。',
        tradeoffs: '工具轻快聚焦易上手，需与其他工具组合使用。',
        reversibility: 'easy',
      },
      {
        key: 'multi_tools_suite',
        label: '整合多项常见相关工具的聚合套件',
        gain: '一揽子解决上下游多个关联需求，无需安装多个小软件',
        sacrifice: '软件体积与交互概念显著复杂化，维护成本提升',
        impact: '一揽子解决多个相关小痛点，但安装包变大且概念逐渐复杂化。',
        tradeoffs: '功能更丰富，但丧失小工具的极简特性。',
        reversibility: 'moderate',
      },
    ],
  },

  // 16. WebApp Browser Support
  'webapp-browser-support': {
    question: (_gap) => 'Web 应用首发优先支持哪些浏览器与设备环境？',
    reason: (_gap) => '浏览器兼容范围决定了 CSS 特性选择、打包 Polyfill 体积与移动端适配成本。',
    recommendedOptionKey: 'modern_desktop_browsers',
    options: [
      {
        key: 'modern_desktop_browsers',
        label: '主流现代桌面浏览器 (Chrome / Edge / Firefox / Safari)',
        gain: '充分利用最新现代 Web 标准，代码体积最小、页面渲染性能最高',
        sacrifice: '无法直接兼容老旧企业浏览器或低版本移动设备',
        impact: '全面采用最新现代 Web 标准，代码体积小、渲染性能高，不支持老旧浏览器。',
        tradeoffs: '开发与运行效率最高，放弃极少数老旧环境用户。',
        reversibility: 'easy',
      },
      {
        key: 'responsive_mobile_desktop',
        label: '桌面与移动端双端深度响应式适配',
        gain: '用户在手机、平板与电脑上均可获得一致的访问体验',
        sacrifice: '需要投入大量精力处理移动端触控交互、虚拟键盘与多屏幕尺寸排版',
        impact: '手机与电脑均可顺畅使用，但页面排版与触控事件适配开发量显著翻倍。',
        tradeoffs: '覆盖全场景移动访问，增加移动端适配调试成本。',
        reversibility: 'moderate',
      },
    ],
  },

  // 17. Core Features Scope
  'univ-core-features': {
    question: (_gap) => '首发版本的核心功能范围应如何取舍？',
    reason: (_gap) => '首发版本如果堆砌过多衍生特性，会导致交付周期不可控与核心体验打折。',
    recommendedOptionKey: 'lean_primary_feature',
    options: [
      {
        key: 'lean_primary_feature',
        label: '聚焦高频核心功能闭环，次要特性后续迭代',
        gain: '最快交付可用的核心体验，代码架构精简清晰',
        sacrifice: '首发版本暂不包含复杂的周边衍生与多媒体拓展功能',
        impact: '集中精力打磨最高频的关键交互，确保核心体验丝滑，将次要辅助特性延后。',
        tradeoffs: '以最快速度完成核心验证，放弃一次性做全套特性的完整感。',
        reversibility: 'easy',
      },
      {
        key: 'rich_feature_set',
        label: '一次性支持端到端全套衍生拓展功能',
        gain: '开箱功能极度丰富，满足多样化边缘场景',
        sacrifice: '开发工作量成倍增长，各模块之间耦合度增加，测试回归成本高',
        impact: '提供全套丰富功能，但开发周期显著拉长，且各功能模块容易相互干扰。',
        tradeoffs: '功能极其丰富，承担较高的交付延期与重构风险。',
        reversibility: 'hard',
      },
    ],
  },

  // 18. Page Structure & Architecture
  'univ-page-structure': {
    question: (_gap) => '首发版本的界面空间与信息架构如何组织？',
    reason: (_gap) => '页面层级与空间布局直接决定了用户的认知负担与操作路径流畅度。',
    recommendedOptionKey: 'single_focused_view',
    options: [
      {
        key: 'single_focused_view',
        label: '单屏聚焦核心空间/工作台 (沉浸直观)',
        gain: '所有核心状态与操作一屏尽览，沉浸感强且零页面跳转认知成本',
        sacrifice: '次要设置与历史记录需要通过抽屉或弹窗辅助展示',
        impact: '以单一核心场景为中心，沉浸感最高、操作即时可见，次要配置收拢在弹层中。',
        tradeoffs: '最大化沉浸感与核心操作效率，单屏信息容量需克制。',
        reversibility: 'easy',
      },
      {
        key: 'multi_page_tabs',
        label: '多页面/Tab 分栏导航架构 (信息分流)',
        gain: '每个功能模块有独立专属页面，未来横向拓展新功能非常方便',
        sacrifice: '不同模块间切换需要跳转页面，削弱了单一场景的沉浸连贯性',
        impact: '将功能拆分在多个 Tab 或独立路由页面，扩展性好，但高频互动时跳转成本较高。',
        tradeoffs: '适合多模块复杂系统，牺牲单屏沉浸互动流畅度。',
        reversibility: 'moderate',
      },
    ],
  },

  // 19. UX/UI Direction
  'univ-ux-ui-direction': {
    question: (_gap) => '首发版本的视觉设计与交互体验倾向于哪种风格？',
    reason: (_gap) => '视觉风格与动效复杂度直接影响前端开发周期、资源加载与用户的氛围代入感。',
    recommendedOptionKey: 'clean_and_cozy',
    options: [
      {
        key: 'clean_and_cozy',
        label: '温馨轻量、注重顺畅交互与核心视觉氛围',
        gain: '资源体积轻巧、加载极速，既有专属的情感温度又不会带来开发负担',
        sacrifice: '首发版本不做过于复杂的 3D 渲染或重度物理骨骼动画',
        impact: '采用轻量细腻的 2D/矢量与温馨配色，体验流畅易维护，平衡美感与实现成本。',
        tradeoffs: '兼顾专属氛围与研发效率，暂缓重度复杂动效。',
        reversibility: 'easy',
      },
      {
        key: 'rich_immersive',
        label: '重度沉浸拟真、丰富个性化装扮与复杂动效',
        gain: '视觉冲击力极强，代入感与趣味性达到极致',
        sacrifice: '需要大量的美术素材绘制、动画切片与复杂的资源加载管理',
        impact: '带来极强的拟真沉浸感，但需要投入大量精力制作专属素材与动效调优。',
        tradeoffs: '视觉表现力顶尖，美术与前端动画开发工作量大幅上升。',
        reversibility: 'moderate',
      },
    ],
  },
};

/**
 * Looks up a checklist question template by key with automatic prefix normalization.
 * Returns undefined if no concrete template exists for this key.
 */
export function getChecklistTemplate(rawKey: string): ChecklistQuestionTemplate | undefined {
  if (!rawKey) return undefined;
  const normalized = normalizeTemplateKey(rawKey);
  return ChecklistQuestionTemplates[normalized];
}
