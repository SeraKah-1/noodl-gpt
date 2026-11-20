import {useEffect,useMemo,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {ArrowRight,BookOpen,ChevronLeft,CheckCircle2,Clock3,FileText,Layers,MessageSquare,MoreHorizontal,Network,Orbit,PenLine,Play,Share2,Trash2,BookMarked} from 'lucide-react';
import type {Attempt,Pack,Question} from '../shared/types';
import {progressFor} from '../shared/engine';
import {StudyText} from './StudyText';
import {BankHistory} from './BankHistory';
import {ExportMenu} from './Tools';
import type {Locale,ToolTab} from './classic/Navigation';

interface Props{
 pack:Pack;attempts:Attempt[];locale:Locale;busy:boolean;
 onBack:()=>void;onPractice:()=>void;onPracticeTopic?:(questions:Question[])=>void;onFlashcards:()=>void;onTool:(tab:ToolTab)=>void;
 onEdit:()=>void;onRename:()=>void;onPublish:()=>void;onUnpublish:()=>void;onDelete:()=>void;
 onOpenAttempt:(attempt:Attempt)=>void;onAskChatGPT?:(prompt:string)=>Promise<void>;
}
type WorkspaceTab='material'|'learn'|'studio';
export function PackDetail({pack,attempts,locale,busy,onBack,onPractice,onPracticeTopic,onFlashcards,onTool,onEdit,onRename,onPublish,onUnpublish,onDelete,onOpenAttempt,onAskChatGPT}:Props){
 const en=locale==='en',reduce=useReducedMotion()||document.documentElement.dataset.reducedMotion==='true';
 const [tab,setTab]=useState<WorkspaceTab>('learn');
 const [selectedId,setSelectedId]=useState<string|null>(null),[selectedTopic,setSelectedTopic]=useState<string|null>(null);
 const [asking,setAsking]=useState(false),[feedback,setFeedback]=useState('');
 const materials=pack.artifacts.filter(a=>a.kind==='material'||a.kind==='insight');
 const visuals=pack.artifacts.filter(a=>a.kind==='visualization');
 const comics=pack.artifacts.filter(a=>a.kind==='comic');
 const selected=materials.find(a=>a.id===selectedId);
 const topicNames=useMemo(()=>[...new Set(pack.questions.map(q=>q.conceptName?.trim()).filter((v):v is string=>!!v))], [pack.questions]);
 const topicQuestions=pack.questions.filter(q=>q.conceptName===selectedTopic);
 const history=attempts.filter(a=>a.items.some(i=>i.sourcePackId===pack.id));
 const active=history.filter(a=>a.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const latest=history.filter(a=>a.status==='completed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 useEffect(()=>{setTab('learn');setSelectedId(null);setSelectedTopic(null);setFeedback('');},[pack.id]);
 async function request(prompt:string){
  if(!onAskChatGPT||asking)return;
  setAsking(true);setFeedback('');
  try{await onAskChatGPT(prompt);setFeedback(en?'Request sent to ChatGPT; the bank updates only after an MCP save.':'Permintaan dikirim ke ChatGPT; bank baru berubah setelah penyimpanan MCP berhasil.');}
  catch(e){setFeedback(e instanceof Error?e.message:String(e));}
  finally{setAsking(false);}
 }
 const goMaterial=(id:string)=>{setSelectedId(id);setSelectedTopic(null);setTab('material');};
 const goTopic=(name:string)=>{setSelectedTopic(name);setSelectedId(null);setTab('learn');};
 return <motion.section className="v3-bank-workspace" aria-labelledby="desk-pack-title" initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.22}}>
  <button className="desk-link v3-back" onClick={onBack}><ChevronLeft size={18}/>{en?'Back to Library':'Kembali ke Library'}</button>
  <header className="v3-bank-header">
   <div><span className="v3-eyebrow">{pack.folder||'LIBRARY'} / {pack.questions.length} {en?'QUESTIONS':'SOAL'}</span><h1 id="desk-pack-title">{pack.title}</h1>
    {pack.description&&<p>{pack.description}</p>}</div>
   <div className="v3-bank-header-actions">
    <button className="desk-primary" disabled={busy} onClick={active?()=>onOpenAttempt(active):onPractice}><Play size={18}/>{active?(en?'Resume practice':'Lanjutkan sesi'):(en?'Start practice':'Mulai latihan')}</button>
    <details className="desk-actions-menu"><summary aria-label={en?'More bank actions':'Tindakan bank lainnya'}><MoreHorizontal size={21}/></summary><div>
     <button onClick={onEdit}><PenLine size={16}/>{en?'Edit questions':'Edit soal'}</button>
     <button onClick={onRename}>{en?'Rename and move':'Ubah nama dan folder'}</button>
     <ExportMenu pack={pack}/>
     <button disabled={busy} onClick={onPublish}><Share2 size={16}/>{en?'Publish a copy':'Publikasikan salinan'}</button>
     <button disabled={busy} onClick={onUnpublish}>{en?'Unpublish':'Cabut publikasi'}</button>
     <button className="danger" onClick={onDelete}><Trash2 size={16}/>{en?'Delete bank':'Hapus bank'}</button>
    </div></details>
   </div>
  </header>
  <nav className="v3-workspace-mobile-tabs" aria-label={en?'Workspace sections':'Bagian workspace'}>
   {([['material',BookOpen,en?'Materials':'Materi'],['learn',Play,en?'Learn':'Belajar'],['studio',Layers,'Studio']] as const).map(([key,Icon,label])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}><Icon size={16}/>{label}</button>)}
  </nav>
  <div className="v3-workspace-columns" data-mobile-tab={tab}>
   <aside className="v3-workspace-sidebar v3-workspace-material" aria-label={en?'Bank material':'Materi bank'}>
    <div className="v3-panel-heading"><span className="v3-eyebrow">01 / MATERIALS</span><h2>{en?'Materials & concepts':'Materi & konsep'}</h2></div>
    <div className="v3-sidebar-group"><h3>{en?'Saved materials':'Materi tersimpan'} <span>{materials.length}</span></h3>
     {materials.length?materials.map(a=><button key={a.id} aria-pressed={selectedId===a.id} onClick={()=>goMaterial(a.id)}><FileText size={16}/><span>{a.title}</span><ArrowRight size={15}/></button>):<p className="v3-empty-small">{en?'ChatGPT can save materials here via MCP.':'ChatGPT bisa menyimpan materi ke sini melalui MCP.'}</p>}
    </div>
    <div className="v3-sidebar-group"><h3>{en?'Question concepts':'Konsep soal'} <span>{topicNames.length}</span></h3>
     {topicNames.length?topicNames.map(name=><button key={name} aria-pressed={selectedTopic===name} onClick={()=>goTopic(name)}><BookOpen size={16}/><span>{name}</span><ArrowRight size={15}/></button>):<p className="v3-empty-small">{en?'No concept tags yet.':'Belum ada label konsep pada soal.'}</p>}
    </div>
   </aside>
   <main className="v3-learning-canvas" id="v3-learning-canvas">
    <AnimatePresence mode="wait" initial={false}>
     <motion.div key={selected?.id??selectedTopic??'overview'} initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={reduce?undefined:{opacity:0,y:-7}} transition={{duration:.18}}>
     {selected?<><span className="v3-eyebrow">{selected.kind==='insight'?'INSIGHT':'MATERIAL'} / {pack.title}</span><h2>{selected.title}</h2><article className="v3-reading-sheet"><StudyText>{selected.content}</StudyText></article>
      <div className="v3-learning-actions"><button className="desk-secondary" onClick={()=>setSelectedId(null)}>{en?'Back to overview':'Kembali ke ringkasan'}</button>
       <button className="desk-primary" onClick={onPractice}><Play size={17}/>{en?'Practice this bank':'Latihan dari bank ini'}</button></div></>:
      selectedTopic?<><span className="v3-eyebrow">CONCEPT / {topicQuestions.length} {en?'QUESTIONS':'SOAL'}</span><h2>{selectedTopic}</h2>
       <p>{en?'Questions tagged with this concept. These are content labels, not proof of mastery.':'Soal dengan label konsep ini. Label konten bukan bukti penguasaan.'}</p>
       <div className="v3-concept-questions">{topicQuestions.map((q,i)=><details key={q.id}><summary>{i+1}. {q.text}</summary><StudyText>{q.explanation}</StudyText></details>)}</div>
       <div className="v3-learning-actions">
        <button className="desk-secondary" onClick={()=>setSelectedTopic(null)}>{en?'Back to overview':'Kembali ke ringkasan'}</button>
        <button className="desk-primary" disabled={!topicQuestions.length} onClick={()=>onPracticeTopic?onPracticeTopic(topicQuestions):onPractice()}><Play size={17}/>{en?'Practice this concept':'Latihan konsep ini'}</button></div></>:
      <><span className="v3-eyebrow">02 / LEARNING CANVAS</span><h2>{en?'Continue learning':'Lanjutkan belajar'}</h2>
       <p>{en?'Everything here belongs to your selected question bank. Start a practice session or open a saved material.':'Semua yang tampil berasal dari bank ini. Mulai latihan atau buka materi yang sudah tersimpan.'}</p>
       <div className="v3-learning-highlight">
        <div><span>{active?(en?'ACTIVE SESSION':'SESI AKTIF'):(en?'READY TO PRACTICE':'SIAP LATIHAN')}</span>
         <strong>{active?`${active.options.mode==='BATCH'?Object.keys(active.draft??{}).length:active.answers.length} / ${active.items.length} ${en?'answered':'dijawab'}`:`${pack.questions.length} ${en?'questions available':'soal tersedia'}`}</strong>
         <p>{latest?`${en?'Previous accuracy':'Akurasi terakhir'}: ${progressFor(latest).score}% · ${latest.items.length} ${en?'questions':'soal'}`:(en?'No completed practice yet.':'Belum ada sesi latihan selesai.')}</p></div>
        <button className="desk-primary" onClick={active?()=>onOpenAttempt(active):onPractice}><Play size={17}/>{active?(en?'Resume':'Lanjutkan'):(en?'Start quiz':'Mulai kuis')}</button>
       </div>
       <section className="v3-canvas-section"><h3>{en?'Study history':'Riwayat belajar'}</h3>
        <BankHistory packId={pack.id} attempts={history} english={en} onOpen={onOpenAttempt}/></section>
      </>}
     </motion.div>
    </AnimatePresence>
   </main>
   <aside className="v3-workspace-sidebar v3-workspace-studio" aria-label="Noodl Studio">
    <div className="v3-panel-heading"><span className="v3-eyebrow">03 / STUDIO</span><h2>{en?'Study tools':'Alat belajar'}</h2></div>
    <p>{en?'Choose the action you want to take with this bank.':'Pilih apa yang ingin dilakukan dengan bank ini.'}</p>
    <div className="v3-studio-actions">
     <button onClick={onFlashcards}><Layers size={20}/><span><strong>Flashcards</strong><small>{en?'Self-recall and review':'Uji ingatan sendiri'}</small></span><ArrowRight size={17}/></button>
     <button onClick={()=>onTool('material')}><FileText size={20}/><span><strong>{en?'Materials':'Materi'}</strong><small>{materials.length} {en?'saved':'tersimpan'}</small></span><ArrowRight size={17}/></button>
     <button onClick={()=>onTool('graph')}><Network size={20}/><span><strong>{en?'Concept associations':'Asosiasi konsep'}</strong><small>{en?'Text similarity, not causal proof':'Kemiripan teks, bukan sebab-akibat'}</small></span><ArrowRight size={17}/></button>
     {visuals.length>0&&<button onClick={()=>onTool('visual')}><Orbit size={20}/><span><strong>Visual Lab</strong><small>{visuals.length} {en?'saved':'tersimpan'}</small></span><ArrowRight size={17}/></button>}
     {comics.length>0&&<button onClick={()=>onTool('comic')}><BookMarked size={20}/><span><strong>{en?'Comics':'Komik'}</strong><small>{comics.length} {en?'saved':'tersimpan'}</small></span><ArrowRight size={17}/></button>}
    </div>
    {onAskChatGPT&&<div className="v3-studio-chat"><MessageSquare size={20}/><h3>{en?'Improve with ChatGPT':'Perluas lewat ChatGPT'}</h3>
     <p>{en?'Ask ChatGPT to add questions or materials via the connected MCP tools.':'Minta ChatGPT menambah soal atau materi melalui MCP yang sudah terhubung.'}</p>
     <button className="desk-primary" disabled={asking} onClick={()=>void request(`Tambahkan 5 soal baru dengan pembahasan dan label konsep untuk bank "${pack.title}" (packId ${pack.id}), gunakan append_questions dengan revisi saat ini. Jangan ubah soal lama; tanyakan tujuan belajar bila belum jelas.`)}><MessageSquare size={17}/>{en?'Add questions':'Tambah soal'}</button>
     <button className="desk-secondary" disabled={asking} onClick={()=>void request(`Buat ringkasan pembelajaran untuk bank "${pack.title}" (packId ${pack.id}), lalu simpan sebagai material/insight melalui create_artifact dengan revisi yang benar.`)}>{en?'Add material':'Tambah materi'}</button>
     </div>}
    {feedback&&<p className="v3-handoff-status" role="status">{feedback}</p>}
   </aside>
  </div>
  <p className="v3-workspace-footnote"><CheckCircle2 size={16}/>{en?'Noodl saves actual attempts; requesting ChatGPT does not mean a new bank revision exists.':'Noodl menyimpan sesi asli; mengirim permintaan ke ChatGPT belum berarti revisi bank baru sudah tersimpan.'}</p>
 </motion.section>;
}
