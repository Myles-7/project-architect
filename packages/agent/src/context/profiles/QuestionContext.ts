import { BaseContextProfile, type ContextProfilePayload } from './BaseContextProfile.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export class QuestionContext extends BaseContextProfile {
  build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string {
    const sections: string[] = [];

    // 1. Header
    sections.push(this.renderProjectHeader(snapshot, 'Question Generation'));

    // 2. Confirmed & Locked Decisions (Anti-repetition anchor)
    const decs = this.renderDecisions(snapshot);
    if (decs) sections.push(decs);

    // 3. User Response to Previous Question (if answering)
    const input = this.renderUserInput(payload);
    if (input) sections.push(input);

    // 4. Top Critical/High Gaps (The exact target of questions)
    const openGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open');
    if (openGaps.length > 0) {
      const list = openGaps
        .slice(0, 5)
        .map((g) => `- [${g.severity.toUpperCase()}] Area: ${g.area} | Reason: ${g.reason} | Impact: ${g.impact}`)
        .join('\n');
      sections.push(`## Prioritized Gaps Requiring Questioning\n${list}`);
    }

    // 5. Question Budget & Rules Reminder
    sections.push(`## Question Constraints
- Critical/High: Exactly 1 primary question (+1 direct dependent max).
- Include whyNow (what decision is blocked), product-level recommendation with tradeoffs, and multi-choice options with impact.
- NEVER repeat already confirmed facts.`);

    return this.truncateToBudget(sections.filter(Boolean).join('\n\n'));
  }
}
