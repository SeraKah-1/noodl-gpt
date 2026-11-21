import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildExamCoverage,parseExamPointMap,resolveExamPoints,selectAuditQuestions,selectSweepCandidates} from '../src/shared/examCoverage';
import {createAttempt} from '../src/shared/engine';
import {validatePackInput} from '../src/shared/validation';
import type {Pack,Question,Attempt} from '../src/shared/types';
import type {SweepDecision} from '../src/shared/examCoverage';
const question=(id:string,point:string):Question=>({
 id,type:'TRUE_FALSE',text:'Question about '+point+' ('+id+')',correctBoolean:true,
 explanation:'Author supplied explanation',difficulty:'Easy',conceptName:point,
 sourceRefs:[{title:'PPT',anchor:'Slide '+id,status:'provided'}]
});
const questions=[question('a','Histamine'),question('b','Histamine'),question('c','ATPase'),question('d','Exception')];
const authorship={version:1,title:'Exam points',points:[
 {id:'histamine',label:'Histamine activates H2 receptors',kind:'fact',status:'author_reviewed',questionIds:['a','b'],
  equivalenceReason:'Both questions test the exact H2 receptor fact; separate edge cases remain ungrouped',
  sourceRefs:[{title:'PPT',anchor:'Slide 7',status:'provided'}]},
 {id:'pump',label:'ATPase drives acid secretion',kind:'mechanism',status:'draft',questionIds:['c'],
  sourceRefs:[{title:'PPT',anchor:'Slide 9',status:'provided'}]}
 ]};
const pack:Pack={id:'bank',ownerId:'user',title:'Gastric acid',description:'',folder:'',tags:[],
 questions,artifacts:[{id:'exam-map',kind:'exam_map',title:'Exam points',content:JSON.stringify(authorship)}],
 revision:1,createdAt:'2026-11-17T00:00:00.000Z',updatedAt:'2026-11-17T00:00:00.000Z'};
function history(id:string,questionId:string,correct:boolean,date:string):Attempt {
 const attempt=createAttempt(pack,{mode:'BATCH',batchSize:1,shuffle:false,retention:false,mixed:false},
  'user',[{question:questions.find(q=>q.id===questionId)!,sourcePackId:pack.id}],Date.parse(date));
 attempt.id=id;
 attempt.status='completed';attempt.answers=[{occurrenceId:attempt.items[0].id,
  value:correct, isCorrect:correct,answeredAt:date}];
 attempt.completedAt=date;
 return attempt;
}
const claim=(pointId:string,choice:'known'|'unsure'):SweepDecision=>({id:pointId+'-claim',version:1,
 ownerId:'user',packId:'bank',packRevision:1,pointId,questionId:'c',choice,decidedAt:'2026-11-19T00:00:00.000Z'});
test('exam map groups only explicitly reviewed equivalent questions; all others remain testable',()=>{
 const resolved=resolveExamPoints(pack);
 assert.equal(resolved.points.length,3);
 assert.equal(resolved.mappedQuestions,3);
 assert.equal(resolved.reviewedGroups,1);
 assert.ok(resolved.points.some(p=>p.questionIds.includes('d')));
 const result=validatePackInput({...pack});
 assert.equal(result.questions.length,4);
 const draft={...authorship,points:[{...authorship.points[0],status:'draft'}]};
 const temporary={...pack,artifacts:[{...pack.artifacts[0],content:JSON.stringify(draft)}]};
 assert.equal(resolveExamPoints(temporary).points.length,4,'Draft grouping must not remove question distinctions');
 assert.throws(()=>parseExamPointMap(JSON.stringify({...authorship,points:[{...authorship.points[0],questionIds:['a','missing']}]}),questions),/missing/);
 assert.throws(()=>validatePackInput({...pack,artifacts:[...pack.artifacts,...pack.artifacts.map(a=>({...a,id:'second'}))]}),/Only one/);
 assert.throws(()=>parseExamPointMap(JSON.stringify({...authorship,points:[{...authorship.points[0],equivalenceReason:undefined}]})),/equivalence/);
});

test('reviewed group correctness is not counted as every individual variant',()=>{
 const first=history('first','a',true,'2026-11-18T10:00:00.000Z');
 const coverage=buildExamCoverage(pack,[first],[],[],Date.parse('2026-11-21T00:00:00.000Z'));
 assert.equal(coverage.pointCount,3);
 assert.equal(coverage.totals.testedQuestions,1);
 assert.equal(coverage.totals.untestedQuestions,3);
 const histamine=coverage.points.find(x=>x.point.id==='histamine')!;
 assert.equal(histamine.status,'tested');
 assert.equal(histamine.tested,1);
 assert.equal(histamine.untested,1,'Other variant is not magically correct');
 assert.equal(histamine.stable,false);
 assert.equal(coverage.unmappedQuestions,1);
});
test('recent incorrect evidence blocks stable state and known claims grant no score',()=>{
 const first=history('one','a',true,'2026-11-17T00:00:00.000Z');
 const next=history('two','a',true,'2026-11-19T00:00:00.000Z');
 const stable=buildExamCoverage(pack,[first,next],[],[claim('pump','known')]);
 assert.equal(stable.points.find(p=>p.point.id==='histamine')?.status,'stable');
 const claimed=stable.points.find(p=>p.point.id==='pump')!;
 assert.equal(claimed.status,'self_claimed');
 assert.equal(claimed.verified,false);
 assert.equal(claimed.tested,0);
 assert.equal(stable.totals.untestedQuestions,3);
 const wrong=history('third','a',false,'2026-11-20T00:00:00.000Z');
 const after=buildExamCoverage(pack,[first,next,wrong],[],[]);
 assert.equal(after.points.find(p=>p.point.id==='histamine')?.status,'needs_repair');
});
test('sweep selects one per reviewed point without deleting full bank; audit samples claims deterministically',()=>{
 const coverage=buildExamCoverage(pack,[],[],[]);
 const candidates=selectSweepCandidates(coverage);
 assert.equal(candidates.length,3);
 assert.equal(pack.questions.length,4);
 const choices=Object.fromEntries(candidates.map(c=>[c.point.point.id,c.point.point.id==='pump'?'unsure':'known']));
 const first=selectAuditQuestions(candidates,choices,20,'same-session');
 const retry=selectAuditQuestions(candidates,choices,20,'same-session');
 assert.deepEqual(first,retry);
 assert.equal(first.unsureCount,1);
 assert.equal(first.auditCount,1);
 assert.equal(first.unverifiedKnown,2);
 assert.equal(first.questions.length,2);
 assert.equal(first.notIncluded,1);
 assert.equal(new Set(first.questions.map(q=>q.id)).size,2);
 assert.throws(()=>selectAuditQuestions(candidates,choices,0),/1..100/);
});
test('invalid or unsafe source and duplicated references are rejected',()=>{
 const bad={...authorship,points:[{...authorship.points[0],
  sourceRefs:[{title:'X',status:'provided',uri:'javascript:alert(1)'}]}]};
 assert.throws(()=>parseExamPointMap(JSON.stringify(bad)),/HTTPS/);
 const dup={...authorship,points:authorship.points.map(p=>({...p,questionIds:['a']}))};
 assert.throws(()=>parseExamPointMap(JSON.stringify(dup)),/multiple/);
});
