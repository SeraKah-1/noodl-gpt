import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NoodlClient,LocalStore} from '../src/client/index';
import {createAttempt,answerAttempt} from '../src/shared/engine';
const input={title:'Guest bank',questions:[{id:'q',type:'FILL_BLANK',text:'2+2',acceptedAnswers:['4'],explanation:'Four',difficulty:'Easy'}]};
test('anonymous visitor can import, study, set preferences and reload without server mutations',async()=>{
 const name='guest-'+crypto.randomUUID();let writes=0;
 const fetcher:typeof fetch=async(_url,init)=>{if(init?.method!=='GET')writes++;return new Response('{}',{status:401});};
 const client=new NoodlClient(new LocalStore(name),fetcher);await client.initialize();assert.equal(client.getState().guest,true);
 const pack=await client.importLocalPack(input);await client.saveAttempt(answerAttempt(createAttempt(pack,{mode:'STANDARD',shuffle:false,mixed:false,retention:false},pack.ownerId),'4'));
 await client.updatePreferences({theme:'paper'});await client.sync();assert.equal(client.getState().pending,0);assert.equal(writes,0);await client.dispose();
 const offline=new NoodlClient(new LocalStore(name),async()=>{throw Error('offline');});await offline.initialize();assert.equal(offline.getState().guest,true);assert.equal(offline.getState().packs.length,1);assert.equal(offline.getState().attempts[0].answers[0].isCorrect,true);assert.equal(offline.getState().preferences?.theme,'paper');await offline.dispose();
});
test('login keeps local guest records separate from signed-in account records',async()=>{
 const store=new LocalStore('guest-'+crypto.randomUUID());const client=new NoodlClient(store,async(path)=>Response.json(path==='/api/me'?{id:'account',name:'Account'}:path==='/api/snapshot'?{packs:[],attempts:[],reviews:[],cursor:1}:{}));
 await client.startGuest();const guest=client.getState().user!;await client.importLocalPack(input);await client.login();assert.equal(client.getState().guest,false);assert.equal(client.getState().packs.length,0);assert.equal((await store.read(guest.id)).records.length,1);await client.dispose();
});
