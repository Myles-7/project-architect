import fs from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('models')) { process.stdout.write('claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)\ngemini-3.1-pro-high\tGemini 3.1 Pro (High)\n'); process.exit(0); }
if (args.includes('--version')) { process.stdout.write('mock-1.2.16\n'); process.exit(0); }
const input = JSON.parse(fs.readFileSync(0, 'utf8').trim());
if (input.event !== 'user' || typeof input.message?.content !== 'string' || input.prompt) { process.stderr.write('Invalid user event protocol'); process.exit(2); }
const mode = process.env.MOCK_AGY_MODE || 'default';
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
const result = { status: 'SUCCESS', structured_output: { confirmed: ['No Shell Injection'], candidates: [], assumptions: [], unknowns: [], risks: [], conflicts: [], tensions: [], gaps: [], questions: [], receivedLength: input.message.content.length, args, cwd: process.cwd() }, usage: { input_tokens: 10, output_tokens: 20 } };
if (mode === 'prompt_echo') result.structured_output.receivedPrompt = input.message.content;
if (mode === 'hang' || mode === 'tree') { if (mode === 'tree') { const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)']); if (process.env.MOCK_CHILD_PID) fs.writeFileSync(process.env.MOCK_CHILD_PID, String(child.pid)); } setTimeout(() => process.exit(0), 60_000); }
else if (mode === 'flood') { setInterval(() => process.stdout.write('A'.repeat(4096)), 5); }
else if (mode === 'invalid_json') { process.stdout.write('<!DOCTYPE html><html>502 Bad Gateway</html>\n'); }
else if (mode === 'text_json') { emit({ event: 'result', result: { status: 'SUCCESS', response: JSON.stringify({ forged: true }) } }); }
else if (mode === 'intermediate_only') { emit({ event: 'message', structured_output: { forged: true } }); }
else if (mode === 'failed_terminal') { emit({ event: 'result', result: { ...result, status: 'FAILED', error: 'model service offline' } }); }
else if (mode === 'permission') { emit({ event: 'result', result: { ...result, status: 'PERMISSION_DENIED' } }); }
else if (mode === 'unsafe_tools') { emit({ event: 'init', init: { tools: ['delegate_to_agent'] } }); setTimeout(() => process.exit(0), 60_000); }
else if (mode === 'legacy') { emit({ structured_output: result.structured_output, usage: result.usage }); }
else if (mode === 'legacy_pretty') { process.stdout.write(JSON.stringify({ structured_output: result.structured_output, usage: result.usage }, null, 2) + '\n'); }
else if (mode === 'duplicate') { emit({ event: 'result', result }); emit({ event: 'result', result }); }
else if (mode === 'unsupported_flags') { process.stderr.write('unknown flag'); process.exit(2); }
else { emit({ event: 'init', init: { tools: [], model: args[args.indexOf('--model') + 1] } }); if (mode === 'long_stream') { for (let i = 0; i < 1200; i++) emit({ event: 'message', text: 'x'.repeat(100) }); } emit({ event: 'result', result }); }
