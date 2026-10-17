import { readFile, writeFile, cp } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { planningWorkerContext } from '../../../../apps/server/dist/planning/PlanningContext.js';
import { planningPrompt } from '../../../../apps/server/dist/planning/PlanningPrompt.js';
import { planningAnswerContext } from '../../../../apps/server/dist/planning/PlanningAnswerContext.js';
import { planningInputHash, effectiveDecisionHash, hashValue } from '../../../../packages/core/dist/index.js';

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('A frozen control label is required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifestBytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (!manifest.completedAt || manifest.activeCallsAtShutdown !== 0) throw new Error('Requires a terminal frozen control');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = value => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const compact = value => value === undefined ? null : { utf8Bytes: bytes(value), ...(Array.isArray(value) ? { entries: value.length } : {}) };
const runs = await Promise.all(manifest.runs.map(async item => {
  const directory = join(root, 'project-records', 'runtime', 'planning', item.id);
  return { run: JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')), directory };
}));
const recordedInputs = manifest.providerCalls.every(call => call.inputArtifacts);
const snapshot = recordedInputs ? undefined : JSON.parse(await readFile(join(root, 'migration-start-snapshot.json'), 'utf8'));
const runtimeArtifacts = [];
if (recordedInputs) {
  for (const item of manifest.productionDistHashes) {
    if (!item.copyPath) throw new Error('Actual input diagnostics require the saved startup-build artifacts');
    const body = await readFile(item.copyPath);
    if (sha(body) !== item.sha256) throw new Error(`Frozen startup build was modified: ${item.copyPath}`);
    runtimeArtifacts.push({ source: item.path, copy: item.copyPath, sha256: item.sha256, matchedFrozenStartupHash: true });
  }
} else {
  for (const name of ['PlanningRuntime.js', 'PlanningContext.js', 'PlanningPrompt.js', 'PlanningAnswerContext.js']) {
    const source = resolve('apps/server/dist/planning', name), body = await readFile(source);
    const expected = manifest.productionDistHashes.find(item => item.path === source)?.sha256;
    if (expected && sha(body) !== expected) throw new Error(`Current dist changed: ${name}; refuse unverified reconstruction`);
    const target = join(root, 'output-contract-runtime', name);
    await cp(source, target, { recursive: true });
    runtimeArtifacts.push({ source, copy: target, sha256: sha(body), matchedFrozenStartupHash: expected ? true : null });
  }
}

const results = [];
for (const call of manifest.providerCalls) {
  const holder = runs.find(item => item.run.tasks.some(task => call.requestId.startsWith(`${task.id}-`)));
  if (!holder) throw new Error(`Unknown call ${call.requestId}`);
  const task = holder.run.tasks.find(item => call.requestId.startsWith(`${item.id}-`));
  const directory = join(holder.directory, 'tasks', task.id);
  const logPath = join(directory, basename(call.logPath));
  const log = await readFile(logPath);
  const records = log.toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const stdout = records.filter(item => item.stream === 'stdout').map(item => item.data).join('');
  const events = stdout.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return { unparsable: true, bytes: Buffer.byteLength(line) }; } });
  const terminals = events.filter(event => event.event === 'result').map(event => event.result);
  const schemaPath = call.inputArtifacts?.schemaPath ?? join(directory, 'result.schema.json');
  const schema = await readFile(schemaPath);
  if (call.inputArtifacts && sha(schema) !== call.inputArtifacts.schemaSha256) throw new Error(`Actual call schema was modified: ${call.requestId}`);
  const parsedSchema = JSON.parse(schema.toString('utf8'));
  let workerContext, reconstructed, contextText, prompt;
  if (call.inputArtifacts) {
    contextText = await readFile(call.inputArtifacts.contextPath, 'utf8');
    prompt = await readFile(call.inputArtifacts.promptPath, 'utf8');
    reconstructed = JSON.parse(contextText);
    workerContext = { currentDraft: reconstructed.currentDraft, workerResults: reconstructed.workerResults };
  } else {
  const completedResults = new Map();
  const tasksAtCall = holder.run.tasks.map(item => ({ ...item, status: item.completedAt && item.completedAt < call.startedAt ? 'completed' : 'queued' }));
  for (const item of tasksAtCall.filter(item => item.status === 'completed')) {
    completedResults.set(item.id, JSON.parse(await readFile(join(holder.directory, item.outputRef), 'utf8')));
  }
  workerContext = planningWorkerContext(tasksAtCall, completedResults, snapshot.planning, task);
  const discovery = runs.map(item => item.run).find(item => item.stage === 'clarify' && item.status === 'reviewable' && item.clarificationInputHash === planningInputHash(snapshot) && item.clarificationDecisionHash === effectiveDecisionHash(snapshot));
  reconstructed = {
    projectName: snapshot.metadata.name, stage: holder.run.stage, basis: holder.run.basis,
    constraints: snapshot.metadata.constraints,
    approvedDecisions: snapshot.decisions.items.filter(item => ['confirmed', 'locked'].includes(item.status)),
    blueprint: snapshot.planning.blueprint, decisionTopics: snapshot.planning.topics,
    rawInputs: snapshot.planning.inputs, answers: planningAnswerContext(snapshot.questions.items),
    materialIndex: snapshot.metadata.inputRefs,
    discoveryContext: discovery ? { summary: discovery.summary, clarification: discovery.clarification, deferredWork: discovery.deferredWork ?? [] } : undefined,
    ...workerContext,
  };
  contextText = JSON.stringify(reconstructed, null, 2);
  prompt = planningPrompt(holder.run.stage, task.kind, task.goal);
  }
  const observed = call.inputObservation;
  const matchesObservedContext = sha(contextText) === observed.runtimeContextSha256 && bytes(contextText) === observed.runtimeContextUtf8Bytes;
  const matchesObservedRole = sha(prompt) === observed.rolePromptSha256 && bytes(prompt) === observed.rolePromptUtf8Bytes;
  if (call.inputArtifacts && (!matchesObservedContext || !matchesObservedRole)) throw new Error(`Actual captured input was modified: ${call.requestId}`);
  const prefix = `${task.id}-${call.requestId.slice(task.id.length + 1)}`;
  if (matchesObservedContext) await writeFile(join(root, `${prefix}-verified-context.json`), contextText);
  if (matchesObservedRole) await writeFile(join(root, `${prefix}-verified-role.txt`), prompt);
  const terminalMetrics = [];
  for (const [index, terminal] of terminals.entries()) {
    const saved = join(root, `${prefix}-terminal-${index + 1}.json`);
    await writeFile(saved, JSON.stringify(terminal, null, 2));
    const output = terminal.structured_output;
    if (output != null) await writeFile(join(root, `${prefix}-rejected-or-accepted-structured-output.json`), JSON.stringify(output, null, 2));
    const groups = Array.isArray(output?.groups) ? output.groups : [];
    const blocks = groups.flatMap(group => group.blocks ?? []);
    terminalMetrics.push({ path: saved, status: terminal.status, error: terminal.error, exactSerializedUtf8Bytes: bytes(terminal), fields: Object.fromEntries(Object.entries(terminal).map(([key, value]) => [key, compact(value)])), structuredOutput: output == null ? null : {
      serializedUtf8Bytes: bytes(output), topLevelFields: Object.fromEntries(Object.entries(output).map(([key, value]) => [key, compact(value)])),
      groups: groups.map(group => ({ id: group.id, label: group.label, bytes: bytes(group), blockCount: group.blocks?.length ?? 0, removed: group.removeBlockIds ?? [] })),
      blockCount: blocks.length,
      blocks: blocks.map(block => ({ id: block.id, kind: block.kind, title: block.title, serializedUtf8Bytes: bytes(block), contentUtf8Bytes: bytes(block.content ?? ''), taskUtf8Bytes: block.task == null ? 0 : bytes(block.task) })).sort((a, b) => b.serializedUtf8Bytes - a.serializedUtf8Bytes),
    } });
  }
  results.push({ requestId: call.requestId, kind: task.kind, goal: task.goal, dependsOn: task.dependsOn, registeredTask: task, startedAt: call.startedAt, completedAt: call.completedAt, status: call.status,
    actualInputObservation: observed, inputArtifacts: call.inputArtifacts ?? null,
    schema: { path: schemaPath, utf8Bytes: schema.length, sha256: sha(schema), required: parsedSchema.required, topLevelFields: Object.keys(parsedSchema.properties ?? {}), serializedTopLevelPropertyBytes: Object.fromEntries(Object.entries(parsedSchema.properties ?? {}).map(([key, value]) => [key, bytes(value)])) },
    contextReconstruction: { status: matchesObservedContext ? call.inputArtifacts ? 'persisted-actual-request-exact-byte-size-and-sha256-match' : 'exact-byte-size-and-sha256-match-to-actual-observation' : 'mismatch-do-not-use-as-actual-call-context', utf8Bytes: bytes(contextText), sha256: sha(contextText), matchesObservedContext, matchesObservedRole,
      sections: matchesObservedContext ? Object.fromEntries(Object.entries(reconstructed).filter(([, value]) => value !== undefined).map(([key, value]) => [key, compact(value)])) : null,
      currentDraft: matchesObservedContext ? compact(workerContext.currentDraft) : null,
      workerResults: matchesObservedContext ? Object.fromEntries(Object.entries(workerContext.workerResults ?? {}).map(([key, value]) => [key, compact(value)])) : null,
    },
    stream: { frozenLogPath: logPath, sha256: sha(log), logUtf8Bytes: log.length, stdoutUtf8Bytes: bytes(stdout), eventTypes: events.reduce((counts, event) => { const name = event.event ?? event.type ?? 'unknown'; counts[name] = (counts[name] ?? 0) + 1; return counts; }, {}) }, terminalMetrics,
  });
}
const successfulReceipts = [];
for (const holder of runs) for (const task of holder.run.tasks.filter(item => item.status === 'completed')) {
  const directory = join(holder.directory, 'tasks', task.id), resultPath = join(directory, 'result.json'), receiptPath = join(directory, 'result-receipt.json');
  const result = await readFile(resultPath), receipt = await readFile(receiptPath), parsedResult = JSON.parse(result.toString('utf8')), parsedReceipt = JSON.parse(receipt.toString('utf8'));
  const passed = parsedReceipt.taskId === task.id && parsedReceipt.hash === task.outputHash && hashValue(parsedResult) === task.outputHash;
  if (!passed) throw new Error(`Frozen completed receipt does not match: ${task.id}`);
  const actualNewCall = manifest.providerCalls.find(call => call.requestId === `${task.id}-${task.attempts}`);
  successfulReceipts.push({ runId: holder.run.id, stage: holder.run.stage, taskId: task.id, kind: task.kind, attempts: task.attempts, completedAt: task.completedAt, resultPath, resultSha256: sha(result), resultUtf8Bytes: result.length, receiptPath, receiptSha256: sha(receipt), receiptUtf8Bytes: receipt.length, registeredOutputHash: task.outputHash, receiptAndOutputHashMatch: true, completedInThisControl: actualNewCall?.structuredSuccess === true });
}
if (sha(await readFile(join(root, 'manifest.json'))) !== sha(manifestBytes)) throw new Error('Frozen manifest was changed during diagnostics');
const diagnostic = { label, checkedAt: new Date().toISOString(), frozenManifestSha256: sha(manifestBytes), frozenManifestUnchanged: true, scope: 'Read-only frozen real calls. Schema/goal/output bytes come from persisted call artifacts. Context sections are reported only when reconstructed bytes and SHA-256 exactly match observations recorded before the actual call. Provider token counters can span tool/model turns; output-token-limit ERROR is not an accepted result.', runtimeArtifacts, calls: results, successfulReceiptInventory: { count: successfulReceipts.length, completedInThisControl: successfulReceipts.filter(item => item.completedInThisControl).length, receipts: successfulReceipts } };
await writeFile(join(root, 'output-contract-diagnostic.json'), JSON.stringify(diagnostic, null, 2));
console.log(JSON.stringify({ label, calls: results.map(item => ({ id: item.requestId, kind: item.kind, contextStatus: item.contextReconstruction.status, roleMatched: item.contextReconstruction.matchesObservedRole, schemaBytes: item.schema.utf8Bytes, contextBytes: item.actualInputObservation.runtimeContextUtf8Bytes, currentDraft: item.contextReconstruction.currentDraft, workerResults: item.contextReconstruction.workerResults, terminal: item.terminalMetrics.map(value => ({ status: value.status, bytes: value.exactSerializedUtf8Bytes, structuredBytes: value.structuredOutput?.serializedUtf8Bytes, blocks: value.structuredOutput?.blockCount })) })) }));
