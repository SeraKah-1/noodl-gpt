import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,Check,LockKeyhole,Share2,X} from 'lucide-react';
import type {Pack} from '../shared/types';
import type {Locale} from './classic/Navigation';
import './PublishPreview.css';

interface Props {
 pack:Pack;locale:Locale;open:boolean;busy:boolean;
 onCancel:()=>void;onConfirm:()=>void;
}

/**
 * A disclosure, not a fake publication state. The actual server publication and
 * share URL are handled by the parent only after the learner's explicit action.
 */
export function PublishPreview({pack,locale,open,busy,onCancel,onConfirm}:Props){
 const ref=useRef<HTMLDialogElement>(null);
 const [accepted,setAccepted]=useState(false);
 const en=locale==='en';
 const answerCount=pack.questions.length;
 const sourceCount=pack.questions.filter(q=>q.sourceRefs?.length).length;
 const artCount=pack.artifacts.length;
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open&&!dialog.open)dialog.showModal();
  else if(!open&&dialog.open)dialog.close();
  if(!open)setAccepted(false);
 },[open]);
 return <dialog ref={ref} className="v4-publish-dialog"
  aria-labelledby="v4-publish-title" aria-describedby="v4-publish-description"
  onCancel={event=>{event.preventDefault();onCancel();}}
  onClose={onCancel}>
  <div className="v4-publish-head">
   <span className="v4-publish-icon"><AlertTriangle size={21}/></span>
   <button type="button" className="v4-publish-close" onClick={onCancel}
    aria-label={en?'Close publication preview':'Tutup pratinjau publikasi'}><X size={20}/></button>
  </div>
  <h2 id="v4-publish-title">{en?'Review before making public':'Periksa sebelum dipublikasikan'}</h2>
  <p id="v4-publish-description">{en
   ?'A public link can be opened and copied by anyone who has it. Publishing is not the same as sharing a private learning session.'
   :'Siapa pun yang memiliki tautan dapat membuka dan menyalin isinya. Publikasi bukan berbagi sesi belajar privat.'}</p>
  <section className="v4-publish-summary" aria-label={en?'Contents of public copy':'Isi salinan publik'}>
   <div><strong>{answerCount}</strong><span>{en?'questions, including answer keys and explanations':'soal, termasuk kunci jawaban dan pembahasan'}</span></div>
   <div><strong>{artCount}</strong><span>{en?'saved artifacts: materials, visuals and other content':'artifact tersimpan: materi, visual, dan konten lain'}</span></div>
   <div><strong>{sourceCount}/{answerCount}</strong><span>{en?'questions with author-provided source references':'soal dengan referensi sumber dari pembuat'}</span></div>
  </section>
  <p className="v4-publish-exclusion"><LockKeyhole size={16}/>{en
   ?'Your answers, score history, SRS ratings and private account identity are not included in the public copy.'
   :'Jawaban pribadi, riwayat nilai, rating SRS, dan identitas akun privat tidak ikut disalin.'}</p>
  <p className="v4-publish-warning">{en
   ?'Source labels and review checklists are author claims, not independently verified by Noodl. Revoking a link cannot erase copies someone already made.'
   :'Label sumber dan checklist pemeriksaan adalah klaim pembuat, bukan verifikasi independen oleh Noodl. Mencabut tautan tidak bisa menghapus salinan yang sudah diambil orang lain.'}</p>
  <label className="v4-publish-consent">
   <input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/>
   <span>{en?'I understand that answer keys and saved materials will be public.':'Saya paham kunci jawaban dan seluruh materi tersimpan akan menjadi publik.'}</span>
  </label>
  <div className="v4-publish-actions">
   <button type="button" className="v4-publish-cancel" onClick={onCancel}>{en?'Cancel':'Batal'}</button>
   <button type="button" className="v4-publish-confirm" disabled={!accepted||busy}
    onClick={()=>{if(accepted&&!busy)onConfirm();}}>
    <Share2 size={16}/>{busy?(en?'Publishing…':'Menyimpan…'):(en?'Publish public copy':'Publikasikan salinan')}
   </button>
  </div>
  <p className="v4-publish-pending"><Check size={14}/>{en
   ?'A shareable link appears only after server confirmation.'
   :'Tautan baru akan ditampilkan setelah server mengonfirmasi publikasi.'}</p>
 </dialog>;
}
