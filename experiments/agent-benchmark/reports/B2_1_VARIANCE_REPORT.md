# B2.1 Variance Report

## Executive Summary

**Passed.** Run b2-1-variance-2 independently reran case-01, case-03, and
case-05 once after Full Validation. The test seeks stable decision behavior, not
identical wording.

## Execution and Cost

| Measure | Result |
| --- | ---: |
| Cases / calls | 3 / 3 |
| Structured-output success | 3 / 3 (100%) |
| CLI failures / timeouts / schema failures | 0 / 0 / 0 |
| Average total tokens | 27,059.33 |
| Median / min / max total tokens | 28,058 / 25,425 / 28,058 |
| Average duration | 29,659 ms |
| Premature-technology warnings | 0 |

## Semantic Stability Review

| Case | Full-validation run | Variance run | Result |
| --- | --- | --- | --- |
| case-01 | User/platform, safe cleanup control, MVP boundary | Same product identity, user/platform, cleanup scope, and safety boundary | Stable |
| case-03 | Plan generation and delayed-task rebalancing | Same two core gaps; the high question varied only in the preferred planning choice | Stable |
| case-05 | True offline/no-data-leaving-device versus automatic continuity conflict | Same two hard constraints and the same critical priority | Stable |

No run introduced a concrete technology mechanism. Case-05 did not lose its true
conflict after Conflict Strict Mode was tightened.

## Decision

Variance behavior is sufficient for V1 Candidate freezing. Wording and option
details vary, as expected for a reasoning model, while the decision categories,
priority, core gaps, and conflict classification remain stable.

## Evidence

- [Variance summary](../results/b2-1-variance-2-summary.json)
- [Normalized outputs](../results/normalized/b2-1-variance-2/)
- [Raw envelopes](../results/raw/b2-1-variance-2/)

