# B2.1 Patch Regression Report

## Executive Result

**Passed on run b2-1-patch-regression-2.** This was the required second,
independent four-case gate after the first patch attempt exposed a cross-field
technology-leakage failure. The architecture remains one specialized agent, one
agy.exe call per case, the existing B2 inline schema, and the existing provider.

## Change Made

The B2.1 constitution now requires a silent cross-field compliance check before
returning JSON. It explicitly bans indirect mechanisms as well as named ones:
encryption and key handling, device pairing, biometric unlocking, recovery-key
design, direct/local-network/USB transfer routes, server topology, and concrete
merge/storage/authentication methods. Each must be expressed as a user-facing
capability, trust boundary, promise, or tradeoff instead.

The runner only gained warning-level multilingual detection for such terms. It
does not rewrite or filter model output. Provider, schema, fixtures, Variant B,
and call count are unchanged.

## Run History

| Run | Cases | Structured output | Result |
| --- | --- | ---: | --- |
| b2-1-patch-regression-1 | 01, 05, 08, 09 | 4/4 | Failed manual Technology Discipline review: case-05 prescribed encrypted synchronization, a shared key, and device authorization. Raw evidence preserved. |
| b2-1-patch-regression-2 | 01, 05, 08, 09 | 4/4 | Passed. No CLI, timeout, schema, guardrail, or technology-warning failure. |

## Run 2 Metrics

| Measure | Result |
| --- | ---: |
| Calls | 4 |
| Structured-output success | 4 / 4 (100%) |
| CLI failures / timeouts / schema failures | 0 / 0 / 0 |
| Average input / output / thinking tokens | 22,689 / 6,766.75 / 4,893.75 |
| Average total tokens | 29,455.75 |
| Median / min / max total tokens | 27,926.5 / 25,944 / 36,026 |
| Average duration | 40,214 ms |
| Premature-technology warnings | 0 |

## Manual Targeted Checks

| Case | Result |
| --- | --- |
| case-01 | Retained target user/platform, safety boundary, and MVP cleanup scope. No implementation stack was proposed. |
| case-05 | Retained exactly the offline/no-data-leaving-device versus automatic cross-device continuity conflict. Security consequences are risks/tensions; recommendations only ask for a product promise and acceptable user operation, not a sync or security mechanism. |
| case-08 | Focused on offline editing, merge experience, visible conflict handling, and product trust boundary. No CRDT, E2EE, protocol, or transport design. |
| case-09 | Asked first about data-access promise, recovery policy, and MVP scope. It did not prescribe zero-knowledge, encryption, keys, or recovery architecture. |

## Evidence

- [Failed run 1 summary](../results/b2-1-patch-regression-summary.json)
- [Passing run 2 summary](../results/b2-1-patch-regression-2-summary.json)
- [Run 2 normalized outputs](../results/normalized/b2-1-patch-regression-2/)
- [Run 2 raw envelopes](../results/raw/b2-1-patch-regression-2/)

