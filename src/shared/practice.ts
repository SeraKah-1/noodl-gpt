import type {Attempt, Occurrence, Pack, Question} from './types';
import {createAttempt, normalizeAnswer} from './engine';

export const recallDelay=2*24*60*60*1000;
export interface Exposure {
  id:string; startedAt:number; lastShownAt:number; activeMs:number;
  shown:{id:string;text:string;concept:string}[];

}

export function concept(q:Question){return normalizeAnswer(q.conceptName??'');}

function answeredQuestions(owner:string,history:Attempt[]){
  const texts=new Set<string>(),byPack=new Map<string,Set<string>>();
  for(const attempt of history){
    if(attempt.ownerId!==owner)continue;
    const answered=new Set(attempt.answers.map(a=>a.occurrenceId));
    for(const item of attempt.items){
      if(!answered.has(item.id))continue;
      texts.add(normalizeAnswer(item.question.text));
      let ids=byPack.get(item.sourcePackId);
      if(!ids){ids=new Set();byPack.set(item.sourcePackId,ids);}
      ids.add(item.sourceQuestionId);
    }
  }
  return (packId:string,q:Question)=>texts.has(normalizeAnswer(q.text))||byPack.get(packId)?.has(q.id)===true;
}
export function diagnosticQuestion(source:Attempt,packs:Pack[],history:Attempt[]){
  if(source.status!=='completed'||source.diagnostic)return;
  const items=new Map(source.items.map(i=>[i.id,i]));
  const misses=source.answers.filter(a=>!a.isCorrect&&a.value!=='');
  if(!misses.length)return;
  const seen=answeredQuestions(source.ownerId,[source,...history.filter(a=>a.id!==source.id)]);
  const banks=packs.filter(p=>!p.deletedAt&&p.ownerId===source.ownerId);
  for(const answer of misses){
    const missed=items.get(answer.occurrenceId);
    if(!missed||!concept(missed.question))continue;
    banks.sort((a,b)=>Number(b.id===missed.sourcePackId)-Number(a.id===missed.sourcePackId));
    for(const pack of banks){
      const question=pack.questions.find(q=>concept(q)===concept(missed.question)&&!seen(pack.id,q));
      if(question)return {pack,question,missed};
    }
  }
}
// Reserve another distinct question from the same bank for a possible follow-up.

/**
 * Build a real repair drill from different, unanswered questions.
 * Only concepts with recorded incorrect answers qualify. Timeouts without a
 * submitted response are not treated as diagnosed misconceptions.
 * No inferred mastery, generated content, or duplicated question stems.
 */
export function remediationQuestions(source:Attempt,packs:Pack[],history:Attempt[],limit=5):
 {pack:Pack;question:Question}[]{
 if(source.status!=='completed'||source.diagnostic||limit<1)return [];
 const misses=new Map<string,{name:string;sourcePackId:string;count:number}>();
 const items=new Map(source.items.map(i=>[i.id,i]));
 for(const answer of source.answers){
  if(answer.isCorrect||answer.value==='')continue;
  const item=items.get(answer.occurrenceId);
  if(!item)continue;
  const name=concept(item.question);
  if(!name)continue;
  const v=misses.get(name)??{name,sourcePackId:item.sourcePackId,count:0};
  v.count++;misses.set(name,v);
 }
 const bankList=packs.filter(p=>p.ownerId===source.ownerId&&!p.deletedAt);
 const seen=answeredQuestions(source.ownerId,[source,...history.filter(a=>a.id!==source.id)]);
 const selected:{pack:Pack;question:Question}[]=[],used=new Set<string>();
 const groups=[...misses.values()].sort((a,b)=>b.count-a.count);
 let changed=true;
 while(selected.length<Math.min(20,Math.trunc(limit))&&changed){
  changed=false;
  for(const group of groups){
   const sorted=bankList.slice().sort((a,b)=>Number(b.id===group.sourcePackId)-Number(a.id===group.sourcePackId));
   const found=sorted.flatMap(pack=>pack.questions.map(question=>({pack,question}))).find(({pack,question})=>
    concept(question)===group.name&&!seen(pack.id,question)&&!used.has(normalizeAnswer(question.text)));
   if(!found)continue;
   used.add(normalizeAnswer(found.question.text));
   // Already selected questions are not in history. Exclude them explicitly.
   selected.push(found);changed=true;
   if(selected.length>=Math.min(20,Math.trunc(limit)))break;
  }
 }
 return selected;
}

export function firstProbe(pack:Pack,history:Attempt[]){
  const seen=answeredQuestions(pack.ownerId,history);
  const first=new Map<string,Question>();
  for(const q of pack.questions){
    const topic=concept(q);
    if(!topic||seen(pack.id,q))continue;
    const prior=first.get(topic);
    if(prior&&normalizeAnswer(prior.text)!==normalizeAnswer(q.text))return prior;
    first.set(topic,q);
  }
}
export function validDiagnostic(source:Attempt,missedId:string,follow:Attempt){
  const missed=source.items.find(i=>i.id===missedId);
  const answer=source.answers.find(a=>a.occurrenceId===missedId);
  const next=follow.items[0];
  return source.status==='completed'&&!source.diagnostic&&source.ownerId===follow.ownerId&&
    !!missed&&!!answer&&!answer.isCorrect&&answer.value!==''&&follow.items.length===1&&
    !!concept(missed.question)&&concept(missed.question)===concept(next.question)&&
    !(missed.sourcePackId===next.sourcePackId&&missed.sourceQuestionId===next.sourceQuestionId)&&
    normalizeAnswer(missed.question.text)!==normalizeAnswer(next.question.text);
}
export function singleQuestion(pack:Pack,question:Question){
  return createAttempt(pack,{mode:'BATCH',shuffle:false,retention:false,mixed:false,batchSize:1},pack.ownerId,[{question,sourcePackId:pack.id}]);
}
export async function diagnosticAttempt(source:Attempt,choice:{pack:Pack;question:Question;missed:Occurrence}){
  const attempt=singleQuestion(choice.pack,choice.question);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([source.ownerId,source.id])));
  attempt.id='diagnostic-'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  attempt.diagnostic={attemptId:source.id,occurrenceId:choice.missed.id};
  return attempt;
}
/** Optional immediate retention probe. It must be a different, unseen stem.
 * Seeing the source cards never creates a score or review rating. */
export function quickCheckQuestion(pack:Pack,session:Exposure,exposures:Exposure[],attempts:Attempt[]):Question|undefined{
 if(!session.shown.length)return;
 const concepts=new Set(session.shown.map(x=>x.concept).filter(Boolean));
 const shown=[...session.shown,...exposures.flatMap(e=>e.shown)];
 const ids=new Set(shown.map(x=>x.id));
 const texts=new Set(shown.map(x=>normalizeAnswer(x.text)));
 for(const attempt of attempts.filter(a=>a.ownerId===pack.ownerId)){
  for(const item of attempt.items){
   texts.add(normalizeAnswer(item.question.text));
   if(item.sourcePackId===pack.id)ids.add(item.sourceQuestionId);
  }
 }
 return pack.questions.find(q=>concepts.has(concept(q))&&!ids.has(q.id)&&!texts.has(normalizeAnswer(q.text)));
}

export function delayedQuestion(pack:Pack,session:Exposure,exposures:Exposure[],attempts:Attempt[],now=Date.now()){
  if(now-session.lastShownAt<recallDelay)return;
  const concepts=new Set(session.shown.map(s=>s.concept).filter(Boolean));
  const shown=exposures.flatMap(e=>e.shown);
  const ids=new Set(shown.map(q=>q.id)),texts=new Set(shown.map(q=>normalizeAnswer(q.text)));
  for(const attempt of attempts){
    if(attempt.ownerId!==pack.ownerId)continue;
    for(const item of attempt.items){
      texts.add(normalizeAnswer(item.question.text));
      if(item.sourcePackId===pack.id)ids.add(item.sourceQuestionId);
    }
  }
  return pack.questions.find(q=>concepts.has(concept(q))&&!ids.has(q.id)&&!texts.has(normalizeAnswer(q.text)));
}
export function phaseSeconds(question:Question,answer:boolean){
  const passage=answer?question.explanation:[question.text,...(question.options??[]).map(o=>o.text)].join(' ');
  return Math.max(5,Math.min(60,Math.ceil(passage.trim().split(/\s+/).length/2.5)+(answer?3:question.difficulty==='Hard'?10:6)));
}

// Only hide legacy options when the stem asks a self-contained factual question.
export function needsOptions(q:Question){
  if(q.type!=='MULTIPLE_CHOICE')return false;
  const stem=normalizeAnswer(q.text);
  if(/\b(berikut|berikutnya|pilihan|kecuali|pernyataan|dibawah|following|except|below|options|statements|these|those)\b|di bawah/.test(stem))return true;
  return !/^(siapa|kapan|di mana|dimana|berapa|apa (nama|fungsi|peran|penyebab)|who|when|where|how many|what (organ|enzyme|hormone))\b.*\?$/.test(stem);
}
