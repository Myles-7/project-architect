import { createHash } from 'node:crypto';
import type { ProjectSnapshot, PlanningState, PlanningBasis } from '@project-architect/contracts';

export const emptyPlanningState = (): PlanningState => ({
  schemaVersion: 1, blueprint: { schemaVersion: 1, blocks: [], stages: { product: 'not-designed', technical: 'not-designed', delivery: 'not-designed' } },
  changeSets: [], evidence: [], topics: [], inputs: [], operations: [], diagnostics: [],
});
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function hashValue(value: unknown): string { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
export function effectiveDecisionHash(snapshot: Pick<ProjectSnapshot,'decisions'>): string {
  return hashValue(snapshot.decisions.items.filter(d=>['confirmed','locked'].includes(d.status)).map(d=>({key:d.decisionKey??d.id,statement:d.statement})).sort((a,b)=>a.key.localeCompare(b.key)));
}
export function planningInputHash(snapshot:ProjectSnapshot):string {
  return hashValue({constraints:snapshot.metadata.constraints,materials:snapshot.metadata.inputRefs.map(i=>({id:i.id,kind:i.kind,status:i.status,hash:i.contentHash,storageRef:i.storageRef})),inputs:snapshot.planning?.inputs??[]});
}
export function planningBasis(snapshot: ProjectSnapshot): PlanningBasis {
  return { revision: snapshot.metadata.stateRevision, hash: hashValue({
    name: snapshot.metadata.name, constraints: snapshot.metadata.constraints,
    materials: snapshot.metadata.inputRefs.map(i => ({ ...i, summary: i.summary, hash: (i as any).contentHash })),
    decisions: snapshot.decisions.items.filter(d => d.status === 'confirmed' || d.status === 'locked'),
    blueprint: snapshot.planning?.blueprint, inputs: snapshot.planning?.inputs ?? [],
  }) };
}
export function classifyInput(raw: string): 'statement' | 'question' | 'modification' | 'delegation' | 'uncertainty' | 'feedback' {
  if (/你帮我定|交给\s*AI|你决定|you decide/i.test(raw)) return 'delegation';
  if (/待定|不懂|不确定|不知道|not sure/i.test(raw)) return 'uncertainty';
  if (/开发反馈|实现失败|报错|测试失败|implementation feedback/i.test(raw)) return 'feedback';
  if (/改成|修改|不再|instead|change to/i.test(raw)) return 'modification';
  if (/有没有|能否|是否|[？?]|how |can |is there/i.test(raw)) return 'question';
  return 'statement';
}
