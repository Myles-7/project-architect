import {readFileSync,appendFileSync} from 'node:fs';
const event=JSON.parse(readFileSync(0,'utf8')); const call=event.toolCall||{}; const args=call.args||{};
const server=args.ServerName??args.serverName??args.server_name; const tool=args.ToolName??args.toolName??args.tool_name;
const allow=call.name==='finish'||(call.name==='call_mcp_tool'&&server==='project_architect'&&["material_index","material_read","material_image","research_read","evidence_record","experiment_run"].includes(tool));
const result={decision:allow?'allow':'deny',reason:allow?'Registered controlled planning tool':'Native commands, file access, delegation, and unregistered MCP servers are disabled for this registered task'};
appendFileSync("D:\\桌面\\项目构思\\docs\\validation\\agy-2026-10-04\\worker\\.agents\\tool-gate.ndjson",JSON.stringify({at:new Date().toISOString(),toolCall:call,decision:result.decision,stepIdx:event.stepIdx})+'\n'); process.stdout.write(JSON.stringify(result));
