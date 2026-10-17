import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('Evidence label required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label);
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const checks=[];
function check(name,pass,details){checks.push({name,pass:!!pass,...(details===undefined?{}:{details})});if(!pass)throw new Error(name);}
const table=Array.from({length:256},(_,index)=>{let crc=index;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const value of bytes)crc=table[(crc^value)&0xff]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function entries(zip){
  let end=-1;
  for(let offset=zip.length-22;offset>=Math.max(0,zip.length-65557);offset--)if(zip.readUInt32LE(offset)===0x06054b50&&offset+22+zip.readUInt16LE(offset+20)===zip.length){end=offset;break;}
  check('zip-end-directory-present',end>=0);
  check('zip-single-volume',zip.readUInt16LE(end+4)===0&&zip.readUInt16LE(end+6)===0&&zip.readUInt16LE(end+8)===zip.readUInt16LE(end+10));
  const count=zip.readUInt16LE(end+10),centralSize=zip.readUInt32LE(end+12),centralOffset=zip.readUInt32LE(end+16),found=new Map();let offset=centralOffset;
  for(let index=0;index<count;index++){
    check('zip-central-entry-signature',zip.readUInt32LE(offset)===0x02014b50);
    const flags=zip.readUInt16LE(offset+8),method=zip.readUInt16LE(offset+10),crc=zip.readUInt32LE(offset+16),compressed=zip.readUInt32LE(offset+20),size=zip.readUInt32LE(offset+24),nameLength=zip.readUInt16LE(offset+28),extraLength=zip.readUInt16LE(offset+30),commentLength=zip.readUInt16LE(offset+32),localOffset=zip.readUInt32LE(offset+42),name=zip.subarray(offset+46,offset+46+nameLength).toString('utf8');
    check('zip-entry-safe-name',!!name&&!name.includes('..')&&!name.includes('\\')&&!name.startsWith('/')&&!name.includes(':')&&!found.has(name),name);
    check('zip-supported-compression-and-no-encryption',(method===0||method===8)&&!(flags&1),{name,method,flags});
    check('zip-local-entry-signature',zip.readUInt32LE(localOffset)===0x04034b50,name);
    const localNameLength=zip.readUInt16LE(localOffset+26),localExtraLength=zip.readUInt16LE(localOffset+28),localName=zip.subarray(localOffset+30,localOffset+30+localNameLength).toString('utf8');
    check('zip-local-central-name-match',localName===name,{name,localName});
    const start=localOffset+30+localNameLength+localExtraLength,data=zip.subarray(start,start+compressed),bytes=method===0?data:inflateRawSync(data);
    check('zip-entry-size-and-crc',bytes.length===size&&crc32(bytes)===crc,{name,size,actualSize:bytes.length,crc,actualCrc:crc32(bytes)});
    found.set(name,bytes);offset+=46+nameLength+extraLength+commentLength;
  }
  check('zip-central-directory-exact-boundary',offset===centralOffset+centralSize&&offset===end);
  return found;
}
let error;
try{
  check('initial-and-revised-packages-recorded',['initial','revised'].every(name=>manifest.packages.some(record=>record.labelSuffix===name)));
  for(const record of manifest.packages){
    const zip=await readFile(join(root,`${record.labelSuffix}-development-package.zip`));
    check('zip-hash-matches-record',createHash('sha256').update(zip).digest('hex')===record.zipSha256,record.labelSuffix);
    const archived=entries(zip),expected=[...record.manifest.files.map(file=>file.name),'package-manifest.json'];
    check('zip-exact-file-set',archived.size===expected.length&&expected.every(name=>archived.has(name)),{package:record.labelSuffix,expected,actual:[...archived.keys()]});
    for(const file of record.manifest.files){const local=await readFile(join(root,`${record.labelSuffix}-development-package`,file.name)),bytes=archived.get(file.name);check('zip-content-matches-exported-file-and-manifest',local.equals(bytes)&&createHash('sha256').update(bytes).digest('hex')===file.sha256,{package:record.labelSuffix,file:file.name});}
    check('zip-embedded-manifest-matches-record',JSON.stringify(JSON.parse(archived.get('package-manifest.json').toString('utf8')))===JSON.stringify(record.manifest),record.labelSuffix);
  }
}catch(caught){error=String(caught);process.exitCode=1;}
const result={label,checkedAt:new Date().toISOString(),status:error?'failed':'passed',error,checks};
await writeFile(join(root,'package-artifact-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({label,status:result.status,checks:checks.length,error}));
