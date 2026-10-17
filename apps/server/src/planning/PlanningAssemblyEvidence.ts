import type { AgentTaskResult, EvidenceRecord } from '@project-architect/contracts';
import { hashValue, PlanningError } from '@project-architect/core';

/** Preserve separate worker observations. This changes identities and references,
 * never reconciles their claims or mutates canonical source receipts. */
export function scopeAssemblyEvidence(sources: AgentTaskResult[], base?: AgentTaskResult, canonicalEvidence: EvidenceRecord[] = []): AgentTaskResult[] {
  const candidates = new Map<string, Map<string, EvidenceRecord>>();
  const reserved = new Set<string>();
  const canonicalHashes = new Map<string, string>();
  for (const record of canonicalEvidence) {
    const hash = hashValue(record);
    if (canonicalHashes.has(record.id) && canonicalHashes.get(record.id) !== hash) throw new PlanningError('INVALID_STRUCTURED_RESULT', `正式证据 ID 已有冲突：${record.id}`);
    canonicalHashes.set(record.id, hash); reserved.add(record.id);
    const versions = candidates.get(record.id) ?? new Map<string, EvidenceRecord>();
    versions.set(hash, record); candidates.set(record.id, versions);
  }
  for (const source of [...(base ? [base] : []), ...sources]) {
    for (const group of source.groups) {
      for (const block of group.blocks) block.evidenceIds.forEach(id => reserved.add(id));
      for (const decision of group.decisions) decision.evidenceIds.forEach(id => reserved.add(id));
    }
    const own = new Map<string, string>();
    for (const record of source.evidence) {
      const hash = hashValue(record);
      if (own.has(record.id) && own.get(record.id) !== hash) throw new PlanningError('INVALID_STRUCTURED_RESULT', `同一工作者的证据 ID 含多个不同记录：${record.id}`);
      own.set(record.id, hash); reserved.add(record.id);
      const versions = candidates.get(record.id) ?? new Map<string, EvidenceRecord>();
      versions.set(hash, record); candidates.set(record.id, versions);
    }
  }
  const baseHashes = new Map((base?.evidence ?? []).map(record => [record.id, hashValue(record)]));
  const identities = new Map<string, Map<string, string>>();
  // Stable ordering keeps derived identities independent of worker completion.
  for (const [id, versions] of [...candidates].sort(([a], [b]) => a.localeCompare(b))) {
    if (versions.size < 2) continue;
    const mappings = new Map<string, string>();
    for (const hash of [...versions.keys()].sort()) {
      if ((canonicalHashes.get(id) ?? baseHashes.get(id)) === hash) { mappings.set(hash, id); continue; }
      let derived = `assembly-evidence:${hash}`;
      while (reserved.has(derived)) derived += ':scoped';
      reserved.add(derived); mappings.set(hash, derived);
    }
    identities.set(id, mappings);
  }
  return sources.map(source => {
    const own = new Map(source.evidence.map(record => [record.id, hashValue(record)]));
    const remap = (id: string) => {
      const mappings = identities.get(id);
      if (!mappings) return id;
      const hash = own.get(id) ?? baseHashes.get(id);
      if (!hash || !mappings.has(hash)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `证据引用有歧义，请工作者提供完整来源：${id}`);
      return mappings.get(hash)!;
    };
    const output = structuredClone(source);
    output.evidence = output.evidence.map(record => ({ ...record, id: remap(record.id) }));
    for (const group of output.groups) {
      for (const block of group.blocks) block.evidenceIds = block.evidenceIds.map(remap);
      for (const decision of group.decisions) decision.evidenceIds = decision.evidenceIds.map(remap);
    }
    return output;
  });
}
