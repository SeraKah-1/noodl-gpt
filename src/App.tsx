import {PackDetail} from './ui/PackDetail';
import {StudyDeskSkeleton,CatalogSkeleton} from './ui/StudyDeskSkeleton';
import {StudyCalendar} from './ui/StudyPlanning';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowRight,BookOpen,BrainCircuit,Check,Cloud,CloudOff,Download,Folder,Layers,LogOut,Plus,Search,Shuffle,Sparkles,Trash2,RefreshCw,Play,ChevronRight,Globe,MoreHorizontal,X} from 'lucide-react';
import {client} from './client/index';
import {isEmbedded,requestTutor,sendChatRequest} from './client/bridge';
import {createAttempt,itemsToRetry,missedReviewEvents,progressFor} from './shared/engine';
import type {Attempt,Pack,Publication,StudyOptions} from './shared/types';
import {MAX_REQUEST_BYTES,type PackInput} from './shared/validation';
import {BankEditor} from './ui/BankEditor';
import {BankBackup} from './ui/BankBackup';
import {firstProbe,singleQuestion} from './shared/practice';
import {GastricDebugger} from './ui/GastricDebugger';
import {BatchQuiz} from './ui/BatchQuiz';
import {StudyPlayer,Flashcards,Results} from './ui/Study';
import {LearningTools,ReviewDashboard,ExportMenu} from './ui/Tools';
import {applyWorkspacePreferences,getThemeList,type ThemeName} from './ui/theme';
import {defaultPreferences,type Preferences} from './shared/preferences';
import './ui/App.css';

import {Navigation,type WorkspaceView as View,type ToolTab} from './ui/classic/Navigation';
import {Home as ClassicHome} from './ui/classic/Home';
import {StudyOptions as StudyModeOptions} from './ui/classic/StudyOptions';
import {ToolPicker} from './ui/classic/ToolPicker';
import './ui/classic/Classic.css';
import './ui/StudyDesk.css';
const words={id:{home:'Beranda',library:'Bank soal',mix:'Mix Room',review:'Neuro-Sync',public:'Jelajahi',settings:'Pengaturan',create:'Buat lewat ChatGPT',search:'Cari bank atau topik…',all:'Semua folder',study:'Mulai belajar',cards:'Flashcard',tools:'Alat belajar',empty:'Ruang buat ide-ide yang nempel.',emptyBody:'Buat soal, impor JSON, atau salin bank yang dibagikan.',welcome:'Sedikit latihan. Banyak yang nyangkut.',welcomeBody:'Soal dari percakapanmu. Tempat untuk benar-benar memahaminya.',packs:'Bank soal',attempts:'Sesi selesai',accuracy:'Akurasi jawaban',due:'Kartu perlu diulang',latest:'Lanjutkan perjalananmu',questions:'soal',offline:'Simpan offline',downloaded:'Tersimpan offline',rename:'Nama dan folder',remove:'Hapus',publish:'Bagikan salinan',recent:'Terbaru',alphabet:'Nama A–Z',low:'Nilai terendah',unplayed:'Belum dikerjakan',allPacks:'Semua bank',resume:'Lanjutkan sesi',close:'Tutup',save:'Simpan',cancel:'Batal',folder:'Folder',title:'Nama bank',mode:'Mode latihan',shuffle:'Acak soal dan opsi',retention:'Sisipkan pengulangan',mixed:'Variasikan tipe soal',start:'Mulai kuis',choose:'Pilih bank untuk dicampur',mixBody:'Gabungkan beberapa topik. Satu latihan, sudut pandang baru.',selected:'bank dipilih',loading:'Menyiapkan ruang belajarmu…',sign:'Masuk dengan ChatGPT',signBody:'Bank soal dan progresmu tersimpan untuk akunmu, di website maupun ChatGPT.',sync:'Sinkronkan',online:'Tersambung',offlineState:'Sedang offline',pending:'perubahan menunggu',conflict:'Ada perubahan dari perangkat lain.',server:'Pakai versi server',copy:'Simpan versi lokal sebagai salinan',appearance:'Suasana belajarmu',language:'Bahasa',account:'Akun',logout:'Keluar dan kunci data lokal',request:'Buat bank soal baru. Sertakan pembahasan, hint, dan konsep untuk setiap soal.',shared:'Bank yang dibagikan',sharedBody:'Salin bank pilihan ke perpustakaanmu. Progres dimulai dari nol.',copyPack:'Salin ke bank saya',emptyShared:'Belum ada bank dibagikan.',theme:'Tema',saved:'Tersimpan',deleteConfirm:'Hapus bank ini? Riwayat sesi tetap tersimpan.',noResults:'Tidak ada bank yang cocok.',newHere:'Mulai dari percakapan.',hint:'Contoh: “Buat 20 soal fisiologi jantung, campurkan pilihan ganda dan isian, lalu simpan ke Noodl.”'},en:{home:'Home',library:'Question banks',mix:'Mix Room',review:'Neuro-Sync',public:'Explore',settings:'Settings',create:'Create with ChatGPT',search:'Search banks or topics…',all:'All folders',study:'Start studying',cards:'Flashcards',tools:'Study tools',empty:'A little room for big ideas.',emptyBody:'Create questions, import JSON, or copy a shared bank.',welcome:'A little practice. A lot that sticks.',welcomeBody:'Questions from your conversation. A place to really understand them.',packs:'Question banks',attempts:'Completed sessions',accuracy:'Answer accuracy',due:'Cards due',latest:'Keep your momentum',questions:'questions',offline:'Save offline',downloaded:'Available offline',rename:'Name and folder',remove:'Delete',publish:'Share a copy',recent:'Most recent',alphabet:'Name A–Z',low:'Lowest score',unplayed:'Not studied',allPacks:'All banks',resume:'Resume session',close:'Close',save:'Save',cancel:'Cancel',folder:'Folder',title:'Bank title',mode:'Study mode',shuffle:'Shuffle questions and options',retention:'Include spaced repeats',mixed:'Vary question types',start:'Start quiz',choose:'Choose banks to mix',mixBody:'Combine a few topics. One practice, a fresh perspective.',selected:'banks selected',loading:'Preparing your study space…',sign:'Sign in with ChatGPT',signBody:'Your question banks and progress belong to your account, on the website and in ChatGPT.',sync:'Sync now',online:'Connected',offlineState:'Offline',pending:'changes pending',conflict:'Another device has changed this content.',server:'Use server version',copy:'Save local version as a copy',appearance:'Make yourself comfortable',language:'Language',account:'Account',logout:'Sign out and lock local data',request:'Create a new question bank. Include explanations, hints, and concepts for each question.',shared:'Shared question banks',sharedBody:'Copy a bank into your library. Start with a fresh learning history.',copyPack:'Copy to my library',emptyShared:'No banks have been shared yet.',theme:'Theme',saved:'Saved',deleteConfirm:'Delete this bank? Your session history will remain.',noResults:'No matching banks.',newHere:'Start with a conversation.',hint:'Try: “Create 20 cardiac physiology questions with multiple choice and fill in the blanks, then save them to Noodl.”'}};

export default function App(){
 const state=useSyncExternalStore(client.subscribe,client.getState);
 const [toolTab,setToolTab]=useState<ToolTab>('material'),[toolPicker,setToolPicker]=useState<ToolTab|null>(null);
 const seenAttempts=useRef(new Set<string>());
 const [ready,setReady]=useState(false),[lang,setLang]=useState<'id'|'en'>('id'),[theme,setTheme]=useState<ThemeName>('default'),[view,setView]=useState<View>('home'),[query,setQuery]=useState(''),[folder,setFolder]=useState(''),[sort,setSort]=useState('recent'),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<string[]>([]),[launch,setLaunch]=useState<Pack|null>(null),[editing,setEditing]=useState<Pack|null>(null),[active,setActive]=useState<Attempt|null>(null),[flash,setFlash]=useState<Pack|null>(null),[tools,setTools]=useState<Pack|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[publications,setPublications]=useState<Publication[]>([]);
 const [debuggerOpen,setDebuggerOpen]=useState(false);
 const [autoPack,setAutoPack]=useState<string|null>(null);
 const [bankEditor,setBankEditor]=useState<Pack|'new'|null>(null);
 const [focusedPackId,setFocusedPackId]=useState<string|null>(null);
 const [shareLink,setShareLink]=useState('');
 const sharePanel=useRef<HTMLElement>(null);
 const linkParams=new URLSearchParams(location.search);
 const sharedId=useRef(isEmbedded()?null:linkParams.get('bank'));
 const visualPackId=useRef(isEmbedded()||linkParams.has('bank')||linkParams.get('tool')!=='visual'?null:linkParams.get('pack'));
 const [catalogState,setCatalogState]=useState<'loading'|'ready'|'error'>('loading');
 const [catalogRetry,setCatalogRetry]=useState(0);
 const showLibraryCatalog=view==='library'&&state.packs.length===0;
 const showCatalog=view==='public'||showLibraryCatalog;
 const [sharedBank,setSharedBank]=useState<Publication|null>(null);
 const [options,setOptions]=useState<StudyOptions>({mode:'STANDARD',shuffle:true,retention:false,mixed:false});
 const w=words[lang];
 useEffect(()=>{if(shareLink)sharePanel.current?.focus();},[shareLink]);
 useEffect(()=>{void client.initialize().finally(()=>setReady(true));},[]);
 useEffect(()=>{const p=state.preferences;setTheme(p?.theme??'default');setLang(p?.language??'id');if(p)setOptions(p.studyOptions);applyWorkspacePreferences(p);},[state.preferences]);
 useEffect(()=>{document.documentElement.lang=lang;},[lang]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{const open=(event:Event)=>{
  const data=(event as CustomEvent).detail as {view?:string;pack?:Pack;packId?:string;id?:string;questions?:unknown;items?:unknown;status?:string;attempt?:Attempt;attemptId?:string};
  const attempt=data.attempt??(Array.isArray(data.items)&&data.id&&data.status?data as unknown as Attempt:undefined);
  if(attempt){setLaunch(null);setTools(null);setFlash(null);setActive(attempt);void client.sync();return;}
  if(data.view || attempt || data.attemptId || data.packId)setDebuggerOpen(data.view==='gastric-debugger');
  if(data.view==='gastric-debugger'){setActive(null);setFlash(null);setTools(null);setLaunch(null);return;}
  if(data.view==='autopilot'&&data.packId){
   void client.sync().then(()=>{const pack=client.getState().packs.find(p=>p.id===data.packId&&!p.deletedAt);if(pack){setActive(null);setLaunch(null);setTools(null);setAutoPack(pack.id);setFlash(pack);}});return;
  }
  if(data.attemptId){void client.sync().then(()=>{const next=client.getState().attempts.find(a=>a.id===data.attemptId);if(next)setActive(next);});return;}
  if(data.view&&['home','library','mix','review','public','settings'].includes(data.view)){setActive(null);setLaunch(null);setTools(null);setFlash(null);setView(data.view as View);return;}
  if(!data.pack&&!data.packId&&!Array.isArray(data.questions))return;
  const pack=data.pack??(data.id&&Array.isArray(data.questions)?data as unknown as Pack:undefined);setView('library');
  if(pack)setLaunch(pack);else if(data.packId)void client.sync().then(()=>{const current=client.getState().packs.find(p=>p.id===data.packId);if(current)setLaunch(current);});
 };window.addEventListener('noodl-host-update',open);return()=>window.removeEventListener('noodl-host-update',open);},[]);
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setLaunch(null);setEditing(null);setTools(null);setFlash(null);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 useEffect(()=>{
  if(!state.user||!sharedId.current)return;
  const id=sharedId.current;
  sharedId.current=null;
  setView('public');
  void client.getPublication(id).then(setSharedBank).catch(e=>setNotice(e.message));
 },[state.user?.id]);
 useEffect(()=>{
  if(!ready||!state.user||!visualPackId.current)return;
  const pack=state.packs.find(p=>p.id===visualPackId.current);
  if(!pack)return;
  visualPackId.current=null;
  setView('library');
  setToolTab('visual');
  setTools(pack);
 },[ready,state.user,state.packs]);
 useEffect(()=>{
  if(!showCatalog||!state.user||!state.online)return;
  let current=true;
  setCatalogState('loading');
  client.listPublications().then(items=>{
   if(current){setPublications(items);setCatalogState('ready');}
  }).catch(()=>{if(current)setCatalogState('error');});
  return ()=>{current=false;};
 },[showCatalog,state.user?.id,state.online,catalogRetry]);
 useEffect(()=>{
  if(active?.options.mode==='BATCH'){
    const stored=state.attempts.find(a=>a.id===active.id);
    if(stored&&stored.revision>active.revision)setActive(stored);
  }
 },[active,state.attempts]);
 useEffect(()=>{if(active&&seenAttempts.current.has(active.id)&&!state.attempts.some(a=>a.id===active.id)&&!state.pending)setActive(null);for(const a of state.attempts)seenAttempts.current.add(a.id);},[state.attempts,state.pending,active]);
 const packs=state.packs.filter(p=>!p.deletedAt),completed=state.attempts.filter(a=>a.status==='completed');
 const focusedPack=packs.find(p=>p.id===focusedPackId);
 const folders=[...new Set(packs.map(p=>p.folder).filter(Boolean))].sort();
 const historyByBank=useMemo(()=>{
  const history=new Map<string,{survival:boolean;latest?:Attempt;score:number}>();
  for(const attempt of state.attempts){
   const entry=history.get(attempt.packId)??{survival:false,score:-1};
   if(attempt.options.mode==='SURVIVAL')entry.survival=true;
   if(attempt.status==='completed'&&(!entry.latest||attempt.updatedAt>entry.latest.updatedAt)){
    entry.latest=attempt;entry.score=progressFor(attempt).score;
   }
   history.set(attempt.packId,entry);
  }
  return history;
 },[state.attempts]);
 function score(id:string){return historyByBank.get(id)?.score??-1;}
 const visible=packs.filter(pack=>{
  if(folder&&pack.folder!==folder)return false;
  if(!`${pack.title} ${pack.description} ${pack.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))return false;
  const history=historyByBank.get(pack.id);
  if(filter==='unplayed')return !history;
  if(filter==='survival')return history?.survival;
  if(filter==='low')return history?.latest&&history.score<60;
  return true;
 }).sort((a,b)=>{
  if(sort==='alphabet')return a.title.localeCompare(b.title);
  if(sort==='low')return (historyByBank.get(a.id)?.latest?score(a.id):101)-(historyByBank.get(b.id)?.latest?score(b.id):101);
  if(sort==='high')return score(b.id)-score(a.id);
  return sort==='old'?a.updatedAt.localeCompare(b.updatedAt):b.updatedAt.localeCompare(a.updatedAt);
 });
 async function run(action:()=>Promise<unknown>){setBusy(true);try{await action();}catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function start(pack:Pack,wrongOnly=false){if(!state.user)return;await client.updatePreferences({studyOptions:options});const previous=active;const selection=wrongOnly&&previous?itemsToRetry(previous).map(i=>({question:i.question,sourcePackId:i.sourcePackId})):undefined;const batchRetry=previous?.options.mode==='BATCH';
 const retryItems=batchRetry?(wrongOnly?itemsToRetry(previous):previous.items):undefined;
 const next=createAttempt(pack,batchRetry?previous.options:options,state.user.id,retryItems?.map(i=>({question:i.question,sourcePackId:i.sourcePackId}))??selection,Date.now(),batchRetry);setActive(await client.saveAttempt(next));setLaunch(null);}
 function probe(pack:Pack){
  void run(async()=>{
   const question=firstProbe(pack,state.attempts);
   if(!question)throw new Error(lang==='id'?'Cek awal perlu dua soal berbeda yang belum dijawab dengan label konsep yang sama.':'The initial check needs two unanswered questions with the same concept label.');
   setActive(await client.saveAttempt(singleQuestion(pack,question)));setLaunch(null);
  });
 }
 function ask(){const pack=packs[0];void run(()=>pack?requestTutor(pack,undefined,w.request):requestTutor({id:'',title:'Noodl',questions:[],description:'',ownerId:state.user?.id??'',folder:'',tags:[],artifacts:[],revision:0,createdAt:'',updatedAt:''},undefined,w.request));}
 async function saveAttempt(next:Attempt){
  const saved=await client.saveAttempt(next);
  setActive(saved);
  for(const event of missedReviewEvents(next,active)){
   if(packs.some(p=>p.id===event.packId&&p.questions.some(q=>q.id===event.questionId))){
    try{await client.addReview(event);}catch(e){setNotice(e instanceof Error?e.message:String(e));}
   }
  }
  return saved;
 }
 async function importBank(file:File) {
  if(file.size>MAX_REQUEST_BYTES)throw new Error(lang==='id'?'JSON maksimal 8 MB':'JSON must be at most 8 MB');
  const data=JSON.parse(await file.text());
  if(data?.version===1&&Array.isArray(data.banks)){
   if(data.banks.length>1000)throw new Error(lang==='id'?'Cadangan melebihi 1000 bank':'Backup exceeds 1000 banks');
   await client.importLocalBanks(data.banks);
  }else await client.importLocalPack(data);
 }
 function createBank(){setBankEditor('new');}
 async function saveBank(content:PackInput) {
  if(!bankEditor)return;
  if(bankEditor==='new')await client.importLocalPack(content);
  else {
   const latest=client.getState().packs.find(pack=>pack.id===bankEditor.id);
   if(!latest||latest.revision!==bankEditor.revision)throw new Error(lang==='id'?'Bank sudah berubah. Buka ulang editor untuk mengambil versi terbaru.':'This bank changed. Reopen the editor to get the latest version.');
   await client.savePack({...latest,...content});
  }
  setBankEditor(null);
  setView('library');
  setNotice(w.saved);
 }
 async function publishBank(pack:Pack) {
  if(!confirm(lang==='id'?'Terbitkan bank ini? Siapa pun bisa melihat soal, kunci jawaban, dan materi.':'Publish this bank? Anyone can see its questions, answer keys, and materials.'))return;
  const publication=await client.publishPack(pack.id);
  const url=new URL('/',location.href);
  url.searchParams.set('bank',publication.id);
  setShareLink(url.href);
 }
 async function copySharedBank(publication:Publication,study=false) {
  const pack=await client.copyPublication(publication.id);
  setSharedBank(null);
  setView('library');
  if(study)setLaunch(pack);
 }
 function navigate(next:View){setFocusedPackId(null);setLaunch(null);setFlash(null);setTools(null);setToolPicker(null);setView(next);window.scrollTo({top:0,behavior:'instant'});}
 function mix(){const chosen=packs.filter(p=>selected.includes(p.id));if(chosen.length<2||!state.user)return;const user=state.user;const selection=chosen.flatMap(p=>p.questions.map(question=>({question,sourcePackId:p.id})));const pack={...chosen[0],title:`Mix · ${chosen.map(p=>p.title).join(' + ')}`};void run(async()=>{const next=createAttempt(pack,options,user.id,selection);setActive(await client.saveAttempt(next));setSelected([]);});}
 const catalog=<>
  {!state.online?<p role="status">{lang==='id'?'Sambungkan ke internet untuk mengakses bank publik.':'Connect to the internet to access public banks.'}</p>
   :catalogState==='loading'?<CatalogSkeleton label={lang==='id'?'Memuat bank publik…':'Loading public banks…'}/>
   :catalogState==='error'?<p role="alert">{lang==='id'?'Bank publik gagal dimuat.':'Could not load public banks.'} <button className="n-button" onClick={()=>setCatalogRetry(n=>n+1)}>{lang==='id'?'Coba lagi':'Try again'}</button></p>
   :publications.length===0&&!sharedBank?<p>{w.emptyShared}</p>:null}
  {state.online&&catalogState==='ready'&&<div className="n-card-grid">{publications.filter(p=>view!=='public'||p.id!==sharedBank?.id).map(p=>
   <article className="n-panel pack-card" key={p.id}>
    <span className="pack-icon"><Globe/></span><h3>{p.title}</h3><p>{p.description}</p>
    <span className="n-muted">{p.questionCount} {w.questions}</span>
    <button className="n-button primary" disabled={busy} onClick={()=>void run(()=>copySharedBank(p,true))}>{w.study}</button>
    <button className="n-button" disabled={busy} onClick={()=>void run(()=>copySharedBank(p))}>{w.copyPack}</button>
   </article>)}</div>}
 </>;
 if(!ready)return <StudyDeskSkeleton label={w.loading}/>;
 if(!state.user)return <div className="noodl-login"><div className="mesh-bg"/><div className="noodl-login-card"><div className="brand-mark"><BrainCircuit size={34}/></div><h1>Noodl<span>✦</span></h1><p className="eyebrow">USE YOUR NOODLE</p><h2>{w.newHere}</h2><p>{w.signBody}</p><a className="n-button primary" href="/signin-with-chatgpt?returnTo=%2F" target="_top" onClick={e=>{e.preventDefault();void (isEmbedded()?client.login():client.prepareLogin().then(()=>{window.location.assign('/signin-with-chatgpt?returnTo=%2F');}));}}>{w.sign}<ArrowRight size={18}/></a><button className="n-button" disabled={busy} onClick={()=>void run(()=>client.startGuest())}>{lang==='id'?'Lanjut sebagai guest':'Continue as guest'}</button><p>{lang==='id'?'Guest bisa membuat bank dan latihan tanpa login.':'Guests can create banks and practice without signing in.'}</p>{state.error&&<p role="alert">{state.error}</p>}</div></div>;
 if(debuggerOpen)return <GastricDebugger onClose={()=>setDebuggerOpen(false)}/>;
 if(active&&active.ownerId===state.user.id)return active.status==='completed'?<Results onOpenAttempt={setActive} attempt={active} onRetry={wrong=>{const p=packs.find(p=>p.id===active.packId)??{id:active.packId,ownerId:active.ownerId,title:active.title,description:'',folder:'',tags:[],artifacts:[],questions:active.items.map(i=>i.question),revision:active.packRevision,createdAt:active.createdAt,updatedAt:active.updatedAt};void run(()=>start(p,wrong));}} key={active.id} packs={packs} attempts={state.attempts} guest={!!state.guest} onReview={event=>client.addReview(event).then(()=>{})} onClose={()=>setActive(null)}/>:active.options.mode==='BATCH'?<BatchQuiz key={active.id} attempt={active} english={lang==='en'} save={saveAttempt} onExit={()=>setActive(null)}/>:<StudyPlayer key={active.id} attempt={active} onChange={async next=>{await saveAttempt(next);}} onComplete={()=>{}} onExit={()=>setActive(null)}/>;
 if(flash?.ownerId===state.user.id)return <Flashcards key={flash.id} initialAuto={autoPack===flash.id} onOpenAttempt={a=>{setFlash(null);setAutoPack(null);setActive(a);}} pack={flash} onReview={event=>client.addReview(event).then(()=>{})} onClose={()=>{setFlash(null);setAutoPack(null);}}/>;
 return <div className="noodl-app classic-workspace"><div className="mesh-bg"/><div className="noise-bg"/>
  <Navigation view={view} locale={lang} onNavigate={navigate} onChat={ask} onTool={setToolPicker}/>
  <main className={`n-main classic-main view-${view}`}>
  <header className="classic-toolbar"><button className="classic-wordmark" onClick={()=>navigate('home')} aria-label="Noodl home">noodl<span>✦</span></button><div className="classic-account-actions"><button className="classic-account" onClick={()=>navigate('settings')}>{state.guest?'Guest':state.user.name}</button><button className="classic-icon" aria-label={lang==='id'?'Ganti ke bahasa Inggris':'Switch to Indonesian'} onClick={()=>void run(()=>client.updatePreferences({language:lang==='id'?'en':'id'}))}>{lang.toUpperCase()}</button>{!state.localOnly&&<button className="classic-icon" aria-label={w.sync} title={w.sync} disabled={state.syncing} onClick={()=>void run(()=>client.sync())}><RefreshCw size={18} className={state.syncing?'spinning':''}/></button>}</div></header>
  {state.guest&&<details className="classic-guest">
   <summary>{state.localOnly?(lang==='id'?'Guest · penyimpanan lokal':'Guest · local storage'):(lang==='id'?'Guest · penyimpanan server':'Guest · server storage')}</summary>
   {state.localOnly?<><p>{lang==='id'?'Bank tersedia di browser ini. Aktifkan penyimpanan server untuk menyalin bank dan membagikannya.':'Banks are available on this browser. Enable server storage to copy and share them.'}</p>
    <button className="n-button" disabled={busy||!state.online||isEmbedded()} onClick={()=>void run(()=>client.enableGuestStorage())}>{lang==='id'?'Aktifkan penyimpanan guest':'Enable guest storage'}</button></>
    :<p>{lang==='id'?'Akses bank privat guest mengikuti cookie di browser ini. Unduh cadangan sebelum menghapus data situs.':'Private guest banks are tied to this browser’s cookie. Download a backup before clearing site data.'}</p>}
   <a className="n-button" href="/signin-with-chatgpt?returnTo=%2F" target="_top" onClick={e=>{e.preventDefault();void run(async()=>{await client.prepareAccountLogin();window.location.assign('/signin-with-chatgpt?returnTo=%2F');});}}>{w.sign}</a>
  </details>}
  {(!state.online||state.syncing||state.pending>0)&&<div className="classic-island" role="status">{state.online?<Cloud size={16}/>:<CloudOff size={16}/>}<span>{!state.online?w.offlineState:state.syncing?(lang==='id'?'Menyinkronkan…':'Syncing…'):`${state.pending} ${w.pending}`}</span></div>}
  {state.error&&<div role="alert" className="n-error">{state.error}</div>}
  {state.conflicts.map(c=><div className="n-conflict" key={c.id}><strong>{c.failure?.code==='CONFLICT'?w.conflict:lang==='id'?'Perubahan gagal disinkronkan.':'This change could not sync.'}</strong><span>{c.failure?.error||c.operation.entityId}</span><button onClick={()=>void run(()=>client.resolveConflict(c.id,'server'))}>{w.server}</button>{c.operation.kind.startsWith('pack.')&&<button onClick={()=>void run(()=>client.resolveConflict(c.id,'copy'))}>{w.copy}</button>}</div>)}
  {view==='settings'?<section><PageTitle title={w.settings} text={w.appearance}/><div className="n-panel settings-panel"><h3>{w.theme}</h3><div className="theme-grid">{getThemeList().map(t=><button key={t.id} className={theme===t.id?'chosen':''} style={{background:t.previewColor,color:t.textColor}} onClick={()=>void run(()=>client.updatePreferences({theme:t.id}))}><span>{t.name}</span>{theme===t.id&&<Check size={18}/>}</button>)}</div><h3>{w.language}</h3><div className="n-row"><button className={`n-button ${lang==='id'?'primary':''}`} onClick={()=>void run(()=>client.updatePreferences({language:'id'}))}>Bahasa Indonesia</button><button className={`n-button ${lang==='en'?'primary':''}`} onClick={()=>void run(()=>client.updatePreferences({language:'en'}))}>English</button></div><DesignControls preferences={state.preferences??{...defaultPreferences(),id:'workspace',ownerId:state.user.id,revision:0,updatedAt:''}} onSave={patch=>client.updatePreferences(patch)} pending={state.preferencesPending??false} conflict={state.preferencesConflict??false} onUseServer={()=>client.useServerPreferences()}/>{!isEmbedded()&&!state.localOnly&&<BankBackup key={state.user.id} locale={lang} ownerId={state.user.id} online={state.online}/>}<h3>{lang==='id'?'Ekspor jadwal belajar':'Export study schedule'}</h3><StudyCalendar english={lang==='en'}/><h3>{w.account}</h3><p>{state.user.name}{state.user.email?' · '+state.user.email:''}</p>{state.guest&&!state.localOnly&&<button className="n-button" onClick={()=>void run(()=>client.useLocalGuest())}>{lang==='id'?'Buka ruang guest lokal':'Open local guest workspace'}</button>}<button className="n-button" onClick={()=>void run(async()=>{await client.logout();if(!state.guest&&!isEmbedded())window.location.assign('/signout-with-chatgpt?returnTo=%2F');})}><LogOut size={17}/>{w.logout}</button><p className="n-muted">{state.lastSync?`${lang==='id'?'Sinkronisasi terakhir':'Last sync'}: ${new Date(state.lastSync).toLocaleString()}`:''}</p></div></section>:
  view==='review'?<><PageTitle title="Neuro-Sync" text={lang==='id'?'Sedikit diulang, lebih lama diingat.':'Review a little. Remember longer.'}/><ReviewDashboard packs={packs} reviews={state.reviews} onReview={event=>client.addReview(event).then(()=>{})}/></>:
  view==='public'?<><PageTitle title={w.shared} text={w.sharedBody}/>
    {sharedBank&&<section className="n-panel settings-panel">
      <h3>{sharedBank.title}</h3><p>{sharedBank.description}</p>
      <p>{sharedBank.questionCount} {w.questions}</p>
      <div className="n-row">
        <button className="n-button primary" disabled={busy||!state.online} onClick={()=>void run(()=>copySharedBank(sharedBank,true))}>{w.study}</button>
        <button className="n-button" disabled={busy||!state.online} onClick={()=>void run(()=>copySharedBank(sharedBank))}>{w.copyPack}</button>
      </div>
    </section>}
    {catalog}</>:
  view==='library'&&focusedPack?<PackDetail pack={focusedPack} attempts={state.attempts} locale={lang} busy={busy} onBack={()=>setFocusedPackId(null)} onPractice={()=>setLaunch(focusedPack)} onFlashcards={()=>{setAutoPack(null);setFlash(focusedPack);}} onTool={tab=>{setToolTab(tab);setTools(focusedPack);}} onEdit={()=>setBankEditor(focusedPack)} onRename={()=>setEditing(focusedPack)} onPublish={()=>void run(()=>publishBank(focusedPack))} onUnpublish={()=>void run(async()=>{await client.unpublishPack(focusedPack.id);setNotice(lang==='id'?'Publikasi dicabut.':'Publication removed.');})} onDelete={()=>{if(confirm(w.deleteConfirm))void run(async()=>{await client.deletePack(focusedPack);setFocusedPackId(null);});}} onOpenAttempt={setActive}/>:
  <>{view==='home'?<ClassicHome reviews={state.reviews} onOpenPack={p=>{setFocusedPackId(p.id);setView('library');}} onProbe={probe} onDebugger={()=>setDebuggerOpen(true)} locale={lang} packs={packs} attempts={state.attempts} options={options} busy={busy} onOptions={setOptions} onStart={p=>void run(()=>start(p))} onFlash={p=>{setAutoPack(null);setFlash(p);}} onResume={setActive} onLibrary={()=>navigate('library')} onReview={()=>navigate('review')} onImport={importBank} onCreate={createBank} onBrainDump={()=>void run(async()=>{
     await sendChatRequest(lang==='id'?'Bantu aku latihan Brain Dump di Noodl. Minta aku unggah PPT di chat ini. Tawarkan per slide atau per topik, lalu gunakan start_brain_dump dan tunggu penjelasanku sebelum memberi umpan balik.':'Help me practice Brain Dump in Noodl. Ask me to attach my slides here. Offer per-slide or per-topic recall, then use start_brain_dump and wait for my explanation before giving feedback.');
     setNotice(isEmbedded()?'Brain Dump · ChatGPT':lang==='id'?'Tempel permintaan di ChatGPT, lalu lampirkan PPT.':'Paste the request in ChatGPT and attach your slides.');
   })} onChat={message=>void run(async()=>{
    await sendChatRequest(state.guest?message+' Berikan juga bank JSON Noodl yang bisa saya impor ke workspace guest melalui File.':message);
    setNotice(isEmbedded()?(lang==='id'?'Permintaan dikirim ke ChatGPT.':'Request sent to ChatGPT.'):(lang==='id'?'Tempel permintaan yang sudah disalin ke ChatGPT.':'Paste the copied request into ChatGPT.'));
   })}/>:<>
  <PageTitle title={view==='mix'?w.choose:w.library} text={view==='mix'?w.mixBody:undefined} action={view!=='mix'?<button className="n-button primary" onClick={createBank}><Plus size={17}/>{lang==='id'?'Buat bank soal':'Create question bank'}</button>:<button className="n-button primary" disabled={!selected.length||busy} onClick={mix}><Shuffle size={17}/>{selected.length} {w.selected}<ArrowRight size={17}/></button>}/>
  {view==='library'&&<div className="classic-library-bar"><div className="classic-input-tabs"><button aria-pressed="true">{lang==='id'?'Bank saya':'My banks'}</button><button aria-pressed="false" onClick={()=>navigate('public')}>{lang==='id'?'Bank publik':'Public banks'}</button></div><label className="classic-secondary classic-upload-label"><Download size={17}/>{lang==='id'?'Impor JSON':'Import JSON'}<input type="file" accept=".json,application/json" aria-label={lang==='id'?'Impor bank JSON':'Import JSON bank'} onChange={e=>{const f=e.target.files?.[0];if(f)void run(()=>importBank(f));e.target.value='';}}/></label>{selected.length>=2&&<button className="desk-primary" disabled={busy} onClick={mix}><Shuffle size={17}/>{lang==='id'?'Latihan campuran':'Mix practice'} · {selected.length}</button>}</div>}
  {showLibraryCatalog?<section>
   <h2>{lang==='id'?'Bank publik':'Public banks'}</h2>
   <p>{state.guest?(lang==='id'?'Belajar sebagai guest atau salin bank ke File. Untuk melihat bank privat dari ChatGPT, masuk dengan akun pembuatnya.':'Study as a guest or copy a bank to Files. Sign in with the account that created your private ChatGPT banks to see them here.')
    :(lang==='id'?'Belum ada bank di akun ini. Pilih bank publik untuk mulai belajar.':'No banks in this account yet. Choose a public bank to start studying.')}</p>
   {state.guest&&!isEmbedded()&&<button className="n-button" onClick={()=>void run(async()=>{await client.prepareAccountLogin();window.location.assign('/signin-with-chatgpt?returnTo=%2F');})}>{w.sign}</button>}
   {catalog}
  </section>:<>
  <div className="n-library-controls"><label className="n-search"><Search size={18}/><input aria-label={w.search} placeholder={w.search} value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label={w.folder} value={folder} onChange={e=>setFolder(e.target.value)}><option value="">{w.all}</option>{folders.map(f=><option key={f}>{f}</option>)}</select><select aria-label="Sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">{w.recent}</option><option value="alphabet">{w.alphabet}</option><option value="low">{w.low}</option><option value="high">{lang==='id'?'Nilai tertinggi':'Highest score'}</option><option value="old">{lang==='id'?'Terlama':'Oldest'}</option></select></div><div className="n-filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>{w.allPacks}<span>{packs.length}</span></button><button className={filter==='unplayed'?'active':''} onClick={()=>setFilter('unplayed')}>{w.unplayed}</button><button className={filter==='survival'?'active':''} onClick={()=>setFilter('survival')}>Survival</button><button className={filter==='low'?'active':''} onClick={()=>setFilter('low')}>{lang==='id'?'Nilai < 60%':'Score < 60%'}</button></div>
  {!visible.length?<Empty title={packs.length?w.noResults:w.empty} text={packs.length?'':w.emptyBody} action={!packs.length?<><button className="n-button primary" onClick={createBank}>{lang==='id'?'Buat bank soal':'Create question bank'}</button></>:undefined}/>:<div className="n-card-grid desk-library-grid">{visible.map((p,i)=><article className={`n-panel pack-card ${selected.includes(p.id)?'selected':''}`} key={p.id}><div className="pack-heading"><span className={`pack-icon tint-${i%4}`}><BookOpen size={23}/></span>{view==='library'&&<input type="checkbox" aria-label={`${lang==='id'?'Pilih untuk campuran':'Select for mix'}: ${p.title}`} checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>} {view==='mix'?<input type="checkbox" aria-label={p.title} checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>:<details className="pack-menu"><summary aria-label="Actions"><MoreHorizontal size={20}/></summary><div><button onClick={()=>setBankEditor(p)}>{lang==='id'?'Edit soal':'Edit questions'}</button><button onClick={()=>setEditing(p)}>{w.rename}</button><button disabled={!state.online||busy} onClick={()=>void run(()=>publishBank(p))}>{w.publish}</button><button disabled={!state.online||busy||state.localOnly} onClick={()=>void run(async()=>{await client.unpublishPack(p.id);setShareLink('');setNotice(lang==='id'?'Salinan berbagi dicabut.':'Shared copy removed.');})}>{lang==='id'?'Cabut salinan berbagi':'Unpublish shared copy'}</button><button className="danger" onClick={()=>{if(confirm(w.deleteConfirm))void run(()=>client.deletePack(p));}}><Trash2 size={14}/>{w.remove}</button></div></details>}</div><small className="pack-folder"><Folder size={12}/>{p.folder||'Workspace'}</small><h3>{p.title}</h3><p>{p.description||p.tags.join(' · ')}</p><div className="pack-meta"><span>{p.questions.length} {w.questions}</span><span>{score(p.id)>=0?`${score(p.id)}%`:w.unplayed}</span></div>{view!=='mix'&&<><button className="n-button primary pack-start" onClick={()=>setFocusedPackId(p.id)}>{lang==='id'?'Buka bank':'Open bank'}<ArrowRight size={16}/></button></>}</article>)}</div>}
  </>}
  </>}</>}
  {shareLink&&<section ref={sharePanel} tabIndex={-1} className="n-panel settings-panel" aria-label={lang==='id'?'Tautan publik':'Public link'}>
   <h3>{lang==='id'?'Bank sudah publik':'Bank published'}</h3>
   <p><a href={shareLink} target="_blank" rel="noreferrer">{lang==='id'?'Buka bank publik':'Open public bank'}</a></p>
   <div className="n-row">
    <button className="n-button" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(shareLink);setNotice(lang==='id'?'Tautan disalin.':'Link copied.');})}>{lang==='id'?'Salin tautan':'Copy link'}</button>
    <button className="n-button" onClick={()=>setShareLink('')}>{w.close}</button>
   </div>
  </section>}
  <footer className="n-footer"><BrainCircuit size={15}/> Noodl · use your noodle.<span>{lang==='id'?'Dibuat untuk memahami, bukan sekadar mengingat.':'Made for understanding, one question at a time.'}</span></footer></main>
  {bankEditor&&<BankEditor pack={bankEditor==='new'?undefined:bankEditor} locale={lang} onClose={()=>setBankEditor(null)} onSave={saveBank}/>}
  {launch&&<div className="n-modal-backdrop"><section className="n-modal" role="dialog" aria-modal="true" aria-label={w.mode}><button className="n-modal-close" aria-label={w.close} onClick={()=>setLaunch(null)}><X/></button><span className="pack-icon"><Play/></span><h2>{launch.title}</h2><p>{launch.questions.length} {w.questions} · {w.mode}</p><button className="study-secondary" disabled={busy} onClick={()=>probe(launch)}>{lang==='id'?'Cek awal · 1 soal':'Initial check · 1 question'}</button><StudyModeOptions questionCount={launch.questions.length} value={options} onChange={setOptions} locale={lang}/><button className="n-button primary" disabled={busy} onClick={()=>void run(()=>start(launch))}>{w.start}<ArrowRight size={18}/></button></section></div>}
  {editing&&<div className="n-modal-backdrop"><form className="n-modal" role="dialog" aria-modal="true" onSubmit={e=>{e.preventDefault();void run(async()=>{await client.renamePack(editing.id,editing.ownerId,{title:editing.title,folder:editing.folder});setEditing(null);});}}><h2>{w.rename}</h2><label>{w.title}<input required maxLength={200} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label><label>{w.folder}<input maxLength={200} list="folders" value={editing.folder} onChange={e=>setEditing({...editing,folder:e.target.value})}/></label><datalist id="folders">{folders.map(f=><option key={f}>{f}</option>)}</datalist><div className="n-row"><button className="n-button" type="button" onClick={()=>setEditing(null)}>{w.cancel}</button><button className="n-button primary" disabled={busy}>{w.save}</button></div></form></div>}
  {tools?.ownerId===state.user.id&&<div className="n-fullscreen"><LearningTools key={`${tools.id}:${toolTab}`} initialTab={toolTab} pack={tools} attempts={state.attempts.filter(a=>a.packId===tools.id)} onClose={()=>setTools(null)}/></div>}
  <ToolPicker tab={toolPicker} packs={packs} locale={lang} onClose={()=>setToolPicker(null)} onLibrary={()=>navigate('library')} onSelect={p=>{setToolTab(toolPicker??'material');setToolPicker(null);setTools(p);}}/>
  {notice&&<div className="n-toast" role="alert">{notice}<button aria-label={w.close} onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>;
}
function PageTitle({title,text,action}:{title:string;text?:string;action?:React.ReactNode}){return <div className="n-section-title"><div><h2>{title}</h2>{text&&<p>{text}</p>}</div>{action}</div>;}
function Empty({title,text,action}:{title:string;text:string;action?:React.ReactNode}){return <div className="n-panel n-empty"><span className="empty-doodle">( ◕ ‿ ◕ )</span><h2>{title}</h2><p>{text}</p>{action}</div>;}

function DesignControls({preferences,onSave,pending,conflict,onUseServer}:{preferences:import('./shared/preferences').WorkspacePreferences;onSave:(p:Partial<Preferences>)=>Promise<void>;pending:boolean;conflict:boolean;onUseServer:()=>Promise<void>}){
 const [draft,setDraft]=useState(preferences.design),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>setDraft(preferences.design),[preferences.revision,preferences.updatedAt]);
 async function save(){setSaving(true);setError('');setSaved(false);try{await onSave({design:draft});setSaved(true);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}}
 return <section className="n-design-controls"><h3>{preferences.language==='en'?'Design system':'Sistem desain'}</h3><p className="n-muted">{preferences.language==='en'?'These settings also follow design changes requested in ChatGPT.':'Pengaturan ini mengikuti perubahan desain yang lo minta di ChatGPT.'}</p><div className="n-design-fields">
 {(['accent','background','surface','text','muted','border'] as const).map(key=><label key={key}>{key}<input type="text" placeholder="#123456" pattern="#[0-9a-fA-F]{6}" value={draft[key]??''} onChange={e=>{const value=e.target.value;setDraft({...draft,[key]:value||null});}}/></label>)}
 <label>Radius <input type="range" min="0" max="32" value={draft.radius} onChange={e=>setDraft({...draft,radius:Number(e.target.value)})}/><output>{draft.radius}px</output></label>
 <label>Density<select value={draft.density} onChange={e=>setDraft({...draft,density:e.target.value as typeof draft.density})}>{['compact','comfortable','spacious'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Font scale<input type="range" min="0.85" max="1.35" step="0.05" value={draft.fontScale} onChange={e=>setDraft({...draft,fontScale:Number(e.target.value)})}/><output>{draft.fontScale.toFixed(2)}×</output></label>
 <label>Content width<input type="number" min="640" max="1800" step="20" value={draft.contentWidth} onChange={e=>setDraft({...draft,contentWidth:Number(e.target.value)})}/></label>
 <label>Cards<select value={draft.cardLayout} onChange={e=>setDraft({...draft,cardLayout:e.target.value as 'grid'|'list'})}><option value="grid">Grid</option><option value="list">List</option></select></label>
 <label className="n-check"><input type="checkbox" checked={draft.reduceMotion} onChange={e=>setDraft({...draft,reduceMotion:e.target.checked})}/> Reduce motion</label></div>
 <div className="n-row"><button className="n-button primary" disabled={saving} onClick={()=>void save()}>{saving?'…':preferences.language==='en'?'Save design':'Simpan desain'}</button><button className="n-button" onClick={()=>setDraft({...defaultPreferences().design,accent:null,background:null,surface:null,text:null,muted:null,border:null})}>{preferences.language==='en'?'Reset fields':'Reset isian'}</button>{pending&&<span role="status">{preferences.language==='en'?'Changes waiting to sync':'Perubahan menunggu sinkronisasi'}</span>}</div>
 {saved&&!pending&&!conflict&&<p role="status">{preferences.language==='en'?'Design saved.':'Desain tersimpan.'}</p>}{error&&<p role="alert" className="n-error">{error}</p>}{conflict&&<div className="n-conflict" role="alert"><span>Pengaturan di server sudah berubah. Perubahan lokal tetap disimpan.</span><button onClick={()=>void onUseServer().catch(e=>setError(String(e)))}>Muat pengaturan server</button></div>}</section>;
}
