import type {
  ProjectSnapshot,
  UserDisposition,
  TypedRef,
} from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';
import { ReadinessEvaluator, type ReadinessResult } from './ReadinessEvaluator.js';

export interface GateDecisionResult {
  allowed: boolean;
  reason?: string;
  blockingIssues?: string[];
  unacknowledgedConflicts?: string[];
  unacknowledgedIssues?: string[];
}

/**
 * ReadinessGate: The single source of truth for Readiness authorization and document compilation gatekeeping.
 */
export class ReadinessGate {
  private evaluator: ReadinessEvaluator;

  constructor(evaluator: ReadinessEvaluator = new ReadinessEvaluator()) {
    this.evaluator = evaluator;
  }

  evaluate(snapshot: ProjectSnapshot): ReadinessResult {
    return this.evaluator.evaluate(snapshot);
  }

  canSetDisposition(
    snapshot: ProjectSnapshot,
    disposition: UserDisposition,
    acknowledgedIssueRefs?: TypedRef[]
  ): GateDecisionResult {
    const validDispositions: UserDisposition[] = [
      'pending',
      'return-to-discovery',
      'approved',
      'approved-with-warnings',
      'approved-with-known-issues',
      'approved-with-critical-conflicts',
    ];

    if (!validDispositions.includes(disposition)) {
      return {
        allowed: false,
        reason: `Invalid user disposition: "${disposition}".`,
      };
    }

    if (disposition === 'return-to-discovery' || disposition === 'pending') {
      return { allowed: true };
    }

    const evalResult = this.evaluate(snapshot);
    const openCriticalConflicts = (snapshot.gaps?.conflicts || []).filter(
      (c) => c.status === 'open' && c.severity === 'critical'
    );
    const openHighGaps = (snapshot.gaps?.gaps || []).filter(
      (g) => g.status === 'open' && (g.severity === 'high' || g.severity === 'critical')
    );

    const existingAckIssues = snapshot.readiness?.current?.knownIssueAcknowledgements || [];
    const existingAckConflicts = snapshot.readiness?.current?.criticalConflictAcknowledgements || [];

    const newAckIssues: string[] = [];
    const newAckConflicts: string[] = [];

    if (Array.isArray(acknowledgedIssueRefs)) {
      for (const ref of acknowledgedIssueRefs) {
        if (ref.startsWith('conflict:') || ref.startsWith('cnf:')) {
          newAckConflicts.push(ref);
        } else {
          newAckIssues.push(ref);
        }
      }
    }

    const allAckConflicts = Array.from(new Set([...existingAckConflicts, ...newAckConflicts]));
    const allAckIssues = Array.from(new Set([...existingAckIssues, ...newAckIssues]));

    const unacknowledgedConflicts = openCriticalConflicts.filter(
      (c) => !allAckConflicts.includes(`conflict:${c.id}`) && !allAckConflicts.includes(c.id)
    );

    const unacknowledgedIssues = openHighGaps.filter(
      (g) => !allAckIssues.includes(`gap:${g.id}`) && !allAckIssues.includes(g.id)
    );

    if (unacknowledgedConflicts.length > 0) {
      return {
        allowed: false,
        reason: `Cannot approve readiness: Project has ${unacknowledgedConflicts.length} unacknowledged critical conflict(s). Must acknowledge each conflict or resolve them.`,
        unacknowledgedConflicts: unacknowledgedConflicts.map((c) => `conflict:${c.id}`),
        blockingIssues: evalResult.blockingIssues,
      };
    }

    if (openCriticalConflicts.length > 0 && disposition !== 'approved-with-critical-conflicts') {
      return {
        allowed: false,
        reason: `Cannot approve with "${disposition}" when critical conflicts exist: must use "approved-with-critical-conflicts".`,
        blockingIssues: evalResult.blockingIssues,
      };
    }

    if (unacknowledgedIssues.length > 0 && disposition === 'approved-with-known-issues') {
      return {
        allowed: false,
        reason: `Cannot approve: Project has ${unacknowledgedIssues.length} unacknowledged high/critical gap(s). Must acknowledge each gap explicitly.`,
        unacknowledgedIssues: unacknowledgedIssues.map((g) => `gap:${g.id}`),
        blockingIssues: evalResult.blockingIssues,
      };
    }

    if (openHighGaps.length > 0 && disposition === 'approved') {
      return {
        allowed: false,
        reason: `Cannot fully approve ("approved") when open high/critical gaps exist. Must use "approved-with-known-issues" or resolve the gaps.`,
        blockingIssues: evalResult.blockingIssues,
      };
    }

    if (!evalResult.ready) {
      if (
        disposition !== 'approved-with-known-issues' &&
        disposition !== 'approved-with-critical-conflicts'
      ) {
        return {
          allowed: false,
          reason: `Cannot approve with "${disposition}": Project failed base readiness checks (missing core areas or unresolved blockers).\n${evalResult.blockingIssues.join('\n')}`,
          blockingIssues: evalResult.blockingIssues,
        };
      }
    }

    return { allowed: true };
  }

  validateForDisposition(
    snapshot: ProjectSnapshot,
    disposition: UserDisposition,
    acknowledgedIssueRefs?: TypedRef[]
  ): void {
    const result = this.canSetDisposition(snapshot, disposition, acknowledgedIssueRefs);
    if (!result.allowed) {
      const err: any = new Error(result.reason || 'Readiness gate authorization failed.');
      err.code = ErrorCode.READINESS_NOT_APPROVED;
      err.details = result;
      throw err;
    }
  }

  canGenerateDocuments(snapshot: ProjectSnapshot): GateDecisionResult {
    const currentReadiness = snapshot.readiness?.current;
    const disposition = currentReadiness?.userDisposition || 'pending';
    const stage = snapshot.metadata.stage;

    // 1. User disposition check
    if (disposition === 'return-to-discovery') {
      return {
        allowed: false,
        reason: 'Cannot compile documents: User disposition returned project to discovery.',
      };
    }

    if (stage === 'readiness-review' && disposition === 'pending') {
      return {
        allowed: false,
        reason: 'Cannot compile documents: Project is under readiness review and requires explicit user approval / disposition.',
      };
    }

    // 2. Open Critical Conflicts check
    const openCriticalConflicts = (snapshot.gaps?.conflicts || []).filter(
      (c) => c.status === 'open' && c.severity === 'critical'
    );
    if (openCriticalConflicts.length > 0) {
      const hasConflictApproval =
        disposition === 'approved-with-critical-conflicts' &&
        (currentReadiness?.criticalConflictAcknowledgements?.length ?? 0) > 0;
      if (!hasConflictApproval) {
        return {
          allowed: false,
          reason: `Cannot compile documents: Project has ${openCriticalConflicts.length} unresolved critical conflict(s) that must be explicitly acknowledged and approved by user disposition.`,
          unacknowledgedConflicts: openCriticalConflicts.map((c) => `conflict:${c.id}`),
        };
      }
    }

    // 3. Readiness Evaluator criteria
    const evalResult = this.evaluate(snapshot);
    if (!evalResult.ready) {
      const isApprovedWithOverrides =
        disposition === 'approved-with-known-issues' ||
        disposition === 'approved-with-critical-conflicts' ||
        stage === 'approved';
      if (!isApprovedWithOverrides) {
        return {
          allowed: false,
          reason: `Cannot compile documents: Project failed readiness gate.\n${evalResult.blockingIssues.map((b) => `- ${b}`).join('\n')}`,
          blockingIssues: evalResult.blockingIssues,
        };
      }
    }

    return { allowed: true };
  }

  validateForDocumentGeneration(snapshot: ProjectSnapshot): void {
    const result = this.canGenerateDocuments(snapshot);
    if (!result.allowed) {
      const err: any = new Error(result.reason || 'Document compilation gate check failed.');
      err.code = ErrorCode.READINESS_NOT_APPROVED;
      err.details = result;
      throw err;
    }
  }
}
