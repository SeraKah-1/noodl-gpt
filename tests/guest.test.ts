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
 let remote: Awaited<ReturnType<NoodlClient['importLocalPack']>> | undefined;
 let writes = 0;
 const client = new NoodlClient(store, async (path, init) => {
  if (path === '/api/me' && !remote) return new Response('{}', {status: 401});
  if (path === '/api/guest') return Response.json(owner);
  assert.equal(new Headers(init?.headers).get('X-Noodl-Guest'), owner.id);
  if (path === '/api/mutate') {
   writes++;
   const [op] = JSON.parse(String(init?.body)).operations;
   remote = op.payload;
   return Response.json({results: [{operationId: op.id, ok: true, record: remote}]});
  }
  if (path === '/api/snapshot') return Response.json({packs: remote ? [remote] : [], attempts: [], reviews: [], cursor: 1});
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
 assert.equal((await store.read(pack.ownerId)).records.length, 1);
 await client.dispose();
});
