import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleRequest,mutate,type Database,type Statement} from '../src/server/index';
import {createAttempt,answerAttempt,finishAttempt} from '../src/shared/engine';
import type {Operation,Pack} from '../src/shared/types';
function database():Database {const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));class S implements Statement{constructor(public sql:string,public values:unknown[]=[]){}bind(...v:unknown[]){return new S(this.sql,v)}async first<T>():Promise<T|null>{return (db.prepare(this.sql).get(...this.values as any[])??null) as T|null}async all<T>(){return {results:db.prepare(this.sql).all(...this.values as any[]) as T[]}}async run(){return db.prepare(this.sql).run(...this.values as any[])}}return {prepare:(sql)=>new S(sql),batch:async ss=>{db.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};}
const input={title:'Test',questions:[{id:'q',type:'MULTIPLE_CHOICE',text:'Which?',options:[{id:'a',text:'yes'},{id:'b',text:'no'}],correctOptionId:'a',explanation:'Because',difficulty:'Easy'}]};
const op=(id:string,revision=0,payload:unknown=input):Operation=>({id,kind:'pack.put',entityId:'p',expectedRevision:revision,payload,createdAt:new Date().toISOString()});
test('mutations isolate owners, deduplicate retries and reject stale writes',async()=>{const db=database();const first=await mutate(db,'a',op('one'));assert.equal(first.ok,true);assert.deepEqual(await mutate(db,'a',op('one')),first);const conflict=await mutate(db,'a',op('two'));assert.equal(conflict.code,'CONFLICT');assert.equal((await mutate(db,'b',op('one'))).ok,true);const response=await handleRequest(new Request('https://app/api/snapshot',{headers:{'oai-authenticated-user-id':'a'}}),{DB:db},null);const data=await response!.json() as any;assert.equal(data.packs.length,1);assert.equal(data.packs[0].ownerId,'a');});
test('missing authentication and cross-origin writes fail',async()=>{const db=database();assert.equal((await handleRequest(new Request('https://app/api/me'),{DB:db},null))!.status,401);assert.equal((await handleRequest(new Request('https://app/api/mutate',{method:'POST',headers:{'oai-authenticated-user-id':'a',origin:'https://other'},body:'{}'}),{DB:db},null))!.status,403);});
test('server corrects forged answer scores and preserves completed attempts',async()=>{const db=database();const pack=(await mutate(db,'a',op('pack'))).record as Pack;let attempt=createAttempt(pack,{mode:'STANDARD',shuffle:false,retention:false,mixed:false},'a');attempt=finishAttempt(answerAttempt(attempt,'b'));attempt.answers[0].isCorrect=true;const operation:Operation={id:'attempt',kind:'attempt.put',entityId:attempt.id,expectedRevision:0,payload:attempt,createdAt:new Date().toISOString()};const result=await mutate(db,'a',operation);assert.equal(result.ok,true);assert.equal((result.record as any).answers[0].isCorrect,false);assert.equal((await mutate(db,'a',{...operation,id:'alter',expectedRevision:1})).code,'CONFLICT');});
test('publication copies contain content and fresh IDs without learner history',async()=>{const db=database();await mutate(db,'a',op('one'));const headers={'oai-authenticated-user-id':'a','content-type':'application/json'};const res=await handleRequest(new Request('https://app/api/publications',{method:'POST',headers,body:JSON.stringify({packId:'p',expectedRevision:1,operationId:'publish'})}),{DB:db},null);const pub=await res!.json() as any;assert.equal(pub.pack.ownerId,undefined);const copy=await handleRequest(new Request('https://app/api/publications/'+encodeURIComponent(pub.id)+'/copy',{method:'POST',headers:{...headers,'oai-authenticated-user-id':'b'},body:JSON.stringify({operationId:'copy'})}),{DB:db},null);const pack=await copy!.json() as any;assert.equal(pack.ownerId,'b');assert.notEqual(pack.questions[0].id,'q');assert.equal(pack.attempts,undefined);});
test('MCP advertises tools, resource and authenticated app-only transport',async()=>{const db=database();const req=(method:string,params={})=>new Request('https://app/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'a'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const result=await (await handleRequest(req('tools/list'),{DB:db},null))!.json() as any;assert.ok(result.result.tools.some((t:any)=>t.name==='create_pack'));const resource=await (await handleRequest(req('resources/read',{uri:'ui://noodl/workspace'}),{DB:db},null,{'/index.html':{body:'<html><head></head><body></body></html>',type:'text/html'}}))!.json() as any;assert.match(resource.result.contents[0].text,/__NOODL_EMBEDDED__/);const user=await (await handleRequest(req('tools/call',{name:'app_identity',arguments:{}}),{DB:db},null))!.json() as any;assert.equal(user.result.structuredContent.id,'a');});
test('forged snapshot content is rejected while owned historical versions remain usable offline',async()=>{const db=database();const pack=(await mutate(db,'a',op('initial'))).record as Pack;const attempt=createAttempt(pack,{mode:'STANDARD',shuffle:true,retention:false,mixed:false},'a');const forged=structuredClone(attempt);forged.items[0].question.correctOptionId='b';const base:Operation={id:'forged',kind:'attempt.put',entityId:forged.id,expectedRevision:0,payload:forged,createdAt:new Date().toISOString()};assert.equal((await mutate(db,'a',base)).code,'INVALID');await mutate(db,'a',op('edit',1,{...input,title:'New revision',questions:[{...input.questions[0],text:'Changed'}]}));assert.equal((await mutate(db,'a',{...base,id:'old-offline',payload:attempt})).ok,true);});
test('late Time Rush answers cannot retain a forged true score',async()=>{const db=database();const pack=(await mutate(db,'a',op('initial'))).record as Pack;const start=Date.now()-60000;const attempt=createAttempt(pack,{mode:'TIME_RUSH',shuffle:false,retention:false,mixed:false},'a',undefined,start);attempt.answers=[{occurrenceId:attempt.items[0].id,value:'a',isCorrect:true,answeredAt:new Date(start+30000).toISOString()}];const result=await mutate(db,'a',{id:'late',kind:'attempt.put',entityId:attempt.id,expectedRevision:0,payload:attempt,createdAt:new Date().toISOString()});assert.equal(result.ok,true);assert.equal((result.record as any).answers[0].isCorrect,false);});
test('legitimate mixed transformations remain accepted by historical snapshot validation',async()=>{const db=database();const pack=(await mutate(db,'a',op('initial',0,{...input,questions:Array.from({length:6},(_,i)=>({...input.questions[0],id:`q${i}`}))}))).record as Pack;const attempt=createAttempt(pack,{mode:'STANDARD',shuffle:true,retention:true,mixed:true},'a');const result=await mutate(db,'a',{id:'mixed',kind:'attempt.put',entityId:attempt.id,expectedRevision:0,payload:attempt,createdAt:new Date().toISOString()});assert.equal(result.ok,true,result.error);});
test('anonymous catalog exposes only published snapshots and rejects private routes and writes',async()=>{
 const db=database();await mutate(db,'a',op('private'));
 const request=(path:string,method='GET')=>handleRequest(new Request('https://app'+path,{method}),{DB:db},null);
 assert.deepEqual(await (await request('/api/public/catalog'))!.json(),{publications:[]});
 await handleRequest(new Request('https://app/api/publications',{method:'POST',headers:{'oai-authenticated-user-id':'a'},body:JSON.stringify({packId:'p',expectedRevision:1,operationId:'publish'})}),{DB:db},null);
 const list=await (await request('/api/public/catalog'))!.json() as any;assert.equal(list.publications.length,1);assert.equal(list.publications[0].pack,undefined);
 const detail=await (await request('/api/public/catalog/'+encodeURIComponent(list.publications[0].id)))!.json() as any;assert.equal(detail.pack.questions[0].correctOptionId,'a');assert.equal(detail.pack.ownerId,undefined);
 for(const path of ['/api/snapshot','/api/preferences','/api/exports/private'])assert.equal((await request(path))!.status,401);
 for(const path of ['/api/mutate','/api/public/catalog','/mcp'])assert.equal((await request(path,'POST'))!.status,401);
});

test('guest browser can save a bank, publish an anonymous link, and revoke it', async () => {
 const env = {DB: database()};
 const call = async (path: string, method = 'GET', headers?: HeadersInit, data?: unknown) =>
  (await handleRequest(new Request('https://app' + path, {
   method, headers, body: data === undefined ? undefined : JSON.stringify(data)
  }), env, null))!;
 const guest = await call('/api/guest', 'POST');
 assert.equal(guest.status, 200);
 const user = await guest.json() as {id: string};
 const setCookie = guest.headers.get('set-cookie')!;
 assert.match(setCookie, /^__Host-noodl-guest=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict/);
 const cookie = setCookie.split(';')[0];
 const headers = {cookie, 'x-noodl-guest': user.id, origin: 'https://app'};
 const restored = await call('/api/guest', 'POST', {cookie});
 assert.deepEqual(await restored.json(), user);
 assert.equal((await call('/api/guest', 'POST', {origin: 'https://other'})).status, 403);

 const saved = await call('/api/mutate', 'POST', headers, {expectedOwner:user.id,operations: [op('guest-save')]});
 assert.equal((await saved.json() as {results: {ok: boolean}[]}).results[0].ok, true);
 const snapshot = await call('/api/snapshot', 'GET', headers);
 assert.equal((await snapshot.json() as {packs: Pack[]}).packs[0].ownerId, user.id);
 assert.equal((await call('/api/snapshot', 'GET', {'x-noodl-guest': user.id})).status, 401);
 assert.equal((await call('/api/snapshot', 'GET', {...headers, 'x-noodl-guest': 'other'})).status, 401);
 assert.equal((await call('/mcp', 'POST', headers, {method: 'tools/list'})).status, 401);

 const published = await call('/api/publications', 'POST', headers, {
  operationId: 'guest-share', packId: 'p', expectedRevision: 1
 });
 const publication = await published.json() as {id: string};
 const path = '/' + encodeURIComponent(publication.id);
 assert.equal(published.status, 200);
 assert.equal((await call('/api/public/catalog' + path)).status, 200);
 await call('/api/publications' + path, 'DELETE', {'oai-authenticated-user-id': 'other'});
 assert.equal((await call('/api/public/catalog' + path)).status, 200);
 await call('/api/publications' + path, 'DELETE', headers);
 assert.equal((await call('/api/public/catalog' + path)).status, 404);
});

test('Supabase backup uses private paths and includes only the active owner’s banks', async t => {
 const db = database();
 const secret = 'sb_secret_fixture';
 const env = {DB: db, SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_STORAGE_BUCKET: 'noodl', SUPABASE_SECRET_KEY: secret};
 await mutate(db, 'a', op('bank-a'));
 await mutate(db, 'b', op('bank-b', 0, {...input, title: 'Private bank B'}));
 let body: string | undefined;
 let storedPath: string | undefined;
 t.mock.method(globalThis, 'fetch', async (requestUrl: string, init: RequestInit) => {
  const url = new URL(requestUrl);
  assert.equal(url.origin, 'https://example.supabase.co');
  assert.equal(init.redirect, 'manual');
  assert.equal(new Headers(init.headers).get('apikey'), secret);
  if (init.method === 'POST') {
   assert.equal(new Headers(init.headers).get('x-upsert'), 'true');
   assert.match(url.pathname, /^\/storage\/v1\/object\/noodl\/noodl\/[a-f0-9]{64}\/banks\.json$/);
   storedPath = url.pathname;
   body = new TextDecoder().decode(init.body as Uint8Array<ArrayBuffer>);
   return Response.json({Key: 'fixture'});
  }
  if (url.pathname !== storedPath!.replace('/object/', '/object/authenticated/')) {
   return Response.json({statusCode: '404', code: 'NoSuchKey', error: 'not_found'}, {status: 400});
  }
  return new Response(body);
 });
 const call = (method: string) => handleRequest(new Request('https://app/api/storage/banks', {
  method, headers: {'oai-authenticated-user-id': 'a'}
 }), env, null);
 assert.deepEqual(await (await call('PUT'))!.json(), {ok: true, count: 1});
 const backup = await (await call('GET'))!.json() as {banks: Pack[]};
 assert.equal(backup.banks.length, 1);
 assert.equal(backup.banks[0].title, 'Test');
 assert.equal(backup.banks[0].ownerId, undefined);
 const missing = await handleRequest(new Request('https://app/api/storage/banks', {
  headers: {'oai-authenticated-user-id': 'b'}
 }), env, null);
 assert.equal(missing!.status, 404);
});

test('sync requires the active workspace ID in both HTTP and MCP batches',async()=>{
 const env={DB:database()};
 const headers={'oai-authenticated-user-id':'a'};
 const request=(path:string,body:unknown)=>handleRequest(new Request('https://app'+path,{method:'POST',headers,body:JSON.stringify(body)}),env,null);
 assert.equal((await request('/api/mutate',{operations:[]}))?.status,401);
 assert.equal((await request('/api/mutate',{expectedOwner:'another-workspace',operations:[]}))?.status,401);
 assert.equal((await request('/api/mutate',{expectedOwner:'a',operations:[]}))?.status,200);
 const response=await request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:'app_mutate',arguments:{expectedOwner:'another-workspace',operations:[]}}});
 const rpc=await response!.json() as {result:{isError:boolean;_meta:Record<string,unknown>}};
 assert.equal(rpc.result.isError,true);
 assert.equal(rpc.result._meta['noodl/status'],401);
});

test('starting a large session reads pack version history once per source bank',async()=>{
 const db=database();
 let historyQueries=0;
 const counted:Database={...db,prepare(sql){
  if(sql.startsWith('SELECT data FROM pack_versions'))historyQueries++;
  return db.prepare(sql);
 }};
 const pack=(await mutate(db,'a',op('many',0,{...input,questions:Array.from({length:120},(_,i)=>({...input.questions[0],id:'q'+i}))}))).record as Pack;
 const attempt=createAttempt(pack,{mode:'STANDARD',shuffle:false,retention:false,mixed:false},'a');
 const result=await mutate(counted,'a',{id:'new-session',kind:'attempt.put',entityId:attempt.id,expectedRevision:0,payload:attempt,createdAt:attempt.createdAt});
 assert.equal(result.ok,true,result.error);
 assert.equal(historyQueries,1);
});

test('cross-bank Mix session keeps source provenance without saving a new bank',async()=>{
 const db=database();
 const first=(await mutate(db,'a',op('mix-one'))).record as Pack;
 const second=(await mutate(db,'a',{...op('mix-two',0,{...input,title:'Another bank'}),entityId:'p2'})).record as Pack;
 const selection=[{question:first.questions[0],sourcePackId:first.id},{question:second.questions[0],sourcePackId:second.id}];
 const attempt=createAttempt({...first,title:'Mix · Test + Another bank'},{mode:'STANDARD',shuffle:false,retention:false,mixed:false},'a',selection);
 assert.equal(attempt.packId,'p');
 assert.deepEqual(attempt.items.map(i=>i.sourcePackId),['p','p2']);
 const saved=await mutate(db,'a',{id:'mix-session',kind:'attempt.put',entityId:attempt.id,expectedRevision:0,payload:attempt,createdAt:new Date().toISOString()});
 assert.equal(saved.ok,true,saved.error);
 const response=await handleRequest(new Request('https://app/api/snapshot',{headers:{'oai-authenticated-user-id':'a'}}),{DB:db},null);
 const data=await response!.json() as {packs:Pack[]};
 assert.equal(data.packs.length,2,'Starting Mix must not create a third persistent bank');
});

test('new publication IDs are opaque and re-publishing keeps the same canonical link and receipt',async()=>{
 const db=database();await mutate(db,'owner-sensitive-id',op('create-private'));
 async function publish(operationId:string,expectedRevision:number){
  const response=(await handleRequest(new Request('https://app/api/publications',{method:'POST',
   headers:{'oai-authenticated-user-id':'owner-sensitive-id'},
   body:JSON.stringify({packId:'p',expectedRevision,operationId})}),{DB:db},null))!;
  assert.equal(response.status,200);
  return response.json() as Promise<{id:string;questionCount:number}>;
 }
 const first=await publish('publish-one',1);
 assert.match(first.id,/^pub-[0-9a-f-]{36}$/);
 assert.equal(first.id.includes('owner-sensitive-id'),false);
 assert.equal(first.id.includes(':p'),false);
 assert.deepEqual(await publish('publish-one',1),first);
 const edit=await mutate(db,'owner-sensitive-id',op('change-bank',1,{...input,title:'Changed title'}));
 assert.equal(edit.ok,true);
 const second=await publish('publish-again',2);
 assert.equal(second.id,first.id,'Republishing an existing bank must not break an active share URL');
 const row=await db.prepare("SELECT data FROM publications WHERE owner_id=? AND source_id=?").bind('owner-sensitive-id','p').first<{data:string}>();
 assert.equal(JSON.parse(row!.data).id,first.id);
 const receipt=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind('owner-sensitive-id','publish-again').first<{result:string}>();
 assert.equal(JSON.parse(receipt!.result).record.id,first.id);
});

test('legacy publication links retain their identifiers when refreshed',async()=>{
 const db=database();await mutate(db,'a',op('private'));
 const legacyId='a:p';
 await db.prepare('INSERT INTO publications(id,owner_id,source_id,data) VALUES(?,?,?,?)').bind(legacyId,'a','p',
  JSON.stringify({id:legacyId,title:'Legacy bank',description:'',questionCount:1,publishedAt:new Date().toISOString(),
   pack:{title:'Legacy bank',description:'',tags:[],questions:input.questions,artifacts:[]}})).run();
 const res=(await handleRequest(new Request('https://app/api/publications',{method:'POST',
  headers:{'oai-authenticated-user-id':'a'},body:JSON.stringify({packId:'p',expectedRevision:1,operationId:'republish-legacy'})}),
  {DB:db},null))!;
 assert.equal(res.status,200);
 assert.equal((await res.json() as {id:string}).id,legacyId);
 const original=(await handleRequest(new Request('https://app/api/public/catalog/'+encodeURIComponent(legacyId)),{DB:db},null))!;
 assert.equal(original.status,200);
});
