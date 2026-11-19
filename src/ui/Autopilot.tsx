import {useCallback,useEffect,useRef,useState} from 'react';
import {client} from '../client';
import {readExposures,saveExposure} from '../client/exposure';
import {concept,needsOptions,delayedQuestion,phaseSeconds,recallDelay,singleQuestion,type Exposure} from '../shared/practice';
import {correctAnswerText} from '../shared/engine';
import type {Attempt,Pack,Question,ReviewEvent} from '../shared/types';
import {StudyText} from './StudyText';

type Props={pack:Pack;questions:Question[];onReview:(e:ReviewEvent)=>void|Promise<void>;onClose:()=>void;onCheck:(a:Attempt)=>void};

export function Autopilot({pack,questions,onReview,onClose,onCheck}:Props){
  const [count,setCount]=useState(Math.min(5,questions.length)),[start,setStart]=useState(0);
  const [deck,setDeck]=useState<Question[]>([]),[index,setIndex]=useState(0),[back,setBack]=useState(false);
  const [paused,setPaused]=useState(false),[pace,setPace]=useState(1),[error,setError]=useState('');
  const [history,setHistory]=useState<Exposure[]>([]),[historyReady,setHistoryReady]=useState(false);
  const [showChoices,setShowChoices]=useState(false);
  const [rating,setRating]=useState(false),[rated,setRated]=useState(false);
  const busy=useRef(false);
  const session=useRef<Exposure|null>(null),clock=useRef<number|null>(null);
  const q=deck[index];
  const refresh=useCallback(async()=>{
    setHistory(await readExposures(pack.ownerId,pack.id));setHistoryReady(true);
  },[pack.ownerId,pack.id]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
  const persist=useCallback(()=>{
    const s=session.current;
    if(s)void saveExposure(pack.ownerId,pack.id,s).catch(()=>setError('Riwayat Autopilot gagal disimpan pada perangkat ini.'));
  },[pack.id,pack.ownerId]);
  const stopClock=useCallback(()=>{
    if(session.current&&clock.current!==null){
      session.current.activeMs+=Math.max(0,performance.now()-clock.current);clock.current=null;
      persist();
    }
  },[persist]);
  useEffect(()=>{
    function hide(){if(document.hidden){stopClock();setPaused(true);}}
    document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',stopClock);
    return ()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',stopClock);stopClock();};
  },[stopClock]);
  function next(){stopClock();setShowChoices(false);setIndex(i=>i+1);setBack(false);setRated(false);}
  useEffect(()=>{
    if(!q||paused||document.hidden||!session.current)return;
    const s=session.current;
    if(!s.shown.some(v=>v.id===q.id)){
      s.shown.push({id:q.id,text:q.text,concept:concept(q)});s.lastShownAt=Date.now();persist();
    }
    clock.current=performance.now();
    const timer=window.setTimeout(()=>{
      if(document.hidden){stopClock();setPaused(true);return;}
      if(back)next();else setBack(true);
    },phaseSeconds(q,back)*pace*1000);
    return ()=>{window.clearTimeout(timer);stopClock();};
  },[q,back,paused,pace,persist,stopClock]);
  function begin(){
    const now=Date.now();session.current={id:crypto.randomUUID(),startedAt:now,lastShownAt:now,activeMs:0,shown:[]};
    setShowChoices(false);setDeck(questions.slice(start,start+count));setIndex(0);setBack(false);setPaused(document.hidden);setRated(false);
  }
  async function flag(){
    if(busy.current||rated||!q)return;
    busy.current=true;stopClock();setPaused(true);setRating(true);
    try{await onReview({id:session.current!.id+':'+q.id,cardId:pack.id+':'+q.id,packId:pack.id,questionId:q.id,question:q,rating:0,reviewedAt:new Date().toISOString()});setRated(true);}
    catch(e){setError(String(e));}finally{busy.current=false;setRating(false);}
  }
  async function check(s:Exposure,question?:Question){
    if(busy.current)return;
    busy.current=true;
    try{
      const id='recall-'+s.id,previous=client.getState().attempts.find(a=>a.id===id);
      if(previous){onCheck(previous);return;}
      if(!question)return;
      const attempt=singleQuestion(pack,question);attempt.id=id;
      onCheck(await client.saveAttempt(attempt));
    }catch(e){setError(String(e));}finally{busy.current=false;}
  }
  const attempts=client.getState().attempts;
  return <section className="study-player"><header className="study-top"><button className="study-secondary" disabled={rating} onClick={onClose}>Kembali</button><div><small>Autopilot Recall</small><h2>{pack.title}</h2></div></header>
    {!deck.length?<div className="study-surface"><h3>Latihan tanpa klik</h3>
      <p>Pikirkan jawaban sampai kartu berbalik. Kartu yang lewat dicatat sebagai ditampilkan. Kamu bisa menjeda kapan saja.</p>
      <div className="recall-controls"><label>Mulai dari kartu <input type="number" min={1} max={questions.length} value={start+1} onChange={e=>setStart(Math.max(0,Math.min(questions.length-1,Math.trunc(+e.target.value)-1)))}/></label>
      <label>Jumlah kartu <input type="number" min={1} max={questions.length-start} value={Math.min(count,questions.length-start)} onChange={e=>setCount(Math.max(1,Math.min(questions.length-start,Math.trunc(+e.target.value))))}/></label></div>
      <button className="study-primary" disabled={!questions.length} onClick={begin}>Mulai Autopilot</button>
      {historyReady&&history.length>0&&<><h3>Cek ingatan tertunda</h3><p>Riwayat perangkat ini · waktu tampilan aktif. Cek dibuka setelah 2 hari jika ada soal lain untuk konsep yang sama.</p>
        <ul>{history.slice(0,30).map(s=>{
          const attempt=attempts.find(a=>a.id==='recall-'+s.id),question=delayedQuestion(pack,s,history,attempts);
          return <li key={s.id}>{new Date(s.startedAt).toLocaleDateString('id-ID')} · {s.shown.length} kartu · {Math.round(s.activeMs/1000)} detik.
            {attempt?.status==='completed'?<span> Cek tertunda: {attempt.answers[0]?.isCorrect?'benar':'salah'} pada 1 soal.</span>:
              attempt||question?<button className="study-secondary" onClick={()=>void check(s,question)}> {attempt?'Lanjutkan cek':'Cek dengan 1 soal lain'}</button>:
              <span> {Date.now()-s.lastShownAt<recallDelay?'Tersedia '+new Date(s.lastShownAt+recallDelay).toLocaleString('id-ID'):'Belum ada soal baru bertopik sama.'}</span>}</li>;
        })}</ul></>}
    </div>:q?<article className="study-surface"><p>{index+1} / {deck.length} · {back?'Pembahasan':'Ingat dari ingatan'}{paused?' · Dijeda':''}</p>
      {q.type==='TRUE_FALSE'&&<strong>Benar atau salah?</strong>}<StudyText>{q.text}</StudyText>
      {!back&&q.type==='MULTIPLE_CHOICE'&&!needsOptions(q)&&!showChoices&&<button className="study-secondary" onClick={()=>setShowChoices(true)}>Lihat pilihan</button>}
      {!back&&q.type==='MULTIPLE_CHOICE'&&(needsOptions(q)||showChoices)&&<ol type="A">{q.options?.map(o=><li key={o.id}><StudyText>{o.text}</StudyText></li>)}</ol>}
      {back&&<div className="study-feedback"><strong>Jawaban</strong><StudyText>{correctAnswerText(q)}</StudyText><StudyText>{q.explanation}</StudyText></div>}
      <div className="recall-controls"><button className="study-secondary" disabled={rating} onClick={()=>setPaused(!paused)}>{paused?'Lanjutkan':'Jeda'}</button>
      <button className="study-secondary" disabled={rating} onClick={()=>back?next():setBack(true)}>{back?'Berikutnya':'Ungkap sekarang'}</button>
      <label>Tempo <select value={pace} onChange={e=>setPace(+e.target.value)}><option value={1}>Normal</option><option value={1.75}>Lambat</option><option value={0.7}>Cepat</option></select></label>
      {back&&<button className="study-secondary" disabled={rating||rated} onClick={()=>void flag()}>{rated?'Terjadwal':'Lupa · jadwalkan ulang'}</button>}</div>
    </article>:<article className="study-surface"><h3>Sesi selesai</h3><p>{session.current?.shown.length} kartu ditampilkan · {Math.round((session.current?.activeMs??0)/1000)} detik aktif.</p><button className="study-secondary" onClick={async()=>{setDeck([]);try{if(session.current)await saveExposure(pack.ownerId,pack.id,session.current);await refresh();}catch(e){setError(String(e));}}}>Lihat riwayat</button></article>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
