import { describe, it, expect } from 'vitest';
import { PresetRegistry, CURATED_PRESETS } from '../src/presets/index.js';

describe('PresetRegistry', () => {
  it('loads all 5 official curated presets', () => {
    const presets = PresetRegistry.getAll();
    expect(presets.length).toBe(5);
    expect(CURATED_PRESETS.length).toBe(5);

    const ids = presets.map((p) => p.id);
    expect(ids).toContain('local-first-desktop');
    expect(ids).toContain('cli-developer-tool');
    expect(ids).toContain('edge-microservice');
    expect(ids).toContain('offline-sync-mobile');
    expect(ids).toContain('extensible-plugin-system');
  });

  it('validates each preset successfully without errors', () => {
    for (const preset of PresetRegistry.getAll()) {
      const { valid, errors } = PresetRegistry.validate(preset);
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
      expect(preset.defaultBoundaryRules.length).toBeGreaterThan(0);
      expect(preset.defaultAreas.length).toBeGreaterThan(0);
      expect(preset.initialDecisions.length).toBeGreaterThan(0);
    }
  });

  it('finds preset by id and returns undefined for unknown id', () => {
    const preset = PresetRegistry.getById('local-first-desktop');
    expect(preset).toBeDefined();
    expect(preset?.name).toContain('Local-First');

    const unknown = PresetRegistry.getById('non-existent-preset');
    expect(unknown).toBeUndefined();
  });

  it('instantiates decisions with proper default values and timestamps', () => {
    const preset = PresetRegistry.getById('cli-developer-tool')!;
    const decisions = PresetRegistry.instantiateDecisions(preset, '2026-09-24T12:00:00.000Z');

    expect(decisions.length).toBe(preset.initialDecisions.length);
    for (const dec of decisions) {
      expect(dec.id).toBeDefined();
      expect(dec.area).toBeDefined();
      expect(dec.statement).toBeDefined();
      expect(dec.createdAt).toBe('2026-09-24T12:00:00.000Z');
      expect(dec.updatedAt).toBe('2026-09-24T12:00:00.000Z');
      if (dec.status === 'confirmed') {
        expect(dec.confirmedBy).toBe('user');
      }
    }
  });
});
