import{readFile}from'node:fs/promises';
import{resolve}from'node:path';
const path=resolve('docs/validation/agy-2026-10-04/real-integration/flash-context-batch-real-20261005-01/stream.ndjson');
const steps=new Map();
for(const line of(await readFile(path,'utf8')).split('\n').filter(Boolean)){
const chunk=JSON.parse(line);if(chunk.stream!=='stdout')continue;
for(const part of chunk.data.split('\n').filter(Boolean)){let event;try{event=JSON.parse(part);}catch{continue;}const step=event.step_update;if(step?.tool_name!=='call_mcp_tool'||step.tool_info?.parameters?.ToolName!=='planning_context')continue;
const list=steps.get(step.step_index)??[];list.push({state:step.state,keys:Object.keys(step),toolKeys:Object.keys(step.tool_info??{}),outputBytes:Buffer.byteLength(step.tool_info?.output??''),outputSample:step.tool_info?.output?.slice(0,180),textSample:step.text_delta?.slice(0,100)});steps.set(step.step_index,list);}}
for(const[index,updates]of steps)if(updates.at(-1).state==='DONE'&&!updates.at(-1).outputBytes)console.log(JSON.stringify({index,updates}));
