import { readFile,readdir,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
const root=resolve('docs/validation/agy-2026-10-04/real-integration');
for(const mode of process.argv.slice(2).length?process.argv.slice(2):['chinese','vague','materials']){
  let m;try{m=JSON.parse(await readFile(join(root,mode,'manifest.json'),'utf8'));}catch{continue;}
  for(const run of m.runs){
    const p=join(m.path,'runtime','planning',run.id);let r;try{r=JSON.parse(await readFile(join(p,'run.json'),'utf8'));}catch{continue;}
    const tasks=[];
    for(const t of r.tasks){
      let stream=[];try{const lines=(await readFile(join(p,'tasks',t.id,`call-${t.attempts}.ndjson`),'utf8')).split('\n').filter(Boolean).map(JSON.parse);for(const l of lines){if(l.stream==='stdout')for(const s of l.data.split('\n').filter(Boolean)){try{stream.push(JSON.parse(s));}catch{}}}}catch{}
      const errors=stream.filter(e=>e.step_update?.state==='ERROR').map(e=>({tool:e.step_update.tool_name,error:e.step_update.tool_info?.error}));
      tasks.push({kind:t.kind,status:t.status,attempts:t.attempts,events:stream.length,lastEvent:stream.slice(-1).map(e=>({event:e.event,step:e.step_update?.step_type,state:e.step_update?.state})),errors:errors.slice(-2)});
    }
    console.log(JSON.stringify({mode,stage:r.stage,status:r.status,error:r.error,tasks}));
  }
}
