import { join } from 'node:path';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  ChecklistItem,
  MergedChecklistHint,
  DecisionsState,
  OverviewState,
} from '@project-architect/contracts';

const TAG_TO_FILE: Record<string, string> = {
  'Desktop App': 'desktop-app.json',
  '桌面客户端': 'desktop-app.json',
  '桌面应用': 'desktop-app.json',
  'Web App': 'web-app.json',
  'Web 应用': 'web-app.json',
  'AI Product': 'ai-product.json',
  'AI 工作台': 'ai-product.json',
  'AI Agent': 'ai-product.json',
  'Developer Tool': 'developer-tool.json',
  '开发者工具': 'developer-tool.json',
  'Local-First': 'local-first.json',
  '本地优先': 'local-first.json',
  'Utility Tool': 'utility-tool.json',
  '小工具': 'utility-tool.json',
  '效率工具': 'utility-tool.json',
};

const IMPORTANCE_WEIGHT = {
  critical: 3,
  high: 2,
  normal: 1,
};

export class ChecklistSelector {
  private storage: FileStorage;
  private checklistsDir: string;

  constructor(checklistsDir: string, storage: FileStorage = new FileStorage()) {
    this.checklistsDir = checklistsDir;
    this.storage = storage;
  }

  /**
   * Selects and deduplicates top relevant Checklist hints based on project tags and state maturity.
   */
  async selectHints(
    projectTags: string[],
    _decisionsState?: DecisionsState,
    overviewState?: OverviewState,
    maxHints: number = 10
  ): Promise<MergedChecklistHint[]> {
    const candidateItems: ChecklistItem[] = [];

    // 1. Load Universal Checklist
    const universalPath = join(this.checklistsDir, 'universal.json');
    if (await this.storage.exists(universalPath)) {
      const items = await this.storage.readJson<ChecklistItem[]>(universalPath);
      candidateItems.push(...items);
    }

    // 2. Load Matched Type Checklists
    const matchedFiles = new Set<string>();
    for (const tag of projectTags) {
      const fileName = TAG_TO_FILE[tag];
      if (fileName) {
        matchedFiles.add(fileName);
      }
    }

    for (const fileName of matchedFiles) {
      const filePath = join(this.checklistsDir, 'types', fileName);
      if (await this.storage.exists(filePath)) {
        const items = await this.storage.readJson<ChecklistItem[]>(filePath);
        candidateItems.push(...items);
      }
    }

    // 3. Deduplicate by Item ID (retain item with higher importance if duplicate exists)
    const itemMap = new Map<string, ChecklistItem>();
    for (const item of candidateItems) {
      const existing = itemMap.get(item.id);
      if (!existing) {
        itemMap.set(item.id, item);
      } else {
        const existingWeight = IMPORTANCE_WEIGHT[existing.importance] || 1;
        const currentWeight = IMPORTANCE_WEIGHT[item.importance] || 1;
        if (currentWeight > existingWeight) {
          itemMap.set(item.id, item);
        }
      }
    }

    // 4. State Filtering: Filter out items whose corresponding area is already clear/locked in overview
    const clearAreas = new Set<string>();
    if (overviewState) {
      for (const section of overviewState.sections) {
        if (section.maturity === 'clear' || section.maturity === 'locked') {
          clearAreas.add(section.id);
        }
      }
    }

    const filtered: MergedChecklistHint[] = [];
    for (const item of itemMap.values()) {
      if (clearAreas.has(item.area)) {
        // Skip already satisfied product areas to save context tokens
        continue;
      }
      filtered.push({
        id: item.id,
        area: item.area,
        criterion: item.criterion,
        importance: item.importance,
      });
    }

    // 5. Sort by Importance (Critical > High > Normal) and truncate to maxHints
    filtered.sort((a, b) => {
      const weightA = IMPORTANCE_WEIGHT[a.importance] || 1;
      const weightB = IMPORTANCE_WEIGHT[b.importance] || 1;
      return weightB - weightA;
    });

    return filtered.slice(0, maxHints);
  }
}
