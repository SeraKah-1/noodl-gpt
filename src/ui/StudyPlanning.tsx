import {useState} from 'react';
import {bloomLevels,dailyStudyCalendar,generationBrief} from '../shared/studyPlans';

export function GenerationOptions({count,english=false,onRequest,label,disabled=false}:{count:number;english?:boolean;onRequest:(brief:string)=>void;label:string;disabled?:boolean}){
 const [custom,setCustom]=useState(false),[weights,setWeights]=useState([10,30,30,20,10,0]);
 const [source,setSource]=useState(''),[instructions,setInstructions]=useState('');
 const total=weights.reduce((a,b)=>a+b,0);
 return <><details className="study-plan"><summary>{english?'Bloom, sources and instructions':'Bloom, sumber, dan instruksi'}</summary>
  <label><input type="checkbox" checked={custom} onChange={e=>setCustom(e.target.checked)}/>{english?'Set Bloom distribution':'Atur distribusi Bloom'}</label>
  {custom&&<fieldset><legend>{english?'Percent per level':'Persen per tingkat'} · {total}/100%</legend>{bloomLevels.map((level,i)=><label key={level}>{level} {(english?['Remember','Understand','Apply','Analyze','Evaluate','Create']:['Ingat','Pahami','Terapkan','Analisis','Evaluasi','Cipta'])[i]}
   <input type="number" min={0} max={100} value={weights[i]} onChange={e=>setWeights(weights.map((n,j)=>j===i?Math.max(0,Math.min(100,Math.trunc(Number(e.target.value)))):n))}/></label>)}</fieldset>}
  <label>{english?'Source or attachment name':'Sumber atau nama lampiran'}<input value={source} maxLength={1500} onChange={e=>setSource(e.target.value)}/></label>
  <label>{english?'Additional instructions':'Instruksi tambahan'}<textarea value={instructions} maxLength={2000} onChange={e=>setInstructions(e.target.value)}/></label>
 </details>{custom&&total!==100&&<p role="status">{english?'Percentages must total 100%.':'Total persentase harus 100%.'}</p>}
 <button className="study-primary" disabled={disabled||(custom&&total!==100)} onClick={()=>onRequest(generationBrief(count,custom?weights:null,source,instructions))}>{label}</button></>;
}

export function StudyCalendar({english=false}:{english?:boolean}){
 const [time,setTime]=useState('19:00');
 function download(){
  const text=dailyStudyCalendar(time,new Date(),crypto.randomUUID());
  const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='noodl-study.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 return <details className="study-plan"><summary>{english?'Schedule daily practice':'Jadwalkan latihan harian'}</summary>
 <label>{english?'Local time':'Jam setempat'}<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
 <p>{english?'Import the file into your calendar for a daily 30-minute session.':'Impor berkas ke kalender untuk latihan 30 menit setiap hari.'}</p>
 <button className="study-secondary" disabled={!time} onClick={download}>{english?'Download calendar (.ics)':'Unduh kalender (.ics)'}</button></details>;
}
