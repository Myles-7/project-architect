# B2.1 Full Validation Report

## Executive Summary

**Passed.** Run b2-1-full-validation-1 executed all ten existing fixtures once,
with one primary Antigravity call per case and no retries. B2.1 retained
gap-first product reasoning and challenge behavior while meeting the
Capability-Before-Mechanism and strict-conflict requirements.

## Execution Status

| Measure | Result |
| --- | ---: |
| Requested / completed cases | 10 / 10 |
| Calls per case | 1 |
| Structured-output success | 10 / 10 (100%) |
| CLI failures / timeouts / schema failures | 0 / 0 / 0 |
| Guardrail stops | 0 |
| Premature-technology warnings | 0 |

## Token and Duration Results

| Measure | Result |
| --- | ---: |
| Average input tokens / case | 20,958.3 |
| Average output tokens / case | 7,886 |
| Average thinking tokens / case | 6,268.5 |
| Average total tokens / case | 28,844.3 |
| Median total tokens | 28,911 |
| Minimum total tokens | 25,866 (case-01) |
| Maximum total tokens | 31,809 (case-05) |
| Average duration | 37,836.5 ms |
| Median duration | 36,622 ms |

## Manual Behavior Review

### Technology Discipline

All ten normalized outputs were checked against the expanded Chinese and English
mechanism list and then manually sampled across every user-visible field. No
output introduced a framework, database, protocol, encryption/key design,
pairing/transport route, cloud topology, or recovery architecture. Product-level
capabilities such as data-access promises, offline use, visible conflict handling,
and recovery policy remain present.

### Conflict Precision

Only case-05 contains a conflicts entry. It names the two directly stated hard
constraints: data never leaving the computer and zero-setup automatic continuity
after replacing it. Security, loss, and convenience consequences are kept in
risks and tensions.

### Product Thinking and Challenge Preservation

- case-01 retained user/platform, safe cleanup boundary, and MVP scope.
- case-03 focused on plan-generation logic and delayed-task rebalancing instead
  of reopening stated platform, language, registration, or synchronization facts.
- case-04 challenged an oversized first release.
- case-06 focused on workflow, inventory, and permissions rather than storage
  technology.
- case-08 focused on offline editing, visible merge experience, and trust
  boundary without naming a merge/sync protocol.
- case-09 elevated trust promise, recovery policy, and MVP scope without a
  cryptographic recommendation.
- case-10 used delegated low-risk decision authority while keeping assumptions
  visible.

Automated quality scores remain heuristic/manual-review-needed. These findings
come from direct output review, not a claim of objective semantic truth.

## Outliers and Known Limits

There were no provider or structured-output outliers. case-05 is the largest
token result because it contains a genuine critical conflict and its consequences.
The model still makes product recommendations, as intended; final product
acceptance remains user authority.

## Decision

B2.1 passes Full Validation and is eligible for the designated Variance Test.

## Evidence

- [Full summary](../results/b2-1-full-validation-summary.json)
- [Normalized outputs](../results/normalized/b2-1-full-validation-1/)
- [Raw envelopes](../results/raw/b2-1-full-validation-1/)

