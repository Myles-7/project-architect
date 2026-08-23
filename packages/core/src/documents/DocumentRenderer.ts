import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  ProjectSnapshot,
  DocumentPlanItem,
} from '@project-architect/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    const resolveArea = (
      area: string,
      fallbackWarning: string
    ): string => {
      const dec = confirmedDecisions.find((d) => d.area === area);
      if (dec) {
        return `${dec.statement}\n*(Source: Decision ${dec.id})*`;
      }
      const asm = activeAssumptions.find(
        (a) =>
          a.statement && a.statement.toLowerCase().includes(area.toLowerCase())
      );
      if (asm) {
        return `${asm.statement}\n*(Source: Assumption ${asm.id}, Reason: ${asm.reason})*`;
      }
      return `*(Warning: No explicit decision or assumption confirmed for "${area}". ${fallbackWarning})*`;
    };

    const visionDec = confirmedDecisions.find(
      (d) => d.area === 'project_overview' || d.area === 'general'
    );
    const vision = visionDec
      ? `${visionDec.statement}\n*(Source: Decision ${visionDec.id})*`
      : snapshot.metadata.name;

    const targetUser = resolveArea(
      'target_user',
      'Target user profile is pending definition.'
    );

    const techBoundary = resolveArea(
      'technical_boundary',
      snapshot.metadata.projectTags.length > 0
        ? `Project tags: ${snapshot.metadata.projectTags.join(', ')}`
        : 'Technical boundaries and platform constraints pending definition.'
    );

    const coreProblem = resolveArea(
      'core_problem',
      'Core problem statement is pending definition.'
    );

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

    const confirmedSection =
      confirmedDecisions.length > 0
        ? confirmedDecisions
            .map(
              (d) =>
                `### ${d.area}\n- **[${d.status === 'locked' ? 'Locked: User' : 'Confirmed: User'}]** ${d.statement} *(Source: Decision ${d.id})*`
            )
            .join('\n\n')
        : '- *No decisions confirmed yet.*';

    const mvpScope = resolveArea(
      'mvp_scope',
      'MVP scope boundaries are pending definition.'
    );

    const userFlows = resolveArea(
      'user_flows',
      'Core user flows and journeys are pending definition.'
    );

    const uxUi = resolveArea(
      'ux_ui',
      'UX/UI design direction and principles are pending definition.'
    );

    const acceptance =
      confirmedDecisions.length > 0
        ? confirmedDecisions
            .map(
              (d, idx) =>
                `${idx + 1}. **${d.area} 验证**: 必须满足 "${d.statement}"。*(Source: Decision ${d.id})*`
            )
            .join('\n')
        : '- *No acceptance criteria confirmed.*';

    const aiSpec = resolveArea(
      'ai_model',
      'AI model configuration and token budgets are pending definition.'
    );

    const securitySpec = resolveArea(
      'security',
      'Security and data privacy boundaries are pending definition.'
    );

    const outOfScope = resolveArea(
      'out_of_scope',
      'Explicit out-of-scope exclusions are pending definition.'
    );

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
      '{{MVP_SCOPE_SECTION}}': mvpScope,
      '{{OUT_OF_SCOPE_SECTION}}': outOfScope,
      '{{USER_FLOWS_SECTION}}': userFlows,
      '{{UX_UI_SECTION}}': uxUi,
      '{{ACCEPTANCE_CRITERIA_SECTION}}': acceptance,
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
