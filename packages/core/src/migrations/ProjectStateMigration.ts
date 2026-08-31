import type { ProjectSnapshot } from '@project-architect/contracts';
import { AreaRegistry } from '../areas/AreaRegistry.js';

export interface MigrationDiagnostics {
  normalizedAreas: number;
  unknownAreas: string[];
  legacySchemaFiles: string[];
}

export class ProjectStateMigration {
  /**
   * Performs non-destructive in-memory normalization of legacy or alias area IDs.
   * Locked decisions only have their area normalized without changing statement, status, or evidence.
   */
  static migrateInMemory(snapshot: ProjectSnapshot): {
    snapshot: ProjectSnapshot;
    diagnostics: MigrationDiagnostics;
  } {
    const diagnostics: MigrationDiagnostics = {
      normalizedAreas: 0,
      unknownAreas: [],
      legacySchemaFiles: [],
    };

    const unknownSet = new Set<string>();

    // 1. Migrate Decisions
    if (snapshot.decisions?.items) {
      for (const d of snapshot.decisions.items) {
        const resolved = AreaRegistry.resolve(d.area);
        if (resolved.area !== d.area || resolved.isUnknown) {
          diagnostics.normalizedAreas++;
          if (resolved.isUnknown && d.area) {
            unknownSet.add(d.area);
          }
          if (!d.sourceArea && (resolved.sourceArea || resolved.isUnknown)) {
            d.sourceArea = resolved.sourceArea || d.area;
          }
          d.area = resolved.area;
        }
      }
    }

    // 2. Migrate Gaps
    if (snapshot.gaps?.gaps) {
      for (const g of snapshot.gaps.gaps) {
        const resolved = AreaRegistry.resolve(g.area);
        if (resolved.area !== g.area || resolved.isUnknown) {
          diagnostics.normalizedAreas++;
          if (resolved.isUnknown && g.area) {
            unknownSet.add(g.area);
          }
          if (!(g as any).sourceArea && (resolved.sourceArea || resolved.isUnknown)) {
            (g as any).sourceArea = resolved.sourceArea || g.area;
          }
          g.area = resolved.area;
        }
      }
    }

    // 3. Migrate Overview Sections
    if (snapshot.overview?.sections) {
      for (const sec of snapshot.overview.sections) {
        const resolved = AreaRegistry.resolve(sec.id);
        if (resolved.area !== sec.id) {
          sec.id = resolved.area;
          sec.title = AreaRegistry.getTitle(resolved.area);
        }
      }
    }

    diagnostics.unknownAreas = Array.from(unknownSet);
    return { snapshot, diagnostics };
  }
}
