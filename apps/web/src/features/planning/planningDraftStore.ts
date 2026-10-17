// UI drafts belong to the open page session. Keeping data here preserves it
// across navigation without keeping mounted components or polling alive.
const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

export function readPlanningDraft<T>(key: string, initial: T): T {
  if (!values.has(key)) values.set(key, initial);
  return values.get(key) as T;
}

export function writePlanningDraft<T>(key: string, initial: T, update: T | ((previous: T) => T)): void {
  const previous = readPlanningDraft(key, initial);
  const next = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update;
  if (Object.is(previous, next)) return;
  values.set(key, next);
  listeners.get(key)?.forEach(listener => listener());
}

export function subscribePlanningDraft(key: string, listener: () => void): () => void {
  let subscribers = listeners.get(key);
  if (!subscribers) listeners.set(key, subscribers = new Set());
  subscribers.add(listener);
  return () => { subscribers!.delete(listener); if (!subscribers!.size) listeners.delete(key); };
}

export function planningDraftKey(projectId: string, kind: string, identity = ''): string {
  return JSON.stringify([projectId, kind, identity]);
}
