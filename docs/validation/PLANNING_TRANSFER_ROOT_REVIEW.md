# Transfer entry and archive review

The root independently reviewed the transfer repair after the implementer stopped editing. This review covers source protection and archive representation, not AI content quality or the target application's implementation.

## Specification review

Passed for the implemented scope. Public duplicate/export routes resolve the registered or canonical location without Engine loading/recovery. Duplicate no longer reads a source snapshot to manufacture its default name; ForkService derives that name from the verified copied snapshot. Export validates the exact current pointer while holding the Core lock, then reads the archive under the same lock. A corrupted current revision with an intact predecessor fails visibly instead of recovering the source. Copy/import retain historical revision files and isolate copied runtime receipts from resumable runs.

The root ran the four transfer/source files independently: 20 passed, zero failed or skipped (`project-transfer-root-review-20261004.json`). The nine archive-boundary cases were then run separately: 9 passed, zero failed or skipped (`project-archive-root-review-20261004.json`). This includes public registered/canonical damaged-source paths, complete source-tree comparison, normal round trips, hidden/nested historical files, and exactly representable versus overflowing archive fields.

## Code quality review

No remaining blocking finding in this scope. The resolver has a narrow read-only contract; mutation remains in independent staging. The ZIP layout validator runs before payload checksum/allocation and is applied both to file-stat estimates and actual builder bytes. UTF-8 byte lengths are checked rather than character counts. Large 32-bit boundary tests use synthetic lengths and do not allocate multi-gigabyte payloads. The two-stage Core transfer commit continues to validate identity and preserve old revisions.

The Core lock protects formal revisions; it does not claim to freeze live Runtime log writes. Copied runtime observations remain archived and cannot resume. These limitations are preserved in the implementation report. This review did not run a Provider, alter frozen scenario evidence, or commit changes.
