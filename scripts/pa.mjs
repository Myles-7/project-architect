#!/usr/bin/env node
// Historical spec-drift inference cannot verify a current Planning project.
const command = process.argv[2];
if (!command || ['help', '--help', '-h'].includes(command)) {
  console.log('Project Architect CLI: pa verify is retired. Use approved Planning requirements and explicitly executed validation tasks.');
} else if (command === 'verify') {
  console.error('LEGACY_WORKFLOW_RETIRED: pa verify is unsupported; no project was resolved, loaded or scanned.');
  process.exitCode = 1;
} else {
  console.error('Unknown command. Use pa help.');
  process.exitCode = 1;
}
