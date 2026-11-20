import {z} from 'zod';
import type {Database} from './index';

const phrase=z.string().trim().min(1).max(3000);
const title=z.string().trim().min(1).max(200);
const number=z.number().int().positive();
const point=z.object({slide:number,concept:phrase}).strict();
const unit=z.object({objective:phrase.optional(),prompt:phrase,slides:z.array(number).min(1).max(30),points:z.array(point).min(1).max(12)}).strict();
const feedback=z.object({
  point:number, verdict:z.enum(['recalled','partial','missing','incorrect']),
  explanation:phrase, extraContext:phrase.optional()
}).strict();
const base={sessionId:title,operationId:title,expectedRevision:number};
const schemas={
  start_brain_dump:z.object({operationId:title,title,units:z.array(unit).min(1).max(80)}).strict(),
  list_brain_dumps:z.object({offset:z.number().int().nonnegative().optional()}).strict(),
  get_brain_dump:z.object({sessionId:title}).strict(),
  get_brain_dump_gaps:z.object({sessionId:title,offset:z.number().int().nonnegative().optional(),limit:z.number().int().min(1).max(50).optional()}).strict(),
  record_recall:z.object({...base,answer:phrase,hint:phrase.optional(),hintPoint:number.optional()}).strict(),
  review_recall:z.object({...base,feedback:z.array(feedback).min(1).max(12)}).strict(),
  retry_recall:z.object({...base,unitNumber:number}).strict()
};
type Name=keyof typeof schemas;
const descriptions:Record<Name,string>={
  start_brain_dump:'Read the PPT attached in ChatGPT first. Confirm per-slide or per-topic grouping with the learner. Skip title/reference slides. Request a slide image/PDF for unreadable diagrams. Set objective to one observable learning goal per unit. Match the task to the slide: identify a structure, distinguish two cases, or explain a mechanism. Store only points needed for that objective. Show only the current prompt before the learner answers.',
  list_brain_dumps:'List private recall sessions, newest changes first. Use get_brain_dump to resume.',
  get_brain_dump:'Resume the private session. Show only the prompt to the learner until they finish recalling. Assessment references become available to the tutor after the initial response.',
  get_brain_dump_gaps:'Read only the latest reviewed evidence per Brain Dump unit. Return missed, partial, incorrect, or hinted concepts with their author-supplied slide numbers and next-step options. No learner answers, no automatic grading, no generated questions, no source verification. Use prepare_pack_change / commit_pack_change for source-grounded new questions.',
  record_recall:'Save the learner’s own explanation verbatim. If a short answer already meets the stated objective, omit hint and call review_recall immediately. Use hintPoint to cite the numbered missing reference point. Only ask one neutral follow-up for a specific missing reference point needed for that objective. Do not request elaboration for length or fluency. After that, record their reply separately. Do not reveal the rubric before feedback.',
  review_recall:'After the learner finishes, assess every numbered reference point. Accept accurate paraphrases, distinguish initial and prompted recall, explain missing or incorrect concepts with slide evidence. Label outside context separately. Display feedback, then the next prompt. On request use create_pack or append_questions for selected gaps without copying private responses. Those questions also work as flashcards.',
  retry_recall:'Revisit a previously reviewed unit. Keeps its previous answers and feedback in history.'
};
export const brainTools=(Object.keys(schemas) as Name[]).map(name=>({
  name,description:descriptions[name],inputSchema:z.toJSONSchema(schemas[name],{target:'draft-7'}),
  annotations:{readOnlyHint:['get_brain_dump','get_brain_dump_gaps','list_brain_dumps'].includes(name),destructiveHint:false,openWorldHint:false,idempotentHint:true}
}));
type Round={unitNumber:number;initial?:string;hint?:string;hintPoint?:number;supplement?:string;feedback?:z.infer<typeof feedback>[]};
interface Session {id:string;title:string;units:z.infer<typeof unit>[]; round:Round|null;history:Round[];revision:number;updatedAt:string}
function state(session:Session){
  const round=session.round;
  const unit=round?session.units[round.unitNumber-1]:null;
  return {sessionId:session.id,title:session.title,revision:session.revision,count:session.units.length,
    status:round?'active':'completed',current:round&&unit?{...round,objective:unit.objective,prompt:unit.prompt,slides:unit.slides,
      ...(round.initial?{assessmentPoints:unit.points.map((p,i)=>({...p,point:i+1}))}:{})}:null};
}
function report(session:Session,round:Round){
  const unit=session.units[round.unitNumber-1];
  return {...round,prompt:unit.prompt,slides:unit.slides,feedback:round.feedback?.map(f=>({...f,...unit.points[f.point-1]}))};
}
async function digest(input:unknown){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input)));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function callBrainTool(db:Database,owner:string,name:string,input:unknown){
  if(!Object.hasOwn(schemas,name))return undefined;
  if(name==='list_brain_dumps'){
    const {offset=0}=schemas.list_brain_dumps.parse(input);
    const rows=await db.prepare("SELECT id,revision,json_extract(data,'$.title') AS title,json_extract(data,'$.updatedAt') AS updatedAt,CASE WHEN json_type(data,'$.round')='null' THEN 'completed' ELSE 'active' END AS status FROM records WHERE owner_id=? AND kind='recall' ORDER BY updatedAt DESC,id LIMIT 26 OFFSET ?").bind(owner,offset).all();
    return {items:rows.results.slice(0,25),nextOffset:rows.results.length>25?offset+25:null};
  }
  const get=async(id:string)=>{
    const row=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='recall' AND id=?").bind(owner,id).first<{data:string}>();
    if(!row)throw new Error('Recall session not found');
    return JSON.parse(row.data) as Session;
  };
  if(name==='get_brain_dump'){
    const args=schemas.get_brain_dump.parse(input);
    const session=await get(args.sessionId);
    return {...state(session),history:session.history.map(r=>report(session,r))};
  }
  if(name==='get_brain_dump_gaps'){
    const {sessionId,offset=0,limit=25}=schemas.get_brain_dump_gaps.parse(input);
    const session=await get(sessionId);
    // A retry can supersede earlier feedback. Only the most recently reviewed round per unit is evidence.
    const latest=new Map<number,Round>();
    for(const round of session.history)if(round.feedback)latest.set(round.unitNumber,round);
    const gaps:{
      unitNumber:number;objective:string|null;prompt:string;slide:number;concept:string;
      point:number;verdict:'partial'|'missing'|'incorrect'|'prompted_recall';feedback:string;
      sourceStatus:'tutor_provided_unverified';
    }[]=[];
    for(const [unitNumber,round] of [...latest].sort(([a],[b])=>a-b)){
      const unit=session.units[unitNumber-1];
      if(!unit)continue;
      for(const item of round.feedback??[]){
        const point=unit.points[item.point-1];
        if(!point)continue;
        const hinted=round.hintPoint===item.point;
        if(item.verdict==='recalled'&&!hinted)continue;
        gaps.push({unitNumber,objective:unit.objective??null,prompt:unit.prompt,
          slide:point.slide,concept:point.concept,point:item.point,
          verdict:item.verdict==='recalled'?'prompted_recall':item.verdict,
          feedback:item.explanation,sourceStatus:'tutor_provided_unverified'});
      }
    }
    const page=gaps.slice(offset,offset+limit);
    return {sessionId,title:session.title,revision:session.revision,
      status:session.round?'active':'completed',reviewedUnits:latest.size,
      total:gaps.length,offset,limit,nextOffset:offset+limit<gaps.length?offset+limit:null,
      gaps:page,nextAction:gaps.length?'Generate different questions grounded in the original source using prepare_pack_change, commit_pack_change, then start practice. The saved slide numbers were supplied by the tutor, not independently verified by Noodl.':'No missed or hinted reference point in the latest reviewed rounds.'};
  }
  const args=schemas[name as Exclude<Name,'list_brain_dumps'|'get_brain_dump'|'get_brain_dump_gaps'>].parse(input);
  const fingerprint=await digest([name,args]);
  const replay=async()=>{
    const row=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='recall-op' AND id=?").bind(owner,args.operationId).first<{data:string}>();
    if(!row)return null;
    const op=JSON.parse(row.data);
    if(op.fingerprint!==fingerprint)throw new Error('operationId already used for another recall request');
    return op.result;
  };
  const prior=await replay();if(prior)return prior;
  let session:Session;
  let reviewed;
  if('units' in args){
    for(const u of args.units){
      if(new Set(u.slides).size!==u.slides.length||u.points.some(p=>!u.slides.includes(p.slide)))throw new Error('Every reference must cite a slide in its unit');
    }
    session={id:crypto.randomUUID(),title:args.title,units:args.units,round:{unitNumber:1},history:[],revision:0,updatedAt:''};
  }else{
    session=await get(args.sessionId);
    if(session.revision!==args.expectedRevision)throw new Error('CONFLICT: Recall revision changed');
    const round=session.round;
    if('unitNumber' in args){
      if(round?.initial || !session.history.some(r=>r.unitNumber===args.unitNumber))throw new Error('Finish current response and choose a reviewed unit');
      session.round={unitNumber:args.unitNumber};
    }else if(!round)throw new Error('Recall session already completed');
    else if('answer' in args){
      const unit=session.units[round.unitNumber-1];
      if(args.hintPoint!==undefined && (!args.hint || args.hintPoint>unit.points.length))throw new Error('Specify a missing reference point from this unit with the follow-up');
      if(args.hint && unit.objective && !args.hintPoint)throw new Error('Identify the missing reference point or review this answer directly');
      if(!round.initial){round.initial=args.answer;round.hint=args.hint;round.hintPoint=args.hintPoint;}
      else if(round.hint && !round.supplement && !args.hint)round.supplement=args.answer;
      else throw new Error('This response has already been recorded');
    }else{
      if(!round.initial)throw new Error('Record the learner response first');
      const points=session.units[round.unitNumber-1].points;
      if(args.feedback.length!==points.length || new Set(args.feedback.map(f=>f.point)).size!==points.length || args.feedback.some(f=>f.point>points.length))throw new Error('Assess each reference point once');
      round.feedback=args.feedback;
      session.history.push(round);
      reviewed=report(session,round);
      const done=new Set(session.history.map(r=>r.unitNumber));
      const next=session.units.findIndex((_,i)=>!done.has(i+1));
      session.round=next<0?null:{unitNumber:next+1};
    }
  }
  const previous=session.revision++;
  session.updatedAt=new Date().toISOString();
  const data=JSON.stringify(session);
  if(new TextEncoder().encode(data).length>850000)throw new Error('Session too large. Split the deck or start another practice session.');
  const result={...state(session),...(reviewed?{reviewed}:{})};
  const nonce=crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) SELECT ?,'recall-op',?,1,? WHERE COALESCE((SELECT revision FROM records WHERE owner_id=? AND kind='recall' AND id=?),0)=? ON CONFLICT DO NOTHING").bind(owner,args.operationId,JSON.stringify({nonce,fingerprint,result}),owner,session.id,previous),
    db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) SELECT ?,'recall',?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner_id=? AND kind='recall-op' AND id=? AND json_extract(data,'$.nonce')=?) ON CONFLICT(owner_id,kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data").bind(owner,session.id,session.revision,data,owner,args.operationId,nonce)
  ]);
  const saved=await replay();if(!saved)throw new Error('CONFLICT: Concurrent recall update');
  return saved;
}
