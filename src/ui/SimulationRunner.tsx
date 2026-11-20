import {useMemo,useState} from 'react';
import {RotateCcw,SlidersHorizontal} from 'lucide-react';
import {calculateSimulation,parseSimulation} from '../shared/simulation';
import type {Artifact} from '../shared/types';
import './StudioV4.css';

type Props={simulations:Artifact[];onAsk:(request:string)=>void};
const labelStatus={provided:'Sumber diberikan',model_inspected:'Pemeriksaan diklaim pembuat',unavailable:'Sumber belum tersedia'} as const;
function display(value:number){return new Intl.NumberFormat('id-ID',{maximumFractionDigits:4}).format(value);}
export function SimulationRunner({simulations,onAsk}:Props){
 const [chosen,setChosen]=useState('');
 const artifact=simulations.find(a=>a.id===chosen)??simulations[0];
 const doc=useMemo(()=>{
  if(!artifact)return null;
  try{return {value:parseSimulation(artifact.content),error:''};}
  catch(cause){return {value:null,error:cause instanceof Error?cause.message:'Model tidak dapat dibaca'};}
 },[artifact]);
 const current=doc?.value;
 // State is scoped to artifact ID and reinitialized through the keyed inner runner.
 if(!current)return <div className="v4-map-empty">
  <h3>{artifact?'Model simulasi belum valid':'Belum ada model simulasi yang tersimpan'}</h3>
  <p>{doc?.error??'Visual HTML biasa bukan mesin simulasi. Dibutuhkan model, batas parameter, sumber, dan kasus uji.'}</p>
  <button className="study-primary" onClick={()=>onAsk('Buat satu simulation artifact untuk bank ini dengan JSON version 1: title, objective, control {id,label,unit,min,max,step,default}, output {label,unit}, model {kind linear,slope,intercept ATAU saturation,maximum,halfSaturation}, assumptions, sources, expectedCases (setidaknya dua perhitungan yang benar), validity. Gunakan create_artifact kind simulation setelah model dan sumber ditelaah. Labeli sebagai model terbatas, bukan prediksi klinis.')}>Rancang model di ChatGPT</button>
 </div>;
 return <section className="v4-simulation-root" aria-label={'Simulasi '+current.title}>
  <div className="v4-studio-heading"><div><small>STUDIO / SIMULATION ENGINE</small><h3>{current.title}</h3><p>{current.objective}</p></div>
   {simulations.length>1&&<label>Model
    <select value={artifact.id} onChange={e=>setChosen(e.target.value)}>{simulations.map(a=><option value={a.id} key={a.id}>{a.title}</option>)}</select>
   </label>}
  </div>
  <SimulationSession key={artifact.id} model={current}/>
 </section>;
}
function SimulationSession({model}: {model:ReturnType<typeof parseSimulation>}){
 const [value,setValue]=useState(model.control.default);
 const [prediction,setPrediction]=useState<'higher'|'lower'|'same'|''>('');
 const [revealed,setRevealed]=useState(false);
 const baseline=calculateSimulation(model.model,model.control.default);
 const output=calculateSimulation(model.model,value);
 const delta=output-baseline;
 const epsilon=1e-8;
 const observed=Math.abs(delta)<=epsilon?'same':delta>0?'higher':'lower';
 const points=Array.from({length:41},(_,i)=>{
  const x=model.control.min+(model.control.max-model.control.min)*i/40;
  return {x,y:calculateSimulation(model.model,x)};
 });
 const lo=Math.min(...points.map(p=>p.y)),hi=Math.max(...points.map(p=>p.y));
 const scale=(y:number)=>hi===lo?100:190-(y-lo)/(hi-lo)*150;
 const poly=points.map((p,i)=>(24+i*6.25)+','+scale(p.y)).join(' ');
 const positionX=24+(value-model.control.min)/(model.control.max-model.control.min)*250;
 function reset(){setValue(model.control.default);setPrediction('');setRevealed(false);}
 return <div className="v4-sim-grid">
  <div className="v4-sim-model">
   <h4><SlidersHorizontal size={18}/> Parameter</h4>
   <label htmlFor="v4-sim-parameter">{model.control.label} ({model.control.unit})</label>
   <input id="v4-sim-parameter" aria-label={model.control.label} type="range"
    min={model.control.min} max={model.control.max} step={model.control.step}
    value={value} onChange={e=>{setValue(Number(e.target.value));setRevealed(false);}}/>
   <div className="v4-sim-range"><span>{display(model.control.min)}</span><output htmlFor="v4-sim-parameter"><strong>{display(value)}</strong> {model.control.unit}</output><span>{display(model.control.max)}</span></div>
   <button type="button" className="study-secondary" onClick={reset}><RotateCcw size={15}/> Reset ke baseline</button>
   <div className="v4-sim-predict">
    <h4>Prediksi dulu (opsional)</h4>
    <p>Bandingkan dengan kondisi awal. Ini hanya cek lokal; belum dihitung sebagai nilai belajar.</p>
    <select value={prediction} onChange={e=>{setPrediction(e.target.value as typeof prediction);setRevealed(false);}} aria-label="Prediksi perubahan output">
     <option value="">Pilih prediksi</option><option value="higher">Hasil meningkat</option><option value="lower">Hasil menurun</option><option value="same">Hasil tetap</option>
    </select>
    <button type="button" className="study-secondary" disabled={!prediction} onClick={()=>setRevealed(true)}>Bandingkan prediksi</button>
    {revealed&&<p role="status">{prediction===observed?'Prediksi sesuai model.':'Prediksi berbeda dengan hasil model.'} Output {observed==='higher'?'meningkat':observed==='lower'?'menurun':'tetap'} untuk input ini.</p>}
   </div>
  </div>
  <div className="v4-sim-output">
   <h4>Hasil perhitungan</h4>
   <div className="v4-sim-metrics"><div><small>Baseline</small><strong>{display(baseline)}</strong><span>{model.output.unit}</span></div>
    <div><small>Dengan parameter saat ini</small><strong>{display(output)}</strong><span>{model.output.unit}</span></div>
    <div><small>Selisih</small><strong>{delta>0?'+':''}{display(delta)}</strong><span>{model.output.unit}</span></div></div>
   <svg role="img" aria-label={'Kurva '+model.output.label+' terhadap '+model.control.label+' berdasarkan model yang tersimpan'} viewBox="0 0 300 220" className="v4-sim-plot">
    <line x1="24" x2="275" y1="190" y2="190"/>
    <line x1="24" x2="24" y1="24" y2="190"/>
    <polyline points={poly} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
    <circle cx={positionX} cy={scale(output)} r="6" fill="var(--study-accent,#ffba59)" stroke="currentColor" strokeWidth="1"/>
    <text x="24" y="211" fontSize="10">{display(model.control.min)} {model.control.unit}</text>
    <text x="270" y="211" textAnchor="end" fontSize="10">{display(model.control.max)} {model.control.unit}</text>
   </svg>
   <p className="v4-studio-note"><strong>Batas model:</strong> {model.validity}</p>
  </div>
  <details className="v4-sim-evidence"><summary>Asumsi, sumber dan validasi perhitungan</summary>
   <h4>Asumsi</h4><ul>{model.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul>
   <h4>Sumber yang dilaporkan pembuat</h4><ul>{model.sources.map((src,i)=><li key={i}>{src.uri?<a href={src.uri} target="_blank" rel="noreferrer">{src.title}</a>:src.title}{src.anchor?' · '+src.anchor:''} — {labelStatus[src.status]}</li>)}</ul>
   <p>Kasus uji yang dikirim pembuat telah cocok dengan rumus model. Itu bukan verifikasi ilmiah independen.</p>
   <ul>{model.expectedCases.map((c,i)=><li key={i}>{display(c.input)} {model.control.unit} → {display(c.expected)} {model.output.unit} (toleransi {display(c.tolerance)})</li>)}</ul>
  </details>
 </div>;
}
