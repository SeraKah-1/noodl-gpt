import 'fake-indexeddb/auto';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../src/client/store';
import {NoodlClient} from '../src/client/index';
import {defaultPreferences} from '../src/shared/preferences';
import type {Pack} from '../src/shared/types';
if(!globalThis.crypto)Object.assign(globalThis,{crypto:webcrypto});
const pack=(ownerId='a',id='pack'):Pack=>({id,ownerId,title:'Deck',description:'',folder:'',tags:[],questions:[],artifacts:[],revision:0,createdAt:'2026-01-01',updatedAt:'2026-01-01'});
const store=()=>new LocalStore(`test-${crypto.randomUUID()}`);
test('account partitions and locked sign-out retain pending work under the original owner',async()=>{
 const db=store();await db.setProfile({id:'a',name:'A'});await db.enqueue('a','pack.put',pack());await db.lock();
 assert.equal((await db.profile())?.locked,true);assert.equal((await db.read('a')).pending.length,1);assert.equal((await db.read('b')).records.length,0);
 await assert.rejects(()=>db.enqueue('b','pack.put',pack()),/akun lain/);await db.close();
});
test('acknowledging an operation does not delete newly queued work or overwrite its record',async()=>{
 const db=store();const p=await db.enqueue('a','pack.put',pack()) as Pack;const first=(await db.read('a')).pending[0];
 const second=await db.enqueue('a','pack.put',{...p,title:'Newer'}) as Pack;
 await db.acknowledge('a',{operationId:first.id,ok:true,record:p});
 const state=await db.read('a');assert.equal(state.pending.length,1);assert.equal((state.records[0].value as Pack).title,'Newer');assert.equal(second.revision,2);await db.close();
});
test('leases prevent tabs overtaking the first pending operation; retries keep its ID',async()=>{
 const db=store();await db.enqueue('a','pack.put',pack());const first=await db.claim('a','tab1');assert.ok(first);
 assert.equal(await db.claim('a','tab2'),undefined);await db.release('a',first.id);assert.equal((await db.claim('a','tab2'))?.id,first.id);await db.close();
});
test('remote snapshot preserves pending drafts and server conflicts can become private copies',async()=>{
 const db=store();const draft=await db.enqueue('a','pack.put',pack()) as Pack;const op=(await db.read('a')).pending[0];
 await db.merge('a',{packs:[],attempts:[],reviews:[],cursor:1});assert.equal((await db.read('a')).records.length,1);
 const server={...draft,title:'Server',revision:4};await db.acknowledge('a',{operationId:op.id,ok:false,code:'CONFLICT',current:server,error:'Stale'});
 assert.equal(await db.claim('a','tab'),undefined);const copy=await db.resolve('a',op.id,'copy');assert.ok(copy);assert.notEqual(copy.id,draft.id);assert.equal(copy.ownerId,'a');
 assert.equal((await db.read('a')).pending.length,0);assert.equal(((await db.read('a')).records[0].value as Pack).title,'Server');await db.close();
});
test('snapshot never installs records belonging to a different account',async()=>{
 const db=store();await db.merge('a',{packs:[pack('b')],attempts:[],reviews:[],cursor:1});assert.equal((await db.read('a')).records.length,0);await db.close();
});
test('stale snapshots cannot roll a record revision or cursor backward',async()=>{
 const db=store();const current={...pack(),revision:5,title:'Latest'};
 await db.merge('a',{packs:[current],attempts:[],reviews:[],cursor:5});
 await db.merge('a',{packs:[{...current,revision:2,title:'Stale'}],attempts:[],reviews:[],cursor:6});
 assert.equal(((await db.read('a')).records[0].value as Pack).title,'Latest');
 await db.merge('a',{packs:[],attempts:[],reviews:[],cursor:1});assert.equal((await db.read('a')).records.length,1);await db.close();
});


test('rename from a second tab preserves recent edits and rejects stale full-bank saves',async()=>{
 const first=store();
 const second=new LocalStore(await first.db().then(db=>db.name));
 const original=await first.enqueue('a','pack.put',pack()) as Pack;
 await first.enqueue('a','pack.put',{...original,description:'New material'});
 await second.renamePack('a',original.id,{title:'Renamed',folder:'Archive'},false);
 const {records,pending}=await first.read('a');
 assert.equal((records[0].value as Pack).description,'New material');
 assert.equal((records[0].value as Pack).title,'Renamed');
 assert.equal(pending[2].operation.expectedRevision,2);
 await assert.rejects(()=>second.enqueue('a','pack.put',original),/berubah/);
 await first.close();
 await second.close();
});

test('a failed bulk bank write rolls back local records and the outbox',async()=>{
 const db=store();
 await assert.rejects(()=>db.saveBanks('a',[pack('a','first'),pack('b','second')],false),/akun lain/);
 assert.equal((await db.read('a')).records.length,0);
 assert.equal((await db.read('a')).pending.length,0);
 await db.saveBanks('a',[pack('a','first'),pack('a','second')],false);
 assert.deepEqual((await db.read('a')).pending.map(row=>row.sequence),[1,2]);
 await db.close();
});

test('permanent sync errors preserve the failed draft and let unrelated banks sync',async()=>{
 const db=store();
 const rejected=await db.enqueue('a','pack.put',pack('a','rejected')) as Pack;
 await db.enqueue('a','pack.put',{...rejected,title:'Later edit'});
 await db.enqueue('a','pack.put',pack('a','other'));
 const sent:string[]=[];
 let remote:Pack|undefined;
 const client=new NoodlClient(db,async(path,init)=>{
  if(path==='/api/me')return Response.json({id:'a',name:'A'});
  if(path==='/api/mutate'){
   const {expectedOwner,operations:[op]}=JSON.parse(String(init?.body));
   assert.equal(expectedOwner,'a');
   sent.push(op.entityId);
   if(op.entityId==='rejected')return Response.json({error:'Too large'},{status:413});
   remote=op.payload;
   return Response.json({results:[{operationId:op.id,ok:true,record:remote}]});
  }
  if(path==='/api/snapshot')return Response.json({packs:remote?[remote]:[],attempts:[],reviews:[],cursor:1});
  return Response.json({...defaultPreferences(),ownerId:'a',revision:0});
 });
 await client.initialize();
 assert.deepEqual(sent,['rejected','other']);
 assert.equal(client.getState().conflicts[0].failure?.error,'Too large');
 assert.equal(client.getState().packs.find(p=>p.id==='rejected')?.title,'Later edit');
 assert.equal((await db.read('a')).hasSyncable,false);
 await client.dispose();
});

test('default HTTP transport calls fetch without using the client as its receiver',async t=>{
 t.mock.method(globalThis,'fetch',async function(this:unknown,path:string){
  assert.ok(!(this instanceof NoodlClient));
  if(path==='/api/me')return Response.json({id:'a',name:'A'});
  if(path==='/api/snapshot')return Response.json({packs:[],attempts:[],reviews:[],cursor:1});
  return Response.json({...defaultPreferences(),ownerId:'a',revision:0});
 });
 const client=new NoodlClient(store());
 const user=await client.initialize();
 assert.equal(user?.id,'a');
 await client.dispose();
});
