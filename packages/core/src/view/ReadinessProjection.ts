import { ReadinessGate } from '../readiness/ReadinessGate.js';
import { ReadinessActionPolicy } from '../readiness/ReadinessActionPolicy.js';
import { ReadinessEvaluator } from '../readiness/ReadinessEvaluator.js';
import { AreaRegistry } from '../areas/AreaRegistry.js';
import {
  CANONICAL_B3_AREAS,
  type ProjectSnapshot,
  type ReadinessView,
  type ReadinessAreaView,
  type ReadinessIssueView,
  type UserDisposition,
  type DecisionRef,
  type GapRef,
} from '@project-architect/contracts';

/**
 * Pure-function projection: ProjectSnapshot -> ReadinessView.
 *
 * Guaranteed Invariants:
 * 1. Zero state mutations (pure function, does not modify input snapshot).
 * 2. Purely derives score, Level 1~5, blocking issues, and gate authorization state.
 * 3. Does not permit unapproved readiness states to manufacture canGenerateDocs=true.
 */
export function readinessProjection(snapshot: ProjectSnapshot): ReadinessView {
  const currentReadiness = snapshot.readiness?.current;
  const decisions = snapshot.decisions?.items || [];
  const openGaps = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open');
  const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');
  const assumptions = (snapshot.assumptions?.items || []).filter((a) => a.status === 'active');

  const requiredAreas = currentReadiness?.requiredAreas && currentReadiness.requiredAreas.length > 0
    ? currentReadiness.requiredAreas
    : [...CANONICAL_B3_AREAS];

  const ackConflicts = currentReadiness?.criticalConflictAcknowledgements || [];
  const ackIssues = currentReadiness?.knownIssueAcknowledgements || [];

  // 1. Derive Readiness Areas with Full Evidence & Recommended Fixes
  const areas: ReadinessAreaView[] = requiredAreas.map((areaId) => {
    const canonicalArea = AreaRegistry.normalize(areaId);
    const matchedDecisions = decisions.filter(
      (d) => (AreaRegistry.normalize(d.area) === canonicalArea || d.id === areaId) && (d.status === 'confirmed' || d.status === 'locked')
    );
    const blockingGaps = openGaps.filter((g) => AreaRegistry.normalize(g.area) === canonicalArea).map((g) => `gap:${g.id}` as GapRef);
    const areaAssumptions = assumptions
      .filter((a) => a.area && AreaRegistry.normalize(a.area) === canonicalArea)
      .map((a) => a.statement);

    const isSatisfied = matchedDecisions.length > 0 && blockingGaps.length === 0;
    const evidenceStatements = matchedDecisions.map((d) => d.statement);
    const primaryStatement = matchedDecisions[0]?.statement;

    // Provide contextual smart recommendation if area is not satisfied
    let recommendedFix: string | undefined;
    let recommendedFixReason: string | undefined;
    if (!isSatisfied) {
      const fixMap: Record<string, { fix: string; reason: string }> = {
        target_user: {
          fix: '首发版本优先聚焦单一明确的核心受众群体，暂不扩展大众多租户与复杂权限。',
          reason: '消除前期多租户隔离与账号体系负担，专注核心价值验证。',
        },
        mvp_scope: {
          fix: '严格收敛首发 MVP 核心闭环功能，将多余的衍生与辅助拓展特性列为二期。',
          reason: '以最小投入最快完成可用闭环，避免需求蔓延导致延期。',
        },
        core_features: {
          fix: '优先实现最高频的 1-2 个核心交互能力，次要操作后续版本逐步迭代。',
          reason: '单点突破能够保障首发体验顺畅，减少多模块交叉耦合。',
        },
        user_flows: {
          fix: '采用最简主干操作路径，省去多余的层级跳转与复杂前置配置。',
          reason: '降低初次使用认知门槛，使核心体验一目了然。',
        },
        page_structure: {
          fix: '优先采用单屏沉浸式主工作区/视图，设置与辅助功能使用抽屉抽离。',
          reason: '结构越聚焦，用户越容易感知产品核心价值。',
        },
        ux_ui_direction: {
          fix: '采用轻量简约、注重顺畅交互与核心氛围的设计风格。',
          reason: '保障前端渲染性能并大幅缩短前期素材与切图制作周期。',
        },
        technical_boundary: {
          fix: '优先采用轻量且自主可控的技术架构，降低对外部复杂云环境的强依赖。',
          reason: '极低的学习和维护门槛，便于快速本地运行与测试。',
        },
        delivery_plan: {
          fix: '以核心主流程可跑通且关键产物可验证作为首发阶段交付里程碑。',
          reason: '交付标准清晰客观，杜绝需求反复变更与延期。',
        },
      };
      const fixItem = fixMap[canonicalArea] || {
        fix: `确立关于“${AreaRegistry.getReadinessTitle(areaId)}”的首发轻量闭环决策。`,
        reason: '补齐该领域架构依据，保障工程交付完整度。',
      };
      recommendedFix = fixItem.fix;
      recommendedFixReason = fixItem.reason;
    }

    return {
      areaId,
      title: AreaRegistry.getReadinessTitle(areaId),
      isSatisfied,
      statement: primaryStatement,
      evidenceStatements: evidenceStatements.length > 0 ? evidenceStatements : undefined,
      activeAssumptions: areaAssumptions.length > 0 ? areaAssumptions : undefined,
      recommendedFix,
      recommendedFixReason,
      decisionRef: matchedDecisions[0] ? (`decision:${matchedDecisions[0].id}` as DecisionRef) : undefined,
      blockingGapRefs: blockingGaps,
    };
  });

  // 2. Derive Blocking Issues
  const blockingIssues: ReadinessIssueView[] = [];

  for (const c of openConflicts) {
    const isCritical = c.severity === 'critical';
    const isAck = ackConflicts.includes(`conflict:${c.id}`) || ackConflicts.includes(c.id);
    const conflictMessage = c.reason
      ? `Conflict: ${c.propositionA} vs ${c.propositionB} (${c.reason})`
      : `Conflict: ${c.propositionA} vs ${c.propositionB}`;

    blockingIssues.push({
      id: `conflict:${c.id}`,
      severity: isCritical ? 'critical' : 'high',
      message: conflictMessage,
      targetRef: `conflict:${c.id}`,
      isAcknowledged: isAck,
    });
  }

  for (const g of openGaps) {
    if (g.severity === 'critical' || g.severity === 'high') {
      const isAck = ackIssues.includes(`gap:${g.id}`) || ackIssues.includes(g.id);
      blockingIssues.push({
        id: `gap:${g.id}`,
        severity: g.severity === 'critical' ? 'critical' : 'high',
        message: `Gap in ${AreaRegistry.getReadinessTitle(g.area)}: ${g.reason || g.impact || 'Unresolved dependency'}`,
        targetRef: `gap:${g.id}`,
        isAcknowledged: isAck,
      });
    }
  }

  // 3. Derive Score & Level (1 to 5) via SSOT ReadinessEvaluator
  const evalResult = new ReadinessEvaluator().evaluate(snapshot);
  const score = evalResult.score;
  const overallScore = evalResult.score;

  const satisfiedCount = areas.filter((a) => a.isSatisfied).length;
  const areaRatio = areas.length > 0 ? satisfiedCount / areas.length : 0;
  const hasUnackCritical = blockingIssues.some((i) => i.severity === 'critical' && !i.isAcknowledged);

  // Credibility calculation (0 - 100):
  // Coverage measures completeness; Credibility measures trustworthiness.
  // Assumptions strictly penalize or maintain, NEVER award positive points.
  let credibility = 100;
  credibility -= openConflicts.filter((c) => c.severity === 'critical').length * 30;
  credibility -= openGaps.filter((g) => g.severity === 'critical').length * 20;
  credibility -= openGaps.filter((g) => g.severity === 'high').length * 10;
  credibility -= assumptions.length * 5;
  credibility -= Math.round((1 - areaRatio) * 40);
  const credibilityScore = Math.max(0, Math.min(100, credibility));

  let level: 1 | 2 | 3 | 4 | 5 = 1;
  if (score >= 90 && !hasUnackCritical && areaRatio === 1) {
    level = 5;
  } else if (score >= 75 && !hasUnackCritical) {
    level = 4;
  } else if (score >= 55) {
    level = 3;
  } else if (score >= 35) {
    level = 2;
  } else {
    level = 1;
  }

  const status = currentReadiness?.status || (level >= 4 ? 'ready' : level >= 3 ? 'ready-with-warnings' : 'not-ready');
  const isReadyForDocs = status === 'ready' || status === 'ready-with-warnings';
  const userDisposition = currentReadiness?.userDisposition || 'pending';

  // Can generate docs iff ReadinessGate allows it
  const gateResult = new ReadinessGate().canGenerateDocuments(snapshot);
  const canGenerateDocs = gateResult.allowed;

  const warnings = currentReadiness?.warnings && currentReadiness.warnings.length > 0
    ? [...currentReadiness.warnings]
    : [...evalResult.warnings];
  if (assumptions.length > 0 && !warnings.some((w) => w.includes('assumption'))) {
    warnings.push(`${assumptions.length} active assumption(s) currently apply.`);
  }

  const currentRevision = snapshot.metadata.stateRevision;
  const basisRevision = currentReadiness?.basisRevision ?? currentRevision;
  const isStale = Boolean(currentReadiness && currentRevision > basisRevision + 1);

  const coverage = {
    total: areas.length,
    satisfied: satisfiedCount,
    ratio: areaRatio,
  };

  const actions = ReadinessActionPolicy.evaluateActions(snapshot);
  const scoreBreakdown = evalResult.scoreBreakdown || [];

  // 5. Smart Recommended Disposition & One-click Approval
  let recommendedDisposition: UserDisposition = 'approved';
  let canDirectlyApprove = false;
  const approvalBlockers: string[] = [];

  const fullApproveAction = actions.find((a) => a.disposition === 'approved');
  const warningsAction = actions.find((a) => a.disposition === 'approved-with-warnings');
  const issuesAction = actions.find((a) => a.disposition === 'approved-with-known-issues');

  if (fullApproveAction && fullApproveAction.enabled) {
    recommendedDisposition = 'approved';
    canDirectlyApprove = true;
  } else if (warningsAction && warningsAction.enabled) {
    recommendedDisposition = 'approved-with-warnings';
    canDirectlyApprove = true;
  } else if (issuesAction && issuesAction.enabled) {
    recommendedDisposition = 'approved-with-known-issues';
    canDirectlyApprove = true;
  } else {
    recommendedDisposition = 'return-to-discovery';
    canDirectlyApprove = false;
    if (fullApproveAction?.blockedReasons && fullApproveAction.blockedReasons.length > 0) {
      approvalBlockers.push(...fullApproveAction.blockedReasons);
    }
  }

  return {
    basisRevision,
    currentRevision,
    isStale,
    coverage,
    credibilityScore,
    areas,
    actions,
    scoreBreakdown,
    recommendedDisposition,
    canDirectlyApprove,
    approvalBlockers: approvalBlockers.length > 0 ? approvalBlockers : undefined,

    // Compatibility fields
    sourceStateRevision: currentRevision,
    projectId: snapshot.metadata.projectId,
    level,
    score,
    overallScore,
    status,
    isReadyForDocs,
    userDisposition,
    blockingIssues,
    warnings,
    activeAssumptions: assumptions.map((a) => ({
      ref: `assumption:${a.id}` as const,
      statement: a.statement,
      reason: a.reason,
    })),
    canGenerateDocs,
  };
}
