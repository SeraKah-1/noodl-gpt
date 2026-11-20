import React, {useCallback,useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useMotionValue,useReducedMotion,useTransform} from 'framer-motion';
import {RotateCcw,X} from 'lucide-react';
import {Assistive} from './Assistive';
import {StudyText as Text} from './StudyText';
import {Autopilot} from './Autopilot';
import {correctAnswerText} from '../shared/engine';
import {resolveFlashSwipe} from '../shared/flashcardGesture';
import type {Attempt,Pack,Question,ReviewEvent} from '../shared/types';
import './FlashcardDeck.css';

type DeckProps={
 pack:Pack;
 questions:Question[];
 onReview:(event:ReviewEvent)=>void|Promise<void>;
 onClose:()=>void;
 onAuto:()=>void;
 onOpenAttempt:(attempt:Attempt)=>void;
};

const shortcutRatings:Record<string,ReviewEvent['rating']>={
 '1':0,ArrowLeft:0,'2':1,ArrowDown:1,'3':2,ArrowUp:2,'4':3,ArrowRight:3
};
const labels=['Lupa','Sulit','Bagus','Mudah'] as const;
const hints=['Ulang sebentar lagi','Sulit, interval pendek','Ingat dengan baik','Mudah, interval panjang'] as const;
const arrows=['←','↓','↑','→'] as const;

function ignoreShortcut(event:KeyboardEvent){
 if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return true;
 const target=event.target instanceof Element?event.target:null;
 if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),dialog,[role=dialog]'))return true;
 if(event.repeat)return true;
 return !!target?.closest('button,a[href],summary') && (event.key==='Enter'||event.key===' ');
}

/** The storage client acknowledges local persistence before asynchronous cloud sync. */
export function FlashcardDeck({pack,questions,onReview,onClose,onAuto,onOpenAttempt}:DeckProps){
 const [index,setIndex]=useState(0);
 const [flipped,setFlipped]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [direction,setDirection]=useState(0);
 const [help,setHelp]=useState(false);
 const reduced=!!useReducedMotion() || (typeof document!=='undefined'&&document.documentElement.dataset.reducedMotion==='true');
 const saving=useRef(false);
 const skippedClick=useRef(false);
 const failedEvent=useRef<ReviewEvent|null>(null);
 const flipControl=useRef<HTMLButtonElement>(null);
 const x=useMotionValue(0);
 const rotation=useTransform(x,[-160,0,160],[-7,0,7]);
 const leftCue=useTransform(x,[-120,-28,0],[1,.12,0]);
 const rightCue=useTransform(x,[0,28,120],[0,.12,1]);
 const q=questions[index];

 useEffect(()=>{flipControl.current?.focus({preventScroll:true});},[index]);

 const rate=useCallback(async(rating:ReviewEvent['rating'])=>{
  if(!q||!flipped||saving.current|| (failedEvent.current&&failedEvent.current.rating!==rating))return;
  const event=failedEvent.current??{
   id:crypto.randomUUID(),cardId:pack.id+':'+q.id,packId:pack.id,
   questionId:q.id,question:structuredClone(q),rating,reviewedAt:new Date().toISOString()
  };
  failedEvent.current=event;
  saving.current=true;
  setBusy(true);
  setError('');
  setStatus('Menyimpan rating di perangkat…');
  try{
   await onReview(event);
   failedEvent.current=null;
   setDirection(rating===0?-1:rating===3?1:0);
   setIndex(i=>i+1);
   setFlipped(false);
   x.set(0);
   setStatus('Rating tersimpan di perangkat. Sinkronisasi server dapat menyusul.');
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Rating belum tersimpan. Coba lagi.');
   setStatus('Penyimpanan gagal; kartu belum berubah.');
  }finally{
   saving.current=false;
   setBusy(false);
  }
 },[q,flipped,onReview,pack.id,x]);

 const flip=useCallback(()=>{
  if(saving.current||failedEvent.current)return;
  setFlipped(v=>!v);
  setError('');
  setStatus('');
 },[]);

 useEffect(()=>{
  const listener=(event:KeyboardEvent)=>{
   if(!q||saving.current||ignoreShortcut(event))return;
   if(event.key==='Escape'){event.preventDefault();onClose();return;}
   if(failedEvent.current)return;
   if(event.key===' '||event.key==='Enter'){event.preventDefault();flip();return;}
   const rating=shortcutRatings[event.key];
   if(flipped&&rating!==undefined){event.preventDefault();void rate(rating);}
   if(event.key==='?'){setHelp(v=>!v);}
  };
  window.addEventListener('keydown',listener);
  return ()=>window.removeEventListener('keydown',listener);
 },[q,flipped,rate,onClose,flip]);

 const variants={
  enter:{opacity:reduced?1:0,y:reduced?0:15,scale:reduced?1:.985},
  center:{opacity:1,y:0,x:0,scale:1,transition:reduced?{duration:0}:{type:'spring' as const,stiffness:370,damping:32}},
  leave:(dir:number)=>({opacity:reduced?1:0,x:reduced?0:dir*280,y:dir===0&&!reduced?-18:0,scale:reduced?1:.96,
   transition:{duration:reduced?0:.21}})
 };

 return <section className="study-player practice-screen flash-screen flash-deck" aria-label="Flashcards">
  <div className="practice-head">
   <header className="study-top">
    <button type="button" className="study-icon" disabled={busy} onClick={onClose} aria-label="Simpan dan keluar"><X size={20}/></button>
    <div><small>FLASHCARDS</small><h2>{pack.title}</h2></div>
    <div className="flash-tools"><button type="button" className="study-secondary" disabled={busy} onClick={onAuto}>Autopilot</button><Assistive flashcards/></div>
    <span className="flash-count">{Math.min(index+1,questions.length)} / {questions.length}</span>
   </header>
   <div className="study-progress" aria-label={String(index)+' dari '+String(questions.length)+' kartu dinilai'}>
    <span style={{width:(questions.length?index/questions.length*100:100)+'%'}}/>
   </div>
  </div>
  {!q?<div className="study-surface study-done">
    <span className="study-mascot">( ✧ ▽ ✧ )</span>
    <h2>Sesi kartu selesai.</h2>
    <p>{questions.length} kartu dinilai dan dicatat pada perangkat ini. Sinkronisasi ke server dapat berlangsung terpisah.</p>
    <button className="study-primary" onClick={onClose}>Kembali ke bank</button>
   </div>:<>
    <main className="flash-stage flash-deck-stage">
     {index+1<questions.length&&<div className="flash-deck-next" aria-hidden="true"/>}
     <AnimatePresence initial={false} mode="wait" custom={direction}>
      <motion.div key={q.id} className={'flash-deck-motion'+(flipped?' revealed':'')}
       custom={direction} variants={variants} initial="enter" animate="center" exit="leave"
       drag={flipped&&!busy&&!error&&!reduced?'x':false} dragMomentum={false} dragSnapToOrigin
       dragConstraints={{left:-180,right:180}} dragElastic={.18}
       style={{x,rotate:reduced?0:rotation,touchAction:'pan-y'}}
       onPointerDown={()=>{skippedClick.current=false;}}
       onDragStart={()=>{skippedClick.current=true;}}
       onDragEnd={(_event,info)=>{if(!flipped||saving.current||failedEvent.current)return;
        const rating=resolveFlashSwipe(info.offset.x,info.offset.y,info.velocity.x);
        if(rating!==null)void rate(rating);
       }}>
       <article className={'study-flashcard flash-deck-card'+(flipped?' flipped':'')}
        onClick={event=>{
         if(skippedClick.current){skippedClick.current=false;return;}
         if(event.target instanceof Element&&event.target.closest('button,a[href],input,textarea,select'))return;
         flip();
        }}>
        <div className="flash-deck-head">
         <small>{flipped?'JAWABAN':'PERTANYAAN'} · {q.conceptName||q.difficulty}</small>
         {flipped&&<small>Geser hanya setelah jawaban terbuka</small>}
        </div>
        <div className="flash-copy" key={q.id+String(flipped)}>
         <Text>{flipped?correctAnswerText(q):q.text}</Text>
         {flipped&&<div className="study-flash-explanation"><Text>{q.explanation}</Text></div>}
        </div>
        <button ref={flipControl} type="button" className="flash-deck-flip" disabled={busy||!!error}
         onClick={flip} aria-label={flipped?'Kembali ke pertanyaan':'Tampilkan jawaban'}>
         <RotateCcw size={15}/>{flipped?'Lihat pertanyaan':'Balik kartu · Space / Enter'}
        </button>
        {flipped&&!reduced&&<div className="flash-deck-direction" aria-hidden="true">
         <motion.span style={{opacity:leftCue}}>← Lupa</motion.span>
         <motion.span style={{opacity:rightCue}}>Mudah →</motion.span>
        </div>}
       </article>
      </motion.div>
     </AnimatePresence>
    </main>
    <footer className="flash-controls flash-deck-controls">
     {flipped?<div className="study-ratings" role="group" aria-label="Nilai ingatan">
      {labels.map((label,i)=><button key={label} type="button" disabled={busy||!!error}
       onClick={()=>void rate(i as ReviewEvent['rating'])}
       aria-label={label+' · tombol '+String(i+1)}>
       <b>{arrows[i]} · {i+1}</b>{label}<small>{hints[i]}</small>
      </button>)}
     </div>:<p className="study-center-note">Ingat jawabannya lebih dulu. Membalik kartu tidak memberi rating.</p>}
     <div className="flash-deck-meta">
      <button className="flash-deck-help" type="button" onClick={()=>setHelp(v=>!v)} aria-expanded={help}>? Pintasan keyboard</button>
      {help&&<p>Space / Enter: balik · 1/←: Lupa · 2/↓: Sulit · 3/↑: Bagus · 4/→: Mudah · Esc: keluar.</p>}
      {status&&<p role="status" className="flash-deck-status">{status}</p>}
      {error&&<div className="study-error" role="alert">
       {error}
       <button type="button" className="study-secondary" disabled={busy}
        onClick={()=>{if(failedEvent.current)void rate(failedEvent.current.rating);}}>Coba simpan rating yang sama</button>
      </div>}
     </div>
    </footer>
   </>}
 </section>;
}
