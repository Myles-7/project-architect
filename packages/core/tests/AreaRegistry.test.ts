import { describe, it, expect } from 'vitest';
import { PROJECT_AREA_IDS, CORE_DISCOVERY_AREA_IDS } from '@project-architect/contracts';
import { AreaRegistry } from '../src/areas/AreaRegistry.js';

describe('AreaRegistry (Unified Area Architecture)', () => {
  it('Task 1.1: Exactly 9 unique projection areas and 8 unique Discovery core areas', () => {
    const allAreas = AreaRegistry.getAllAreaIds();
    expect(allAreas).toEqual(PROJECT_AREA_IDS);
    expect(new Set(allAreas).size).toBe(9);

    const discoveryAreas = AreaRegistry.getDiscoveryAreaIds();
    expect(discoveryAreas).toEqual(CORE_DISCOVERY_AREA_IDS);
    expect(new Set(discoveryAreas).size).toBe(8);
    expect(discoveryAreas).not.toContain('project_overview');
  });

  it('Task 1.1: Correctly maps all specified aliases to canonical areas', () => {
    // target_user aliases
    expect(AreaRegistry.normalize('core_problem')).toBe('target_user');
    expect(AreaRegistry.normalize('problem')).toBe('target_user');
    expect(AreaRegistry.normalize('target_audience')).toBe('target_user');

    // ux_ui_direction aliases
    expect(AreaRegistry.normalize('ux_ui')).toBe('ux_ui_direction');
    expect(AreaRegistry.normalize('user_interface')).toBe('ux_ui_direction');

    // technical_boundary aliases
    expect(AreaRegistry.normalize('trust_safety')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('privacy_policy')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('platform_context')).toBe('technical_boundary');

    // delivery_plan aliases
    expect(AreaRegistry.normalize('acceptance')).toBe('delivery_plan');
    expect(AreaRegistry.normalize('success_signal')).toBe('delivery_plan');

    // project_overview aliases
    expect(AreaRegistry.normalize('product_identity')).toBe('project_overview');
    expect(AreaRegistry.normalize('value_outcome')).toBe('project_overview');
    expect(AreaRegistry.normalize('general')).toBe('project_overview');
  });

  it('Task 1.1: Resolves unknown areas to project_overview while preserving sourceArea and diagnostics', () => {
    const result = AreaRegistry.resolve('some_custom_billing_engine');
    expect(result.area).toBe('project_overview');
    expect(result.sourceArea).toBe('some_custom_billing_engine');
    expect(result.isUnknown).toBe(true);
  });

  it('Task 1.1: Retrieves titles, readiness titles, and discovery flags from centralized registry', () => {
    const techDef = AreaRegistry.getDefinition('technical_boundary');
    expect(techDef.id).toBe('technical_boundary');
    expect(techDef.title).toContain('技术');
    expect(techDef.countsForDiscovery).toBe(true);

    const overviewDef = AreaRegistry.getDefinition('project_overview');
    expect(overviewDef.countsForDiscovery).toBe(false);
  });
});
