import { BaseContextProfile, type ContextProfilePayload } from './BaseContextProfile.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export class DecisionReviewContext extends BaseContextProfile {
  build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string {
    const sections: string[] = [];

    // 1. Header
    sections.push(this.renderProjectHeader(snapshot, 'Decision Review & Impact Analysis'));

    // 2. All Existing Decisions (with status, especially locked)
    const allDecs = snapshot.decisions.items
      .filter((d) => d.status !== 'rejected')
      .map((d) => `- [${d.status.toUpperCase()}] id: ${d.id} | area: ${d.area} | ${d.statement}`)
      .join('\n');
    sections.push(`## Current Project Decisions\n${allDecs}`);

    // 3. User Modification Request
    const input = this.renderUserInput(payload);
    if (input) sections.push(input);

    // 4. Review Focus Instructions
    sections.push(`## Review Lens: Decision Modification & Ripple Effect
- Identify if the user's new statement modifies or contradicts an existing Confirmed or Locked decision.
- If Locked decision is contradicted, flag as Conflict.
- Detect ripple effects on downstream features, user flows, or UX, and output appropriate Tensions/Risks.`);

    return this.truncateToBudget(sections.filter(Boolean).join('\n\n'));
  }
}
