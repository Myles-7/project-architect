# B vs E Smoke Report

## Execution Status

- Requested: case-01, case-03, case-05
- Completed: case-01, case-03, case-05
- Guardrail stop: no
- Each executed Case × Variant made exactly one main CLI call.

## Token, Duration, and Structured Output

| Variant | Cases | Avg input | Avg total | Avg duration ms | Structured success | Avg prompt chars | Avg context chars |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B | 3 | 19885 | 27167 | 26143 | 100% | 1105 | 115 |
| E | 3 | 20281 | 26900 | 22927 | 100% | 2075 | 353 |

E token change vs B: **-1.0%**. Quality metrics are heuristic/manual-review-needed: B 4.77 / 5; E 4.73 / 5.

## Required Decision Questions

1. **B Token / Case:** 27167.
2. **E Token / Case:** 26900.
3. **E token change:** -1.0%.
4. **Structured Output:** B 100%; E 100%.
5. **Case 01 core gaps:** **B is better.** B surfaced safety boundary, target-user/UI, and MVP scope. E correctly represented safety as a tension, but concentrated on platform and did not ask its high safety/scope gap.
6. **Case 03 duplicates / assumption restraint:** **E is better on duplicate/conflict discipline.** B reopened the already-confirmed email choice and labeled email/WeChat and desktop/library tradeoffs as conflicts. E selected only the unresolved plan-generation question and used tensions. E still made over-specific assumptions (for example, basic email-password auth and manual rescheduling), so it does not clearly win assumption restraint.
7. **Case 05 conflict:** **Both found the core conflict; E is more precise structurally.** Both identified offline/no-data-leaving-device versus automatic cross-device sync. E emitted one critical structured conflict plus a separate tension; B emitted two conflict strings, the second being less direct.
8. **Is E worth added complexity?** **No, not yet.** It meets the cost condition and fixes classification in two cases, but does not clearly improve overall gap/question quality and loses Case 01 coverage.
9. **Recommendation:** **Keep B as the V1 baseline.** Do not upgrade to E in its current form.
10. **Ready for Winner Validation?** **No.** Revise E’s gap-to-question prioritization and assumption rule, then rerun this three-case B/E smoke before any winner validation.

## Notes

- assumption_over_specification and conflict_precision are heuristic/manual-review-needed, not objective truth.
- B uses its existing constitution and unified schema unchanged. E uses a separate one-call schema with bounded context.
