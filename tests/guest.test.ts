import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NoodlClient,LocalStore} from '../src/client/index';
import {createAttempt,answerAttempt} from '../src/shared/engine';
const input={title:'Guest bank',questions:[{id:'q',type:'FILL_BLANK',text:'2+2',acceptedAnswers:['4'],explanation:'Four',difficulty:'Easy'}]};
test('anonymous visitor can import, study, set preferences and reload without server mutations',async()=>{
 const name='guest-'+crypto.randomUUID();let writes=0;
 const fetcher:typeof fetch=async(url,init)=>{if(url!=='/api/guest'&&init?.method!=='GET')writes++;return new Response('{}',{status:401});};
 const client=new NoodlClient(new LocalStore(name),fetcher);await client.initialize();assert.equal(client.getState().guest,true);
 const pack=await client.importLocalPack(input);await client.saveAttempt(answerAttempt(createAttempt(pack,{mode:'STANDARD',shuffle:false,mixed:false,retention:false},pack.ownerId),'4'));
 await client.updatePreferences({theme:'paper'});await client.sync();assert.equal(client.getState().pending,0);assert.equal(writes,0);await client.dispose();
 const offline=new NoodlClient(new LocalStore(name),async()=>{throw Error('offline');});await offline.initialize();assert.equal(offline.getState().guest,true);assert.equal(offline.getState().packs.length,1);assert.equal(offline.getState().attempts[0].answers[0].isCorrect,true);assert.equal(offline.getState().preferences?.theme,'paper');await offline.dispose();
});
test('login keeps local guest records separate from signed-in account records',async()=>{
 const store=new LocalStore('guest-'+crypto.randomUUID());const client=new NoodlClient(store,async(path)=>Response.json(path==='/api/me'?{id:'account',name:'Account'}:path==='/api/snapshot'?{packs:[],attempts:[],reviews:[],cursor:1}:{}));
 await client.startGuest();const guest=client.getState().user!;await client.importLocalPack(input);await client.login();assert.equal(client.getState().guest,false);assert.equal(client.getState().packs.length,0);assert.equal((await store.read(guest.id)).records.length,1);await client.dispose();
});

test('activating guest storage stages the existing local bank once and keeps it available offline', async () => {
 const store = new LocalStore('guest-' + crypto.randomUUID());
 const owner = {id: 'web-guest:server', name: 'Guest'};
 const remote = new Map<string, Awaited<ReturnType<NoodlClient['importLocalPack']>>>();
 let writes = 0;
 const client = new NoodlClient(store, async (path, init) => {
  if (path === '/api/me' && !remote.size) return new Response('{}', {status: 401});
  if (path === '/api/guest') return Response.json(owner);
  assert.equal(new Headers(init?.headers).get('X-Noodl-Guest'), owner.id);
  if (path === '/api/mutate') {
   writes++;
   const [op] = JSON.parse(String(init?.body)).operations;
   assert.equal(op.expectedRevision, remote.get(op.entityId)?.revision ?? 0);
   remote.set(op.entityId, op.payload);
   return Response.json({results: [{operationId: op.id, ok: true, record: op.payload}]});
  }
  if (path === '/api/snapshot') return Response.json({packs: [...remote.values()], attempts: [], reviews: [], cursor: 2});
  if (path === '/api/publications' && init?.method === 'POST') {
   const {packId,expectedRevision} = JSON.parse(String(init.body));
   const pack = remote.get(packId);
   assert.equal(pack?.revision,expectedRevision);
   return Response.json({pack});
  }
  if (path === '/api/preferences') return Response.json({...await import('../src/shared/preferences').then(m => m.defaultPreferences()), ownerId: owner.id, revision: 0});
  return Response.json(owner);
 });
 await client.useLocalGuest();
 const pack = await client.importLocalPack(input);
 await client.enableGuestStorage();
 assert.equal(client.getState().packs[0].id, pack.id);
 assert.equal(client.getState().localOnly, false);
 assert.equal(client.getState().pending, 0);
 await client.enableGuestStorage();
 assert.equal(writes, 1);
 // Existing browsers may have only the workspace-wide marker from the old implementation.
 const metadata = (await store.db()).transaction('meta','readwrite');
 await metadata.store.delete(JSON.stringify([owner.id,'adopted-bank',pack.id]));
 await metadata.store.put(true,`${owner.id}:adopted-local-banks`);
 await metadata.done;
 await client.useLocalGuest();
 await client.renamePack(pack.id,pack.ownerId,{title:'Updated locally',folder:''});
 const newBank = await client.importLocalPack({...input,title:'New local bank'});
 assert.equal((await client.publishPack(pack.id)).pack?.title,'Updated locally');
 assert.equal((await client.publishPack(newBank.id)).pack?.title,'New local bank');
 assert.equal(writes,3);
 await client.useLocalGuest();
 await client.renamePack(pack.id,pack.ownerId,{title:'Divergent local edit',folder:''});
 const cloudPack = remote.get(pack.id)!;
 const remoteEdit = {...cloudPack,title:'Changed independently',revision:cloudPack.revision+1};
 remote.set(pack.id,remoteEdit);
 await store.merge(owner.id,{packs:[...remote.values()],attempts:[],reviews:[],cursor:2});
 await assert.rejects(()=>client.publishPack(pack.id),/belum tersalin/);
 assert.equal(remote.get(pack.id)?.title,'Changed independently');
 assert.equal(writes,3);
 await client.dispose();
});
