import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('Frozen migration evidence label required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')),checks=[],observed=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function check(name,pass,details){checks.push({name,pass:!!pass,...(details===undefined?{}:{details})});if(!pass)throw new Error(name);}
let error;
try{
  check('migration-control-frozen-and-shut-down',!!manifest.completedAt&&manifest.activeCallsAtShutdown===0&&!!manifest.migration);
  check('original-source-manifest-byte-hash-preserved',hash(await readFile(manifest.migration.sourceManifestPath))===manifest.migration.sourceManifestSha256);
  check('frozen-inherited-manifest-byte-hash-preserved',hash(await readFile(join(root,'inherited-manifest.json')))===manifest.migration.sourceManifestSha256);
  for(const proof of manifest.migration.receipts){
    const directory=join(root,'project-records','runtime','planning',proof.runId,'tasks',proof.taskId),run=JSON.parse(await readFile(join(root,'project-records','runtime','planning',proof.runId,'run.json'),'utf8')),task=run.tasks.find(value=>value.id===proof.taskId),resultBytes=await readFile(join(directory,'result.json')),receiptBytes=await readFile(join(directory,'result-receipt.json'));
    const record={runId:proof.runId,taskId:proof.taskId,kind:proof.kind,expectedAttempts:proof.attempts,actualAttempts:task?.attempts,resultSha256:hash(resultBytes),receiptSha256:hash(receiptBytes),pass:task?.status==='completed'&&task.attempts===proof.attempts&&hash(resultBytes)===proof.resultSha256&&hash(receiptBytes)===proof.receiptSha256};observed.push(record);check('successful-receipt-and-result-bytes-and-attempts-preserved',record.pass,record);
  }
  check('all-registered-successful-receipts-preserved',observed.length===manifest.migration.receipts.length&&observed.every(record=>record.pass));
}catch(caught){error=String(caught);process.exitCode=1;}
const result={label,checkedAt:new Date().toISOString(),status:error?'failed':'passed',error,preservedReceiptCount:observed.length,checks};
await writeFile(join(root,'preserved-receipts-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({label,status:result.status,preservedReceiptCount:observed.length,checks:checks.length,error}));
