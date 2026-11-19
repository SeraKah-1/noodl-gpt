import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,correctAnswerText,createAttempt,answerAttempt,advanceAttempt,finishAttempt,itemsToRetry,progressFor,replayReviews,transformToMixed} from '../src/shared/engine';
import {validateQuestion,validatePackInput,validateAttempt} from '../src/shared/validation';
import type {Pack,Question,ReviewEvent,StudyOptions} from '../src/shared/types';
const now=Date.parse('2026-11-15T10:00:00Z');
const mcq=(id='q'):Question=>({id,type:'MULTIPLE_CHOICE',text:'Which vitamin?',options:[{id:'a',text:'Vitamin A'},{id:'b',text:'Vitamin D'}],correctOptionId:'b',explanation:'Vitamin D is relevant; hepatitis B is a different concept.',difficulty:'Easy',conceptName:'Vitamins'});
const fill:Question={id:'fill',type:'FILL_BLANK',text:'Signed value?',acceptedAnswers:['-5'],explanation:'The sign matters.',difficulty:'Medium',conceptName:'Math'};
const tf:Question={id:'tf',type:'TRUE_FALSE',text:'Vitamin D is a vitamin.',correctBoolean:true,explanation:'Yes.',difficulty:'Easy'};
const pack=(questions:Question[]=[mcq(),fill,tf]):Pack=>({id:'p',ownerId:'a',title:'Test',description:'',folder:'',tags:[],questions,artifacts:[],revision:1,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()});
const opts:StudyOptions={mode:'STANDARD',shuffle:false,retention:false,mixed:false};
test('isian preserves signs and requires complete accepted answers, not substring matching',()=>{
 assert.equal(evaluate(fill,'  -5  '),true);for(const wrong of ['5','+5','-50',''])assert.equal(evaluate(fill,wrong),false);
 assert.equal(evaluate({...fill,acceptedAnswers:['Sodium chloride']},' sodium   CHLORIDE '),true);
});
test('every question type resolves a real answer and rejects impossible choice values',()=>{
 assert.equal(correctAnswerText(fill),'-5');assert.equal(correctAnswerText(tf),'Benar');assert.equal(correctAnswerText(mcq()),'Vitamin D');
 assert.equal(evaluate(mcq(),'missing-option'),false);assert.equal(evaluate(tf,'true'),false);assert.equal(evaluate(tf,true),true);
});
test('mixed conversion leaves existing types intact and never rewrites scientific prose',()=>{
 const source=[mcq('one'),mcq('two'),mcq('three'),fill,tf];const converted=transformToMixed(source,'fixed');
 assert.equal(converted[1].type,'TRUE_FALSE');assert.equal(converted[2].type,'FILL_BLANK');assert.deepEqual(converted[3],fill);assert.deepEqual(converted[4],tf);
 for(const q of converted){assert.doesNotThrow(()=>validateQuestion(q));assert.equal(q.explanation,source.find(s=>s.id===q.id)!.explanation);}
 assert.equal(source[1].type,'MULTIPLE_CHOICE');
});
test('validators reject duplicate IDs and malformed options atomically while retaining concept metadata',()=>{
 assert.throws(()=>validatePackInput(pack([mcq(),mcq()])));assert.throws(()=>validateQuestion({...mcq(),options:[{id:'a',text:''},{id:'b',text:'Good'}]}));
 const valid=validatePackInput(pack());assert.equal(valid.questions[0].conceptName,'Vitamins');assert.equal(valid.questions[0].correctOptionId,'b');
});
test('retention occurrences are unique and persisted resume preserves the actual shuffled snapshot',()=>{
 const original=crypto.randomUUID;let id=0;
 crypto.randomUUID=(()=>`00000000-0000-4000-8000-${String(id++).padStart(12,'0')}`) as typeof crypto.randomUUID;
 let attempt;try{attempt=createAttempt(pack(Array.from({length:30},(_,i)=>mcq(`q${i}`))),{...opts,retention:true,shuffle:true},'a',undefined,now);}finally{crypto.randomUUID=original;}
 assert.ok(attempt.items.length>30);assert.equal(new Set(attempt.items.map(i=>i.id)).size,attempt.items.length);
 const first=attempt.items[0];const answered=answerAttempt(attempt,first.question.correctOptionId!,now+1);const resumed=validateAttempt(JSON.parse(JSON.stringify(answered)));
 assert.deepEqual(resumed.items,answered.items);assert.deepEqual(resumed.answers,answered.answers);
 const changed=pack();changed.questions[0].text='Edited';assert.notEqual(resumed.items[0].question.text,changed.questions[0].text);
 assert.deepEqual(answerAttempt(answered,first.question.correctOptionId!,now+2),answered,'answer retries are harmless');
});
test('Time Rush expiry remains wrong even when a correct value is supplied after reload',()=>{
 const attempt=createAttempt(pack([mcq()]),{...opts,mode:'TIME_RUSH'},'a',undefined,now);
 const resumed=validateAttempt(JSON.parse(JSON.stringify(attempt)));assert.equal(resumed.deadline,now+20000);
 const expired=answerAttempt(resumed,'b',now+20001);assert.equal(expired.answers[0].isCorrect,false);assert.equal(expired.deadline,null);
 assert.equal(advanceAttempt(expired,now+20002).status,'completed');
});
test('Survival ends on third mistake and immutable input remains untouched',()=>{
 let a=createAttempt(pack([mcq('a'),mcq('b'),mcq('c'),mcq('d')]),{...opts,mode:'SURVIVAL'},'a',undefined,now);const original=structuredClone(a);
 for(let i=0;i<3;i++){a=answerAttempt(a,'a',now+i*2);a=advanceAttempt(a,now+i*2+1);}
 assert.equal(a.status,'completed');assert.equal(a.lives,0);assert.equal(a.answers.length,3);assert.equal(original.answers.length,0);assert.equal(original.lives,3);
});
test('topic accuracy joins occurrence IDs and counts repeated questions independently',()=>{
 const p=pack([mcq()]);let a=createAttempt(p,opts,'a',[{question:mcq(),sourcePackId:'p'},{question:mcq(),sourcePackId:'p'}],now);
 a=advanceAttempt(answerAttempt(a,'b',now+1),now+2);a=answerAttempt(a,'a',now+3);const stats=progressFor(a);
 assert.equal(stats.total,2);assert.equal(stats.correct,1);assert.equal(stats.score,50);assert.deepEqual(stats.topics,[{name:'Vitamins',total:2,correct:1}]);
});
test('SRS replay is deterministic across arrival order and duplicate event retries',()=>{
 const event=(id:string,rating:ReviewEvent['rating'],offset:number):ReviewEvent=>({id,cardId:'p:q',packId:'p',questionId:'q',question:mcq(),rating,reviewedAt:new Date(now+offset).toISOString()});
 const a=event('e1',2,0),b=event('e2',3,60000),c=event('e3',0,120000);
 assert.deepEqual(replayReviews([b,a,b]),replayReviews([a,b]));const before=replayReviews([a,b]);assert.equal(before[0].repetition,2);
 const after=replayReviews([c,b,a]);assert.equal(after[0].repetition,0);assert.equal(Date.parse(after[0].nextReview),now+180000);
});

test('retry includes unanswered Survival questions and excludes correct answers',()=>{
 let a=createAttempt(pack([mcq('first'),mcq('second'),mcq('third')]),{...opts,mode:'SURVIVAL'},'a',undefined,now);
 a=advanceAttempt(answerAttempt(a,'b',now),now);
 a=finishAttempt(answerAttempt(a,'a',now),now);
 assert.deepEqual(itemsToRetry(a).map(item=>item.sourceQuestionId),['second','third']);
});

test('a long review history caps Easy intervals at one year',()=>{
 const reviews:ReviewEvent[]=Array.from({length:30},(_,i)=>({
  id:`review-${i}`,cardId:'p:q',packId:'p',questionId:'q',question:mcq(),rating:3,
  reviewedAt:new Date(now+i*60_000).toISOString()
 }));
 const [card]=replayReviews(reviews);
 assert.equal(card.interval,365);
 assert.equal(card.repetition,30);
 assert.ok(Date.parse(card.nextReview)>Date.parse(card.updatedAt));
 assert.ok(Date.parse(card.nextReview)-Date.parse(card.updatedAt)<=365*86_400_000);
});
