import {useState} from 'react';
import {BookOpen,Download,MessageSquarePlus} from 'lucide-react';
import type {Artifact,Pack} from '../shared/types';
import {parseComic,comicRequest,type ComicDocument} from '../shared/comic';
import {requestTutor} from '../client/bridge';
import './Comic.css';
function ComicImage({panel}:{panel:ComicDocument['panels'][number]}){
 const [failed,setFailed]=useState(false);
 const src=panel.imageData||(panel.illustrationSvg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(panel.illustrationSvg)}`:undefined);
 return src&&!failed?<img src={src} alt={panel.alt} loading="lazy" onError={()=>setFailed(true)}/>:<div className="comic-storyboard"><strong>{failed?'Ilustrasi gagal dimuat':'Storyboard · ilustrasi belum tersedia'}</strong><p>{panel.visualDescription}</p></div>;
}
export function ComicReader({artifact}:{artifact:Artifact}){
 let comic:ComicDocument;try{comic=parseComic(artifact.content);}catch{return <article className="tools-panel" role="alert">Komik “{artifact.title}” belum memiliki format yang valid. Minta ChatGPT memperbaikinya.</article>;}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='noodl-comic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <article className="tools-panel comic-reader"><header className="tools-between"><div><h3>{artifact.title}</h3><p>{comic.status==='draft'?'Draft · belum selesai diperiksa':'Checklist pemeriksaan dilaporkan lengkap'}</p></div><button onClick={download}><Download size={16}/> JSON komik</button></header>
 <p>{comic.brief.objective}</p><details><summary>Brief & gaya yang disepakati</summary><dl><dt>Pembaca</dt><dd>{comic.brief.audience}</dd><dt>Bahasa</dt><dd>{comic.brief.language}</dd><dt>Gaya</dt><dd>{comic.brief.style}</dd><dt>Konfirmasi pengguna</dt><dd>{comic.brief.userConfirmation}</dd></dl></details>
 <ol className="comic-panels">{comic.panels.map((panel,index)=><li key={panel.id} className="comic-panel"><h4><span>{index+1}</span>{panel.title}</h4><ComicImage key={JSON.stringify([panel.illustrationSvg,panel.imageData])} panel={panel}/><p className="comic-caption">{panel.caption}</p>{panel.dialogue.map((line,i)=><p className="comic-dialogue" key={i}><strong>{line.speaker}:</strong> {line.text}</p>)}</li>)}</ol>
 <details className="comic-review"><summary>Sumber & pemeriksaan hasil</summary><p>Checklist ini dilaporkan oleh pembuat komik. Aplikasi memvalidasi formatnya, bukan memverifikasi kebenaran ilmiahnya.</p><ul>{(['accuracy','sequence','text','visuals','userStyle'] as const).map(key=><li key={key}>{({accuracy:'Akurasi',sequence:'Urutan panel',text:'Teks dan label',visuals:'Visual aktual',userStyle:'Gaya pengguna'})[key]}: {comic.review[key]?'dilaporkan diperiksa':'belum selesai'}</li>)}</ul><p>{comic.review.notes}</p>{comic.review.issues.length>0&&<><h4>Temuan yang belum selesai</h4><ul>{comic.review.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></>}<h4>Sumber</h4>{comic.sources.length?<ul>{comic.sources.map((source,i)=><li key={i}><strong>{source.label}</strong> — {source.reference}</li>)}</ul>:<p>Sumber belum dicatat.</p>}</details>
 </article>;
}
export function Comics({pack}:{pack:Pack}){
 const comics=pack.artifacts.filter(a=>a.kind==='comic');const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(){setBusy(true);setError('');try{await requestTutor(pack,undefined,comicRequest);}catch(e){setError(e instanceof Error?e.message:'Tidak dapat membuka ChatGPT');}finally{setBusy(false);}}
 return <section className="comic-library"><div className="tools-between"><div><h3>Komik pembelajaran</h3><p>Mulai dari klarifikasi isi dan gaya. Akurasi menjadi acuan setiap panel.</p></div><button className="tools-primary" disabled={busy} onClick={()=>void request()}><MessageSquarePlus size={17}/>{busy?'Membuka…':'Rancang bersama ChatGPT'}</button></div>{error&&<p role="alert" className="tools-error">{error}</p>}{comics.length?comics.map(a=><ComicReader key={a.id} artifact={a}/>):<div className="tools-empty"><BookOpen size={36}/><h3>Belum ada komik di bank ini</h3><p>ChatGPT akan menanyakan tujuan belajar, sumber, dan gaya yang kamu inginkan sebelum membuatnya.</p></div>}</section>;
}
