import { describe, expect, it } from 'vitest';
import type { AgentTaskResult, EvidenceRecord } from '@project-architect/contracts';
import { hashValue } from '@project-architect/core';
import { scopeAssemblyEvidence } from '../src/planning/PlanningAssemblyEvidence.js';

const evidence = (content: string, id = 'shared'): EvidenceRecord => ({ id, kind: 'user', content, source: 'input:idea', obtainedAt: '2026-10-04T00:00:00Z', applicability: content });
const output = (proof: EvidenceRecord[], references = proof.map(record => record.id)): AgentTaskResult => ({ summary: '片段', evidence: proof, groups: [{ id: 'group', title: '产品', impact: '确认范围', status: 'pending', dependsOn: [], removeBlockIds: [], blocks: [{ id: 'block', kind: 'scope', stage: 'product', title: '范围', content: '明确第一版的完整行为范围', requirementIds: [], dependsOn: [], evidenceIds: references }], decisions: [{ decisionKey: 'scope', area: 'scope', statement: '第一版范围', rationale: '用户定位', evidenceIds: references }] }], questions: [], blockers: [], followUp: [], clarification: null });

describe('worker evidence identity isolation', () => {
  it('preserves canonical base evidence and isolates different worker claims with all local references', () => {
    const original = evidence('原记录'), base = output([original]);
    const first = output([evidence('分工甲说明')]), second = output([evidence('分工乙说明')]);
    const before = hashValue([base, first, second]);
    const scoped = scopeAssemblyEvidence([first, second], base);
    expect(hashValue([base, first, second])).toBe(before);
    expect(base.evidence).toEqual([original]);
    expect(scoped[0]!.evidence[0]!.id).not.toBe('shared');
    expect(scoped[1]!.evidence[0]!.id).not.toBe(scoped[0]!.evidence[0]!.id);
    for (const [index, source] of [first, second].entries()) {
      const next = scoped[index]!, id = next.evidence[0]!.id;
      expect({ ...next.evidence[0], id: 'shared' }).toEqual(source.evidence[0]);
      expect(next.groups[0]!.blocks[0]!.evidenceIds).toEqual([id]);
      expect(next.groups[0]!.decisions[0]!.evidenceIds).toEqual([id]);
    }
    expect(scopeAssemblyEvidence([second, first], base)).toEqual([...scoped].reverse());
  });
  it('retains exact base copies and nonconflicting identities', () => {
    const record = evidence('用户原文'), base = output([record]);
    expect(scopeAssemblyEvidence([output([record]), output([evidence('独立来源', 'other')])], base)).toEqual([output([record]), output([evidence('独立来源', 'other')])]);
  });
  it('rejects ambiguous references without local evidence instead of picking another worker claim', () => {
    expect(() => scopeAssemblyEvidence([output([evidence('甲')]), output([evidence('乙')]), output([], ['shared'])])).toThrow('引用有歧义');
    const base = output([evidence('原记录')]);
    expect(scopeAssemblyEvidence([output([evidence('甲')]), output([], ['shared'])], base)[1]!.groups[0]!.blocks[0]!.evidenceIds).toEqual(['shared']);
  });
  it('rejects multiple conflicting versions within one worker', () => {
    expect(() => scopeAssemblyEvidence([output([evidence('甲'), evidence('乙')])])).toThrow('同一工作者');
  });
  it('avoids colliding with an explicitly named existing evidence record', () => {
    const first = evidence('甲'), reserved = evidence('其他来源', `assembly-evidence:${hashValue(first)}`);
    const scoped = scopeAssemblyEvidence([output([first, reserved]), output([evidence('乙')])]);
    expect(scoped[0]!.evidence[0]!.id).not.toBe(reserved.id);
    expect(scoped[0]!.evidence[1]).toEqual(reserved);
  });
  it('does not give an unproven reference a new meaning by occupying its ID', () => {
    const first = evidence('甲'), unresolved = `assembly-evidence:${hashValue(first)}`;
    const scoped = scopeAssemblyEvidence([output([first]), output([evidence('乙')]), output([], [unresolved])]);
    expect(scoped[0]!.evidence[0]!.id).not.toBe(unresolved);
    expect(scoped[2]!.groups[0]!.blocks[0]!.evidenceIds).toEqual([unresolved]);
    expect(scoped.flatMap(part => part.evidence).some(record => record.id === unresolved)).toBe(false);
  });
  it('isolates a conflicting candidate base from immutable Core evidence and preserves its inherited reference meaning', () => {
    const canonical = evidence('用户正式原记录'), conflicting = evidence('候选的不同解释');
    const base = output([conflicting]), child = output([], ['shared']), original = hashValue([base, child]);
    const [nextBase, nextChild] = scopeAssemblyEvidence([base, child], base, [canonical]);
    const id = nextBase!.evidence[0]!.id;
    expect(id).not.toBe(canonical.id); expect({ ...nextBase!.evidence[0], id: canonical.id }).toEqual(conflicting);
    expect(nextBase!.groups[0]!.blocks[0]!.evidenceIds).toEqual([id]);
    expect(nextChild!.groups[0]!.blocks[0]!.evidenceIds).toEqual([id]);
    expect(hashValue([base, child])).toBe(original); expect(canonical.id).toBe('shared');
    const correct = scopeAssemblyEvidence([output([canonical])], base, [canonical]);
    expect(correct[0]!.evidence[0]).toEqual(canonical);
    expect(() => scopeAssemblyEvidence([child], base, [canonical, conflicting])).toThrow('正式证据 ID 已有冲突');
  });
});
