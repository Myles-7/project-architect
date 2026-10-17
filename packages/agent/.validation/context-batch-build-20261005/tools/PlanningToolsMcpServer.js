import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanningToolsService } from './PlanningToolsService.js';
const jsonResult = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const guarded = async (action) => { try {
    return await action();
}
catch (error) {
    return { isError: true, content: [{ type: 'text', text: String(error) }] };
} };
/** SDK v2 server. No shell, filesystem write, arbitrary process or delegation tools. */
export function createPlanningToolsMcpServer(service) {
    const server = new McpServer({ name: 'project-architect', version: '1.0.0' });
    server.registerTool('planning_context', { description: 'Prefer scan to batch complete frozen records into visible bounded pages: continue with offset=nextOffset and characterOffset=nextCharacterOffset until null. Independent review uses requiredOnly=true to cover all required records. Optional prefix selects a section. index/read remain available for single keys. Missing review reads prevent finish. Context is not new evidence or approval.', inputSchema: z.object({ action: z.enum(['index', 'read', 'scan']), prefix: z.string().optional(), key: z.string().optional(), offset: z.number().int().nonnegative().optional(), characterOffset: z.number().int().nonnegative().optional(), requiredOnly: z.boolean().optional(), length: z.number().int().min(1).max(4000).optional() }), annotations: { readOnlyHint: true } }, async (args) => guarded(async () => jsonResult(await service.readContext(args))));
    server.registerTool('material_index', { description: 'List registered materials with provenance and hashes.', inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () => guarded(async () => jsonResult(await service.materialIndex())));
    server.registerTool('material_read', { description: 'Read a range from a registered text/extracted material; nextOffset identifies unread content.', inputSchema: z.object({ id: z.string(), offset: z.number().int().nonnegative().optional(), length: z.number().int().min(1).max(262144).optional() }), annotations: { readOnlyHint: true } }, async (args) => guarded(async () => jsonResult(await service.readMaterial(args.id, args.offset, args.length))));
    server.registerTool('material_image', { description: 'Read actual bytes of a registered image, with provenance. Use image content to inspect it.', inputSchema: z.object({ id: z.string() }), annotations: { readOnlyHint: true } }, async (args) => guarded(async () => { const image = await service.readImage(args.id); const { data, ...metadata } = image; return { content: [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', data, mimeType: image.mimeType }] }; }));
    server.registerTool('research_read', { description: 'Read an HTTPS official page as compact text; full raw source is saved with hash/date. Read additional ranges with nextOffset; do not claim full-page understanding until nextOffset is null.', inputSchema: z.object({ url: z.string().url(), offset: z.number().int().nonnegative().optional(), length: z.number().int().min(1).max(32768).optional() }), annotations: { readOnlyHint: true, openWorldHint: true } }, async (args) => guarded(async () => jsonResult(await service.readResearch(args.url, args.offset, args.length))));
    server.registerTool('evidence_record', { description: 'Record candidate evidence with source, date, hash and scope; cannot confirm project facts.', inputSchema: z.object({ source: z.string().min(1), content: z.string().min(1), scope: z.string().min(1), conclusion: z.string().optional() }) }, async (args) => guarded(async () => jsonResult(await service.recordEvidence(args))));
    server.registerTool('environment_prepare', { description: 'Prepare a fixed isolated Docker Node/Python/Chromium image and exact dependency versions. Only generated dependency-manager commands run online; experiment source runs offline.', inputSchema: z.object({ runtime: z.enum(['node', 'python', 'chromium']), dependencies: z.array(z.object({ name: z.string(), version: z.string() })).optional() }) }, async (args, ctx) => guarded(async () => jsonResult(await service.prepareEnvironment(args.runtime, ctx.mcpReq.signal, args.dependencies))));
    server.registerTool('experiment_run', { description: 'Run submitted Node/Python/Chromium source in an existing approved Docker image, using only an isolated source mount and network none. Missing environment is unavailable, never pass.', inputSchema: z.object({ runtime: z.enum(['node', 'python', 'chromium']), source: z.string().min(1), timeoutMs: z.number().int().min(1000).max(600000).optional() }) }, async (args, ctx) => guarded(async () => jsonResult(await service.runExperiment({ ...args, abortSignal: ctx.mcpReq.signal }))));
    return server;
}
export async function startPlanningToolsStdio(config) {
    const server = createPlanningToolsMcpServer(new PlanningToolsService(config));
    await server.connect(new StdioServerTransport());
    return server;
}
/** Registers only in the isolated workspace, preserving the user's global MCP configuration. */
export async function preparePlanningWorkspace(config, cwd) {
    const directory = resolve(cwd);
    const agentDirectory = resolve(directory, '.agents');
    await mkdir(agentDirectory, { recursive: true });
    const configPath = resolve(agentDirectory, 'planning-tools.json');
    const mcpConfigPath = resolve(agentDirectory, 'mcp_config.json');
    const launcherPath = resolve(agentDirectory, 'planning-mcp.mjs');
    await writeFile(configPath, JSON.stringify(config, null, 2));
    await writeFile(launcherPath, `import {readFile} from 'node:fs/promises';\nimport {startPlanningToolsStdio} from ${JSON.stringify(import.meta.url)};\nawait startPlanningToolsStdio(JSON.parse(await readFile(${JSON.stringify(configPath)},'utf8')));\n`);
    await writeFile(mcpConfigPath, JSON.stringify({ mcpServers: { project_architect: { command: process.execPath, args: [launcherPath] } } }, null, 2));
    return { configPath, mcpConfigPath, cwd: directory };
}
const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
    const position = process.argv.indexOf('--config');
    if (position < 0 || !process.argv[position + 1])
        throw new Error('Planning MCP service requires --config');
    const configPath = resolve(process.argv[position + 1]);
    await mkdir(dirname(configPath), { recursive: true });
    await startPlanningToolsStdio(JSON.parse(await readFile(configPath, 'utf8')));
}
//# sourceMappingURL=PlanningToolsMcpServer.js.map