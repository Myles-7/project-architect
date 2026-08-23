import { OverviewSection } from '../types/project';

export const INITIAL_OVERVIEW_SECTIONS: OverviewSection[] = [
  {
    id: 'vision',
    title: '愿景与定位',
    iconName: 'Compass',
    category: 'core',
    summary: '面向个人开发者的本地 AI 构思工作台，在编码前把项目想清楚，输出清晰的工程级开发输入。',
    maturity: 'confirmed',
    items: [
      {
        id: 'vis-1',
        title: '产品使命',
        content: '帮助开发者在开始 AI Coding 之前，把模糊想法逐步转化为明确、可审阅、可交给 Coding Agent 的开发蓝图。',
        status: 'confirmed',
        locked: true,
        note: '用户已明确产品定位为“规划阶段思考助手”，不做通用全生命周期项目管理。'
      },
      {
        id: 'vis-2',
        title: '核心价值主张',
        content: '减少错误开工；保留用户主导权；把探索沉淀为结构化规范；以最少打扰推动项目收敛。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'target_users',
    title: '目标用户与画像',
    iconName: 'Users',
    category: 'core',
    summary: '高频使用 AI Coding 工具（如 Cursor、Antigravity、Claude Code）的独立开发者与技术产品经理。',
    maturity: 'confirmed',
    items: [
      {
        id: 'usr-1',
        title: '核心人群',
        content: '独立开发者、全栈工程师、希望快速用 AI 落地产品的 Technical PM / Solo Founder。',
        status: 'confirmed',
        locked: true
      },
      {
        id: 'usr-2',
        title: '典型使用场景',
        content: '仅有一句构思或散落的备忘草稿，需要快速理清 MVP 范围、数据流、异常边界并生成标准项目文档。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'core_problem',
    title: '核心痛点与问题',
    iconName: 'AlertCircle',
    category: 'core',
    summary: '需求尚未闭合即开工导致反复返工；AI 幻觉虚构需求；缺乏高质量的 Coding Agent 输入。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'prb-1',
        title: '痛点 1: 错误开工与范围膨胀',
        content: '在关键约束和边界未理清时直接让 AI 编码，导致后期大量重构与架构推倒重来。',
        status: 'confirmed',
        locked: false
      },
      {
        id: 'prb-2',
        title: '痛点 2: 聊天记录难以沉淀为规范',
        content: '普通对话型 AI 的聊天记录冗长无序，无法直接作为工程团队或 Agent 的可信唯一事实源 (Single Source of Truth)。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'mvp_scope',
    title: 'MVP 范围边界',
    iconName: 'Target',
    category: 'core',
    summary: '聚焦本地单人工作台，完成从 Idea 输入、Gap 提问到 Markdown 文档生成的完整闭环。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'mvp-1',
        title: 'V1 包含能力 (In-Scope)',
        content: '本地项目创建与保存、文本与附件输入、首次结构化理解、Gap-first 提问、3 栏 Overview 投影、Readiness 审阅、生成 7 份标准 Markdown。',
        status: 'confirmed',
        locked: true
      },
      {
        id: 'mvp-2',
        title: '明确不做 (Out-of-Scope)',
        content: '不做自动代码生成与执行、不做团队多用户协作权限、不做复杂任务看板或 Git 自动推代码。',
        status: 'confirmed',
        locked: true,
        note: '保持“思考工作台”专注度，不与 IDE 或敏捷管理工具竞争。'
      },
      {
        id: 'mvp-3',
        title: '存储架构待决项',
        content: '单机文件目录持久化机制 vs SQLite 嵌入式存储方案选择。',
        status: 'unresolved',
        locked: false,
        impact: '影响离线数据组织形式与 Coding Agent 直接查阅方式。'
      }
    ]
  },
  {
    id: 'core_features',
    title: '核心功能清单',
    iconName: 'Layers',
    category: 'core',
    summary: '首页轻量入口、三栏工作台、Gap-first 提问系统、动态成熟度概览、开发准备度审阅。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'feat-1',
        title: '首次理解分析引擎',
        content: '接收 Idea 与附件后，单次推理输出 Confirmed、Candidate、Assumption、Gap、Warning。',
        status: 'confirmed',
        locked: false
      },
      {
        id: 'feat-2',
        title: 'Gap-First 关键问题卡片',
        content: '单题聚焦高价值缺口，展示“为什么现在问”、AI 推荐与影响对比，支持选项与自由输入。',
        status: 'candidate',
        locked: false
      },
      {
        id: 'feat-3',
        title: '多视图 Overview 与状态编辑',
        content: '支持直观卡片、大纲和锁定标记，用户可随时手动覆盖或锁定任何推论。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'user_flow',
    title: '核心用户旅程',
    iconName: 'GitMerge',
    category: 'core',
    summary: 'Idea 输入 → 首次结构化分析 → 逐个决策关键 Gap → Overview 实时收敛 → Readiness 批准 → 生成文档。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'flow-1',
        title: '主工作流: 启发收敛闭环',
        content: '首页新建 → 工作台中栏交互 → 右栏 Overview 实时同步 → 触发 Readiness Review → 批准生成。',
        status: 'confirmed',
        locked: false
      },
      {
        id: 'flow-2',
        title: '异常与分支: 随时纠偏',
        content: '用户可在任何时刻自由输入覆盖 AI 推荐，或在 Overview 中直接点击编辑并锁定。',
        status: 'assumption',
        locked: false,
        note: '暂定默认支持双向同步（对话与直接编辑）。'
      }
    ]
  },
  {
    id: 'ux_ui',
    title: 'UX/UI 设计准则',
    iconName: 'Layout',
    category: 'core',
    summary: '采用 Linear 风格冷暖中性色，降低界面自我表现欲，侧边栏主动后退，顶部栏高度一致与可预测。',
    maturity: 'confirmed',
    items: [
      {
        id: 'ui-1',
        title: '视觉风格与色彩 Token',
        content: '低饱和暖灰与暗调中性色（Ink, Warm Dark, Muted Gray, Soft Line），辅以克制的橙色强调，避免花哨彩虹色。',
        status: 'confirmed',
        locked: true,
        note: '依照 Linear UI Refresh 设计解构，打造安静、专注的工作台。'
      },
      {
        id: 'ui-2',
        title: '三栏可折叠布局',
        content: '左侧导航 (180px-240px 可折叠) + 中栏决策时间线 (主工作区) + 右栏 Overview 蓝图 (340px-420px 可折叠)。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'roadmap',
    title: '阶段规划与交付路径',
    iconName: 'Milestone',
    category: 'core',
    summary: 'Phase 1: 视觉原型与交互验证 → Phase 2: 单项目 State Engine → Phase 3: Single Agent Runtime → Phase 4: 文档装配。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'rdm-1',
        title: 'Phase 1: UI Shell (当前阶段)',
        content: '完成完整视觉风格、三栏交互、模拟分析与问答、Readiness 及文档预览的空壳闭环。',
        status: 'confirmed',
        locked: true
      },
      {
        id: 'rdm-2',
        title: 'Phase 2: 本地 State 校验引擎',
        content: '实现状态迁移规则、锁定保护、Schema 校验与无静默覆盖保障。',
        status: 'candidate',
        locked: false
      }
    ]
  },
  {
    id: 'data_privacy',
    title: '数据与隐私机制',
    iconName: 'ShieldCheck',
    category: 'dynamic',
    summary: '单机优先，所有项目文件与状态本地保存，仅在推理时发送最小必要上下文。',
    maturity: 'mostly_clear',
    items: [
      {
        id: 'sec-1',
        title: '本地存储原则',
        content: '所有项目数据默认保存在用户本地磁盘，无需云端账号或数据上传。',
        status: 'confirmed',
        locked: true
      },
      {
        id: 'sec-2',
        title: '最小相关上下文',
        content: '每次 AI 推理仅装配当前任务相关的最小上下文，不发送冗余完整历史。',
        status: 'confirmed',
        locked: false
      }
    ]
  },
  {
    id: 'sync_architecture',
    title: '本地优先与同步',
    iconName: 'RefreshCw',
    category: 'dynamic',
    summary: 'V1 采用纯文件目录，天然配合 Git；后续版本按需支持局域网同步。',
    maturity: 'needs_clarity',
    items: [
      {
        id: 'syn-1',
        title: 'Git 友好格式',
        content: '所有 Project State 以标准 JSON 存储，生成产物为标准 Markdown，完美配合 Git diff。',
        status: 'confirmed',
        locked: false
      },
      {
        id: 'syn-2',
        title: '多端冲突解决机制',
        content: 'V1 阶段限制为单设备单实例运行，避免分布式并发写入冲突。',
        status: 'warning',
        locked: false,
        impact: '如需多设备同时编辑，需要用户手动通过 Git pull/push 解决冲突。'
      }
    ]
  }
];
