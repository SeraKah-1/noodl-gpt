import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleRequest,toolsList,type Database,type Statement} from '../src/server/index';
function database():Database {const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));class S implements Statement{constructor(public sql:string,public values:unknown[]=[]){}bind(...v:unknown[]){return new S(this.sql,v)}async first<T>():Promise<T|null>{return (db.prepare(this.sql).get(...this.values as any[])??null) as T|null}async all<T>(){return {results:db.prepare(this.sql).all(...this.values as any[]) as T[]}}async run(){return db.prepare(this.sql).run(...this.values as any[])}}return {prepare:(sql)=>new S(sql),batch:async ss=>{db.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};}
const question={id:'q1',type:'FILL_BLANK',text:'Potassium symbol?',acceptedAnswers:['K'],explanation:'K is potassium',difficulty:'Easy',conceptName:'Chemistry'};
async function call(db:Database,name:string,args:any={},owner='a'){const response=await handleRequest(new Request('https://app/mcp',{method:'POST',headers:{'oai-authenticated-user-id':owner},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),{DB:db},null);const data=await response!.json() as any;if(data.error)throw new Error(data.error.message);return data.result;}
async function ok(db:Database,name:string,args:any={},owner='a'){const result=await call(db,name,args,owner);assert.notEqual(result.isError,true,result.content?.[0]?.text);return result.structuredContent;}
async function pack(db:Database){return ok(db,'create_pack',{operationId:'create',pack:{title:'Chemistry',questions:[question]}});}
test('question CRUD and stale writes retain stable IDs and replay the original result after deletion',async()=>{const db=database();let p=await pack(db);p=await ok(db,'create_question',{packId:p.id,operationId:'append',expectedRevision:1,question:{...question,id:'q2',text:'Vitamin D?'}});assert.equal(p.revision,2);p=await ok(db,'update_question',{packId:p.id,questionId:'q2',operationId:'edit',expectedRevision:2,question:{...p.questions[1],text:'Vitamin D supports what?'}});assert.match(p.questions[1].text,/Vitamin D/);const bad=await call(db,'delete_question',{packId:p.id,questionId:'q2',operationId:'stale',expectedRevision:2});assert.equal(bad.isError,true);p=await ok(db,'delete_question',{packId:p.id,questionId:'q2',operationId:'remove',expectedRevision:3});assert.equal(p.questions.length,1);const replay=await ok(db,'create_question',{packId:p.id,operationId:'append',expectedRevision:1,question:{...question,id:'q2'}});assert.equal(replay.revision,2);assert.equal((await ok(db,'get_pack',{packId:p.id})).questions.length,1);assert.equal((await call(db,'delete_question',{packId:p.id,questionId:'q1',operationId:'last',expectedRevision:4})).isError,true);});
test('artifact CRUD metadata and content search are account scoped with paginated results',async()=>{const db=database();let p=await pack(db);p=await ok(db,'create_artifact',{packId:p.id,operationId:'artifact',expectedRevision:1,artifact:{id:'a1',kind:'material',title:'Electrolytes',content:'Potassium regulates membranes'}});assert.equal((await ok(db,'search_workspace',{query:'potassium',kind:'artifact',limit:1})).items.length,1);assert.equal((await ok(db,'search_workspace',{query:'potassium'},'b')).total,0);assert.equal((await call(db,'get_artifact',{packId:p.id,artifactId:'a1'},'b')).isError,true);p=await ok(db,'set_pack_metadata',{packId:p.id,operationId:'meta',expectedRevision:2,folder:'Semester 1',tags:['renal']});assert.equal(p.folder,'Semester 1');const copy=await ok(db,'duplicate_pack',{packId:p.id,operationId:'copy',title:'Copy'});assert.notEqual(copy.questions[0].id,p.questions[0].id);assert.equal((await ok(db,'list_packs',{limit:1})).nextOffset,1);const replay=await ok(db,'duplicate_pack',{packId:p.id,operationId:'copy'});assert.equal(replay.id,copy.id);p=await ok(db,'delete_artifact',{packId:p.id,artifactId:'a1',operationId:'remove-artifact',expectedRevision:3});assert.equal(p.artifacts.length,0);});
test('ChatGPT can play, finish, read and delete sessions without resurrecting offline history',async()=>{const db=database();const p=await pack(db);let a=await ok(db,'start_attempt',{packId:p.id,operationId:'start',options:{mode:'STANDARD',shuffle:false,mixed:false,retention:false}});a=await ok(db,'answer_attempt',{attemptId:a.id,operationId:'answer',expectedRevision:1,value:'K'});assert.equal(a.answers[0].isCorrect,true);a=await ok(db,'advance_attempt',{attemptId:a.id,operationId:'advance',expectedRevision:2});assert.equal(a.status,'completed');assert.equal((await ok(db,'get_attempt',{attemptId:a.id})).progress.score,100);const deletion=await ok(db,'delete_attempt',{attemptId:a.id,operationId:'delete',expectedRevision:3});assert.ok(deletion.deletedAt);assert.equal((await ok(db,'list_attempts',{})).total,0);assert.equal((await call(db,'get_attempt',{attemptId:a.id})).isError,true);const replay=await ok(db,'delete_attempt',{attemptId:a.id,operationId:'delete',expectedRevision:3});assert.equal(replay.deletedAt,deletion.deletedAt);const snapshot=await ok(db,'app_snapshot');assert.equal(snapshot.attempts[0].deletedAt,deletion.deletedAt);const late=await ok(db,'app_mutate',{expectedOwner:a.ownerId,operations:[{id:'late-device',kind:'attempt.put',entityId:a.id,expectedRevision:4,payload:a,createdAt:new Date().toISOString()}]});assert.equal(late.results[0].ok,false);});
test('SRS review creation, deletion and reset preserve tombstones and account ownership',async()=>{const db=database();const p=await pack(db);const e=await ok(db,'review_card',{packId:p.id,questionId:'q1',rating:2,operationId:'review'});assert.equal((await ok(db,'list_srs')).cards.total,1);assert.equal((await call(db,'delete_review',{reviewId:e.id,operationId:'theft'},'b')).isError,true);const removed=await ok(db,'delete_review',{reviewId:e.id,operationId:'delete-review'});assert.ok(removed.deletedAt);assert.equal((await ok(db,'list_srs')).cards.total,0);await ok(db,'review_card',{packId:p.id,questionId:'q1',rating:1,operationId:'review-again'});const reset=await ok(db,'reset_srs',{packId:p.id,operationId:'reset'});assert.equal(reset.deletedCount,1);assert.equal((await ok(db,'reset_srs',{packId:p.id,operationId:'reset'})).deletedCount,1);assert.equal((await ok(db,'list_srs')).cards.total,0);assert.equal((await ok(db,'app_snapshot')).reviews.length,2);});
test('MCP enforces input schemas for missing revisions, unknown keys and invalid pagination',async()=>{const db=database();const p=await pack(db);assert.equal((await call(db,'delete_question',{packId:p.id,questionId:'q1',operationId:'missing-rev'})).isError,true);assert.equal((await call(db,'search_workspace',{query:'K',limit:101})).isError,true);assert.equal((await call(db,'get_workspace',{ownerId:'b'})).isError,true);assert.equal((await call(db,'open_view',{view:'shell'})).isError,true);assert.equal((await ok(db,'get_capabilities')).input.sourceFiles,false);});

test('comic guide, artifact writes, readback, revisions and public copies preserve the review contract',async()=>{
 const db=database();const p=await pack(db);const guide=await ok(db,'get_comic_guide');assert.equal(guide.storage.artifactKind,'comic');
 const comic={version:1,status:'draft',brief:{objective:'Learn potassium notation',audience:'Students',language:'id',style:'Line drawing',userConfirmation:'Synthetic test confirmation',confirmed:true},panels:[{id:'one',title:'K',visualDescription:'The letter K',caption:'K is potassium.',dialogue:[],alt:'Letter K'}],sources:[],review:{accuracy:false,sequence:false,text:false,visuals:false,userStyle:false,notes:'Draft test fixture',issues:['Artwork pending']}};
 const artifact={id:'comic',kind:'comic',title:'Potassium comic',content:JSON.stringify(comic)};
 const saved=await ok(db,'create_artifact',{packId:p.id,artifact,operationId:'comic',expectedRevision:1});assert.equal(saved.revision,2);
 assert.deepEqual(JSON.parse((await ok(db,'get_artifact',{packId:p.id,artifactId:'comic'})).artifact.content),comic);
 assert.equal((await call(db,'get_artifact',{packId:p.id,artifactId:'comic'},'b')).isError,true);
 assert.equal((await call(db,'update_artifact',{packId:p.id,artifactId:'comic',artifact,operationId:'stale-comic',expectedRevision:1})).isError,true);
 assert.equal((await call(db,'save_artifacts',{packId:p.id,artifacts:[{...artifact,content:JSON.stringify({...comic,status:'reviewed'})}],operationId:'fake-review',expectedRevision:2})).isError,true);
 const publication=await ok(db,'publish_pack',{packId:p.id,operationId:'publish-comic',expectedRevision:2});
 const copied=await ok(db,'copy_publication',{publicationId:publication.id,operationId:'copy-comic'},'b');assert.deepEqual(JSON.parse(copied.artifacts[0].content),comic);
 assert.equal((await ok(db,'get_pack',{packId:p.id})).revision,2);
});


test('MCP tool metadata identifies read-only, destructive, and public operations',()=>{
 const metadata=new Map(toolsList.map(tool=>[tool.name,tool.annotations]));
 for(const {readOnlyHint,destructiveHint,openWorldHint} of metadata.values()){
  assert.equal(typeof readOnlyHint,'boolean');
  assert.equal(typeof destructiveHint,'boolean');
  assert.equal(typeof openWorldHint,'boolean');
  if(readOnlyHint)assert.equal(destructiveHint,false);
 }
 assert.equal(metadata.get('publish_pack')?.openWorldHint,true);
 assert.equal(metadata.get('publish_pack')?.destructiveHint,true);
 assert.equal(metadata.get('update_pack')?.destructiveHint,true);
 assert.equal(metadata.get('app_mutate')?.destructiveHint,true);
 assert.equal(metadata.get('finish_attempt')?.destructiveHint,true);
 assert.equal(metadata.get('list_packs')?.openWorldHint,false);
 assert.equal(metadata.get('browse_publications')?.readOnlyHint,true);
});

test('batch drafts use displayed numbers and letters, support edits, and grade once',async()=>{
 const db=database();
 const choice={id:'m',type:'MULTIPLE_CHOICE',difficulty:'Easy',text:'Pick K',explanation:'metal',options:[{id:'optA',text:'K'},{id:'optB',text:'C'}],correctOptionId:'optA'};
 const tf={id:'b',type:'TRUE_FALSE',difficulty:'Easy',text:'Try true',explanation:'test',correctBoolean:true};
 const bank=await ok(db,'create_pack',{operationId:'bank',pack:{title:'Mixed',questions:[question,choice,tf]}});
 const options={mode:'BATCH',batchSize:3,shuffle:true,retention:false,mixed:false};
 const batch=await ok(db,'start_attempt',{packId:bank.id,operationId:'start',options});
 assert.equal(batch.questions.length,3);assert.doesNotMatch(JSON.stringify(batch),/correctOptionId|acceptedAnswers|explanation|correctBoolean/);
 const id=batch.attemptId, blank=batch.questions.find((q:any)=>q.type==='FILL_BLANK'), mc=batch.questions.find((q:any)=>q.type==='MULTIPLE_CHOICE'), bool=batch.questions.find((q:any)=>q.type==='TRUE_FALSE');
 const partial={attemptId:id,expectedRevision:1,operationId:'partial',changes:[{number:mc.number,letter:mc.options.find((o:any)=>o.text==='K').letter},{number:blank.number,value:'X'}]};
 const draft=await ok(db,'update_batch_draft',partial);assert.deepEqual(await ok(db,'update_batch_draft',partial),draft);
 assert.equal((await call(db,'advance_attempt',{attemptId:id,expectedRevision:2,operationId:'advance'})).isError,true);
 assert.equal((await call(db,'submit_batch',{attemptId:id,expectedRevision:2,operationId:'incomplete'})).isError,true);
 assert.equal((await call(db,'update_batch_draft',{...partial,operationId:'stale'})).isError,true);
 assert.equal((await call(db,'update_batch_draft',{...partial,expectedRevision:2,operationId:'wrong-number',changes:[{number:blank.number,value:'K'},{number:4,value:true}]})).isError,true);
 const current=await ok(db,'get_attempt',{attemptId:id});
 assert.equal(current.questions.find((q:any)=>q.number===blank.number).draft,'X');
 assert.equal((await call(db,'get_attempt',{attemptId:id},'other')).isError,true);
 await ok(db,'update_batch_draft',{...partial,expectedRevision:2,operationId:'complete',changes:[{number:blank.number,value:' k '},{number:bool.number,value:false}]});
 const submit={attemptId:id,expectedRevision:3,operationId:'finish'};
 const done=await ok(db,'submit_batch',submit);
 assert.equal(done.status,'completed');assert.equal(done.answers.filter((a:any)=>a.isCorrect).length,2);assert.equal(done.draft,undefined);
 assert.deepEqual(await ok(db,'submit_batch',submit),done);
 assert.equal((await ok(db,'get_attempt',{attemptId:id})).progress.score,67);
 assert.equal((await ok(db,'list_srs',{packId:bank.id})).reviews.total,1);
});

test('slide recall keeps independent evidence, resumes, repeats and excludes private responses from publication',async()=>{
 const db=database();const p=await pack(db);
 const start={operationId:'recall',title:'Example slides',units:[{slides:[2,3],prompt:'Explain the relationship.',points:[{slide:3,concept:'K denotes potassium.'}]},{slides:[5],prompt:'Explain the next topic.',points:[{slide:5,concept:'Another concept.'}]}]};
 assert.equal((await call(db,'start_brain_dump',{...start,units:[{...start.units[0],slides:[1]}]})).isError,true);
 const session=await ok(db,'start_brain_dump',start);
 assert.equal(session.current.prompt,start.units[0].prompt);
 assert.doesNotMatch(JSON.stringify(session),/potassium/i);
 assert.deepEqual(await ok(db,'start_brain_dump',start),session);
 assert.equal((await call(db,'start_brain_dump',{...start,title:'Changed'})).isError,true);
 const sessionId=session.sessionId;
 assert.equal((await call(db,'get_brain_dump',{sessionId},'b')).isError,true);
 assert.equal((await ok(db,'list_brain_dumps',{},'b')).items.length,0);
 const initial={sessionId,operationId:'initial',expectedRevision:1,answer:'Private first response',hint:'Which symbol do you recall?'};
 const first=await ok(db,'record_recall',initial);
 assert.equal(first.current.assessmentPoints[0].slide,3);
 assert.deepEqual(await ok(db,'record_recall',initial),first);
 assert.equal((await call(db,'record_recall',{...initial,operationId:'stale'})).isError,true);
 await ok(db,'record_recall',{...initial,expectedRevision:2,hint:undefined,operationId:'prompted',answer:'K'});
 const review={sessionId,operationId:'grade',expectedRevision:3,feedback:[{point:1,verdict:'partial',explanation:'You remembered K after the hint.'}]};
 const next=await ok(db,'review_recall',review);
 assert.equal(next.current.unitNumber,2);assert.equal(next.reviewed.feedback[0].slide,3);
 const history=(await ok(db,'get_brain_dump',{sessionId})).history;
 assert.equal(history[0].initial,initial.answer);assert.equal(history[0].supplement,'K');
 const snapshot=await ok(db,'app_snapshot');assert.doesNotMatch(JSON.stringify(snapshot),/Private first response/);
 const pub=await ok(db,'publish_pack',{packId:p.id,operationId:'publish',expectedRevision:p.revision});assert.doesNotMatch(JSON.stringify(pub),/Private first response|You remembered/);
 await ok(db,'record_recall',{sessionId,operationId:'second',expectedRevision:4,answer:'Another idea'});
 const end=await ok(db,'review_recall',{...review,expectedRevision:5,operationId:'review2'});
 assert.equal(end.status,'completed');
 const retry=await ok(db,'retry_recall',{sessionId,expectedRevision:6,operationId:'retry',unitNumber:1});
 assert.equal(retry.current.unitNumber,1);assert.equal(retry.current.initial,undefined);
 assert.equal((await ok(db,'list_brain_dumps')).items[0].id,sessionId);
});

test('diagnostic reuses one saved check for an explicit miss and grades a different question',async()=>{
 const db=database();
 const p=await ok(db,'create_pack',{operationId:'pack',pack:{title:'Lab',questions:[question]}});
 const a=await ok(db,'start_attempt',{packId:p.id,operationId:'start',options:{mode:'STANDARD',shuffle:false,retention:false,mixed:false}});
 await ok(db,'answer_attempt',{attemptId:a.id,operationId:'wrong',expectedRevision:1,value:'X'});
 await ok(db,'advance_attempt',{attemptId:a.id,operationId:'end',expectedRevision:2});
 assert.equal((await ok(db,'start_diagnostic',{attemptId:a.id,operationId:'none'})).available,false);
 await ok(db,'append_questions',{packId:p.id,operationId:'add',expectedRevision:1,questions:[{...question,id:'new',text:'Symbol of sodium?',acceptedAnswers:['Na']}]});
 const start={attemptId:a.id,operationId:'check'},d=await ok(db,'start_diagnostic',start);
 assert.equal(d.questions.length,1);assert.equal(d.questions[0].text,'Symbol of sodium?');
 assert.deepEqual(await ok(db,'start_diagnostic',start),d);
 assert.equal((await ok(db,'start_diagnostic',{...start,operationId:'again'})).attemptId,d.attemptId);
 assert.equal((await call(db,'start_diagnostic',start,'b')).isError,true);
 await ok(db,'update_batch_draft',{attemptId:d.attemptId,operationId:'draft',expectedRevision:1,changes:[{number:1,value:'Na'}]});
 const result=await ok(db,'submit_batch',{attemptId:d.attemptId,operationId:'submit',expectedRevision:2});
 assert.equal(result.answers[0].isCorrect,true);assert.equal(result.diagnostic.attemptId,a.id);
 const summary=await ok(db,'start_diagnostic',{...start,operationId:'summary'});
 assert.equal(summary.originalCorrect,false);assert.equal(summary.followupCorrect,true);
 assert.equal((await ok(db,'open_autopilot',{packId:p.id})).view,'autopilot');
 assert.equal((await call(db,'open_autopilot',{packId:p.id},'b')).isError,true);
 assert.equal((await ok(db,'open_knowledge_debugger')).view,'gastric-debugger');
});

test('objective-driven Brain Dump accepts a terse response and validates any optional follow-up target',async()=>{
 const db=database(),s=await ok(db,'start_brain_dump',{operationId:'new',title:'Test',units:[{objective:'Name the symbol',prompt:'What symbol?',slides:[1],points:[{slide:1,concept:'K'}]}]});
 const args={sessionId:s.sessionId,operationId:'first',expectedRevision:1,answer:'K'};
 assert.equal((await call(db,'record_recall',{...args,hint:'Explain more?'})).isError,true);
 assert.equal((await call(db,'record_recall',{...args,hint:'Which symbol?',hintPoint:3})).isError,true);
 await ok(db,'record_recall',args);
 const done=await ok(db,'review_recall',{sessionId:s.sessionId,operationId:'grade',expectedRevision:2,feedback:[{point:1,verdict:'recalled',explanation:'K matches the slide.'}]});
 assert.equal(done.status,'completed');assert.equal(done.reviewed.hint,undefined);
});

test('an initial concept probe reserves a second unanswered question',async()=>{
 const db=database(),p=await pack(db);
 assert.equal((await ok(db,'start_concept_probe',{packId:p.id,operationId:'no-pair'})).available,false);
 await ok(db,'append_questions',{packId:p.id,operationId:'more',expectedRevision:1,questions:[{...question,id:'second',text:'Symbol for sodium?',acceptedAnswers:['Na']}]});
 const probe=await ok(db,'start_concept_probe',{packId:p.id,operationId:'probe'});
 assert.equal(probe.questions.length,1);
 await ok(db,'update_batch_draft',{attemptId:probe.attemptId,operationId:'draft',expectedRevision:1,changes:[{number:1,value:'X'}]});
 await ok(db,'submit_batch',{attemptId:probe.attemptId,operationId:'submit',expectedRevision:2});
 const next=await ok(db,'start_diagnostic',{attemptId:probe.attemptId,operationId:'follow'});
 assert.notEqual(next.questions[0].text,probe.questions[0].text);
});

test('MCP compact learning context exposes real counts without answer keys and returns scoped next action',async()=>{
 const db=database(),p=await pack(db);
 const empty=await ok(db,'get_study_context',{limit:5});
 assert.equal(empty.bankCount,1);
 assert.equal(empty.banks[0].questionCount,1);
 assert.equal(empty.banks[0].questions,undefined);
 assert.equal(empty.banks[0].correctOptionId,undefined);
 assert.equal(empty.activeAttempt,null);
 assert.equal(empty.nextAction.kind,'start_practice');
 const attempt=await ok(db,'start_attempt',{packId:p.id,operationId:'ctx-attempt',options:{mode:'STANDARD',shuffle:false,mixed:false,retention:false}});
 const active=await ok(db,'get_study_context',{packId:p.id});
 assert.equal(active.activeAttempt.id,attempt.id);
 assert.equal(active.activeAttempt.total,1);
 assert.equal(active.nextAction.kind,'resume_attempt');
 assert.equal((await call(db,'get_study_context',{packId:p.id},'someone-else')).isError,true);
 assert.equal((await call(db,'get_study_context',{limit:21})).isError,true);
});

test('MCP operation receipt is account-scoped, idempotent and never returns a whole answer key',async()=>{
 const db=database(),p=await pack(db);
 const receipt=await ok(db,'get_operation_receipt',{operationId:'create'});
 assert.equal(receipt.status,'committed');
 assert.equal(receipt.recordId,p.id);
 assert.equal(receipt.revision,1);
 assert.equal(receipt.record,undefined);
 assert.equal((await ok(db,'get_operation_receipt',{operationId:'create'},'other-account')).status,'not_found');
 assert.equal((await ok(db,'get_operation_receipt',{operationId:'not-issued'})).status,'not_found');
});
