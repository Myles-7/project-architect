import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { AntigravityCliProvider } from '../../../packages/agent/dist/provider/AntigravityCliProvider.js';

process.env.PATH = dirname(process.execPath) + ';' + process.env.PATH;
const model = process.argv[2];
if (!['claude-opus-4-6-thinking','gemini-3.8-flash-high','gemini-3.1-pro-high'].includes(model)) throw new Error('Explicitly approved model required');
const label = `${model}-${Date.now()}`;
const root = resolve('docs/validation/agy-2026-10-04/account-probes', label);
await mkdir(root, { recursive:true });
const cwd = await mkdtemp(join(tmpdir(),'pa-account-probe-'));
const schemaPath = join(root,'schema.json');
await writeFile(schemaPath,JSON.stringify({type:'object',properties:{probe:{type:'string',const:'structured-model-call-only'}},required:['probe'],additionalProperties:false}));
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(),120000);
let result;
try {
 result = await new AntigravityCliProvider().complete({requestId:label,task:'planning-task',model,cwd,allowedTools:[],logPath:join(root,'stream.ndjson'),schemaPath,prompt:'This is an account availability probe. Use finish immediately with exactly {"probe":"structured-model-call-only"}. Do not use any tools, external information or delegate.',contextText:'No project context. This verifies only a real structured call of the explicitly approved model.',abortSignal:controller.signal});
} finally { clearTimeout(timer); }
const report = {checkedAt:new Date().toISOString(),model,scope:'Real structured-model-call availability only; does not prove planning/material/research quality.',cwd,...result};
await writeFile(join(root,'result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({root,checkedAt:report.checkedAt,model,status:result.status,structuredSuccess:result.structuredSuccess,stderr:result.stderr,structuredOutput:result.structuredOutput}));
if (!result.structuredSuccess || result.structuredOutput?.probe !== 'structured-model-call-only') process.exitCode = 1;
