import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  ProjectSnapshot,
  DocumentPlanItem,
  DecisionItem,
} from '@project-architect/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { AreaRegistry } from '../areas/AreaRegistry.js';

/**
 * Multi-to-one semantic mapping between canonical specification categories
 * and possible decision areas / aliases.
 */
export const AreaCategoryMapping: Record<string, string[]> = {
  technical_boundary: [
    'technical_boundary',
    'platform',
    'architecture',
    'database',
    'runtime',
    'infrastructure',
    'tech_stack',
    'storage',
    'trust_safety',
    'privacy_policy',
  ],
  mvp_scope: ['mvp_scope', 'core_features', 'mvp', 'functional_scope', 'features'],
  target_user: ['target_user', 'core_problem', 'user_persona', 'audience', 'user_profile', 'pain_points'],
  user_flows: ['user_flows', 'interaction_model', 'user_journey', 'flows'],
  page_structure: ['page_structure', 'pages', 'navigation', 'layout'],
  ux_ui_direction: ['ux_ui_direction', 'ux_ui', 'design_system', 'ui_ux'],
  delivery_plan: ['delivery_plan', 'acceptance', 'success_signal', 'milestones'],
  out_of_scope: ['out_of_scope', 'non_goals', 'future_scope', 'exclusions'],
  security: ['security', 'privacy', 'auth', 'encryption', 'vault'],
  ai_model: ['ai_model', 'ai_spec', 'prompt', 'llm', 'token_budget'],
};

export class DocumentRenderer {
  private storage: FileStorage;
  private templatesDir: string;

  constructor(storage: FileStorage = new FileStorage(), templatesDir?: string) {
    this.storage = storage;
    this.templatesDir = templatesDir || join(__dirname, 'templates');
  }

  /**
   * Renders a document from its template using current ProjectSnapshot state data with explicit Source Attribution.
   */
  async renderDocument(
    item: DocumentPlanItem,
    snapshot: ProjectSnapshot
  ): Promise<string> {
    const baseName = basename(item.path);
    const templateFileName = `${baseName}.template`;
    const templatePath = join(this.templatesDir, templateFileName);

    let templateContent = '';
    if (await this.storage.exists(templatePath)) {
      templateContent = await this.storage.readText(templatePath);
    } else {
      templateContent = `# {{PROJECT_NAME}} — ${item.title}\n\n{{CONFIRMED_DECISIONS_SECTION}}`;
    }

    const confirmedDecisions = snapshot.decisions.items.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );
    const lockedDecisions = snapshot.decisions.items.filter((d) => d.status === 'locked');
    const activeAssumptions = snapshot.assumptions.items.filter((a) => a.status === 'active');

    // ------------------------------------------------------------------------
    // Helper 1: Multi-alias Decision Resolver
    // ------------------------------------------------------------------------
    const getDecisionsForCategory = (category: string): DecisionItem[] => {
      const canonicalCategory = AreaRegistry.isValidArea(category) ? category : null;
      const aliases = (AreaCategoryMapping[category] || [category]).map((a) => a.toLowerCase());
      return confirmedDecisions.filter((d) => {
        if (canonicalCategory && AreaRegistry.normalize(d.area) === canonicalCategory) {
          return true;
        }
        return aliases.includes(d.area.toLowerCase());
      });
    };

    const resolveArea = (category: string, fallbackWarning: string): string => {
      const matches = getDecisionsForCategory(category);
      if (matches.length > 0) {
        if (matches.length === 1 && matches[0]) {
          const dec = matches[0];
          return `${dec.statement}\n*(Source: Decision ${dec.id})*`;
        }
        return matches
          .map((dec) => `- **${dec.area}**: ${dec.statement} *(Source: Decision ${dec.id})*`)
          .join('\n');
      }

      // Check assumptions
      const aliases = AreaCategoryMapping[category] || [category];
      const asm = activeAssumptions.find((a) =>
        aliases.some((alias) =>
          a.statement?.toLowerCase().includes(alias.toLowerCase())
        )
      );
      if (asm) {
        return `${asm.statement}\n*(Source: Assumption ${asm.id}, Reason: ${asm.reason})*`;
      }

      return `*(Warning: No explicit decision or assumption confirmed for "${category}". ${fallbackWarning})*`;
    };

    // ------------------------------------------------------------------------
    // Vision & Core Metadata
    // ------------------------------------------------------------------------
    const visionDec = confirmedDecisions.find(
      (d) => d.area === 'project_overview' || d.area === 'general'
    );
    const vision = visionDec
      ? `${visionDec.statement}\n*(Source: Decision ${visionDec.id})*`
      : snapshot.metadata.name;

    const targetUser = resolveArea('target_user', 'Target user profile is pending definition.');
    const techBoundary = resolveArea(
      'technical_boundary',
      snapshot.metadata.projectTags.length > 0
        ? `Project tags: ${snapshot.metadata.projectTags.join(', ')}`
        : 'Technical boundaries and platform constraints pending definition.'
    );
    const coreProblem = resolveArea('core_problem', 'Core problem statement is pending definition.');
    const mvpScope = resolveArea('mvp_scope', 'MVP scope boundaries are pending definition.');
    const outOfScope = resolveArea('out_of_scope', 'Explicit out-of-scope exclusions are pending definition.');
    const userFlows = resolveArea('user_flows', 'Core user flows and journeys are pending definition.');
    const uxUi = resolveArea('ux_ui', 'UX/UI design direction and principles are pending definition.');
    const aiSpec = resolveArea('ai_model', 'AI model configuration and token budgets are pending definition.');
    const securitySpec = resolveArea('security', 'Security and data privacy boundaries are pending definition.');

    // ------------------------------------------------------------------------
    // Lists: Locked Decisions & Active Assumptions
    // ------------------------------------------------------------------------
    const lockedList =
      lockedDecisions.length > 0
        ? lockedDecisions
            .map((d) => `- **[Locked: User]** \`${d.area}\`: ${d.statement} *(Source: Decision ${d.id})*`)
            .join('\n')
        : '- *No decisions explicitly locked by user.*';

    const assumptionsList =
      activeAssumptions.length > 0
        ? activeAssumptions
            .map((a) => `- **[Active Assumption]** ${a.statement} *(Source: Assumption ${a.id}, Reason: ${a.reason})*`)
            .join('\n')
        : '- *No active assumptions recorded.*';

    // ------------------------------------------------------------------------
    // Confirmed Decisions Section (With Overview Section metadata integration)
    // ------------------------------------------------------------------------
    let confirmedSection = '';
    if (snapshot.overview?.sections && snapshot.overview.sections.length > 0) {
      confirmedSection = snapshot.overview.sections
        .map((sec) => {
          const sectionDecisions = confirmedDecisions.filter(
            (d) =>
              d.area.toLowerCase() === sec.id.toLowerCase() ||
              sec.itemRefs?.includes(`decision:${d.id}`)
          );
          if (sectionDecisions.length === 0) return null;

          const items = sectionDecisions
            .map(
              (d) =>
                `- **[${d.status === 'locked' ? 'Locked: User' : 'Confirmed: User'}]** ${d.statement} *(Source: Decision ${d.id})*`
            )
            .join('\n');
          return `### ${sec.title} (${sec.maturity})\n${items}`;
        })
        .filter(Boolean)
        .join('\n\n');
    }

    if (!confirmedSection && confirmedDecisions.length > 0) {
      confirmedSection = confirmedDecisions
        .map(
          (d) =>
            `### ${d.area}\n- **[${d.status === 'locked' ? 'Locked: User' : 'Confirmed: User'}]** ${d.statement} *(Source: Decision ${d.id})*`
        )
        .join('\n\n');
    }

    if (!confirmedSection) {
      confirmedSection = '- *No decisions confirmed yet.*';
    }

    // ------------------------------------------------------------------------
    // Technical Guide Specific Sections
    // ------------------------------------------------------------------------
    const technicalDecisions = getDecisionsForCategory('technical_boundary');
    const confirmedTechnicalDecisions =
      technicalDecisions.length > 0
        ? technicalDecisions
            .map(
              (d) =>
                `- **\`${d.area}\` [${d.status === 'locked' ? 'Locked' : 'Confirmed'}]:** ${d.statement} *(Source: Decision ${d.id})*`
            )
            .join('\n')
        : '- *General standard conventions apply. No bespoke technical constraints confirmed.*';

    const securityDecisions = getDecisionsForCategory('security');
    const technicalSecurityBoundary =
      securityDecisions.length > 0
        ? securityDecisions
            .map((d) => `- **${d.area}:** ${d.statement} *(Source: Decision ${d.id})*`)
            .join('\n')
        : '- Strict data protection and security boundaries apply. Unauthorized external network transmissions and sensitive data leaks are forbidden.';

    // ------------------------------------------------------------------------
    // Adaptive Build & Data Integrity Criteria (Zero-Bias Engine)
    // ------------------------------------------------------------------------
    const tagsAndDecisionsText = [
      ...(snapshot.metadata.projectTags || []),
      ...confirmedDecisions.map((d) => d.statement),
    ]
      .join(' ')
      .toLowerCase();

    let buildCriteria =
      'Target runtime standard compilation, build, and static linting must pass with zero errors.';
    if (tagsAndDecisionsText.includes('typescript') || tagsAndDecisionsText.includes(' ts ')) {
      buildCriteria =
        'TypeScript compilation (`tsc --noEmit`) and project linter pass with zero errors.';
    } else if (tagsAndDecisionsText.includes('python') || tagsAndDecisionsText.includes('pyproject')) {
      buildCriteria =
        'Python code builds cleanly with static type checks (`mypy` or `pyright`) and linter checks passing with zero errors.';
    } else if (tagsAndDecisionsText.includes('rust') || tagsAndDecisionsText.includes('cargo')) {
      buildCriteria =
        'Rust compilation (`cargo check` / `cargo clippy`) passes with zero warnings or errors.';
    } else if (tagsAndDecisionsText.includes('go') || tagsAndDecisionsText.includes('golang')) {
      buildCriteria =
        'Go build and static analysis (`go vet` / `golangci-lint`) pass with zero errors.';
    }

    let dataIntegrityCriteria =
      'Core business state transitions and persistent data changes must be verified against data loss or corruption.';
    if (
      tagsAndDecisionsText.includes('sqlite') ||
      tagsAndDecisionsText.includes('postgres') ||
      tagsAndDecisionsText.includes('database') ||
      tagsAndDecisionsText.includes('db')
    ) {
      dataIntegrityCriteria =
        'Database transactions and relational consistency verified across state mutations and schema migrations.';
    } else if (
      tagsAndDecisionsText.includes('local') ||
      tagsAndDecisionsText.includes('offline') ||
      tagsAndDecisionsText.includes('file')
    ) {
      dataIntegrityCriteria =
        'Local file storage operations must be verified for safe atomic writes across restarts.';
    }

    // ------------------------------------------------------------------------
    // Adaptive Flow Exceptions
    // ------------------------------------------------------------------------
    let flowExceptions =
      '- **Invalid Input / Bad Request**: Validation errors must be caught gracefully and return actionable feedback.\n- **State Boundary Violation**: Attempted actions outside allowed lifecycle stages must be cleanly rejected.';
    if (tagsAndDecisionsText.includes('offline') || tagsAndDecisionsText.includes('local')) {
      flowExceptions +=
        '\n- **Offline / Network Disconnected**: System must continue core local capabilities without throwing uncaught connection errors.';
    }
    if (tagsAndDecisionsText.includes('api') || tagsAndDecisionsText.includes('cloud') || tagsAndDecisionsText.includes('network')) {
      flowExceptions +=
        '\n- **Network Timeout & Upstream Downtime**: Remote network timeouts must be bounded and trigger safe degradation rather than hanging.';
    }

    // ------------------------------------------------------------------------
    // Accepted Risks & Architectural Tensions (From Gaps & Risks SSOT)
    // ------------------------------------------------------------------------
    const riskSections: string[] = [];

    // 1. Open Conflicts (Highest Priority Warning)
    const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');
    if (openConflicts.length > 0) {
      riskSections.push(
        '### 3.1 Unresolved Critical Architectural Conflicts (User Approved Exception)\n' +
          openConflicts
            .map(
              (c) =>
                `- **[CRITICAL CONFLICT ${c.id}]:** Proposition "${c.propositionA}" conflicts with "${c.propositionB}". Reason: ${c.reason}. *(Coding agents must verify trade-offs with user before implementing)*`
            )
            .join('\n')
      );
    }

    // 2. Tensions
    const openTensions = (snapshot.gaps?.tensions || []).filter((t) => t.status === 'open');
    if (openTensions.length > 0) {
      riskSections.push(
        '### 3.2 Confirmed Architectural Tensions & Trade-offs\n' +
          openTensions
            .map(
              (t) =>
                `- **${t.description}**: ${t.reason}`
            )
            .join('\n')
      );
    }

    // 3. Project Risks
    const risks = snapshot.risks?.items || [];
    if (risks.length > 0) {
      riskSections.push(
        '### 3.3 Accepted Risks & Mitigations\n' +
          risks
            .map(
              (r) =>
                `- **[Risk (${r.severity})]:** ${r.description}. Impact: ${r.impact}. Mitigation: ${r.mitigationDirection || 'Monitor and handle in implementation'}`
            )
            .join('\n')
      );
    }

    const acceptedRisksSection =
      riskSections.length > 0
        ? riskSections.join('\n\n')
        : '- *No unresolved critical conflicts or unmitigated high risks recorded.*';

    // ------------------------------------------------------------------------
    // Key Acceptance Tests (Evidence-based DoD derivation)
    // ------------------------------------------------------------------------
    const acceptanceItems: string[] = [];

    // 1. User Journey & Core Capability Verification (from user_flows & mvp_scope)
    const flowDecisions = confirmedDecisions.filter((d) =>
      ['user_flows', 'flow', 'journey', 'mvp_scope'].includes(d.area.toLowerCase())
    );
    if (flowDecisions.length > 0) {
      acceptanceItems.push('#### 核心端到端功能验收 (Core User Journey Verification)');
      flowDecisions.forEach((d, idx) => {
        acceptanceItems.push(
          `${idx + 1}. **流程能力验证**: 满足 "${d.statement}"。*(Source: Decision ${d.id})*`
        );
      });
    }

    // 2. Immutable Architecture Bounds Verification (from locked decisions)
    const lockedTech = snapshot.decisions.items.filter((d) => d.status === 'locked');
    if (lockedTech.length > 0) {
      acceptanceItems.push('\n#### 架构与安全底线验证 (Architecture & Boundary Compliance)');
      lockedTech.forEach((d, idx) => {
        acceptanceItems.push(
          `${idx + 1}. **红线边界遵守**: 严格受限于 "${d.statement}"。*(Source: Decision ${d.id})*`
        );
      });
    }

    // 3. Fallback if no specific flow or locked decisions
    if (acceptanceItems.length === 0) {
      const topDecisions = confirmedDecisions.slice(0, 5);
      if (topDecisions.length > 0) {
        acceptanceItems.push('#### 核心能力验收准则 (Core Capabilities DoD)');
        topDecisions.forEach((d, idx) => {
          acceptanceItems.push(
            `${idx + 1}. **功能验收**: 必须满足 "${d.statement}"。*(Source: Decision ${d.id})*`
          );
        });
      } else {
        acceptanceItems.push('- *No specific acceptance criteria confirmed.*');
      }
    }

    const acceptance = acceptanceItems.join('\n');

    // ------------------------------------------------------------------------
    // Replace all placeholders
    // ------------------------------------------------------------------------
    const replacements: Record<string, string> = {
      '{{PROJECT_NAME}}': snapshot.metadata.name,
      '{{SOURCE_REVISION}}': String(snapshot.metadata.stateRevision),
      '{{GENERATED_AT}}': new Date().toISOString(),
      '{{PROJECT_TAGS}}': snapshot.metadata.projectTags.join(', '),
      '{{PROJECT_VISION}}': vision,
      '{{TARGET_USER}}': targetUser,
      '{{TECHNICAL_BOUNDARY}}': techBoundary,
      '{{CORE_PROBLEM}}': coreProblem,
      '{{LOCKED_DECISIONS_LIST}}': lockedList,
      '{{ACTIVE_ASSUMPTIONS_LIST}}': assumptionsList,
      '{{CONFIRMED_DECISIONS_SECTION}}': confirmedSection,
      '{{CONFIRMED_TECHNICAL_DECISIONS}}': confirmedTechnicalDecisions,
      '{{TECHNICAL_SECURITY_BOUNDARY}}': technicalSecurityBoundary,
      '{{MVP_SCOPE_SECTION}}': mvpScope,
      '{{OUT_OF_SCOPE_SECTION}}': outOfScope,
      '{{USER_FLOWS_SECTION}}': userFlows,
      '{{FLOW_EXCEPTIONS_SECTION}}': flowExceptions,
      '{{UX_UI_SECTION}}': uxUi,
      '{{PROJECT_BUILD_CRITERIA}}': buildCriteria,
      '{{DATA_INTEGRITY_CRITERIA}}': dataIntegrityCriteria,
      '{{ACCEPTANCE_CRITERIA_SECTION}}': acceptance,
      '{{ACCEPTED_RISKS_SECTION}}': acceptedRisksSection,
      '{{AI_SPEC_SECTION}}': aiSpec,
      '{{SECURITY_SPEC_SECTION}}': securitySpec,
    };

    let rendered = templateContent;
    for (const [placeholder, value] of Object.entries(replacements)) {
      rendered = rendered.replaceAll(placeholder, value);
    }

    return rendered;
  }
}
