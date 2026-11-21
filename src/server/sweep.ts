import type {Database} from './index';
import type {Pack} from '../shared/types';
import {resolveExamPoints,type SweepDecision} from '../shared/examCoverage';

const nonblank=(v:unknown,label:string,max=200)=>{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('Invalid '+label);
 return v.trim();
};
async function ownedPack(db:Database,owner:string,packId:string){
 const row=await db.prepare("SELECT revision,data FROM records WHERE owner_id=? AND kind='pack' AND id=?")
  .bind(owner,packId).first<{revision:number;data:string}>();
 if(!row)throw new Error('Bank not found in this account');
 const pack=JSON.parse(row.data) as Pack;
 if(pack.deletedAt)throw new Error('Bank has been deleted');
 return {pack,revision:row.revision};
}
function parseDecision(value:unknown,owner:string):SweepDecision{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid Sweep decision');
 const e=value as Record<string,unknown>;
 if(e.version!==1)throw new Error('Unsupported Sweep version');
 const id=nonblank(e.id,'decision ID'),packId=nonblank(e.packId,'pack ID'),
  pointId=nonblank(e.pointId,'point ID'),questionId=nonblank(e.questionId,'question ID');
 if(e.ownerId!==owner)throw new Error('Invalid owner for Sweep decision');
 if(!Number.isSafeInteger(e.packRevision)||Number(e.packRevision)<1)throw new Error('Invalid bank revision');
 if(e.choice!=='known'&&e.choice!=='unsure')throw new Error('Invalid Sweep decision');
 const decidedAt=nonblank(e.decidedAt,'decision timestamp',60);
 if(!Number.isFinite(Date.parse(decidedAt)))throw new Error('Invalid Sweep timestamp');
 return {version:1,id,ownerId:owner,packId,packRevision:Number(e.packRevision),
  pointId,questionId,choice:e.choice,decidedAt:new Date(decidedAt).toISOString()};
}
/**
 * Learner claims are stored separately from graded answer / SRS events.
 * A server acknowledgement is NOT a successful quiz answer.
 */
export async function saveSweepDecision(db:Database,owner:string,input:unknown){
 const decision=parseDecision(input,owner);
 const previous=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='sweep-choice' AND id=?")
  .bind(owner,decision.id).first<{data:string}>();
 if(previous){
  if(JSON.stringify(JSON.parse(previous.data))!==JSON.stringify(decision))
   throw new Error('Decision ID used for different content');
  return {status:'committed',event:decision,replayed:true};
 }
 const {pack,revision}=await ownedPack(db,owner,decision.packId);
 if(revision!==decision.packRevision)throw new Error('CONFLICT: Bank revision changed. Review coverage again.');
 const point=resolveExamPoints(pack).points.find(p=>p.id===decision.pointId);
 if(!point||!point.questionIds.includes(decision.questionId))throw new Error('Decision does not match current exam point map');
 const count=await db.prepare("SELECT COUNT(*) AS count FROM records WHERE owner_id=? AND kind='sweep-choice' AND json_extract(data,'$.packId')=?")
  .bind(owner,decision.packId).first<{count:number}>();
 if((count?.count??0)>=3000)throw new Error('Sweep decision history limit reached for this bank');
 await db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) VALUES(?,'sweep-choice',?,1,?) ON CONFLICT(owner_id,kind,id) DO NOTHING")
  .bind(owner,decision.id,JSON.stringify(decision)).run();
 const stored=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='sweep-choice' AND id=?")
  .bind(owner,decision.id).first<{data:string}>();
 if(!stored||JSON.stringify(JSON.parse(stored.data))!==JSON.stringify(decision))
  throw new Error('Decision ID collided with different content');
 return {status:'committed',event:decision};
}
export async function listSweepDecisions(db:Database,owner:string,packId:string){
 const {pack}=await ownedPack(db,owner,nonblank(packId,'pack ID'));
 const rows=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='sweep-choice' AND json_extract(data,'$.packId')=? ORDER BY json_extract(data,'$.decidedAt') DESC,id DESC LIMIT 3000")
  .bind(owner,pack.id).all<{data:string}>();
 const decisions=rows.results.map(row=>JSON.parse(row.data) as SweepDecision);
 return {packId:pack.id,decisions};
}
