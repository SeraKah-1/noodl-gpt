import type {Attempt,Pack,Question} from './types';
import {normalizeAnswer} from './engine';

/**
 * Select one real, owned bank and distinct questions from saved content.
 * Prioritize unpresented questions, then least-shown repeats. No invented
 * questions or mastery estimates, and no passive exposure treated as recall.
 */
export function quickSession(packs:Pack[],attempts:Attempt[],requested:1|3):
 {pack:Pack;questions:Question[];unseen:number;repeated:number}|null {
 const eligible=packs.filter(p=>!p.deletedAt&&p.questions.length)
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
 if(!eligible.length)return null;
 const appearances=new Map<string,number>();
 const seenStems=new Map<string,number>();
 for(const attempt of attempts){
  for(const item of attempt.items){
   const key=item.sourcePackId+':'+item.sourceQuestionId;
   appearances.set(key,(appearances.get(key)??0)+1);
   const stem=normalizeAnswer(item.question.text);
   seenStems.set(stem,(seenStems.get(stem)??0)+1);
  }
 }
 const unseen=(pack:Pack)=>pack.questions.filter(q=>
  !(appearances.get(pack.id+':'+q.id)||seenStems.get(normalizeAnswer(q.text)))).length;
 const pack=eligible.find(p=>unseen(p)>0)??eligible[0];
 const ranked=pack.questions.map((question,index)=>{
  const own=appearances.get(pack.id+':'+question.id)??0;
  const shared=seenStems.get(normalizeAnswer(question.text))??0;
  return {question,index,exposure:Math.max(own,shared)};
 }).sort((a,b)=>a.exposure-b.exposure||a.index-b.index);
 const questions:Question[]=[], uniqueStems=new Set<string>();
 let unseenCount=0;
 for(const item of ranked){
  const stem=normalizeAnswer(item.question.text);
  if(uniqueStems.has(stem))continue;
  questions.push(item.question);
  uniqueStems.add(stem);
  if(item.exposure===0)unseenCount++;
  if(questions.length===requested)break;
 }
 if(!questions.length)return null;
 return {pack,questions,unseen:unseenCount,repeated:questions.length-unseenCount};
}
