import type {Database} from './index';
import type {Pack} from '../shared/types';
import {parseDebugger,gradeDebugger} from '../shared/debugger';

const nonblank=(value:unknown,label:string)=>{
 if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error('Invalid '+label);
 return value.trim();
};
const integer=(value:unknown,label:string)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new Error('Invalid '+label);
 return value;
};
export interface DebuggerSubmission {
 packId:string;artifactId:string;expectedRevision:number;operationId:string;selections:Record<string,string>;
}
async function digest(obj:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(obj));
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function submitDebugger(db:Database,owner:string,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid debugger submission');
 const args=input as Record<string,unknown>;
 const packId=nonblank(args.packId,'packId'),artifactId=nonblank(args.artifactId,'artifactId');
 const operationId=nonblank(args.operationId,'operationId'),expectedRevision=integer(args.expectedRevision,'expectedRevision');
 if(!args.selections||typeof args.selections!=='object'||Array.isArray(args.selections))throw new Error('Invalid selections');
 const selections=args.selections as Record<string,string>;
 const fingerprint=await digest([packId,artifactId,expectedRevision,selections]);
 const previous=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?')
  .bind(owner,operationId).first<{result:string}>();
 if(previous){
  const record=JSON.parse(previous.result) as {fingerprint?:string;response?:unknown};
  if(record.fingerprint!==fingerprint||!record.response)throw new Error('Operation ID already belongs to a different operation');
  return {...record.response as object,replayed:true};
 }
 const row=await db.prepare("SELECT revision,data FROM records WHERE owner_id=? AND kind='pack' AND id=?")
  .bind(owner,packId).first<{revision:number;data:string}>();
 if(!row)throw new Error('Bank not found');
 const pack=JSON.parse(row.data) as Pack;
 if(pack.deletedAt)throw new Error('Bank was deleted');
 if(row.revision!==expectedRevision)throw new Error('CONFLICT: Bank revision changed. Reopen the scenario.');
 const artifact=pack.artifacts.find(a=>a.id===artifactId&&a.kind==='debugger');
 if(!artifact)throw new Error('Debugger artifact not found');
 const scenario=parseDebugger(artifact.content);
 const grade=gradeDebugger(scenario,selections);
 const id='debug-result-'+crypto.randomUUID(),gradedAt=new Date().toISOString();
 const persisted={id,packId,artifactId,packRevision:row.revision,gradedAt,
  selections,grade,scenarioTitle:scenario.title};
 const response={status:'committed',resultId:id,packId,artifactId,packRevision:row.revision,gradedAt,grade};
 const nonce=crypto.randomUUID();
 await db.batch([
  db.prepare("INSERT INTO operations(owner_id,id,nonce,result) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner_id=? AND kind='pack' AND id=? AND revision=?) ON CONFLICT(owner_id,id) DO NOTHING")
   .bind(owner,operationId,nonce,JSON.stringify({fingerprint,response}),owner,packId,expectedRevision),
  db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) SELECT ?,'debugger-result',?,1,? WHERE EXISTS(SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?) ON CONFLICT(owner_id,kind,id) DO NOTHING")
   .bind(owner,id,JSON.stringify(persisted),owner,operationId,nonce)
 ]);
 const after=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?')
  .bind(owner,operationId).first<{result:string}>();
 if(!after)throw new Error('CONFLICT: Bank changed before the result could be saved');
 const receipt=JSON.parse(after.result) as {fingerprint?:string;response?:unknown};
 if(receipt.fingerprint!==fingerprint||!receipt.response)throw new Error('Operation ID collision with different content');
 return receipt.response;
}
export async function listDebuggerResults(db:Database,owner:string,packId:string,artifactId:string){
 const rows=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='debugger-result' AND json_extract(data,'$.packId')=? AND json_extract(data,'$.artifactId')=? ORDER BY json_extract(data,'$.gradedAt') DESC,id DESC LIMIT 20")
  .bind(owner,nonblank(packId,'packId'),nonblank(artifactId,'artifactId')).all<{data:string}>();
 return {items:rows.results.map(r=>{
  const {id,gradedAt,grade,packRevision}=JSON.parse(r.data) as {id:string;gradedAt:string;grade:ReturnType<typeof gradeDebugger>;packRevision:number};
  return {id,gradedAt,correct:grade.correct,total:grade.total,passed:grade.passed,packRevision};
 })};
}
