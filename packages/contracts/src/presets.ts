export type PresetCategory = 'desktop' | 'cli' | 'cloud' | 'mobile' | 'system';

export interface PresetBoundaryRule {
  ruleId: string;
  title: string;
  enforcement: 'hard' | 'soft';
  description: string;
}

export interface PresetAreaDefinition {
  id: string;
  name: string;
  description: string;
  coreQuestions?: string[];
}

export interface PresetInitialDecision {
  id: string;
  statement: string;
  area: string;
  status: 'confirmed' | 'candidate';
  origin: 'user';
  rationale: string;
  decisionKey?: string;
  dependsOn?: string[];
  affectedAreas?: string[];
}

export interface ProjectPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  recommendedStack: string[];
  defaultBoundaryRules: PresetBoundaryRule[];
  defaultAreas: PresetAreaDefinition[];
  initialDecisions: PresetInitialDecision[];
  suggestedChecklists: string[];
  tags: string[];
}

export interface ListPresetsResponse {
  presets: ProjectPreset[];
}

export interface GetPresetResponse {
  preset: ProjectPreset;
}
