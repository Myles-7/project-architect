export const PROJECT_AREA_IDS = [
  'project_overview',
  'target_user',
  'mvp_scope',
  'core_features',
  'user_flows',
  'page_structure',
  'ux_ui_direction',
  'technical_boundary',
  'delivery_plan',
] as const;

export type ProjectAreaId = typeof PROJECT_AREA_IDS[number];

export const CORE_DISCOVERY_AREA_IDS = PROJECT_AREA_IDS.filter(
  (id): id is Exclude<ProjectAreaId, 'project_overview'> => id !== 'project_overview',
);

export type CoreDiscoveryAreaId = typeof CORE_DISCOVERY_AREA_IDS[number];

export interface ProjectAreaDefinition {
  id: ProjectAreaId;
  title: string;
  readinessTitle: string;
  aliases: readonly string[];
  documentPaths: readonly string[];
  countsForDiscovery: boolean;
}
