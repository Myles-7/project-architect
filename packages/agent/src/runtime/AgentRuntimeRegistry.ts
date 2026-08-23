import type { AgentMode } from '@project-architect/contracts';
import type { AgentRuntimeProfile } from './AgentRuntimeProfile.js';

export class AgentRuntimeRegistry {
  private profiles: Map<AgentMode, AgentRuntimeProfile>;

  constructor() {
    this.profiles = new Map<AgentMode, AgentRuntimeProfile>([
      [
        'idea-analysis',
        {
          mode: 'idea-analysis',
          promptProfile: 'idea-analysis',
          schemaProfile: 'idea-analysis',
          contextProfile: 'idea-analysis',
          policyProfile: 'default',
          task: 'discovery-turn',
        },
      ],
      [
        'gap-analysis',
        {
          mode: 'gap-analysis',
          promptProfile: 'gap-analysis',
          schemaProfile: 'gap-analysis',
          contextProfile: 'gap-analysis',
          policyProfile: 'default',
          task: 'discovery-turn',
        },
      ],
      [
        'question-generation',
        {
          mode: 'question-generation',
          promptProfile: 'question-generation',
          schemaProfile: 'question-generation',
          contextProfile: 'question-generation',
          policyProfile: 'question-budget',
          task: 'discovery-turn',
        },
      ],
      [
        'decision-review',
        {
          mode: 'decision-review',
          promptProfile: 'decision-review',
          schemaProfile: 'decision-review',
          contextProfile: 'decision-review',
          policyProfile: 'impact-conflict',
          task: 'discovery-turn',
        },
      ],
      [
        'readiness-review',
        {
          mode: 'readiness-review',
          promptProfile: 'readiness-review',
          schemaProfile: 'readiness-review',
          contextProfile: 'readiness-review',
          policyProfile: 'readiness-gate',
          task: 'discovery-turn',
        },
      ],
      [
        'document-compile',
        {
          mode: 'document-compile',
          promptProfile: 'document-compile',
          schemaProfile: 'document-compile',
          contextProfile: 'document-compile',
          policyProfile: 'compile-strict',
          task: 'discovery-turn',
        },
      ],
    ]);
  }

  /**
   * Retrieves the runtime profile bundle for an active AgentMode.
   */
  getProfile(mode: AgentMode): AgentRuntimeProfile {
    return (
      this.profiles.get(mode) || {
        mode,
        promptProfile: 'gap-analysis',
        schemaProfile: 'gap-analysis',
        contextProfile: 'gap-analysis',
        policyProfile: 'default',
        task: 'discovery-turn',
      }
    );
  }
}
