import type { ProjectSnapshot } from '@project-architect/contracts';

export interface DocumentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DocumentValidator {
  /**
   * Validates compiled document text against canonical snapshot truth and checks Source Attribution authenticity.
   */
  validate(
    renderedDocs: Array<{ path: string; content: string }>,
    snapshot: ProjectSnapshot
  ): DocumentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check for unrendered template placeholders
    for (const doc of renderedDocs) {
      if (doc.content.includes('{{') || doc.content.includes('}}')) {
        errors.push(`文档 [${doc.path}] 包含未解析的模板占位符。`);
      }
    }

    // 2. Check that Candidates are NOT marked as [Confirmed: User] or [Locked: User]
    const candidateStatements = snapshot.decisions.items
      .filter((d) => d.status === 'candidate')
      .map((d) => d.statement);

    for (const doc of renderedDocs) {
      for (const cand of candidateStatements) {
        if (
          (doc.content.includes(`[Confirmed: User]`) || doc.content.includes(`[Locked: User]`)) &&
          doc.content.includes(cand)
        ) {
          errors.push(`文档 [${doc.path}] 违规将未确认 Candidate "${cand}" 标记为 Confirmed 或 Locked。`);
        }
      }
    }

    // 3. Check that all Locked decisions are explicitly present in AGENTS.md
    const agentsDoc = renderedDocs.find((d) => d.path === 'AGENTS.md');
    if (agentsDoc) {
      const lockedDecisions = snapshot.decisions.items.filter((d) => d.status === 'locked');
      for (const locked of lockedDecisions) {
        if (!agentsDoc.content.includes(locked.statement)) {
          errors.push(`AGENTS.md 缺少已锁定的核心决策: "${locked.statement}"。`);
        }
      }
    } else {
      errors.push('缺少核心入口文件 AGENTS.md。');
    }

    // 4. Source Attribution Authenticity Check
    const validDecisionIds = new Set(snapshot.decisions.items.map((d) => d.id));
    const validAssumptionIds = new Set(snapshot.assumptions.items.map((a) => a.id));

    const decisionSourceRegex = /Source:\s*Decision\s+([a-zA-Z0-9_-]+)/g;
    const assumptionSourceRegex = /Source:\s*Assumption\s+([a-zA-Z0-9_-]+)/g;

    for (const doc of renderedDocs) {
      // Validate Decision IDs
      let match: RegExpExecArray | null;
      while ((match = decisionSourceRegex.exec(doc.content)) !== null) {
        const id = match[1];
        if (id && !validDecisionIds.has(id)) {
          errors.push(`文档 [${doc.path}] 引用了不存在的 Decision 来源 ID: "${id}"。`);
        }
      }

      // Validate Assumption IDs
      while ((match = assumptionSourceRegex.exec(doc.content)) !== null) {
        const id = match[1];
        if (id && !validAssumptionIds.has(id)) {
          errors.push(`文档 [${doc.path}] 引用了不存在的 Assumption 来源 ID: "${id}"。`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
