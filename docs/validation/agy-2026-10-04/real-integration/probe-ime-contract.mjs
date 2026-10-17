import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('Frozen label required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label),manifestBytes=await readFile(join(root,'manifest.json')),manifest=JSON.parse(manifestBytes),suffix=manifest.packages.at(-1).labelSuffix;
const snapshotBytes=await readFile(join(root,'final-snapshot.json')),snapshot=JSON.parse(snapshotBytes),block=snapshot.planning.blueprint.blocks.find(value=>value.id==='blk-tech-interface');
const handlers=block.content.split('\n').filter(line=>line.includes("inputElement.addEventListener(")).map(line=>line.slice(line.indexOf('inputElement.addEventListener(')));
if(handlers.length!==3)throw new Error('Expected exact three handlers; inspect revised contract before testing');
const listeners={},pending=[],state={value:'',display:null,error:null};
const context=createContext({inputElement:{addEventListener:(name,handler)=>{listeners[name]=handler;}},DebounceScheduler:{cancel(){pending.length=0;},schedule(callback){pending.length=0;pending.push(callback);}},handleDebouncedValidateAndDisplay(){state.display=state.value.trim()?state.value:null;state.error=state.value.trim()?null:'empty';}});
runInContext('let activeSessionId=0,currentSessionToken=0,isComposing=false;',context);
for(const handler of handlers)runInContext(handler,context);
function reset(){pending.length=0;runInContext('activeSessionId++;isComposing=false;',context);state.value='';state.display=null;state.error=null;}
const observations=[];
listeners.compositionstart();reset();listeners.compositionend();observations.push({sequence:'compositionstart -> clear -> old compositionend',pending:pending.length,pass:pending.length===0});
// These are explicitly synthetic contract inputs. They do not claim a native
// browser/IME emits this sequence, only show what the exported handler permits.
listeners.input({isComposing:false,inputType:'insertText'});while(pending.length)pending.shift()();observations.push({sequence:'same sequence -> input event while value is empty',error:state.error,pass:state.error===null});
listeners.compositionstart();reset();listeners.compositionend();state.value='old-composition';listeners.input({isComposing:false,inputType:'insertText'});while(pending.length)pending.shift()();observations.push({sequence:'same sequence -> DOM carries old composition text -> noncomposing input',display:state.display,pass:state.display===null});
const result={label,packageSuffix:suffix,checkedAt:new Date().toISOString(),kind:'Exact exported interface handler execution in synthetic VM; counterexample allowed by written contract, not target application or native IME browser reproduction',blockId:block.id,snapshotSha256:createHash('sha256').update(snapshotBytes).digest('hex'),handlers,observations,status:observations.every(value=>value.pass)?'passed-contract-probe':'needs-contract-repair',nativeBrowserVerification:'unexecuted'};
await writeFile(join(root,'ime-contract-counterexample.json'),JSON.stringify(result,null,2));if(!manifestBytes.equals(await readFile(join(root,'manifest.json'))))throw new Error('Frozen manifest changed');console.log(JSON.stringify({label,status:result.status,observations}));
