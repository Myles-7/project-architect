import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanningView, ProjectSnapshot } from '@project-architect/contracts';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { ApiClientError } from '../../api/client.js';

export function usePlanning(projectId: string) {
  const { apiClient, dispatch } = useProjectSession();
  const [view, setView] = useState<PlanningView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(projectId);
  const revision = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const readSequence = useRef(0);
  const mutationInProgress = useRef(false);
  const operationIds = useRef(new Map<string, { expectedRevision: number; operationId: string }>());
  active.current = projectId;

  const applySnapshot = useCallback((snapshot: ProjectSnapshot) => {
    if (active.current === projectId) dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot } });
  }, [dispatch, projectId]);

  const refresh = useCallback(async (silent = false) => {
    const controller = new AbortController();
    requests.current.add(controller);
    const sequence = ++readSequence.current;
    try {
      let [next, snapshot] = await Promise.all([apiClient.getPlanning(projectId, controller.signal), apiClient.getProjectSnapshot(projectId, controller.signal)]);
      if (next.sourceStateRevision !== snapshot.metadata.stateRevision) [next, snapshot] = await Promise.all([apiClient.getPlanning(projectId, controller.signal), apiClient.getProjectSnapshot(projectId, controller.signal)]);
      if (controller.signal.aborted || active.current !== projectId || sequence !== readSequence.current) return;
      if (next.sourceStateRevision !== snapshot.metadata.stateRevision || next.sourceStateRevision < revision.current) return;
      revision.current = next.sourceStateRevision;
      setView(next);
      applySnapshot(snapshot);
      if (!silent) setError(null);
    } catch (failure) {
      if (!controller.signal.aborted && active.current === projectId && !silent) setError(failure instanceof Error ? failure.message : '载入规划状态失败');
    } finally { requests.current.delete(controller); }
  }, [apiClient, applySnapshot, projectId]);

  useEffect(() => {
    setView(null); setError(null); setBusy(false); revision.current = 0; mutationInProgress.current = false;
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 2000);
    return () => {
      window.clearInterval(timer);
      for (const controller of requests.current) controller.abort();
      requests.current.clear();
      ++readSequence.current;
    };
  }, [projectId, refresh]);

  const mutate = useCallback(async (key: string, action: (request: { expectedRevision: number; operationId: string }, signal: AbortSignal) => Promise<unknown>, independent = false): Promise<boolean> => {
    if (!revision.current || (!independent && mutationInProgress.current)) return false;
    if (!independent) mutationInProgress.current = true;
    const fingerprint = `${projectId}:${key}`;
    const request = operationIds.current.get(fingerprint) || { expectedRevision: revision.current, operationId: crypto.randomUUID() };
    operationIds.current.set(fingerprint, request);
    const controller = new AbortController();
    requests.current.add(controller);
    if (!independent) setBusy(true);
    setError(null);
    try {
      await action(request, controller.signal);
      if (controller.signal.aborted || active.current !== projectId) return false;
      operationIds.current.delete(fingerprint);
      await refresh();
      return true;
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.statusCode >= 400 && failure.statusCode < 500) operationIds.current.delete(fingerprint);
      if (!controller.signal.aborted && active.current === projectId) {
        setError(failure instanceof Error ? failure.message : '操作失败，请重试');
        await refresh(true);
      }
      return false;
    } finally {
      requests.current.delete(controller);
      if (active.current === projectId && !independent) mutationInProgress.current = false;
      if (active.current === projectId && !independent) setBusy(false);
    }
  }, [projectId, refresh]);
  return { view, error, busy, refresh, mutate, apiClient };
}
