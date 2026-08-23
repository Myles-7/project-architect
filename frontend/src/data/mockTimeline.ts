import { TimelineMessage } from '../types/project';
import { PRIMARY_GAP_QUESTION } from './mockQuestions';

export const INITIAL_TIMELINE_MESSAGES: TimelineMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    type: 'idea_prompt',
    timestamp: '14:20',
    content: '做一款离线优先的 AI 项目规划工作台，帮助开发者在开始 AI Coding 之前，把模糊想法逐步梳理成明确的工程级规范、结构化 Overview、Readiness 准备度评测，以及给 Cursor / Antigravity 使用的 AGENTS.md 规范文档。',
    attachedFiles: [
      {
        id: 'file-1',
        name: 'rough_ideas_draft.md',
        size: '12 KB',
        type: 'markdown',
        status: 'parsed',
        summary: '初步罗列了单人开发场景痛点与三栏布局设想'
      },
      {
        id: 'file-2',
        name: 'linear_design_teardown.png',
        size: '1.2 MB',
        type: 'image',
        status: 'parsed',
        summary: 'Linear UI Refresh 暖灰中性色与安静工作台设计参考'
      }
    ]
  },
  {
    id: 'msg-2',
    sender: 'assistant',
    type: 'initial_analysis',
    timestamp: '14:21',
    analysis: {
      confirmed: [
        '产品定位：本地运行的个人 AI 项目规划工作台（非通用敏捷协同工具）',
        '核心目标：把模糊想法转化为结构化决策与标准工程蓝图',
        '核心产物：可直接交给 Coding Agent 使用的 AGENTS.md 及 7 份 Markdown 规范',
        'UI 视觉原则：采用 Linear 风格冷暖中性色，降低界面表现欲，专注思考'
      ],
      candidates: [
        '三栏工作台布局：左侧导航 + 中栏决策流 + 右侧 Overview 实时蓝图',
        'Gap-First 提问机制：单题聚焦高价值缺口，避免漫无目的问卷调查',
        '双向编辑同步：支持在右侧 Overview 中手动修改并锁定事实'
      ],
      assumptions: [
        '暂定仅支持单人单设备运行，不引入复杂的实时多用户协同 (Active Assumption)',
        '生成的 Markdown 开发文档作为单向产物，若需变更应回退状态模型重新生成'
      ],
      unresolvedGaps: [
        'MVP 阶段状态持久化方案：纯本地 JSON 文件目录 vs SQLite 数据库',
        '材料附件解析时的上下文截断与 Token 预算策略'
      ],
      warnings: [
        '注意避免将系统做成又一个冗余的 PRD 生成器或复杂 Jira 看板，务必保持轻量自用专注'
      ],
      recommendations: [
        {
          title: '优先明确存储与状态边界',
          rationale: '单人自用场景下，文件系统 + JSON 天然适配 Git，能极大降低 V1 交付周期与复杂度。'
        },
        {
          title: '保持 Agent 推理单次闭环',
          rationale: '每次交互只执行单次明确推理，避免黑盒多 Agent 互相审查导致的等待和不可控。'
        }
      ]
    }
  },
  {
    id: 'msg-3',
    sender: 'assistant',
    type: 'question_card',
    timestamp: '14:22',
    question: PRIMARY_GAP_QUESTION
  }
];
