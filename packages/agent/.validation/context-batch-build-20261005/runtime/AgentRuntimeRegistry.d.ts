import type { AgentMode } from '@project-architect/contracts';
import type { AgentRuntimeProfile } from './AgentRuntimeProfile.js';
export declare class AgentRuntimeRegistry {
    private profiles;
    constructor();
    /**
     * Retrieves the runtime profile bundle for an active AgentMode.
     */
    getProfile(mode: AgentMode): AgentRuntimeProfile;
}
//# sourceMappingURL=AgentRuntimeRegistry.d.ts.map