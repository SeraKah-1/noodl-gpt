import type {Attempt,Pack,Question,ReviewEvent} from './types';
import {replayReviews} from './engine';

export type StudyNextStep =
 | {kind:'resume';attempt:Attempt;title:string;detail:string}
 | {kind:'review';count:number;title:string;detail:string}
 | {kind:'focus';pack:Pack;questions:Question[];title:string;detail:string;misses:number;observations:number}
 | {kind:'start';pack:Pack;title:string;detail:string}
 | {kind:'empty';title:string;detail:string};

/**
 * A deterministic recommendation, never an inferred "mastery" score.
 * Priority: saved active work > scheduled due review > repeatedly missed
 * concepts with a valid source bank > most recently changed bank > create.
 * Replays review events without treating unseen cards as overdue.
 */
export function studyNextStep(packs:Pack[],attempts:Attempt[],reviews:ReviewEvent[],now=Date.now()):StudyNextStep {
 const valid=packs.filter(p=>!p.deletedAt);
 const recent=valid.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const active=attempts.filter(a=>a.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 if(active)return {kind:'resume',attempt:active,title:active.title,detail:`${active.options.mode==='BATCH'?Object.keys(active.draft??{}).length:active.answers.length} dari ${active.items.length} soal terisi · sesi tersimpan`};
 const current=new Set(valid.flatMap(p=>p.questions.map(q=>p.id+':'+q.id)));
 const due=replayReviews(reviews.filter(e=>!('deletedAt' in e))).filter(c=>current.has(c.id)&&Date.parse(c.nextReview)<=now).length;
 if(due>0)return {kind:'review',count:due,title:due===1?'1 kartu perlu diulang':`${due} kartu perlu diulang`,detail:'Review yang sudah mencapai jadwal. Kartu baru tidak dihitung jatuh tempo.'};
 const byConcept=new Map<string,{pack:Pack;name:string;wrong:number;total:number;questions:Map<string,Question>}>();
 const ids=new Map(valid.map(p=>[p.id,p]));
 for(const attempt of attempts.filter(a=>a.status==='completed'&&!a.diagnostic)){
  const items=new Map(attempt.items.map(i=>[i.id,i]));
  for(const answer of attempt.answers){
   const item=items.get(answer.occurrenceId);if(!item)continue;
   const pack=ids.get(item.sourcePackId);
   const question=pack?.questions.find(q=>q.id===item.sourceQuestionId);
   if(!pack||!question||!question.conceptName?.trim())continue;
   const key=pack.id+'::'+question.conceptName.trim().toLocaleLowerCase();
   const entry=byConcept.get(key)??{pack,name:question.conceptName,wrong:0,total:0,questions:new Map<string,Question>()};
   entry.total++;
   if(!answer.isCorrect){entry.wrong++;entry.questions.set(question.id,question);}
   byConcept.set(key,entry);
  }
 }
 const target=[...byConcept.values()].filter(v=>v.wrong>=2&&v.questions.size>0)
  .sort((a,b)=>b.wrong-a.wrong || b.wrong/b.total-a.wrong/a.total)[0];
 if(target)return {kind:'focus',pack:target.pack,questions:[...target.questions.values()].slice(0,5),
  title:target.name,detail:`${target.wrong} dari ${target.total} jawaban pada konsep ini salah. Uji kembali soal yang pernah keliru.`,misses:target.wrong,observations:target.total};
 const first=recent[0];
 if(first)return {kind:'start',pack:first,title:first.title,detail:`${first.questions.length} soal · bank terbaru`};
 return {kind:'empty',title:'Mulai dari satu bank soal',detail:'Minta ChatGPT membuat bank melalui MCP atau buat soal secara manual.'};
}
