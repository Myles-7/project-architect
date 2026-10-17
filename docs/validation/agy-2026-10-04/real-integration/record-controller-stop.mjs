import {readFile,writeFile,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {FileStorage,ProjectStateEngine,WorkspaceGuard} from '../../../../packages/core/dist/index.js';
import {AntigravityCliProvider} from '../../../../packages/agent/dist/provider/AntigravityCliProvider.js';
import {PlanningRuntime} from '../../../../apps/server/dist/planning/PlanningRuntime.js';
const label=process.argv[2],reason=process.argv[3];if(!/^[a-z0-9-]+$/.test(label)||!reason)throw new Error('Evidence label and actual controller stop reason required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label),m=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
m.controllerStop={at:new Date().toISOString(),reason,method:'Explicit taskkill of the verified test-runner process tree; partial output is preserved and not accepted'};m.status='failed';m.error=reason;m.completedAt=m.controllerStop.at;
const runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(m.temp)),new AntigravityCliProvider(),m.actualConfig);
for(const ref of m.runs){const r=await runtime.get(m.path,ref.id);await writeFile(join(root,`${r.stage}-${r.id}.json`),JSON.stringify(r,null,2));}
await runtime.shutdown();await cp(m.path,join(root,'project-records'),{recursive:true});await writeFile(join(root,'manifest.json'),JSON.stringify(m,null,2));console.log(JSON.stringify({label,status:m.status,reason}));
