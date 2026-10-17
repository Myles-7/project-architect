import { McpServer } from '@modelcontextprotocol/server';
import { PlanningToolsService, type PlanningToolsConfig } from './PlanningToolsService.js';
/** SDK v2 server. No shell, filesystem write, arbitrary process or delegation tools. */
export declare function createPlanningToolsMcpServer(service: PlanningToolsService): McpServer;
export declare function startPlanningToolsStdio(config: PlanningToolsConfig): Promise<McpServer>;
/** Registers only in the isolated workspace, preserving the user's global MCP configuration. */
export declare function preparePlanningWorkspace(config: PlanningToolsConfig, cwd: string): Promise<{
    configPath: string;
    mcpConfigPath: string;
    cwd: string;
}>;
//# sourceMappingURL=PlanningToolsMcpServer.d.ts.map