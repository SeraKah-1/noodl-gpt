import {firstProbe,singleQuestion,diagnosticQuestion, diagnosticAttempt} from '../shared/practice';
import {batchView} from '../shared/batch';
import {comicGuide} from '../shared/comic';
import {createStudyContext} from '../shared/studyContext';
import {preparePackChange,commitPackChange} from './packWorkflow';
import type {Database} from './index';
import type {Attempt,Pack,ReviewEvent,Operation,MutationResult,Snapshot,User} from '../shared/types';
import {editBatch,submitBatch,createAttempt,answerAttempt,advanceAttempt,finishAttempt,progressFor,sessionProgress,replayReviews} from '../shared/engine';
import {validateQuestion,validateArtifact,validateStudyOptions} from '../shared/validation';
const s={type:'string'};const revision={type:'integer',minimum:0};
const pageProps={offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}};
const writeProps={operationId:s,expectedRevision:revision};
const questionSchema={type:'object',properties:{id:s,type:{type:'string',enum:['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK']},text:s,options:{type:'array',items:{type:'object',properties:{id:s,text:s},required:['id','text'],additionalProperties:false}},correctOptionId:s,correctBoolean:{type:'boolean'},acceptedAnswers:{type:'array',items:s},explanation:s,hint:s,keyPoint:s,difficulty:{type:'string',enum:['Easy','Medium','Hard']},conceptName:s,conceptPriority:{type:'string',enum:['HIGH','MODERATE','FILLER']}},required:['id','type','text','explanation','difficulty'],additionalProperties:false};
const preparedQuestionSchema={...questionSchema,required:['type','text','explanation','difficulty'],properties:{
 ...questionSchema.properties,correctOptionIndex:{type:'integer',minimum:0,maximum:11},
 options:{type:'array',minItems:2,maxItems:12,items:{type:'object',properties:{id:s,text:s},required:['text'],additionalProperties:false}}
}};
const artifactSchema={type:'object',properties:{id:s,kind:{type:'string',enum:['material','insight','visualization','comic']},title:s,content:s,explanation:s,interactionGuide:s},required:['id','kind','title','content'],additionalProperties:false};
function tool(name:string,description:string,properties:Record<string,unknown>={},required:string[]=[],readOnly=false,ui=false){return {name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:/^(delete_|reset_|update_)|^(set_pack_metadata|advance_attempt|finish_attempt|submit_batch)$/.test(name),openWorldHint:false,idempotentHint:true},_meta:{ui:{visibility:['model','app'],...(ui?{resourceUri:'ui://noodl/workspace'}:{})}}};}
export const controlTools=[
 tool('get_comic_guide','Read the learning-comic JSON schema and required clarify → design → inspect → correct workflow. Ask the user about objectives and style before designing. Accuracy and user style take priority over aesthetics.',{},[],true),
 tool('open_knowledge_debugger','Open the Indonesian gastric acid diagram correction pilot. One relationship is intentionally incorrect. The panel provides the verified diagram and source after a response.',{},[],true,true),
 tool('open_autopilot','Open hands-free flashcards for an owned bank in the panel. Timed exposures do not grade answers or rate cards.',{packId:s},['packId'],true,true),
 tool('start_concept_probe','Start a one-question check, reserving a different unanswered question on the same tagged concept in the bank. Use batch draft and submission tools. After a miss offer start_diagnostic.',{packId:s,operationId:s},['packId','operationId'],false,true),
 tool('start_diagnostic','Offer one different, unanswered question on a missed concept from a completed session. Use update_batch_draft and submit_batch to answer. Report the two observed responses together.',{attemptId:s,operationId:s},['attemptId','operationId'],false,true),
 tool('get_capabilities','Discover all supported Noodl operations, schemas, design controls, input/output formats and limits.',{},[],true),
 tool('get_study_context','Read compact owned bank, active attempt, due review, observed gaps and next-action evidence without fetching all questions or answer keys.',{packId:s,limit:{type:'integer',minimum:1,maximum:20}},[],true),
 tool('get_operation_receipt','Check whether a server-side operation ID was committed. A missing ID may still be queued offline.',{operationId:s},['operationId'],true),
 tool('prepare_pack_change','Validate and preview a new bank or appended questions WITHOUT saving bank content. Supply operationId, mode=create or append, and 1..100 questions; question and option IDs may be omitted. For MCQ set correctOptionIndex as a zero-based index instead of correctOptionId when option IDs are omitted. Commit only after review.',{operationId:s,mode:{type:'string',enum:['create','append']},packId:s,expectedRevision:revision,title:s,description:s,folder:s,tags:{type:'array',items:s},questions:{type:'array',minItems:1,maxItems:100,items:preparedQuestionSchema}},['operationId','mode','questions']),
 tool('commit_pack_change','Atomically commit a previously prepared, owner-scoped change after approval. Requires a fresh commit operationId distinct from prepareId; returns saved IDs and revision, or a safe conflict.',{prepareId:s,operationId:s},['prepareId','operationId']),
 tool('get_workspace','Read a paginated account workspace overview. Private records are limited to the authenticated user.',pageProps,[],true),
 tool('search_workspace','Search owned banks, individual questions, material, insights and visualizations by text.',{query:s,kind:{type:'string',enum:['all','pack','question','artifact']},...pageProps},['query'],true),
 tool('get_question','Read one question including its answer, explanation and current bank revision.',{packId:s,questionId:s},['packId','questionId'],true),
 tool('create_question','Append one validated question. Supply stable unique question/option IDs.',{packId:s,question:questionSchema,...writeProps},['packId','question','operationId','expectedRevision']),
 tool('update_question','Replace a question without changing its ID. Existing attempt snapshots remain unchanged.',{packId:s,questionId:s,question:questionSchema,...writeProps},['packId','questionId','question','operationId','expectedRevision']),
 tool('delete_question','Delete a question from its bank. Delete the bank instead when only one question remains.',{packId:s,questionId:s,...writeProps},['packId','questionId','operationId','expectedRevision']),
 tool('get_artifact','Read one saved material/insight/visualization/comic artifact, including its review record.',{packId:s,artifactId:s},['packId','artifactId'],true),
 tool('create_artifact','Create material, insight, self-contained HTML visualization or a comic. For comics, read get_comic_guide; clarify with the user before design and inspect the actual result before marking reviewed.',{packId:s,artifact:artifactSchema,...writeProps},['packId','artifact','operationId','expectedRevision']),
 tool('update_artifact','Replace an existing artifact while retaining its ID. Recheck changed comic facts, text and visuals; keep draft until review completes.',{packId:s,artifactId:s,artifact:artifactSchema,...writeProps},['packId','artifactId','artifact','operationId','expectedRevision']),
 tool('delete_artifact','Delete one artifact from an owned bank.',{packId:s,artifactId:s,...writeProps},['packId','artifactId','operationId','expectedRevision']),
 tool('set_pack_metadata','Change title, description, folder and tags without replacing questions.',{packId:s,title:s,description:s,folder:s,tags:{type:'array',items:s},...writeProps},['packId','operationId','expectedRevision']),
 tool('duplicate_pack','Create a new private bank from an owned bank. Content receives fresh IDs and no learner history is copied.',{packId:s,title:s,operationId:s},['packId','operationId']),
 tool('list_attempts','List owned learning sessions, optionally by bank/status, with actual scores.',{packId:s,status:{type:'string',enum:['active','completed']},...pageProps},[],true),
 tool('get_attempt','Read an immutable session snapshot, recorded answers and score.',{attemptId:s},['attemptId'],true),
 tool('start_attempt','Start a persisted study session. Options: mode STANDARD/SURVIVAL/TIME_RUSH/BATCH. For BATCH choose batchSize 1..100, retention false. Shuffle and mixed are optional choices within a complete options object.',{packId:s,options:{type:'object',properties:{mode:{type:'string',enum:['STANDARD','SURVIVAL','TIME_RUSH','BATCH']},batchSize:{type:'integer',minimum:1,maximum:100},shuffle:{type:'boolean'},retention:{type:'boolean'},mixed:{type:'boolean'}},required:['mode','shuffle','retention','mixed'],additionalProperties:false},operationId:s},['packId','operationId'],false,true),
 tool('update_batch_draft','Set or revise one or more numbered answers in an active Batch Quiz. Map spoken numbers and letters against the displayed session. Use letter for multiple choice or value for a boolean/text. Clarify ambiguous entries. Save clear answers without submitting.',{attemptId:s,...writeProps,changes:{type:'array',minItems:1,maxItems:100,items:{type:'object',additionalProperties:false,properties:{number:{type:'integer',minimum:1},letter:s,value:{anyOf:[s,{type:'boolean'}]}},required:['number']}}},['attemptId','operationId','expectedRevision','changes']),
 tool('submit_batch','Collect and grade all answers together only when the learner asks to submit.',{attemptId:s,...writeProps},['attemptId','operationId','expectedRevision'],false,true),
 tool('answer_attempt','Submit an answer to the current occurrence. Use option ID, boolean, or text by question type. Server evaluates correctness.',{attemptId:s,value:{anyOf:[s,{type:'boolean'}]},...writeProps},['attemptId','value','operationId','expectedRevision'],false,true),
 tool('advance_attempt','Move to the next question after answering. Last question completes the session.',{attemptId:s,...writeProps},['attemptId','operationId','expectedRevision'],false,true),
 tool('finish_attempt','Finish an active session and preserve its final immutable results.',{attemptId:s,...writeProps},['attemptId','operationId','expectedRevision'],false,true),
 tool('delete_attempt','Delete an owned session from history using a tombstone. Offline sync cannot resurrect it.',{attemptId:s,...writeProps},['attemptId','operationId','expectedRevision']),
 tool('open_attempt','Open an owned session in the interactive UI.',{attemptId:s},['attemptId'],true,true),
 tool('open_view','Open a workspace page in the interactive UI.',{view:{type:'string',enum:['home','library','mix','review','public','settings']}},['view'],true,true),
 tool('list_srs','Read scheduled cards and immutable review events, optionally due now or for one bank.',{packId:s,dueOnly:{type:'boolean'},...pageProps},[],true),
 tool('review_card','Record one SRS rating (0 forgot, 1 difficult, 2 good, 3 easy) for an owned question.',{packId:s,questionId:s,rating:{type:'integer',minimum:0,maximum:3},operationId:s},['packId','questionId','rating','operationId']),
 tool('delete_review','Delete one owned review event with a persistent tombstone.',{reviewId:s,operationId:s},['reviewId','operationId']),
 tool('reset_srs','Reset SRS history for a bank or one card. No matching events are deleted outside the authenticated account.',{packId:s,questionId:s,operationId:s},['packId','operationId'])
];
interface Dependencies {read:<T>(db:Database,owner:string,kind:string,id:string)=>Promise<T|null>;snapshot:(db:Database,owner:string)=>Promise<Snapshot>;mutate:(db:Database,owner:string,op:Operation)=>Promise<MutationResult>}
const text=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error(`Invalid ${label}`);return value;};
function page<T>(items:T[],args:any){const offset=args.offset??0,limit=args.limit??50;if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Pagination requires offset >= 0 and limit 1..100');return {items:items.slice(offset,offset+limit),offset,limit,total:items.length,nextOffset:offset+limit<items.length?offset+limit:null};}
async function duplicateResult(db:Database,owner:string,id:unknown){const operationId=text(id,'operationId');const row=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,operationId).first<{result:string}>();return row?JSON.parse(row.result):null;}
async function tombstone(db:Database,owner:string,kind:'attempt'|'review',id:string,operationId:string,expectedRevision?:number){const duplicate=await duplicateResult(db,owner,operationId);if(duplicate)return duplicate.record;const row=await db.prepare('SELECT data,revision FROM records WHERE owner_id=? AND kind=? AND id=?').bind(owner,kind,id).first<{data:string;revision:number}>();if(!row)throw new Error('Record not found');const current=JSON.parse(row.data);if(expectedRevision!==undefined&&expectedRevision!==row.revision)throw new Error('CONFLICT: Revision changed');const record={...current,deletedAt:new Date().toISOString(),revision:row.revision+1};const nonce=crypto.randomUUID();const result={operationId,ok:true,record};await db.batch([
 db.prepare('INSERT INTO operations(owner_id,id,nonce,result) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner_id=? AND kind=? AND id=? AND revision=?) ON CONFLICT(owner_id,id) DO NOTHING').bind(owner,operationId,nonce,JSON.stringify(result),owner,kind,id,row.revision),
 db.prepare('UPDATE records SET data=?,revision=? WHERE owner_id=? AND kind=? AND id=? AND EXISTS(SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?)').bind(JSON.stringify(record),record.revision,owner,kind,id,owner,operationId,nonce)
]);const saved=await duplicateResult(db,owner,operationId);if(!saved)throw new Error('CONFLICT: Concurrent change');return saved.record;}
const active=(record:any)=>!!record&&!record.deletedAt;
export async function callControlTool(db:Database,user:User,name:string,args:any,deps:Dependencies):Promise<any>{
 if(!controlTools.some(t=>t.name===name))return undefined;
 const owner=user.id,now=()=>new Date().toISOString();
 const getPack=async()=>{const p=await deps.read<Pack>(db,owner,'pack',text(args.packId,'packId'));if(!active(p))throw new Error('Pack not found');return p!;};
 const getAttempt=async()=>{const a=await deps.read<Attempt>(db,owner,'attempt',text(args.attemptId,'attemptId'));if(!active(a))throw new Error('Attempt not found');return a!;};
 const save=async(kind:Operation['kind'],entityId:string,payload:unknown,expectedRevision:number)=>{const result=await deps.mutate(db,owner,{id:text(args.operationId,'operationId'),kind,entityId,payload,expectedRevision,createdAt:now()});if(!result.ok)throw new Error(`${result.code}: ${result.error}`);return result.record;};
 if(!['prepare_pack_change','commit_pack_change'].includes(name)&&controlTools.find(t=>t.name===name)?.annotations.readOnlyHint===false){const duplicate=await duplicateResult(db,owner,args.operationId);if(duplicate){const record=duplicate.record;return record?.options?.mode==='BATCH' && record.status==='active'?batchView(record):record;}}
 if(name==='prepare_pack_change')return preparePackChange(db,owner,args,deps);
 if(name==='commit_pack_change')return commitPackChange(db,owner,args,deps);
 if(name==='get_operation_receipt'){
  const operationId=text(args.operationId,'operationId');
  const result=await duplicateResult(db,owner,operationId);
  if(!result)return {operationId,status:'not_found',note:'Not in this account server ledger. A client may still have an offline queued write.'};
  const record=result.record;
  return {operationId,status:result.ok?'committed':'rejected',
   recordId:typeof record?.id==='string'?record.id:null,
   revision:Number.isSafeInteger(record?.revision)?record.revision:null,
   code:result.code??null};
 }
 if(name==='get_study_context'){
  const snapshot=await deps.snapshot(db,owner);
  return createStudyContext(snapshot,{packId:args.packId,limit:args.limit});
 }
 if(name==='get_comic_guide')return comicGuide;
 if(name==='get_capabilities')return {version:'2.4.0',workflow:{context:'get_study_context',receipt:'get_operation_receipt',prepare:'prepare_pack_change',commit:'commit_pack_change'},practice:{probe:'start_concept_probe',debugger:'open_knowledge_debugger',autopilot:'open_autopilot',diagnostic:'start_diagnostic'},batch:{mode:'BATCH',draft:'update_batch_draft',submit:'submit_batch',maximum:100},brainDump:{start:'start_brain_dump',resume:'get_brain_dump',source:'PPT attached in ChatGPT'},scope:'Authenticated user-owned workspace',comics:{guide:'get_comic_guide',clarificationRequired:true,reviewIsSelfReported:true},input:{questionTypes:['MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK'],artifactKinds:['material','insight','visualization','comic'],sourceFiles:false,structuredContent:true},output:{formats:['json','csv','html','pdf'],interactiveUI:true},design:{tool:'get_design',update:'update_design'},pagination:{default:50,maximum:100},notes:['All writes require operationId; versioned updates require expectedRevision.','Banks require at least one question.','Completed sessions and review events are immutable; use delete/reset tools to remove history.','Design/preferences apply only to the signed-in account.']};
 if(name==='open_knowledge_debugger')return {view:'gastric-debugger'};
 if(name==='open_autopilot'){const pack=await getPack();return {view:'autopilot',packId:pack.id};}
 if(name==='start_diagnostic'){
  const source=await getAttempt(),snapshot=await deps.snapshot(db,owner);
  const attempts=snapshot.attempts.filter(active);
  const existing=attempts.find(a=>a.diagnostic?.attemptId===source.id);
  if(existing)return existing.status==='active'?batchView(existing):{attemptId:existing.id,originalCorrect:false,followupCorrect:existing.answers[0]?.isCorrect??null};
  const choice=diagnosticQuestion(source,snapshot.packs,attempts);
  if(!choice)return {available:false,reason:'No unanswered question for an explicitly missed concept.'};
  const next=await diagnosticAttempt(source,choice);
  const saved=await save('attempt.put',next.id,next,0) as Attempt;
  return batchView(saved);
 }
 if(name==='open_view'){if(!['home','library','mix','review','public','settings'].includes(args.view))throw new Error('Invalid view');return {view:args.view};}
 if(name==='get_workspace'){const snapshot=await deps.snapshot(db,owner);return {user,packs:page(snapshot.packs.filter(active).map(({questions,artifacts,...p})=>({...p,questionCount:questions.length,artifactCount:artifacts.length})),args),counts:{packs:snapshot.packs.filter(active).length,attempts:snapshot.attempts.filter(active).length,reviews:snapshot.reviews.filter(active).length},cursor:snapshot.cursor};}
 if(name==='search_workspace'){const query=typeof args.query==='string'?args.query.toLocaleLowerCase().trim():'';if(!query||query.length>1000)throw new Error('Query must contain 1..1000 characters');if(args.kind&&!['all','pack','question','artifact'].includes(args.kind))throw new Error('Invalid search kind');const snapshot=await deps.snapshot(db,owner);const results:any[]=[];for(const p of snapshot.packs.filter(active)){if((!args.kind||['all','pack'].includes(args.kind))&&`${p.title} ${p.description} ${p.folder} ${p.tags.join(' ')}`.toLocaleLowerCase().includes(query))results.push({kind:'pack',packId:p.id,title:p.title,revision:p.revision});if(!args.kind||['all','question'].includes(args.kind))for(const q of p.questions)if(JSON.stringify(q).toLocaleLowerCase().includes(query))results.push({kind:'question',packId:p.id,questionId:q.id,text:q.text,concept:q.conceptName,revision:p.revision});if(!args.kind||['all','artifact'].includes(args.kind))for(const a of p.artifacts)if(JSON.stringify(a).toLocaleLowerCase().includes(query))results.push({kind:'artifact',packId:p.id,artifactId:a.id,title:a.title,artifactKind:a.kind,revision:p.revision});}return page(results,args);}
 if(['list_attempts','list_srs'].includes(name)){const snapshot=await deps.snapshot(db,owner);if(name==='list_attempts')return page(snapshot.attempts.filter(active).filter(a=>(!args.packId||a.packId===args.packId)&&(!args.status||a.status===args.status)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(a=>({id:a.id,packId:a.packId,title:a.title,status:a.status,revision:a.revision,createdAt:a.createdAt,updatedAt:a.updatedAt,...sessionProgress(a)})),args);const events=snapshot.reviews.filter(active).filter(e=>!args.packId||e.packId===args.packId);const cards=replayReviews(events).filter(c=>!args.dueOnly||Date.parse(c.nextReview)<=Date.now());return {cards:page(cards,args),reviews:page(events,args)};}
 if(name==='get_attempt'||name==='open_attempt'){const attempt=await getAttempt();if(attempt.options.mode==='BATCH'&&attempt.status==='active')return {...batchView(attempt),view:'attempt'};return name==='open_attempt'?{view:'attempt',attemptId:attempt.id,attempt}:{attempt,progress:progressFor(attempt)};}
 if(name==='delete_attempt')return tombstone(db,owner,'attempt',text(args.attemptId,'attemptId'),text(args.operationId,'operationId'),args.expectedRevision);
 if(name==='delete_review')return tombstone(db,owner,'review',text(args.reviewId,'reviewId'),text(args.operationId,'operationId'));
 if(name==='reset_srs'){
  const p=await getPack();if(args.questionId&&!p.questions.some(q=>q.id===args.questionId))throw new Error('Question not found');const snapshot=await deps.snapshot(db,owner);const events=snapshot.reviews.filter(active).filter(e=>e.packId===p.id&&(!args.questionId||e.questionId===args.questionId));
  const operationId=text(args.operationId,'operationId');const nonce=crypto.randomUUID(),deletedAt=now();const result={operationId,ok:true,record:{packId:p.id,questionId:args.questionId??null,deletedCount:events.length}};
  const statements=[db.prepare('INSERT INTO operations(owner_id,id,nonce,result) VALUES(?,?,?,?) ON CONFLICT(owner_id,id) DO NOTHING').bind(owner,operationId,nonce,JSON.stringify(result))];
  for(const event of events)statements.push(db.prepare('UPDATE records SET data=? WHERE owner_id=? AND kind=\'review\' AND id=? AND EXISTS(SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?)').bind(JSON.stringify({...event,deletedAt}),owner,event.id,owner,operationId,nonce));
  await db.batch(statements);return (await duplicateResult(db,owner,operationId)).record;
 }
 if(name==='update_batch_draft'||name==='submit_batch'){
  const attempt=await getAttempt();
  if(attempt.revision!==args.expectedRevision)throw new Error('CONFLICT: Revision changed');
  const draft={...attempt.draft};
  for(const change of args.changes??[]){
    const item=attempt.items[change.number-1];
    if(!item)throw new Error('Unknown question number');
    if(item.question.type==='MULTIPLE_CHOICE'){
      if(typeof change.letter!=='string'||!/^[a-l]$/i.test(change.letter)||change.value!==undefined)throw new Error('Supply one displayed option letter');
      const option=item.question.options?.[change.letter.toUpperCase().charCodeAt(0)-65];
      if(!option)throw new Error('Option not available');
      draft[item.id]=option.id;
    }else{
      if(change.letter!==undefined||change.value===undefined)throw new Error('Supply the boolean or text answer');
      draft[item.id]=change.value;
    }
  }
  const next=name==='submit_batch'?submitBatch(attempt):editBatch(attempt,draft);
  const saved=await save('attempt.put',attempt.id,next,args.expectedRevision) as Attempt;
  return saved.status==='active'?batchView(saved):saved;
 }
 if(['answer_attempt','advance_attempt','finish_attempt'].includes(name)){const a=await getAttempt();let next:Attempt;if(name==='answer_attempt'){if(typeof args.value!=='string'&&typeof args.value!=='boolean')throw new Error('Invalid answer value');next=answerAttempt(a,args.value);}else next=name==='advance_attempt'?advanceAttempt(a):finishAttempt(a);return save('attempt.put',a.id,next,args.expectedRevision);}
 const pack=await getPack();
 if(name==='start_concept_probe'){
  const history=(await deps.snapshot(db,owner)).attempts.filter(active);
  const question=firstProbe(pack,history);
  if(!question)return {available:false,reason:'Two distinct unanswered questions with the same concept are required.'};
  const next=singleQuestion(pack,question);
  return batchView(await save('attempt.put',next.id,next,0) as Attempt);
 }
 if(name==='get_question'){const question=pack.questions.find(q=>q.id===args.questionId);if(!question)throw new Error('Question not found');return {packId:pack.id,revision:pack.revision,question};}
 if(name==='get_artifact'){const artifact=pack.artifacts.find(a=>a.id===args.artifactId);if(!artifact)throw new Error('Artifact not found');return {packId:pack.id,revision:pack.revision,artifact};}
 if(name==='duplicate_pack'){const cloned={...pack,title:args.title===undefined?`${pack.title} (copy)`:text(args.title,'title'),questions:pack.questions.map(q=>({...q,id:crypto.randomUUID()})),artifacts:pack.artifacts.map(a=>({...a,id:crypto.randomUUID()}))};return save('pack.put',crypto.randomUUID(),cloned,0);}
 if(name==='start_attempt'){const options=args.options??{mode:'STANDARD',shuffle:true,retention:false,mixed:false};validateStudyOptions(options);const attempt=createAttempt(pack,options,owner);const saved=await save('attempt.put',attempt.id,attempt,0) as Attempt;return options.mode==='BATCH'?batchView(saved):saved;}
 if(name==='review_card'){const q=pack.questions.find(q=>q.id===args.questionId);if(!q)throw new Error('Question not found');if(!Number.isSafeInteger(args.rating)||args.rating<0||args.rating>3)throw new Error('Rating must be 0..3');const event:ReviewEvent={id:crypto.randomUUID(),cardId:`${pack.id}:${q.id}`,packId:pack.id,questionId:q.id,question:structuredClone(q),rating:args.rating,reviewedAt:now()};return save('review.add',event.id,event,0);}
 let next=structuredClone(pack);
 if(name==='set_pack_metadata'){for(const key of ['title','description','folder','tags'] as const)if(args[key]!==undefined)(next as any)[key]=args[key];}
 else if(name==='create_question'){const q=validateQuestion(args.question);if(next.questions.some(q0=>q0.id===q.id))throw new Error('Question ID already exists');next.questions.push(q);}
 else if(name==='update_question'){const q=validateQuestion(args.question);if(q.id!==args.questionId)throw new Error('Cannot change question ID');const index=next.questions.findIndex(q0=>q0.id===args.questionId);if(index<0)throw new Error('Question not found');next.questions[index]=q;}
 else if(name==='delete_question'){if(!next.questions.some(q=>q.id===args.questionId))throw new Error('Question not found');if(next.questions.length===1)throw new Error('Bank requires at least one question; delete the bank instead');next.questions=next.questions.filter(q=>q.id!==args.questionId);}
 else if(name==='create_artifact'||name==='update_artifact'){const a=validateArtifact(args.artifact);const index=next.artifacts.findIndex(a0=>a0.id===(args.artifactId??a.id));if(name==='create_artifact'){if(index>=0)throw new Error('Artifact ID already exists');next.artifacts.push(a);}else{if(index<0)throw new Error('Artifact not found');if(a.id!==args.artifactId)throw new Error('Cannot change artifact ID');next.artifacts[index]=a;}}
 else if(name==='delete_artifact'){if(!next.artifacts.some(a=>a.id===args.artifactId))throw new Error('Artifact not found');next.artifacts=next.artifacts.filter(a=>a.id!==args.artifactId);}
 else throw new Error('Unknown control tool');
 return save('pack.put',pack.id,next,args.expectedRevision);
}
