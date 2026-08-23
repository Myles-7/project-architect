import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { ChecklistSelector } from '../src/checklists/ChecklistSelector.js';
import type { OverviewState } from '@project-architect/contracts';

describe('ChecklistSelector Unit Tests', () => {
  const checklistsDir = resolve(process.cwd(), 'checklists');
  const selector = new ChecklistSelector(checklistsDir);

  it('selects universal checklist hints for any project', async () => {
    const hints = await selector.selectHints([]);
    expect(hints.length).toBeGreaterThan(0);
    const hasTargetUser = hints.some((h) => h.area === 'target_user' || h.id === 'chk-univ-target-user');
    expect(hasTargetUser).toBe(true);
  });

  it('merges domain checklist hints when matching tags are provided', async () => {
    const hints = await selector.selectHints(['Desktop App', 'AI Product']);
    const hasAiOrDesktop = hints.some((h) => h.id.startsWith('chk-ai-') || h.id.startsWith('chk-desktop-'));
    expect(hasAiOrDesktop).toBe(true);
  });

  it('filters out areas whose maturity is clear or locked', async () => {
    const mockOverview: OverviewState = {
      schemaVersion: 1,
      projectId: 'proj-1',
      sections: [
        {
          id: 'target_user',
          title: 'Target User',
          kind: 'fixed',
          maturity: 'clear',
          itemRefs: [],
        },
      ],
      updatedAt: '',
    };

    const hints = await selector.selectHints([], undefined, mockOverview);
    const hasTargetUser = hints.some((h) => h.area === 'target_user');
    expect(hasTargetUser).toBe(false);
  });
});
