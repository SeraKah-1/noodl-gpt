import {GenerationOptions,StudyCalendar} from '../StudyPlanning';
import {useMemo,useRef,useState} from 'react';
import {BookOpen, Plus, Upload, MessageSquarePlus, Play, Layers, SlidersHorizontal, Heart, Brain, Globe, ChevronDown, ChevronRight, Library} from 'lucide-react';
import type {Attempt,Pack,StudyOptions as Options} from '../../shared/types';
import {firstProbe} from '../../shared/practice';
import {progressFor} from '../../shared/engine';
import {StudyOptions} from './StudyOptions';
import type {Locale} from './Navigation';

type Props={selectedId:string;onSelect:(id:string)=>void;onExplore:()=>void;onProbe:(pack:Pack)=>void;onDebugger:()=>void;locale:Locale;packs:Pack[];attempts:Attempt[];options:Options;busy:boolean;onOptions:(value:Options)=>void;onStart:(pack:Pack)=>void;onFlash:(pack:Pack)=>void;onResume:(attempt:Attempt)=>void;onReview:()=>void;onImport:(file:File)=>Promise<void>;onBrainDump:()=>void;onCreate:()=>void;onChat:(message:string)=>void};
export function DashboardMascot({count,locale,onReview}:{count:number;locale:Locale;onReview:()=>void}){
  const [poke,setPoke]=useState(0);const id=locale==='id';
  const stages=[{min:0,label:id?'Baru kenal':'Just met',face:'( . _ . )'},{min:5,label:id?'Makin akrab':'Getting closer',face:'( ◕ ‿ ◕ )'},{min:30,label:id?'Bareng terus':'Ride or die',face:'(≧▽≦)'}];
  const index=count>=30?2:count>=5?1:0;const stage=stages[index],next=stages[index+1];
  const progress=next?Math.min(100,Math.max(0,(count-stage.min)/(next.min-stage.min)*100)):100;
  const messages=id?['Satu kuis dulu. Kita lihat bagian mana yang sudah nempel.','Kartu yang meleset bisa kamu ulang di Neuro-Sync.','Aku tidak menilai jiwamu — cuma opsi jawaban.','Mix Room ada kalau mau latihan beberapa topik sekaligus.']:['One quiz first. Let’s see what sticks.','Review the tricky cards in Neuro-Sync.','I don’t grade your soul — only the options.','Mix Room brings several topics into one practice.'];
  return <section className="classic-mascot" aria-label={id?'Teman belajar':'Study companion'}><div className="classic-companion"><button onClick={()=>setPoke(n=>n+1)} aria-label={id?'Ketuk maskot untuk ganti kalimat':'Tap mascot for a new line'}>{poke%2?'( ^ _ ^ )':stage.face}</button><span>{stage.label}</span></div><div className="classic-companion-body"><p className="classic-speech" aria-live="polite">“{messages[poke%messages.length]}”</p><div className="classic-bond"><span><Heart size={12}/> Bond</span><span>{count} {id?'sesi selesai':'completed sessions'}</span></div><div className="classic-bond-track" role="progressbar" aria-label="Bond" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{width:`${progress}%`}}/></div><button className="classic-review-link" onClick={onReview}><Brain size={14}/>{id?'Jadwal pengulangan':'Review schedule'}</button></div></section>;
}
export function Home(props:Props){
  const {locale,packs,attempts,options,busy,onOptions,onStart,onFlash,onResume,onReview,onImport,onCreate,onChat}=props;
  const id=locale==='id';const [tab,setTab]=useState<'library'|'import'|'chat'>('library'),[topic,setTopic]=useState(''),[count,setCount]=useState(10),[error,setError]=useState(''),[importing,setImporting]=useState(false),[dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const history=useMemo(()=>[...attempts].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[attempts]);
  const completed=history.filter(a=>a.status==='completed');
  const resume=history.find(a=>a.status==='active');
  const answered=resume?.draft?Object.keys(resume.draft).length:resume?.answers.length??0;
  const byId=new Map(packs.map(p=>[p.id,p]));
  const recent=history.find(a=>byId.has(a.packId));
  const pack=byId.get(props.selectedId)??(recent&&byId.get(recent.packId))??packs.reduce<Pack|undefined>((latest,p)=>!latest||p.updatedAt>latest.updatedAt?p:latest,undefined);
  const canProbe=useMemo(()=>pack&&firstProbe(pack,attempts),[pack,attempts]);
  const modeName={STANDARD:'Standard',BATCH:'Batch Quiz',SURVIVAL:'Survival',TIME_RUSH:'Time Rush'}[options.mode];
  async function importFile(file?:File){if(!file||importing)return;setImporting(true);setError('');try{await onImport(file);setTab('library');}catch(e){setError(e instanceof Error?e.message:'Import failed');}finally{setImporting(false);}}
  function request(brief:string){const label=id?'Buat':'Create';onChat(`${label} ${count} ${id?'soal latihan tentang':'practice questions about'} ${topic.trim()}. ${id?'Sertakan pembahasan, petunjuk, dan konsep. Simpan ke Noodl melalui create_pack.':'Include explanations, hints and concepts. Save to Noodl with create_pack.'}\n${brief}`.trim());}
  return <div className="classic-home study-desk">
    <header className="desk-heading"><h1>{id?'Meja belajar':'Study desk'}</h1></header>
    <div className="desk-layout"><div className="desk-main">
      {resume&&<section className="desk-resume" aria-labelledby="resume-title">
        <div className="desk-section-label"><Play size={16}/>{id?'Sesi berjalan':'In progress'}</div>
        <h2 id="resume-title">{resume.title}</h2>
        <div className="desk-progress"><progress max={resume.items.length||1} value={answered} aria-label={id?'Soal dijawab':'Questions answered'}/><span>{answered} / {resume.items.length} {id?'dijawab':'answered'}</span></div>
        <button className="classic-start" onClick={()=>onResume(resume)}>{id?'Lanjutkan sesi':'Resume session'}</button>
      </section>}
      {pack&&<section className="desk-practice" aria-labelledby="practice-title">
        <div className="desk-section-label"><BookOpen size={18}/>{id?'Latihan baru':'New practice'}</div>
        <h2 id="practice-title">{pack.title}</h2>
        <p className="desk-meta">{pack.questions.length} {id?'soal':'questions'}{pack.folder&&` · ${pack.folder}`}</p>
        {packs.length>1&&<label className="desk-picker"><span>{id?'Ganti bank':'Switch bank'}</span>
          <span className="desk-select"><select value={pack.id} onChange={e=>props.onSelect(e.target.value)}>{packs.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select><ChevronDown aria-hidden="true" size={16}/></span>
        </label>}
        <div className="desk-actions">
          <button className="classic-start" disabled={busy||!pack.questions.length} onClick={()=>onStart(pack)}><Play size={18}/>{busy?(id?'Menyiapkan…':'Preparing…'):(options.mode==='STANDARD'?(id?'Mulai kuis':'Start quiz'):(id?'Mulai ':'Start ')+modeName)}</button>
          <button className="classic-secondary" disabled={busy||!pack.questions.length} onClick={()=>onFlash(pack)}><Layers size={18}/>Flashcards</button>
        </div>
        <details className="desk-settings"><summary><SlidersHorizontal size={17}/><span>{id?'Atur latihan':'Practice settings'}</span><small>{modeName}</small><ChevronDown size={16}/></summary>
          <StudyOptions questionCount={pack.questions.length} value={options} onChange={onOptions} locale={locale}/>
          {canProbe&&<button className="classic-secondary" disabled={busy} onClick={()=>props.onProbe(pack)}>{id?'Cek awal · 1 soal':'Initial check · 1 question'}</button>}
        </details>
      </section>}
      <section className="desk-sources" aria-labelledby="sources-title">
        <h2 id="sources-title">{pack?(id?'Tambah materi':'Add material'):(id?'Mulai dari bank soal':'Choose your first question bank')}</h2>
        {!pack&&<p>{id?'Ambil bank publik untuk langsung latihan, atau buat soal sendiri.':'Start with a shared bank or create your own questions.'}</p>}
        <div className="classic-input-tabs" role="group" aria-label={id?'Sumber materi':'Material source'}>{([{key:'library',Icon:Library,label:id?'Bank soal':'Banks'},{key:'import',Icon:Upload,label:id?'Impor JSON':'Import JSON'},{key:'chat',Icon:MessageSquarePlus,label:'ChatGPT'}] as const).map(({key,Icon,label})=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setError('');}}><Icon size={17}/><span>{label}</span></button>)}</div>
        {tab==='library'&&<div className="desk-actions"><button className={pack?'classic-secondary':'classic-start'} onClick={props.onExplore}><Globe size={17}/>{id?'Jelajahi bank publik':'Explore public banks'}</button><button className="classic-secondary" onClick={onCreate}><Plus size={17}/>{id?'Buat bank soal':'Create bank'}</button></div>}
      {tab==='import'&&<div className={`classic-import ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void importFile(e.dataTransfer.files[0]);}}><input ref={input} className="classic-file-input" type="file" accept=".json,application/json" aria-label={id?'Pilih bank JSON':'Choose JSON bank'} disabled={importing||busy} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/><button disabled={importing||busy} onClick={()=>input.current?.click()}><Upload size={32}/><strong>{importing?(id?'Mengimpor…':'Importing…'):(id?'Tarik bank JSON ke sini':'Drop a JSON bank here')}</strong><span>{id?'atau klik untuk memilih file · maksimal 8 MB':'or click to choose a file · up to 8 MB'}</span></button></div>}
      {tab==='chat'&&<div className="classic-topic"><label htmlFor="classic-topic">{id?'Mau belajar apa?':'What do you want to learn?'}</label><textarea id="classic-topic" rows={3} value={topic} maxLength={4000} onChange={e=>setTopic(e.target.value)} placeholder={id?'Contoh: fisiologi lambung dan regulasi asam':'For example: stomach physiology and acid regulation'}/><label htmlFor="classic-count">{id?'Jumlah soal':'Question count'}</label><input id="classic-count" type="number" min={1} max={100} value={count} onChange={e=>setCount(Math.min(100,Math.max(1,Math.trunc(Number(e.target.value))||1)))}/><p>{id?'Permintaan dibuka di ChatGPT. Di website, teks disalin agar bisa kamu tempel ke percakapan.':'The request opens in ChatGPT. On the website, the text is copied so you can paste it into the conversation.'}</p></div>}
      {error&&<p role="alert" className="study-error">{error}</p>}
      {tab==='chat'&&<button className="classic-secondary" disabled={busy} onClick={props.onBrainDump}>{id?'Brain Dump dari PPT':'Brain Dump from slides'}</button>}
      {tab==='chat'&&<GenerationOptions english={!id} count={count} disabled={busy||!topic.trim()} onRequest={request} label={id?'Buat lewat ChatGPT':'Create with ChatGPT'}/>}
      </section>
    </div><aside className="desk-side">
      {completed.length>0&&<section className="classic-recent"><h2>{id?'Hasil terakhir':'Recent results'}</h2>{completed.slice(0,3).map(a=><button key={a.id} onClick={()=>onResume(a)}><span>{a.title}</span><strong>{progressFor(a).score}%</strong><ChevronRight size={16}/></button>)}</section>}
      <DashboardMascot count={completed.length} locale={locale} onReview={onReview}/>
      <section className="desk-extras"><h2>{id?'Alat belajar':'Study tools'}</h2>
        <button className="desk-tool" onClick={props.onDebugger}><Brain size={20}/><span>Knowledge Debugger<small>{id?'Regulasi asam lambung':'Gastric acid regulation'}</small></span></button>
        <StudyCalendar english={!id}/>
      </section>
    </aside></div>
  </div>;
}
