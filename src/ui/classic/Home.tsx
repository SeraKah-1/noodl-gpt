import {useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {ArrowRight,BookOpen,Brain,Layers,Play,Plus,ChevronRight,Target} from 'lucide-react';
import {buildReviewQueues} from '../reviewQueue';
import {studyNextStep} from '../../shared/nextStep';
import type {Attempt,Pack,Question,ReviewEvent,StudyOptions as Options} from '../../shared/types';
import {progressFor} from '../../shared/engine';
import type {Locale} from './Navigation';

type Props={
 onProbe:(pack:Pack)=>void;onDebugger:()=>void;locale:Locale;packs:Pack[];attempts:Attempt[];reviews:ReviewEvent[];
 options:Options;busy:boolean;onOptions:(value:Options)=>void;onStart:(pack:Pack)=>void;onFocus:(pack:Pack,questions:Question[])=>void;onFlash:(pack:Pack)=>void;
 onResume:(attempt:Attempt)=>void;onLibrary:()=>void;onReview:()=>void;onImport:(file:File)=>Promise<void>;
 onBrainDump:()=>void;onCreate:()=>void;onChat:(message:string)=>void;onOpenPack:(pack:Pack)=>void;
};
export function DashboardMascot({count,locale}:{count:number;locale:Locale}){
 const [line,setLine]=useState(0),id=locale==='id';
 const faces=['( . _ . )','( ◕ ‿ ◕ )','(≧▽≦)'];
 const milestone=count>=30?2:count>=5?1:0;
 const messages=id
  ?['Pilih satu tugas. Noodl akan menyimpan progresnya.','Soal yang salah tetap tersimpan untuk dicoba kembali.','Noodl siap. Mulai dari langkah yang paling berguna.']
  :['Choose one task. Noodl will keep your progress.','Missed questions stay available for another attempt.','Noodl is ready. Start with the most useful next step.'];
 return <section className="desk-companion" aria-label={id?'Teman belajar Noodl':'Noodl companion'}>
  <button className="desk-face" onClick={()=>setLine(n=>(n+1)%messages.length)} aria-label={id?'Ganti pesan maskot':'Change companion message'}>{faces[milestone]}</button>
  <div><p aria-live="polite">{messages[line]}</p><small>{count} {id?'sesi selesai':'completed sessions'}</small></div>
 </section>;
}
export function Home(props:Props){
 const {packs,attempts,reviews,locale,busy,onResume,onStart,onFocus,onLibrary,onReview,onOpenPack,onCreate}=props;
 const id=locale==='id',reduced=useReducedMotion() || (typeof document!=='undefined'&&document.documentElement.dataset.reducedMotion==='true');
 const completed=attempts.filter(a=>a.status==='completed');
 const step=studyNextStep(packs,attempts,reviews);
 const queue=buildReviewQueues(packs,reviews);
 const recent=[...packs].filter(p=>!p.deletedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
 const latest=completed.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const label=step.kind==='resume'?(id?'SESI BELUM SELESAI':'SESSION IN PROGRESS'):
   step.kind==='review'?(id?'SUDAH JATUH TEMPO':'DUE FOR REVIEW'):
   step.kind==='focus'?(id?'LATIHAN FOKUS':'FOCUSED PRACTICE'):
   step.kind==='start'?(id?'MULAI DARI SINI':'START HERE'):(id?'BANK PERTAMA':'FIRST BANK');
 const action=step.kind==='resume'?()=>onResume(step.attempt):step.kind==='review'?onReview:
  step.kind==='focus'?()=>onFocus(step.pack,step.questions):step.kind==='start'?()=>onStart(step.pack):onCreate;
 const actionLabel=step.kind==='resume'?(id?'Lanjutkan sesi':'Resume'):
  step.kind==='review'?(id?'Mulai review':'Start review'):
  step.kind==='focus'?(id?'Ulangi soal salah':'Retry missed questions'):
  step.kind==='start'?(id?'Mulai latihan':'Start practice'):(id?'Buat bank pertama':'Create first bank');
 const detail=id?step.detail:step.kind==='resume'?step.detail.replace('dari','of').replace('soal terisi','questions answered · saved'):
  step.kind==='review'?`${step.count} review cards are due. New cards are not overdue.`:
  step.kind==='focus'?`${step.misses} of ${step.observations} answers were missed. Try the missed questions again.`:
  step.kind==='start'?`${step.pack.questions.length} questions · recent bank`:'Ask ChatGPT to create a bank via MCP, or create questions manually.';
 return <motion.div className="desk-today" initial={reduced?false:{opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{duration:0.24}}>
  <header className="desk-page-head"><span className="desk-kicker">{id?'RUANG BELAJAR':'STUDY DESK'}</span><h1>{id?'Hari ini':'Today'}</h1>
   <p>{id?'Satu langkah paling relevan dari progres belajarmu.':'One relevant next step, grounded in your study history.'}</p>
  </header>
  <AnimatePresence mode="wait" initial={false}>
  <motion.section key={step.kind+(step.kind==='resume'?step.attempt.id:step.kind==='focus'?step.pack.id:step.kind==='start'?step.pack.id:'')} className="desk-next" aria-labelledby="desk-next-heading"
   initial={reduced?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={reduced?undefined:{opacity:0,y:-8}} transition={{duration:0.2}}>
   <div><span className="desk-kicker">{label}</span><h2 id="desk-next-heading">{step.title}</h2><p>{detail}</p>
    <small className="v3-reason">{id?'Dipilih dari data sesi dan jadwal review; bukan skor buatan AI.':'Based on saved sessions and review schedules, not an AI-generated mastery score.'}</small></div>
   <motion.button className="desk-primary" whileTap={reduced?undefined:{scale:.98}} disabled={busy} onClick={action}>
    {step.kind==='focus'?<Target size={18}/>:step.kind==='empty'?<Plus size={18}/>:<Play size={18}/>}
    {actionLabel}<ArrowRight size={17}/>
   </motion.button>
  </motion.section>
  </AnimatePresence>
  <div className="desk-today-lower">
   <section className="desk-queue" aria-labelledby="desk-queue-heading">
    <div className="desk-section-heading"><div><span className="desk-kicker">{id?'PENGULANGAN':'RECALL'}</span><h2 id="desk-queue-heading">{id?'Review terjadwal':'Scheduled review'}</h2></div><button className="desk-link" onClick={onReview}>{id?'Buka Review':'Open Review'} <ChevronRight size={16}/></button></div>
    <div className="desk-queue-count"><Brain size={23}/><div><strong>{queue.due.length} {id?'jatuh tempo':'due'}</strong><p>{queue.newCards.length} {id?'kartu baru · belum jatuh tempo':'new cards · not overdue'}</p></div></div>
   </section>
   <section className="desk-recent" aria-labelledby="desk-recent-heading">
    <div className="desk-section-heading"><div><span className="desk-kicker">{id?'MILIKMU':'YOUR CONTENT'}</span><h2 id="desk-recent-heading">{id?'Bank terbaru':'Recent banks'}</h2></div><button className="desk-link" onClick={onLibrary}>{id?'Semua bank':'All banks'} <ChevronRight size={16}/></button></div>
    {recent.length?recent.map(p=><button className="desk-bank-row" key={p.id} onClick={()=>onOpenPack(p)}><BookOpen size={18}/><span><strong>{p.title}</strong><small>{p.questions.length} {id?'soal':'questions'}</small></span><ChevronRight size={17}/></button>):<p className="desk-empty-note">{id?'Bank yang dibuat lewat ChatGPT atau disimpan manual muncul di sini.':'Banks saved through ChatGPT or created manually appear here.'}</p>}
   </section>
  </div>
  <DashboardMascot count={completed.length} locale={locale}/>
  {latest&&<section className="desk-last-score" aria-label={id?'Hasil terbaru':'Latest result'}><Layers size={16}/><span>{id?'Hasil terakhir':'Latest result'}: {latest.title}</span><strong>{progressFor(latest).score}%</strong></section>}
 </motion.div>;
}
