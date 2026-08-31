import type {
  ProjectSnapshot,
  MergedChecklistHint,
  AppRuntimeConfig,
} from '@project-architect/contracts';
import { DEFAULT_RUNTIME_CONFIG } from '@project-architect/contracts';

export interface ContextProfilePayload {
  userMessage?: string;
  questionAnswer?: {
    questionRef: string;
    selectedOption?: string;
    freeInput?: string;
  };
  checklistHints?: MergedChecklistHint[];
  inputMaterials?: Array<{ label: string; text: string }>;
}

export abstract class BaseContextProfile {
  protected config: AppRuntimeConfig;

  constructor(config: AppRuntimeConfig = DEFAULT_RUNTIME_CONFIG) {
    this.config = config;
  }

  abstract build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string;

  protected renderProjectHeader(snapshot: ProjectSnapshot, modeName: string): string {
    return `## Project Context (Mode: ${modeName})
- Project Name: ${snapshot.metadata.name}
- Stage: ${snapshot.metadata.stage}
- Tags: ${snapshot.metadata.projectTags.join(', ')}
- State Revision: ${snapshot.metadata.stateRevision}`;
  }

  protected renderDecisions(snapshot: ProjectSnapshot): string {
    const confirmed = snapshot.decisions.items.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );
    if (confirmed.length === 0) return '';
    const list = confirmed
      .slice(0, this.config.context.maxContextDecisions)
      .map((d) => `- [${d.status.toUpperCase()}] (${d.area}): ${d.statement}`)
      .join('\n');
    return `## Confirmed & Locked Decisions (Immutable Bounds)\n${list}`;
  }

  protected renderUserInput(payload: ContextProfilePayload): string {
    const parts: string[] = [];
    if (payload.userMessage) {
      parts.push(`- User Statement: ${payload.userMessage}`);
    }
    if (payload.questionAnswer) {
      const opt = payload.questionAnswer.selectedOption ? `Selected: "${payload.questionAnswer.selectedOption}"` : '';
      const free = payload.questionAnswer.freeInput ? `Notes: "${payload.questionAnswer.freeInput}"` : '';
      parts.push(`- Question Response: ${[opt, free].filter(Boolean).join(' | ')}`);
    }
    if (parts.length === 0) return '';
    return `## Current Turn Input\n${parts.join('\n')}`;
  }

  protected truncateToBudget(text: string, maxChars = this.config.context.maxTotalContextChars): string {
    if (text.length > maxChars) {
      const marker = '\n\n... [Context truncated to stay within character budget]';
      return text.slice(0, Math.max(0, maxChars - marker.length)) + marker;
    }
    return text;
  }
}
