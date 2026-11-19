import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check} from 'lucide-react';
import {StudyText} from './StudyText';
import type {Attempt} from '../shared/types';
import type {BatchDraft} from '../shared/batch';
import {editBatch,submitBatch} from '../shared/engine';

export function BatchQuiz({attempt,save,onExit,english}:{attempt:Attempt;save:(a:Attempt)=>Promise<Attempt>;onExit:()=>void;english:boolean}){
  const [values,setValues]=useState<BatchDraft>(attempt.draft??{});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const latest=useRef(attempt),pending=useRef<BatchDraft|null>(null),task=useRef<Promise<void>|null>(null);
  const fields=useRef(new Map<string,HTMLFieldSetElement>());
  useEffect(()=>{
    if(attempt.revision<=latest.current.revision)return;
    latest.current=attempt;
    if(!pending.current&&!task.current)setValues(attempt.draft??{});
  },[attempt]);

  // Coalesce edits made while IndexedDB is committing the previous draft.
  function flush():Promise<void>{
    if(task.current)return task.current;
    setBusy(true);
    task.current=(async()=>{
      while(pending.current){
        const draft=pending.current;
        pending.current=null;
        try{latest.current=await save(editBatch(latest.current,draft));}
        catch(e){pending.current??=draft;throw e;}
      }
    })().finally(()=>{task.current=null;setBusy(false);});
    return task.current;
  }
  function change(id:string,value:string|boolean){
    const draft={...values,[id]:value};
    if(typeof value==='string'&&!value.trim())delete draft[id];
    setValues(draft);pending.current=draft;setError('');
    void flush().catch(e=>setError(String(e.message??e)));
  }
  async function finish(){
    try{setError('');await flush();setBusy(true);await save(submitBatch(latest.current));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  const count=Object.keys(values).length;
  const firstUnanswered=attempt.items.find(item=>!Object.hasOwn(values,item.id));
  function jumpTo(id:string){fields.current.get(id)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  return <section className="study-player practice-screen batch-quiz"><div className="practice-head"><header className="study-top">
    <button className="study-icon" aria-label={english?'Save and exit':'Simpan dan keluar'} disabled={busy} onClick={async()=>{try{await flush();onExit();}catch(e){setError(String(e));}}}><ArrowLeft size={20}/></button>
    <div><small>Batch Quiz</small><h2>{attempt.title}</h2></div></header>
    <div className="study-progress"><span style={{width:count/attempt.items.length*100+'%'}}/></div><p className="study-counter" role="status">{count} / {attempt.items.length} {english?'answered':'dijawab'} · {error?english?'Save failed':'Gagal menyimpan':busy?english?'Saving locally':'Menyimpan lokal':english?'Saved on device':'Tersimpan di perangkat'}</p></div><main className="practice-scroll"><div className="practice-column">
    {firstUnanswered&&<div className="desk-batch-jump"><span>{english?'Unanswered questions remain':'Masih ada soal kosong'}</span><button className="study-secondary" onClick={()=>jumpTo(firstUnanswered.id)}>{english?'Jump to first unanswered':'Ke soal belum dijawab'}</button></div>}
    <nav className="desk-batch-index" aria-label={english?'Jump to question':'Lompat ke soal'}>{attempt.items.map((item,i)=><button key={item.id} type="button" aria-label={`${english?'Question':'Soal'} ${i+1}${Object.hasOwn(values,item.id)?' · '+(english?'answered':'dijawab'):''}`} aria-pressed={Object.hasOwn(values,item.id)} onClick={()=>jumpTo(item.id)}>{i+1}</button>)}</nav>
    {attempt.items.map(({id,question:q},i)=><fieldset key={id} ref={node=>{if(node)fields.current.set(id,node);else fields.current.delete(id);}} className="study-surface question-card"><legend className="sr-only">{english?'Question':'Soal'} {i+1}</legend><div className="study-tags"><span>{english?'Question':'Soal'} {i+1}</span>{Object.hasOwn(values,id)&&<span><Check size={13}/> {english?'Answered':'Dijawab'}</span>}</div>
      <div className="study-question"><StudyText>{q.text}</StudyText></div>
      {q.type==='FILL_BLANK'?<label>{english?'Answer':'Jawaban'}<input maxLength={2000} value={String(values[id]??'')} onChange={e=>change(id,e.target.value)}/></label>:
      (q.type==='TRUE_FALSE'?[{value:true,text:english?'True':'Benar'},{value:false,text:english?'False':'Salah'}]:
        q.options!.map(option=>({value:option.id,text:option.text}))).map((option,j)=>
          <label className={'batch-choice study-option'+(values[id]===option.value?' chosen':'')} key={String(option.value)}><input type="radio" name={id} checked={values[id]===option.value} onChange={()=>change(id,option.value)}/>
            <b aria-hidden="true">{String.fromCharCode(65+j)}</b><StudyText>{option.text}</StudyText>
          </label>)}
    </fieldset>)}
    {error&&<p role="alert">{error} <button onClick={()=>{setError('');void flush().catch(e=>setError(String(e)));}}>{english?'Retry save':'Coba simpan lagi'}</button></p>}
    </div></main><footer className="batch-submit"><button className="study-primary" disabled={busy||count!==attempt.items.length} onClick={()=>void finish()}>{english?'Submit all answers':'Kumpulkan semua jawaban'}</button></footer>
  </section>;
}
