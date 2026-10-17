import type { PlanningContextAccess } from './PlanningContextAccess.js';
/** Only registered MCP calls, finish and exact registered image paths are executable.
 * No project state, home/brain directories, native writes, shell or delegation. */
export declare function preparePlanningToolGate(cwd: string, allowedTools: string[], registeredImages?: string[], materialRoots?: string[], contextAccess?: PlanningContextAccess): {
    hooksPath: string;
    scriptPath: string;
    auditPath: string;
    images: string[];
};
//# sourceMappingURL=PlanningToolGate.d.ts.map