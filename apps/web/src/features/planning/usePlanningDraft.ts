import { useCallback, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readPlanningDraft, subscribePlanningDraft, writePlanningDraft } from './planningDraftStore.js';

export function usePlanningDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const subscribe = useCallback((listener: () => void) => subscribePlanningDraft(key, listener), [key]);
  const snapshot = useCallback(() => readPlanningDraft(key, initial), [key, initial]);
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(update => writePlanningDraft(key, initial, update), [key, initial]);
  return [value, setValue];
}
