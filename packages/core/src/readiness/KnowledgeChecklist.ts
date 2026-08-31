import { AreaRegistry } from '../areas/AreaRegistry.js';
import type {
  ProjectSnapshot,
  KnowledgeArea,
  ProjectMaturityLevel,
} from '@project-architect/contracts';

export interface KnowledgeRequirement {
  area: KnowledgeArea;
  label: string;
  required: boolean;
  satisfied: boolean;
  evidence: string[];
  score: number; // 0 ~ 100
}

export interface KnowledgeEvaluationResult {
  requirements: Record<KnowledgeArea, KnowledgeRequirement>;
  knowledgeScore: Record<KnowledgeArea, number>;
  overallScore: number;
  maturityLevel: ProjectMaturityLevel;
}

export class KnowledgeChecklist {
  /**
   * Evaluates the 8 core knowledge pillars of a project snapshot against structured evidence.
   */
  evaluate(snapshot: ProjectSnapshot): KnowledgeEvaluationResult {
    const confirmedDecisions = snapshot.decisions.items.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );

    // 1. Vision
    const visionEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'project_overview' || d.id === 'dec-01')
      .map((d) => `decision:${d.id}`);
    const visionReq: KnowledgeRequirement = {
      area: 'vision',
      label: '项目愿景与概述 (Vision)',
      required: true,
      satisfied: visionEv.length > 0,
      evidence: visionEv,
      score: visionEv.length > 0 ? 100 : 0,
    };

    // 2. User
    const userEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'target_user' || d.statement.toLowerCase().includes('用户') || d.statement.toLowerCase().includes('user'))
      .map((d) => `decision:${d.id}`);
    const userReq: KnowledgeRequirement = {
      area: 'user',
      label: '目标用户画像与场景 (Target User)',
      required: true,
      satisfied: userEv.length > 0,
      evidence: userEv,
      score: userEv.length > 0 ? 100 : 0,
    };

    // 3. Problem
    const problemEv = confirmedDecisions
      .filter((d) =>
        d.sourceArea === 'core_problem' ||
        d.sourceArea === 'problem' ||
        d.statement.toLowerCase().includes('痛点') ||
        d.statement.toLowerCase().includes('problem') ||
        d.statement.toLowerCase().includes('bottleneck') ||
        (AreaRegistry.normalize(d.area) === 'target_user' && confirmedDecisions.filter((other) => AreaRegistry.normalize(other.area) === 'target_user').length > 1)
      )
      .map((d) => `decision:${d.id}`);
    const problemReq: KnowledgeRequirement = {
      area: 'problem',
      label: '核心痛点与问题界定 (Core Problem)',
      required: false,
      satisfied: problemEv.length > 0 || visionEv.length > 0,
      evidence: problemEv.length > 0 ? problemEv : visionEv,
      score: problemEv.length > 0 ? 100 : visionEv.length > 0 ? 70 : 0,
    };

    // 4. Scope (MVP)
    const scopeEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'mvp_scope' || d.statement.toLowerCase().includes('mvp') || d.statement.toLowerCase().includes('首发'))
      .map((d) => `decision:${d.id}`);
    const scopeReq: KnowledgeRequirement = {
      area: 'scope',
      label: '首发版本范围与非目标 (MVP Scope)',
      required: true,
      satisfied: scopeEv.length > 0,
      evidence: scopeEv,
      score: scopeEv.length > 0 ? 100 : 0,
    };

    // 5. Flow
    const flowEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'user_flows' || AreaRegistry.normalize(d.area) === 'core_features')
      .map((d) => `decision:${d.id}`);
    const flowReq: KnowledgeRequirement = {
      area: 'flow',
      label: '核心用户主流程 (User Flows)',
      required: false,
      satisfied: flowEv.length > 0,
      evidence: flowEv,
      score: flowEv.length > 0 ? 100 : 50,
    };

    // 6. UX
    const uxEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'ux_ui_direction' || d.statement.toLowerCase().includes('ui') || d.statement.toLowerCase().includes('ux'))
      .map((d) => `decision:${d.id}`);
    const uxReq: KnowledgeRequirement = {
      area: 'ux',
      label: '交互体验与布局原则 (UX & UI)',
      required: false,
      satisfied: uxEv.length > 0,
      evidence: uxEv,
      score: uxEv.length > 0 ? 100 : 60,
    };

    // 7. Constraints
    const constraintsEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'technical_boundary' || d.status === 'locked')
      .map((d) => `decision:${d.id}`);
    const constraintsReq: KnowledgeRequirement = {
      area: 'constraints',
      label: '技术架构与锁定约束 (Technical Constraints)',
      required: false,
      satisfied: constraintsEv.length > 0 || (snapshot.metadata.projectTags && snapshot.metadata.projectTags.length > 0),
      evidence: constraintsEv,
      score: constraintsEv.length > 0 ? 100 : 70,
    };

    // 8. Acceptance
    const acceptanceEv = confirmedDecisions
      .filter((d) => AreaRegistry.normalize(d.area) === 'delivery_plan' || d.status === 'locked')
      .map((d) => `decision:${d.id}`);
    const acceptanceReq: KnowledgeRequirement = {
      area: 'acceptance',
      label: '验收标准与质量要求 (Acceptance Criteria)',
      required: false,
      satisfied: confirmedDecisions.length >= 2,
      evidence: acceptanceEv,
      score: confirmedDecisions.length >= 3 ? 100 : 60,
    };

    const requirements: Record<KnowledgeArea, KnowledgeRequirement> = {
      vision: visionReq,
      user: userReq,
      problem: problemReq,
      scope: scopeReq,
      flow: flowReq,
      ux: uxReq,
      constraints: constraintsReq,
      acceptance: acceptanceReq,
    };

    const knowledgeScore: Record<KnowledgeArea, number> = {
      vision: visionReq.score,
      user: userReq.score,
      problem: problemReq.score,
      scope: scopeReq.score,
      flow: flowReq.score,
      ux: uxReq.score,
      constraints: constraintsReq.score,
      acceptance: acceptanceReq.score,
    };

    // Weighted Overall Score
    const overallScore = Math.round(
      visionReq.score * 0.2 +
        userReq.score * 0.2 +
        scopeReq.score * 0.2 +
        problemReq.score * 0.1 +
        flowReq.score * 0.1 +
        constraintsReq.score * 0.1 +
        uxReq.score * 0.05 +
        acceptanceReq.score * 0.05
    );

    let maturityLevel: ProjectMaturityLevel = 'Level 1: Idea';
    const allSatisfied = Object.values(requirements).every((r) => r.satisfied);
    if (overallScore >= 95 && allSatisfied) {
      maturityLevel = 'Level 5: Stable';
    } else if (overallScore >= 75 && visionReq.satisfied && userReq.satisfied && scopeReq.satisfied) {
      maturityLevel = 'Level 4: Development Ready';
    } else if (overallScore >= 60 && visionReq.satisfied && userReq.satisfied) {
      maturityLevel = 'Level 3: Ready';
    } else if (overallScore >= 40) {
      maturityLevel = 'Level 2: Defined';
    }

    return {
      requirements,
      knowledgeScore,
      overallScore,
      maturityLevel,
    };
  }
}
