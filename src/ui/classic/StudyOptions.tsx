import {Layout,ListChecks,Skull,Zap,SlidersHorizontal} from 'lucide-react';
import type {StudyOptions as Options} from '../../shared/types';
import type {Locale} from './Navigation';

/** A mode is a real scoring contract; advanced controls are disclosed on demand. */
export function StudyOptions({value,onChange,locale,questionCount}:{questionCount?:number;value:Options;onChange:(next:Options)=>void;locale:Locale}){
 const limit=Math.min(100,Math.max(1,questionCount??100)),id=locale==='id';
 const modes=[
  {key:'STANDARD',Icon:Layout,title:'Standard',description:id?'Satu soal, lalu pembahasan':'One question, then feedback'},
  {key:'BATCH',Icon:ListChecks,title:'Batch',description:id?'Jawab semua, periksa bersama':'Answer all, submit once'},
  {key:'SURVIVAL',Icon:Skull,title:'Survival',description:id?'Selesai setelah tiga kesalahan':'Three mistakes end the run'},
  {key:'TIME_RUSH',Icon:Zap,title:'Time Rush',description:id?'20 detik untuk tiap soal':'20 seconds per question'}
 ] as const;
 return <fieldset className="classic-options desk-study-options"><legend>{id?'Pilih mode latihan':'Choose practice mode'}</legend>
  <div className="desk-mode-grid">{modes.map(({key,Icon,title,description})=><button key={key} type="button" className="desk-mode" aria-pressed={value.mode===key} onClick={()=>onChange({...value,mode:key,...(key==='BATCH'?{retention:false}:{})})}><Icon size={21}/><strong>{title}</strong><small>{description}</small></button>)}</div>
  {value.mode==='BATCH'&&<label className="desk-batch-count">{id?'Jumlah soal':'Number of questions'} <input type="number" min={1} max={limit} value={Math.min(limit,value.batchSize??10)} onChange={e=>onChange({...value,batchSize:Math.max(1,Math.min(limit,Math.trunc(Number(e.target.value))||1))})}/></label>}
  <details className="desk-advanced"><summary><SlidersHorizontal size={17}/>{id?'Pengaturan tambahan':'Advanced settings'}</summary>
   <div className="desk-advanced-options">{(['shuffle','retention','mixed'] as const).map(key=><label key={key}><input type="checkbox" disabled={key==='retention'&&value.mode==='BATCH'} checked={key==='retention'&&value.mode==='BATCH'?false:value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span><strong>{({shuffle:id?'Acak soal dan opsi':'Shuffle questions and choices',retention:id?'Sisipkan soal berulang':'Insert repeated questions',mixed:id?'Variasikan tipe pertanyaan':'Vary question types'})[key]}</strong><small>{({shuffle:id?'Urutan berbeda setiap sesi':'A different order each session',retention:id?'Beberapa soal muncul lagi dalam satu sesi':'Some questions return in the same session',mixed:id?'Transformasi aturan, bukan penilaian AI':'Rule-based transformations, not AI grading'})[key]}</small></span></label>)}</div>
  </details>
 </fieldset>;
}
