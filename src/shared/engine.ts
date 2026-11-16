import type { Attempt, Occurrence, Pack, Progress, Question, ReviewCard, ReviewEvent, StudyOptions } from './types';
import { DomainError, validateQuestion, validateStudyOptions } from './validation';

export function normalizeAnswer(value: string): string { return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' '); }
export function evaluate(question: Question, value: string|boolean): boolean {
  if (question.type==='MULTIPLE_CHOICE') return typeof value==='string' && question.options?.some(o=>o.id===value)===true && value===question.correctOptionId;
  if (question.type==='TRUE_FALSE') return typeof value==='boolean' && value===question.correctBoolean;
  return typeof value==='string' && !!normalizeAnswer(value) && !!question.acceptedAnswers?.some(a=>normalizeAnswer(a)===normalizeAnswer(value));
}
export function correctAnswerText(q: Question): string {
  if(q.type==='MULTIPLE_CHOICE') return q.options?.find(o=>o.id===q.correctOptionId)?.text??'';
  if(q.type==='TRUE_FALSE') return q.correctBoolean?'Benar':'Salah';
  return q.acceptedAnswers?.[0]??'';
}
export function seededRandom(seed: string): ()=>number {
  let state=2166136261; for(const ch of seed) state=Math.imul(state^ch.charCodeAt(0),16777619);
  return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function shuffle<T>(input: T[], random: ()=>number):T[]{const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function transformToMixed(questions: Question[], seed='mixed'):Question[] {
  const random=seededRandom(seed);
  return questions.map((original,index)=>{
    const q=structuredClone(original);
    if(q.type!=='MULTIPLE_CHOICE'||index%3===0) return q;
    const correct=q.options?.find(o=>o.id===q.correctOptionId);if(!correct) return q;
    if(index%3===1){const options=q.options!;const proposed=options[Math.floor(random()*options.length)];const {options:_,correctOptionId:__,...base}=q;return {...base,type:'TRUE_FALSE',text:`${q.text}\n\nPernyataan: jawabannya adalah “${proposed.text}”.`,correctBoolean:proposed.id===q.correctOptionId};}
    const {options:_,correctOptionId:__,...base}=q;
    return {...base,type:'FILL_BLANK',acceptedAnswers:[correct.text]};
  });
}
export type SelectionItem = {question:Question;sourcePackId:string};
export function createAttempt(pack: Pack, options: StudyOptions, ownerId: string, selection?: SelectionItem[], now=Date.now()):Attempt {
  validateStudyOptions(options);
  if(pack.deletedAt) throw new DomainError('Cannot study a deleted pack');
  const attemptId=crypto.randomUUID();const random=seededRandom(attemptId);
  let source=(selection??pack.questions.map(question=>({question,sourcePackId:pack.id}))).map(s=>({...s,question:validateQuestion(s.question)}));
  if(!source.length) throw new DomainError('No questions selected');
  if(options.mixed){const transformed=transformToMixed(source.map(s=>s.question),attemptId);source=source.map((s,i)=>({...s,question:transformed[i]}));}
  if(options.shuffle) source=shuffle(source,random);
  const items:Occurrence[]=[];
  for(const s of source){const question=structuredClone(s.question);if(options.shuffle&&question.options) question.options=shuffle(question.options,random);items.push({id:crypto.randomUUID(),sourcePackId:s.sourcePackId,sourceQuestionId:s.question.id,question});}
  if(options.retention){const repeats=items.filter(()=>random()<0.6).map(item=>({...structuredClone(item),id:crypto.randomUUID()}));for(const item of repeats){const originalIndex=items.findIndex(i=>i.sourcePackId===item.sourcePackId&&i.sourceQuestionId===item.sourceQuestionId);const pos=originalIndex+1+Math.floor(random()*(items.length-originalIndex));items.splice(pos,0,item);}}
  const timestamp=new Date(now).toISOString();
  return {id:attemptId,ownerId,packId:pack.id,packRevision:pack.revision,title:pack.title,options:structuredClone(options),items,answers:[],currentIndex:0,lives:3,streak:0,deadline:options.mode==='TIME_RUSH'?now+20000:null,status:'active',createdAt:timestamp,updatedAt:timestamp,revision:0};
}
function updated(a: Attempt, now: number):Attempt{return {...structuredClone(a),updatedAt:new Date(now).toISOString(),revision:a.revision+1};}
export function answerAttempt(attempt: Attempt, value: string|boolean, now=Date.now()):Attempt {
  if(attempt.status==='completed') return attempt;
  const item=attempt.items[attempt.currentIndex];if(!item) throw new DomainError('No current question');
  if(attempt.answers.some(a=>a.occurrenceId===item.id)) return attempt;
  const q=item.question;
  const expired=attempt.options.mode==='TIME_RUSH' && attempt.deadline!==null && now>=attempt.deadline;
  if(!expired && ((q.type==='TRUE_FALSE'&&typeof value!=='boolean') || (q.type==='MULTIPLE_CHOICE'&&!q.options?.some(o=>o.id===value)) || (q.type==='FILL_BLANK'&&typeof value!=='string'))) throw new DomainError('Answer is not valid for this question');
  const result=updated(attempt,now);const isCorrect=!expired&&evaluate(q,value);
  result.answers.push({occurrenceId:item.id,value:expired?'':value,isCorrect,answeredAt:new Date(now).toISOString()});
  result.streak=isCorrect?result.streak+1:0;
  if(!isCorrect&&result.options.mode==='SURVIVAL') result.lives=Math.max(0,result.lives-1);
  result.deadline=null;
  return result;
}
export function advanceAttempt(attempt:Attempt,now=Date.now()):Attempt {
  if(attempt.status==='completed') return attempt;
  const item=attempt.items[attempt.currentIndex];
  if(!attempt.answers.some(a=>a.occurrenceId===item.id)) throw new DomainError('Answer current question before continuing');
  if(attempt.currentIndex>=attempt.items.length-1||(attempt.options.mode==='SURVIVAL'&&attempt.lives===0)) return finishAttempt(attempt,now);
  const result=updated(attempt,now);result.currentIndex++;result.deadline=result.options.mode==='TIME_RUSH'?now+20000:null;return result;
}
export function finishAttempt(attempt:Attempt,now=Date.now()):Attempt {
  if(attempt.status==='completed') return attempt;
  const result=updated(attempt,now);result.status='completed';result.completedAt=new Date(now).toISOString();result.deadline=null;return result;
}
export function progressFor(attempt:Attempt):Progress {
  const answers=new Map(attempt.answers.map(a=>[a.occurrenceId,a]));const topics=new Map<string,{name:string;correct:number;total:number}>();let correct=0;
  for(const item of attempt.items){const name=item.question.conceptName||'Umum';const topic=topics.get(name)??{name,correct:0,total:0};topic.total++;if(answers.get(item.id)?.isCorrect){correct++;topic.correct++;}topics.set(name,topic);}
  return {total:attempt.items.length,correct,score:attempt.items.length?Math.round(correct/attempt.items.length*100):0,topics:[...topics.values()]};
}
export function replayReviews(events:ReviewEvent[]):ReviewCard[]{
  const cards=new Map<string,ReviewCard>();const seen=new Set<string>();
  const sorted=[...events].sort((a,b)=>Date.parse(a.reviewedAt)-Date.parse(b.reviewedAt)||a.id.localeCompare(b.id));
  for(const e of sorted){if(seen.has(e.id))continue;seen.add(e.id);if(!Number.isFinite(Date.parse(e.reviewedAt))||![0,1,2,3].includes(e.rating)) throw new DomainError('Invalid review event');
    const old=cards.get(e.cardId);let easiness=old?.easiness??2.5,interval=old?.interval??0,repetition=old?.repetition??0;
    const q=[0,3,4,5][e.rating];easiness=Math.max(1.3,easiness+(0.1-(5-q)*(0.08+(5-q)*0.02)));let minutes=0;
    if(e.rating===0){repetition=0;interval=0;minutes=1;}
    else if(e.rating===1){if(repetition===0)minutes=10;else{interval=Math.max(1,Math.round(interval*1.2));minutes=interval*1440;}}
    else if(e.rating===2){interval=repetition===0?1:repetition===1?3:Math.round(interval*easiness);repetition++;minutes=interval*1440;}
    else{interval=repetition===0?4:Math.round(interval*easiness*1.3);repetition++;minutes=interval*1440;}
    if(minutes>60) minutes*=0.95+seededRandom(e.id)()*0.1;
    cards.set(e.cardId,{id:e.cardId,packId:e.packId,questionId:e.questionId,question:structuredClone(e.question),easiness,interval,repetition,nextReview:new Date(Date.parse(e.reviewedAt)+minutes*60000).toISOString(),updatedAt:e.reviewedAt});
  }
  return [...cards.values()].sort((a,b)=>a.nextReview.localeCompare(b.nextReview)||a.id.localeCompare(b.id));
}
