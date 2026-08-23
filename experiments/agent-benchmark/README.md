# Project Architect Agent Benchmark v1

An isolated, dependency-free Node.js harness for comparing four Antigravity CLI
architectures. It deliberately contains no production Project Architect code.

## Run

From this directory:

```powershell
npm run smoke
npm run run
npm run report
```

`smoke` runs cases 01, 03, and 05. `run` runs all ten cases once. Results are
append-only by `run-id`: raw CLI envelopes are saved under `results/raw`, parsed
records under `results/normalized`, and the aggregate under `results/summary.json`.

The provider reads `structured_output` from the JSON envelope. It intentionally
does not parse the `response` field for benchmark data.

## Cost guardrails

- One run per Case × Variant in the first pass.
- A/B make one call; C/D make three calls.
- Provider calls are sequential, continue after failure, and record every usage
  field the CLI supplies.
- Use `--cases case-01,case-03` to narrow a rerun, and a unique `--run-id` so
  original evidence remains intact.

## Scoring boundaries

`src/evaluator.mjs` produces reproducible **heuristic suggestions**, plus
objective parsing and token metrics. It cannot determine product-reasoning
quality objectively. The report labels each category so raw outputs remain the
source for human review.
