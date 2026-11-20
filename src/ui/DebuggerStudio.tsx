import {useEffect,useId,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,CheckCircle2,RotateCcw,ShieldAlert,Workflow} from 'lucide-react';
import type {Pack,Artifact} from '../shared/types';
import {parseDebugger,gradeDebugger,type DebuggerGrade} from '../shared/debugger';
import {conceptMapPositions} from '../shared/conceptMap';
import {client} from '../client';
import './DebuggerStudio.css';

type HistoryItem={id:string;gradedAt:string;correct:number;total:number;passed:boolean;packRevision:number};
type Receipt={status:'committed';resultId:string;packRevision:number;grade:DebuggerGrade;replayed?:boolean};
type Props={pack:Pack;onAsk:(prompt:string)=>void};

function DebuggerCase({pack,artifact}:{pack:Pack;artifact:Artifact}){
 const parsed=useMemo(()=>{try{return {doc:parseDebugger(artifact.content),error:''}}catch(e){
  return {doc:null,error:e instanceof Error?e.message:'Unable to parse scenario'};
 }},[artifact]);
 const doc=parsed.doc;
 const [selectedEdge,setSelectedEdge]=useState('');
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [status,setStatus]=useState('');
 const [saving,setSaving]=useState(false);
 const [history,setHistory]=useState<HistoryItem[]>([]);
 const [historyError,setHistoryError]=useState('');
 const uniqueId=useId().replace(/:/g,'');
 useEffect(()=>{
  setSelectedEdge(doc?.edges[0]?.id??'');
  setAnswers(Object.fromEntries((doc?.edges??[]).map(e=>[e.id,e.displayLabel])));
  setReceipt(null);setStatus('');
 },[artifact.id,doc]);
 useEffect(()=>{
  let active=true;
  setHistory([]);setHistoryError('');
  if(!doc)return;
  if(client.getState().localOnly){setHistoryError('Mode browser lokal: hasil bisa diperiksa, tetapi belum disimpan ke server.');return;}
  void client.listDebuggerResults(pack.id,artifact.id).then(r=>{if(active)setHistory(r.items);})
   .catch(e=>{if(active)setHistoryError(e instanceof Error?e.message:'Riwayat tidak tersedia');});
  return ()=>{active=false;};
 },[pack.id,artifact.id,doc]);
 if(!doc)return <div className="v4-debugger-error" role="alert">
  <h3>Skenario belum valid</h3><p>{parsed.error}</p>
  <p>Minta ChatGPT memperbaiki format artifact `debugger` sebelum mencoba.</p></div>;
 const activeEdge=doc.edges.find(e=>e.id===selectedEdge)??doc.edges[0];
 const positions=conceptMapPositions(doc.nodes.map(n=>({...n,aliases:[]})));
 const points=new Map(positions.map(p=>[p.id,p]));
 const changed=doc.edges.some(e=>answers[e.id]!==e.displayLabel);
 async function submit(){
  if(!doc)return;
  if(saving||receipt||!changed)return;
  setSaving(true);setStatus('Menilai koreksi dan menyimpan bukti latihan…');
  try{
   if(client.getState().localOnly){
    const grade=gradeDebugger(doc,answers);
    setReceipt({status:'committed',resultId:'local-only',packRevision:pack.revision,grade});
    setStatus('Hasil diperiksa di perangkat, tetapi TIDAK tersimpan ke server.');
   }else{
    const result=await client.submitDebugger(pack.id,artifact.id,pack.revision,answers);
    setReceipt(result);
    setStatus('Hasil dikonfirmasi tersimpan di server.');
    const next=await client.listDebuggerResults(pack.id,artifact.id);
    setHistory(next.items);
   }
  }catch(e){
   setStatus('Gagal menyimpan. Jawaban tetap tersedia dan bisa dicoba ulang: '+(e instanceof Error?e.message:String(e)));
  }finally{setSaving(false);}
 }
 function restart(){
  if(!doc)return;
  setAnswers(Object.fromEntries(doc.edges.map(e=>[e.id,e.displayLabel])));
  setSelectedEdge(doc.edges[0].id);
  setReceipt(null);setStatus('Koreksi disetel ulang. Riwayat tersimpan tidak dihapus.');
 }
 return <div className="v4-debugger-case">
  <div className="v4-debugger-intro">
   <div><small>PERBAIKI HUBUNGAN</small><h3>{doc.title}</h3><p>{doc.prompt}</p></div>
   <p className="v4-debugger-boundary"><ShieldAlert size={16}/>{doc.limitations}</p>
  </div>
  <div className="v4-debugger-columns">
   <div className="v4-debugger-map">
    <svg viewBox="0 0 800 500" role="img" aria-label={doc.nodes.map(n=>n.label).join(', ')+'. Hubungan dapat dipilih dalam daftar di bawah.'}>
     <defs><marker id={uniqueId+'arrow'} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker></defs>
     {doc.edges.map(edge=>{
      const a=points.get(edge.from),b=points.get(edge.to);
      if(!a||!b)return null;
      return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedEdge===edge.id?'selected':''}
       markerEnd={'url(#'+uniqueId+'arrow)'} strokeWidth="2"/>;
     })}
     {doc.nodes.map(node=>{
      const p=points.get(node.id);
      if(!p)return null;
      return <g key={node.id}><rect x={p.x-81} y={p.y-28} width="162" height="56" rx="12"/>
       <text x={p.x} y={p.y+4} textAnchor="middle">{node.label.length>24?node.label.slice(0,22)+'…':node.label}</text></g>;
     })}
    </svg>
    <div className="v4-debugger-edge-list" aria-label="Daftar hubungan yang dapat diperbaiki">
     {doc.edges.map((edge,i)=>{
      const a=doc.nodes.find(n=>n.id===edge.from),b=doc.nodes.find(n=>n.id===edge.to);
      return <button type="button" aria-pressed={selectedEdge===edge.id} key={edge.id}
       onClick={()=>setSelectedEdge(edge.id)}>
       <span>{i+1}. {a?.label} → {b?.label}</span>
       <small>{answers[edge.id]??edge.displayLabel}</small><ArrowRight size={15}/>
      </button>;
     })}
    </div>
   </div>
   <aside className="v4-debugger-inspector" aria-label="Koreksi hubungan">
    <small>EDIT RELATION</small>
    <h3>{doc.nodes.find(n=>n.id===activeEdge.from)?.label} → {doc.nodes.find(n=>n.id===activeEdge.to)?.label}</h3>
    <p>Label saat ini: <strong>{activeEdge.displayLabel}</strong></p>
    <label htmlFor={'debugger-relation-'+uniqueId}>Pilih hubungan yang benar menurut materi</label>
    <select id={'debugger-relation-'+uniqueId} value={answers[activeEdge.id]??activeEdge.displayLabel}
     disabled={!!receipt||saving} onChange={e=>{setAnswers(prev=>({...prev,[activeEdge.id]:e.target.value}));setStatus('');}}>
     {activeEdge.choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}
    </select>
    <p className="v4-debugger-note">Setiap panah bisa diperiksa dan diperbaiki. Panah yang sudah benar boleh dibiarkan.</p>
    <button className="study-primary" type="button" onClick={()=>void submit()} disabled={saving||!!receipt||!changed}>
     {saving?'Menyimpan…':'Periksa & simpan koreksi'}
    </button>
    {receipt&&<button type="button" className="study-secondary" onClick={restart}><RotateCcw size={15}/> Coba skenario lagi</button>}
    <p role="status" className="v4-debugger-status">{status}</p>
   </aside>
  </div>
  {receipt&&<section className="v4-debugger-feedback" aria-label="Hasil perbaikan">
   <h3><CheckCircle2 size={19}/>{receipt.grade.correct} / {receipt.grade.total} hubungan benar</h3>
   <p>{receipt.grade.passed?'Semua hubungan sesuai model yang disimpan.':'Sebagian hubungan belum sesuai dengan kunci pembuat.'} {receipt.resultId==='local-only'?'Belum tersimpan ke server.':'Hasil tersimpan di server.'}</p>
   {receipt.grade.results.map((item,i)=><details key={item.edgeId} open={!item.correct}>
    <summary>{i+1}. {item.correct?'Tepat':'Perlu perbaikan'} · {item.selected}</summary>
    <p>Menurut model: <strong>{item.correctLabel}</strong></p><p>{item.explanation}</p>
    <ul>{item.sourceRefs.map((src,j)=><li key={j}>
     {src.uri?<a href={src.uri} target="_blank" rel="noreferrer">{src.title}</a>:src.title}
     {src.anchor?' · '+src.anchor:''} · {src.status==='provided'?'Sumber disertakan pembuat':src.status==='model_inspected'?'Dilaporkan diperiksa ChatGPT':'Sumber tidak tersedia'}
    </li>)}</ul>
   </details>)}
   <p className="v4-debugger-note">Kunci dan sumber dihasilkan atau disediakan pembuat. Noodl memvalidasi format dan menghitung penilaian, bukan memverifikasi klaim ilmiah secara independen.</p>
  </section>}
  <section className="v4-debugger-history" aria-label="Riwayat penilaian debugger">
   <h3><BookOpen size={17}/> Hasil sebelumnya</h3>
   {historyError&&<p>{historyError}</p>}
   {history.length?history.map(item=><div key={item.id}>
    <span>{new Date(item.gradedAt).toLocaleString('id-ID')}</span>
    <strong>{item.correct}/{item.total} benar</strong>
   </div>):!historyError&&<p>Belum ada hasil tersimpan untuk skenario ini.</p>}
  </section>
 </div>;
}
export function DebuggerStudio({pack,onAsk}:Props){
 const scenarios=pack.artifacts.filter(a=>a.kind==='debugger');
 const [chosen,setChosen]=useState('');
 const active=scenarios.find(a=>a.id===chosen)??scenarios[0];
 if(!active)return <section className="v4-debugger-empty">
  <Workflow size={34}/><h3>Belum ada Knowledge Debugger untuk bank ini</h3>
  <p>Contoh asam lambung sebelumnya adalah pilot statis. Skenario baru menggunakan diagram, pilihan koreksi, alasan, sumber, serta penilaian yang dapat disimpan.</p>
  <button className="study-primary" onClick={()=>onAsk('Rancang skenario Knowledge Debugger nonstatis untuk bank ini. Gunakan artifact kind debugger, JSON version 1: title,prompt,nodes (id,label),edges (id,from,to,displayLabel,correctLabel,choices,explanation,sourceRefs) dan limitations. Minimal satu panah sengaja salah. SourceRefs harus jujur terhadap sumber yang benar-benar tersedia. Simpan lewat create_artifact dengan expectedRevision yang benar, jangan mengarang pemeriksaan sumber.')}>Buat skenario melalui ChatGPT</button>
 </section>;
 return <section className="v4-debugger-root"><div className="v4-debugger-selector">
  <span>KNOWLEDGE DEBUGGER</span>
  {scenarios.length>1&&<label>Pilih skenario
   <select value={active.id} onChange={e=>setChosen(e.target.value)}>{scenarios.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select>
  </label>}
 </div>
  <DebuggerCase key={active.id+':'+pack.revision} pack={pack} artifact={active}/>
 </section>;
}
