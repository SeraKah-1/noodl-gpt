import {BookOpen,ChevronLeft,Play,Layers,FileText,Network,Orbit,BookMarked,MoreHorizontal,PenLine,Share2,Trash2} from 'lucide-react';
import type {Attempt,Pack} from '../shared/types';
import {BankHistory} from './BankHistory';
import {ExportMenu} from './Tools';
import type {Locale,ToolTab} from './classic/Navigation';

interface Props {
 pack:Pack;attempts:Attempt[];locale:Locale;busy:boolean;
 onBack:()=>void;onPractice:()=>void;onFlashcards:()=>void;onTool:(tab:ToolTab)=>void;
 onEdit:()=>void;onRename:()=>void;onPublish:()=>void;onUnpublish:()=>void;onDelete:()=>void;
 onOpenAttempt:(attempt:Attempt)=>void;
}
export function PackDetail({pack,attempts,locale,busy,onBack,onPractice,onFlashcards,onTool,onEdit,onRename,onPublish,onUnpublish,onDelete,onOpenAttempt}:Props){
 const id=locale==='id';
 const history=attempts.filter(a=>a.items.some(i=>i.sourcePackId===pack.id));
 const active=history.filter(a=>a.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const materials=pack.artifacts.filter(a=>a.kind==='material'||a.kind==='insight');
 const visuals=pack.artifacts.filter(a=>a.kind==='visualization');
 const comics=pack.artifacts.filter(a=>a.kind==='comic');
 return <section className="desk-pack" aria-labelledby="desk-pack-title">
  <button className="desk-link desk-back" onClick={onBack}><ChevronLeft size={18}/>{id?'Kembali ke Library':'Back to Library'}</button>
  <header className="desk-pack-head">
   <span className="desk-kicker">{pack.folder||'LIBRARY'} · {pack.questions.length} {id?'SOAL':'QUESTIONS'}</span>
   <h1 id="desk-pack-title">{pack.title}</h1>
   {pack.description&&<p>{pack.description}</p>}
   <div className="desk-pack-actions"><button className="desk-primary" disabled={busy} onClick={active?()=>onOpenAttempt(active):onPractice}><Play size={18}/>{active?(id?'Lanjutkan latihan':'Resume practice'):(id?'Mulai latihan':'Start practice')}</button>
    <button className="desk-secondary" onClick={onFlashcards}><Layers size={18}/>{id?'Flashcards':'Flashcards'}</button>
    <details className="desk-actions-menu"><summary aria-label={id?'Tindakan lain untuk bank':'More bank actions'}><MoreHorizontal size={22}/></summary><div>
      <button onClick={onEdit}><PenLine size={16}/>{id?'Edit soal':'Edit questions'}</button>
      <button onClick={onRename}>{id?'Ubah nama dan folder':'Rename and move'}</button>
      <ExportMenu pack={pack}/>
      <button disabled={busy} onClick={onPublish}><Share2 size={16}/>{id?'Buat salinan publik':'Publish a copy'}</button>
      <button disabled={busy} onClick={onUnpublish}>{id?'Cabut publikasi':'Unpublish'}</button>
      <button className="danger" onClick={onDelete}><Trash2 size={16}/>{id?'Hapus bank':'Delete bank'}</button>
    </div></details>
   </div>
  </header>
  <section className="desk-pack-resources" aria-labelledby="desk-pack-resources-heading">
   <div className="desk-section-heading"><div><span className="desk-kicker">{id?'KHUSUS BANK INI':'IN THIS BANK'}</span><h2 id="desk-pack-resources-heading">{id?'Materi dan alat':'Materials and tools'}</h2></div></div>
   <div className="desk-resource-list">
    <button onClick={()=>onTool('material')}><FileText size={20}/><span><strong>{id?'Materi & insight':'Materials & insights'}</strong><small>{materials.length? `${materials.length} ${id?'materi tersimpan':'saved resources'}`:id?'Belum ada materi. Bisa dibuat lewat ChatGPT.':'No material yet. Create it via ChatGPT.'}</small></span></button>
    <button onClick={()=>onTool('graph')}><Network size={20}/><span><strong>{id?'Asosiasi konsep':'Concept associations'}</strong><small>{id?'Hubungan dari kesamaan kata, bukan bukti sebab-akibat':'Text similarities, not causal relationships'}</small></span></button>
    {visuals.length>0&&<button onClick={()=>onTool('visual')}><Orbit size={20}/><span><strong>Visual Lab</strong><small>{visuals.length} {id?'visualisasi':'visualizations'}</small></span></button>}
    {comics.length>0&&<button onClick={()=>onTool('comic')}><BookMarked size={20}/><span><strong>{id?'Komik':'Comics'}</strong><small>{comics.length} {id?'komik':'comics'}</small></span></button>}
   </div>
   {!visuals.length&&!comics.length&&<p className="desk-quiet">{id?'Visual Lab dan Komik akan muncul ketika bank memiliki konten yang sesuai.':'Visual Lab and Comics appear when this bank has matching content.'}</p>}
  </section>
  <section className="desk-pack-history" aria-labelledby="desk-history-heading"><div className="desk-section-heading"><div><span className="desk-kicker">{id?'PROGRES TERSIMPAN':'SAVED PROGRESS'}</span><h2 id="desk-history-heading">{id?'Riwayat latihan':'Practice history'}</h2></div></div>
   <BankHistory packId={pack.id} attempts={history} english={!id} onOpen={onOpenAttempt}/>
  </section>
  <p className="desk-quiet"><BookOpen size={15}/>{id?'Bank tersedia dalam cache perangkat ini setelah dimuat; perubahan akun disinkronkan ketika koneksi tersedia.':'Loaded banks are cached on this device; account changes sync when connected.'}</p>
 </section>;
}
