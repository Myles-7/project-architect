import { PlanningService, planningBasis, type ProjectStateEngine } from '@project-architect/core';
import { group } from './planning.mjs';

/** Seed an explicitly approved local fixture without legacy readiness publication or a Provider. */
export async function approvedPlanningFixture(engine: ProjectStateEngine, path: string) {
  const service = new PlanningService(engine);
  for (const stage of ['product', 'technical', 'delivery'] as const) {
    let snapshot = await service.get(path);
    snapshot = await service.propose(path, { id: `fixture-${stage}`, runId: 'run-fixture', stage, basis: planningBasis(snapshot), summary: 'Approved package fixture', groups: [group(stage)], evidence: [], status: 'pending', createdAt: new Date().toISOString(), approvals: [] });
    await service.approve(path, `fixture-${stage}`, { operationId: `fixture-approve-${stage}`, expectedRevision: snapshot.metadata.stateRevision, groupIds: [`${stage}-group`] });
  }
  return service.get(path);
}
