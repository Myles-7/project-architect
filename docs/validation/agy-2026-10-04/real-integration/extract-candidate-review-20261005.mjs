import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Supply a control label');
const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
const activeCall = manifest.providerCalls.find(call => !call.completedAt);
const runId = activeCall?.cwd?.match(/[/\\](run-[a-z0-9-]+)[/\\]tasks[/\\]/)?.[1] ?? manifest.runs.at(-1)?.id ?? manifest.qualityFeedback?.runId;
const run = JSON.parse(await readFile(join(manifest.path, 'runtime', 'planning', runId, 'run.json'), 'utf8'));
let task = run.tasks.filter(item => item.kind === 'review' && item.attempts > 0 && ['running', 'completed', 'paused', 'failed', 'cancelled'].includes(item.status)).at(-1);
if(process.argv.includes('--draft'))task=run.tasks.filter(item=>item.kind==='revision'&&item.attempts>0&&['running','paused','completed','failed','cancelled'].includes(item.status)).at(-1);
if (!task) throw new Error('No selected actual review/revision context yet');
const contextPath = join(directory, 'observed-inputs', `${task.id}-${task.attempts}.context.json`);
const contextBytes = await readFile(contextPath);
const context = JSON.parse(contextBytes.toString('utf8'));
const baseline=process.argv.includes('--draft')?JSON.parse(await readFile(join(directory,'pre-quality-feedback-snapshot.json'),'utf8')).planning.blueprint:context.blueprint;
const draft=process.argv.includes('--draft')?context.currentDraft:context.workerResults.draft;
const map = new Map(baseline.blocks.map(block => [block.id, block]));
for (const group of draft.groups) {
  for (const id of group.removeBlockIds ?? []) map.delete(id);
  for (const block of group.blocks ?? []) map.set(block.id, block);
}
const blocks = [...map.values()];
const title = `# Read-only candidate preview: ${label}\n\nNo final content verdict is implied. Control=${manifest.status ?? 'running'}; reviewer=${task.id} (${task.status}).\n\nContext SHA256=${createHash('sha256').update(contextBytes).digest('hex')}.\n`;
await writeFile(join(directory, 'candidate-review-preview.md'), title + blocks.map(block => `\n## ${block.id} / ${block.kind} / ${block.title}\n\nStage=${block.stage}; requirements=${JSON.stringify(block.requirementIds)}; dependencies=${JSON.stringify(block.dependsOn)}\n\n${block.content}\n\nTask=${JSON.stringify(block.task ?? null, null, 2)}\n`).join('\n'));
await writeFile(join(directory, 'candidate-review-preview.json'), JSON.stringify({ contextPath, contextSha256: createHash('sha256').update(contextBytes).digest('hex'), controlStatus: manifest.status ?? 'running', taskId: task.id, candidateBlocks: blocks }, null, 2));
console.log(JSON.stringify({ label, controlStatus: manifest.status ?? 'running', taskId: task.id, blocks: blocks.length, output: join(directory, 'candidate-review-preview.md'), characters: blocks.reduce((sum, block) => sum + block.content.length, 0) }));
