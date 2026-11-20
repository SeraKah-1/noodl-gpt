import {callBrainTool} from './brainDump';
import type {Database} from './index';
import type {Attempt,Pack,Question,Snapshot,Operation,MutationResult} from '../shared/types';
import {createAttempt,normalizeAnswer} from '../shared/engine';
import {batchView} from '../shared/batch';

type Gap={
 unitNumber:number;point:number;slide:number;concept:string;
 verdict:'missing'|'incorrect'|'partial'|'prompted_recall';
 sourceStatus:'tutor_provided_unverified';
};
type GapPage={sessionId:string;revision:number;total:number;nextOffset:number|null;gaps:Gap[]};
type Context={snapshot:(db:Database,owner:string)=>Promise<Snapshot>;
 mutate:(db:Database,owner:string,op:Operation)=>Promise<MutationResult>};

const text=(value:unknown,label:string)=>{
 if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error('Invalid '+label);
 return value.trim();
};
const limitValue=(value:unknown)=>{
 const limit=value??5;
 if(!Number.isSafeInteger(limit)||typeof limit!=='number'||limit<1||limit>20)
  throw new Error('Repair limit must be 1..20');
 return limit;
};
const weight:Record<Gap['verdict'],number>={incorrect:4,missing:3,partial:2,prompted_recall:1};
function labels(gaps:Gap[]){
 const groups=new Map<string,{label:string;weight:number;observations:number;slides:Set<number>}>();
 for(const gap of gaps){
  const key=normalizeAnswer(gap.concept);
  if(!key)continue;
  const group=groups.get(key)??{label:gap.concept,weight:0,observations:0,slides:new Set<number>()};
  group.weight=Math.max(group.weight,weight[gap.verdict]);
  group.observations++;
  group.slides.add(gap.slide);
  groups.set(key,group);
 }
 return [...groups.entries()].map(([key,value])=>({key,...value,slides:[...value.slides].sort((a,b)=>a-b)}))
  .sort((a,b)=>b.weight-a.weight||b.observations-a.observations||a.key.localeCompare(b.key));
}
async function getGaps(db:Database,owner:string,sessionId:string){
 const gaps:Gap[]=[];
 let offset=0,revision=0;
 for(let pass=0;pass<20;pass++){
  const response=await callBrainTool(db,owner,'get_brain_dump_gaps',{sessionId,offset,limit:50}) as GapPage|undefined;
  if(!response)throw new Error('Brain Dump gaps are not available');
  revision=response.revision;
  gaps.push(...response.gaps);
  if(response.nextOffset===null)return {revision,gaps};
  if(response.nextOffset<=offset)throw new Error('Invalid gap pagination');
  offset=response.nextOffset;
 }
 throw new Error('Brain Dump evidence exceeded pagination limit');
}
async function stableId(owner:string,sessionId:string,revision:number){
 const bytes=new TextEncoder().encode(JSON.stringify([owner,sessionId,revision]));
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return 'recall-repair-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function buildCandidates(owner:string,snapshot:Snapshot,gaps:Gap[],packId:string|undefined,limit:number){
 const packs=snapshot.packs.filter(p=>p.ownerId===owner&&!p.deletedAt&&(!packId||p.id===packId));
 if(packId&&!packs.length)throw new Error('Bank not found in this account');
 const concepts=labels(gaps);
 const seenStems=new Set<string>(),seenIds=new Set<string>();
 for(const attempt of snapshot.attempts.filter(a=>a.ownerId===owner && !(a as Attempt&{deletedAt?:string}).deletedAt)){
  for(const item of attempt.items){
   seenStems.add(normalizeAnswer(item.question.text));
   seenIds.add(item.sourcePackId+':'+item.sourceQuestionId);
  }
 }
 const byConcept=new Map<string,{pack:Pack;question:Question}[]>();
 for(const group of concepts)byConcept.set(group.key,[]);
 for(const pack of packs)for(const question of pack.questions){
  const key=normalizeAnswer(question.conceptName??'');
  if(!byConcept.has(key)||seenIds.has(pack.id+':'+question.id)||seenStems.has(normalizeAnswer(question.text)))continue;
  byConcept.get(key)!.push({pack,question});
 }
 const counts=concepts.map(c=>({concept:c.label,observations:c.observations,
  slideAnchors:c.slides,weight:c.weight,unseenQuestions:byConcept.get(c.key)!.length}));
 const candidates:{pack:Pack;question:Question;concept:string}[]=[];
 const selectedTexts=new Set<string>();
 // Round-robin so a single topic never consumes every question automatically.
 while(candidates.length<limit){
  let picked=false;
  for(const group of concepts){
   const pool=byConcept.get(group.key)!;
   while(pool.length){
    const candidate=pool.shift()!;
    const stem=normalizeAnswer(candidate.question.text);
    if(selectedTexts.has(stem))continue;
    candidates.push({...candidate,concept:group.label});
    selectedTexts.add(stem);
    picked=true;
    break;
   }
   if(candidates.length>=limit)break;
  }
  if(!picked)break;
 }
 return {counts,candidates};
}

export const recallRepairTools=[
 {name:'prepare_recall_repair',
  description:'Read Brain Dump missed, partial and hinted recall evidence and count genuinely unseen bank questions with matching concept labels. No write and no answer key disclosure. Matching a concept label is NOT independent scientific/source verification.',
  inputSchema:{type:'object',properties:{sessionId:{type:'string'},packId:{type:'string'},
   limit:{type:'integer',minimum:1,maximum:20}},required:['sessionId'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true},
  _meta:{ui:{visibility:['model','app']}}},
 {name:'start_recall_repair',
  description:'After the learner requests a Brain Dump follow-up, start a real persisted Batch check using DISTINCT previously unpresented questions tagged to reviewed Brain Dump gaps. No AI model, no source-file processing, no automatic new questions; if none available, direct ChatGPT to prepare+commit genuine new questions. Returns no answer keys.',
  inputSchema:{type:'object',properties:{sessionId:{type:'string'},packId:{type:'string'},
   limit:{type:'integer',minimum:1,maximum:20},operationId:{type:'string'}},
   required:['sessionId','operationId'],additionalProperties:false},
  annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false,idempotentHint:true},
  _meta:{ui:{visibility:['model','app'],resourceUri:'ui://noodl/workspace'}}}
];

export async function callRecallRepairTool(db:Database,owner:string,name:string,args:any,deps:Context):Promise<unknown|undefined>{
 if(name!=='prepare_recall_repair'&&name!=='start_recall_repair')return undefined;
 const sessionId=text(args.sessionId,'sessionId');
 const operationId=name==='start_recall_repair'?text(args.operationId,'operationId'):null;
 const packId=args.packId===undefined?undefined:text(args.packId,'packId');
 const limit=limitValue(args.limit);

 // An idempotent retry must return the original saved attempt even after it has
 // altered the unseen-question pool.
 if(operationId){
  const prior=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?')
   .bind(owner,operationId).first<{result:string}>();
  if(prior){
   const result=JSON.parse(prior.result) as MutationResult;
   const attempt=result.record as Attempt|undefined;
   if(!result.ok||!attempt?.id?.startsWith('recall-repair-')||!Array.isArray(attempt.items))
    throw new Error('Operation ID belongs to another action');
   return attempt.status==='active'?{...batchView(attempt),sourceSessionId:sessionId,replayed:true}:
    {attemptId:attempt.id,status:'completed',sourceSessionId:sessionId,replayed:true};
  }
 }
 const {revision,gaps}=await getGaps(db,owner,sessionId);
 const snap=await deps.snapshot(db,owner);
 const {counts,candidates}=buildCandidates(owner,snap,gaps,packId,limit);
 const attemptId=await stableId(owner,sessionId,revision);
 const existing=snap.attempts.find(a=>a.ownerId===owner&&a.id===attemptId&&!(a as Attempt&{deletedAt?:string}).deletedAt);
 const preview={sessionId,feedbackRevision:revision,available:candidates.length>0,
  selectedCount:candidates.length,diagnosedConcepts:counts,existingAttemptId:existing?.id??null,
  evidenceStatus:'tutor_reported_feedback_and_concept_label_match',
  explanation:candidates.length?'Only distinct questions not present in saved session history were selected. Labels and slide anchors do not independently verify question accuracy.':
   'No unseen question with an exactly matching concept label. Create source-grounded alternatives with prepare_pack_change, request approval, commit_pack_change, and retry.',
  nextAction:existing?'resume_existing_repair':candidates.length?'start_recall_repair':'prepare_source_grounded_questions'};
 if(name==='prepare_recall_repair')return preview;
 if(existing)return existing.status==='active'?{...batchView(existing),sourceSessionId:sessionId,alreadyStarted:true}:
  {attemptId:existing.id,status:'completed',sourceSessionId:sessionId,alreadyStarted:true};
 if(!candidates.length)return {...preview,status:'needs_questions'};
 const selection=candidates.map(c=>({sourcePackId:c.pack.id,question:c.question}));
 const attempt=createAttempt(candidates[0].pack,
  {mode:'BATCH',batchSize:selection.length,shuffle:false,mixed:false,retention:false},owner,selection);
 attempt.id=attemptId;
 attempt.title='Brain Dump · latihan perbaikan';
 const result=await deps.mutate(db,owner,{id:operationId!,entityId:attempt.id,kind:'attempt.put',payload:attempt,
  expectedRevision:0,createdAt:new Date().toISOString()});
 if(!result.ok)throw new Error((result.code??'INVALID')+': '+(result.error??'Failed to save recall repair'));
 const saved=result.record as Attempt;
 return {...batchView(saved),sourceSessionId:sessionId,
  feedbackRevision:revision,evidenceStatus:preview.evidenceStatus,stored:true};
}
