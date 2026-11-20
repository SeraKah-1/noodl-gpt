import {useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowRight,BookOpen,Brain,Layers,Play,Plus,ChevronRight} from 'lucide-react';
import {buildReviewQueues} from '../reviewQueue';
import type {Attempt,Pack,ReviewEvent,StudyOptions as Options} from '../../shared/types';
import {progressFor} from '../../shared/engine';
import type {Locale} from './Navigation';

type Props={
 onProbe:(pack:Pack)=>void;onDebugger:()=>void;locale:Locale;packs:Pack[];attempts:Attempt[];reviews:ReviewEvent[];
 options:Options;busy:boolean;onOptions:(value:Options)=>void;onStart:(pack:Pack)=>void;onFlash:(pack:Pack)=>void;
 onResume:(attempt:Attempt)=>void;onLibrary:()=>void;onReview:()=>void;onImport:(file:File)=>Promise<void>;
 onBrainDump:()=>void;onCreate:()=>void;onChat:(message:string)=>void;onOpenPack:(pack:Pack)=>void;
};

export function DashboardMascot({count,locale}:{count:number;locale:Locale}){
 const [line,setLine]=useState(0),id=locale==='id';
 const faces=['( . _ . )','( ◕ ‿ ◕ )','(≧▽≦)'];
 const milestone=count>=30?2:count>=5?1:0;
 const messages=id
  ?['Satu soal yang dijawab lebih berguna daripada sepuluh menu yang dibuka.','Yang keliru bisa dicoba lagi. Catatan latihanmu tetap ada.','Noodl siap. Pilih apa yang mau kamu kerjakan.']
  :['One answered question beats ten menus opened.','You can retry missed questions. Your practice history stays.','Noodl is ready. Pick what you want to work on.'];
 return <section className="desk-companion" aria-label={id?'Teman belajar Noodl':'Noodl companion'}>
   <button className="desk-face" onClick={()=>setLine(n=>(n+1)%messages.length)} aria-label={id?'Ganti pesan maskot':'Change companion message'}>{faces[milestone]}</button>
   <div><p aria-live="polite">{messages[line]}</p><small>{count} {id?'sesi selesai':'completed sessions'}</small></div>
 </section>;
}
export function Home(props:Props){
 const {packs,attempts,reviews,locale,busy,onResume,onStart,onLibrary,onReview,onOpenPack,onCreate}=props;
 const id=locale==='id',reduce=useReducedMotion() || (typeof document!=='undefined'&&document.documentElement.dataset.reducedMotion==='true');
 const active=attempts.filter(a=>a.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const completed=attempts.filter(a=>a.status==='completed');
 const queue=buildReviewQueues(packs,reviews);
 const recent=[...packs].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
 const next=recent[0];
 return <motion.div className="desk-today" initial={reduce?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.2}}>
   <header className="desk-page-head"><span className="desk-kicker">{id?'RUANG BELAJAR':'STUDY DESK'}</span><h1>{id?'Hari ini':'Today'}</h1>
    <p>{active?(id?'Sesi terakhir masih tersimpan. Lanjutkan dari jawaban terakhir.':'Your last session is saved. Pick up where you left off.'):id?'Satu langkah berikutnya. Bukan semua fitur sekaligus.':'One next step, not every tool at once.'}</p>
   </header>
   <section className="desk-next" aria-labelledby="desk-next-heading">
    <div><span className="desk-kicker">{active?(id?'BELUM SELESAI':'IN PROGRESS'):(id?'MULAI DARI SINI':'START HERE')}</span>
     <h2 id="desk-next-heading">{active?active.title:next?next.title:id?'Belum ada bank soal':'No question banks yet'}</h2>
     <p>{active?`${active.draft?Object.keys(active.draft).length:active.answers.length} / ${active.items.length} ${id?'soal dijawab':'questions answered'} · ${active.options.mode.replace('_',' ')}`:next?`${next.questions.length} ${id?'soal · siap dipelajari':'questions · ready to practice'}`:id?'Buat bank pertama atau impor JSON melalui Library.':'Create your first bank or import JSON through Library.'}</p>
    </div>
    {active?<button className="desk-primary" disabled={busy} onClick={()=>onResume(active)}><Play size={18}/>{id?'Lanjutkan sesi':'Resume session'}<ArrowRight size={17}/></button>
      :next?<button className="desk-primary" disabled={busy} onClick={()=>onStart(next)}><Play size={18}/>{id?'Mulai latihan':'Start practice'}<ArrowRight size={17}/></button>
      :<button className="desk-primary" onClick={onCreate}><Plus size={18}/>{id?'Buat bank pertama':'Create first bank'}</button>}
   </section>
   <div className="desk-today-lower">
    <section className="desk-queue" aria-labelledby="desk-queue-heading"><div className="desk-section-heading"><div><span className="desk-kicker">{id?'PENGULANGAN':'RECALL'}</span><h2 id="desk-queue-heading">{id?'Review terjadwal':'Scheduled review'}</h2></div><button className="desk-link" onClick={onReview}>{id?'Buka Review':'Open Review'} <ChevronRight size={16}/></button></div>
      <div className="desk-queue-count"><Brain size={23}/><div><strong>{queue.due.length} {id?'jatuh tempo':'due'}</strong><p>{queue.newCards.length} {id?'kartu baru, belum dijadwalkan':'new cards, not yet scheduled'}</p></div></div>
    </section>
    <section className="desk-recent" aria-labelledby="desk-recent-heading"><div className="desk-section-heading"><div><span className="desk-kicker">{id?'MILIKMU':'YOUR CONTENT'}</span><h2 id="desk-recent-heading">{id?'Bank terbaru':'Recent banks'}</h2></div><button className="desk-link" onClick={onLibrary}>{id?'Semua bank':'All banks'} <ChevronRight size={16}/></button></div>
      {recent.length?recent.map(p=><button className="desk-bank-row" key={p.id} onClick={()=>onOpenPack(p)}><BookOpen size={18}/><span><strong>{p.title}</strong><small>{p.questions.length} {id?'soal':'questions'}</small></span><ChevronRight size={17}/></button>):<p className="desk-empty-note">{id?'Bank yang dibuat atau diimpor muncul di sini.':'Created and imported banks will appear here.'}</p>}
    </section>
   </div>
   <DashboardMascot count={completed.length} locale={locale}/>
   {completed.length>0&&<section className="desk-last-score" aria-label={id?'Hasil terbaru':'Latest result'}><Layers size={16}/><span>{id?'Hasil terakhir':'Latest result'}: {completed.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0].title}</span><strong>{progressFor(completed[0]).score}%</strong></section>}
 </motion.div>;
}
