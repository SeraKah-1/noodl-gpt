import {useEffect,useRef} from 'react';
import {BookOpen,ChevronRight,X} from 'lucide-react';
import type {Pack} from '../../shared/types';
import type {Locale,ToolTab} from './Navigation';
export function ToolPicker({tab,packs,locale,onSelect,onClose,onLibrary}:{tab:ToolTab|null;packs:Pack[];locale:Locale;onSelect:(pack:Pack)=>void;onClose:()=>void;onLibrary:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const id=locale==='id';
 useEffect(()=>{if(tab&&!dialog.current?.open)dialog.current?.showModal();else if(!tab&&dialog.current?.open)dialog.current.close();},[tab]);
 return <dialog ref={dialog} className="classic-dialog" aria-labelledby="tool-picker-title" onCancel={onClose} onClose={onClose}><header className="classic-dialog-header"><div><h2 id="tool-picker-title">{tab==='visual'?'Visual Lab':tab==='graph'?(id?'Peta konsep':'Concept map'):(id?'Materi':'Materials')}</h2><p>{id?'Pilih bank soal untuk dibuka.':'Choose a question bank to open.'}</p></div><button className="classic-icon" onClick={onClose} aria-label={id?'Tutup':'Close'}><X/></button></header><div className="classic-bank-picker">{packs.map(p=><button key={p.id} className="classic-bank-choice" onClick={()=>onSelect(p)}><BookOpen/><span><strong>{p.title}</strong><small>{p.questions.length} {id?'soal':'questions'}</small></span><ChevronRight/></button>)}{!packs.length&&<div className="classic-picker-empty"><p>{id?'Tambahkan bank soal dulu untuk membuka alat belajar.':'Add a question bank to open study tools.'}</p><button className="classic-start" onClick={()=>{onClose();onLibrary();}}>{id?'Buka perpustakaan':'Open library'}</button></div>}</div></dialog>;
}
