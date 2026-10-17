import type {
  ProjectSnapshot,
  DocumentsState,
  DocumentDiffResult,
} from '@project-architect/contracts';

export class DocumentDiffEngine {
  private areaToDocumentMap: Record<string, string[]> = {
    project_overview: ['AGENTS.md', 'PROJECT.md'],
    target_user: ['PROJECT.md', 'PRODUCT.md', 'USER_FLOWS.md', 'UX_UI_SPEC.md'],
    core_problem: ['PROJECT.md'],
    mvp_scope: ['AGENTS.md', 'PRODUCT.md', 'ACCEPTANCE.md'],
    core_features: ['PRODUCT.md', 'TECHNICAL_GUIDE.md', 'USER_FLOWS.md'],
    user_flows: ['USER_FLOWS.md', 'UX_UI_SPEC.md', 'ACCEPTANCE.md'],
    page_structure: ['USER_FLOWS.md', 'UX_UI_SPEC.md'],
    ux_ui: ['UX_UI_SPEC.md'],
    ux_ui_direction: ['UX_UI_SPEC.md'],
    technical_boundary: [
      'AGENTS.md',
      'TECHNICAL_GUIDE.md',
      'DEVELOPMENT_PLAN.md',
      'AI_SPEC.md',
      'DESKTOP_SPEC.md',
      'SECURITY_SPEC.md',
      'SYNC_SPEC.md',
      'PRIVACY_SPEC.md',
    ],
    delivery_plan: ['DEVELOPMENT_PLAN.md', 'ACCEPTANCE.md'],
    ai_model: ['AGENTS.md', 'AI_SPEC.md'],
    security: ['AGENTS.md', 'SECURITY_SPEC.md', 'PRIVACY_SPEC.md'],
    sync: ['SYNC_SPEC.md'],
    desktop: ['DESKTOP_SPEC.md'],
    privacy: ['PRIVACY_SPEC.md'],
  };

  /**
   * Compares the current ProjectSnapshot state revision with stored documents manifest
   * to detect stale documents and map specific area impacts.
   */
  diff(
    snapshot: ProjectSnapshot,
    documentsState?: DocumentsState,
    modifiedAreas?: string[]
  ): DocumentDiffResult[] {
    const currentStateRevision = snapshot.metadata.stateRevision;
    const items = documentsState?.items || snapshot.documents?.items || [];

    if (items.length === 0) {
      return [];
    }

    const directlyAffectedDocs = new Set<string>();
    if (modifiedAreas && modifiedAreas.length > 0) {
      for (const area of modifiedAreas) {
        const mapped = this.areaToDocumentMap[area] || [];
        for (const docTitle of mapped) {
          directlyAffectedDocs.add(docTitle);
        }
      }
    }

    return items.map((doc) => {
      // 1. If explicit modified areas were specified, only mark directly affected documents as outdated
      if (modifiedAreas && modifiedAreas.length > 0) {
        const isAreaImpacted = directlyAffectedDocs.has(doc.title);
        if (isAreaImpacted) {
          return {
            document: doc.title,
            path: doc.path,
            status: 'outdated' as const,
            reason: `Modified decision areas [${modifiedAreas.join(', ')}] directly impact ${doc.title}.`,
            affectedAreas: modifiedAreas,
          };
        }
        return {
          document: doc.title,
          path: doc.path,
          status: 'up-to-date' as const,
        };
      }

      // 2. Fallback: if no specific areas provided, check global state revision
      const isRevisionOutdated = currentStateRevision > doc.sourceRevision;
      if (isRevisionOutdated) {
        return {
          document: doc.title,
          path: doc.path,
          status: 'outdated' as const,
          reason: `Project state revision evolved from ${doc.sourceRevision} to ${currentStateRevision}.`,
          affectedAreas: [],
        };
      }

      return {
        document: doc.title,
        path: doc.path,
        status: 'up-to-date' as const,
      };
    });
  }

  /**
   * Compares the on-disk document content with newly rendered content using Myers LCS algorithm.
   * Eliminates pseudo-diffs caused by line shifts.
   * Returns whether a diff exists, unified diff text, and change counts.
   */
  computeFileDiff(
    diskContent: string,
    newContent: string,
    filename: string
  ): {
    hasDiff: boolean;
    unifiedDiff: string;
    additionsCount?: number;
    deletionsCount?: number;
    unchangedCount?: number;
  } {
    const normalize = (s: string) => s.replace(/\r\n/g, '\n');
    const diskNorm = normalize(diskContent);
    const newNorm = normalize(newContent);

    const splitLines = (s: string) => (s === '' ? [] : s.split('\n'));
    const diskLines = splitLines(diskNorm);
    const newLines = splitLines(newNorm);

    if (diskNorm === newNorm) {
      return {
        hasDiff: false,
        unifiedDiff: '',
        additionsCount: 0,
        deletionsCount: 0,
        unchangedCount: diskLines.length,
      };
    }

    interface DiffOp {
      type: 'unchanged' | 'added' | 'removed';
      line: string;
    }

    // Myers LCS Diff Algorithm with common prefix/suffix optimization
    const computeMyersDiff = (a: string[], b: string[]): DiffOp[] => {
      const n = a.length;
      const m = b.length;

      // 1. Strip common prefix
      let prefix = 0;
      while (prefix < n && prefix < m && a[prefix] === b[prefix]) {
        prefix++;
      }

      // 2. Strip common suffix
      let suffixA = n - 1;
      let suffixB = m - 1;
      while (suffixA >= prefix && suffixB >= prefix && a[suffixA] === b[suffixB]) {
        suffixA--;
        suffixB--;
      }

      const midA = a.slice(prefix, suffixA + 1);
      const midB = b.slice(prefix, suffixB + 1);
      const midEdits: DiffOp[] = [];

      const midN = midA.length;
      const midM = midB.length;

      if (midN === 0) {
        for (const line of midB) {
          midEdits.push({ type: 'added', line });
        }
      } else if (midM === 0) {
        for (const line of midA) {
          midEdits.push({ type: 'removed', line });
        }
      } else {
        const max = midN + midM;
        const offset = max;
        const v = new Int32Array(2 * max + 1);
        v.fill(-1);
        v[1 + offset] = 0;
        const trace: Int32Array[] = [];

        let finalD = -1;
        outer: for (let d = 0; d <= max; d++) {
          trace.push(new Int32Array(v));
          for (let k = -d; k <= d; k += 2) {
            const vLeft = v[k - 1 + offset] ?? -1;
            const vRight = v[k + 1 + offset] ?? -1;
            let x: number;
            if (k === -d || (k !== d && vLeft < vRight)) {
              x = vRight;
            } else {
              x = vLeft + 1;
            }
            let y = x - k;
            while (x < midN && y < midM && midA[x] === midB[y]) {
              x++;
              y++;
            }
            v[k + offset] = x;
            if (x >= midN && y >= midM) {
              finalD = d;
              break outer;
            }
          }
        }

        const midEditsReversed: DiffOp[] = [];
        let currentX = midN;
        let currentY = midM;
        for (let d = finalD; d > 0; d--) {
          const vPrev = trace[d];
          if (!vPrev) break;
          const k = currentX - currentY;
          const vLeft = vPrev[k - 1 + offset] ?? -1;
          const vRight = vPrev[k + 1 + offset] ?? -1;
          let prevK: number;
          if (k === -d || (k !== d && vLeft < vRight)) {
            prevK = k + 1;
          } else {
            prevK = k - 1;
          }
          const prevX = vPrev[prevK + offset] ?? 0;
          const prevY = prevX - prevK;

          while (currentX > prevX && currentY > prevY) {
            currentX--;
            currentY--;
            midEditsReversed.push({ type: 'unchanged', line: midA[currentX] ?? '' });
          }

          if (currentX === prevX) {
            currentY--;
            midEditsReversed.push({ type: 'added', line: midB[currentY] ?? '' });
          } else {
            currentX--;
            midEditsReversed.push({ type: 'removed', line: midA[currentX] ?? '' });
          }
        }

        while (currentX > 0 && currentY > 0) {
          currentX--;
          currentY--;
          midEditsReversed.push({ type: 'unchanged', line: midA[currentX] ?? '' });
        }

        for (const op of midEditsReversed.reverse()) {
          midEdits.push(op);
        }
      }

      const edits: DiffOp[] = [];
      for (let i = 0; i < prefix; i++) {
        edits.push({ type: 'unchanged', line: a[i] ?? '' });
      }
      for (const op of midEdits) {
        edits.push(op);
      }
      for (let i = suffixA + 1; i < n; i++) {
        edits.push({ type: 'unchanged', line: a[i] ?? '' });
      }

      return edits;
    };

    const edits = computeMyersDiff(diskLines, newLines);

    let additionsCount = 0;
    let deletionsCount = 0;
    let unchangedCount = 0;
    const changeIndices: number[] = [];

    for (let i = 0; i < edits.length; i++) {
      const op = edits[i];
      if (!op) continue;
      if (op.type === 'added') {
        additionsCount++;
        changeIndices.push(i);
      } else if (op.type === 'removed') {
        deletionsCount++;
        changeIndices.push(i);
      } else {
        unchangedCount++;
      }
    }

    if (changeIndices.length === 0) {
      return { hasDiff: false, unifiedDiff: '', additionsCount: 0, deletionsCount: 0, unchangedCount };
    }

    const CONTEXT = 3;
    const firstChangeIdx = changeIndices[0] ?? 0;
    const hunks: Array<{ start: number; end: number }> = [];
    let currentHunkStart = Math.max(0, firstChangeIdx - CONTEXT);
    let currentHunkEnd = Math.min(edits.length, firstChangeIdx + CONTEXT + 1);

    for (let c = 1; c < changeIndices.length; c++) {
      const idx = changeIndices[c];
      if (idx === undefined) continue;
      const startCandidate = Math.max(0, idx - CONTEXT);
      if (startCandidate <= currentHunkEnd) {
        currentHunkEnd = Math.min(edits.length, idx + CONTEXT + 1);
      } else {
        hunks.push({ start: currentHunkStart, end: currentHunkEnd });
        currentHunkStart = startCandidate;
        currentHunkEnd = Math.min(edits.length, idx + CONTEXT + 1);
      }
    }
    hunks.push({ start: currentHunkStart, end: currentHunkEnd });

    const header = `--- a/${filename}\t(on-disk manual version)\n+++ b/${filename}\t(newly compiled version)\n`;
    const diffLines: string[] = [header];

    for (const hunk of hunks) {
      let diskLine = 1;
      let newLine = 1;
      for (let i = 0; i < hunk.start; i++) {
        const op = edits[i];
        if (op && op.type !== 'added') diskLine++;
        if (op && op.type !== 'removed') newLine++;
      }

      let hunkDiskCount = 0;
      let hunkNewCount = 0;
      for (let i = hunk.start; i < hunk.end; i++) {
        const op = edits[i];
        if (op && op.type !== 'added') hunkDiskCount++;
        if (op && op.type !== 'removed') hunkNewCount++;
      }

      diffLines.push(`@@ -${diskLine},${hunkDiskCount} +${newLine},${hunkNewCount} @@`);
      for (let i = hunk.start; i < hunk.end; i++) {
        const op = edits[i];
        if (!op) continue;
        if (op.type === 'unchanged') {
          diffLines.push(` ${op.line}`);
        } else if (op.type === 'removed') {
          diffLines.push(`-${op.line}`);
        } else if (op.type === 'added') {
          diffLines.push(`+${op.line}`);
        }
      }
    }

    return {
      hasDiff: true,
      unifiedDiff: diffLines.join('\n'),
      additionsCount,
      deletionsCount,
      unchangedCount,
    };
  }
}
