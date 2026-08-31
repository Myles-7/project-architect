import type {
  ProjectSnapshot,
  DiscoveryResult,
  DecisionItem,
  AssumptionItem,
  ConflictItem,
  RiskItem,
  DecisionRef,
  TypedRef,
} from '@project-architect/contracts';
import { LightweightConflictDetector } from '../conflicts/LightweightConflictDetector.js';
import { AreaRegistry } from '../areas/AreaRegistry.js';

export type SuggestionRiskLevel = 'low' | 'medium' | 'high';

export interface ProcessedPolicyOutput {
  newCandidates: DecisionItem[];
  newAssumptions: AssumptionItem[];
  newConflicts: ConflictItem[];
  newRisks: RiskItem[];
  discardedCounts: Record<string, number>;
}

export interface DecisionImpactAnalysis {
  affectedSections: string[];
  warnings: string[];
  tensions: Array<{ description: string; reason: string }>;
}

export class DecisionPolicyEngine {
  private conflictDetector: LightweightConflictDetector;

  constructor(conflictDetector: LightweightConflictDetector = new LightweightConflictDetector()) {
    this.conflictDetector = conflictDetector;
  }

  /**
   * Analyzes downstream ripple effects when an existing decision statement is modified.
   */
  detectDecisionImpact(
    area: string,
    oldStatement: string,
    newStatement: string,
    _snapshot?: ProjectSnapshot
  ): DecisionImpactAnalysis {
    const affectedSections: string[] = [];
    const warnings: string[] = [];
    const tensions: Array<{ description: string; reason: string }> = [];

    const normArea = area.toLowerCase().trim();
    const oldLower = oldStatement.toLowerCase();
    const newLower = newStatement.toLowerCase();

    // 1. Target User modifications (e.g. individual -> team / enterprise)
    if (normArea === 'target_user' || normArea.includes('user')) {
      const wasIndividual = /个人|单人|独立|individual|single/.test(oldLower);
      const isTeam = /团队|企业|多人|协同|team|enterprise|multi-user|collaboration/.test(newLower);

      if (wasIndividual && isTeam) {
        affectedSections.push('core_features', 'user_flows', 'ux_ui', 'technical_boundary');
        warnings.push('目标用户由个人变更为团队/协同，将直接增加权限系统、数据同步与多人冲突处理的复杂度。');
        tensions.push({
          description: '用户画像由单人扩展为团队协同',
          reason: '原有单机数据流需适配多端同步与团队权限模型，MVP 范围可能显著扩大。',
        });
      }
    }

    // 2. Platform / Technical Boundary modifications (e.g. Desktop -> Web / Mobile)
    if (normArea === 'technical_boundary' || normArea.includes('platform')) {
      const wasDesktop = /桌面|desktop|local|本地|electron|tauri/.test(oldLower);
      const isWebOrCloud = /web|云端|cloud|浏览器|mobile|移动端/.test(newLower);

      if (wasDesktop && isWebOrCloud) {
        affectedSections.push('mvp_scope', 'trust_safety', 'user_flows');
        warnings.push('平台由纯桌面本地变更为 Web/云端，原有本地存储与数据所有权承诺需要重新评估。');
        tensions.push({
          description: '平台由本地桌面扩展为 Web/云端',
          reason: '需要引入网络状态管理、云端同步以及服务端安全隐私审计。',
        });
      }
    }

    // 3. MVP Scope modifications
    if (normArea === 'mvp_scope' || normArea.includes('scope')) {
      affectedSections.push('user_flows', 'core_features');
      warnings.push('MVP 范围调整，建议重新检查核心流程中各步骤的优先级。');
    }

    return {
      affectedSections: Array.from(new Set(affectedSections)),
      warnings,
      tensions,
    };
  }

  /**
   * Classifies a product suggestion into Low, Medium, or High risk.
   */
  classifyRisk(text: string, area: string = 'general'): SuggestionRiskLevel {
    const lower = text.toLowerCase();
    const cleanArea = area.toLowerCase();

    // High risk indicators: Architecture boundary, destructive, privacy, platform exclusive, core monetization
    if (
      cleanArea.includes('security') ||
      cleanArea.includes('privacy') ||
      lower.includes('delete') ||
      lower.includes('destroy') ||
      lower.includes('exclusive') ||
      lower.includes('only') ||
      lower.includes('charge') ||
      lower.includes('paid') ||
      lower.includes('subscription') ||
      lower.includes('permission') ||
      lower.includes('auth')
    ) {
      return 'high';
    }

    // Low risk indicators: Reversible defaults, buffer sizes, caching, cosmetic settings, logging
    if (
      cleanArea.includes('ux') ||
      lower.includes('default') ||
      lower.includes('buffer') ||
      lower.includes('cache') ||
      lower.includes('log') ||
      lower.includes('theme') ||
      lower.includes('window size') ||
      lower.includes('history length') ||
      lower.includes('timeout')
    ) {
      return 'low';
    }

    // Default to Medium risk (requires user confirmation)
    return 'medium';
  }

  /**
   * Processes incoming AI discovery suggestions against Project State,
   * routing Low-risk to Assumptions, Medium-risk to Candidates, and detecting Conflicts against Locked decisions.
   */
  processDiscoverySuggestions(
    snapshot: ProjectSnapshot,
    discoveryResult: DiscoveryResult
  ): ProcessedPolicyOutput {
    const timestamp = new Date().toISOString();
    const lockedDecisions = snapshot.decisions.items.filter((d) => d.status === 'locked');
    const lockedStatements = new Set(
      lockedDecisions.map((d) => d.statement.trim().toLowerCase())
    );
    const existingStatements = new Set(
      snapshot.decisions.items
        .filter((d) => d.status !== 'superseded' && d.status !== 'rejected')
        .map((d) => d.statement.trim().toLowerCase())
    );

    const newCandidates: DecisionItem[] = [];
    const newAssumptions: AssumptionItem[] = [];
    const newRisks: RiskItem[] = [];
    const candidateTextsForConflictCheck: string[] = [];
    const discardedCounts: Record<string, number> = {
      duplicateCandidates: 0,
      lockedCollisions: 0,
      duplicateAssumptions: 0,
    };

    // 1. Ingest explicit AI assumptions
    for (const rawAsm of discoveryResult.assumptions || []) {
      const stmt = rawAsm.statement.trim();
      if (!stmt) continue;

      if (lockedStatements.has(stmt.toLowerCase())) {
        discardedCounts.lockedCollisions = (discardedCounts.lockedCollisions ?? 0) + 1;
        continue;
      }

      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim().toLowerCase() === stmt.toLowerCase() && a.status === 'active'
      );
      if (!exists) {
        const area = AreaRegistry.normalize(rawAsm.area);
        newAssumptions.push({
          id: `asm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          area,
          decisionKey: rawAsm.decision_key,
          statement: stmt,
          reason: rawAsm.reason,
          status: 'active',
          createdAt: timestamp,
        });
      } else {
        discardedCounts.duplicateAssumptions = (discardedCounts.duplicateAssumptions ?? 0) + 1;
      }
    }

    // 2. Classify and route candidates
    for (const rawCand of discoveryResult.candidates || []) {
      const stmt = rawCand.statement.trim();
      if (!stmt) continue;

      if (lockedStatements.has(stmt.toLowerCase())) {
        discardedCounts.lockedCollisions = (discardedCounts.lockedCollisions ?? 0) + 1;
        continue;
      }

      if (existingStatements.has(stmt.toLowerCase())) {
        discardedCounts.duplicateCandidates = (discardedCounts.duplicateCandidates ?? 0) + 1;
        continue;
      }

      candidateTextsForConflictCheck.push(stmt);
      const risk = this.classifyRisk(stmt);

      const area = AreaRegistry.normalize(rawCand.area);

      if (risk === 'low') {
        // Low risk -> route to active assumption
        newAssumptions.push({
          id: `asm-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          area,
          decisionKey: rawCand.decision_key,
          statement: stmt,
          reason: rawCand.rationale,
          status: 'active',
          createdAt: timestamp,
        });
      } else {
        // Medium / High risk -> propose as candidate
        newCandidates.push({
          id: `cand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          area,
          statement: stmt,
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          decisionKey: rawCand.decision_key,
          rationale: rawCand.rationale,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // 3. Process Risks (Task 2.5)
    for (const rawRisk of discoveryResult.risks || []) {
      const stmt = rawRisk.statement.trim();
      if (!stmt) continue;

      const riskKey = rawRisk.risk_key;
      const area = AreaRegistry.normalize(rawRisk.area);
      const severity = rawRisk.severity;
      const impact = rawRisk.impact;

      newRisks.push({
        id: `rsk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        riskKey,
        area,
        statement: stmt,
        description: stmt,
        severity,
        impact,
        status: 'identified',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // 4. Locked Immutability & Conflict Detection
    const detectedConflicts = this.conflictDetector.detectConflicts(
      lockedDecisions,
      candidateTextsForConflictCheck
    );

    const newConflicts: ConflictItem[] = detectedConflicts.map((conf) => ({
      id: `cnf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      propositionA: conf.propositionA,
      propositionB: conf.propositionB,
      decisionRefs: conf.decisionRefs,
      severity: conf.severity,
      reason: conf.reason,
      status: 'open',
    }));

    return {
      newCandidates,
      newAssumptions,
      newConflicts,
      newRisks,
      discardedCounts,
    };
  }

  /**
   * Promotes an Assumption to a Confirmed Decision upon user explicit confirmation.
   */
  promoteAssumptionToDecision(
    snapshot: ProjectSnapshot,
    assumptionId: string,
    targetArea: string = 'general'
  ): { updatedAssumption: AssumptionItem; newDecision: DecisionItem } {
    const timestamp = new Date().toISOString();
    const asm = snapshot.assumptions.items.find((a) => a.id === assumptionId || `assumption:${a.id}` === assumptionId);
    if (!asm) {
      throw new Error(`Assumption "${assumptionId}" not found in project state`);
    }

    asm.status = 'converted';
    asm.resolvedAt = timestamp;

    const newDecId = `dec-${Date.now()}`;
    const newDecision: DecisionItem = {
      id: newDecId,
      area: targetArea,
      statement: asm.statement,
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [`assumption:${asm.id}` as TypedRef],
      confirmedBy: 'user',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    asm.linkedDecisionRefs = [`decision:${newDecId}` as DecisionRef];

    return { updatedAssumption: asm, newDecision };
  }

  /**
   * Promotes a Candidate to Confirmed upon user explicit confirmation.
   */
  promoteCandidateToConfirmed(
    snapshot: ProjectSnapshot,
    candidateId: string
  ): DecisionItem {
    const timestamp = new Date().toISOString();
    const cand = snapshot.decisions.items.find((d) => d.id === candidateId || `decision:${d.id}` === candidateId);
    if (!cand) {
      throw new Error(`Decision/Candidate "${candidateId}" not found in project state`);
    }

    cand.status = 'confirmed';
    cand.confirmedBy = 'user';
    cand.updatedAt = timestamp;

    return cand;
  }

  /**
   * Handles user direct edit on Overview items, preserving full traceability and supersession.
   */
  handleUserDirectEdit(
    snapshot: ProjectSnapshot,
    sectionId: string,
    existingDecisionRef: string | undefined,
    newStatement: string
  ): { finalDecisionRef: DecisionRef; affectedDecision?: DecisionItem; newDecision: DecisionItem } {
    const timestamp = new Date().toISOString();
    let existingItem: DecisionItem | undefined;

    if (existingDecisionRef) {
      const cleanId = existingDecisionRef.replace(/^decision:/, '');
      existingItem = snapshot.decisions.items.find((d) => d.id === cleanId);
    }

    if (existingItem && existingItem.status === 'locked') {
      // Locked item is superseded by user direct edit
      existingItem.status = 'superseded';
      existingItem.updatedAt = timestamp;

      const newId = `dec-${Date.now()}`;
      const newRef = `decision:${newId}` as DecisionRef;
      existingItem.supersededBy = newRef;

      const newDecision: DecisionItem = {
        id: newId,
        area: sectionId,
        statement: newStatement,
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [`decision:${existingItem.id}` as TypedRef],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return {
        finalDecisionRef: newRef,
        affectedDecision: existingItem,
        newDecision,
      };
    } else if (existingItem) {
      // Update non-locked decision directly to confirmed
      existingItem.statement = newStatement;
      existingItem.status = 'confirmed';
      existingItem.origin = 'user';
      existingItem.confirmedBy = 'user';
      existingItem.updatedAt = timestamp;

      return {
        finalDecisionRef: `decision:${existingItem.id}` as DecisionRef,
        affectedDecision: existingItem,
        newDecision: existingItem,
      };
    } else {
      // Create new decision
      const newId = `dec-${Date.now()}`;
      const newRef = `decision:${newId}` as DecisionRef;
      const newDecision: DecisionItem = {
        id: newId,
        area: sectionId,
        statement: newStatement,
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return {
        finalDecisionRef: newRef,
        newDecision,
      };
    }
  }
}
