export type ConceptRelationType='causes'|'inhibits'|'regulates'|'part_of'|'contrasts'|'prerequisite'|'example_of';
export type SourceStatus='provided'|'model_inspected'|'unavailable';
export interface ConceptSource {title:string;anchor?:string;uri?:string;status:SourceStatus}
export interface ConceptNode {id:string;label:string;aliases:string[]}
export interface ConceptRelation {
 id:string;from:string;to:string;type:ConceptRelationType;
 rationale:string;sourceRefs:ConceptSource[];status:'draft'|'creator_reviewed'|'disputed';
}
export interface ConceptMapDocument {version:1;title:string;concepts:ConceptNode[];relations:ConceptRelation[]}
const types=new Set<ConceptRelationType>(['causes','inhibits','regulates','part_of','contrasts','prerequisite','example_of']);
const statuses=new Set(['draft','creator_reviewed','disputed']);
const sourceStatuses=new Set<SourceStatus>(['provided','model_inspected','unavailable']);
const object=(v:unknown,label:string):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(label+' must be an object');
 return v as Record<string,unknown>;
};
const str=(v:unknown,label:string,max=500)=>{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(label+' must be 1..'+max+' chars');
 return v.trim();
};
const unique=(values:string[],name:string)=>{
 if(new Set(values).size!==values.length)throw new Error(name+' must be unique');
};
export const conceptRelationLabels:Record<ConceptRelationType,string>={
 causes:'menyebabkan',inhibits:'menghambat',regulates:'mengatur',
 part_of:'bagian dari',contrasts:'berbeda dari',prerequisite:'prasyarat untuk',example_of:'contoh dari'
};

/** The relation is an authored claim with visible evidence status, not automatic fact verification. */
export function parseConceptMap(input:string):ConceptMapDocument{
 let raw:unknown;
 try{raw=JSON.parse(input);}catch{throw new Error('Concept map must be valid JSON');}
 const doc=object(raw,'map');
 if(doc.version!==1)throw new Error('Unsupported concept map version');
 if(!Array.isArray(doc.concepts)||doc.concepts.length<2||doc.concepts.length>60)throw new Error('Map needs 2..60 concepts');
 if(!Array.isArray(doc.relations)||doc.relations.length<1||doc.relations.length>180)throw new Error('Map needs 1..180 typed relations');
 const concepts:ConceptNode[]=doc.concepts.map((value,i)=>{
  const node=object(value,'concept '+i);
  const aliases=node.aliases===undefined?[]:node.aliases;
  if(!Array.isArray(aliases)||aliases.length>20)throw new Error('Invalid concept aliases');
  return {id:str(node.id,'concept id',100),label:str(node.label,'concept label',140),
   aliases:aliases.map(a=>str(a,'alias',140))};
 });
 unique(concepts.map(c=>c.id),'Concept IDs');
 const ids=new Set(concepts.map(c=>c.id));
 const relations:ConceptRelation[]=doc.relations.map((value,i)=>{
  const relation=object(value,'relation '+i);
  const from=str(relation.from,'relation from',100),to=str(relation.to,'relation to',100);
  if(!ids.has(from)||!ids.has(to)||from===to)throw new Error('Relation refers to a missing/self concept');
  if(!types.has(relation.type as ConceptRelationType))throw new Error('Unknown relationship type');
  if(!statuses.has(relation.status as string))throw new Error('Unknown relation review status');
  if(!Array.isArray(relation.sourceRefs)||relation.sourceRefs.length<1||relation.sourceRefs.length>12)
   throw new Error('Each scientific relation needs source provenance');
  const sourceRefs:ConceptSource[]=relation.sourceRefs.map((value,j)=>{
   const src=object(value,'source '+j);
   if(!sourceStatuses.has(src.status as SourceStatus))throw new Error('Invalid source evidence status');
   const uri=src.uri===undefined?undefined:str(src.uri,'source URL',2000);
   if(uri&&!/^https:\/\//i.test(uri))throw new Error('Source URI must use HTTPS');
   return {title:str(src.title,'source title',300),
    ...(src.anchor===undefined?{}:{anchor:str(src.anchor,'source anchor',150)}),
    ...(uri?{uri}:{}),status:src.status as SourceStatus};
  });
  return {id:str(relation.id,'relation id',100),from,to,type:relation.type as ConceptRelationType,
   rationale:str(relation.rationale,'relation rationale',3000),sourceRefs,
   status:relation.status as ConceptRelation['status']};
 });
 unique(relations.map(r=>r.id),'Relation IDs');
 return {version:1,title:str(doc.title,'map title',300),concepts,relations};
}

export function conceptMapPositions(nodes:ConceptNode[],limit=16){
 const visible=nodes.slice(0,limit);
 if(visible.length===1)return [{id:visible[0].id,x:400,y:250}];
 return visible.map((node,i)=>{
  const angle=-Math.PI/2+(i/visible.length)*Math.PI*2;
  const radius=Math.min(195,100+visible.length*7);
  return {id:node.id,x:400+Math.cos(angle)*radius*1.45,y:250+Math.sin(angle)*radius};
 });
}
