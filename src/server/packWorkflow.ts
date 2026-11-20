import type {Database} from './index';
import type {Operation,MutationResult,Pack,Question} from '../shared/types';
import {validatePackInput,validateQuestion} from '../shared/validation';

const MAX_QUESTIONS_PER_CHANGE=100;
const PREPARE_TTL_MS=60*60*1000;

interface WorkflowDeps {
 read:<T>(db:Database,owner:string,kind:string,id:string)=>Promise<T|null>;
 mutate:(db:Database,owner:string,op:Operation)=>Promise<MutationResult>;
}
interface PreparedChange {
 id:string;
 mode:'create'|'append';
 packId:string;
 expectedRevision:number;
 fingerprint:string;
 createdAt:string;
 expiresAt:string;
 questions:Question[];
 content:ReturnType<typeof validatePackInput>|null;
}
const nonblank=(value:unknown,label:string)=>{
 if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error('Invalid '+label);
 return value.trim();
};
const norm=(s:string)=>s.trim().toLocaleLowerCase().replace(/\s+/g,' ');

function normalizedQuestions(input:unknown):Question[]{
 if(!Array.isArray(input)||input.length<1||input.length>MAX_QUESTIONS_PER_CHANGE)
  throw new Error('Supply 1..100 new questions per prepared operation');
 return input.map((raw,i)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Question '+(i+1)+' must be an object');
  const q=raw as Record<string,unknown>;
  const options=Array.isArray(q.options)?q.options.map((option,index)=>{
   if(!option||typeof option!=='object'||Array.isArray(option))throw new Error('Invalid option '+index);
   const o=option as Record<string,unknown>;
   return {...o,id:o.id??crypto.randomUUID()};
  }):undefined;
  let correctOptionId=q.correctOptionId;
  if(q.type==='MULTIPLE_CHOICE'&&q.correctOptionIndex!==undefined){
   if(!Number.isSafeInteger(q.correctOptionIndex)|| (q.correctOptionIndex as number)<0 ||
      !options ||(q.correctOptionIndex as number)>=options.length)throw new Error('correctOptionIndex must select an option');
   if(correctOptionId!==undefined)throw new Error('Supply correctOptionId OR correctOptionIndex, not both');
   correctOptionId=options[q.correctOptionIndex as number].id;
  }
  const {correctOptionIndex:_index,...question}=q;
  return validateQuestion({...question,id:q.id??crypto.randomUUID(),options,correctOptionId});
 });
}
async function readPrepared(db:Database,owner:string,id:string){
 const row=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='prepared_change' AND id=?")
  .bind(owner,id).first<{data:string}>();
 return row?JSON.parse(row.data) as PreparedChange:null;
}
function preview(plan:PreparedChange){
 return {prepareId:plan.id,status:'prepared',mode:plan.mode,packId:plan.packId,expectedRevision:plan.expectedRevision,
  expiresAt:plan.expiresAt,questionsAdded:plan.questions.length,
  concepts:[...new Set(plan.questions.map(q=>q.conceptName?.trim()).filter(Boolean))].slice(0,20),
  questionTypes:plan.questions.reduce((totals:Record<string,number>,q)=>{totals[q.type]=(totals[q.type]??0)+1;return totals;},{}),
  examples:plan.questions.slice(0,3).map(q=>({id:q.id,text:q.text,type:q.type,concept:q.conceptName??null})),
  note:'This is a preview only. No bank content was saved. Call commit_pack_change after approval.'};
}

export async function preparePackChange(db:Database,owner:string,args:any,deps:WorkflowDeps){
 const prepareId=nonblank(args.operationId,'operationId');
 if(!['create','append'].includes(args.mode))throw new Error('Mode must be create or append');
 const fingerprint=JSON.stringify({mode:args.mode,packId:args.packId??null,expectedRevision:args.expectedRevision??null,
  title:args.title??null,description:args.description??null,folder:args.folder??null,tags:args.tags??null,questions:args.questions});
 const existing=await readPrepared(db,owner,prepareId);
 if(existing){
  if(existing.fingerprint!==fingerprint)throw new Error('Prepared operation ID was reused with different content');
  return preview(existing);
 }
 const questions=normalizedQuestions(args.questions);
 const ids=new Set<string>(),texts=new Set<string>();
 for(const q of questions){
  if(ids.has(q.id)||texts.has(norm(q.text)))throw new Error('Repeated question ID or exact duplicate question text');
  ids.add(q.id);texts.add(norm(q.text));
 }
 let packId:string,expectedRevision:number,content:PreparedChange['content']=null;
 if(args.mode==='create'){
  if(args.packId!==undefined||args.expectedRevision!==undefined)throw new Error('New bank cannot supply packId/revision');
  packId=crypto.randomUUID();expectedRevision=0;
  content=validatePackInput({title:args.title,description:args.description??'',folder:args.folder??'',
   tags:args.tags??[],questions,artifacts:[]});
 }else{
  if(args.title!==undefined||args.description!==undefined||args.tags!==undefined||args.folder!==undefined)
   throw new Error('Append cannot change bank metadata');
  packId=nonblank(args.packId,'packId');
  if(!Number.isSafeInteger(args.expectedRevision)||args.expectedRevision<1)throw new Error('Expected bank revision is required');
  expectedRevision=args.expectedRevision;
  const current=await deps.read<Pack>(db,owner,'pack',packId);
  if(!current||current.deletedAt)throw new Error('Bank not found');
  if(current.revision!==expectedRevision)throw new Error('CONFLICT: Bank revision changed; reload before preparing');
  if(current.questions.length+questions.length>1000)throw new Error('Bank limit is 1,000 questions');
  const existingIds=new Set(current.questions.map(q=>q.id));
  const existingText=new Set(current.questions.map(q=>norm(q.text)));
  for(const q of questions){
   if(existingIds.has(q.id)||existingText.has(norm(q.text)))throw new Error('Question ID or exact text already exists in bank');
  }
  // Check full resulting content before writing the prepared request.
  validatePackInput({...current,questions:[...current.questions,...questions]});
 }
 const createdAt=new Date().toISOString();
 const plan:PreparedChange={id:prepareId,mode:args.mode,packId,expectedRevision,fingerprint,createdAt,
  expiresAt:new Date(Date.now()+PREPARE_TTL_MS).toISOString(),questions,content};
 // Old uncommitted previews do not need indefinite server retention.
 await db.prepare("DELETE FROM records WHERE owner_id=? AND kind='prepared_change' AND json_extract(data,'$.expiresAt')<?")
  .bind(owner,createdAt).run();
 const count=await db.prepare("SELECT COUNT(*) AS count FROM records WHERE owner_id=? AND kind='prepared_change'")
  .bind(owner).first<{count:number}>();
 if((count?.count??0)>=100)throw new Error('Too many prepared changes; complete or wait for expiry');
 await db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) VALUES(?,'prepared_change',?,0,?) ON CONFLICT(owner_id,kind,id) DO NOTHING")
  .bind(owner,prepareId,JSON.stringify(plan)).run();
 const saved=await readPrepared(db,owner,prepareId);
 if(!saved||saved.fingerprint!==fingerprint)throw new Error('Prepared operation ID conflict');
 return preview(saved);
}

export async function commitPackChange(db:Database,owner:string,args:any,deps:WorkflowDeps){
 const prepareId=nonblank(args.prepareId,'prepareId'),operationId=nonblank(args.operationId,'operationId');
 if(prepareId===operationId)throw new Error('Commit operation ID must differ from prepare ID');
 const existing=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?')
  .bind(owner,operationId).first<{result:string}>();
 if(existing){
  const result=JSON.parse(existing.result) as MutationResult;
  if(!result.ok)throw new Error(result.error??'Previous operation failed');
  const record=result.record as Pack;
  return {operationId,prepareId,status:'committed',packId:record.id,revision:record.revision,
   questionCount:record.questions.length};
 }
 const plan=await readPrepared(db,owner,prepareId);
 if(!plan)throw new Error('Prepared change not found in the current account');
 if(Date.parse(plan.expiresAt)<=Date.now())return {operationId,prepareId,status:'expired',note:'Prepare the change again.'};
 const current=await deps.read<Pack>(db,owner,'pack',plan.packId);
 if(plan.mode==='create'&&current)return {operationId,prepareId,status:'conflict',currentRevision:current.revision};
 if(plan.mode==='append'&&(!current||current.deletedAt))
  return {operationId,prepareId,status:'not_found',note:'The bank no longer exists.'};
 if((current?.revision??0)!==plan.expectedRevision)
  return {operationId,prepareId,status:'conflict',currentRevision:current?.revision??null,
   expectedRevision:plan.expectedRevision,note:'Reload the bank and prepare changes again; nothing was overwritten.'};
 const payload=plan.mode==='create'?plan.content:{...current!,questions:[...current!.questions,...plan.questions]};
 if(!payload)throw new Error('Missing prepared content');
 const result=await deps.mutate(db,owner,{id:operationId,kind:'pack.put',entityId:plan.packId,payload,
  expectedRevision:plan.expectedRevision,createdAt:new Date().toISOString()});
 if(!result.ok){
  if(result.code==='CONFLICT')return {operationId,prepareId,status:'conflict',
   expectedRevision:plan.expectedRevision,currentRevision:result.current?.revision??null,note:'Reload and prepare again.'};
  throw new Error((result.code??'INVALID')+': '+(result.error??'Could not commit'));
 }
 const record=result.record as Pack;
 return {operationId,prepareId,status:'committed',packId:record.id,revision:record.revision,
  questionCount:record.questions.length,added:plan.questions.length,committedAt:record.updatedAt};
}
