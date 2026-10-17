import { DEFAULT_RUNTIME_CONFIG } from '@project-architect/contracts';
export class BaseContextProfile {
    config;
    constructor(config = DEFAULT_RUNTIME_CONFIG) {
        this.config = config;
    }
    renderProjectHeader(snapshot, modeName) {
        return `## Project Context (Mode: ${modeName})
- Project Name: ${snapshot.metadata.name}
- Stage: ${snapshot.metadata.stage}
- Tags: ${snapshot.metadata.projectTags.join(', ')}
- State Revision: ${snapshot.metadata.stateRevision}`;
    }
    renderDecisions(snapshot) {
        const confirmed = snapshot.decisions.items.filter((d) => d.status === 'confirmed' || d.status === 'locked');
        if (confirmed.length === 0)
            return '';
        const list = confirmed
            .slice(0, this.config.context.maxContextDecisions)
            .map((d) => `- [${d.status.toUpperCase()}] (${d.area}): ${d.statement}`)
            .join('\n');
        return `## Confirmed & Locked Decisions (Immutable Bounds)\n${list}`;
    }
    renderUserInput(payload) {
        const parts = [];
        if (payload.userMessage) {
            parts.push(`- User Statement: ${payload.userMessage}`);
        }
        if (payload.questionAnswer) {
            const opt = payload.questionAnswer.selectedOption ? `Selected: "${payload.questionAnswer.selectedOption}"` : '';
            const free = payload.questionAnswer.freeInput ? `Notes: "${payload.questionAnswer.freeInput}"` : '';
            parts.push(`- Question Response: ${[opt, free].filter(Boolean).join(' | ')}`);
        }
        if (parts.length === 0)
            return '';
        return `## Current Turn Input\n${parts.join('\n')}`;
    }
    truncateToBudget(text, maxChars = this.config.context.maxTotalContextChars) {
        if (text.length > maxChars) {
            const marker = '\n\n... [Context truncated to stay within character budget]';
            return text.slice(0, Math.max(0, maxChars - marker.length)) + marker;
        }
        return text;
    }
}
//# sourceMappingURL=BaseContextProfile.js.map