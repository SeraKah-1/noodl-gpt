import {Layout, Skull, Zap} from 'lucide-react';
import type {StudyOptions as Options} from '../../shared/types';
import type {Locale} from './Navigation';

export function StudyOptions({value,onChange,locale}:{value:Options;onChange:(next:Options)=>void;locale:Locale}){
  const id=locale==='id';
  const modes=[{key:'STANDARD',Icon:Layout,title:'Standard',description:id?'Belajar dengan ritmemu sendiri':'Learn at your own pace'},
    {key:'SURVIVAL',Icon:Skull,title:'Survival',description:id?'Tiga nyawa. Jaga ketepatanmu.':'Three lives. Stay accurate.'},
    {key:'TIME_RUSH',Icon:Zap,title:'Time Rush',description:id?'20 detik untuk setiap soal':'20 seconds per question'}] as const;
  return <fieldset className="classic-options"><legend>{id?'Mode latihan':'Practice mode'}</legend><div className="classic-mode-grid">{modes.map(({key,Icon,title,description})=><button type="button" key={key} className={`classic-mode mode-${key.toLowerCase()}`} aria-pressed={value.mode===key} onClick={()=>onChange({...value,mode:key})}><Icon size={23}/><strong>{title}</strong><span>{description}</span></button>)}</div>
    <div className="classic-toggles">{(['shuffle','retention','mixed'] as const).map(key=><label key={key}><input type="checkbox" checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span>{({shuffle:id?'Acak soal dan opsi':'Shuffle questions and options',retention:id?'Sisipkan pengulangan':'Include retention repeats',mixed:id?'Variasikan tipe soal':'Mix question types'})[key]}</span></label>)}</div>
  </fieldset>;
}
