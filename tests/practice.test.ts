import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticQuestion,delayedQuestion,quickCheckQuestion,remediationQuestions,needsOptions,phaseSeconds,recallDelay,type Exposure} from '../src/shared/practice';
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

test('repair drill uses a different unseen question for a concept with an observed miss',()=>{
 const bank={...p,questions:[q,{...q,id:'duplicate'},related]};
 const first=createAttempt(bank,{mode:'STANDARD',retention:false,mixed:false,shuffle:false},p.ownerId,[{question:q,sourcePackId:bank.id}]);
 const missed=finishAttempt(answerAttempt(first,'b'));
 const candidates=remediationQuestions(missed,[bank],[],5);
 assert.deepEqual(candidates.map(x=>x.question.id),['second']);
 const previous=createAttempt(bank,{mode:'STANDARD',retention:false,mixed:false,shuffle:false},p.ownerId,[{question:related,sourcePackId:bank.id}]);
 const answeredPrevious=finishAttempt(answerAttempt(previous,'a'));
 assert.equal(remediationQuestions(missed,[bank],[answeredPrevious],5).length,0);
 assert.equal(remediationQuestions(missed,[{...bank,deletedAt:'2026-01-01T00:00:00Z'}],[],5).length,0);
});
test('repair drill does not misdiagnose unanswered, timed out or correctly answered questions',()=>{
 const bank={...p,questions:[q,related]};
 const session=createAttempt(bank,{mode:'STANDARD',retention:false,mixed:false,shuffle:false},p.ownerId,[{question:q,sourcePackId:bank.id}]);
 assert.deepEqual(remediationQuestions(finishAttempt(session),[bank],[]),[]);
 assert.deepEqual(remediationQuestions(finishAttempt(answerAttempt(session,'a')),[bank],[]),[]);
 const timeRush=createAttempt(bank,{mode:'TIME_RUSH',retention:false,mixed:false,shuffle:false},p.ownerId,[{question:q,sourcePackId:bank.id}]);
 const timedOut=finishAttempt(answerAttempt(timeRush,'',timeRush.deadline!));
 assert.deepEqual(remediationQuestions(timedOut,[bank],[]),[]);
});
