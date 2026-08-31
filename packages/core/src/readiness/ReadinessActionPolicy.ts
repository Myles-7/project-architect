import {
  type ProjectSnapshot,
  type ReadinessActionView,
  CORE_DISCOVERY_AREA_IDS,
} from '@project-architect/contracts';
import { AreaRegistry } from '../areas/AreaRegistry.js';

export class ReadinessActionPolicy {
  /**
   * Evaluates all available user disposition actions based on project snapshot evidence,
   * revision staleness, and unacknowledged gaps/conflicts.
   */
  static evaluateActions(snapshot: ProjectSnapshot): ReadinessActionView[] {
    const currentReadiness = snapshot.readiness?.current;
    const currentRev = snapshot.metadata.stateRevision;
    const basisRev = currentReadiness?.basisRevision ?? currentRev;
    const isStale = Boolean(currentReadiness && currentRev > basisRev + 1);

    const decisions = snapshot.decisions?.items || [];
    const confirmedDecisions = decisions.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );

    const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');
    const openCriticalConflicts = openConflicts.filter((c) => c.severity === 'critical');

    const openGaps = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open');
    const openCriticalGaps = openGaps.filter((g) => g.severity === 'critical');
    const openHighGaps = openGaps.filter((g) => g.severity === 'high');

    // 8 core areas satisfaction
    const unsatisfiedAreas: { id: string; title: string }[] = [];
    for (const areaId of CORE_DISCOVERY_AREA_IDS) {
      const canonicalArea = AreaRegistry.normalize(areaId);
      const hasDecision = confirmedDecisions.some(
        (d) => AreaRegistry.normalize(d.area) === canonicalArea || d.id === areaId
      );
      const hasBlockingGap = openCriticalGaps.some(
        (g) => AreaRegistry.normalize(g.area) === canonicalArea
      );
      if (!hasDecision || hasBlockingGap) {
        unsatisfiedAreas.push({ id: areaId, title: AreaRegistry.getTitle(areaId) });
      }
    }

    const mandatoryMissing = unsatisfiedAreas.some(
      (a) => a.id === 'target_user' || a.id === 'mvp_scope'
    );

    const actions: ReadinessActionView[] = [];

    // 1. Return to discovery (always enabled)
    actions.push({
      disposition: 'return-to-discovery',
      label: '返回发散探索',
      description: '撤销或暂缓批准，返回问答与推演阶段补充更多架构信息。',
      enabled: true,
      requiredAcknowledgementRefs: [],
      blockedReasons: [],
    });

    // 2. Full Approval
    const fullApprovedBlocked: string[] = [];
    if (isStale) {
      fullApprovedBlocked.push(
        `当前准备度评估已过期 (基于 rev.${basisRev}，当前为 rev.${currentRev})，请先重新执行评估。`
      );
    }
    if (openCriticalConflicts.length > 0) {
      fullApprovedBlocked.push(
        `存在 ${openCriticalConflicts.length} 项未解决的严重排他性冲突，不可完全批准。`
      );
    }
    if (openCriticalGaps.length > 0) {
      fullApprovedBlocked.push(
        `存在 ${openCriticalGaps.length} 项未解决的严重核心缺口，不可完全批准。`
      );
    }
    if (unsatisfiedAreas.length > 0) {
      fullApprovedBlocked.push(
        `尚有 ${unsatisfiedAreas.length} 个核心领域未闭环: ${unsatisfiedAreas.map((a) => a.title).join('、')}。`
      );
    }
    actions.push({
      disposition: 'approved',
      label: '完全批准 (Approved)',
      description: '核心八大领域均有明确确认或锁定的决策，且无任何待解决的冲突或严重缺陷。',
      enabled: fullApprovedBlocked.length === 0,
      requiredAcknowledgementRefs: [],
      blockedReasons: fullApprovedBlocked,
    });

    // 3. Approved with Warnings
    const warningsBlocked: string[] = [];
    if (isStale) {
      warningsBlocked.push(
        `当前准备度评估已过期 (基于 rev.${basisRev}，当前为 rev.${currentRev})，请先重新执行评估。`
      );
    }
    if (openCriticalConflicts.length > 0) {
      warningsBlocked.push('存在严重冲突，无法以“带警示”批准，需采用冲突免责签署。');
    }
    if (openCriticalGaps.length > 0) {
      warningsBlocked.push('存在严重核心缺口，不可仅凭普通警示批准。');
    }
    if (mandatoryMissing) {
      warningsBlocked.push('目标用户或首发 MVP 范围尚未闭环，不可带警示批准。');
    }
    actions.push({
      disposition: 'approved-with-warnings',
      label: '带警示批准 (Approved with Warnings)',
      description: '核心领域已满足，知悉并接受非致命性警示与假设，授权开工。',
      enabled: warningsBlocked.length === 0,
      requiredAcknowledgementRefs: [],
      blockedReasons: warningsBlocked,
    });

    // 4. Approved with Known Issues
    const issuesBlocked: string[] = [];
    if (isStale) {
      issuesBlocked.push(
        `当前准备度评估已过期 (基于 rev.${basisRev}，当前为 rev.${currentRev})，请先重新执行评估。`
      );
    }
    if (openCriticalConflicts.length > 0) {
      issuesBlocked.push('存在严重冲突，必须使用“冲突免责批准”。');
    }
    const requiredGaps = [...openCriticalGaps, ...openHighGaps].map((g) => `gap:${g.id}`);
    actions.push({
      disposition: 'approved-with-known-issues',
      label: '带已知缺陷批准 (Approved with Known Issues)',
      description: '知悉高优或严重产品缺口，经逐项勾选确认后放行文档编译。',
      enabled: issuesBlocked.length === 0,
      requiredAcknowledgementRefs: requiredGaps,
      blockedReasons: issuesBlocked,
    });

    // 5. Approved with Critical Conflicts
    const conflictBlocked: string[] = [];
    if (isStale) {
      conflictBlocked.push(
        `当前准备度评估已过期 (基于 rev.${basisRev}，当前为 rev.${currentRev})，请先重新执行评估。`
      );
    }
    if (openCriticalConflicts.length === 0) {
      conflictBlocked.push('当前项目不存在严重排他性冲突，无需使用此签署。');
    }
    const requiredConflicts = openCriticalConflicts.map((c) => `conflict:${c.id}`);
    actions.push({
      disposition: 'approved-with-critical-conflicts',
      label: '带严重冲突批准 (Approved with Critical Conflicts)',
      description: '已知悉严重排他性冲突并自愿承担架构风险，签署免责声明后强行放行。',
      enabled: conflictBlocked.length === 0,
      requiredAcknowledgementRefs: requiredConflicts,
      blockedReasons: conflictBlocked,
    });

    return actions;
  }
}
