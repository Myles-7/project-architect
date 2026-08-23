import type {
  ProjectSnapshot,
  DocumentPlan,
  DocumentPlanItem,
} from '@project-architect/contracts';

export class DocumentPlanner {
  /**
   * Plans the complete document package structure based on project maturity and domain tags.
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
    const isAiProject =
      tags.some((t) => t.includes('ai') || t.includes('agent') || t.includes('llm')) ||
      snapshot.decisions.items.some((d) => d.statement.toLowerCase().includes('model') || d.statement.toLowerCase().includes('ai'));

    if (isAiProject) {
      documents.push({
        type: 'ai-spec',
        title: 'AI_SPEC.md',
        path: 'docs/AI_SPEC.md',
        description: 'AI interaction model, prompt constitution, and token bounds',
        required: false,
      });
    }

    const isSecurityProject =
      tags.some((t) => t.includes('security') || t.includes('vault') || t.includes('crypto') || t.includes('privacy')) ||
      snapshot.decisions.items.some((d) => d.statement.toLowerCase().includes('encrypt') || d.statement.toLowerCase().includes('security'));

    if (isSecurityProject) {
      documents.push({
        type: 'security',
        title: 'SECURITY.md',
        path: 'docs/SECURITY.md',
        description: 'Data encryption, local storage boundaries, and privacy guarantees',
        required: false,
      });
    }

    return {
      projectId: snapshot.metadata.projectId,
      sourceRevision: snapshot.metadata.stateRevision,
      documents,
    };
  }
}
