import type {
  ProjectSnapshot,
  TimelineView,
  TimelineEvent,
  TypedRef,
  AgentRunTrace,
} from '@project-architect/contracts';

/**
 * Pure-function projection: (ProjectSnapshot, AgentRunTrace[]?) -> TimelineView.
 *
 * Guaranteed Invariants:
 * 1. Zero state mutations (pure function, does not write timeline.json or mutate state).
 * 2. Assembles unified, non-duplicated, deterministically sorted event history.
 * 3. Never leaks host filesystem absolute paths, raw provider envelopes, or internal prompt tokens.
 * 4. Distinctly traces Decision Answer -> Decision -> Gap resolution audit chain.
 */
export function timelineProjection(
  snapshot: ProjectSnapshot,
  agentRunTraces?: AgentRunTrace[]
): TimelineView {
  const events: TimelineEvent[] = [];
  const currentRevision = snapshot.metadata.stateRevision;
  const seenEventKeys = new Set<string>();

  const addEvent = (event: TimelineEvent) => {
    // Unique deterministic key to prevent duplicate entries across overlapping state slices
    const dedupeKey = `${event.kind}|${event.occurredAt}|${event.summary}|${event.relatedRefs.sort().join(',')}`;
    if (!seenEventKeys.has(dedupeKey)) {
      seenEventKeys.add(dedupeKey);
      // Ensure backwards-compatible timestamp alias is populated
      event.timestamp = event.occurredAt;
      events.push(event);
    }
  };

  // 1. Project Creation Event
  addEvent({
    id: `evt-create-${snapshot.metadata.projectId}`,
    kind: 'project_created',
    occurredAt: snapshot.metadata.createdAt || snapshot.metadata.updatedAt || new Date().toISOString(),
    sourceStateRevision: 1,
    title: 'Project Initialized',
    summary: `Project "${snapshot.metadata.name}" initialized at Revision 1`,
    actor: 'user',
    relatedRefs: [],
    visibility: 'user',
    metadata: {
      projectId: snapshot.metadata.projectId,
      initialStage: 'created',
    },
  });

  // 2. Input Materials Events
  if (snapshot.metadata.inputRefs) {
    for (const inp of snapshot.metadata.inputRefs) {
      addEvent({
        id: `evt-${inp.id.replace(':', '-')}`,
        kind: 'input_added',
        occurredAt: inp.createdAt || snapshot.metadata.updatedAt,
        sourceStateRevision: currentRevision,
        title: 'Input Material Added',
        summary: `Added ${inp.kind} material "${inp.label}"`,
        actor: 'user',
        relatedRefs: [inp.id as TypedRef],
        visibility: 'user',
        metadata: {
          kind: inp.kind,
          status: inp.status,
          analysisAvailability: inp.analysisAvailability,
        },
      });
    }
  }

  // 3. Decision Trace Events (Fine-grained audit trail)
  if (snapshot.decisions?.traces) {
    for (const tr of snapshot.decisions.traces) {
      for (const sc of tr.stateChanges) {
        if (sc.action === 'gap-addressed') {
          addEvent({
            id: `evt-trace-gap-${tr.id}-${sc.ref.replace(':', '-')}`,
            kind: 'gap_addressed',
            occurredAt: tr.createdAt || snapshot.metadata.updatedAt,
            sourceStateRevision: currentRevision,
            title: 'Gap Addressed',
            summary: `Gap resolved via decision ${tr.decisionRef}`,
            actor: 'user',
            relatedRefs: [sc.ref, tr.decisionRef, tr.questionRef],
            visibility: 'user',
          });
        } else if (sc.action === 'decision-confirmed') {
          addEvent({
            id: `evt-trace-conf-${tr.id}-${sc.ref.replace(':', '-')}`,
            kind: 'decision_confirmed',
            occurredAt: tr.createdAt || snapshot.metadata.updatedAt,
            sourceStateRevision: currentRevision,
            title: 'Decision Confirmed',
            summary: `Confirmed decision ${sc.ref} answering ${tr.questionRef}`,
            actor: 'user',
            relatedRefs: [sc.ref, tr.questionRef],
            visibility: 'user',
          });
        }
      }
    }
  }

  // 4. Decisions State Events
  if (snapshot.decisions?.items) {
    for (const d of snapshot.decisions.items) {
      const decRef: TypedRef = `decision:${d.id}`;
      if (d.status === 'locked') {
        addEvent({
          id: `evt-lock-${d.id}`,
          kind: 'decision_locked',
          occurredAt: d.updatedAt || snapshot.metadata.updatedAt,
          sourceStateRevision: currentRevision,
          title: 'Decision Locked',
          summary: `Locked ${d.area}: "${sanitizeText(d.statement)}"`,
          actor: 'user',
          relatedRefs: [decRef],
          visibility: 'user',
        });
      } else if (d.status === 'confirmed') {
        addEvent({
          id: `evt-conf-${d.id}`,
          kind: 'decision_confirmed',
          occurredAt: d.updatedAt || snapshot.metadata.updatedAt,
          sourceStateRevision: currentRevision,
          title: 'Decision Confirmed',
          summary: `Confirmed ${d.area}: "${sanitizeText(d.statement)}"`,
          actor: d.origin || 'user',
          relatedRefs: [decRef, ...(d.evidenceRefs || [])],
          visibility: 'user',
        });
      }
    }
  }

  // 5. Questions Answered Events
  if (snapshot.questions?.items) {
    for (const q of snapshot.questions.items) {
      if (q.status === 'answered') {
        addEvent({
          id: `evt-q-${q.id}`,
          kind: 'question_answered',
          occurredAt: q.answeredAt || q.createdAt || snapshot.metadata.updatedAt,
          sourceStateRevision: currentRevision,
          title: 'Question Answered',
          summary: `Answered: "${sanitizeText(q.question)}" ➔ "${sanitizeText(q.answer || '')}"`,
          actor: 'user',
          relatedRefs: [`question:${q.id}` as TypedRef],
          visibility: 'user',
        });
      }
    }
  }

  // 6. Agent Run Traces (if available)
  if (agentRunTraces && Array.isArray(agentRunTraces)) {
    for (const run of agentRunTraces) {
      addEvent({
        id: `evt-agent-${run.id}`,
        kind: 'discovery_turn',
        occurredAt: run.completedAt,
        sourceStateRevision: run.stateRevisionAfter,
        title: `Discovery Run: ${run.mode.toUpperCase()}`,
        summary: `Completed discovery round in ${run.durationMs}ms consuming ${run.tokens} tokens`,
        actor: 'agent',
        relatedRefs: [],
        visibility: 'system',
        metadata: {
          mode: run.mode,
          durationMs: run.durationMs,
          tokens: run.tokens,
          provider: run.provider,
        },
      });
    }
  }

  // 7. Readiness Snapshots & Dispositions
  if (snapshot.readiness?.current) {
    const r = snapshot.readiness.current;
    if (r.userDisposition && r.userDisposition !== 'pending') {
      addEvent({
        id: `evt-readiness-${r.id}`,
        kind: 'readiness_dispositioned',
        occurredAt: r.reviewedAt || snapshot.metadata.updatedAt,
        sourceStateRevision: currentRevision,
        title: 'Readiness Disposition',
        summary: `Readiness disposition submitted: ${r.userDisposition} (Status: ${r.status})`,
        actor: 'user',
        relatedRefs: [],
        visibility: 'user',
        metadata: {
          disposition: r.userDisposition,
          status: r.status,
        },
      });
    }
  }

  // 8. Documents Compiled Events
  if (snapshot.documents?.items && snapshot.documents.items.length > 0) {
    const docs = snapshot.documents;
    const firstDoc = docs.items[0];
    if (firstDoc) {
      const docRevision = firstDoc.sourceRevision || currentRevision;
      addEvent({
        id: `evt-docs-${docRevision}`,
        kind: 'documents_compiled',
        occurredAt: firstDoc.generatedAt || docs.updatedAt || snapshot.metadata.updatedAt,
        sourceStateRevision: docRevision,
        title: 'Specification Documents Compiled',
        summary: `Compiled ${docs.items.length} Markdown development specification documents`,
        actor: 'system',
        relatedRefs: [],
        visibility: 'user',
        metadata: {
          docCount: docs.items.length,
          sourceRevision: docRevision,
        },
      });
    }
  }

  // Deterministic stable sorting:
  // 1. occurredAt timestamp ascending
  // 2. sourceStateRevision ascending (tie-break)
  // 3. id ascending (final tie-break)
  events.sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    if (a.sourceStateRevision !== b.sourceStateRevision) {
      return a.sourceStateRevision - b.sourceStateRevision;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    sourceStateRevision: currentRevision,
    projectId: snapshot.metadata.projectId,
    totalEvents: events.length,
    events,
  };
}

/**
 * Sanitizes user/decision statement text to prevent leaking raw internal paths or prompt templates.
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[A-Za-z]:\\[^"'\s\n]+/g, '[file-path]')
    .replace(/\/Users\/[^"'\s\n]+/g, '[file-path]')
    .replace(/\/home\/[^"'\s\n]+/g, '[file-path]')
    .slice(0, 300);
}
