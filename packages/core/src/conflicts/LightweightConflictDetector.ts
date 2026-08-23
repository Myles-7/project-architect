import type { DecisionItem, ConflictItem } from '@project-architect/contracts';

interface ConflictPattern {
  name: string;
  patternA: RegExp;
  patternB: RegExp;
  description: string;
}

const DETERMINISTIC_CONFLICT_PATTERNS: ConflictPattern[] = [
  {
    name: 'platform-desktop-vs-mobile-exclusive',
    patternA: /(?:desktop only|仅桌面端|仅支持桌面|仅限桌面|pure desktop)/i,
    patternB: /(?:must support mobile|仅手机端|移动端专属|仅支持移动|support mobile)/i,
    description: '同时声明了仅支持桌面端与必须支持移动端的排他性平台约束。',
  },
  {
    name: 'offline-vs-cloud-exclusive',
    patternA: /(?:offline|离线|禁止联网|禁止连接|完全不连外网|纯本地)/i,
    patternB: /(?:cloud sync|云同步|远程云端|上传到云端|同步到云|云端备份|云端服务器)/i,
    description: '同时声明了绝对完全离线与自动远程云同步的排他性数据流动约束。',
  },
  {
    name: 'pricing-free-vs-paid-exclusive',
    patternA: /(?:completely free|永久完全免费|绝接收费)/i,
    patternB: /(?:mandatory subscription|必须付费订阅|强制按月收费)/i,
    description: '商业模式上同时声明了完全永久免费与强制付费订阅的排他性承诺。',
  },
];

export class LightweightConflictDetector {
  /**
   * Detects deterministic conflicts between existing locked/confirmed decisions and new statements.
   */
  detectConflicts(
    existingDecisions: DecisionItem[],
    newStatements: string[]
  ): Array<Omit<ConflictItem, 'id' | 'status'>> {
    const detected: Array<Omit<ConflictItem, 'id' | 'status'>> = [];

    const activeDecisions = existingDecisions.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );

    for (const statement of newStatements) {
      for (const pattern of DETERMINISTIC_CONFLICT_PATTERNS) {
        // Case 1: Statement matches pattern B while an existing decision matches pattern A
        if (pattern.patternB.test(statement)) {
          const matchA = activeDecisions.find((d) => pattern.patternA.test(d.statement));
          if (matchA) {
            detected.push({
              propositionA: matchA.statement,
              propositionB: statement,
              decisionRefs: [`decision:${matchA.id}`],
              severity: 'critical',
              reason: pattern.description,
            });
          }
        }

        // Case 2: Statement matches pattern A while an existing decision matches pattern B
        if (pattern.patternA.test(statement)) {
          const matchB = activeDecisions.find((d) => pattern.patternB.test(d.statement));
          if (matchB) {
            detected.push({
              propositionA: matchB.statement,
              propositionB: statement,
              decisionRefs: [`decision:${matchB.id}`],
              severity: 'critical',
              reason: pattern.description,
            });
          }
        }
      }
    }

    return detected;
  }
}
