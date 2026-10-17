import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

for (const label of process.argv.slice(2)) {
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid control label');
  const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.completedAt || !manifest.providerCalls.some(call => !call.completedAt)) throw new Error(`${label} is already stopped; do not request cancellation`);
  const intent = { requestedAt: new Date().toISOString(), reason: 'Upgrade validation to verified bounded batch context transport. Keep completed task receipts and existing API acceptance records; cancel only unfinished work via public Runtime.cancel, await shutdown and release actual Provider leases before building or resuming.', authorization: 'Existing user instruction to continue and finish using Gemini 3.8 Flash; reversible implementation and validation recovery.', nextAction: 'New-label exact frozen copy and public Runtime.resume after production build; no process kill or manual project state mutation.' };
  await writeFile(join(directory, 'controller-stop-intent.json'), JSON.stringify(intent, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ label, intentWritten: true, scope: 'The running controller will perform public cancellation and orderly shutdown.' }));
}
