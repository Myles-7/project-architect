import { BaseContextProfile, type ContextProfilePayload } from './BaseContextProfile.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export class IdeaAnalysisContext extends BaseContextProfile {
  build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string {
    const sections: string[] = [];

    // 1. Header
    sections.push(this.renderProjectHeader(snapshot, 'Idea Analysis'));

    // 2. User Input / Raw Idea
    const input = this.renderUserInput(payload);
    if (input) sections.push(input);

    // 3. Materials (if uploaded with initial idea)
    if (payload.inputMaterials && payload.inputMaterials.length > 0) {
      const list = payload.inputMaterials
        .slice(0, 3)
        .map((m) => `### Attachment: ${m.label}\n${m.text.slice(0, this.config.context.maxMaterialExcerptChars)}`)
        .join('\n\n');
      sections.push(`## Uploaded Input Materials\n${list}`);
    }

    // 4. Instructions for Idea Analysis
    sections.push(`## Mode Focus: Initial Idea Understanding
- Extract core product identity, target user hypothesis, and initial unknown areas.
- Suggest first-turn candidates and low-risk reversible assumptions.
- Strictly adhere to Capability Before Mechanism (no premature framework/database leaks).`);

    return this.truncateToBudget(sections.filter(Boolean).join('\n\n'));
  }
}
