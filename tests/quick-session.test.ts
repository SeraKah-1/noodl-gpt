import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quickSession} from '../src/shared/quickSession';
import {createAttempt} from '../src/shared/engine';
import type {Attempt,Pack,Question} from '../src/shared/types';

const makeQuestion=(id:string,concept:string):Question=>({
 id,type:'TRUE_FALSE',text:'Statement '+id+'?',correctBoolean:true,
 difficulty:'Easy',explanation:'Verified from a test fixture',conceptName:concept
});
const sample=(id:string,ids:string[],date='2026-11-20T00:00:00.000Z'):Pack=>({
 id,ownerId:'learner',title:id,description:'',folder:'',tags:[],createdAt:date,updatedAt:date,
 revision:1,questions:ids.map((q,i)=>makeQuestion(q,'topic'+(i%3))),artifacts:[]
});
const saved=(pack:Pack,questions:Question[]):Attempt=>{
 const a=createAttempt(pack,{mode:'BATCH',batchSize:questions.length,shuffle:false,retention:false,mixed:false},
  'learner',questions.map(q=>({question:q,sourcePackId:pack.id})));
 return a;
};

test('Quick 1 and Short Batch 3 use real questions and accurately label repeats',()=>{
 const pack=sample('recent',['a','b','c','d']);
 const once=quickSession([pack],[],1)!;
 assert.equal(once.pack.id,pack.id);
 assert.deepEqual(once.questions.map(q=>q.id),['a']);
 assert.deepEqual([once.unseen,once.repeated],[1,0]);
 const after=[saved(pack,once.questions)];
 const three=quickSession([pack],after,3)!;
 assert.deepEqual(three.questions.map(q=>q.id),['b','c','d']);
 assert.deepEqual([three.unseen,three.repeated],[3,0]);
 const allSeen=[...after,saved(pack,three.questions)];
 const retry=quickSession([pack],allSeen,1)!;
 assert.equal(retry.unseen,0);
 assert.equal(retry.repeated,1);
 assert.equal(retry.questions[0].id,'a');
});

test('Quick sessions refuse to fabricate questions or replay duplicate stems as distinct',()=>{
 assert.equal(quickSession([],[],1),null);
 const pack=sample('small',['a','b']);
 pack.questions[1].text=pack.questions[0].text;
 const single=quickSession([pack],[],3)!;
 assert.equal(single.questions.length,1);
 assert.equal(single.unseen,1);
 assert.equal(single.repeated,0);
});

test('quick session starts from a bank with unseen questions, not a cosmetically newer repeated bank',()=>{
 const seenBank=sample('seen',['a'],'2026-11-21T00:00:00.000Z');
 const unseenBank=sample('fresh',['b'],'2026-11-20T00:00:00.000Z');
 const result=quickSession([seenBank,unseenBank],[saved(seenBank,seenBank.questions)],1)!;
 assert.equal(result.pack.id,'fresh');
 assert.equal(result.unseen,1);
});
