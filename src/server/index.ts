import {guestIdentity,startGuestSession} from './guest';
import {bankBackup,storageConfigured,type SupabaseEnv} from './supabase';
import {controlTools,callControlTool} from './control';
import {preferenceTools,callPreferenceTool,getPreferences,updatePreferences} from './preferences';
import {exportTools,callExportTool,handleExportRequest} from './exports';
import type { Attempt, MutationResult, Operation, Pack, Publication, Snapshot, User } from '../shared/types';
import { evaluate, progressFor, correctAnswerText } from '../shared/engine';
import { validateAttempt, validatePackInput, validateQuestion, validateReviewEvent, validateArtifact } from '../shared/validation';
export interface Statement { bind(...values:unknown[]):Statement; first<T=Record<string,unknown>>():Promise<T|null>; all<T=Record<string,unknown>>():Promise<{results:T[]}>; run():Promise<unknown> }
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>}
export interface Env extends SupabaseEnv { DB:Database }
export type Assets=Record<string,{body:string;type:string;base64?:boolean}>;
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const text=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Invalid ${label}`);return v;};
function identity(req:Request):User{const id=req.headers.get('oai-authenticated-user-id');if(!id)throw new AccessError();let name=req.headers.get('oai-authenticated-user-full-name')??'Learner';try{name=decodeURIComponent(name)}catch{}return {id,name,email:req.headers.get('oai-authenticated-user-email')??undefined};}
class AccessError extends Error {}
export async function readRecord<T>(db:Database,owner:string,kind:string,id:string):Promise<T|null>{const row=await db.prepare('SELECT data FROM records WHERE owner_id=? AND kind=? AND id=?').bind(owner,kind,id).first<{data:string}>();return row?JSON.parse(row.data):null;}
export async function snapshot(db:Database,owner:string):Promise<Snapshot>{const rows=await db.prepare('SELECT kind,data FROM records WHERE owner_id=?').bind(owner).all<{kind:string;data:string}>();return {packs:rows.results.filter(r=>r.kind==='pack').map(r=>JSON.parse(r.data)),attempts:rows.results.filter(r=>r.kind==='attempt').map(r=>JSON.parse(r.data)),reviews:rows.results.filter(r=>r.kind==='review').map(r=>JSON.parse(r.data)),cursor:Date.now(),preferences:await getPreferences(db,owner)};}
function sameQuestion(snapshot:any,source:any,mixed:boolean):boolean{
 const canonical=(q:any)=>({...q,...(q.options?{options:[...q.options].sort((a:any,b:any)=>a.id.localeCompare(b.id))}:{})});
 if(JSON.stringify(canonical(snapshot))===JSON.stringify(canonical(source)))return true;
 if(!mixed||source.type!=='MULTIPLE_CHOICE')return false;
 const {options,correctOptionId,...base}=source;
 if(snapshot.type==='FILL_BLANK')return JSON.stringify(snapshot)===JSON.stringify({...base,type:'FILL_BLANK',acceptedAnswers:[correctAnswerText(source)]});
 if(snapshot.type==='TRUE_FALSE')return options.some((option:any)=>JSON.stringify(snapshot)===JSON.stringify({...base,type:'TRUE_FALSE',text:`${source.text}\n\nPernyataan: jawabannya adalah “${option.text}”.`,correctBoolean:option.id===correctOptionId}));
 return false;
}
function validateAnswerHistory(attempt:Attempt,current:Attempt|null){
 let lives=3,streak=0;
 for(let index=0;index<attempt.answers.length;index++){
  const answer=attempt.answers[index];const item=attempt.items[index];
  if(answer.occurrenceId!==item.id)throw new Error('Answers must follow occurrence order');
  if(index>0&&Date.parse(answer.answeredAt)<Date.parse(attempt.answers[index-1].answeredAt))throw new Error('Answer times must be ordered');
  const old=current?.answers.find(a=>a.occurrenceId===answer.occurrenceId);
  const knownDeadline=current?.items[current.currentIndex]?.id===answer.occurrenceId?current.deadline:index===0?Date.parse(attempt.createdAt)+20000:null;
  const expired=attempt.options.mode==='TIME_RUSH'&&(answer.value===''||(knownDeadline!==null&&Date.parse(answer.answeredAt)>=knownDeadline));
  // Timeout events carry the empty sentinel produced by the shared engine.
  answer.isCorrect=old?.isCorrect??(!expired&&evaluate(item.question,answer.value));
  streak=answer.isCorrect?streak+1:0;
  if(attempt.options.mode==='SURVIVAL'&&!answer.isCorrect)lives=Math.max(0,lives-1);
  if(lives===0&&index!==attempt.answers.length-1)throw new Error('Survival attempt continued after losing all lives');
 }
 attempt.lives=lives;attempt.streak=streak;
 if(attempt.currentIndex>attempt.answers.length)throw new Error('Cannot skip unanswered questions');
 if(attempt.status==='completed'&&!attempt.completedAt)throw new Error('Completed attempt needs completedAt');
}
export async function mutate(db:Database,owner:string,op:Operation):Promise<MutationResult>{
 const id=text(op?.id,'operation id');const existing=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,id).first<{result:string}>();if(existing)return JSON.parse(existing.result);
 try{
 text(op.entityId,'entity id');if(!['pack.put','pack.delete','attempt.put','review.add'].includes(op.kind))throw new Error('Invalid operation kind');
 const kind=op.kind.split('.')[0];const current=await readRecord<any>(db,owner,kind,op.entityId);let record:any;
 if(kind!=='review'&&(!Number.isSafeInteger(op.expectedRevision)||op.expectedRevision!==(current?.revision??0)))return {operationId:id,ok:false,code:'CONFLICT',error:'Revision changed',current:current??undefined};
 if(op.kind==='pack.put'){
  if(current?.deletedAt)return {operationId:id,ok:false,code:'CONFLICT',error:'Pack deleted',current};
  record={...validatePackInput(op.payload),id:op.entityId,ownerId:owner,revision:(current?.revision??0)+1,createdAt:current?.createdAt??now(),updatedAt:now()};
 }else if(op.kind==='pack.delete'){
  if(!current)return {operationId:id,ok:false,code:'NOT_FOUND',error:'Pack not found'};
  record={...current,revision:current.revision+1,deletedAt:now(),updatedAt:now()};
 }else if(op.kind==='attempt.put'){
  record=validateAttempt(op.payload);record.ownerId=owner;if(record.id!==op.entityId)throw new Error('Attempt ID mismatch');
  if(current){
   if(current.deletedAt)return {operationId:id,ok:false,code:'CONFLICT',error:'Attempt was deleted',current};
   if(current.status==='completed')return {operationId:id,ok:false,code:'CONFLICT',error:'Completed attempt is immutable',current};
   for(const key of ['items','options','packId','packRevision','createdAt'])if(JSON.stringify(record[key])!==JSON.stringify(current[key]))throw new Error('Attempt snapshot is immutable');
   for(const previous of current.answers){const next=record.answers.find((a:any)=>a.occurrenceId===previous.occurrenceId);if(!next||next.value!==previous.value||next.answeredAt!==previous.answeredAt)throw new Error('Existing answers are immutable');}
  }else{
   for(const item of record.items){
    const versions=await db.prepare('SELECT data FROM pack_versions WHERE owner_id=? AND id=?').bind(owner,item.sourcePackId).all<{data:string}>();
    const valid=versions.results.some(row=>{const pack=JSON.parse(row.data) as Pack;return pack.questions.some(q=>q.id===item.sourceQuestionId&&sameQuestion(item.question,q,record.options.mixed));});
    if(!valid)throw new Error('Question snapshot does not match an owned saved revision');
   }
  }
  validateAnswerHistory(record,current);
  record.revision=(current?.revision??0)+1;
 }else{
  record=validateReviewEvent(op.payload);if(record.id!==op.entityId)throw new Error('Review ID mismatch');
  if(current){if(current.deletedAt)throw new Error('Review was deleted');if(JSON.stringify(current)!==JSON.stringify(record))throw new Error('Review is immutable');return {operationId:id,ok:true,record:current};}
  const pack=await readRecord<Pack>(db,owner,'pack',record.packId);if(!pack||!pack.questions.some(q=>q.id===record.questionId))throw new Error('Unknown review question');
  if(record.cardId!==`${record.packId}:${record.questionId}`)throw new Error('Invalid review card ID');
  const versions=await db.prepare('SELECT data FROM pack_versions WHERE owner_id=? AND id=?').bind(owner,record.packId).all<{data:string}>();
  if(!versions.results.some(row=>(JSON.parse(row.data) as Pack).questions.some(q=>q.id===record.questionId&&sameQuestion(record.question,q,true))))throw new Error('Review content does not match an owned saved question');
 }
 const result:MutationResult={operationId:id,ok:true,record};const nonce=uuid();const expected=current?.revision??0;
 const guard=kind==='review'?'NOT EXISTS (SELECT 1 FROM records WHERE owner_id=? AND kind=? AND id=?)':'COALESCE((SELECT revision FROM records WHERE owner_id=? AND kind=? AND id=?),0)=?';
 const guardArgs=kind==='review'?[owner,kind,op.entityId]:[owner,kind,op.entityId,expected];
 const statements=[
  db.prepare(`INSERT INTO operations(owner_id,id,nonce,result) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(owner_id,id) DO NOTHING`).bind(owner,id,nonce,JSON.stringify(result),...guardArgs),
  db.prepare('INSERT INTO records(owner_id,kind,id,revision,data) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?) ON CONFLICT(owner_id,kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data').bind(owner,kind,op.entityId,record.revision??0,JSON.stringify(record),owner,id,nonce)
 ];
 if(kind==='pack')statements.push(db.prepare('INSERT INTO pack_versions(owner_id,id,revision,data) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?) ON CONFLICT(owner_id,id,revision) DO NOTHING').bind(owner,op.entityId,record.revision,JSON.stringify(record),owner,id,nonce));
 await db.batch(statements);
 const saved=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,id).first<{result:string}>();
 if(saved)return JSON.parse(saved.result);
 return {operationId:id,ok:false,code:'CONFLICT',error:'Concurrent change',current:await readRecord<any>(db,owner,kind,op.entityId)??undefined};
 }catch(error){return {operationId:id,ok:false,code:'INVALID',error:error instanceof Error?error.message:'Invalid mutation'};}
}
async function publications(db:Database):Promise<{publications:Publication[]}>{const rows=await db.prepare('SELECT data FROM publications ORDER BY id').all<{data:string}>();return {publications:rows.results.map(r=>{const {pack,...summary}=JSON.parse(r.data);return summary;})};}
async function publish(db:Database,owner:string,args:any){
 const operationId=text(args.operationId,'operationId');
 const duplicate=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,operationId).first<{result:string}>();if(duplicate)return JSON.parse(duplicate.result).record;
 const pack=await readRecord<Pack>(db,owner,'pack',text(args.packId,'packId'));if(!pack||pack.deletedAt)throw new Error('Pack not found');if(pack.revision!==args.expectedRevision)throw new Error('Revision changed');
 const publication:Publication={id:`${owner}:${pack.id}`,title:pack.title,description:pack.description,questionCount:pack.questions.length,publishedAt:now(),pack:{title:pack.title,description:pack.description,tags:pack.tags,questions:pack.questions,artifacts:pack.artifacts}};
 const nonce=uuid();
 await db.batch([
  db.prepare("INSERT INTO operations(owner_id,id,nonce,result) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner_id=? AND kind='pack' AND id=? AND revision=?) ON CONFLICT(owner_id,id) DO NOTHING").bind(owner,operationId,nonce,JSON.stringify({operationId,ok:true,record:publication}),owner,pack.id,pack.revision),
  db.prepare('INSERT INTO publications(id,owner_id,source_id,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?) ON CONFLICT(owner_id,source_id) DO UPDATE SET data=excluded.data').bind(publication.id,owner,pack.id,JSON.stringify(publication),owner,operationId,nonce)
 ]);
 const result=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,operationId).first<{result:string}>();if(!result)throw new Error('Revision changed');return JSON.parse(result.result).record;
}
async function copyPublication(db:Database,owner:string,args:any){const publication=await db.prepare('SELECT data FROM publications WHERE id=?').bind(text(args.publicationId,'publicationId')).first<{data:string}>();if(!publication)throw new Error('Publication not found');const p=JSON.parse(publication.data) as Publication;const operationId=text(args.operationId,'operationId');const duplicate=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,operationId).first<{result:string}>();if(duplicate)return JSON.parse(duplicate.result).record;const pack={...p.pack,folder:'',questions:p.pack!.questions.map(q=>({...q,id:uuid()})),artifacts:p.pack!.artifacts.map(a=>({...a,id:uuid()}))};const result=await mutate(db,owner,{id:operationId,kind:'pack.put',entityId:uuid(),expectedRevision:0,payload:pack,createdAt:now()});if(!result.ok)throw new Error(result.error);return result.record;}
async function unpublish(db:Database,owner:string,id:string){await db.prepare('DELETE FROM publications WHERE id=? AND owner_id=?').bind(id,owner).run();return {ok:true};}
const stringSchema={type:'string'};
const questionSchema={type:'object',properties:{id:stringSchema,type:{type:'string',enum:['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK']},text:stringSchema,explanation:stringSchema,difficulty:{type:'string',enum:['Easy','Medium','Hard']},options:{type:'array',items:{type:'object',properties:{id:stringSchema,text:stringSchema},required:['id','text']}},correctOptionId:stringSchema,correctBoolean:{type:'boolean'},acceptedAnswers:{type:'array',items:stringSchema},hint:stringSchema,keyPoint:stringSchema,conceptName:stringSchema,conceptPriority:{type:'string',enum:['HIGH','MODERATE','FILLER']}},required:['id','type','text','explanation','difficulty']};
const packSchema={type:'object',properties:{title:stringSchema,description:stringSchema,folder:stringSchema,tags:{type:'array',items:stringSchema},questions:{type:'array',items:questionSchema},artifacts:{type:'array',items:{type:'object',additionalProperties:true}}},required:['title','questions']};
function tool(name:string,description:string,properties:Record<string,unknown>={},required:string[]=[],app=false,readOnly=false,ui=false){return {name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:/delete|unpublish/.test(name),idempotentHint:true},_meta:{ui:{visibility:app?['app']:['model','app'],...(ui?{resourceUri:'ui://noodl/workspace'}:{})}}};}
export const toolsList=[
 ...controlTools,...preferenceTools,...exportTools,
 tool('create_pack','Save finished study questions from the ChatGPT conversation. No AI calls or source uploads. Use unique question IDs and option IDs.',{operationId:stringSchema,pack:packSchema},['operationId','pack'],false,false,true),
 tool('update_pack','Replace a private pack at an expected revision.',{operationId:stringSchema,packId:stringSchema,expectedRevision:{type:'integer'},pack:packSchema},['operationId','packId','expectedRevision','pack']),
 tool('append_questions','Append new questions without changing existing content.',{operationId:stringSchema,packId:stringSchema,expectedRevision:{type:'integer'},questions:{type:'array',items:questionSchema}},['operationId','packId','expectedRevision','questions']),
 tool('list_packs','Search the signed-in user’s private study library with pagination.',{query:stringSchema,offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},[],false,true),
 tool('get_pack','Read one owned pack, including explanations and artifacts. Optional pagination applies to questions.',{packId:stringSchema,offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},['packId'],false,true),
 tool('open_pack','Open interactive Noodl learning workspace. With no arguments opens the library.',{packId:stringSchema},[],false,true,true),
 tool('get_progress','Read actual attempts and topic scores for one owned pack.',{packId:stringSchema},['packId'],false,true),
 tool('save_artifacts','Save material, insight, visualization HTML or comic JSON. For comics read get_comic_guide, clarify user style first and inspect the actual result before marking reviewed.',{operationId:stringSchema,packId:stringSchema,expectedRevision:{type:'integer'},artifacts:{type:'array',items:{type:'object',additionalProperties:true}}},['operationId','packId','expectedRevision','artifacts']),
 tool('delete_pack','Delete an owned pack. Historical attempt snapshots remain.',{operationId:stringSchema,packId:stringSchema,expectedRevision:{type:'integer'}},['operationId','packId','expectedRevision']),
 tool('publish_pack','Publish a content-only snapshot; excludes all progress and answers.',{operationId:stringSchema,packId:stringSchema,expectedRevision:{type:'integer'}},['operationId','packId','expectedRevision']),
 tool('browse_publications','Browse content-only shared packs.',{},[],false,true),
 tool('copy_publication','Copy a shared pack into a new private pack with fresh question IDs.',{publicationId:stringSchema,operationId:stringSchema},['publicationId','operationId']),
 tool('unpublish_pack','Remove one of your published snapshots.',{publicationId:stringSchema},['publicationId']),
 tool('app_identity','Authenticated user.',{},[],true,true),tool('app_snapshot','Account snapshot.',{},[],true,true),
 tool('app_mutate','Synchronize pending offline changes.',{operations:{type:'array',items:{type:'object',additionalProperties:true}}},['operations'],true),
 tool('app_publications','Publication list.',{},[],true,true),tool('app_publish','Publish content.',{packId:stringSchema,expectedRevision:{type:'integer'},operationId:stringSchema},['packId','expectedRevision','operationId'],true),
 tool('app_unpublish','Unpublish content.',{publicationId:stringSchema},['publicationId'],true),tool('app_copy_publication','Copy content.',{publicationId:stringSchema,operationId:stringSchema},['publicationId','operationId'],true)
];
async function callTool(db:Database,user:User,name:string,args:any,origin:string){
 const control=await callControlTool(db,user,name,args,{read:readRecord,snapshot,mutate});if(control!==undefined)return control;
 const preference=await callPreferenceTool(db,user.id,name,args);if(preference!==undefined)return preference;
 const exported=await callExportTool(db,user.id,name,args,origin);if(exported!==undefined)return exported;
 if(['create_pack','update_pack','append_questions','save_artifacts','delete_pack','copy_publication','publish_pack','app_copy_publication','app_publish'].includes(name)&&args.operationId){const duplicate=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(user.id,text(args.operationId,'operationId')).first<{result:string}>();if(duplicate)return JSON.parse(duplicate.result).record;}
 if(name==='app_identity')return user;
 if(name==='app_snapshot')return snapshot(db,user.id);
 if(name==='app_mutate')return mutateBatch(db,user.id,args);
 if(name==='app_publications'||name==='browse_publications')return publications(db);
 if(name==='app_publish'||name==='publish_pack')return publish(db,user.id,args);
 if(name==='app_unpublish'||name==='unpublish_pack')return unpublish(db,user.id,text(args.publicationId,'publicationId'));
 if(name==='app_copy_publication'||name==='copy_publication')return copyPublication(db,user.id,args);
 if(name==='list_packs'){const s=await snapshot(db,user.id);const query=String(args.query??'').toLowerCase(),offset=args.offset??0,limit=args.limit??50;if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid pagination');const packs=s.packs.filter(p=>!p.deletedAt&&`${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(query)).map(({questions,artifacts,...p})=>({...p,questionCount:questions.length}));return {packs:packs.slice(offset,offset+limit),offset,limit,total:packs.length,nextOffset:offset+limit<packs.length?offset+limit:null};}
 if(name==='open_pack'&&!args.packId)return {view:'library',user};
 if(name==='create_pack'){const result=await mutate(db,user.id,{id:text(args.operationId,'operationId'),kind:'pack.put',entityId:uuid(),expectedRevision:0,payload:args.pack,createdAt:now()});if(!result.ok)throw new Error(result.error);return result.record;}
 const pack=await readRecord<Pack>(db,user.id,'pack',text(args.packId,'packId'));if(!pack||pack.deletedAt)throw new Error('Pack not found');
 if(name==='get_pack'){if(args.offset===undefined&&args.limit===undefined)return pack;const offset=args.offset??0,limit=args.limit??50;if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid pagination');return {...pack,questions:pack.questions.slice(offset,offset+limit),questionPage:{offset,limit,total:pack.questions.length,nextOffset:offset+limit<pack.questions.length?offset+limit:null}};}
 if(name==='open_pack')return {view:'pack',packId:pack.id,pack};
 if(name==='get_progress'){const s=await snapshot(db,user.id);return {packId:pack.id,attempts:s.attempts.filter(a=>a.packId===pack.id&&!('deletedAt' in a)).map(a=>({id:a.id,status:a.status,createdAt:a.createdAt,...progressFor(a)}))};}
 let payload:any=pack;let kind:Operation['kind']='pack.put';
 if(name==='update_pack')payload=args.pack;
 else if(name==='append_questions')payload={...pack,questions:[...pack.questions,...args.questions.map(validateQuestion)]};
 else if(name==='save_artifacts'){const artifacts=args.artifacts.map(validateArtifact);const map=new Map(pack.artifacts.map(a=>[a.id,a]));for(const a of artifacts)map.set(a.id,a);payload={...pack,artifacts:[...map.values()]};}
 else if(name==='delete_pack')kind='pack.delete';
 else throw new Error('Unknown tool');
 const result=await mutate(db,user.id,{id:text(args.operationId,'operationId'),kind,entityId:pack.id,expectedRevision:args.expectedRevision,payload,createdAt:now()});if(!result.ok)throw new Error(`${result.code}: ${result.error}`);return result.record;
}
async function mutateBatch(db:Database,owner:string,args:any){if(!Array.isArray(args.operations)||args.operations.length>50)throw new Error('Expected at most 50 operations');const results=[];for(const op of args.operations)results.push(await mutate(db,owner,op));return {results};}
function validateArguments(schema:any,value:any,label='arguments',depth=0):void{
 if(depth>20)throw new Error('Arguments nested too deeply');
 if(schema.anyOf){if(!schema.anyOf.some((candidate:any)=>{try{validateArguments(candidate,value,label,depth+1);return true}catch{return false}}))throw new Error(`Invalid ${label}`);return;}
 if(schema.enum&&!schema.enum.includes(value))throw new Error(`Invalid ${label}`);
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} must be an object`);
  for(const key of schema.required??[])if(value[key]===undefined)throw new Error(`${label}.${key} is required`);
  for(const [key,entry]of Object.entries(value)){if(schema.properties?.[key])validateArguments(schema.properties[key],entry,`${label}.${key}`,depth+1);else if(schema.additionalProperties===false)throw new Error(`Unknown ${label}.${key}`);}
 }else if(schema.type==='array'){
  if(!Array.isArray(value)||value.length>10000)throw new Error(`Invalid ${label}`);
  if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems)throw new Error(`Invalid ${label} length`);
  for(const entry of value)if(schema.items)validateArguments(schema.items,entry,label,depth+1);
 }else if(schema.type==='string'){if(typeof value!=='string'||value.length>2_000_000)throw new Error(`Invalid ${label}`);}
 else if(schema.type==='boolean'){if(typeof value!=='boolean')throw new Error(`Invalid ${label}`);}
 else if(schema.type==='integer'||schema.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||(schema.type==='integer'&&!Number.isSafeInteger(value))||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum))throw new Error(`Invalid ${label}`);}
}
async function body(req:Request){const value=await req.text();if(value.length>8_000_000)throw new Error('Request exceeds 8 MB');return JSON.parse(value);}
export async function handleRequest(request:Request,env:Env,_ctx:unknown,assets:Assets={}):Promise<Response|null>{
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/')&&url.pathname!=='/mcp')return null;
 try{
  if(url.pathname==='/api/health'&&request.method==='GET'){if(!env.DB)return json({ok:false,database:'missing'},503);await env.DB.prepare('SELECT id FROM records LIMIT 0').all();await env.DB.prepare('SELECT id FROM pack_versions LIMIT 0').all();return json({ok:true,database:'ready'});}
  if(request.method==='GET'&&url.pathname==='/api/public/catalog')return json(await publications(env.DB));
  const publicMatch=url.pathname.match(/^\/api\/public\/catalog\/([^/]+)$/);
  if(request.method==='GET'&&publicMatch){const row=await env.DB.prepare('SELECT data FROM publications WHERE id=?').bind(decodeURIComponent(publicMatch[1])).first<{data:string}>();return row?json(JSON.parse(row.data)):json({error:'Publication not found'},404);}
  if(['POST','PATCH','PUT','DELETE'].includes(request.method)&&url.pathname!=='/mcp'){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Invalid request origin'},403);}
  if(!env.DB)return json({error:'Database binding unavailable'},503);
  if(url.pathname==='/api/guest'&&request.method==='POST')return startGuestSession(request);
  // Embedded/MCP calls continue to require the hosting identity. A guest browser
  // opts into its separate workspace explicitly, even when ChatGPT is signed in.
  const guestOwner=url.pathname==='/mcp'?null:request.headers.get('x-noodl-guest');
  const user=guestOwner?await guestIdentity(request):identity(request);
  if(!user||(guestOwner&&guestOwner!==user.id))throw new AccessError();
  if(url.pathname==='/api/storage'&&request.method==='GET')return json({configured:storageConfigured(env)});
  if(url.pathname==='/api/storage/banks'){
   if(request.method==='GET')return json(await bankBackup(env,user.id,'GET'));
   if(request.method==='PUT'){
    if(!storageConfigured(env))return json({error:'Supabase Storage belum dikonfigurasi.'},503);
    const rows=await env.DB.prepare("SELECT data FROM records WHERE owner_id=? AND kind='pack' AND json_extract(data,'$.deletedAt') IS NULL LIMIT 1001").bind(user.id).all<{data:string}>();
    if(rows.results.length>1000)throw Object.assign(new Error('Cadangan mendukung hingga 1000 bank.'),{status:413});
    let size=0;
    const banks=rows.results.map(row=>{
     size+=row.data.length;
     if(size>8*1024*1024)throw Object.assign(new Error('Cadangan melebihi batas 8 MB.'),{status:413});
     return validatePackInput(JSON.parse(row.data));
    });
    return json(await bankBackup(env,user.id,'PUT',banks));
   }
  }
  const exportResponse=await handleExportRequest(request,env.DB,user.id);if(exportResponse)return exportResponse;
  if(url.pathname==='/api/preferences'){if(request.method==='GET')return json(await getPreferences(env.DB,user.id));if(request.method==='PATCH')return json(await updatePreferences(env.DB,user.id,await body(request)));}
  if(url.pathname==='/mcp'){
   if(request.method==='GET')return new Response(null,{status:405,headers:{allow:'POST'}});
   if(request.method!=='POST')return new Response(null,{status:405});
   const rpc=await body(request);if(rpc.id===undefined)return new Response(null,{status:202});
   try{
    let result:any;
    if(rpc.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{},resources:{}}};
    else if(rpc.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{}},serverInfo:{name:'noodl',version:'1.0.0'}};
    else if(rpc.method==='ping')result={};
    else if(rpc.method==='tools/list')result={tools:toolsList};
    else if(rpc.method==='resources/list')result={resources:[{uri:'ui://noodl/workspace',name:'Noodl Workspace',mimeType:'text/html;profile=mcp-app'}]};
    else if(rpc.method==='resources/read'){
     if(rpc.params?.uri!=='ui://noodl/workspace')throw new Error('Unknown resource');
     const html=assets['/index.html']?.body??'<!doctype html><html><body>Application assets are unavailable.</body></html>';
     const rendered=html.replace('<head>',`<head><base href="${url.origin}/"><script>window.__NOODL_EMBEDDED__=true;</script>`).replaceAll('src="/','src="'+url.origin+'/').replaceAll('href="/','href="'+url.origin+'/');
     result={contents:[{uri:'ui://noodl/workspace',mimeType:'text/html;profile=mcp-app',text:rendered,_meta:{ui:{csp:{connectDomains:[url.origin],resourceDomains:[url.origin],frameDomains:[url.origin]}},'openai/ui':{preferredDisplayMode:'fullscreen',availableDisplayModes:['inline','fullscreen']}}}]};
    }else if(rpc.method==='tools/call'){
     const def=toolsList.find(t=>t.name===rpc.params?.name);if(!def)throw new Error('Unknown tool');
     try{validateArguments(def.inputSchema,rpc.params.arguments??{});const data=await callTool(env.DB,user,def.name,rpc.params.arguments??{},url.origin);result={content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};}catch(e){result={isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Tool failed'}]};}
    }else return json({jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Method not found'}});
    return json({jsonrpc:'2.0',id:rpc.id,result});
   }catch(e){return json({jsonrpc:'2.0',id:rpc.id,error:{code:-32602,message:e instanceof Error?e.message:'Invalid request'}});}
  }
  if(url.pathname==='/api/me'&&request.method==='GET')return json(user);
  if(url.pathname==='/api/snapshot'&&request.method==='GET')return json(await snapshot(env.DB,user.id));
  if(url.pathname==='/api/mutate'&&request.method==='POST')return json(await mutateBatch(env.DB,user.id,await body(request)));
  if(url.pathname==='/api/publications'){
   if(request.method==='GET')return json(await publications(env.DB));
   if(request.method==='POST')return json(await publish(env.DB,user.id,await body(request)));
  }
  const match=url.pathname.match(/^\/api\/publications\/([^/]+)(\/copy)?$/);
  if(match){const id=decodeURIComponent(match[1]);if(match[2]&&request.method==='POST')return json(await copyPublication(env.DB,user.id,{...await body(request),publicationId:id}));if(!match[2]&&request.method==='DELETE')return json(await unpublish(env.DB,user.id,id));}
  return json({error:'Not found'},404);
 }catch(e){return json({error:e instanceof Error?e.message:'Request failed'},e instanceof AccessError?401:(e as any)?.status??400);}
}
