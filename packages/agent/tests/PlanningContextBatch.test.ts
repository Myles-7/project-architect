import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePlanningContextAccess, readPlanningContext, planningContextReadIssues, commitPlanningContextReads } from '../src/tools/PlanningContextAccess.js';
import { PlanningToolsService } from '../src/tools/PlanningToolsService.js';
let root: string;
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'pa-context-batch-'));});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
const wireBytes=(value:unknown)=>Buffer.byteLength(JSON.stringify({content:[{type:'text',text:JSON.stringify(value)}]}));
function scanAll(access: ReturnType<typeof preparePlanningContextAccess>['access'], requiredOnly=false){
  const reconstructed=new Map<string,string>();let offset:number|null=0, characterOffset=0, calls=0;
  do{
    const result=readPlanningContext(access,{action:'scan',offset:offset!,characterOffset,requiredOnly} as any) as any;
    expect(wireBytes(result)).toBeLessThanOrEqual(6000);expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(3900);expect(result.parts.length).toBeGreaterThan(0);
    for(const part of result.parts){expect(part.offset).toBe((reconstructed.get(part.key)??'').length);reconstructed.set(part.key,(reconstructed.get(part.key)??'')+part.content);}
    offset=result.nextOffset;characterOffset=result.nextCharacterOffset;calls++;
    expect(calls).toBeLessThan(3000);
  }while(offset!==null);
  return {reconstructed,calls};
}
describe('bounded batch context transport',()=>{
  it('reads hundreds of small required records in fewer calls with exact hashes and full coverage',async()=>{
    const source={workerResults:{draft:{groups:[]}},items:Array.from({length:300},(_,id)=>({id:`item-${id}`,text:`中文😀\\\" ${id}`})),taskHistory:[{old:'available but not required'}]};
    const {access}=preparePlanningContextAccess(JSON.stringify(source),root,'small-records');
    const {reconstructed,calls}=scanAll(access,true);
    expect(calls).toBeLessThan(access.requiredKeys.length/3);
    const entries=JSON.parse(await readFile(access.entriesPath,'utf8'));
    for(const entry of entries.filter((entry:any)=>access.requiredKeys.includes(entry.key)))expect(reconstructed.get(entry.key)).toBe(entry.content);
    expect(planningContextReadIssues(access)).toEqual([]);
    expect(reconstructed.size).toBe(access.requiredKeys.length);
  });
  it('continues long Unicode and escaped content without gaps or split surrogate pairs',async()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},text:'甲😀\\\"\n'.repeat(15000)}),root,'large-record');
    const {reconstructed}=scanAll(access,true);
    const entries=JSON.parse(await readFile(access.entriesPath,'utf8'));
    for(const entry of entries)expect(reconstructed.get(entry.key)).toBe(entry.content);
    expect(planningContextReadIssues(access)).toEqual([]);
  });
  it('does not credit skipped first pages and rejects invalid or ambiguous cursors',()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},text:'甲'.repeat(9000)}),root,'gap');
    const first=readPlanningContext(access,{action:'scan',length:1} as any) as any;
    readPlanningContext(access,{action:'scan',offset:first.nextOffset,characterOffset:first.nextCharacterOffset} as any);
    expect(planningContextReadIssues(access).length).toBeGreaterThan(0);
    expect(()=>readPlanningContext(access,{action:'scan',offset:999} as any)).toThrow('cursor');
    expect(()=>readPlanningContext(access,{action:'scan',characterOffset:-1} as any)).toThrow('cursor');
    expect(()=>readPlanningContext(access,{action:'scan',prefix:'/missing',characterOffset:1} as any)).toThrow('cursor');
    expect(()=>readPlanningContext(access,{action:'scan',length:0} as any)).toThrow('page');
    expect(()=>readPlanningContext(access,{action:'scan',requiredOnly:'true'} as any)).toThrow('boolean');
  });
  it('supports empty and prefix-scoped pages without pretending to complete a review',()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},constraints:['must read'],items:['one','two']}),root,'prefix');
    const empty=readPlanningContext(access,{action:'scan',prefix:'/missing'} as any) as any;
    expect(empty.parts).toEqual([]);expect(empty.nextOffset).toBeNull();
    scanAll(access,true);expect(planningContextReadIssues(access)).toEqual([]);
    const next=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},constraints:['must read'],items:['one','two']}),root,'prefix-next');
    const page=readPlanningContext(next.access,{action:'scan',prefix:'/items'} as any) as any;
    expect(page.parts.every((part:any)=>part.path.startsWith('/items'))).toBe(true);
    expect(planningContextReadIssues(next.access).length).toBeGreaterThan(0);
  });
  it('credits a batch only after its tool audit succeeds, with legacy single reads still supported',async()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},constraints:['must read'],items:['one','two']}),root,'audit');
    const blocked=join(root,'blocked');await writeFile(blocked,'not a directory');
    const failed=new PlanningToolsService({materialRoots:[],materials:[],experimentRoot:join(root,'experiments'),evidenceRoot:blocked,contextAccess:access});
    await expect(failed.readContext({action:'scan',requiredOnly:true} as any)).rejects.toThrow();
    expect((await readFile(access.readsPath,'utf8')).trim()).toBe('');
    const service=new PlanningToolsService({materialRoots:[],materials:[],experimentRoot:join(root,'experiments'),evidenceRoot:join(root,'evidence'),contextAccess:access});
    await service.readContext({action:'read',key:'c0'});
    await service.readContext({action:'scan',requiredOnly:true} as any);
    expect(planningContextReadIssues(access)).toEqual([]);
    const records=(await readFile(access.readsPath,'utf8')).trim().split('\n').map(JSON.parse);
    expect(records[0].key).toBe('c0');expect(records[1].reads.length).toBeGreaterThan(1);
  });
  it('rejects altered frozen input while preserving invocation isolation',async()=>{
    const text=JSON.stringify({workerResults:{draft:{groups:[]}},items:['a','b']});
    const first=preparePlanningContextAccess(text,root,'first');scanAll(first.access,true);
    const second=preparePlanningContextAccess(text,root,'second');
    expect(planningContextReadIssues(second.access).length).toBeGreaterThan(0);
    await writeFile(second.access.entriesPath,'[]');
    expect(()=>readPlanningContext(second.access,{action:'scan'} as any)).toThrow('index was modified');
  });
  it('rejects a corrupted later batch part without crediting its earlier valid part',async()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({workerResults:{draft:{groups:[]}},items:['one','two']}),root,'corrupt-part');
    const page=readPlanningContext(access,{action:'scan',requiredOnly:true},false) as any;
    const parts=page.parts.map((part:any)=>({...part,contextSha256:page.contextSha256}));
    parts[1].content+='tampered';
    expect(()=>commitPlanningContextReads(access,parts)).toThrow('batch receipt');
    expect((await readFile(access.readsPath,'utf8')).trim()).toBe('');
    expect(planningContextReadIssues(access).length).toBe(access.requiredKeys.length);
  });
  it('rejects a scan cursor inside an emoji and does not use required-only filtering in a design context',()=>{
    const {access}=preparePlanningContextAccess(JSON.stringify({text:'😀'}),root,'unicode-cursor');
    expect(()=>readPlanningContext(access,{action:'scan',prefix:'/text',characterOffset:2})).toThrow('Unicode boundary');
    expect(()=>readPlanningContext(access,{action:'scan',requiredOnly:true})).toThrow('independent review');
  });
});
