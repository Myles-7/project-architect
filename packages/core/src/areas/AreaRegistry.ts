import {
  PROJECT_AREA_IDS,
  CORE_DISCOVERY_AREA_IDS,
  type ProjectAreaId,
  type ProjectAreaDefinition,
} from '@project-architect/contracts';

const DEFINITIONS: Record<ProjectAreaId, ProjectAreaDefinition> = {
  project_overview: {
    id: 'project_overview',
    title: '项目概述与愿景',
    readinessTitle: '项目概述',
    aliases: ['product_identity', 'value_outcome', 'general'],
    documentPaths: ['AGENTS.md', 'docs/PROJECT.md'],
    countsForDiscovery: false,
  },
  target_user: {
    id: 'target_user',
    title: '目标用户与痛点',
    readinessTitle: '目标用户',
    aliases: ['core_problem', 'problem', 'target_audience'],
    documentPaths: ['docs/PRODUCT.md'],
    countsForDiscovery: true,
  },
  mvp_scope: {
    id: 'mvp_scope',
    title: 'MVP 范围与边界',
    readinessTitle: 'MVP 范围',
    aliases: ['scope', 'mvp_boundary'],
    documentPaths: ['docs/PRODUCT.md'],
    countsForDiscovery: true,
  },
  core_features: {
    id: 'core_features',
    title: '核心功能特性',
    readinessTitle: '核心功能',
    aliases: ['features', 'capabilities'],
    documentPaths: ['docs/PRODUCT.md'],
    countsForDiscovery: true,
  },
  user_flows: {
    id: 'user_flows',
    title: '主要用户旅程与流程',
    readinessTitle: '核心流程',
    aliases: ['flows', 'primary_flow'],
    documentPaths: ['docs/USER_FLOWS.md'],
    countsForDiscovery: true,
  },
  page_structure: {
    id: 'page_structure',
    title: '页面结构与信息架构',
    readinessTitle: '页面结构',
    aliases: ['pages', 'navigation'],
    documentPaths: ['docs/UX_UI_SPEC.md'],
    countsForDiscovery: true,
  },
  ux_ui_direction: {
    id: 'ux_ui_direction',
    title: 'UX 体验与 UI 方向',
    readinessTitle: 'UX/UI 方向',
    aliases: ['ux_ui', 'user_interface', 'design_direction'],
    documentPaths: ['docs/UX_UI_SPEC.md'],
    countsForDiscovery: true,
  },
  technical_boundary: {
    id: 'technical_boundary',
    title: '技术底线与运行约束',
    readinessTitle: '技术底线',
    aliases: [
      'trust_safety', 'privacy_policy', 'platform_context',
      'technical_constraints', 'security_boundary',
      'tech_stack', 'architecture', 'database', 'storage',
      'runtime', 'infrastructure', 'backend', 'api_design'
    ],
    documentPaths: ['docs/TECHNICAL_GUIDE.md'],
    countsForDiscovery: true,
  },
  delivery_plan: {
    id: 'delivery_plan',
    title: '交付计划与阶段里程碑',
    readinessTitle: '交付计划',
    aliases: ['acceptance', 'success_signal', 'milestones', 'timeline', 'roadmap', 'phases'],
    documentPaths: ['docs/DEVELOPMENT_PLAN.md', 'docs/ACCEPTANCE.md'],
    countsForDiscovery: true,
  },
};

// Build fast alias lookup map
const ALIAS_MAP = new Map<string, ProjectAreaId>();

for (const def of Object.values(DEFINITIONS)) {
  ALIAS_MAP.set(def.id, def.id);
  for (const alias of def.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), def.id);
  }
}

export class AreaRegistry {
  static getAllAreaIds(): readonly ProjectAreaId[] {
    return PROJECT_AREA_IDS;
  }

  static getDiscoveryAreaIds(): readonly ProjectAreaId[] {
    return CORE_DISCOVERY_AREA_IDS;
  }

  static getDefinition(id: ProjectAreaId): ProjectAreaDefinition {
    return DEFINITIONS[id];
  }

  static getAllDefinitions(): readonly ProjectAreaDefinition[] {
    return PROJECT_AREA_IDS.map((id) => DEFINITIONS[id]);
  }

  static getDiscoveryDefinitions(): readonly ProjectAreaDefinition[] {
    return CORE_DISCOVERY_AREA_IDS.map((id) => DEFINITIONS[id]);
  }

  static getOverviewDefinitions(): readonly ProjectAreaDefinition[] {
    return PROJECT_AREA_IDS.map((id) => DEFINITIONS[id]);
  }

  static isValidArea(area: string): area is ProjectAreaId {
    return PROJECT_AREA_IDS.includes(area as ProjectAreaId);
  }

  static isDiscoveryArea(area: string): boolean {
    return CORE_DISCOVERY_AREA_IDS.includes(area as any);
  }

  static normalize(rawArea?: string): ProjectAreaId {
    return AreaRegistry.resolve(rawArea).area;
  }

  static resolve(rawArea?: string): { area: ProjectAreaId; sourceArea?: string; isUnknown: boolean } {
    if (!rawArea || typeof rawArea !== 'string') {
      return { area: 'project_overview', isUnknown: true };
    }

    const trimmed = rawArea.trim();
    const lower = trimmed.toLowerCase();

    const mapped = ALIAS_MAP.get(lower);
    if (mapped) {
      if (mapped === trimmed) {
        return { area: mapped, isUnknown: false };
      }
      return { area: mapped, sourceArea: trimmed, isUnknown: false };
    }

    // Unknown area: safely fallback to project_overview and record diagnostic sourceArea
    return {
      area: 'project_overview',
      sourceArea: trimmed,
      isUnknown: true,
    };
  }

  static getTitle(area: string): string {
    const canonical = AreaRegistry.normalize(area);
    return DEFINITIONS[canonical]?.title || canonical;
  }

  static getReadinessTitle(area: string): string {
    const canonical = AreaRegistry.normalize(area);
    return DEFINITIONS[canonical]?.readinessTitle || canonical;
  }
}
