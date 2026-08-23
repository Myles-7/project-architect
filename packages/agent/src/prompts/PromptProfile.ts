import type { AgentMode } from '@project-architect/contracts';

export interface PromptProfile {
  mode: AgentMode;
  systemPrompt: string;
  taskInstruction: string;
  b2Rules: string[];
}
