import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticQuestion,delayedQuestion,quickCheckQuestion,needsOptions,phaseSeconds,recallDelay,type Exposure} from '../src/shared/practice';
import {createAttempt,answerAttempt,finishAttempt} from '../src/shared/engine';
import type {Question,Pack} from '../src/shared/types';
const q:Question={id:'first',text:'What hormone stimulates ECL cells?',type:'MULTIPLE_CHOICE',correctOptionId:'a',
 options:[{id:'a',text:'Gastrin'},{id:'b',text:'Secretin'}],explanation:'Gastrin acts on ECL cells.',difficulty:'Medium',conceptName:'Acid secretion'};
const p:Pack={id:'bank',ownerId:'a',revision:1,title:'Test',description:'',folder:'',tags:[],createdAt:'',updatedAt:'',questions:[q],artifacts:[]};
const related={...q,id:'second',text:'What receptor binds histamine on parietal cells?'};
test('retention check needs an elapsed delay, a new stem and a concept shared with displayed cards',()=>{
 const session:Exposure={id:'s',startedAt:1,lastShownAt:2,activeMs:5000,shown:[{id:q.id,text:q.text,concept:'acid secretion'}]};
 const bank={...p,questions:[q,{...q,id:'duplicate'},related]};
 assert.equal(delayedQuestion(bank,session,[session],[],recallDelay),undefined);
 assert.equal(delayedQuestion(bank,session,[session],[],recallDelay+2)?.id,related.id);
 const historical=createAttempt(bank,{mode:'STANDARD',retention:false,mixed:false,shuffle:false},p.ownerId);
 assert.equal(delayedQuestion(bank,session,[session],[historical],recallDelay+2),undefined);
 assert.equal(delayedQuestion(bank,session,[session],[{...historical,ownerId:'other'}],recallDelay+2)?.id,related.id);
});
test('diagnostics ignore timeouts, unanswered questions and duplicate stems',()=>{
 const attempt=createAttempt(p,{mode:'TIME_RUSH',retention:false,shuffle:false,mixed:false},p.ownerId);
 const bank={...p,questions:[q,{...q,id:'duplicate'},related]};
 assert.equal(diagnosticQuestion(finishAttempt(attempt),[bank],[]),undefined);
 assert.equal(diagnosticQuestion(finishAttempt(answerAttempt(attempt,'b',attempt.deadline!)),[bank],[]),undefined);
 assert.equal(diagnosticQuestion(finishAttempt(answerAttempt(attempt,'b',attempt.deadline!-1)),[bank],[])?.question.id,'second');
});
test('autopilot preserves option-dependent stems and gives long choices reading time',()=>{
 assert.equal(needsOptions(q),false);
 assert.equal(needsOptions({...q,text:'Manakah pernyataan berikut yang benar?'}),true);
 assert.equal(needsOptions({...q,text:'What hormone from the following options is relevant?'}),true);
 assert.ok(phaseSeconds({...q,text:'long '.repeat(200)},false)>phaseSeconds(q,false));
});

test('immediate Quick Check selects an unseen distinct stem, never a displayed card',()=>{
 const session:Exposure={id:'quick',startedAt:1,lastShownAt:2,activeMs:5000,shown:[{id:q.id,text:q.text,concept:'acid secretion'}]};
 const bank={...p,questions:[q,{...q,id:'duplicate'},related]};
 assert.equal(quickCheckQuestion(bank,session,[session],[])?.id,'second');
 const prior=createAttempt(bank,{mode:'STANDARD',retention:false,mixed:false,shuffle:false},p.ownerId);
 assert.equal(quickCheckQuestion(bank,session,[session],[prior]),undefined);
 assert.equal(quickCheckQuestion(bank,session,[session],[{...prior,ownerId:'other'}])?.id,'second');
 assert.equal(quickCheckQuestion(bank,{...session,shown:[]},[session],[]),undefined);
});
