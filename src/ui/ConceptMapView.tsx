import {useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Maximize2,Minus,Plus,Search} from 'lucide-react';
import {conceptMapPositions,conceptRelationLabels,parseConceptMap} from '../shared/conceptMap';
import type {Artifact,Pack} from '../shared/types';
import type {ConceptRelation} from '../shared/conceptMap';
import './StudioV4.css';

type Props={maps:Artifact[];pack:Pack;onAsk:(prompt:string)=>void};
const sourceStatus={provided:'Sumber disertakan',model_inspected:'Dilaporkan diperiksa ChatGPT',unavailable:'Dokumen tidak tersedia'} as const;
const relationStatus={draft:'Draf belum diverifikasi',creator_reviewed:'Ditinjau pembuat (belum independen)',disputed:'Hubungan diperselisihkan'} as const;

export function ConceptMapView({maps,pack,onAsk}:Props){
 const [activeId,setActiveId]=useState('');
 const [selectedNode,setSelectedNode]=useState('');
 const [selectedRelation,setSelectedRelation]=useState('');
 const [search,setSearch]=useState('');
 const [zoom,setZoom]=useState(1);
 const artifact=maps.find(a=>a.id===activeId)??maps[0];
 const document=useMemo(()=>{
  if(!artifact)return null;
  try{return {value:parseConceptMap(artifact.content),error:''};}
  catch(e){return {value:null,error:e instanceof Error?e.message:'Peta tidak dapat dibaca'};}
 },[artifact]);
 if(!artifact||!document?.value)return <section className="v4-map-empty">
  <h3>{artifact?'Peta konsep belum valid':'Belum ada peta konsep berbasis hubungan'}</h3>
  <p>{document?.error??'Grafik asosiasi kata tetap tersedia. Peta ilmiah memerlukan hubungan bertipe, alasan, dan sumber.'}</p>
  <button className="study-primary" onClick={()=>onAsk('Buat peta konsep untuk bank ini sebagai artifact kind concept_map. Isi JSON version 1, title, concepts dengan ID stabil, dan relations dari ID konsep, type (causes/inhibits/regulates/part_of/contrasts/prerequisite/example_of), rationale, status draft, sourceRefs [{title, anchor bila terverifikasi, status provided/model_inspected/unavailable}]. Simpan lewat MCP create_artifact dengan expectedRevision yang benar. Jangan mengarang halaman atau menyebutnya terverifikasi independen.')}>
   Rancang peta bersumber di ChatGPT
  </button>
 </section>;
 const map=document.value;
 const node=map.concepts.find(n=>n.id===selectedNode)??map.concepts[0];
 const relation=map.relations.find(r=>r.id===selectedRelation);
 const layout=conceptMapPositions(map.concepts);
 const positions=new Map(layout.map(p=>[p.id,p]));
 const visibleNodes=layout.filter(p=>map.concepts.find(n=>n.id===p.id)?.label.toLowerCase().includes(search.toLowerCase().trim()));
 const visibleIds=new Set(visibleNodes.map(n=>n.id));
 const selectedRelations=map.relations.filter(r=>r.from===node.id||r.to===node.id);
 const matchingQuestions=pack.questions.filter(q=>[node.label,...node.aliases].some(alias=>q.conceptName?.toLowerCase()===alias.toLowerCase()));
 function selectRelation(value:ConceptRelation){setSelectedRelation(value.id);setSelectedNode(value.from);}
 return <section className="v4-map-root" aria-label={'Peta konsep '+map.title}>
  <div className="v4-studio-heading">
   <div><small>STUDIO / CONCEPT MAP</small><h3>{map.title}</h3><p>Hubungan ditulis oleh pembuat konten, bukan otomatis diverifikasi Noodl. Periksa bukti sebelum memakai sebagai fakta.</p></div>
   {maps.length>1&&<label>Pilih peta
    <select value={artifact.id} onChange={e=>{setActiveId(e.target.value);setSelectedNode('');setSelectedRelation('');}}>
     {maps.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
    </select></label>}
  </div>
  <div className="v4-map-tools">
   <label><Search size={16}/><input type="search" placeholder="Cari konsep" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <div className="v4-map-zoom"><button onClick={()=>setZoom(z=>Math.max(.7,Math.round((z-.15)*100)/100))} aria-label="Perkecil peta"><Minus size={17}/></button>
    <button onClick={()=>setZoom(1)} aria-label="Sesuaikan peta"><Maximize2 size={17}/></button>
    <button onClick={()=>setZoom(z=>Math.min(1.6,Math.round((z+.15)*100)/100))} aria-label="Perbesar peta"><Plus size={17}/></button></div>
  </div>
  <div className="v4-map-columns">
   <div className="v4-map-content">
    <div className="v4-map-scroller" tabIndex={0} aria-label="Kanvas peta konsep, gulir untuk melihat bagian lain">
     <div className="v4-map-plane" style={{width:800*zoom,height:500*zoom}}>
      <div className="v4-map-scaled" style={{transform:'scale('+zoom+')'}}>
       <svg className="v4-map-edges" viewBox="0 0 800 500" aria-hidden="true">
        <defs><marker id="v4-map-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
         <path d="M0 0 L6 3 L0 6" fill="none" stroke="currentColor" strokeWidth="1.4"/></marker></defs>
        {map.relations.filter(r=>visibleIds.has(r.from)&&visibleIds.has(r.to)).map(r=>{
         const a=positions.get(r.from)!,b=positions.get(r.to)!;
         return <line key={r.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          className={selectedRelation===r.id?'selected':''} markerEnd="url(#v4-map-arrow)"/>;
        })}
       </svg>
       {visibleNodes.map(position=>{
        const item=map.concepts.find(n=>n.id===position.id)!;
        return <button key={item.id} type="button"
         className={'v4-map-node'+(node.id===item.id?' selected':'')}
         style={{left:position.x,top:position.y}} onClick={()=>{setSelectedNode(item.id);setSelectedRelation('');}}
         aria-pressed={node.id===item.id}>{item.label}</button>;
       })}
      </div>
     </div>
    </div>
    {map.concepts.length>layout.length&&<p className="v4-studio-note">Kanvas menampilkan {layout.length} dari {map.concepts.length} konsep. Daftar di bawah tetap mencakup seluruhnya.</p>}
    <div className="v4-map-outline" aria-label="Daftar konsep yang dapat diakses tanpa drag">
     <h4>Daftar konsep</h4>
     {map.concepts.filter(n=>n.label.toLowerCase().includes(search.toLowerCase().trim())).map(n=>
      <button key={n.id} onClick={()=>{setSelectedNode(n.id);setSelectedRelation('');}} aria-pressed={n.id===node.id}>
       {n.label}<ArrowRight size={15}/>
      </button>)}
    </div>
   </div>
   <aside className="v4-map-inspector" aria-label="Detail hubungan konsep">
    <small>INSPECTOR</small>
    <h3>{relation?map.concepts.find(n=>n.id===relation.from)?.label+' → '+map.concepts.find(n=>n.id===relation.to)?.label:node.label}</h3>
    {relation?<><p><strong>{conceptRelationLabels[relation.type]}</strong> · {relationStatus[relation.status]}</p>
      <p>{relation.rationale}</p>
      <h4>Sumber & status</h4>
      {relation.sourceRefs.map((src,i)=><p key={i}>{src.uri?<a href={src.uri} target="_blank" rel="noreferrer">{src.title}</a>:src.title}
       {src.anchor?' · '+src.anchor:''}<small>{sourceStatus[src.status]}</small></p>)}
     </>:<>
      <h4>Hubungan terkait ({selectedRelations.length})</h4>
      {selectedRelations.map(r=><button key={r.id} className="v4-map-relation" onClick={()=>selectRelation(r)}>
       {map.concepts.find(n=>n.id===r.from)?.label} <strong>{conceptRelationLabels[r.type]}</strong> {map.concepts.find(n=>n.id===r.to)?.label}
       <small>{relationStatus[r.status]}</small>
      </button>)}
      {!selectedRelations.length&&<p>Belum ada hubungan pada konsep ini.</p>}
      <p><BookOpen size={14}/> {matchingQuestions.length} soal dengan label konsep yang sama.</p>
     </>}
    <button className="study-secondary" onClick={()=>onAsk('Bantu periksa klaim hubungan dalam peta konsep '+map.title+' untuk bank '+pack.title+'. Fokus: '+(relation?relation.rationale:node.label)+'. Sebutkan sumber yang benar-benar tersedia dan tandai bagian yang belum bisa diverifikasi. Jangan mengubah bank tanpa instruksi.')}>Bahas / periksa di ChatGPT</button>
    {relation&&<button className="study-secondary" onClick={()=>setSelectedRelation('')}>Kembali ke konsep</button>}
   </aside>
  </div>
 </section>;
}
