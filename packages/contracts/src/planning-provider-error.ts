export interface PlanningProviderFailure {
  kind: 'quota' | 'transient' | 'other';
  resetAfterMs?: number;
}

/** Classifies observed service errors; a model listing or balance is not availability evidence. */
export function planningProviderFailure(error: string): PlanningProviderFailure {
  if (/individual quota reached/i.test(error)) {
    const duration = /\bresets?\s+in\s+((?:\d+\s*[hms]\s*)+)(?=\s*[.\r\n]|$)/i.exec(error)?.[1];
    const units: Record<string, number> = { h: 3600000, m: 60000, s: 1000 };
    const resetAfterMs = duration ? [...duration.matchAll(/(\d+)\s*([hms])/gi)].reduce((sum, item) => sum + Number(item[1]) * units[item[2]!.toLowerCase()]!, 0) : undefined;
    return { kind: 'quota', ...(resetAfterMs !== undefined && Number.isFinite(resetAfterMs) && resetAfterMs >= 0 ? { resetAfterMs } : {}) };
  }
  return { kind: /429|503|502|temporar|rate.?limit|ECONNRESET|unavailable|unexpected EOF|connection.*(closed|reset)/i.test(error) ? 'transient' : 'other' };
}
