import { mkdir, open, readFile, readdir, unlink, appendFile } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

export function providerSlots(group,label){
  if(!/^[a-z0-9-]+$/.test(group)||!/^[a-z0-9-]+$/.test(label))throw new Error('Valid shared group and control labels required');
  const directory=resolve('docs/validation/agy-2026-10-04/real-integration/global-provider-slots',group),journal=join(directory,'events.ndjson');
  const record=async event=>{await appendFile(journal,JSON.stringify({at:new Date().toISOString(),...event})+'\n');};
  const occupied=async()=>{const files=(await readdir(directory)).filter(name=>/^slot-[0-3]\.json$/.test(name));return files;};
  async function acquire(request){
    await mkdir(directory,{recursive:true});
    while(true){
      if(request.abortSignal?.aborted)throw new Error('Cancelled while waiting for a shared Provider slot');
      for(let index=0;index<4;index++){
        const leasePath=join(directory,`slot-${index}.json`);let handle;
        try{handle=await open(leasePath,'wx');}catch(error){if(error.code==='EEXIST')continue;throw error;}
        const lease={token:randomUUID(),group,index,label,pid:process.pid,requestId:request.requestId,model:request.model,acquiredAt:new Date().toISOString(),path:leasePath};
        try{await handle.writeFile(JSON.stringify(lease));await handle.close();await record({event:'acquired',...lease,occupiedSlots:await occupied()});return lease;}catch(error){await handle.close().catch(()=>{});await unlink(leasePath).catch(()=>{});throw error;}
      }
      for(const name of await occupied()){
        let lease;try{lease=JSON.parse(await readFile(join(directory,name),'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)continue;throw error;}
        try{process.kill(lease.pid,0);}catch(error){if(error.code==='ESRCH')throw new Error(`Shared slot ${name} belongs to exited process ${lease.pid}; preserve its evidence and explicitly recover the gate`);throw error;}
      }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  async function release(lease){
    if(dirname(resolve(lease.path))!==directory||!/^slot-[0-3]\.json$/.test(basename(lease.path)))throw new Error('Invalid shared slot path');
    const current=JSON.parse(await readFile(lease.path,'utf8'));
    if(current.token!==lease.token||current.pid!==process.pid||current.label!==label)throw new Error('Shared slot ownership changed');
    await unlink(lease.path);await record({event:'released',token:lease.token,index:lease.index,label,pid:process.pid,requestId:lease.requestId,occupiedSlots:await occupied()});
  }
  async function owned(){await mkdir(directory,{recursive:true});const leases=[];for(const name of await occupied()){let lease;try{lease=JSON.parse(await readFile(join(directory,name),'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)continue;throw error;}if(lease.pid===process.pid&&lease.label===label)leases.push(lease);}return leases;}
  return{group,directory,journal,acquire,release,owned};
}
