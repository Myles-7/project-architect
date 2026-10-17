import { readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PLANNING_TASK_SCHEMA } from '../packages/contracts/dist/index.js';

const path=fileURLToPath(new URL('../experiments/agent-benchmark/schemas/b3-discovery.schema.json',import.meta.url));
const expected=JSON.stringify(PLANNING_TASK_SCHEMA,null,2)+'\n';
if(process.argv.includes('--check')){
  if(await readFile(path,'utf8')!==expected)throw new Error('B3 Schema differs from shared contracts. Build contracts and run pnpm schema:sync.');
  console.log('Shared task schema and B3 JSON match.');
}else{await writeFile(path,expected);console.log('B3 JSON generated from shared task schema.');}
