import {useEffect,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type {Attempt} from '../shared/types';
import type {BatchDraft} from '../shared/batch';
import {editBatch,submitBatch} from '../shared/engine';

export function BatchQuiz({attempt,save,onExit,english}:{attempt:Attempt;save:(a:Attempt)=>Promise<Attempt>;onExit:()=>void;english:boolean}){
  const [values,setValues]=useState<BatchDraft>(attempt.draft??{});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const latest=useRef(attempt),pending=useRef<BatchDraft|null>(null),task=useRef<Promise<void>|null>(null);
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
  return <section className="study-player batch-quiz"><header className="study-top">
    <button className="study-secondary" disabled={busy} onClick={async()=>{try{await flush();onExit();}catch(e){setError(String(e));}}}>{english?'Save and exit':'Simpan dan keluar'}</button>
    <div><small>Batch Quiz</small><h2>{attempt.title}</h2></div></header>
    <p role="status">{count} / {attempt.items.length} {english?'answered':'dijawab'}</p>
    {attempt.items.map(({id,question:q},i)=><fieldset key={id} className="study-surface"><legend>{english?'Question':'Soal'} {i+1}</legend>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.text}</ReactMarkdown>
      {q.type==='FILL_BLANK'?<label>{english?'Answer':'Jawaban'}<input maxLength={2000} value={String(values[id]??'')} onChange={e=>change(id,e.target.value)}/></label>:
      (q.type==='TRUE_FALSE'?[{value:true,text:english?'True':'Benar'},{value:false,text:english?'False':'Salah'}]:
        q.options!.map((option,j)=>({value:option.id,text:String.fromCharCode(65+j)+'. '+option.text}))).map(option=>
          <label className="batch-choice" key={String(option.value)}><input type="radio" name={id} checked={values[id]===option.value} onChange={()=>change(id,option.value)}/>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{option.text}</ReactMarkdown>
          </label>)}
    </fieldset>)}
    {error&&<p role="alert">{error} <button onClick={()=>{setError('');void flush().catch(e=>setError(String(e)));}}>{english?'Retry save':'Coba simpan lagi'}</button></p>}
    <button className="study-primary" disabled={busy||count!==attempt.items.length} onClick={()=>void finish()}>{english?'Submit all answers':'Kumpulkan semua jawaban'}</button>
  </section>;
}
