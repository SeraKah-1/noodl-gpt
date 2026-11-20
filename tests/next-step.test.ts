import assert from 'node:assert/strict';
import {test} from 'node:test';
import {studyNextStep} from '../src/shared/nextStep';
import {createAttempt} from '../src/shared/engine';
import type {Attempt,Pack,Question,ReviewEvent} from '../src/shared/types';

const now=Date.parse('2026-11-20T12:00:00Z');
const q=(id:string):Question=>({id,type:'TRUE_FALSE',text:'Question '+id,correctBoolean:true,difficulty:'Easy',explanation:'Explanation',conceptName:'Shared concept'});
const pack:Pack={id:'p1',ownerId:'owner',title:'Test bank',description:'',folder:'',tags:[],artifacts:[],questions:[q('one'),q('two')],revision:1,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'};
const options={mode:'STANDARD' as const,shuffle:false,retention:false,mixed:false};
function completed():Attempt{
 const a=createAttempt(pack,options,'owner');
 return {...a,status:'completed',completedAt:'2026-11-18T12:00:00Z',answers:a.items.map(i=>({occurrenceId:i.id,value:false,isCorrect:false,answeredAt:'2026-11-18T12:00:00Z'}))};
}
test('Today proposes creating a bank only when there is no material',()=>{
 assert.equal(studyNextStep([],[],[],now).kind,'empty');
 assert.equal(studyNextStep([pack],[],[],now).kind,'start');
});
test('new cards do not count as due and a saved attempt takes priority',()=>{
 const active=createAttempt(pack,options,'owner');
 assert.equal(studyNextStep([pack],[active],[],now).kind,'resume');
 const next=studyNextStep([pack],[],[],now);
 assert.equal(next.kind,'start');
});
test('scheduled overdue reviews take priority over weaker topics',()=>{
 const event:ReviewEvent={id:'review-1',packId:pack.id,cardId:pack.id+':one',questionId:'one',question:q('one'),rating:0,reviewedAt:'2026-11-10T12:00:00Z'};
 const choice=studyNextStep([pack],[completed(),completed()],[event],now);
 assert.equal(choice.kind,'review');
 if(choice.kind==='review')assert.equal(choice.count,1);
});
test('focus recommendation describes observed errors and reuses real questions',()=>{
 const choice=studyNextStep([pack],[completed(),completed()],[],now);
 assert.equal(choice.kind,'focus');
 if(choice.kind==='focus'){
  assert.equal(choice.misses,4);
  assert.equal(choice.observations,4);
  assert.equal(choice.questions.length,2);
  assert.match(choice.detail,/4 dari 4/);
 }
});
test('deleted banks cannot be selected even with historical answers',()=>{
 assert.equal(studyNextStep([{...pack,deletedAt:'2026-11-19T00:00:00Z'}],[completed()],[],now).kind,'empty');
});
