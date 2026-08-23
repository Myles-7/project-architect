import type {
  ProjectSnapshot,
  DocumentListView,
  DocumentItemView,
} from '@project-architect/contracts';

/**
 * Pure-function projection: ProjectSnapshot -> DocumentListView.
 *
 * Guaranteed Invariants:
 * 1. Zero state mutations (pure function, does not modify input snapshot).
 * 2. Compares document sourceRevision against current stateRevision to compute isStale.
 * 3. Never leaks host filesystem absolute paths; emits safe relative document paths.
 */
export function documentProjection(snapshot: ProjectSnapshot): DocumentListView {
  const currentRevision = snapshot.metadata.stateRevision;
  const docItems = snapshot.documents?.items || [];

  if (docItems.length === 0) {
    return {
      sourceStateRevision: currentRevision,
      projectId: snapshot.metadata.projectId,
      hasCompiledDocs: false,
      isManifestStale: false,
      items: [],
    };
  }

  const isManifestStale = docItems.some((item) => item.sourceRevision < currentRevision);
  const firstDoc = docItems[0];
  const initialTime = firstDoc?.generatedAt;
  const latestCompiledAt = docItems.reduce<string | undefined>((latest, item) => {
    if (!latest || (item.generatedAt && new Date(item.generatedAt) > new Date(latest))) {
      return item.generatedAt;
    }
    return latest;
  }, initialTime);

  const items: DocumentItemView[] = docItems.map((item, idx) => {
    const isStale = item.sourceRevision < currentRevision;
    return {
      id: item.id || `doc-${item.type || idx}`,
      type: item.type,
      title: item.title,
      path: item.path,
      status: item.status,
      generatedAt: item.generatedAt,
      sourceRevision: item.sourceRevision,
      isStale,
      sizeBytes: undefined,
    };
  });

  return {
    sourceStateRevision: currentRevision,
    projectId: snapshot.metadata.projectId,
    hasCompiledDocs: true,
    compiledAt: latestCompiledAt || snapshot.documents?.updatedAt,
    isManifestStale,
    items,
  };
}
