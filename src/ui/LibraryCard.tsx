import {ArrowUpRight} from 'lucide-react';
import type {Pack} from '../shared/types';
import type {Locale} from './classic/Navigation';

export function LibraryCard({pack,index,score,selected,onSelect,onOpen,locale}:{
 pack:Pack;index:number;score:number;selected:boolean;onSelect:(value:boolean)=>void;onOpen:()=>void;locale:Locale;
}){
 const id=locale==='id';
 return <article className={`desk-library-card ${selected?'is-selected':''}`}>
  <label className="desk-library-select" title={id?'Pilih untuk Mix':'Select for Mix'}>
   <input type="checkbox" checked={selected} onChange={e=>onSelect(e.target.checked)} aria-label={`${id?'Pilih untuk latihan campuran':'Select for mixed practice'}: ${pack.title}`}/>
  </label>
  <button className="desk-library-open" onClick={onOpen}>
   <span className="desk-library-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
   <span className="desk-library-info">
    <strong>{pack.title}</strong>
    {pack.description&&<span className="desk-library-desc">{pack.description}</span>}
    <small>{pack.folder||'Workspace'} · {pack.questions.length} {id?'soal':'questions'} · {score>=0?`${id?'Akurasi terakhir':'Latest accuracy'} ${score}%`:id?'Belum dimainkan':'Not studied yet'}</small>
   </span>
   <ArrowUpRight size={20} aria-hidden="true"/>
  </button>
 </article>;
}
