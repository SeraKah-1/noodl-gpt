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

 const saved = await call('/api/mutate', 'POST', headers, {operations: [op('guest-save')]});
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
