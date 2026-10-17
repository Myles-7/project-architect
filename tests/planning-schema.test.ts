import { it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PLANNING_TASK_SCHEMA } from '@project-architect/contracts';
it('keeps the production B3 JSON identical to shared task contracts',async()=>{
  const saved=JSON.parse(await readFile(resolve('experiments/agent-benchmark/schemas/b3-discovery.schema.json'),'utf8'));
  expect(saved).toEqual(PLANNING_TASK_SCHEMA);
});
