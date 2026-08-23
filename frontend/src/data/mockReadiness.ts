import { ReadinessData } from '../types/project';

export const INITIAL_READINESS_DATA: ReadinessData = {
  overallStatus: 'ready_with_warnings',
  approved: false,
  stateRevision: 'rev-20260822-04',
  recommendation: '核心范围已闭合，有 2 项次要 Warning 与 1 项材料截断 Issue，可选择【批准并生成文档】或【继续在 Discovery 中完善】。',
  buckets: {
    ready: [
      {
        id: 'r-1',
        title: '产品使命与目标用户明确',
        desc: '清晰界定面向单人独立开发者与 AI Coding 场景，不做通用企业级项目管理。'
      },
      {
        id: 'r-2',
        title: 'MVP 范围边界闭合',
        desc: '已锁定 In-Scope 与 Out-of-Scope 清单，不包含自动代码生成与多用户权限。'
      },
      {
        id: 'r-3',
        title: '核心用户流程与异常分支已明确',
        desc: '已理清 Idea 输入 → 首轮分析 → Gap 决策 → Overview 投影 → 文档生成的完整闭环。'
      },
      {
        id: 'r-4',
        title: 'UX/UI 视觉与三栏交互准则已定',
        desc: '符合 Linear 暖中性色低饱和风格，左右侧栏均支持灵活折叠与响应式降级。'
      },
      {
        id: 'r-5',
        title: '单次推理与上下文最小化契约成立',
        desc: 'Agent Runtime 每次交互执行单一明确任务，输出严格结构化 JSON 契约。'
      },
      {
        id: 'r-6',
        title: 'Coding Agent 入口规范 (AGENTS.md) 索引已就绪',
        desc: '定义了 7 份核心 Markdown 蓝图职责与推荐阅读开发顺序。'
      }
    ],
    warnings: [
      {
        id: 'w-1',
        title: '本地 JSON 纯文本读写在超大项目时可能有性能开销',
        desc: '对于超过 100 个决策的大型项目，频繁全量读写 JSON 需注意 I/O 耗时。',
        impact: 'V1 阶段建议针对单项目限制在 500KB 以内，后续可加内存缓存。'
      },
      {
        id: 'w-2',
        title: '未提供全自动数据 Schema 迁移工具',
        desc: '若未来状态字段重大重构，旧项目文件需手动适配或提示升级。',
        impact: '独立开发者自用可接受，后续版本规划 Migration Engine。'
      }
    ],
    highIssues: [
      {
        id: 'h-1',
        title: '多材料附件在极端场景下的 Token 预算截断策略',
        desc: '当用户一次性上传 5 个大型 PDF/图片时，尚未锁定分段提取的核心 Prompt 算法。',
        impact: '已建立暂定 Assumption，生成文档时将显式保留此待定项。'
      }
    ],
    criticalConflicts: []
  }
};
