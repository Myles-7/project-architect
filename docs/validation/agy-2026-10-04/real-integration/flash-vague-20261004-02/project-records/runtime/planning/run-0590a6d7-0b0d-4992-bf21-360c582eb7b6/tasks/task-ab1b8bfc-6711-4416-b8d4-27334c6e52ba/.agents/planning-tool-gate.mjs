import {readFileSync,appendFileSync,realpathSync} from 'node:fs';
import {isAbsolute} from 'node:path';
const event=JSON.parse(readFileSync(0,'utf8')); const call=event.toolCall||{}; const args=call.args||{};
const server=args.ServerName??args.serverName??args.server_name; const tool=args.ToolName??args.toolName??args.tool_name;
let image=null; const requested=args.AbsolutePath??args.Path??args.path; if(call.name==='view_file'&&typeof requested==='string'&&isAbsolute(requested)){try{const actual=realpathSync(requested); if([].includes(actual))image=actual;}catch{}}
const allow=call.name==='finish'||!!image||(call.name==='call_mcp_tool'&&server==='project_architect'&&["material_index","material_read","material_image","research_read","evidence_record","environment_prepare","experiment_run"].includes(tool));
const result={decision:allow?'allow':'deny',reason:allow?'Registered controlled planning tool':'Native commands, unregistered file access, writes, delegation, and unregistered MCP servers are disabled for this task',...(allow&&call.name==='call_mcp_tool'?{permissionOverrides:['mcp('+server+'/'+tool+')']}:image?{permissionOverrides:['read_file('+image+')']}: {})};
appendFileSync("D:\\Temp\\User\\pa-real-integration-wLmf6U\\vague\\runtime\\planning\\run-0590a6d7-0b0d-4992-bf21-360c582eb7b6\\tasks\\task-ab1b8bfc-6711-4416-b8d4-27334c6e52ba\\.agents\\tool-gate.ndjson",JSON.stringify({at:new Date().toISOString(),toolCall:call,decision:result.decision,stepIdx:event.stepIdx,imagePath:image})+'\n'); process.stdout.write(JSON.stringify(result));
