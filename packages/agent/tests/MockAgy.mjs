const args = process.argv.slice(2);
if (args.length < 2 || args[0] !== '-p') {
  process.stderr.write('Mock agy requires prompt to be passed with -p.\n');
  process.exit(2);
}

const mode = process.env.MOCK_AGY_MODE || 'default';
if (mode === 'hang') {
  setTimeout(() => process.exit(0), 60_000);
} else if (mode === 'flood') {
  const timer = setInterval(() => process.stdout.write('A'.repeat(4096)), 5);
  process.on('SIGTERM', () => clearInterval(timer));
} else if (mode === 'invalid_json') {
  process.stdout.write('<!DOCTYPE html><html>502 Bad Gateway</html>\n');
} else {
  process.stdout.write(JSON.stringify({
    structured_output: {
      confirmed: ['No Shell Injection'], candidates: [], assumptions: [], unknowns: [],
      risks: [], conflicts: [], tensions: [], gaps: [], questions: [],
    },
    usage: { input_tokens: 10, output_tokens: 20 },
  }));
}
