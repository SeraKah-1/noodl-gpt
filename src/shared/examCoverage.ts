import type {Attempt,Pack,Question,ReviewEvent,SourceReference} from './types';
import {normalizeAnswer,replayReviews} from './engine';

export type ExamPointKind='fact'|'mechanism'|'exception'|'application';
export type ExamPointStatus='draft'|'author_reviewed';
export interface ExamPoint {
 id:string;label:string;kind:ExamPointKind;questionIds:string[];
 status:ExamPointStatus;
 /** A human-/ChatGPT-authored reason that these questions test the same *exam point*. */
 equivalenceReason?:string;
 sourceRefs:SourceReference[];
}
export interface ExamPointMap {version:1;title:string;points:ExamPoint[]}
export type SweepChoice='known'|'unsure';
export interface SweepDecision {
 version:1;id:string;ownerId:string;packId:string;packRevision:number;
 pointId:string;questionId:string;choice:SweepChoice;decidedAt:string;
}
export interface CoverageQuestion {
 question:Question;shown:number;correct:number;incorrect:number;
 latest:'correct'|'incorrect'|'none';lastTestedAt:string|null;
 lastCorrectAt:string|null;distinctCorrectSessions:number;testedAcrossDays:boolean;
}
export type CoverageStatus='unseen'|'seen'|'self_claimed'|'tested'|'stable'|'needs_repair';
export interface CoveragePoint {
 point:ExamPoint;questions:CoverageQuestion[];
 tested:number;untested:number;claimed:number;shown:number;
 status:CoverageStatus;
 /** At least one independent answer, not a user assertion. */
 verified:boolean;
 stable:boolean;
}
export interface CoverageSummary {
 packId:string;questionCount:number;pointCount:number;
 mappedQuestions:number;unmappedQuestions:number;reviewedGroups:number;
 points:CoveragePoint[];
 totals:{unseen:number;seen:number;selfClaimed:number;tested:number;stable:number;needsRepair:number;
  testedQuestions:number;untestedQuestions:number;untestedPoints:number};
 /** 100% of groups represented is not the same as 100% of individual questions answered. */
 limitations:string[];
}

const text=(v:unknown,label:string,max=500)=>{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(label+' must be nonempty, at most '+max+' characters');
 return v.trim();
};
const object=(v:unknown,label:string):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(label+' must be a JSON object');
 return v as Record<string,unknown>;
};
const kinds=new Set<ExamPointKind>(['fact','mechanism','exception','application']);
const sourceStatuses=new Set<SourceReference['status']>(['provided','model_inspected','unavailable']);
function source(value:unknown):SourceReference{
 const obj=object(value,'source');
 if(!sourceStatuses.has(obj.status as SourceReference['status']))throw new Error('Invalid source status');
 const uri=obj.uri===undefined?undefined:text(obj.uri,'source URI',2000);
 if(uri&&!/^https:\/\//i.test(uri))throw new Error('Source URI must use HTTPS');
 return {title:text(obj.title,'source title',300),status:obj.status as SourceReference['status'],
  ...(obj.anchor===undefined?{}:{anchor:text(obj.anchor,'source anchor',160)}),
  ...(uri?{uri}:{})};
}
/**
 * The map is an explicit authored claim. An unreviewed grouping never causes
 * questions to be silently hidden. Missing questions retain singleton points.
 */
export function parseExamPointMap(content:string,packQuestions?:Question[]):ExamPointMap{
 let raw:unknown;
 try{raw=JSON.parse(content);}catch{throw new Error('Exam map must be valid JSON');}
 const input=object(raw,'Exam map');
 if(input.version!==1)throw new Error('Unsupported exam map version');
 if(!Array.isArray(input.points)||input.points.length<1||input.points.length>1000)
  throw new Error('Exam map needs 1..1000 points');
 const points:ExamPoint[]=input.points.map((rawPoint,i)=>{
  const p=object(rawPoint,'point '+i),id=text(p.id,'point id',120);
  if(!kinds.has(p.kind as ExamPointKind))throw new Error('Invalid point kind');
  if(!['draft','author_reviewed'].includes(String(p.status)))throw new Error('Invalid point review status');
  if(!Array.isArray(p.questionIds)||!p.questionIds.length||p.questionIds.length>1000)
   throw new Error('Point must reference 1..1000 questions');
  const questionIds=p.questionIds.map(q=>text(q,'question ID',200));
  if(new Set(questionIds).size!==questionIds.length)throw new Error('Repeated question within point');
  const equivalenceReason=p.equivalenceReason===undefined?undefined:text(p.equivalenceReason,'equivalence reason',1200);
  if(questionIds.length>1&&p.status==='author_reviewed'&&!equivalenceReason)
   throw new Error('Reviewed question grouping needs a written equivalence reason');
  if(!Array.isArray(p.sourceRefs)||p.sourceRefs.length<1||p.sourceRefs.length>12)
   throw new Error('Authored exam points must have 1..12 source provenance entries');
  return {id,label:text(p.label,'point label',220),kind:p.kind as ExamPointKind,questionIds,
   status:p.status as ExamPointStatus,...(equivalenceReason?{equivalenceReason}:{}),
   sourceRefs:p.sourceRefs.map(source)};
 });
 const ids=points.map(x=>x.id);
 if(new Set(ids).size!==ids.length)throw new Error('Duplicate point IDs');
 const all=points.flatMap(x=>x.questionIds);
 if(new Set(all).size!==all.length)throw new Error('A question belongs to multiple points');
 if(packQuestions){
  const found=new Set(packQuestions.map(q=>q.id));
  if(all.some(id=>!found.has(id)))throw new Error('Exam map refers to a missing bank question');
 }
 return {version:1,title:text(input.title,'map title',300),points};
}
function fallback(q:Question):ExamPoint {
 const anchor=q.sourceRefs?.[0];
 return {id:'question:'+q.id,label:q.keyPoint?.trim()||q.conceptName?.trim()||q.text.slice(0,120),
  kind:q.conceptPriority==='HIGH'?'fact':'fact',questionIds:[q.id],status:'draft',
  sourceRefs:anchor?[anchor]:[{title:'Unmapped existing bank question',status:'unavailable'}]};
}
export function resolveExamPoints(pack:Pack):{points:ExamPoint[];mappedQuestions:number;reviewedGroups:number}{
 const artifact=pack.artifacts.find(a=>a.kind==='exam_map');
 let mapped:ExamPoint[]=[];
 if(artifact)mapped=parseExamPointMap(artifact.content,pack.questions).points;
 const byId=new Map(pack.questions.map(q=>[q.id,q]));
 const covered=new Set<string>(),points:ExamPoint[]=[];
 let reviewedGroups=0;
 for(const authored of mapped){
  if(authored.questionIds.length>1&&authored.status!=='author_reviewed'){
   // A draft statement cannot eliminate a potentially examinable distinction.
   for(const id of authored.questionIds){
    const q=byId.get(id)!;
    points.push({...fallback(q),label:authored.label+' · '+q.text.slice(0,90)});
    covered.add(id);
   }
   continue;
  }
  points.push(authored);authored.questionIds.forEach(id=>covered.add(id));
  if(authored.questionIds.length>1)reviewedGroups++;
 }
 const mappedQuestions=covered.size;
 for(const q of pack.questions)if(!covered.has(q.id))points.push(fallback(q));
 return {points,mappedQuestions,reviewedGroups};
}
const normTime=(value:string)=>{
 const t=Date.parse(value);return Number.isFinite(t)?t:0;
};
export function buildExamCoverage(pack:Pack,history:Attempt[],reviews:ReviewEvent[],decisions:SweepDecision[]=[],now=Date.now()):CoverageSummary{
 const {points,mappedQuestions,reviewedGroups}=resolveExamPoints(pack);
 const refs=new Map(pack.questions.map(q=>[q.id,{question:q,shown:0,correct:0,incorrect:0,
  latest:'none' as CoverageQuestion['latest'],lastTestedAt:null as string|null,
  lastCorrectAt:null as string|null,distinctCorrectSessions:0,testedAcrossDays:false,
  records:[] as {timestamp:number;correct:boolean;attemptId:string}[]}]));
 for(const attempt of history){
  if(attempt.ownerId!==pack.ownerId||('deletedAt' in attempt&&attempt.deletedAt))continue;
  const byOccurrence=new Map(attempt.answers.map(a=>[a.occurrenceId,a]));
  for(const item of attempt.items){
   if(item.sourcePackId!==pack.id)continue;
   const target=refs.get(item.sourceQuestionId);
   if(!target)continue;
   target.shown++;
   const answer=byOccurrence.get(item.id);
   if(answer){
    target.records.push({timestamp:normTime(answer.answeredAt),correct:answer.isCorrect,attemptId:attempt.id});
   }
  }
 }
 const reviewCards=replayReviews(reviews.filter(r=>r.packId===pack.id));
 const due=new Set(reviewCards.filter(c=>normTime(c.nextReview)<=now).map(c=>c.questionId));
 for(const question of refs.values()){
  const records=question.records.sort((a,b)=>a.timestamp-b.timestamp);
  const distinct=new Set<string>(),times:number[]=[];
  for(const event of records){
   if(event.correct){question.correct++;distinct.add(event.attemptId);times.push(event.timestamp);}
   else question.incorrect++;
   question.latest=event.correct?'correct':'incorrect';
   question.lastTestedAt=new Date(event.timestamp).toISOString();
   if(event.correct)question.lastCorrectAt=new Date(event.timestamp).toISOString();
  }
  question.distinctCorrectSessions=distinct.size;
  question.testedAcrossDays=distinct.size>=2&&times.length>=2&&Math.max(...times)-Math.min(...times)>=24*3600*1000;
 }
 const latestClaims=new Map<string,SweepDecision>();
 for(const c of decisions){
  if(c.ownerId!==pack.ownerId||c.packId!==pack.id||c.packRevision!==pack.revision)continue;
  const prior=latestClaims.get(c.pointId);
  if(!prior||normTime(c.decidedAt)>normTime(prior.decidedAt)||
   (c.decidedAt===prior.decidedAt&&c.id>prior.id))latestClaims.set(c.pointId,c);
 }
 const coverage=points.map(point=>{
  const questions=point.questionIds.map(id=>refs.get(id)!).filter(Boolean);
  const correct=questions.some(q=>q.latest==='correct');
  const wrong=questions.some(q=>q.latest==='incorrect');
  const stable=correct&&!wrong&&questions.some(q=>q.testedAcrossDays)&&!questions.some(q=>due.has(q.question.id));
  const tested=questions.filter(q=>q.correct+q.incorrect>0).length;
  const untested=questions.length-tested;
  const shown=questions.filter(q=>q.shown>0).length;
  const claimed=latestClaims.get(point.id)?.choice==='known'?1:0;
  // A grouped point has only been demonstrated by one variant, not exhaustively by each variant.
  const status:CoverageStatus=wrong?'needs_repair':stable?'stable':correct?'tested':
   claimed?'self_claimed':shown?'seen':'unseen';
  return {point,questions:questions.map(({records:_records,...q})=>q),
   tested,untested,shown,claimed,status,verified:correct&&!wrong,stable} satisfies CoveragePoint;
 });
 const totals={unseen:0,seen:0,selfClaimed:0,tested:0,stable:0,needsRepair:0,testedQuestions:0,
  untestedQuestions:0,untestedPoints:0};
 for(const point of coverage){
  if(point.status==='self_claimed')totals.selfClaimed++;
  else if(point.status==='needs_repair')totals.needsRepair++;
  else if(point.status==='stable')totals.stable++;
  else if(point.status==='tested')totals.tested++;
  else if(point.status==='seen')totals.seen++;
  else totals.unseen++;
  totals.testedQuestions+=point.tested;
  totals.untestedQuestions+=point.untested;
  if(!point.verified)totals.untestedPoints++;
 }
 return {packId:pack.id,questionCount:pack.questions.length,pointCount:coverage.length,mappedQuestions,
  unmappedQuestions:pack.questions.length-mappedQuestions,reviewedGroups,points:coverage,totals,
  limitations:[
   'Known marks are learner claims, not correct answers or spaced-review credits.',
   'A correctly answered representative question does not independently prove all untested variants.',
   'Source provenance is author supplied; the original exam and document completeness are not verified by Noodl.'
  ]};
}
export interface SweepCandidate {point:CoveragePoint;question:Question;reason:'missed'|'unseen'|'due'|'repeat'|'claim_audit'}
/** One representative per point, including every singleton; never changes difficulty or the bank. */
export function selectSweepCandidates(coverage:CoverageSummary,reviews:ReviewEvent[]=[],now=Date.now()):SweepCandidate[]{
 const due=new Set(replayReviews(reviews.filter(r=>r.packId===coverage.packId))
  .filter(c=>normTime(c.nextReview)<=now).map(c=>c.questionId));
 const rank=(q:CoverageQuestion)=>{
  if(q.latest==='incorrect')return -400;
  if(due.has(q.question.id))return -300;
  if(!q.shown)return -200;
  if(q.latest==='none')return -100;
  return q.correct*10+q.shown;
 };
 return coverage.points.map(point=>{
  const ordered=point.questions.slice().sort((a,b)=>rank(a)-rank(b)||
   a.question.id.localeCompare(b.question.id));
  const candidate=ordered[0];
  if(!candidate)return null;
  const reason:SweepCandidate['reason']=candidate.latest==='incorrect'?'missed':
   due.has(candidate.question.id)?'due':!candidate.shown?'unseen':point.status==='self_claimed'?'claim_audit':'repeat';
  return {point,question:candidate.question,reason};
 }).filter((v):v is SweepCandidate=>v!==null)
  .sort((a,b)=>{
   const weights={missed:0,due:1,unseen:2,claim_audit:3,repeat:4};
   return weights[a.reason]-weights[b.reason]||a.point.point.id.localeCompare(b.point.point.id);
  });
}
/**
 * Audit is deterministic for a session seed. Every unsure point gets its own
 * question; "known" claims are sampled without being promoted to correctness.
 */
export function selectAuditQuestions(candidates:SweepCandidate[],choices:Record<string,SweepChoice>,limit=20,seed='default'){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Audit limit must be 1..100');
 const unsure=candidates.filter(x=>choices[x.point.point.id]==='unsure');
 const known=candidates.filter(x=>choices[x.point.point.id]==='known');
 const selected:SweepCandidate[]=[],used=new Set<string>();
 const push=(x:SweepCandidate)=>{
  if(used.has(x.question.id)||selected.length>=limit)return;
  selected.push(x);used.add(x.question.id);
 };
 // Unsure items are not silently dropped just because the audit is capped;
 // caller must surface remaining count.
 unsure.forEach(push);
 const sorted=known.map(x=>({x,score:simpleHash(seed+'|'+x.point.point.id)}))
  .sort((a,b)=>a.score-b.score).map(y=>y.x);
 const target=Math.max(known.length?1:0,Math.ceil(known.length*.25));
 sorted.slice(0,target).forEach(push);
 return {questions:selected.map(x=>x.question),auditCount:selected.filter(x=>choices[x.point.point.id]==='known').length,
  unsureCount:selected.filter(x=>choices[x.point.point.id]==='unsure').length,
  unverifiedKnown:known.length,notIncluded:unsure.length+known.length-selected.length};
}
function simpleHash(value:string){
 let hash=2166136261;
 for(const ch of value)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
 return hash>>>0;
}
