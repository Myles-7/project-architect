export interface RecentProjectSummary {
  id: string;
  name: string;
  tagline: string;
  stage: 'discovery' | 'broad_pass' | 'deep_dive' | 'readiness' | 'documented';
  stageLabel: string;
  updatedAt: string;
  tags: string[];
  readinessStatus: 'ready' | 'ready_with_warnings' | 'not_ready';
  readinessLabel: string;
  unresolvedCount: number;
  confirmedCount: number;
}

export const MOCK_RECENT_PROJECTS: RecentProjectSummary[] = [
  {
    id: 'proj-architect',
    name: 'Project Architect (项目构思工作台)',
    tagline: '在编码前把项目想清楚，把模糊想法转化为工程级规范与 Coding Agent 蓝图',
    stage: 'deep_dive',
    stageLabel: 'Deep Dive 阶段',
    updatedAt: '10 分钟前',
    tags: ['本地优先', 'AI 工作台', '开发者工具', 'Markdown 生成'],
    readinessStatus: 'ready_with_warnings',
    readinessLabel: 'Ready w/ Warnings (6 就绪 · 2 风险 · 1 待决)',
    unresolvedCount: 1,
    confirmedCount: 14,
  },
  {
    id: 'proj-whisper-note',
    name: 'WhisperNote: 极简离线语音随想录',
    tagline: '基于本地 Whisper 与 SQLite 的极速随身灵感捕获与自动摘要工具',
    stage: 'readiness',
    stageLabel: 'Readiness 准备度审阅',
    updatedAt: '昨天 18:20',
    tags: ['Desktop', 'Tauri', 'Rust', 'Local AI'],
    readinessStatus: 'ready',
    readinessLabel: 'Ready (8 就绪 · 0 阻塞)',
    unresolvedCount: 0,
    confirmedCount: 18,
  },
  {
    id: 'proj-sqlite-flow',
    name: 'SQLiteFlow: 个人嵌入式数据库调试器',
    tagline: '专门为 SQLite / LibSQL 设计的零延迟可视化 schema 探索与查询测试器',
    stage: 'documented',
    stageLabel: '已生成开发蓝图',
    updatedAt: '3 天前',
    tags: ['Developer Tools', 'Database', 'Wasm'],
    readinessStatus: 'ready',
    readinessLabel: 'Ready (已批准生成)',
    unresolvedCount: 0,
    confirmedCount: 22,
  },
  {
    id: 'proj-omni-clip',
    name: 'OmniClip: 局域网端对端加密剪贴板',
    tagline: '利用 mDNS 自动发现与 TLS 传输的多端剪贴板无感同步小工具',
    stage: 'broad_pass',
    stageLabel: 'Broad Pass 广泛澄清',
    updatedAt: '上周',
    tags: ['P2P', 'Security', 'Go', 'Flutter'],
    readinessStatus: 'not_ready',
    readinessLabel: 'Not Ready (4 项待决缺口)',
    unresolvedCount: 4,
    confirmedCount: 9,
  }
];

export const IDEA_PRESETS = [
  {
    title: '离线优先项目构思工作台',
    prompt: '做一款本地运行的 AI 项目规划工作台，帮助开发者在开始 AI Coding 之前，把模糊想法逐步梳理成结构化决策、Overview 和 AGENTS.md 规范文档。',
    tags: ['Local-first', 'AI Agent', 'PRD']
  },
  {
    title: '极速代码片段与 Prompt 调试器',
    prompt: '为全栈开发者构建一个毫秒级启动的本地 Prompt Snippet 管理工具，支持变量插槽、快捷键注入 Cursor 与 Antigravity，以及版本历史回滚。',
    tags: ['Desktop', 'Productivity', 'DevTools']
  },
  {
    title: '基于 SQLite 的轻量单人记账器',
    prompt: '做一个不依赖任何云端数据库的极简记账工具，支持微信/支付宝账单导入、自动分类打标、多币种与资产折线图，所有数据保存在本地单文件。',
    tags: ['Finance', 'Local DB', 'Clean UI']
  }
];
