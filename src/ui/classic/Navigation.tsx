import {useEffect, useRef, useState} from 'react';
import {Home, FolderOpen, Settings, Brain, Shuffle, MessageSquare, Sparkles, BookOpen, Grid, X, Globe, Network} from 'lucide-react';

export type WorkspaceView = 'home'|'library'|'mix'|'review'|'public'|'settings';
export type ToolTab = 'material'|'graph'|'visual';
export type Locale = 'id'|'en';

/** Adapts upstream Navigation to the account client without importing its old store. */
export function Navigation({view,locale,onNavigate,onChat,onTool}:{
  view:WorkspaceView;locale:Locale;onNavigate:(view:WorkspaceView)=>void;onChat:()=>void;onTool:(tab:ToolTab)=>void;
}) {
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const id=locale==='id';
  const tabs=[
    {view:'home',Icon:Home,label:id?'Beranda':'Home'},
    {view:'mix',Icon:Shuffle,label:'Mix'},
    {view:'review',Icon:Brain,label:'Sync'},
    {view:'library',Icon:FolderOpen,label:id?'File':'Files'},
    {view:'settings',Icon:Settings,label:id?'Setelan':'Settings'},
  ] as const;
  const routes=[
    ...tabs.map(t=>({...t,action:()=>onNavigate(t.view),description:({home:id?'Pilih materi dan mulai latihan':'Choose material and practice',mix:id?'Campurkan bank soal':'Combine question banks',review:id?'Ulangi kartu sesuai jadwal':'Review scheduled cards',library:id?'Bank soal dan hasil belajarmu':'Your banks and study results',settings:id?'Tema, bahasa, dan akun':'Theme, language and account'})[t.view]})),
    {view:'chat',Icon:MessageSquare,label:'ChatGPT',description:id?'Buat soal atau bahas konsep':'Create questions or discuss concepts',action:onChat},
    {view:'visual',Icon:Sparkles,label:'Visual Lab',description:id?'Buka visualisasi interaktif':'Open interactive visualizations',action:()=>onTool('visual')},
    {view:'material',Icon:BookOpen,label:id?'Materi':'Materials',description:id?'Baca materi dan insight':'Read materials and insights',action:()=>onTool('material')},
    {view:'graph',Icon:Network,label:id?'Peta konsep':'Concept map',description:id?'Jelajahi hubungan konsep':'Explore concept connections',action:()=>onTool('graph')},
    {view:'public',Icon:Globe,label:id?'Jelajahi':'Explore',description:id?'Salin bank yang dibagikan':'Copy shared question banks',action:()=>onNavigate('public')},
  ];
  useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
  return <>
    <nav className="classic-nav" aria-label={id?'Navigasi utama':'Primary navigation'}>
      <div className="classic-nav-inner">{tabs.map(({view:key,Icon,label})=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>onNavigate(key)}><Icon size={20} strokeWidth={view===key?2.5:2}/><span>{label}</span></button>)}
        <button ref={trigger} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Grid size={20}/><span>{id?'Lainnya':'More'}</span></button>
      </div>
    </nav>
    <dialog ref={dialog} className="classic-dialog" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}} aria-labelledby="classic-hub-title">
      <header className="classic-dialog-header"><div><h2 id="classic-hub-title">{id?'Lompat cepat':'Quick jump'}</h2><p>{id?'Semua ruang belajarmu, satu tempat.':'All your study spaces, in one place.'}</p></div><button className="classic-icon" autoFocus onClick={close} aria-label={id?'Tutup':'Close'}><X/></button></header>
      <div className="classic-hub-grid">{routes.map(({view:key,Icon,label,description,action})=><button key={key} onClick={()=>{close();action();}}><Icon size={24}/><strong>{label}</strong><span>{description}</span></button>)}</div>
    </dialog>
  </>;
}
