import {replayReviews} from './engine';
import type {Attempt,Pack,Snapshot} from './types';

type ContextOptions={packId?:string;limit?:number};
type Gap={packId:string;concept:string;incorrect:number;observations:number;unseenQuestions:number};

/** Server-owned snapshot -> answer-key-free study summary. No inferred mastery metrics. */
export function createStudyContext(snapshot:Snapshot,options:ContextOptions={},nowMs=Date.now()){
 const packs=snapshot.packs.filter(p=>!p.deletedAt&&(!options.packId||p.id===options.packId));
 if(options.packId&&!packs.length)throw new Error('Pack not found');
 const limit=options.limit??5;
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new Error('Limit must be 1..20');
 const packIds=new Set(packs.map(p=>p.id));
 const available=new Map(packs.map(p=>[p.id,new Set(p.questions.map(q=>q.id))]));
 const attempts=snapshot.attempts.filter(a=>!(a as Attempt&{deletedAt?:string}).deletedAt&&packIds.has(a.packId));
 const active=attempts.filter(a=>a.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const events=snapshot.reviews.filter(e=>!(e as typeof e&{deletedAt?:string}).deletedAt&&packIds.has(e.packId));
 const due=replayReviews(events).filter(c=>Date.parse(c.nextReview)<=nowMs&&!!available.get(c.packId)?.has(c.questionId));
 const completed=attempts.filter(a=>a.status==='completed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,20);
 const seen=new Set<string>();
 for(const attempt of attempts)for(const item of attempt.items){
  if(packIds.has(item.sourcePackId))seen.add(item.sourcePackId+':'+item.sourceQuestionId);
 }
 const gaps=new Map<string,Gap>();
 for(const attempt of completed){
  const items=new Map(attempt.items.map(item=>[item.id,item]));
  for(const answer of attempt.answers){
   const item=items.get(answer.occurrenceId);
   if(!item||!packIds.has(item.sourcePackId))continue;
   const concept=item.question.conceptName?.trim()||'Umum';
   const key=item.sourcePackId+':'+concept;
   const current=gaps.get(key)??{packId:item.sourcePackId,concept,incorrect:0,observations:0,unseenQuestions:0};
   current.observations++;
   if(!answer.isCorrect)current.incorrect++;
   gaps.set(key,current);
  }
 }
 for(const gap of gaps.values()){
  const pack=packs.find(p=>p.id===gap.packId);
  gap.unseenQuestions=pack?.questions.filter(q=>(q.conceptName?.trim()||'Umum')===gap.concept&&!seen.has(pack.id+':'+q.id)).length??0;
 }
 const missed=[...gaps.values()].filter(x=>x.incorrect>0)
  .sort((a,b)=>b.incorrect-a.incorrect||b.observations-a.observations).slice(0,limit);
 let nextAction:{kind:string;reason:string;attemptId?:string;packId?:string;dueCount?:number}|null=null;
 if(active)nextAction={kind:'resume_attempt',reason:'A saved session is still active.',attemptId:active.id,packId:active.packId};
 else if(due.length)nextAction={kind:'review_due',reason:'Scheduled review cards are due now.',dueCount:due.length};
 else if(missed.length)nextAction={kind:missed[0].unseenQuestions?'practice_gap':'create_followup',
  reason:missed[0].unseenQuestions?'An observed missed concept has unseen questions.':'Observed missed concepts have no unseen question in the current bank.',
  packId:missed[0].packId};
 else if(packs.length)nextAction={kind:'start_practice',reason:'No active work or due review in this scope.',packId:packs[0].id};
 return {
  version:1,generatedAt:new Date(nowMs).toISOString(),
  scope:{packId:options.packId??null},
  bankCount:packs.length,
  banks:packs.slice(0,limit).map((p:Pack)=>({id:p.id,title:p.title,revision:p.revision,questionCount:p.questions.length,artifactCount:p.artifacts.length})),
  activeAttempt:active?{id:active.id,packId:active.packId,mode:active.options.mode,revision:active.revision,
   answered:Math.max(active.answers.length,Object.keys(active.draft??{}).length),total:active.items.length}:null,
  dueReviews:{count:due.length,packIds:[...new Set(due.map(c=>c.packId))].slice(0,limit)},
  evidence:{completedSessionsSampled:completed.length,observedGaps:missed},
  nextAction
 };
}
