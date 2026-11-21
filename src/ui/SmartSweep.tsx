import {useEffect,useMemo,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {ArrowLeft,ArrowRight,BookOpen,Check,ClipboardCheck,FileSearch,Keyboard,Layers,RotateCcw,ShieldCheck} from 'lucide-react';
import {client} from '../client';
import {buildExamCoverage,selectSweepCandidates,selectAuditQuestions,type SweepDecision,type SweepChoice} from '../shared/examCoverage';
import type {Attempt,Pack,Question,ReviewEvent} from '../shared/types';
import type {Locale} from './classic/Navigation';
import './SmartSweep.css';

type Props={
 pack:Pack;attempts:Attempt[];reviews:ReviewEvent[];locale:Locale;busy:boolean;
 onClose:()=>void;onStartBatch:(questions:Question[])=>void;onFullExam:()=>void;
 onAskChatGPT?:(request:string)=>Promise<void>;
};
const statusText={
 unseen:'Belum pernah ditampilkan',seen:'Pernah dilihat, belum teruji',
 self_claimed:'Mengaku tahu · belum teruji',tested:'Pernah diuji benar',
 stable:'Benar pada sesi berbeda',needs_repair:'Ada kesalahan terakhir'
};
const perPage=5;
function explainKind(q:Question,english:boolean){
 if(q.type==='MULTIPLE_CHOICE')return english?'Choose an option if this were a quiz':'Pikirkan opsi mana yang akan dipilih';
 if(q.type==='TRUE_FALSE')return english?'True or false?':'Benar atau salah?';
 return english?'Recall the missing term':'Ingat istilah yang hilang';
}
export function SmartSweep({pack,attempts,reviews,locale,busy,onClose,onStartBatch,onFullExam,onAskChatGPT}:Props){
 const en=locale==='en',reduced=useReducedMotion()||document.documentElement.dataset.reducedMotion==='true';
 const [tab,setTab]=useState<'scan'|'ledger'>('scan');
 const [decisions,setDecisions]=useState<SweepDecision[]>([]);
 const [loading,setLoading]=useState(true),[networkError,setNetworkError]=useState('');
 const [pending,setPending]=useState(0),[conflicts,setConflicts]=useState(0);
 const [saving,setSaving]=useState<string|null>(null),[message,setMessage]=useState('');
 const [page,setPage]=useState(0),[cursor,setCursor]=useState(0),[showTested,setShowTested]=useState(false);
 const rowRefs=useRef<Array<HTMLDivElement|null>>([]);
 const mounted=useRef(true);
 useEffect(()=>{
  let active=true;
  mounted.current=true;
  setLoading(true);setMessage('');
  void client.readCoverageDecisions(pack.id).then(data=>{
   if(!active)return;
   setDecisions(data.decisions);setPending(data.pending);setConflicts(data.conflicts.length);
   setNetworkError(data.error??'');
  }).catch(error=>{if(active)setNetworkError(error instanceof Error?error.message:String(error));})
   .finally(()=>{if(active)setLoading(false)});
  return ()=>{active=false;mounted.current=false};
 },[pack.id,pack.revision]);
 const coverage=useMemo(()=>buildExamCoverage(pack,attempts,reviews,decisions),
  [pack,attempts,reviews,decisions]);
 const all=useMemo(()=>selectSweepCandidates(coverage,reviews),[coverage,reviews]);
 const scannable=useMemo(()=>all.filter(item=>showTested||item.point.status==='needs_repair'||
  (!item.point.verified||item.point.untested>0)),[all,showTested]);
 const maxPage=Math.max(0,Math.ceil(scannable.length/perPage)-1);
 const currentPage=Math.min(page,maxPage);
 const pageItems=scannable.slice(currentPage*perPage,currentPage*perPage+perPage);
 const choices=useMemo(()=>{
  const sorted=decisions.filter(x=>x.packId===pack.id&&x.ownerId===pack.ownerId&&x.packRevision===pack.revision)
   .sort((a,b)=>a.decidedAt.localeCompare(b.decidedAt)||a.id.localeCompare(b.id));
  return Object.fromEntries(sorted.map(x=>[x.pointId,x.choice])) as Record<string,SweepChoice>;
 },[decisions,pack.id,pack.ownerId,pack.revision]);
 const marked=all.filter(x=>choices[x.point.point.id]!==undefined&&!x.point.verified);
 const audit=selectAuditQuestions(marked,choices,20,pack.id+':'+attempts.length);
 const scanned=scannable.filter(x=>choices[x.point.point.id]!==undefined).length;
 const sourceAnchors=new Set(pack.questions.flatMap(q=>q.sourceRefs??[])
  .filter(ref=>ref.status!=='unavailable')
  .map(ref=>ref.title+'|'+(ref.anchor??'')));
 const latestAuditMisses=coverage.points.filter(p=>p.status==='needs_repair').length;
 function changePage(next:number){setPage(Math.max(0,Math.min(maxPage,next)));setCursor(0);}
 async function decide(pointId:string,questionId:string,choice:SweepChoice){
  if(saving||busy)return;
  setSaving(pointId);setMessage('');
  try{
   const saved=await client.recordCoverageDecision(pack,pointId,questionId,choice);
   if(!mounted.current)return;
   setDecisions(current=>[...current,saved]);
   setPending(value=>client.getState().localOnly?value:value+1);
   setMessage(en?'Saved on this device; server sync is separate.':'Tersimpan di perangkat. Sinkronisasi server berjalan terpisah.');
  }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:String(e));}
  finally{if(mounted.current)setSaving(null);}
 }
 function keys(event:React.KeyboardEvent<HTMLElement>){
  if(tab!=='scan'||loading||saving||busy||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const target=event.target;
  if(target instanceof HTMLElement&&target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(event.key==='ArrowDown'||event.key==='j'){
   event.preventDefault();const next=Math.min(pageItems.length-1,cursor+1);
   setCursor(next);rowRefs.current[next]?.focus();return;
  }
  if(event.key==='ArrowUp'||event.key==='k'){
   event.preventDefault();const next=Math.max(0,cursor-1);
   setCursor(next);rowRefs.current[next]?.focus();return;
  }
  if(event.key==='1'||event.key==='2'){
   if(!pageItems[cursor])return;
   event.preventDefault();
   const item=pageItems[cursor];
   void decide(item.point.point.id,item.question.id,event.key==='1'?'known':'unsure');
   const next=Math.min(pageItems.length-1,cursor+1);setCursor(next);rowRefs.current[next]?.focus();
  }
 }
 const map=pack.artifacts.find(a=>a.kind==='exam_map');
 function askMap(){
  if(!onAskChatGPT)return;
  setMessage(en?'Opening ChatGPT request; no map has been saved yet.':'Permintaan peta dikirim ke ChatGPT, belum berarti sudah tersimpan.');
  void onAskChatGPT(`Gunakan materi sumber yang sudah tersedia dalam percakapan untuk bank "${pack.title}" (packId ${pack.id}, revision ${pack.revision}). Rancang satu artifact kind exam_map dengan JSON version:1,title,points:[{id,label,kind:fact|mechanism|exception|application,questionIds,status:draft|author_reviewed,equivalenceReason,sourceRefs:[{title,anchor,status}]}]. Hanya gabungkan soal bila memang menguji fakta ujian yang SAMA, bukan hanya punya conceptName yang mirip. Tandai kasus dan pengecualian sebagai poin terpisah. Jangan mengarang slide, jangan menandai review independen; bila ragu gunakan draft. Validasi seluruh questionId dengan bank, simpan via MCP create_artifact setelah persetujuan dan konfirmasi revisi, lalu laporkan receipt. Bank dan soal lama harus utuh.`)
   .catch(e=>setMessage(e instanceof Error?e.message:String(e)));
 }
 return <section className="sweep-root" aria-label="Smart Sweep">
  <div className="sweep-top">
   <button className="sweep-back" onClick={onClose}><ArrowLeft size={17}/>{en?'Back to bank':'Kembali ke bank'}</button>
   <span className="sweep-eyebrow">NOODL / EXAM COVERAGE</span>
  </div>
  <header className="sweep-header">
   <div><h2>Smart Sweep</h2><p>{en?'Skip unnecessary repeats without deleting questions or pretending to know the exam.':'Kurangi soal berulang tanpa menghapus butir atau mengarang kepastian soal ujian.'}</p></div>
   <button className="sweep-full" type="button" disabled={busy} onClick={onFullExam}><BookOpen size={17}/>{en?'Full exam · all questions':'Full Exam · semua soal'}</button>
  </header>
  <div className="sweep-numbers" aria-label={en?'Actual exam bank coverage':'Cakupan bank yang benar-benar tercatat'}>
   <div><strong>{coverage.pointCount}</strong><span>{en?'candidate exam points':'poin ujian dalam bank'}</span></div>
   <div><strong>{coverage.totals.untestedPoints}</strong><span>{en?'points without confirmed correct evidence':'poin belum terbukti benar'}</span></div>
   <div><strong>{coverage.totals.untestedQuestions}</strong><span>{en?'individual questions not tested':'butir belum diuji'}</span></div>
  </div>
  <nav className="sweep-tabs" aria-label={en?'Sweep sections':'Bagian Smart Sweep'}>
   <button aria-current={tab==='scan'?'page':undefined} onClick={()=>setTab('scan')}><Layers size={16}/>{en?'Rapid Scan':'Scan cepat'}</button>
   <button aria-current={tab==='ledger'?'page':undefined} onClick={()=>setTab('ledger')}><FileSearch size={16}/>{en?'Coverage ledger':'Peta cakupan'}</button>
  </nav>
  {loading?<p role="status" className="sweep-loading">{en?'Reading your saved Sweep decisions…':'Membaca keputusan Sweep yang tersimpan…'}</p>:
  tab==='scan'?<div className="sweep-scan" onKeyDown={keys}>
   <div className="sweep-step">
    <div><strong>{en?'1 · Mark what is familiar':'1 · Tandai yang terasa familier'}</strong>
     <p>{en?'Known is only a claim. Audit questions must still be answered in a real quiz.':'Sudah tahu hanyalah pengakuan. Sebagian tetap wajib dibuktikan dengan jawaban kuis sungguhan.'}</p></div>
    <p className="sweep-scan-stat">{scanned} / {scannable.length} {en?'marked':'ditandai'}</p>
   </div>
   <div className="sweep-progress" role="progressbar" aria-label={en?'Scan completion':'Progres scan'}
    aria-valuemin={0} aria-valuemax={scannable.length} aria-valuenow={scanned}>
    <span style={{width:(scannable.length?scanned/scannable.length*100:100)+'%'}}/>
   </div>
   <div className="sweep-keyboard-note"><Keyboard size={15}/>{en?'1: Known · 2: Unsure · ↑/↓: Move':'1: Sudah tahu · 2: Ragu · ↑/↓: Pindah baris'}</div>
   {scannable.length?<AnimatePresence mode="wait" initial={false}>
    <motion.div key={currentPage} className="sweep-scan-list"
     initial={reduced?false:{opacity:0,x:8}} animate={{opacity:1,x:0}}
     exit={reduced?undefined:{opacity:0,x:-8}} transition={{duration:.14}}>
     {pageItems.map((item,i)=>{
      const choice=choices[item.point.point.id];
      return <div key={item.point.point.id} ref={element=>{rowRefs.current[i]=element;}} tabIndex={0}
       className={'sweep-scan-row'+(cursor===i?' is-current':'')}
       onFocus={()=>setCursor(i)}>
       <div className="sweep-row-meta"><span>{currentPage*perPage+i+1} / {scannable.length}</span>
        <span>{item.point.point.kind==='exception'?'Pengecualian':item.point.point.kind==='mechanism'?'Mekanisme':item.point.point.kind==='application'?'Penerapan':'Fakta'}</span>
        {item.point.point.questionIds.length>1&&<span>{item.point.point.questionIds.length} variasi · {item.point.untested} belum diuji</span>}
       </div>
       <h3>{item.question.text}</h3>
       {item.question.options&&<div className="sweep-question-options" aria-label="Pilihan tanpa kunci">{item.question.options.map((opt,j)=>
        <span key={opt.id}>{String.fromCharCode(65+j)}. {opt.text}</span>)}</div>}
       {!item.question.options&&<p className="sweep-question-kind">{explainKind(item.question,en)}</p>}
       <div className="sweep-scan-actions" role="group" aria-label={en?'Self-assessment':'Klaim pengguna'}>
        <button type="button" disabled={saving!==null||busy} aria-pressed={choice==='known'}
         onClick={()=>void decide(item.point.point.id,item.question.id,'known')}>
         <Check size={16}/>{en?'I know this':'Sudah tahu'} <small>1</small></button>
        <button type="button" disabled={saving!==null||busy} aria-pressed={choice==='unsure'}
         onClick={()=>void decide(item.point.point.id,item.question.id,'unsure')}>
         <RotateCcw size={16}/>{en?'Unsure / test me':'Ragu · uji'} <small>2</small></button>
        <span className="sweep-row-evidence">{statusText[item.point.status]}</span>
       </div>
      </div>;
     })}
    </motion.div>
   </AnimatePresence>:<div className="sweep-empty"><ShieldCheck size={28}/><h3>{en?'No urgent point remains in this filter':'Tidak ada poin prioritas pada filter ini'}</h3>
     <p>{en?'This is not proof that every exam question has been mastered.':'Ini bukan bukti bahwa seluruh kemungkinan soal ujian sudah dikuasai.'}</p></div>}
   <div className="sweep-page-controls">
    <button type="button" disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}><ArrowLeft size={16}/>{en?'Previous':'Sebelumnya'}</button>
    <span>{currentPage+1} / {maxPage+1}</span>
    <button type="button" disabled={currentPage>=maxPage} onClick={()=>changePage(currentPage+1)}>{en?'Next':'Berikutnya'}<ArrowRight size={16}/></button>
   </div>
   <label className="sweep-show-tested"><input type="checkbox" checked={showTested} onChange={e=>{setShowTested(e.target.checked);setPage(0);}}/>
    {en?'Include already tested points in Rapid Scan':'Tampilkan juga poin yang sudah pernah diuji'}</label>
   <section className="sweep-audit">
    <div className="sweep-step"><div><strong>{en?'2 · Verify with real questions':'2 · Buktikan lewat kuis sungguhan'}</strong>
     <p>{en?'All unsure points are prioritized. A deterministic sample of known claims is audited without increasing difficulty.':'Poin ragu diprioritaskan. Sebagian klaim tahu diambil sebagai audit tanpa menaikkan tingkat kesulitan.'}</p></div>
     <strong>{audit.questions.length} {en?'questions':'soal'}</strong></div>
    <div className="sweep-audit-stats">
     <span>{audit.unsureCount} {en?'unsure':'ragu'}</span>
     <span>{audit.auditCount} {en?'known claims sampled':'klaim tahu diaudit'}</span>
     <span>{audit.unverifiedKnown} {en?'known claims not equivalent to proof':'klaim tahu belum menjadi bukti'}</span>
    </div>
    <button className="sweep-audit-start" disabled={busy||!audit.questions.length}
     onClick={()=>onStartBatch(audit.questions)}><ClipboardCheck size={18}/>
     {en?'Start saved verification Batch':'Mulai Batch verifikasi tersimpan'}<ArrowRight size={18}/></button>
    {audit.notIncluded>0&&<p className="sweep-caution">{audit.notIncluded} {en?'marked points are not in this Batch; they remain recorded for later checks.':'poin bertanda tidak masuk Batch kali ini; tetap tercatat untuk pemeriksaan berikutnya.'}</p>}
    {latestAuditMisses>0&&<p className="sweep-caution">{latestAuditMisses} {en?'points include saved wrong answers and remain repair priorities.':'poin mempunyai bukti jawaban salah dan tetap diprioritaskan untuk perbaikan.'}</p>}
   </section>
  </div>:<div className="sweep-ledger">
   <div className="sweep-step"><div><strong>{en?'A record, not a mastery percentage':'Catatan cakupan, bukan persentase penguasaan'}</strong>
    <p>{en?'Source references, examined points and individual quiz answers are separate layers.':'Referensi sumber, poin ujian, dan jawaban setiap butir adalah tiga lapisan berbeda.'}</p></div></div>
   <div className="sweep-ledger-stats">
    <div><span>{en?'Bank questions with authored point map':'Soal yang sudah dipetakan pembuat'}</span><strong>{coverage.mappedQuestions} / {coverage.questionCount}</strong></div>
    <div><span>{en?'Individually scored questions':'Soal yang benar-benar dinilai'}</span><strong>{coverage.totals.testedQuestions} / {coverage.questionCount}</strong></div>
    <div><span>{en?'Source anchors referenced in bank':'Rujukan sumber yang tercatat'}</span><strong>{sourceAnchors.size}</strong></div>
   </div>
   <p className="sweep-caution">Jumlah rujukan bukan ukuran kelengkapan PPT atau prediksi materi ujian. Noodl belum memeriksa semua halaman sumber.</p>
   {!map&&<div className="sweep-map-action"><strong>Belum ada Exam Point Map yang ditinjau</strong>
    <p>Setiap soal masih diperlakukan sebagai poin tersendiri. ChatGPT dapat memetakan soal berdasarkan materi yang sudah disediakan melalui MCP, tanpa uploader kedua.</p>
    {onAskChatGPT&&<button type="button" onClick={askMap}>Buat peta dengan ChatGPT <ArrowRight size={15}/></button>}
   </div>}
   <div className="sweep-ledger-head"><strong>{en?'Exam point ledger':'Daftar poin ujian'}</strong>
    <span>{coverage.reviewedGroups} {en?'explicitly reviewed multi-question groups':'kelompok multi-soal yang ditinjau pembuat'}</span></div>
   <div className="sweep-point-list">{coverage.points.map(row=><details key={row.point.id}>
    <summary><span className={'sweep-status-dot '+row.status} aria-hidden="true"/>
     <span>{row.point.label}</span><small>{statusText[row.status]}</small>
     <strong>{row.tested}/{row.questions.length}</strong>
    </summary>
    <div className="sweep-point-details">
     <p>{row.point.kind} · {row.point.status==='author_reviewed'?'Pengelompokan ditinjau pembuat':'Belum digabung sebagai soal setara'}</p>
     {row.point.equivalenceReason&&<p>Alasan pengelompokan: {row.point.equivalenceReason}</p>}
     <p>{row.untested} variasi belum dinilai. {row.claimed?'Pengguna mengaku tahu; bukan nilai benar.':''}</p>
     <ul>{row.questions.map(q=><li key={q.question.id}>{q.question.text} — {q.correct+q.incorrect?(
      q.latest==='incorrect'?'Terakhir salah':q.latest==='correct'?'Terakhir benar':'Teruji'):'Belum dijawab'}</li>)}</ul>
     {row.point.sourceRefs.length>0&&<p>Rujukan pembuat: {row.point.sourceRefs.map(s=>s.title+(s.anchor?' · '+s.anchor:'')).join('; ')}. Bukan verifikasi independen.</p>}
    </div>
   </details>)}</div>
   <button type="button" className="sweep-full is-bottom" onClick={onFullExam} disabled={busy}>
    <BookOpen size={17}/>{en?'Take the full unfiltered exam':'Kerjakan seluruh bank tanpa filter'}</button>
  </div>}
  {(message||networkError||pending>0||conflicts>0)&&<div className="sweep-notices" role="status">
   {message&&<p>{message}</p>}
   {networkError&&<p>{en?'Server could not be checked: ':'Server belum bisa diperiksa: '}{networkError}</p>}
   {pending>0&&<p>{pending} {en?'local claims may still be awaiting server confirmation':'klaim lokal mungkin masih menunggu konfirmasi server'}.</p>}
   {conflicts>0&&<p>{conflicts} {en?'claims belong to a previous bank revision and require review':'klaim merujuk revisi bank lama dan perlu diperiksa ulang'}.</p>}
  </div>}
  <footer className="sweep-footnote"><ShieldCheck size={17}/>
   {en?'No question is deleted. A known mark never raises grades or advances spaced repetition.':'Tidak ada soal dihapus. Penanda tahu tidak pernah menaikkan nilai atau memajukan jadwal SRS.'}
  </footer>
 </section>;
}
