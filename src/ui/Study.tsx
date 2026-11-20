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
import {FlashcardDeck} from './FlashcardDeck';
import {client} from '../client';
import {diagnosticQuestion,diagnosticAttempt,remediationQuestions} from '../shared/practice';
import type {Attempt,Pack,Question,ReviewEvent} from '../shared/types';
import {advanceAttempt,answerAttempt,createAttempt,correctAnswerText,itemsToRetry,progressFor} from '../shared/engine';
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
 return <FlashcardDeck {...props} questions={props.questions??props.pack.questions} onAuto={()=>setAuto(true)}/>;
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
   'Cek sesi melalui get_attempt. Gunakan get_question atau get_pack untuk melihat isi bank terkini. Siapkan soal berbeda lewat prepare_pack_change dengan referensi yang tersedia. Minta persetujuan sebelum commit_pack_change, lalu verifikasi get_operation_receipt. Request ChatGPT bukan bukti penyimpanan.';
  try{
   await sendChatRequest(prompt+' '+scope,{attemptId:attempt.id,packId:attempt.packId,title:attempt.title,context});
   setMessage(isEmbedded()?'Permintaan dikirim ke ChatGPT.':'Tempel permintaan yang sudah disalin ke ChatGPT.');
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setSending(false);}
 }
 const p=progressFor(attempt);useEffect(()=>{if(!attempt.diagnostic&&p.score>=80)void confetti({particleCount:65,spread:65,origin:{y:.65},disableForReducedMotion:true});},[attempt.id,p.score]);
 const answers=new Map(attempt.answers.map(a=>[a.occurrenceId,a]));const wrong=itemsToRetry(attempt);
 const weakTopics=p.topics.filter(topic=>topic.correct<topic.total);
 const observedTopics=(()=>{
  const byName=new Map<string,{name:string;wrong:number;answered:number}>();
  for(const item of attempt.items){
   const response=answers.get(item.id);if(!response)continue;
   const name=item.question.conceptName?.trim()||'Tanpa label konsep';
   const entry=byName.get(name)??{name,wrong:0,answered:0};
   entry.answered++;
   if(!response.isCorrect)entry.wrong++;
   byName.set(name,entry);
  }
  return [...byName.values()].filter(t=>t.wrong>0).sort((a,b)=>b.wrong-a.wrong).slice(0,4);
 })();
 const existingCheck=attempts.find(a=>a.diagnostic?.attemptId===attempt.id);
 const candidate=React.useMemo(()=>existingCheck?undefined:diagnosticQuestion(attempt,packs,attempts),[attempt,packs,attempts,existingCheck]);
 const remediation=React.useMemo(()=>remediationQuestions(attempt,packs,attempts),[attempt,packs,attempts]);
 const repairId='repair-'+attempt.id;
 const savedRepair=attempts.find(a=>a.id===repairId);
 async function openRepair(){
  if(sending)return;
  if(savedRepair){onOpenAttempt(savedRepair);return;}
  if(!remediation.length)return;
  setSending(true);setMessage('');
  try{
   const pack=remediation[0].pack;
   const next=createAttempt(pack,{mode:'BATCH',batchSize:remediation.length,shuffle:true,retention:false,mixed:false},
    attempt.ownerId,remediation.map(x=>({question:x.question,sourcePackId:x.pack.id})));
   next.id=repairId;
   next.title='Latihan perbaikan · '+attempt.title;
   onOpenAttempt(await client.saveAttempt(next));
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setSending(false);}
 }
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

 return <motion.section className="study-player results-screen" initial={false} animate={{opacity:1}} transition={{duration:.22}}><header className="study-top"><button className="study-icon" aria-label="Kembali" onClick={onClose}><ArrowLeft size={20}/></button><div><small>HASIL LATIHAN</small><h2>{attempt.title}</h2></div></header><div className="study-surface">{attempt.diagnostic?<div><h2>Cek konsep · {attempt.items[0].question.conceptName}</h2><p>{attempt.answers.length===1?`${attempt.answers[0].isCorrect?1:0} dari 2 benar. Jawaban awal salah, jawaban susulan ${attempt.answers[0].isCorrect?'benar':'salah'}.`:'Soal susulan belum dijawab.'}</p></div>:<div className="study-result-hero"><div className="study-score" style={{background:`conic-gradient(var(--study-accent) ${p.score}%,var(--study-border) 0)`}}><div><b>{p.score}<small>%</small></b><span>akurasi</span></div></div><div><span className="study-mascot">{p.score>=80?'( ✧ ▽ ✧ )':'( ◕ ‿ ◕ )'}</span><h2>{p.score>=80?'Kerja bagus.':'Sekarang tahu bagian yang perlu diulang.'}</h2><p>{p.correct} benar dari {p.total} soal · {attempt.answers.length} dijawab</p></div></div>}<div className="study-result-actions">
 {(remediation.length>0||savedRepair)?
  <button className="study-primary" disabled={sending} onClick={()=>void openRepair()}><RotateCcw size={17}/>{savedRepair?'Lanjutkan latihan perbaikan':`Uji ulang dengan ${remediation.length} soal berbeda`}</button>:
  wrong.length>0?
  <button className="study-primary" disabled={sending} onClick={()=>void ask('Buat soal pembanding yang berbeda untuk konsep yang salah. Gunakan materi asli yang tersedia dan sertakan sourceRefs (title, anchor jika terbukti, status sesuai pemeriksaan). Preview lewat prepare_pack_change dahulu; commit_pack_change setelah disetujui, lalu verifikasi receipt.',{
   topics:observedTopics,previous:wrong.slice(0,5).map(x=>({question:x.question.text,concept:x.question.conceptName??null,sourcePackId:x.sourcePackId,sourceQuestionId:x.sourceQuestionId}))
  })}>Minta soal pembanding di ChatGPT</button>:
  <button className="study-primary" onClick={onClose}>Selesai</button>}
 {wrong.length>0&&<button className="study-secondary" onClick={()=>onRetry(true)}><RotateCcw size={17}/>Ulangi {wrong.length} soal lama</button>}
 <button className="study-secondary" onClick={()=>onRetry(false)}><RotateCcw size={17}/>Ulangi semua</button>
 </div>{!attempt.diagnostic&&observedTopics.length>0&&<section className="v3-mistake-loop" aria-labelledby="v3-mistake-title">
 <div className="v3-mistake-heading"><span>LANGKAH BERIKUTNYA</span><h3 id="v3-mistake-title">Perbaiki konsep yang keliru</h3><p>Diambil dari jawaban yang benar-benar tersimpan, bukan perkiraan penguasaan.</p></div>
 <div className="v3-mistake-rows">{observedTopics.map(t=><div key={t.name}><strong>{t.name}</strong><span>{t.wrong} salah dari {t.answered} jawaban</span></div>)}</div>
 <button className="study-primary" disabled={sending} onClick={()=>void ask('Bahas konsep yang salah berdasarkan jawabanku, jelaskan mengapa keliru, lalu tawarkan satu cara untuk menguji ulang. Jangan klaim aku sudah menguasainya.',{
  concepts:observedTopics,errors:wrong.slice(0,5).map(i=>({sourcePackId:i.sourcePackId,questionId:i.sourceQuestionId,question:i.question.text,answer:answers.get(i.id)?.value??null}))
 })}>Bahas kesalahan di ChatGPT <ArrowRight size={17}/></button>
 </section>}
 {pack&&<details className="study-plan result-tools"><summary>Alat belajar</summary><div className="study-result-actions"><button className="study-secondary" onClick={()=>setCards({pack,questions:pack.questions})}>Flashcards<ChevronRight size={17}/></button>
 {pack&&(['material','graph','visual','comic'] as const).map(tab=><button key={tab} className="study-secondary" onClick={()=>setTool(tab)}>{{material:'Materi',graph:'Peta konsep',visual:'Visual Lab',comic:'Komik'}[tab]}</button>)}</div></details>}
 {(candidate||existingCheck)&&<button className="study-secondary" disabled={sending} onClick={()=>void checkConcept()}>{existingCheck?'Buka cek konsep':'Cek konsep dengan 1 soal lain'} · {candidate?.question.conceptName??existingCheck?.items[0].question.conceptName}</button>}
 <details className="study-plan"><summary>Soal lanjutan dari hasil latihan</summary>
 <label>Jumlah soal<input type="number" min={1} max={20} value={count} onChange={e=>setCount(Math.max(1,Math.min(20,Math.trunc(Number(e.target.value)))))}/></label>
 <GenerationOptions count={count} disabled={sending} label="Buat soal lanjutan di ChatGPT" onRequest={brief=>void ask(`Buat ${count} soal lanjutan untuk topik latihan ini. Prioritaskan topik yang belum dikuasai. ${brief}`,{
  topics:weakTopics.length?weakTopics:p.topics,
  examples:(wrong.length?wrong:attempt.items).slice(0,5).map(i=>({question:i.question,sourcePackId:i.sourcePackId,answer:answers.get(i.id)?.value}))
 })}/></details>{message&&<p role="status">{message}</p>}<details className="desk-results-disclosure"><summary>Akurasi per topik</summary><div className="study-topic-list">{p.topics.map(t=><div key={t.name}><div><b>{t.name}</b><span>{t.correct}/{t.total}</span></div><div className="study-progress"><span style={{width:`${t.correct/t.total*100}%`}}/></div></div>)}</div></details></div><details className="desk-results-disclosure"><summary>Tinjau {attempt.items.length} soal dan pembahasannya</summary><div className="study-review-list">{attempt.items.map((item,i)=>{const a=answers.get(item.id);const source=packs.find(p=>p.id===item.sourcePackId);return <details key={item.id} className="study-surface"><summary><span className={`study-verdict ${a?.isCorrect?'yes':'no'}`}>{a?.isCorrect?'✓':'×'}</span><span>{i+1}. {item.question.text}</span></summary><p>Jawaban benar: <b>{correctAnswerText(item.question)}</b></p>{a&&<p>Jawaban lo: {typeof a.value==='boolean'?(a.value?'Benar':'Salah'):item.question.options?.find(o=>o.id===a.value)?.text||a.value||'Waktu habis'}</p>}<Text>{item.question.explanation}</Text>
 {item.question.sourceRefs?.length?<div className="study-question-sources">
  <strong>Referensi yang dicantumkan pembuat</strong>
  <ul>{item.question.sourceRefs.map((reference,j)=><li key={j}>
   {reference.uri?<a href={reference.uri} target="_blank" rel="noopener noreferrer">{reference.title}</a>:<span>{reference.title}</span>}
   {reference.anchor?' · '+reference.anchor:''}
   <small>{reference.status==='provided'?'Disertakan pembuat':reference.status==='model_inspected'?'Dilaporkan diperiksa ChatGPT':'Sumber tidak tersedia'}</small>
  </li>)}</ul>
  <p>Rujukan disimpan bersama soal; dokumen aslinya tidak otomatis diperiksa oleh Noodl.</p>
 </div>:null}
 <div className="study-result-actions"><button className="study-secondary" disabled={sending} onClick={()=>void ask('Bahas soal ini, jawabanku, dan alasan kunci jawabannya.',{sourcePackId:item.sourcePackId,questionId:item.sourceQuestionId,question:item.question,answer:a?.value??null})}>Bahas soal ini</button>
 {source?.questions.some(q=>q.id===item.sourceQuestionId)&&<button className="study-secondary" onClick={()=>setCards({pack:source,questions:[item.question]})}>Jadikan flashcard</button>}</div></details>;})}</div></details></motion.section>;
}
