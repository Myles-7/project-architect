# Promptfoo Adoption Plan

## Recommendation: Hybrid, Not a Replacement

Do not migrate `experiments/agent-benchmark` wholesale to Promptfoo. Keep the
current Node harness as the authoritative runner and raw-result recorder for
Antigravity. Consider a small Promptfoo layer later for declarative regression
fixtures and portable objective assertions.

| Concern | Current benchmark harness | Promptfoo | Recommendation |
| --- | --- | --- | --- |
| `agy.exe` / Windows spawning | Proven Node `child_process.spawn()` provider wrapper. | Requires a custom JavaScript provider that spawns the CLI. | Keep existing wrapper authoritative; adapt it in a PoC only. |
| `structured_output` | Parses the Antigravity envelope and takes `structured_output` directly. | Custom provider can return it as `output`; JSON/schema assertions can validate it. | Feasible, but preserve original envelope in metadata/raw files. |
| Token metrics | Records input/output/thinking/cache fields as provider returns them. | Standard `tokenUsage` has prompt/completion/total, but custom metadata is needed for thinking/cache. | Keep custom metrics aggregation/cost guard. |
| Raw envelope / stderr / exit code / timeout | Already preserved per call. | Provider response supports `output`, `error`, token usage, cost, metadata; process details require custom metadata. | Keep raw/normalized result directories. |
| Heuristic evaluator | Existing purpose-built evaluator and Mandarin/manual-review reports. | JavaScript assertions can run custom checks, but not replace qualitative review. | Port a small objective subset only. |
| Manual review | Purpose-built paired and Winner reports. | Evaluation matrix/UI aids review, but does not know PA categories. | Keep Project Architect manual reports. |
| Cost guardrail | Stops subsequent calls from Antigravity-specific token/duration signals. | Cost/latency assertions are per-result; provider-specific budget enforcement still needs custom orchestration. | Retain runner’s pre/post-call guardrail. |
| CI regression matrix | Custom scripts work but are less declarative. | Native prompt × provider × test matrix, shared assertions, JS checks. | Good future role for Promptfoo. |

## Evidence From Actual Promptfoo Sources

At commit `127d90534b9c1b1ba4554f007dd4b5fd2c8bf1b4` (MIT, retrieved
2026-08-22), Promptfoo’s custom provider interface requires `id()` and
`callApi()` (`src/types/providers.ts`; official docs). Provider responses can
carry `output`, `error`, `tokenUsage`, `cost`, and metadata. Its `json.ts` uses
AJV to validate an output against a supplied JSON schema; `javascript.ts` gives
an assertion access to output and provider context; built-in `latency.ts` and
`cost.ts` assert their corresponding metrics.

The official configuration guide documents a prompt/provider/test matrix and
explicitly notes that manual review is still valuable; the official assertions
guide lists JSON, JavaScript, latency, and cost assertions.

Sources:

- https://github.com/promptfoo/promptfoo/tree/127d90534b9c1b1ba4554f007dd4b5fd2c8bf1b4
- https://www.promptfoo.dev/docs/configuration/guide/
- https://www.promptfoo.dev/docs/providers/custom-api/
- https://www.promptfoo.dev/docs/configuration/expected-outputs/

## What to Keep in `experiments/agent-benchmark`

Keep these as authoritative even if Promptfoo is adopted later:

1. `antigravity-provider` behavior: spawn `agy.exe`, capture stdout/stderr/exit
   code/timeout/duration, parse raw JSON, and read `structured_output`.
2. Raw envelope retention in `results/raw/` and normalized results in
   `results/normalized/`.
3. Antigravity-specific metrics: input, output, thinking, cache read, total
   tokens; use `unavailable` rather than estimation.
4. Cost guardrail that can stop the matrix before more expensive cases run.
5. Project Architect’s heuristic evaluator, with its explicit
   heuristic/manual-review-needed labeling.
6. Manual-review Markdown format showing confirmed/assumptions/gaps/conflicts/
   questions/recommendations next to fixture context.
7. Custom summary reports focused on architecture decisions rather than a generic
   pass percentage.

## What Promptfoo Could Gradually Own

1. A declarative `fixtures` mapping for a small B-vs-B2 regression subset.
2. Schema validity assertion for `structured_output`.
3. Objective regression assertions, for example:
   - Case 05 has a conflict mentioning both local/offline data constraint and
     automatic cross-device sync.
   - B2 output does not contain forbidden implementation terms unless allowed by
     fixture metadata.
   - Question count respects the budget.
   - Latency remains below a predeclared threshold, when uncached.
4. Side-by-side B/B2 result matrix and a CI-friendly nonzero exit when an
   objective regression is detected.

It should **not** be asked to determine Key Gap Coverage, recommendation quality,
or conflict correctness by a generic LLM grade. Those remain a manual-review
decision supported by transparent heuristics.

## Deferred Isolated PoC

No dependency was installed and no Promptfoo PoC was created in this research
stage. This avoids project dependency pollution before B2 has been approved.

If the next stage explicitly authorizes a PoC, scope it to exactly:

```text
experiments/promptfoo-poc/
├── promptfooconfig.yaml
├── antigravity-provider.cjs
├── prompts/variant-b.txt
├── fixtures/case-01.yaml
├── fixtures/case-05.yaml
└── assertions/
    ├── schema.cjs
    └── conflict-case-05.cjs
```

No more than two fixtures, one B prompt, and one custom Antigravity provider.

### Provider contract

The PoC provider should:

1. Receive the rendered prompt from Promptfoo.
2. Start exactly one `agy.exe` child process using the existing known-good CLI
   argument builder and inline JSON schema.
3. Capture stdout, stderr, exit code, timed-out flag, duration, and raw JSON.
4. Parse `raw.structured_output`, never the generic response field.
5. Return:

```js
{
  output: JSON.stringify(raw.structured_output),
  tokenUsage: {
    prompt: raw.usage?.input_tokens,
    completion: raw.usage?.output_tokens,
    total: raw.usage?.total_tokens,
  },
  metadata: {
    antigravity_usage: raw.usage,
    stderr,
    exit_code,
    duration_ms,
    raw_envelope_path
  }
}
```

6. Return an `error` when the CLI fails or structured output is missing; do not
   retry invisibly.

### Guardrails for the PoC

- Reuse the current provider invocation logic rather than reimplementing CLI
  semantics by hand.
- Use `--no-cache` or otherwise make cache behavior explicit when asserting
  latency, because Promptfoo’s latency assertion excludes cached results.
- Do not map `thinking_tokens` or `cache_read_tokens` into a false standard
  metric. Preserve them in metadata and in the existing raw summary.
- Do not activate Promptfoo parallelism before an external cost cap is enforced.
- Do not delete or replace current results and reports.

## Adoption Gates

Move from plan to PoC only if all are true:

- B2 behavior design is approved for targeted benchmark.
- The existing Node runtime satisfies Promptfoo’s current Node requirement, or an
  isolated runtime can be used without modifying production dependencies.
- The PoC parses `structured_output` successfully for both fixtures.
- Raw envelope, stderr, exit code, timeout, duration, and all available usage
  values still remain inspectable.
- The PoC makes no additional Antigravity calls and does not bypass cost guard.
- The result matrix adds real review/CI value beyond the current reports.

If any gate fails, retain the current harness without a partial migration.
