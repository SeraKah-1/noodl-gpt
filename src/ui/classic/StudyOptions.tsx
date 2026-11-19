import {Layout, ListChecks, Skull, Zap} from 'lucide-react';
import type {StudyOptions as Options} from '../../shared/types';
import type {Locale} from './Navigation';

export function StudyOptions({value,onChange,locale,questionCount}:{questionCount?:number;value:Options;onChange:(next:Options)=>void;locale:Locale}){
  const limit=Math.min(100,Math.max(1,questionCount??100));
  const id=locale==='id';
  const modes=[{key:'STANDARD',Icon:Layout,title:'Standard',description:id?'Belajar dengan ritmemu sendiri':'Learn at your own pace'},
    {key:'BATCH',Icon:ListChecks,title:'Batch Quiz',description:id?'Kerjakan satu halaman, kumpulkan bersama':'Answer on one page and submit together'},
    {key:'SURVIVAL',Icon:Skull,title:'Survival',description:id?'Tiga nyawa. Jaga ketepatanmu.':'Three lives. Stay accurate.'},
    {key:'TIME_RUSH',Icon:Zap,title:'Time Rush',description:id?'20 detik untuk setiap soal':'20 seconds per question'}] as const;
  return <fieldset className="classic-options"><legend>{id?'Mode latihan':'Practice mode'}</legend><div className="classic-mode-grid">{modes.map(({key,Icon,title,description})=><button type="button" key={key} className={`classic-mode mode-${key.toLowerCase()}`} aria-pressed={value.mode===key} onClick={()=>onChange({...value,mode:key,...(key==='BATCH'?{retention:false}:{})})}><Icon size={23}/><strong>{title}</strong><span>{description}</span></button>)}</div>
     {value.mode==='BATCH'&&<label>{id?'Jumlah soal (maksimal isi bank)':'Question count (up to bank size)'} <input type="number" min={1} max={limit} value={Math.min(limit,value.batchSize??10)} onChange={e=>onChange({...value,batchSize:Math.max(1,Math.min(limit,Math.trunc(Number(e.target.value))))})}/></label>}
    <div className="classic-toggles">{(['shuffle','retention','mixed'] as const).map(key=><label key={key}><input type="checkbox" disabled={key==='retention'&&value.mode==='BATCH'} checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span>{({shuffle:id?'Acak soal dan opsi':'Shuffle questions and options',retention:id?'Sisipkan pengulangan':'Include retention repeats',mixed:id?'Variasikan tipe soal':'Mix question types'})[key]}</span></label>)}</div>
  </fieldset>;
}
