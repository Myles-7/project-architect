import type {
  ProjectSnapshot,
  DocumentPlan,
  DocumentPlanItem,
} from '@project-architect/contracts';

export class DocumentPlanner {
  /**
   * Maximum allowed dynamic specialty documents to prevent uncontrolled sprawl.
   */
  static readonly MAX_DYNAMIC_SPECS = 5;

  /**
   * Plans the complete document package structure based on project maturity and domain tags.
   * Guarantees exactly 8 canonical core documents and up to 5 specialty specifications.
   */
  plan(snapshot: ProjectSnapshot): DocumentPlan {
    const documents: DocumentPlanItem[] = [
      {
        type: 'agents',
        title: 'AGENTS.md',
        path: 'AGENTS.md',
        description: 'AI Coding Agent guidelines, locked boundaries, and development rules',
        required: true,
      },
      {
        type: 'project',
        title: 'PROJECT.md',
        path: 'docs/PROJECT.md',
        description: 'Project overview, vision, target user persona, and core pain points',
        required: true,
      },
      {
        type: 'product',
        title: 'PRODUCT.md',
        path: 'docs/PRODUCT.md',
        description: 'In-scope MVP feature specifications and explicit out-of-scope non-goals',
        required: true,
      },
      {
        type: 'user-flow',
        title: 'USER_FLOWS.md',
        path: 'docs/USER_FLOWS.md',
        description: 'End-to-end user journeys, step-by-step flows, and edge cases',
        required: true,
      },
      {
        type: 'ux-ui',
        title: 'UX_UI_SPEC.md',
        path: 'docs/UX_UI_SPEC.md',
        description: 'Visual layout hierarchy, user interaction models, and styling rules',
        required: true,
      },
      {
        type: 'technical-guide',
        title: 'TECHNICAL_GUIDE.md',
        path: 'docs/TECHNICAL_GUIDE.md',
        description: 'Lightweight technical guide: platform constraints, architecture baselines, and delegated freedom',
        required: true,
      },
      {
        type: 'development-plan',
        title: 'DEVELOPMENT_PLAN.md',
        path: 'docs/DEVELOPMENT_PLAN.md',
        description: 'Phased development roadmap, milestones, and technical constraints',
        required: true,
      },
      {
        type: 'acceptance',
        title: 'ACCEPTANCE.md',
        path: 'docs/ACCEPTANCE.md',
        description: 'Definition of Done (DoD), automated test strategy, and verification criteria',
        required: true,
      },
    ];

    const tags = (snapshot.metadata.projectTags || []).map((t) => t.toLowerCase());
    const allText = [
      ...tags,
      ...snapshot.decisions.items.map((d) => d.statement.toLowerCase()),
      ...snapshot.assumptions.items.map((a) => a.statement.toLowerCase()),
    ].join(' ');

    const dynamicSpecs: DocumentPlanItem[] = [];

    // 1. AI Specification
    const isAiProject =
      tags.some((t) => t.includes('ai') || t.includes('agent') || t.includes('llm') || t.includes('prompt')) ||
      allText.includes('model') ||
      allText.includes('agent') ||
      allText.includes('prompt');

    if (isAiProject) {
      dynamicSpecs.push({
        type: 'ai-spec',
        title: 'AI_SPEC.md',
        path: 'docs/specs/AI_SPEC.md',
        description: 'AI interaction model, prompt constitution, and token bounds',
        required: false,
      });
    }

    // 2. Desktop Specification
    const isDesktopProject =
      tags.some((t) => t.includes('desktop') || t.includes('electron') || t.includes('tauri') || t.includes('windows') || t.includes('macos')) ||
      allText.includes('desktop app') ||
      allText.includes('system tray') ||
      allText.includes('native window');

    if (isDesktopProject) {
      dynamicSpecs.push({
        type: 'desktop-spec',
        title: 'DESKTOP_SPEC.md',
        path: 'docs/specs/DESKTOP_SPEC.md',
        description: 'Native OS integration, window lifecycle, and local file operations',
        required: false,
      });
    }

    // 3. Security Specification
    const isSecurityProject =
      tags.some((t) => t.includes('security') || t.includes('vault') || t.includes('crypto') || t.includes('auth')) ||
      allText.includes('encrypt') ||
      allText.includes('security boundary') ||
      allText.includes('jwt');

    if (isSecurityProject) {
      dynamicSpecs.push({
        type: 'security',
        title: 'SECURITY_SPEC.md',
        path: 'docs/specs/SECURITY_SPEC.md',
        description: 'Data encryption, authentication boundaries, and threat mitigation',
        required: false,
      });
    }

    // 4. Synchronization & Conflict Specification
    const isSyncProject =
      tags.some((t) => t.includes('sync') || t.includes('crdt') || t.includes('collaboration')) ||
      allText.includes('conflict resolution') ||
      allText.includes('multi-device sync') ||
      allText.includes('offline sync');

    if (isSyncProject) {
      dynamicSpecs.push({
        type: 'sync-spec',
        title: 'SYNC_SPEC.md',
        path: 'docs/specs/SYNC_SPEC.md',
        description: 'Cross-device synchronization topology, idempotency, and conflict resolution',
        required: false,
      });
    }

    // 5. Privacy Specification
    const isPrivacyProject =
      tags.some((t) => t.includes('privacy') || t.includes('local-first') || t.includes('zero-telemetry')) ||
      allText.includes('zero cloud') ||
      allText.includes('no telemetry') ||
      allText.includes('data sovereignty');

    if (isPrivacyProject) {
      dynamicSpecs.push({
        type: 'privacy-spec',
        title: 'PRIVACY_SPEC.md',
        path: 'docs/specs/PRIVACY_SPEC.md',
        description: 'Data ownership, zero telemetry invariants, and local isolation guarantees',
        required: false,
      });
    }

    // Enforce max dynamic specifications boundary (Max 5)
    const cappedDynamicSpecs = dynamicSpecs.slice(0, DocumentPlanner.MAX_DYNAMIC_SPECS);
    documents.push(...cappedDynamicSpecs);

    return {
      projectId: snapshot.metadata.projectId,
      sourceRevision: snapshot.metadata.stateRevision,
      documents,
    };
  }
}
