import { mkdirSync, writeFileSync, realpathSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
/** Only registered MCP calls, finish and exact registered image paths are executable.
 * No project state, home/brain directories, native writes, shell or delegation. */
export function preparePlanningToolGate(cwd, allowedTools, registeredImages = [], materialRoots = [], contextAccess) {
    const directory = resolve(cwd, '.agents');
    mkdirSync(directory, { recursive: true });
    const scriptPath = resolve(directory, 'planning-tool-gate.mjs');
    const hooksPath = resolve(directory, 'hooks.json');
    const auditPath = resolve(directory, 'tool-gate.ndjson');
    const allowed = allowedTools.map(name => name.replace(/^mcp_project_architect_/, ''));
    const roots = materialRoots.map(path => realpathSync(resolve(path)));
    const inside = (root, path) => { const value = relative(root, path); return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)); };
    const images = registeredImages.map(path => { const actual = realpathSync(resolve(path)); if (!roots.some(root => inside(root, actual)))
        throw new Error('Registered image escapes its material roots'); const bytes = readFileSync(actual); if (!(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 || bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'))
        throw new Error('Registered native viewer target is not an actual supported image'); return actual; });
    writeFileSync(scriptPath, `import {readFileSync,appendFileSync,realpathSync} from 'node:fs';
import {isAbsolute} from 'node:path';
${contextAccess ? `import {planningContextReadIssues} from ${JSON.stringify(new URL(import.meta.url.endsWith('.ts') ? './PlanningContextAccess.ts' : './PlanningContextAccess.js', import.meta.url).href)};` : ''}
const event=JSON.parse(readFileSync(0,'utf8')); const call=event.toolCall||{}; const args=call.args||{};
const server=args.ServerName??args.serverName??args.server_name; const tool=args.ToolName??args.toolName??args.tool_name;
let image=null; const requested=args.AbsolutePath??args.Path??args.path; if(call.name==='view_file'&&typeof requested==='string'&&isAbsolute(requested)){try{const actual=realpathSync(requested); if(${JSON.stringify(images)}.includes(actual))image=actual;}catch{}}
let missing=[];
${contextAccess ? `if(call.name==='finish'){try{missing=planningContextReadIssues(${JSON.stringify(contextAccess)});}catch(error){missing=[String(error)];}}` : ''}
const allow=(call.name==='finish'&&!missing.length)||!!image||(call.name==='call_mcp_tool'&&server==='project_architect'&&${JSON.stringify(allowed)}.includes(tool));
const result={decision:allow?'allow':'deny',reason:missing.length?'INCOMPLETE_REVIEW_CONTEXT: read all required records with planning_context before finish; '+missing.length+' remaining: '+missing.slice(0,10).join('; '):allow?'Registered controlled planning tool':'Native commands, unregistered file access, writes, delegation, and unregistered MCP servers are disabled for this task',...(allow&&call.name==='call_mcp_tool'?{permissionOverrides:['mcp('+server+'/'+tool+')']}:image?{permissionOverrides:['read_file('+image+')']}: {})};
appendFileSync(${JSON.stringify(auditPath)},JSON.stringify({at:new Date().toISOString(),toolCall:call,decision:result.decision,stepIdx:event.stepIdx,imagePath:image,...(missing.length?{missingContext:missing}: {})})+'\\n'); process.stdout.write(JSON.stringify(result));
`, 'utf8');
    // AGY Windows hook launcher double-escapes quoted paths; relative commands run
    // from the config directory (.agents), verified with real CLI 1.2.16 calls.
    writeFileSync(hooksPath, JSON.stringify({ 'planning-worker-gate': { enabled: true, PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node planning-tool-gate.mjs', timeout: 10 }] }] } }, null, 2), 'utf8');
    return { hooksPath, scriptPath, auditPath, images };
}
//# sourceMappingURL=PlanningToolGate.js.map