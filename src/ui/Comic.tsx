import {useEffect,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,Download,LayoutGrid,Maximize2,MessageSquarePlus,Minimize2} from 'lucide-react';
import type {Artifact,Pack} from '../shared/types';
import {parseComic,comicRequest,type ComicDocument} from '../shared/comic';
import {requestTutor} from '../client/bridge';
import './Comic.css';

function ComicImage({panel}:{panel:ComicDocument['panels'][number]}){
 const [failed,setFailed]=useState(false);
 const [retry,setRetry]=useState(0);
 const src=panel.imageData||(panel.illustrationSvg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(panel.illustrationSvg)}`:undefined);
 return src&&!failed?<img key={retry} src={src} alt={panel.alt} loading="lazy" onError={()=>setFailed(true)}/>
 :<div className="comic-storyboard">
  <strong>{failed?'Ilustrasi gagal dimuat':'Storyboard · ilustrasi belum tersedia'}</strong>
  <p>{panel.visualDescription}</p>
  {failed&&<button type="button" onClick={()=>{setFailed(false);setRetry(n=>n+1);}}>Coba muat ilustrasi lagi</button>}
 </div>;
}
function ComicPanel({panel,index,focused}:{panel:ComicDocument['panels'][number];index:number;focused?:boolean}){
 return <section className={'comic-panel'+(focused?' comic-panel-focused':'')} aria-label={'Panel '+String(index+1)+': '+panel.title}>
  <h4><span>{index+1}</span>{panel.title}</h4>
  <div className="comic-image-viewport"><ComicImage key={panel.id} panel={panel}/></div>
  <p className="comic-caption">{panel.caption}</p>
  {panel.dialogue.map((line,i)=><p className="comic-dialogue" key={i}><strong>{line.speaker}:</strong> {line.text}</p>)}
 </section>;
}
function ComicReading({comic}:{comic:ComicDocument}){
 const [view,setView]=useState<'focus'|'grid'>('focus');
 const [index,setIndex]=useState(0);
 const [zoom,setZoom]=useState(false);
 const focus=useRef<HTMLDivElement>(null);
 const panel=comic.panels[index];
 useEffect(()=>{if(view==='focus')focus.current?.focus({preventScroll:true});},[index,view]);
 function change(next:number){setZoom(false);setIndex(Math.max(0,Math.min(comic.panels.length-1,next)));}
 return <div className="comic-reading">
  <nav className="comic-reader-toolbar" aria-label="Navigasi panel komik">
   <span aria-live="polite">Panel {index+1} / {comic.panels.length}</span>
   <div className="comic-reader-actions">
    <button type="button" aria-pressed={view==='grid'} onClick={()=>setView(v=>v==='grid'?'focus':'grid')}>
     <LayoutGrid size={16}/>{view==='grid'?'Baca satu panel':'Lihat semua'}
    </button>
    {view==='focus'&&<button type="button" aria-pressed={zoom} onClick={()=>setZoom(z=>!z)}>
     {zoom?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
     {zoom?'Ukuran normal':'Perbesar gambar'}
    </button>}
   </div>
  </nav>
  {view==='focus'?<div ref={focus} className={'comic-focus-surface'+(zoom?' is-zoomed':'')} tabIndex={0}
   aria-label="Pembaca panel. Gunakan tombol sebelumnya atau berikutnya."
   onKeyDown={e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target!==e.currentTarget)return;
    if(e.key==='ArrowRight'&&index<comic.panels.length-1){e.preventDefault();change(index+1);}
    if(e.key==='ArrowLeft'&&index>0){e.preventDefault();change(index-1);}
   }}>
   <ComicPanel panel={panel} index={index} focused/>
   <div className="comic-pager">
    <button type="button" disabled={index===0} onClick={()=>change(index-1)}>
     <ChevronLeft size={17}/>Sebelumnya
    </button>
    <div className="comic-panel-progress" role="progressbar" aria-valuemin={0} aria-valuemax={comic.panels.length}
     aria-valuenow={index+1} aria-label="Posisi membaca panel"><span style={{width:((index+1)/comic.panels.length*100)+'%'}}/></div>
    <button type="button" disabled={index===comic.panels.length-1} onClick={()=>change(index+1)}>
     Berikutnya<ChevronRight size={17}/>
    </button>
   </div>
  </div>:<ol className="comic-panels">
   {comic.panels.map((item,i)=><li key={item.id}>
    <button type="button" className="comic-panel-jump" onClick={()=>{setView('focus');change(i);}}>Buka panel {i+1}</button>
    <ComicPanel panel={item} index={i}/>
   </li>)}
  </ol>}
 </div>;
}
export function ComicReader({artifact}:{artifact:Artifact}){
 let comic:ComicDocument;
 try{comic=parseComic(artifact.content);}catch{return <article className="tools-panel" role="alert">Komik “{artifact.title}” belum memiliki format yang valid. Minta ChatGPT memperbaikinya.</article>;}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='noodl-comic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const withImages=comic.panels.filter(panel=>!!(panel.imageData||panel.illustrationSvg)).length;
 return <article className="tools-panel comic-reader">
  <header className="tools-between"><div><h3>{artifact.title}</h3>
   <p>{comic.status==='draft'?'Draft · belum selesai diperiksa':'Pemeriksaan dilaporkan oleh pembuat, bukan verifikasi independen'}</p>
  </div><button type="button" onClick={download}><Download size={16}/> JSON komik</button></header>
  <p>{comic.brief.objective}</p>
  <p className="comic-asset-status">{withImages} dari {comic.panels.length} panel punya ilustrasi tersimpan. {withImages<comic.panels.length?'Panel lain ditampilkan sebagai storyboard.':''}</p>
  <details><summary>Brief & gaya yang disepakati</summary>
   <dl><dt>Pembaca</dt><dd>{comic.brief.audience}</dd><dt>Bahasa</dt><dd>{comic.brief.language}</dd>
    <dt>Gaya</dt><dd>{comic.brief.style}</dd><dt>Konfirmasi pengguna</dt><dd>{comic.brief.userConfirmation}</dd></dl>
  </details>
  <ComicReading comic={comic}/>
  <details className="comic-review"><summary>Sumber & pemeriksaan hasil</summary>
   <p>Checklist ini dilaporkan oleh pembuat komik. Aplikasi memvalidasi formatnya, bukan memverifikasi kebenaran ilmiahnya.</p>
   <ul>{(['accuracy','sequence','text','visuals','userStyle'] as const).map(key=><li key={key}>{
    ({accuracy:'Akurasi',sequence:'Urutan panel',text:'Teks dan label',visuals:'Visual aktual',userStyle:'Gaya pengguna'})[key]
   }: {comic.review[key]?'dilaporkan diperiksa':'belum selesai'}</li>)}</ul>
   <p>{comic.review.notes}</p>
   {comic.review.issues.length>0&&<><h4>Temuan yang belum selesai</h4><ul>{comic.review.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></>}
   <h4>Sumber</h4>
   {comic.sources.length?<ul>{comic.sources.map((source,i)=><li key={i}><strong>{source.label}</strong> — {source.reference}</li>)}</ul>:<p>Sumber belum dicatat.</p>}
  </details>
 </article>;
}
export function Comics({pack}:{pack:Pack}){
 const comics=pack.artifacts.filter(a=>a.kind==='comic');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(){setBusy(true);setError('');try{await requestTutor(pack,undefined,comicRequest);}catch(e){setError(e instanceof Error?e.message:'Tidak dapat membuka ChatGPT');}finally{setBusy(false);}}
 return <section className="comic-library"><div className="tools-between"><div><h3>Komik pembelajaran</h3><p>Mulai dari klarifikasi isi dan gaya. Akurasi menjadi acuan setiap panel.</p></div>
  <button className="tools-primary" disabled={busy} onClick={()=>void request()}><MessageSquarePlus size={17}/>{busy?'Membuka…':'Rancang bersama ChatGPT'}</button></div>
  {error&&<p role="alert" className="tools-error">{error}</p>}
  {comics.length?comics.map(a=><ComicReader key={a.id} artifact={a}/>):<div className="tools-empty"><BookOpen size={36}/><h3>Belum ada komik di bank ini</h3><p>ChatGPT akan menanyakan tujuan belajar, sumber, dan gaya yang kamu inginkan sebelum membuatnya.</p></div>}
 </section>;
}
