import {useState} from 'react';

const actions=['merangsang','menghambat'] as const;
const labels=['Gastrin dari sel G','Pelepasan histamin oleh sel ECL','Sekresi HCl oleh sel parietal'];
const source='https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach';
const mechanism='https://www.msdmanuals.com/professional/gastrointestinal-disorders/gastritis-and-peptic-ulcer-disease/overview-of-acid-secretion';

export function GastricDiagram({links}:{links:readonly string[]}){
 return <svg className="gastric-path" role="img" viewBox="0 0 420 272" aria-label={labels.map((l,i)=>l+' '+(links[i]??'')).join(' ')}>
  {labels.map((label,i)=>{
   const y=i*106+6;
   return <g key={label}><rect x="6" y={y} width="408" height="50" rx="10" fill="#f4f0ff" stroke="#705795"/>
    <text x="210" y={y+31} textAnchor="middle" fontFamily="sans-serif" fontSize="18" fill="#281d36">{label}</text>
    {i<links.length&&<g><path d={`M 103 ${y+51} v 48 m -6 -8 l 6 9 l 6 -9`} fill="none" stroke="currentColor" strokeWidth="2"/>
    <text x="123" y={y+83} fill="currentColor" fontFamily="sans-serif" fontSize="17">{i+1} · {links[i]}</text></g>}
   </g>;
  })}
 </svg>;
}
export function GastricDebugger({onClose}:{onClose:()=>void}){
 const [edge,setEdge]=useState<number|null>(null),[action,setAction]=useState(''),[checked,setChecked]=useState(false);
 const initial=['merangsang','menghambat'];
 const right=edge===1&&action===actions[0];
 return <section className="study-player"><header className="study-top"><button className="study-secondary" onClick={onClose}>Kembali</button><div><small>Knowledge Debugger</small><h2>Regulasi asam lambung</h2></div></header>
  <article className="study-surface"><h3>{checked?'Jalur yang benar':'Perbaiki satu hubungan'}</h3>
  <p>{checked?'Cabang regulasi melalui sel enterochromaffin-like (ECL).':'Satu label panah pada jalur ini sengaja salah. Pilih panah dan ganti pengaruhnya.'}</p>
  <GastricDiagram links={checked?['merangsang','merangsang']:initial}/>
  {checked?<><p role="status"><b>{right?'Koreksimu tepat.':'Koreksi yang diperlukan ada pada panah 2.'}</b> Histamin dari sel ECL bekerja pada reseptor H₂ sel parietal dan meningkatkan sekresi HCl.</p>
  <p><a href={source} target="_blank" rel="noreferrer">OpenStax · Anatomy and Physiology 2e, §23.4</a> · <a href={mechanism} target="_blank" rel="noreferrer">MSD Manual · regulasi sekresi asam</a></p>
  <button className="study-secondary" onClick={()=>{setChecked(false);setEdge(null);setAction('');}}>Ulangi diagram</button></>:
  <form onSubmit={e=>{e.preventDefault();if(edge!==null&&action)setChecked(true);}}>
   <div className="recall-controls"><label>Panah <select value={edge??''} onChange={e=>setEdge(e.target.value===''?null:Number(e.target.value))}><option value="">Pilih</option><option value="0">1 · Gastrin ke sel ECL</option><option value="1">2 · Histamin ke sel parietal</option></select></label>
   <label>Koreksi label <select value={action} onChange={e=>setAction(e.target.value)}><option value="">Pilih</option>{actions.map(a=><option key={a}>{a}</option>)}</select></label></div>
   <button className="study-primary" disabled={edge===null||!action}>Periksa koreksi</button>
  </form>}</article></section>;
}
