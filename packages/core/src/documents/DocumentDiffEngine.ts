import type {
  ProjectSnapshot,
  DocumentsState,
  DocumentDiffResult,
} from '@project-architect/contracts';

export class DocumentDiffEngine {
  private areaToDocumentMap: Record<string, string[]> = {
    target_user: ['PROJECT.md', 'PRODUCT.md', 'USER_FLOWS.md', 'UX_UI_SPEC.md'],
    project_overview: ['AGENTS.md', 'PROJECT.md'],
    core_problem: ['PROJECT.md'],
    mvp_scope: ['AGENTS.md', 'PRODUCT.md', 'ACCEPTANCE.md'],
    user_flows: ['USER_FLOWS.md', 'UX_UI_SPEC.md', 'ACCEPTANCE.md'],
    ux_ui: ['UX_UI_SPEC.md'],
    technical_boundary: ['AGENTS.md', 'DEVELOPMENT_PLAN.md', 'AI_SPEC.md', 'SECURITY.md'],
    ai_model: ['AGENTS.md', 'AI_SPEC.md'],
    security: ['AGENTS.md', 'SECURITY.md'],
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
      const isRevisionOutdated = currentStateRevision > doc.sourceRevision;
      const isAreaImpacted = directlyAffectedDocs.has(doc.title);

      if (isRevisionOutdated || isAreaImpacted) {
        let reason = `Project state revision evolved from ${doc.sourceRevision} to ${currentStateRevision}.`;
        if (isAreaImpacted && modifiedAreas && modifiedAreas.length > 0) {
          reason = `Modified decision areas [${modifiedAreas.join(', ')}] directly impact ${doc.title}.`;
        }

        return {
          document: doc.title,
          path: doc.path,
          status: 'outdated' as const,
          reason,
          affectedAreas: modifiedAreas || [],
        };
      }

      return {
        document: doc.title,
        path: doc.path,
        status: 'up-to-date' as const,
      };
    });
  }
}
