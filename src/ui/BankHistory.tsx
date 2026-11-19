import {useState} from 'react';
import type {Attempt} from '../shared/types';
import {progressFor} from '../shared/engine';

export function BankHistory({attempts,packId,onOpen,english}:{attempts:Attempt[];packId:string;onOpen:(a:Attempt)=>void;english:boolean}){
 const [open,setOpen]=useState(false),[mode,setMode]=useState('ALL'),[sort,setSort]=useState('recent');
 const sessions=open?attempts.filter(a=>a.packId===packId&&(mode==='ALL'||a.options.mode===mode))
  .map(attempt=>({attempt,progress:progressFor(attempt)}))
  .sort((a,b)=>sort==='low'?a.progress.score-b.progress.score:b.attempt.updatedAt.localeCompare(a.attempt.updatedAt)):[];
 return <details className="study-plan" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{english?'Practice history':'Riwayat latihan'}</summary>
 {open&&<><label>{english?'Mode':'Mode latihan'}<select value={mode} onChange={e=>setMode(e.target.value)}>
 <option value="ALL">{english?'All modes':'Semua mode'}</option>{['STANDARD','SURVIVAL','TIME_RUSH','BATCH'].map(m=><option key={m}>{m}</option>)}</select></label>
 <label>{english?'Order':'Urutan'}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">{english?'Most recent':'Terbaru'}</option><option value="low">{english?'Lowest score':'Nilai terendah'}</option></select></label>
 {sessions.length?<ul>{sessions.map(({attempt:a,progress:p})=><li key={a.id}><button className="study-secondary" onClick={()=>onOpen(a)}>
 {new Date(a.updatedAt).toLocaleString(english?'en':'id-ID')} · {a.options.mode.replace('_',' ')} · {a.status==='completed'?`${p.score}% (${p.correct}/${p.total})`:(english?'Resume':'Lanjutkan')+` (${a.draft?Object.keys(a.draft).length:a.answers.length}/${p.total})`}
 </button></li>)}</ul>:<p>{english?'No sessions in this selection.':'Belum ada sesi untuk pilihan ini.'}</p>}</>}
 </details>;
}
