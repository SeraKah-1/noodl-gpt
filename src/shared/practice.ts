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
