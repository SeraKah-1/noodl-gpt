import {GenerationOptions} from './StudyPlanning';
import {LearningTools} from './Tools';
import {sendChatRequest,isEmbedded} from '../client/bridge';
import type {ToolTab} from './classic/Navigation';
import React, {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronRight,Clock,Heart,Lightbulb,RotateCcw,Volume2,VolumeX,X} from 'lucide-react';
import confetti from 'canvas-confetti';
import {motion,useReducedMotion} from 'framer-motion';
import {StudyText as Text} from './StudyText';
import {Autopilot} from './Autopilot';
import {client} from '../client';
import {diagnosticQuestion,diagnosticAttempt} from '../shared/practice';
import type {Attempt,Pack,Question,ReviewEvent} from '../shared/types';
import {advanceAttempt,answerAttempt,correctAnswerText,itemsToRetry,progressFor} from '../shared/engine';
import './Study.css';
import {Assistive} from './Assistive';
function tone(correct:boolean){try{const c=new AudioContext();const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=correct?660:200;g.gain.setValueAtTime(.06,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18);o.start();o.stop(c.currentTime+.18);o.onended=()=>void c.close();}catch{/* Audio is optional. */}}
function ignoreStudyKey(event:KeyboardEvent){
 if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return true;
 const target=event.target instanceof Element?event.target:null;
 if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),dialog,[role=dialog]'))return true;
 if(event.repeat){if(['Enter',' '].includes(event.key))event.preventDefault();return true;}
 return !!target?.closest('button,a[href],summary')&&['Enter',' '].includes(event.key);
}
const flashRatings:Record<string,ReviewEvent['rating']>={
 '1':0,ArrowLeft:0,'2':1,ArrowDown:1,'3':2,ArrowUp:2,'4':3,ArrowRight:3
};
export function StudyPlayer({attempt,onChange,onComplete,onExit}:{attempt:Attempt;onChange:(a:Attempt)=>void|Promise<void>;onComplete:(a:Attempt)=>void;onExit:()=>void}){
 const reduced=useReducedMotion() || (typeof document!=='undefined'&&document.documentElement.dataset.reducedMotion==='true');
 const [current,setCurrent]=useState(attempt),[input,setInput]=useState(''),[hint,setHint]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[sound,setSound]=useState(false),[failedSave,setFailedSave]=useState<Attempt|null>(null);
 const live=useRef(current);live.current=current;
 useEffect(()=>{if(attempt.id!==live.current.id||attempt.revision>live.current.revision){setCurrent(attempt);setInput('');setHint(false);}},[attempt]);
 const [peek,setPeek]=useState<number|null>(null);
 const index=Math.min(peek??current.currentIndex,current.currentIndex);
 const browsing=index<current.currentIndex;
 const item=current.items[index],q=item?.question,answer=current.answers.find(a=>a.occurrenceId===item?.id);
 const liveAnswered=current.answers.some(a=>a.occurrenceId===current.items[current.currentIndex]?.id);
 const saving=useRef(false);
 function previous(){if(!busy&&index>0){setPeek(index-1);setHint(false);}}
 const commit=useCallback(async(next:Attempt)=>{if(saving.current)return;saving.current=true;setBusy(true);setError('');setFailedSave(null);try{await onChange(next);setCurrent(next);if(next.status==='completed')onComplete(next);}catch(e){setFailedSave(next);setError(e instanceof Error?e.message:'Gagal menyimpan. Coba lagi.');}finally{saving.current=false;setBusy(false);}},[onChange,onComplete]);
 const submit=useCallback(async(value:string|boolean)=>{if(busy||!q||answer)return;const next=answerAttempt(current,value);await commit(next);if(sound)tone(next.answers.at(-1)?.isCorrect??false);},[busy,q,answer,current,commit,sound]);
 const next=useCallback(()=>{if(busy)return;if(browsing){setPeek(index+1===current.currentIndex?null:index+1);return;}if(!answer)return;setPeek(null);const a=advanceAttempt(current);setInput('');setHint(false);void commit(a);},[answer,busy,current,commit,browsing,index]);
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),200);return()=>window.clearInterval(t);},[]);
 useEffect(()=>{
  if(current.options.mode==='TIME_RUSH'&&current.deadline!==null&&now>=current.deadline&&!liveAnswered&&!busy&&!failedSave){
   setPeek(null);
   void commit(answerAttempt(current,'',now));
  }
 },[current,now,liveAnswered,busy,failedSave,commit]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(ignoreStudyKey(event)||busy)return;
   if(['ArrowLeft',' '].includes(event.key)&&index>0){event.preventDefault();previous();return;}
   if(['ArrowRight','Enter'].includes(event.key)&&answer){event.preventDefault();next();return;}
   if(answer||browsing||!/^[1-9]$/.test(event.key))return;
   const value=q?.type==='MULTIPLE_CHOICE'?q.options?.[Number(event.key)-1]?.id:
    q?.type==='TRUE_FALSE'&&Number(event.key)<=2?event.key==='1':undefined;
   if(value!==undefined){event.preventDefault();void submit(value);}
  };
  window.addEventListener('keydown',key);
  return ()=>window.removeEventListener('keydown',key);
 });
 if(!q)return <div className="study-surface"><p>Soal tidak tersedia.</p><button onClick={onExit}>Kembali</button></div>;
 const remaining=current.deadline===null?null:Math.max(0,Math.ceil((current.deadline-now)/1000));
 return <section className="study-player practice-screen quiz-screen" aria-label="Latihan soal"><div className="practice-head"><header className="study-top"><button className="study-icon" aria-label="Simpan dan keluar" onClick={onExit}><ArrowLeft size={20}/></button><div><small>{current.options.mode.replace('_',' ')}</small><h2>{current.title}</h2></div><Assistive/><button className="study-icon" aria-label={sound?'Matikan suara':'Aktifkan suara'} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={20}/>:<VolumeX size={20}/>}</button>{current.options.mode==='SURVIVAL'&&<span className="study-lives" aria-label={`${current.lives} nyawa`}>{[0,1,2].map(i=><Heart key={i} size={19} fill={i<current.lives?'currentColor':'none'} opacity={i<current.lives?1:.25}/>)}</span>}{remaining!==null&&<span className={`study-timer ${remaining<=5?'urgent':''}`}><Clock size={17}/>{remaining}s</span>}</header>
 <div className="study-progress"><span style={{width:`${current.answers.length/current.items.length*100}%`}}/></div><div className="study-counter"><span>{browsing?'Meninjau soal':'Soal'} {index+1} dari {current.items.length}</span><span>{current.streak>1?`🔥 ${current.streak} beruntun`:''}</span></div>
 </div><main className="practice-scroll" key={item.id}><div className="practice-column"><div className="study-mascot" aria-hidden="true">{answer?(answer.isCorrect?'( ✧ ▽ ✧ )':'( ◡ _ ◡ )'):'( ◕ ‿ ◕ )'}</div>
 <article className={'study-surface question-card type-'+q.type}><div className="study-tags"><span>{q.type==='MULTIPLE_CHOICE'?'Pilihan ganda':q.type==='TRUE_FALSE'?'Benar / Salah':'Isian'}</span><span>{({Easy:'Mudah',Medium:'Sedang',Hard:'Sulit'})[q.difficulty]}</span>{q.conceptName&&<span>{q.conceptName}</span>}</div><div className="study-question"><Text>{q.text}</Text></div>
 {q.type==='MULTIPLE_CHOICE'&&<div className="study-options">{q.options?.map((o,i)=><button key={o.id} disabled={!!answer||busy} onClick={()=>void submit(o.id)} className={`study-option ${answer?(o.id===q.correctOptionId?'correct':answer.value===o.id?'incorrect':''):''}`}><b>{String.fromCharCode(65+i)}</b><span><Text>{o.text}</Text></span>{answer&&o.id===q.correctOptionId&&<Check size={18}/>}</button>)}</div>}
 {q.type==='TRUE_FALSE'&&<div className="study-binary">{[true,false].map((v,i)=><button key={String(v)} disabled={!!answer||busy} onClick={()=>void submit(v)} className={`study-option ${answer?(v===q.correctBoolean?'correct':answer.value===v?'incorrect':''):''}`}><b>{i+1}</b>{v?'Benar':'Salah'}</button>)}</div>}
 {q.type==='FILL_BLANK'&&<form className="study-fill" onSubmit={e=>{e.preventDefault();if(!browsing&&input.trim())void submit(input);}}><label htmlFor="study-answer">Jawaban lo</label><div><input id="study-answer" value={answer?String(answer.value):input} onChange={e=>setInput(e.target.value)} disabled={!!answer||busy} placeholder="Tulis jawaban di sini…" autoComplete="off"/><button disabled={!!answer||busy||!input.trim()} type="submit">Periksa <Check size={17}/></button></div></form>}
 {!answer&&q.hint&&<><button className="study-link" onClick={()=>setHint(!hint)}><Lightbulb size={17}/>{hint?'Tutup petunjuk':'Butuh petunjuk?'}</button>{hint&&<aside className="study-hint"><Text>{q.hint}</Text></aside>}</>}
 {answer&&<motion.div initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.16}} className={`study-feedback ${answer.isCorrect?'correct':'incorrect'}`} role="status"><strong>{answer.isCorrect?'Tepat!':'Belum tepat — kita bahas.'}</strong>{!answer.isCorrect&&<p>Jawaban: <b>{correctAnswerText(q)}</b></p>}<Text>{q.explanation}</Text>{q.keyPoint&&<div className="study-keypoint"><Lightbulb size={17}/><Text>{q.keyPoint}</Text></div>}</motion.div>}
 {error&&<div role="alert" className="study-error">{error}{failedSave&&<button className="study-secondary" disabled={busy} onClick={()=>void commit(failedSave)}>Coba simpan lagi</button>}</div>}
 <footer className="study-bottom"><button className="study-secondary" disabled={busy||index===0} onClick={previous}>← Sebelumnya</button><span>{busy?'Menyimpan…':answer?'→ atau Enter untuk lanjut':q.type==='FILL_BLANK'?'Enter untuk periksa':'Gunakan angka untuk memilih'}</span>{answer&&<button className="study-primary" disabled={busy} onClick={next}>{!browsing&&(current.currentIndex===current.items.length-1||current.lives===0)?'Lihat hasil':'Lanjut'}<ArrowRight size={18}/></button>}</footer></article></div></main>
 </section>;
}
interface FlashProps {
 pack:Pack;questions?:Question[];initialAuto?:boolean;onReview:(e:ReviewEvent)=>void|Promise<void>;
 onClose:()=>void;onOpenAttempt:(a:Attempt)=>void;
}
export function Flashcards(props:FlashProps){
 const [auto,setAuto]=useState(props.initialAuto??false);
 if(auto)return <Autopilot pack={props.pack} questions={props.questions??props.pack.questions} onReview={props.onReview} onClose={props.onClose} onCheck={props.onOpenAttempt}/>;
 return <ManualFlashcards {...props} onAuto={()=>setAuto(true)}/>;
}
function ManualFlashcards({pack,questions=pack.questions,onReview,onClose,onAuto}:FlashProps&{onAuto:()=>void}){
 const [index,setIndex]=useState(0),[flipped,setFlipped]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const start=useRef<number|null>(null),skipClick=useRef(false),saving=useRef(false);
 const [offset,setOffset]=useState(0);
 const q=questions[index];
 const cardButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{cardButton.current?.focus({preventScroll:true});},[index]);

 const rate=useCallback(async(rating:0|1|2|3)=>{if(!q||!flipped||saving.current)return;saving.current=true;setBusy(true);setError('');try{await onReview({id:crypto.randomUUID(),cardId:`${pack.id}:${q.id}`,packId:pack.id,questionId:q.id,question:structuredClone(q),rating,reviewedAt:new Date().toISOString()});setIndex(i=>i+1);setFlipped(false);if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(12);}catch(e){setError(e instanceof Error?e.message:'Rating gagal disimpan. Coba lagi.');}finally{saving.current=false;setBusy(false);}},[q,flipped,pack.id,onReview]);
 useEffect(()=>{
  const listener=(event:KeyboardEvent)=>{
   if(ignoreStudyKey(event)||!q||saving.current)return;
   if(event.key==='Escape'){event.preventDefault();onClose();return;}
   if([' ','Enter'].includes(event.key)){event.preventDefault();setFlipped(f=>!f);return;}
   const rating=flashRatings[event.key];
   if(flipped&&rating!==undefined){event.preventDefault();void rate(rating);}
  };
  window.addEventListener('keydown',listener);
  return ()=>window.removeEventListener('keydown',listener);
 },[q,flipped,rate,onClose]);
 return <section className="study-player practice-screen flash-screen"><div className="practice-head"><header className="study-top"><button className="study-icon" onClick={onClose} aria-label="Kembali"><X size={20}/></button><div><small>FLASHCARDS</small><h2>{pack.title}</h2></div><div className="flash-tools"><button className="study-secondary" disabled={busy} onClick={onAuto}>Autopilot</button><Assistive flashcards/></div><span className="flash-count">{Math.min(index+1,questions.length)} / {questions.length}</span></header><div className="study-progress"><span style={{width:`${questions.length?index/questions.length*100:100}%`}}/></div></div>{!q?<div className="study-surface study-done"><span className="study-mascot">( ✧ ▽ ✧ )</span><h2>Sesi kartu selesai.</h2><p>{questions.length} kartu sudah lo review. Jadwal pengulangan diperbarui dari rating lo.</p><button className="study-primary" onClick={onClose}>Kembali ke bank</button></div>:<><main className="flash-stage"><button ref={cardButton} className={`study-flashcard ${flipped?'flipped':''}`} disabled={busy} style={{'--drag-x':offset+'px','--drag-angle':offset/28+'deg'} as React.CSSProperties}
 onClick={e=>{if((e.detail===0||!skipClick.current)&&!saving.current)setFlipped(f=>!f);skipClick.current=false;}}
 onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;skipClick.current=false;if(flipped){start.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}}}
 onPointerMove={e=>{if(e.isPrimary&&start.current!==null)setOffset(Math.max(-120,Math.min(120,e.clientX-start.current)));}}
 onPointerCancel={()=>{start.current=null;setOffset(0);}}
 onPointerUp={e=>{if(!e.isPrimary||start.current===null)return;const dx=e.clientX-start.current;start.current=null;setOffset(0);skipClick.current=Math.abs(dx)>12;if(Math.abs(dx)>=80)void rate(dx>0?3:0);}} aria-label={flipped?'Tampilkan pertanyaan':'Balik kartu untuk melihat jawaban'}><small>{flipped?'JAWABAN':'PERTANYAAN'} · {q.conceptName||q.difficulty}</small><div className="flash-copy" key={q.id+String(flipped)}><Text>{flipped?correctAnswerText(q):q.text}</Text>{flipped&&<div className="study-flash-explanation"><Text>{q.explanation}</Text></div>}</div><span className="study-flip-cue"><RotateCcw size={16}/>{flipped?(Math.abs(offset)>12?(offset>0?'→ Mudah':'← Lupa'):'Geser kiri untuk Lupa · kanan untuk Mudah'):'Klik, Spasi, atau Enter untuk balik'}</span></button></main><footer className="flash-controls">{flipped?<div className="study-ratings">{(['Lupa','Sulit','Bagus','Mudah'] as const).map((label,i)=><button key={label} disabled={busy} onClick={()=>void rate(i as 0|1|2|3)}><b>{['←','↓','↑','→'][i]} · {i+1}</b>{label}<small>{['1 menit','10 menit / ulang','Jadwal normal','Interval lebih jauh'][i]}</small></button>)}</div>:<p className="study-center-note">Pikirkan jawabannya dulu. Rating muncul setelah kartu dibalik.</p>}{error&&<p className="study-error" role="alert">{error}</p>}</footer></>}</section>;
}
export function Results({attempt,packs,attempts,guest,onReview,onRetry,onOpenAttempt,onClose}:{onOpenAttempt:(a:Attempt)=>void;attempt:Attempt;packs:Pack[];attempts:Attempt[];guest:boolean;onReview:(e:ReviewEvent)=>Promise<void>;onRetry:(wrongOnly:boolean)=>void;onClose:()=>void}){
 const [tool,setTool]=useState<ToolTab|null>(null);
 const [cards,setCards]=useState<{pack:Pack;questions:Question[]}|null>(null);
 const [message,setMessage]=useState(''),[sending,setSending]=useState(false),[count,setCount]=useState(5);
 const pack=packs.find(p=>p.id===attempt.packId);
 useEffect(()=>{
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setTool(null);setCards(null);}};
  window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close);
 },[]);
 async function ask(prompt:string,context:unknown){
  if(sending)return;
  setSending(true);setMessage('');
  const scope=guest?'Gunakan konteks sesi guest yang diberikan. Jika membuat soal, kembalikan bank JSON Noodl (title, questions; setiap soal memiliki id, type, text, difficulty, explanation dan kunci sesuai tipenya) untuk diimpor melalui File.':
   'Cek sesi melalui get_attempt. Gunakan get_question atau get_pack untuk melihat isi bank terkini. Jika menambah soal ke bank yang masih ada, gunakan append_questions dengan revisi terbaru.';
  try{
   await sendChatRequest(prompt+' '+scope,{attemptId:attempt.id,packId:attempt.packId,title:attempt.title,context});
   setMessage(isEmbedded()?'Permintaan dikirim ke ChatGPT.':'Tempel permintaan yang sudah disalin ke ChatGPT.');
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setSending(false);}
 }
 const p=progressFor(attempt);useEffect(()=>{if(!attempt.diagnostic&&p.score>=80)void confetti({particleCount:65,spread:65,origin:{y:.65},disableForReducedMotion:true});},[attempt.id,p.score]);
 const answers=new Map(attempt.answers.map(a=>[a.occurrenceId,a]));const wrong=itemsToRetry(attempt);
 const weakTopics=p.topics.filter(topic=>topic.correct<topic.total);
 const existingCheck=attempts.find(a=>a.diagnostic?.attemptId===attempt.id);
 const candidate=React.useMemo(()=>existingCheck?undefined:diagnosticQuestion(attempt,packs,attempts),[attempt,packs,attempts,existingCheck]);
 const launching=useRef(false);
 async function checkConcept(){
  if(launching.current)return;
  if(existingCheck){onOpenAttempt(existingCheck);return;}
  if(!candidate)return;
  launching.current=true;setSending(true);
  try{onOpenAttempt(await client.saveAttempt(await diagnosticAttempt(attempt,candidate)));}
  catch(e){setMessage(String(e));}finally{launching.current=false;setSending(false);}
 }
 if(cards)return <Flashcards onOpenAttempt={onOpenAttempt} pack={cards.pack} questions={cards.questions} onReview={onReview} onClose={()=>setCards(null)}/>;
 if(tool&&pack)return <LearningTools pack={pack} attempts={attempts} initialTab={tool} onClose={()=>setTool(null)}/>;

 return <section className="study-player results-screen"><header className="study-top"><button className="study-icon" aria-label="Kembali" onClick={onClose}><ArrowLeft size={20}/></button><div><small>HASIL LATIHAN</small><h2>{attempt.title}</h2></div></header><div className="study-surface">{attempt.diagnostic?<div><h2>Cek konsep · {attempt.items[0].question.conceptName}</h2><p>{attempt.answers.length===1?`${attempt.answers[0].isCorrect?1:0} dari 2 benar. Jawaban awal salah, jawaban susulan ${attempt.answers[0].isCorrect?'benar':'salah'}.`:'Soal susulan belum dijawab.'}</p></div>:<div className="study-result-hero"><div className="study-score" style={{background:`conic-gradient(var(--study-accent) ${p.score}%,var(--study-border) 0)`}}><div><b>{p.score}<small>%</small></b><span>akurasi</span></div></div><div><span className="study-mascot">{p.score>=80?'( ✧ ▽ ✧ )':'( ◕ ‿ ◕ )'}</span><h2>{p.score>=80?'Kerja bagus.':'Sekarang tahu bagian yang perlu diulang.'}</h2><p>{p.correct} benar dari {p.total} soal · {attempt.answers.length} dijawab</p></div></div>}<div className="study-result-actions">{wrong.length>0?<button className="study-primary" onClick={()=>onRetry(true)}>Ulangi {wrong.length} soal belum benar</button>:<button className="study-primary" onClick={onClose}>Selesai</button>}<button className="study-secondary" onClick={()=>onRetry(false)}><RotateCcw size={17}/>Ulangi semua</button></div>{pack&&<details className="study-plan result-tools"><summary>Alat belajar</summary><div className="study-result-actions"><button className="study-secondary" onClick={()=>setCards({pack,questions:pack.questions})}>Flashcards<ChevronRight size={17}/></button>
 {pack&&(['material','graph','visual','comic'] as const).map(tab=><button key={tab} className="study-secondary" onClick={()=>setTool(tab)}>{{material:'Materi',graph:'Peta konsep',visual:'Visual Lab',comic:'Komik'}[tab]}</button>)}</div></details>}
 {(candidate||existingCheck)&&<button className="study-secondary" disabled={sending} onClick={()=>void checkConcept()}>{existingCheck?'Buka cek konsep':'Cek konsep dengan 1 soal lain'} · {candidate?.question.conceptName??existingCheck?.items[0].question.conceptName}</button>}
 <details className="study-plan"><summary>Soal lanjutan dari hasil latihan</summary>
 <label>Jumlah soal<input type="number" min={1} max={20} value={count} onChange={e=>setCount(Math.max(1,Math.min(20,Math.trunc(Number(e.target.value)))))}/></label>
 <GenerationOptions count={count} disabled={sending} label="Buat soal lanjutan di ChatGPT" onRequest={brief=>void ask(`Buat ${count} soal lanjutan untuk topik latihan ini. Prioritaskan topik yang belum dikuasai. ${brief}`,{
  topics:weakTopics.length?weakTopics:p.topics,
  examples:(wrong.length?wrong:attempt.items).slice(0,5).map(i=>({question:i.question,sourcePackId:i.sourcePackId,answer:answers.get(i.id)?.value}))
 })}/></details>{message&&<p role="status">{message}</p>}<details className="desk-results-disclosure"><summary>Akurasi per topik</summary><div className="study-topic-list">{p.topics.map(t=><div key={t.name}><div><b>{t.name}</b><span>{t.correct}/{t.total}</span></div><div className="study-progress"><span style={{width:`${t.correct/t.total*100}%`}}/></div></div>)}</div></details></div><details className="desk-results-disclosure"><summary>Tinjau {attempt.items.length} soal dan pembahasannya</summary><div className="study-review-list">{attempt.items.map((item,i)=>{const a=answers.get(item.id);const source=packs.find(p=>p.id===item.sourcePackId);return <details key={item.id} className="study-surface"><summary><span className={`study-verdict ${a?.isCorrect?'yes':'no'}`}>{a?.isCorrect?'✓':'×'}</span><span>{i+1}. {item.question.text}</span></summary><p>Jawaban benar: <b>{correctAnswerText(item.question)}</b></p>{a&&<p>Jawaban lo: {typeof a.value==='boolean'?(a.value?'Benar':'Salah'):item.question.options?.find(o=>o.id===a.value)?.text||a.value||'Waktu habis'}</p>}<Text>{item.question.explanation}</Text>
 <div className="study-result-actions"><button className="study-secondary" disabled={sending} onClick={()=>void ask('Bahas soal ini, jawabanku, dan alasan kunci jawabannya.',{sourcePackId:item.sourcePackId,questionId:item.sourceQuestionId,question:item.question,answer:a?.value??null})}>Bahas soal ini</button>
 {source?.questions.some(q=>q.id===item.sourceQuestionId)&&<button className="study-secondary" onClick={()=>setCards({pack:source,questions:[item.question]})}>Jadikan flashcard</button>}</div></details>;})}</div></details></section>;
}
