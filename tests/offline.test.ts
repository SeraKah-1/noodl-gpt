import 'fake-indexeddb/auto';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../src/client/store';
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
