import { QuestionItem } from '../types/project';

export const PRIMARY_GAP_QUESTION: QuestionItem = {
  id: 'q-storage-strategy',
  importance: 'high',
  question: 'MVP 阶段的项目状态存储与多端同步策略如何抉择？',
  whyAskNow: '存储架构直接决定了客户端是纯无状态文件读写还是需要常驻数据库/CRDT 引擎，影响 V1 的系统复杂度和交付时间。',
  recommendation: {
    label: '方案 A：纯本地 JSON 文件系统 + 单项目独立目录',
    rationale: '零额外依赖、天然适配 Git 版本管理、无网络运维成本，最符合单人工作台及 Coding Agent 直接查阅 Markdown/JSON 的定位。'
  },
  options: [
    {
      id: 'opt-a',
      label: '方案 A：纯本地 JSON 文件夹存储',
      impact: '极低复杂度、零网络依赖、完美配合 Git diff，适合快速交付 V1',
      isRecommended: true
    },
    {
      id: 'opt-b',
      label: '方案 B：嵌入式 SQLite 数据库',
      impact: '查询性能极佳且单文件便携，但二进制文件不利于 Coding Agent 直接查阅文本状态',
      isRecommended: false
    },
    {
      id: 'opt-c',
      label: '方案 C：本地优先 + CRDT 局域网同步',
      impact: '多端协同体验极好，但引入复杂的冲突合并算法，大幅增加 V1 交付周期与 Bug 风险',
      isRecommended: false
    }
  ],
  subQuestions: [
    {
      id: 'sub-q1',
      question: '生成开发文档后，是否允许在 UI 中直接手写覆盖 Markdown？',
      options: [
        '不允许（文档仅作为状态派生产物，需修改应回退到 Overview 或 Chat）',
        '允许双向同步（但在下次生成时可能存在冲突覆盖风险）'
      ],
      selectedOption: '不允许（文档仅作为状态派生产物，需修改应回退到 Overview 或 Chat）'
    }
  ]
};

export const SECONDARY_GAP_QUESTION: QuestionItem = {
  id: 'q-token-budget',
  importance: 'normal',
  question: '多 Material 材料附件解析时的上下文截断策略',
  whyAskNow: '当用户上传多个长 PRD 或大图时，单次 Agent 推理需要明确如何保持最小相关上下文。',
  recommendation: {
    label: '采用分段摘要 + 关键段落精准提取',
    rationale: '在不超过 8k token 的预算下提取核心事实，避免上下文污染和高额推理延迟。'
  },
  options: [
    {
      id: 'opt-sec-1',
      label: '自动提取材料摘要与核心事实',
      impact: '兼顾速度与关键信息覆盖率，消耗极低 Token',
      isRecommended: true
    },
    {
      id: 'opt-sec-2',
      label: '全量材料直接传入单次 Prompt',
      impact: '信息最全，但在超大文档时可能超出窗口或导致推理迟缓',
      isRecommended: false
    }
  ]
};
