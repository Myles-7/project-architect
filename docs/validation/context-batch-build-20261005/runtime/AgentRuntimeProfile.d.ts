import type { AgentMode, TaskMode } from '@project-architect/contracts';
export interface AgentRuntimeProfile {
    mode: AgentMode;
    promptProfile: string;
    schemaProfile: string;
    contextProfile: string;
    policyProfile: string;
    task: TaskMode;
}
//# sourceMappingURL=AgentRuntimeProfile.d.ts.map