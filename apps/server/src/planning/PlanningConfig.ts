import { DEFAULT_PLANNING_CONFIG, type PlanningRuntimeConfig } from '@project-architect/contracts';
import { PlanningError } from '@project-architect/core';

/** Validate preferences without changing the effective runtime configuration. */
export function normalizePlanningConfig(config: PlanningRuntimeConfig): PlanningRuntimeConfig {
  if (!config || !Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 16
    || typeof config.designModel !== 'string' || !config.designModel.trim()
    || typeof config.reviewModel !== 'string' || !config.reviewModel.trim()
    || (config.officialHosts !== undefined && (!Array.isArray(config.officialHosts)
      || !config.officialHosts.every(host => typeof host === 'string' && /^[a-z0-9.-]+$/.test(host) && host.includes('.'))))) {
    throw new PlanningError('INVALID_INTENT', '并发为 1–16，模型不能为空，官方域名不能包含协议或路径');
  }
  return {
    concurrency: config.concurrency,
    designModel: config.designModel.trim(),
    reviewModel: config.reviewModel.trim(),
    officialHosts: [...(config.officialHosts ?? DEFAULT_PLANNING_CONFIG.officialHosts ?? [])],
  };
}

const writes = new Map<string, Promise<void>>();

/** Persist and apply a workspace preference as one ordered operation. */
export async function serializePlanningConfigWrite(path: string, action: () => Promise<void>): Promise<void> {
  const key = path.toLowerCase();
  const previous = writes.get(key) ?? Promise.resolve();
  const result = previous.then(action);
  const settled = result.catch(() => {});
  writes.set(key, settled);
  try { await result; }
  finally { if (writes.get(key) === settled) writes.delete(key); }
}
