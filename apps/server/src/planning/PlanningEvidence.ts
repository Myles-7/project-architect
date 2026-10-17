import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { AgentTaskResult, ProjectSnapshot } from '@project-architect/contracts';
import type { PlanningToolsConfig, ExperimentResult } from '@project-architect/agent';
import { hashValue } from '@project-architect/core';

/** Only service-owned research/experiment actions prove external capability claims. */
export async function verifyTaskEvidence(result: AgentTaskResult, snapshot: ProjectSnapshot, tools: PlanningToolsConfig): Promise<void> {
  let journal = '';
  try { journal = await readFile(join(tools.evidenceRoot,'tool-events.ndjson'),'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const actions = journal.split('\n').filter(Boolean).flatMap(line => {try{return [JSON.parse(line) as {action:string;details:any}];}catch{return [];}});
  for (const e of result.evidence) {
    const approved = snapshot.planning?.evidence.find(old => old.id === e.id && hashValue(old) === hashValue(e));
    if (approved) continue;
    if (e.kind === 'experiment' && e.outcome !== 'not-applicable') {
      const record = actions.filter(a => a.action === 'experiment_result').map(a => a.details as ExperimentResult)
        .find(r => e.source === `experiment:${r.id}` || e.source === r.id || e.source === join(r.directory,'result.json'));
      if (!record) {
        if(e.outcome!=='unexecuted')result.blockers.push(`证据 ${e.id} 缺少真实试验结果，禁止宣称通过；使用 experiment:<工具返回的 id> 作为 source。`);
        e.outcome = 'unexecuted'; continue;
      }
      const actual = record.status === 'pass' ? 'passed' : record.status === 'fail' ? 'failed' : 'unexecuted';
      if (e.outcome !== actual) result.blockers.push(`证据 ${e.id} 与真实试验状态 ${record.status} 冲突，需修订结论及依赖验证任务。`);
      e.outcome = actual; e.environment = JSON.stringify(record.environment); e.obtainedAt = record.completedAt;
      e.hash = hashValue(record); e.source = `experiment:${record.id}`;
    } else if (e.kind === 'official-source') {
      const record = actions.filter(a => a.action === 'research_read').map(a => a.details)
        .find(r => r.source === e.source && (!e.hash || r.sha256 === e.hash));
      if (!record) result.blockers.push(`官方证据 ${e.id} 缺少 research_read 获取记录；请真实查证或转为未验证任务。`);
      else {
        const bytes = await readFile(record.evidencePath);
        if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error('研究原文已被修改');
        e.hash = record.sha256; e.obtainedAt = record.fetchedAt;
      }
    } else if (e.kind === 'material') {
      const material = snapshot.metadata.inputRefs.find(i => e.source === i.id || e.source === `material:${i.id}` || e.source === i.storageRef);
      if (!material || ['excluded','failed'].includes(material.status)) result.blockers.push(`材料证据 ${e.id} 没有有效注册来源。`);
      else { e.source = `material:${material.id}`; e.hash = material.contentHash; }
    } else if (e.kind === 'user') {
      const ids = [...(snapshot.planning?.inputs.map(i=>i.id)??[]),...snapshot.questions.items.map(q=>q.id)];
      if (e.source !== 'project:idea' && e.source !== 'project:constraints' && !ids.some(id => e.source === id || e.source === `input:${id}` || e.source === `question:${id}`)) result.blockers.push(`用户证据 ${e.id} 必须指向实际原文 input:<id>、question:<id> 或 project:idea/constraints。`);
    }
  }
  result.blockers = [...new Set(result.blockers)];
}
