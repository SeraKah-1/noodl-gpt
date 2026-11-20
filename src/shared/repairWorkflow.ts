import type {Attempt,Pack,Question,Snapshot} from './types';
import {concept} from './practice';
import {normalizeAnswer} from './engine';

export interface RepairCandidate{pack:Pack;question:Question;concept:string;observedMisses:number;}
export interface RepairPlan{
 available:boolean;sourceAttemptId:string;limit:number;availableCount:number;
 diagnosedConcepts:{name:string;misses:number;unansweredAlternatives:number}[];
 candidates:RepairCandidate[];
 reason?:string;
}

/**
 * An independent repair check must be different from EVERY question
 * previously presented in a saved session, not merely unanswered.
 * Quiz/source content is never fabricated when the evidence is insufficient.
 */
export function planRepairPractice(source:Attempt,snapshot:Snapshot,limit=5):RepairPlan {
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new Error('Repair limit must be 1..20');
 if(source.status!=='completed')return {available:false,sourceAttemptId:source.id,limit,availableCount:0,
  diagnosedConcepts:[],candidates:[],reason:'Complete the original session before creating independent repair practice.'};
 if(source.diagnostic)return {available:false,sourceAttemptId:source.id,limit,availableCount:0,
  diagnosedConcepts:[],candidates:[],reason:'A diagnostic follow-up is not a new source of independent repair evidence.'};
 const ownedPacks=snapshot.packs.filter(p=>!p.deletedAt&&p.ownerId===source.ownerId);
 const ownedIds=new Set(ownedPacks.map(p=>p.id));
 const priorAttempts=snapshot.attempts.filter(a=>a.ownerId===source.ownerId&&!(a as Attempt&{deletedAt?:string}).deletedAt);
 const shownIds=new Set<string>(),shownStems=new Set<string>();
 for(const attempt of priorAttempts)for(const item of attempt.items){
  shownIds.add(item.sourcePackId+':'+item.sourceQuestionId);
  shownStems.add(normalizeAnswer(item.question.text));
 }
 // The source may be a recalled server snapshot not present in the supplied history.
 for(const item of source.items){
  shownIds.add(item.sourcePackId+':'+item.sourceQuestionId);
  shownStems.add(normalizeAnswer(item.question.text));
 }
 const occurrence=new Map(source.items.map(item=>[item.id,item]));
 const groups=new Map<string,{name:string;misses:number;preferredPackId:string}>();
 for(const answer of source.answers){
  if(answer.isCorrect||answer.value==='')continue;
  const item=occurrence.get(answer.occurrenceId);
  if(!item||!ownedIds.has(item.sourcePackId))continue;
  const name=concept(item.question);
  if(!name)continue;
  const group=groups.get(name)??{name,misses:0,preferredPackId:item.sourcePackId};
  group.misses++;
  groups.set(name,group);
 }
 if(!groups.size)return {available:false,sourceAttemptId:source.id,limit,availableCount:0,
  diagnosedConcepts:[],candidates:[],reason:'No explicitly incorrect answer with a concept label was observed.'};
 const priorities=[...groups.values()].sort((a,b)=>b.misses-a.misses||a.name.localeCompare(b.name));
 const pool=new Map<string,{pack:Pack;question:Question}[]>();
 for(const group of priorities)pool.set(group.name,[]);
 for(const pack of ownedPacks)for(const question of pack.questions){
  const key=concept(question);
  if(!pool.has(key)||shownIds.has(pack.id+':'+question.id)||shownStems.has(normalizeAnswer(question.text)))continue;
  pool.get(key)!.push({pack,question});
 }
 for(const group of priorities)pool.get(group.name)!.sort((a,b)=>
  Number(b.pack.id===group.preferredPackId)-Number(a.pack.id===group.preferredPackId));
 const diagnosedConcepts=priorities.map(g=>({name:g.name,misses:g.misses,unansweredAlternatives:pool.get(g.name)!.length}));
 const candidates:RepairCandidate[]=[],selectedStems=new Set<string>();
 // Round robin prevents a single frequently missed topic swallowing the entire session.
 while(candidates.length<limit){
  let found=false;
  for(const group of priorities){
   const questions=pool.get(group.name)!;
   while(questions.length){
    const next=questions.shift()!;
    const stem=normalizeAnswer(next.question.text);
    if(selectedStems.has(stem))continue;
    candidates.push({...next,concept:group.name,observedMisses:group.misses});
    selectedStems.add(stem);found=true;break;
   }
   if(candidates.length===limit)break;
  }
  if(!found)break;
 }
 return {available:candidates.length>0,sourceAttemptId:source.id,limit,availableCount:candidates.length,
  diagnosedConcepts,candidates,
  ...(!candidates.length?{reason:'No genuinely unseen question is available for the observed missed concepts. Ask ChatGPT to create different source-grounded questions and save them via MCP first.'}:{})};
}
