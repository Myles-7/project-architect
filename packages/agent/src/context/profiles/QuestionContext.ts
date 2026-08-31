import { BaseContextProfile, type ContextProfilePayload } from './BaseContextProfile.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export class QuestionContext extends BaseContextProfile {
  build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string {
    const sections: string[] = [];
    const currentQuestionId = payload.questionAnswer?.questionRef.replace(/^question:/, '');
    const currentQuestion = snapshot.questions.items.find((question) => question.id === currentQuestionId);
    const linkedGapId = currentQuestion?.issueRef.replace(/^gap:/, '');
    const linkedGap = snapshot.gaps.gaps.find((gap) => gap.id === linkedGapId);

    // 1. Header
    sections.push(this.renderProjectHeader(snapshot, 'Question Generation'));

    // 2. Confirmed & Locked Decisions (Anti-repetition anchor)
    const confirmed = snapshot.decisions.items.filter(
      (decision) => decision.status === 'confirmed' || decision.status === 'locked'
    );
    const focusedDecisions = [
      ...confirmed.filter((decision) => decision.status === 'locked'),
      ...confirmed.filter((decision) => decision.status !== 'locked' && decision.area === linkedGap?.area),
      ...confirmed.filter((decision) => decision.status !== 'locked' && decision.area !== linkedGap?.area),
    ].slice(0, 6);
    if (focusedDecisions.length > 0) {
      sections.push(`## Relevant Confirmed & Locked Decisions\n${focusedDecisions
        .map((decision) => {
          const statement = decision.statement.length > 600
            ? `${decision.statement.slice(0, 600)}…`
            : decision.statement;
          return `- [${decision.status.toUpperCase()}] (${decision.area}): ${statement}`;
        })
        .join('\n')}`);
    }

    // 3. User Response to Previous Question (if answering)
    const input = this.renderUserInput(payload);
    if (input) sections.push(input);

    // 4. Concise Answered / Dismissed Key Anchor (Avoid re-asking)
    const answeredKeys = snapshot.questions.items
      .filter((q) => q.status === 'answered' || q.status === 'dismissed')
      .map((q) => q.decisionKey || q.id)
      .filter(Boolean);
    if (answeredKeys.length > 0) {
      sections.push(
        `## Already Resolved Decision Keys (Do Not Re-ask)\n${answeredKeys
          .slice(-12)
          .map((k) => `- ${k}`)
          .join('\n')}`
      );
    }

    // 5. Broad prioritized gap pool for the B3 independent question set.
    const openGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open');
    if (openGaps.length > 0) {
      const prioritizedGaps = [
        ...(linkedGap && linkedGap.status === 'open' ? [linkedGap] : []),
        ...openGaps.filter((gap) => gap.id !== linkedGap?.id),
      ].slice(0, 12);
      const list = prioritizedGaps
        .map((g) => `- [${g.severity.toUpperCase()}] Area: ${g.area} | Reason: ${g.reason} | Impact: ${g.impact}`)
        .join('\n');
      sections.push(`## Prioritized Gaps Requiring Questioning\n${list}`);
    }

    sections.push(`## B3 Question Constraints
- The runtime stage and hard budget below are authoritative.
- Return the largest useful independent set within that budget.
- Every gap and question needs decision_key and depends_on.
- Include whyNow, a product-level recommendation, and options with impact.
- NEVER repeat already confirmed facts or emit a question with an unresolved dependency.`);

    return this.truncateToBudget(sections.filter(Boolean).join('\n\n'), 12_000);
  }
}
