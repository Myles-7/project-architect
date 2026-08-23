import { BaseContextProfile, type ContextProfilePayload } from './BaseContextProfile.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export class GapAnalysisContext extends BaseContextProfile {
  build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string {
    const sections: string[] = [];

    // 1. Header
    sections.push(this.renderProjectHeader(snapshot, 'Gap Analysis'));

    // 2. Confirmed & Locked Decisions
    const decs = this.renderDecisions(snapshot);
    if (decs) sections.push(decs);

    // 3. Overview Maturity Projection
    const overviewList = snapshot.overview.sections
      .map((s) => `- [${s.maturity.toUpperCase()}] ${s.title} (${s.id})`)
      .join('\n');
    sections.push(`## Current Overview Section Maturity\n${overviewList}`);

    // 4. Checklist Quality Criteria Hints
    if (payload.checklistHints && payload.checklistHints.length > 0) {
      const list = payload.checklistHints
        .slice(0, this.config.context.maxChecklistHints)
        .map((h) => `- [${h.importance.toUpperCase()}] (${h.area}): ${h.criterion}`)
        .join('\n');
      sections.push(`## Standard Quality Criteria (Checklist Lens)\n${list}`);
    }

    // 5. Existing Open Gaps
    const openGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open');
    if (openGaps.length > 0) {
      const list = openGaps
        .slice(0, this.config.context.maxContextGaps)
        .map((g) => `- Open Gap (${g.area}, ${g.severity}): ${g.reason}`)
        .join('\n');
      sections.push(`## Existing Unresolved Gaps\n${list}`);
    }

    // 6. User Input
    const input = this.renderUserInput(payload);
    if (input) sections.push(input);

    return this.truncateToBudget(sections.filter(Boolean).join('\n\n'));
  }
}
