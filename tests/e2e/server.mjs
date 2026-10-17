import { mkdtemp,rm } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createApp } from '../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine,FileStorage,WorkspaceGuard } from '../../packages/core/dist/index.js';
import { FixturePlanningProvider } from '../fixtures/planning.mjs';

const root=await mkdtemp(join(tmpdir(),'pa-browser-tests-'));
const engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));
const provider=new FixturePlanningProvider(180);
const runtime=new PlanningRuntime(engine,provider,{},[1,2]);
const app=createApp({workspaceRoot:root,engine,planningRuntime:runtime,useMockAI:true});
const require=createRequire(resolve('apps/server/package.json'));
app.use(require('express').static(resolve('apps/web/dist')));
app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api'))res.sendFile(resolve('apps/web/dist/index.html'));else next();});
const server=app.listen(Number(process.env.PA_TEST_PORT||4178),'127.0.0.1',()=>console.log('Browser fixture server ready; all project writes use '+root));
async function shutdown(){await runtime.shutdown();server.close();server.closeAllConnections();await rm(root,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
