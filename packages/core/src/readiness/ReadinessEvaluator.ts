import type {
  ProjectSnapshot,
  KnowledgeArea,
  ProjectMaturityLevel,
} from '@project-architect/contracts';
import { KnowledgeChecklist } from './KnowledgeChecklist.js';

export interface ReadinessResult {
  ready: boolean;
  score: number;
  knowledgeScore: Record<KnowledgeArea, number>;
  maturityLevel: ProjectMaturityLevel;
  blockingIssues: string[];
  warnings: string[];
  assumptions: string[];
}

export class ReadinessEvaluator {
  private checklist: KnowledgeChecklist;

  constructor() {
    this.checklist = new KnowledgeChecklist();
  }

  /**
   * Evaluates project maturity across Product, MVP, UX, and Technical boundaries using structured KnowledgeChecklist.
   */
  evaluate(snapshot: ProjectSnapshot): ReadinessResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const assumptions: string[] = [];

    const knowledgeEval = this.checklist.evaluate(snapshot);
    const confirmedDecisions = snapshot.decisions.items.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );

    // 1. Required Knowledge Requirements
    if (!knowledgeEval.requirements.vision.satisfied) {
      blockingIssues.push('缺少核心产品概述与愿景定义 (Product Overview/Vision missing)');
    }
    if (!knowledgeEval.requirements.user.satisfied) {
      blockingIssues.push('缺少明确的目标用户画像与核心诉求 (Target User missing)');
    }
    if (!knowledgeEval.requirements.scope.satisfied) {
      blockingIssues.push('缺少明确的首发版本 MVP 边界与范围界定 (MVP Scope missing)');
    }

    // 2. Critical Conflicts
    const openCriticalConflicts = snapshot.gaps.conflicts.filter(
      (c) => c.status === 'open' && c.severity === 'critical'
    );
    for (const conf of openCriticalConflicts) {
      blockingIssues.push(`存在未解决的严重排他性冲突: ${conf.reason}`);
    }

    // 3. Critical Gaps in Unconfirmed Areas
    const openCriticalGaps = snapshot.gaps.gaps.filter(
      (g) =>
        g.status === 'open' &&
        g.severity === 'critical' &&
        !confirmedDecisions.some((d) => d.area === g.area)
    );
    for (const gap of openCriticalGaps) {
      blockingIssues.push(`存在未解决的核心产品缺口 (${gap.area}): ${gap.reason}`);
    }

    // 4. Non-blocking Warnings from Knowledge Requirements
    if (knowledgeEval.requirements.flow.score < 100) {
      warnings.push('核心用户主流程 (User Flows) 尚未详细展开，将使用默认交互基线。');
    }
    if (knowledgeEval.requirements.constraints.score < 100) {
      warnings.push('技术与平台约束 (Technical Boundary) 未单独锁定，将依据项目标签推断。');
    }

    // 5. Open Normal Gaps
    const openNormalGaps = snapshot.gaps.gaps.filter(
      (g) => g.status === 'open' && g.severity !== 'critical'
    );
    for (const gap of openNormalGaps) {
      warnings.push(`未决细节缺口 (${gap.area}): ${gap.reason}`);
    }

    // 6. Active Assumptions
    const activeAssumptions = snapshot.assumptions.items.filter((a) => a.status === 'active');
    for (const asm of activeAssumptions) {
      assumptions.push(`${asm.statement} (理由: ${asm.reason})`);
    }

    const ready = blockingIssues.length === 0;

    return {
      ready,
      score: knowledgeEval.overallScore,
      knowledgeScore: knowledgeEval.knowledgeScore,
      maturityLevel: knowledgeEval.maturityLevel,
      blockingIssues,
      warnings,
      assumptions,
    };
  }
}
