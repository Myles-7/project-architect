import { resolve } from 'node:path'; import {writeFile} from 'node:fs/promises';
import {PlanningToolsService} from '../../../packages/agent/dist/tools/PlanningToolsService.js';
const root=resolve('docs/validation/agy-2026-10-04');const tools=new PlanningToolsService({materialRoots:[],materials:[],experimentRoot:resolve(root,'runtime-probes'),evidenceRoot:resolve(root,'runtime-evidence')});
const results=[];
for(const runtime of ['node','chromium','python']){const source=runtime==='python'?'print("isolated-python-runtime")':'console.log("isolated-'+runtime+'-runtime")';results.push(await tools.runExperiment({runtime,source}));}
await writeFile(resolve(root,'docker-results.json'),JSON.stringify(results,null,2)); console.log(JSON.stringify(results.map(({status,environment,reason})=>({status,environment,reason})),null,2));
