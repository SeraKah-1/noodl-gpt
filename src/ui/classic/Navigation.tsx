import {useEffect, useRef, useState} from 'react';
import {Home, FolderOpen, Settings, Brain, Shuffle, MessageSquare, Sparkles, BookOpen, Grid, X, Globe, Network, Search} from 'lucide-react';

export type WorkspaceView = 'home'|'library'|'mix'|'review'|'public'|'settings';
export type ToolTab = 'material'|'graph'|'visual'|'comic';
export type Locale = 'id'|'en';

/** Adapts upstream Navigation to the account client without importing its old store. */
export function Navigation({view,locale,onNavigate,onChat,onTool}:{
  view:WorkspaceView;locale:Locale;onNavigate:(view:WorkspaceView)=>void;onChat:()=>void;onTool:(tab:ToolTab)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const search=useRef<HTMLInputElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const id=locale==='id';
  const tabs=[
    {view:'home',Icon:Home,label:id?'Beranda':'Home'},
    {view:'mix',Icon:Shuffle,label:'Mix'},
    {view:'review',Icon:Brain,label:id?'Ulang':'Review'},
    {view:'library',Icon:FolderOpen,label:id?'File':'Files'},
    {view:'settings',Icon:Settings,label:id?'Setelan':'Settings'},
  ] as const;
  const routes=[
    ...tabs.map(t=>({...t,action:()=>onNavigate(t.view),description:({home:id?'Pilih materi dan mulai latihan':'Choose material and practice',mix:id?'Campurkan bank soal':'Combine question banks',review:id?'Ulangi kartu sesuai jadwal':'Review scheduled cards',library:id?'Bank soal dan hasil belajarmu':'Your banks and study results',settings:id?'Tema, bahasa, dan akun':'Theme, language and account'})[t.view]})),
    {view:'chat',Icon:MessageSquare,label:'ChatGPT',description:id?'Buat soal atau bahas konsep':'Create questions or discuss concepts',action:onChat},
    {view:'comic',Icon:BookOpen,label:id?'Komik':'Comics',description:id?'Belajar lewat panel cerita':'Learn through illustrated panels',action:()=>onTool('comic')},
    {view:'visual',Icon:Sparkles,label:'Visual Lab',description:id?'Buka visualisasi interaktif':'Open interactive visualizations',action:()=>onTool('visual')},
    {view:'material',Icon:BookOpen,label:id?'Materi':'Materials',description:id?'Baca materi dan insight':'Read materials and insights',action:()=>onTool('material')},
    {view:'graph',Icon:Network,label:id?'Peta konsep':'Concept map',description:id?'Jelajahi hubungan konsep':'Explore concept connections',action:()=>onTool('graph')},
    {view:'public',Icon:Globe,label:id?'Jelajahi':'Explore',description:id?'Salin bank yang dibagikan':'Copy shared question banks',action:()=>onNavigate('public')},
  ];
  const term=query.trim().toLocaleLowerCase();
  const matches=routes.filter(route=>[route.label,route.description,route.view].some(value=>value.toLocaleLowerCase().includes(term)));
  useEffect(()=>{
    if(open&&!dialog.current?.open){dialog.current?.showModal();search.current?.focus();}
  },[open]);
  useEffect(()=>{
    function shortcut(event:KeyboardEvent){
      if(event.defaultPrevented||event.isComposing||event.altKey||event.shiftKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='k')return;
      if(document.querySelector('dialog[open],[role="dialog"][aria-modal="true"],.n-fullscreen'))return;
      event.preventDefault();setQuery('');setOpen(true);
    }
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
  return <>
    <nav className="classic-nav" aria-label={id?'Navigasi utama':'Primary navigation'}>
      <div className="classic-nav-inner">{tabs.filter(t=>t.view!=='settings').map(({view:key,Icon,label})=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>onNavigate(key)}><Icon size={20} strokeWidth={view===key?2.5:2}/><span>{label}</span></button>)}
        <button ref={trigger} aria-haspopup="dialog" aria-current={view==='settings'||view==='public'?'page':undefined} aria-expanded={open} aria-keyshortcuts="Control+k Meta+k" onClick={()=>{setQuery('');setOpen(true);}}><Grid size={20}/><span>{id?'Lainnya':'More'}</span></button>
      </div>
    </nav>
    <dialog ref={dialog} className="classic-dialog" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}} aria-labelledby="classic-hub-title">
      <header className="classic-dialog-header"><div><h2 id="classic-hub-title">{id?'Lompat cepat':'Quick jump'}</h2><p>Ctrl / ⌘ + K</p></div><button className="classic-icon" onClick={close} aria-label={id?'Tutup':'Close'}><X/></button></header>
      <label className="hub-search"><Search size={18}/><input ref={search} type="search" value={query} aria-label={id?'Cari halaman atau alat':'Search pages and tools'} placeholder={id?'Cari halaman atau alat…':'Search pages and tools…'} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&matches.length){e.preventDefault();close();matches[0].action();}}}/></label>
      {!matches.length&&<p role="status">{id?'Tidak ada hasil. Coba nama alat lain.':'No matches. Try another tool name.'}</p>}
      <div className="classic-hub-grid">{matches.map(({view:key,Icon,label,description,action})=><button key={key} onClick={()=>{close();action();}}><Icon size={24}/><strong>{label}</strong><span>{description}</span></button>)}</div>
    </dialog>
  </>;
}
