import {Comics} from './Comic';
import React, { useMemo, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BookOpen, Network, Orbit, X, Download, MessageCircle, BrainCircuit, ChevronRight, Check, RefreshCw } from 'lucide-react';
import {correctAnswerText} from '../shared/engine';
import {buildReviewQueues,type QueueEntry} from './reviewQueue';
import {conceptGraph} from '../shared/conceptGraph';
import type { Pack, Question, ReviewEvent, Attempt } from '../shared/types';
import { requestTutor } from '../client/bridge';
import './Tools.css';

function download(name:string,content:string|Blob,type='text/plain'){const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const safeName=(name:string)=>name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,90)||'noodl';
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const csvCell=(s:string)=>`"${s.replace(/^[=+@\-\t\r]/,' $&').replaceAll('"','""')}"`;
function Markdown({text}:{text:string}){return <div className="tools-markdown"><ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex]}>{text}</ReactMarkdown></div>;}

export function ExportMenu({pack}:{pack:Pack}){
 const [answers,setAnswers]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const questions=()=>pack.questions.map(q=>answers?q:{id:q.id,type:q.type,text:q.text,options:q.options,difficulty:q.difficulty,conceptName:q.conceptName});
 async function pdf(){setBusy(true);setError('');try{const {pdf,Document,Page,Text,View,Font}=await import('@react-pdf/renderer');Font.register({family:'NoodlInter',src:`${location.origin}/fonts/Inter-Regular.ttf`});const document=<Document title={pack.title}><Page size="A4" style={{padding:36,fontFamily:'NoodlInter',fontSize:10,lineHeight:1.5}}><Text style={{fontSize:22,marginBottom:10}}>{pack.title}</Text><Text style={{marginBottom:18,color:'#666'}}>{pack.description}</Text>{pack.questions.map((q,i)=><View key={q.id} wrap={false} style={{marginBottom:18}}><Text style={{fontSize:12,marginBottom:5}}>{i+1}. {q.text}</Text>{q.options?.map((o,j)=><Text key={o.id}>{String.fromCharCode(65+j)}. {o.text}</Text>)}{answers&&<><Text style={{marginTop:5,color:'#5b21b6'}}>Jawaban: {correctAnswerText(q)}</Text><Text>{q.explanation}</Text></>}</View>)}</Page></Document>;download(`${safeName(pack.title)}.pdf`,await pdf(document).toBlob(),'application/pdf');}catch(e){setError(e instanceof Error?e.message:'Ekspor gagal');}finally{setBusy(false);}}
 return <details className="export-menu"><summary><Download size={15}/> Ekspor</summary><div className="export-popover"><label><input type="checkbox" checked={answers} onChange={e=>setAnswers(e.target.checked)}/> Sertakan jawaban & pembahasan</label><button onClick={()=>download(`${safeName(pack.title)}.json`,JSON.stringify({title:pack.title,description:pack.description,tags:pack.tags,questions:questions()},null,2),'application/json')}>Bank soal JSON</button><button onClick={()=>download(`${safeName(pack.title)}.csv`,'\ufeff'+[['No','Tipe','Soal','Pilihan',...(answers?['Jawaban','Pembahasan']:[])],...pack.questions.map((q,i)=>[String(i+1),q.type,q.text,q.options?.map(o=>o.text).join(' | ')??'',...(answers?[correctAnswerText(q),q.explanation]:[])])].map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8')}>Bank soal CSV</button><button disabled={busy} onClick={()=>void pdf()}>{busy?'Menyiapkan PDF…':'Bank soal PDF'}</button>{error&&<small role="alert">{error}</small>}</div></details>;
}

const simulationCsp="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function simulationDocument(content:string){return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${simulationCsp}"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${content}</body></html>`;}
export function LearningTools({pack,onClose,attempts=[],initialTab='material'}:{pack:Pack;onClose:()=>void;attempts?:Attempt[];initialTab?:'material'|'graph'|'visual'|'comic'}){
 const [view,setView]=useState({x:0,y:0,z:1});const drag=useRef<{x:number;y:number}|null>(null);const pointers=useRef(new Map<number,{x:number;y:number}>());const pinch=useRef<number|null>(null);const [tab,setTab]=useState<'material'|'graph'|'visual'|'comic'>(initialTab),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState('');
 const fullGraph=useMemo(()=>conceptGraph(pack),[pack]);
 const [search,setSearch]=useState(''),[branch,setBranch]=useState<string|null>(null);
 const [visualFormat,setVisualFormat]=useState('Diagram alur'),[visualTopic,setVisualTopic]=useState('');
 const graph=useMemo(()=>{
  const neighbors=new Set([branch]);
  for(const edge of fullGraph.edges){
   if(edge.source===branch)neighbors.add(edge.target);
   if(edge.target===branch)neighbors.add(edge.source);
  }
  const nodes=fullGraph.nodes.filter(node=>(!branch||neighbors.has(node.id))&&node.name.toLowerCase().includes(search.trim().toLowerCase()));
  const ids=new Set(nodes.map(node=>node.id));
  return {nodes,edges:fullGraph.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target))};
 },[fullGraph,branch,search]);
const topicStats=useMemo(()=>{const stats=new Map<string,{total:number;correct:number}>();for(const attempt of attempts.filter(a=>a.status==='completed'))for(const answer of attempt.answers){const item=attempt.items.find(i=>i.id===answer.occurrenceId);if(!item||item.sourcePackId!==pack.id)continue;const topic=item.question.conceptName||'Umum',entry=stats.get(topic)||{total:0,correct:0};entry.total++;if(answer.isCorrect)entry.correct++;stats.set(topic,entry);}return stats;},[attempts,pack.id]);const active=graph.nodes.find(n=>n.id===selected)||graph.nodes[0];const material=pack.artifacts.filter(a=>a.kind==='material'||a.kind==='insight'),visuals=pack.artifacts.filter(a=>a.kind==='visualization');
 const visualUrl=new URL('/',document.baseURI);
 visualUrl.searchParams.set('pack',pack.id);
 visualUrl.searchParams.set('tool','visual');
 const [visualId,setVisualId]=useState(''),[reload,setReload]=useState(0);const visual=visuals.find(a=>a.id===visualId)||visuals[0];
 async function tutor(message:string,q?:Question){setError('');try{await requestTutor(pack,q,message);}catch(e){setError(e instanceof Error?e.message:'Tidak dapat membuka ChatGPT');}}
 function exportGraphHtml(){const html=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(pack.title)}</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:20px;background:#f8f7ff;color:#23213d}section{background:white;border:1px solid #ddd7f0;border-radius:16px;padding:24px;margin:20px 0}summary{cursor:pointer;font-weight:600}p{white-space:pre-wrap}</style><h1>${escapeHtml(pack.title)}</h1>${graph.nodes.map(n=>`<section><h2>${escapeHtml(n.name)}</h2>${n.questions.map(q=>`<details><summary>${escapeHtml(q.text)}</summary><p>${escapeHtml(correctAnswerText(q))}</p><p>${escapeHtml(q.explanation)}</p></details>`).join('')}</section>`).join('')}</html>`;download(`${safeName(pack.title)}-peta.html`,html,'text/html');}
 return <section className="learning-tools"><header className="tools-header"><div><small>ALAT BELAJAR</small><h2>{pack.title}</h2></div><div className="tools-actions"><ExportMenu pack={pack}/><button onClick={onClose} aria-label="Tutup alat belajar"><X size={20}/></button></div></header><nav className="tools-tabs" aria-label="Alat belajar">{([['material',BookOpen,'Materi & insight'],['graph',Network,'Peta konsep'],['visual',Orbit,'Visual Lab'],['comic',BookOpen,'Komik']] as const).map(([key,Icon,label])=><button className={tab===key?'active':''} key={key} onClick={()=>setTab(key)}><Icon size={17}/>{label}</button>)}</nav>{error&&<p role="alert" className="tools-error">{error}</p>}
 {tab==='comic'&&<Comics pack={pack}/>}
 {tab==='material'&&<div className="tools-material">{material.length?material.map(a=><article className="tools-panel" key={a.id}><div className="tools-between"><h3>{a.title}</h3><button onClick={()=>download(`${safeName(a.title)}.md`,a.content,'text/markdown')}>Unduh materi</button></div><Markdown text={a.content}/></article>):<div className="tools-empty"><BookOpen size={36}/><h3>Materinya menyusul lewat percakapan</h3><p>Minta ChatGPT menambahkan ringkasan, rumus, atau insight untuk bank ini.</p><button className="tools-primary" onClick={()=>void tutor('Tambahkan materi belajar dan insight untuk bank soal ini melalui tool create_artifact.')}>Minta materi ke ChatGPT</button></div>}<article className="tools-panel"><h3>Konsep dalam bank ini</h3><div className="concept-grid">{fullGraph.nodes.map(n=><button key={n.id} onClick={()=>{setSearch('');setBranch(null);setSelected(n.id);setTab('graph');}}><span>{n.name}</span><small>{n.questions.length} soal</small><ChevronRight size={16}/></button>)}</div></article></div>}
 {tab==='graph'&&<div><div className="tools-between graph-toolbar"><p>Garis menunjukkan istilah yang sama dalam pembahasan, bukan hubungan sebab-akibat atau prasyarat belajar.</p><div className="tools-actions"><button onClick={()=>download(`${safeName(pack.title)}-peta.json`,JSON.stringify(graph,null,2),'application/json')}>JSON</button><button onClick={exportGraphHtml}>HTML</button></div></div><div className="study-plan"><label>Cari konsep<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <button className="study-secondary" disabled={!active} onClick={()=>{if(active){setSearch('');setBranch(active.id);setSelected(active.id);}}}>Fokus cabang ini</button>
 {(branch||search)&&<button className="study-secondary" onClick={()=>{setBranch(null);setSearch('');}}>Tampilkan semua konsep</button>}
 {branch&&<p>Cabang: {branch}</p>}{!graph.nodes.length&&<p role="status">Tidak ada konsep yang cocok.</p>}</div><div className="graph-layout"><div className="tools-panel graph-canvas"><div className="tools-actions"><button aria-label="Perkecil peta" onClick={()=>setView(v=>({...v,z:Math.max(.5,v.z/1.2)}))}>−</button><button onClick={()=>setView({x:0,y:0,z:1})}>Reset peta</button><button aria-label="Perbesar peta" onClick={()=>setView(v=>({...v,z:Math.min(4,v.z*1.2)}))}>+</button></div><svg style={{touchAction:'none'}} viewBox={`${300-300/view.z+view.x} ${250-250/view.z+view.y} ${600/view.z} ${500/view.z}`} onWheel={e=>{e.preventDefault();setView(v=>({...v,z:Math.max(.5,Math.min(4,v.z*(e.deltaY>0?.9:1.1)))}));}} onPointerDown={e=>{pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(e.target===e.currentTarget)e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY};pinch.current=null;}} onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const all=[...pointers.current.values()];if(all.length>=2){const distance=Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y);if(pinch.current){const factor=distance/pinch.current;setView(v=>({...v,z:Math.max(.5,Math.min(4,v.z*factor))}));}pinch.current=distance;drag.current=null;}else if(drag.current){const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y,width=e.currentTarget.getBoundingClientRect().width;setView(v=>({...v,x:v.x-dx*600/width/v.z,y:v.y-dy*600/width/v.z}));drag.current={x:e.clientX,y:e.clientY};}}} onPointerUp={e=>{pointers.current.delete(e.pointerId);drag.current=null;pinch.current=null;}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);drag.current=null;pinch.current=null;}} role="img" aria-label="Hubungan konsep; seret untuk menggeser, cubit untuk memperbesar">{graph.edges.map((edge,i)=>{const ia=graph.nodes.findIndex(n=>n.id===edge.source),ib=graph.nodes.findIndex(n=>n.id===edge.target),point=(index:number)=>({x:300+200*Math.cos(2*Math.PI*index/Math.max(graph.nodes.length,1)-Math.PI/2),y:250+185*Math.sin(2*Math.PI*index/Math.max(graph.nodes.length,1)-Math.PI/2)});const a=point(ia),b=point(ib);return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4b5fd" strokeWidth="2"/>;})}{graph.nodes.map((n,i)=>{const x=graph.nodes.length===1?300:300+200*Math.cos(2*Math.PI*i/graph.nodes.length-Math.PI/2),y=graph.nodes.length===1?250:250+185*Math.sin(2*Math.PI*i/graph.nodes.length-Math.PI/2);return <g key={n.id} role="button" tabIndex={0} aria-label={n.name} onClick={()=>setSelected(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(n.id);}} className="graph-node"><circle cx={x} cy={y} r={active?.id===n.id?32:26} fill={active?.id===n.id?'#7c3aed':'#ede9fe'}/><text x={x} y={y+5} textAnchor="middle" fill={active?.id===n.id?'white':'#6d28d9'}>{n.questions.length}</text><text x={x} y={y+51} textAnchor="middle" fontSize="12" fill="currentColor">{n.name.length>26?n.name.slice(0,24)+'…':n.name}</text></g>;})}</svg><div className="graph-accessible">{graph.nodes.map(n=><button className={active?.id===n.id?'active':''} key={n.id} onClick={()=>setSelected(n.id)}>{n.name}</button>)}</div></div><article className="tools-panel graph-detail"><h3>{active?.name||'Belum ada konsep'}</h3>{active&&topicStats.has(active.name)&&<p>Akurasi latihan: {Math.round(topicStats.get(active.name)!.correct/topicStats.get(active.name)!.total*100)}% · {topicStats.get(active.name)!.total} jawaban</p>}{active&&<div className="tools-actions">{fullGraph.edges.filter(edge=>edge.source===active.id||edge.target===active.id).map(edge=>{
 const id=edge.source===active.id?edge.target:edge.source;
 return <button key={id} title={'Kesamaan istilah: '+edge.shared.join(', ')} onClick={()=>{setSearch('');setBranch(id);setSelected(id);}}>{id} <small>· {edge.shared.slice(0,3).join(', ')}</small></button>;
 })}</div>}{active?.questions.map(q=><details key={q.id}><summary>{q.text}</summary><strong>{correctAnswerText(q)}</strong><Markdown text={q.explanation}/><button onClick={()=>void tutor('Jelaskan soal dan konsep ini lebih lanjut.',q)}><MessageCircle size={15}/> Bahas di ChatGPT</button></details>)}</article></div></div>}
 {tab==='visual'&&<div><details className="study-plan" open={!visual||undefined}><summary>Rancang visualisasi</summary>
 <label>Konsep<select value={visualTopic} onChange={e=>setVisualTopic(e.target.value)}><option value="">Konsep utama bank</option>{fullGraph.nodes.map(n=><option key={n.id}>{n.name}</option>)}</select></label>
 <label>Bentuk visual<select value={visualFormat} onChange={e=>setVisualFormat(e.target.value)}>{['Diagram alur','Perbandingan','Simulasi interaktif'].map(f=><option key={f}>{f}</option>)}</select></label>
 <button className="tools-primary" onClick={()=>void tutor(`Saya memilih ${visualFormat} untuk ${visualTopic||'konsep utama bank'}. Sebelum membuat desain, klarifikasi tujuan belajar, fakta dan sumber, audiens, bahasa, dan gaya yang saya inginkan. Usulkan rancangan dan tunggu konfirmasi. Setelah disetujui, buat HTML mandiri, periksa hasil render dan akurasinya, lalu simpan ke bank melalui create_artifact.`)}>Bahas rancangan di ChatGPT</button></details>{!visual?null:<><div className="visual-picker">{visuals.map(v=><button className={v.id===visual.id?'active':''} key={v.id} onClick={()=>setVisualId(v.id)}>{v.title}</button>)}</div><article className="tools-panel"><div className="tools-between"><h3>{visual.title}</h3><button onClick={()=>setReload(x=>x+1)}><RefreshCw size={15}/> Muat ulang</button></div><iframe key={`${visual.id}-${reload}`} className="simulation-frame" title={visual.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={simulationDocument(visual.content)}/>{visual.explanation&&<Markdown text={visual.explanation}/>} {visual.interactionGuide&&<p className="tools-guide">{visual.interactionGuide}</p>}<a href={visualUrl.href} target="_blank" rel="noreferrer">Buka di website untuk tampilan penuh ↗</a></article></>}</div>}
 </section>;
}

export function ReviewDashboard({packs,reviews,onReview}:{packs:Pack[];reviews:ReviewEvent[];onReview:(event:ReviewEvent)=>Promise<void>|void}){
 const queues=useMemo(()=>buildReviewQueues(packs,reviews),[packs,reviews]);
 const [selected,setSelected]=useState<QueueEntry|null>(null),[flipped,setFlipped]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const choose=(entry:QueueEntry)=>{setSelected(entry);setFlipped(false);setError('');};
 async function rate(rating:0|1|2|3){
  if(!selected||busy)return;
  setBusy(true);setError('');
  try{
   await onReview({id:crypto.randomUUID(),cardId:`${selected.packId}:${selected.question.id}`,packId:selected.packId,questionId:selected.question.id,question:selected.question,rating,reviewedAt:new Date().toISOString()});
   setSelected(null);setFlipped(false);
  }catch(e){setError(e instanceof Error?e.message:'Rating belum tersimpan. Coba lagi.');}
  finally{setBusy(false);}
 }
 const total=queues.due.length+queues.newCards.length+queues.scheduled.length;
 const queue=queues.due.length?queues.due:queues.newCards;
 return <section className="review-dashboard desk-review">
  <div className="tools-between"><div><small>NEURO-SYNC</small><h2>Ingat lagi, sesuai jadwal.</h2><p className="desk-quiet">Kartu baru belum jatuh tempo. Jadwal dibuat setelah kartu dinilai.</p></div><BrainCircuit size={30}/></div>
  <div className="review-stats" aria-label="Ringkasan kartu"><article><strong>{queues.due.length}</strong><span>Jatuh tempo</span></article><article><strong>{queues.newCards.length}</strong><span>Kartu baru</span></article><article><strong>{queues.scheduled.length}</strong><span>Terjadwal</span></article></div>
  {error&&<p role="alert" className="tools-error">{error}</p>}
  {selected?<article className="tools-panel review-card"><div className="tools-between"><small>{selected.question.conceptName||'Latihan mengingat'}</small><button disabled={busy} onClick={()=>{setSelected(null);setFlipped(false);}} aria-label="Tutup kartu"><X size={18}/></button></div>
   <h3>{selected.question.text}</h3>
   {!flipped?<button className="tools-primary" onClick={()=>setFlipped(true)}>Tampilkan jawaban</button>:
    <><div className="review-answer"><Check size={20}/><strong>{correctAnswerText(selected.question)}</strong></div><Markdown text={selected.question.explanation}/><p>Seberapa mudah kamu mengingat jawaban tadi?</p>
     <div className="review-ratings">{(['Lupa','Sulit','Bagus','Mudah'] as const).map((label,i)=><button disabled={busy} key={label} onClick={()=>void rate(i as 0|1|2|3)}>{label}<small>{['Ulang dalam 1 menit','Sulit: jadwal pendek','Terjadwal','Interval lebih panjang'][i]}</small></button>)}</div></>}
   </article>:
   queue.length?<div className="tools-panel"><div className="tools-between"><h3>{queues.due.length?'Jatuh tempo sekarang':'Mulai kartu baru'}</h3><button className="tools-primary" onClick={()=>choose(queue[0])}>{queues.due.length?'Review sekarang':'Pelajari kartu baru'} <ChevronRight size={16}/></button></div>
    <p className="desk-quiet">{queues.due.length?'Kartu berikutnya sudah mencapai jadwal review.':'Belum ada kartu jatuh tempo. Kartu baru bisa mulai dijadwalkan.'}</p>
    {queue.slice(0,30).map(e=><button className="due-row" key={`${e.packId}:${e.question.id}`} onClick={()=>choose(e)}><span><strong>{e.question.conceptName||e.question.text.slice(0,70)}</strong><small>{e.packTitle} · {e.card?'Jatuh tempo':'Baru'}</small></span><ChevronRight size={18}/></button>)}
    {queue.length>30&&<p>{queue.length-30} kartu lainnya tersedia setelah daftar ini.</p>}
   </div>:<div className="tools-empty"><BrainCircuit size={39}/><h3>{total?'Belum waktunya review':'Belum ada kartu belajar'}</h3>
    <p>{total?'Semua kartu yang sudah dilatih masih terjadwal.':'Tambahkan bank soal untuk mulai mengingat dan menilai kartu.'}</p>
    {queues.scheduled[0]?.card&&<small>Berikutnya: {new Date(queues.scheduled[0].card.nextReview).toLocaleString()}</small>}
   </div>}
  {!selected&&queues.due.length>0&&queues.newCards.length>0&&<div className="desk-review-extra"><p>{queues.newCards.length} kartu baru juga tersedia.</p><button className="desk-secondary" onClick={()=>choose(queues.newCards[0])}>Mulai kartu baru</button></div>}
 </section>;
}
