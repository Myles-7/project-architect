# B vs B2 Targeted Regression Report

## Executive Summary

All six requested cases completed with 12 primary Antigravity calls. Both variants produced structured output for every call; there was no CLI, timeout, schema, or guardrail failure. B2 materially reduces implementation assumptions and false conflicts, but does not fully satisfy the all-fields WHAT-before-HOW gate: it still introduces encryption/synchronisation implementation choices in cases 05, 08, and 09. It also partially regresses case-01 cleanup-scope coverage and case-09 recovery/security prioritization.

**Recommendation: do not promote B2 to Full 10-Case Regression yet.** Preserve this B2 raw result. Do not modify B or silently patch this B2 run.

## Execution Status

- Run id: `b-vs-b2-targeted-1`
- Requested/completed: case-01, case-03, case-05, case-06, case-08, case-09 / case-01, case-03, case-05, case-06, case-08, case-09
- Primary calls: 12; exactly one per Case × Variant
- Guardrail stop: no
- Retries: none
- B stayed unchanged; additions are isolated B2 prompt/schema/runner/reporting.

## Token and Duration Results

| Variant | Structured success | Avg input | Avg output | Avg thinking | Avg total | Avg duration | Tech warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B | 100% | 18519 | 7916 | 6164 | 26435 | 26801 ms | 23 |
| B2 | 100% | 19271 | 8618 | 6922 | 27889 | 27207 ms | 3 |

B2 total-token delta vs B: **5.5%**, below the +20% warning threshold. Existing heuristic quality averages are B 4.83 / 5 and B2 4.72 / 5. They are not the decision criterion.

## Implementation Assumption and Technology Framing

B2 reduces warning count from 23 to 3 and removes the recurring stack/database/protocol framing in the target cases. This is material but incomplete: case-05 emits E2EE and direct/cloud sync choices, case-08 introduces E2EE in a risk, and case-09 recommends zero-knowledge cloud sync. Because the gate applies to every user-visible field, this remains a blocking issue.

## Conflict Precision

B2 is materially better: no ordinary tradeoffs are labeled conflicts in cases 01, 03, 06, 08, or 09, and `tensions` are used as intended. Case-05 preserves the true hard conflict. Its conflict record nevertheless adds a separate device-discovery security risk; that phrase should be split into Risk/Tension rather than remain inside Conflict.

## Gap and Challenge Preservation

- Case-01: safety, platform, and target-user issues remain; direct MVP cleanup-scope questioning is missing.
- Case-03: rescheduling and syllabus-source gaps remain; mobile-responsive question partially reopens desktop-only scope.
- Case-05: genuine conflict remains critical.
- Case-06/08: repair workflow, role/permission, sharing, merge, and identity challenges remain without B’s database/protocol framing.
- Case-09: recovery/autofill/security risks and scope challenge remain, but recovery/security policy is not the leading question.

## Recommendation Usefulness

B2 remains useful and concrete in cases 01, 03, 06, and much of 08. Its case-05 and case-09 recommendations are less suitable for Discovery because they prescribe a particular encrypted-sync architecture. This is a precision problem, not a reliability failure.

## Structured Output Reliability and Failures

- B: 6/6 structured successes.
- B2: 6/6 structured successes.
- CLI failure: none.
- Timeout: none.
- Schema/parse failure: none.
- Guardrail outlier: none.

## Blocking Issues

1. **Technology gate incomplete across fields.** B2 no longer puts named technology in assumptions, but still introduces E2EE/zero-knowledge/direct-sync choices in candidates, risks, tensions, options, and recommendations.
2. **Case-05 conflict wording remains partly overclassified.** The strict conflict is present, but an independent security risk is bundled into it.
3. **Challenge prioritization needs correction.** Case-01 misses an explicit cleanup-scope question; case-09 does not prioritize recovery/security policy.
4. **Duplicate/reopening guard needs review.** Case-03 reopens mobile access despite stated desktop-browser-only MVP.

## Decision

B2 meets stability and cost requirements and clearly improves assumption/conflict behavior. It does not yet satisfy the required all-field technology gate and fully preserve the specified priority of case-01/case-09 challenges. **Do not promote B2.**

## Next Step

Wait for a separate prompt-design decision. Do not run B2 Full 10-Case Regression, Variance Test, Promptfoo, or another variant automatically.
