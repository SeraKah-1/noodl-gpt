import {useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {Home,FolderOpen,Settings,Brain,MessageSquare,Globe,Grid,X} from 'lucide-react';

export type WorkspaceView='home'|'library'|'mix'|'review'|'public'|'settings';
export type ToolTab='material'|'graph'|'visual'|'comic';
export type Locale='id'|'en';

/** The three recurring jobs stay in primary navigation. Tools belong to the selected bank. */
export function Navigation({view,locale,onNavigate,onChat}:{
 view:WorkspaceView;locale:Locale;onNavigate:(view:WorkspaceView)=>void;onChat:()=>void;onTool:(tab:ToolTab)=>void;
}){
 const [open,setOpen]=useState(false);
 const reduced=useReducedMotion() || (typeof document!=='undefined'&&document.documentElement.dataset.reducedMotion==='true');
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const id=locale==='id';
 const tabs=[
  {view:'home' as const,Icon:Home,label:id?'Hari ini':'Today'},
  {view:'library' as const,Icon:FolderOpen,label:id?'Library':'Library'},
  {view:'review' as const,Icon:Brain,label:'Review'}
 ];
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
 const current=view==='mix'||view==='public'?'library':view;
 const more=[
  {key:'public',Icon:Globe,label:id?'Bank publik':'Public banks',desc:id?'Cari dan salin bank yang dibagikan':'Browse and copy shared banks',action:()=>onNavigate('public')},
  {key:'settings',Icon:Settings,label:id?'Pengaturan':'Settings',desc:id?'Tema, bahasa, akun dan sinkronisasi':'Theme, language, account and sync',action:()=>onNavigate('settings')},
  {key:'chat',Icon:MessageSquare,label:'ChatGPT',desc:id?'Buat bank atau bahas konsep di percakapan':'Create banks or discuss topics in chat',action:onChat}
 ];
 return <>
  <nav className="classic-nav desk-nav" aria-label={id?'Navigasi utama':'Primary navigation'}>
   <div className="classic-nav-inner">{tabs.map(({view:key,Icon,label})=><button className="v3-nav-tab" key={key} aria-current={current===key?'page':undefined} onClick={()=>onNavigate(key)}>
    {current===key&&!reduced&&<motion.span className="v3-nav-indicator" layoutId="v3-main-nav-indicator" transition={{type:'spring',stiffness:460,damping:42}} aria-hidden="true"/>}
    <Icon size={20} strokeWidth={current===key?2.5:2}/><span>{label}</span>
   </button>)}
    <button className="v3-nav-tab" ref={trigger} aria-haspopup="dialog" aria-expanded={open} aria-current={view==='settings'?'page':undefined} onClick={()=>setOpen(true)}>
     {view==='settings'&&!reduced&&<motion.span className="v3-nav-indicator" layoutId="v3-main-nav-indicator" transition={{type:'spring',stiffness:460,damping:42}} aria-hidden="true"/>}
     <Grid size={20}/><span>{id?'Lainnya':'More'}</span>
    </button>
   </div>
  </nav>
  <dialog ref={dialog} className="classic-dialog desk-dialog" aria-labelledby="desk-hub-title" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
   <header className="classic-dialog-header"><div><h2 id="desk-hub-title">{id?'Ruang lainnya':'More spaces'}</h2><p>{id?'Fitur lain, tanpa memenuhi halaman utama.':'Other functions without crowding your desk.'}</p></div><button className="classic-icon" autoFocus onClick={close} aria-label={id?'Tutup':'Close'}><X/></button></header>
   <div className="desk-more-list">{more.map(({key,Icon,label,desc,action})=><button key={key} onClick={()=>{close();action();}}><Icon size={21}/><span><strong>{label}</strong><small>{desc}</small></span></button>)}</div>
  </dialog>
 </>;
}
