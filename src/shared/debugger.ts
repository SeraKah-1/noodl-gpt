import type {ConceptSource,SourceStatus} from './conceptMap';

export interface DebuggerNode {id:string;label:string}
export interface DebuggerEdge {
 id:string;from:string;to:string;displayLabel:string;correctLabel:string;choices:string[];
 explanation:string;sourceRefs:ConceptSource[];
}
export interface DebuggerScenario {version:1;title:string;prompt:string;nodes:DebuggerNode[];edges:DebuggerEdge[];limitations:string}

const record=(value:unknown,label:string):Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be an object');
 return value as Record<string,unknown>;
};
const text=(v:unknown,label:string,max=1000)=>{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(label+' must have 1..'+max+' characters');
 return v.trim();
};
const unique=(xs:string[],label:string)=>{
 if(new Set(xs).size!==xs.length)throw new Error(label+' must be unique');
};
const evidence=new Set<SourceStatus>(['provided','model_inspected','unavailable']);
export function parseDebugger(content:string):DebuggerScenario{
 let raw:unknown;
 try{raw=JSON.parse(content)}catch{throw new Error('Debugger scenario must contain JSON');}
 const doc=record(raw,'scenario');
 if(doc.version!==1)throw new Error('Unsupported debugger scenario version');
 if(!Array.isArray(doc.nodes)||doc.nodes.length<2||doc.nodes.length>24)throw new Error('Need 2..24 nodes');
 if(!Array.isArray(doc.edges)||doc.edges.length<1||doc.edges.length>36)throw new Error('Need 1..36 directed relations');
 const nodes:DebuggerNode[]=doc.nodes.map((value,i)=>{
  const node=record(value,'node '+i);
  return {id:text(node.id,'node id',120),label:text(node.label,'node label',220)};
 });
 unique(nodes.map(n=>n.id),'Node IDs');
 const ids=new Set(nodes.map(n=>n.id));
 const edges:DebuggerEdge[]=doc.edges.map((value,i)=>{
  const edge=record(value,'edge '+i),from=text(edge.from,'from',120),to=text(edge.to,'to',120);
  if(!ids.has(from)||!ids.has(to)||from===to)throw new Error('Relation must connect two existing distinct nodes');
  if(!Array.isArray(edge.choices)||edge.choices.length<2||edge.choices.length>8)throw new Error('Need 2..8 alternative labels');
  const choices=edge.choices.map(x=>text(x,'alternative',160));
  unique(choices,'Alternative labels');
  const displayLabel=text(edge.displayLabel,'displayLabel',160),correctLabel=text(edge.correctLabel,'correctLabel',160);
  if(!choices.includes(displayLabel)||!choices.includes(correctLabel))throw new Error('Visible and correct labels must be one of the alternatives');
  if(!Array.isArray(edge.sourceRefs)||edge.sourceRefs.length<1||edge.sourceRefs.length>12)throw new Error('Each relation requires authored source references');
  const sourceRefs:ConceptSource[]=edge.sourceRefs.map((value,j)=>{
   const source=record(value,'source '+j),status=source.status as SourceStatus;
   if(!evidence.has(status))throw new Error('Unknown source evidence status');
   const uri=source.uri===undefined?undefined:text(source.uri,'source URI',2000);
   if(uri&&!/^https:\/\//i.test(uri))throw new Error('Source link must use HTTPS');
   return {title:text(source.title,'source title',300),status,
    ...(source.anchor===undefined?{}:{anchor:text(source.anchor,'source anchor',160)}),...(uri?{uri}:{})};
  });
  return {id:text(edge.id,'edge id',120),from,to,displayLabel,correctLabel,choices,
   explanation:text(edge.explanation,'edge explanation',3000),sourceRefs};
 });
 unique(edges.map(e=>e.id),'Relation IDs');
 if(!edges.some(e=>e.displayLabel!==e.correctLabel))throw new Error('Scenario must contain at least one deliberately incorrect relation');
 return {version:1,title:text(doc.title,'title',300),prompt:text(doc.prompt,'task prompt',1200),
  nodes,edges,limitations:text(doc.limitations,'scientific validity boundaries',1600)};
}
export interface DebuggerGrade {
 correct:number;total:number;passed:boolean;
 results:{edgeId:string;selected:string;correctLabel:string;correct:boolean;explanation:string;sourceRefs:ConceptSource[]}[];
}
/** Deterministic scoring. The server independently re-reads the saved scenario before storing results. */
export function gradeDebugger(scenario:DebuggerScenario,answer:Record<string,string>):DebuggerGrade{
 const keys=Object.keys(answer);
 if(keys.length!==scenario.edges.length||keys.some(k=>!scenario.edges.some(e=>e.id===k)))
  throw new Error('Submit exactly one answer per relation');
 const results=scenario.edges.map(e=>{
  const selected=answer[e.id];
  if(typeof selected!=='string'||!e.choices.includes(selected))throw new Error('Answer must use a listed relation choice');
  return {edgeId:e.id,selected,correctLabel:e.correctLabel,correct:selected===e.correctLabel,
   explanation:e.explanation,sourceRefs:e.sourceRefs};
 });
 const correct=results.filter(r=>r.correct).length;
 return {correct,total:results.length,passed:correct===results.length,results};
}
