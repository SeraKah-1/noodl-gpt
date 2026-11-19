import type {Pack,Question} from './types';

export interface ConceptGraphNode {id:string;name:string;questions:Question[];priority:string}
export interface ConceptEdge {source:string;target:string;shared:string[]}
/** Textual association, not a claim of causal, prerequisite or clinical relationships. */
const STOP_WORDS=new Set([
 'yang','dengan','untuk','pada','dalam','dari','adalah','tersebut','antara','karena','sebagai','ketika','akan','oleh',
 'dapat','tidak','juga','terjadi','serta','atau','yaitu','melalui','terhadap','lebih','salah','contoh','sistem',
 'this','that','with','from','which','their','they','into','between','about','because','there','have',
 'than','does','where','when','also','while','these','those','using','used','other','same','each'
]);
export function conceptTerms(text:string):Set<string>{
 return new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu)??[]).filter(word=>!STOP_WORDS.has(word)));
}
export function conceptGraph(pack:Pack){
 const groups=new Map<string,ConceptGraphNode>();
 for(const q of pack.questions){
  const name=q.conceptName?.trim()||'Umum';
  const entry=groups.get(name)??{id:name,name,questions:[],priority:q.conceptPriority??'MODERATE'};
  entry.questions.push(q);groups.set(name,entry);
 }
 const nodes=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const words=nodes.map(n=>conceptTerms(n.questions.map(q=>q.keyPoint||q.explanation).join(' ')));
 const edges:ConceptEdge[]=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const shared=[...words[i]].filter(w=>words[j].has(w)).sort();
  if(shared.length>=2)edges.push({source:nodes[i].id,target:nodes[j].id,shared:shared.slice(0,8)});
 }
 return {nodes,edges};
}
