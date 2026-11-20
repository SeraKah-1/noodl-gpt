import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {Accessibility,BookOpen,Check,ChevronRight,Cloud,CloudOff,MessageSquare,Palette,Settings2,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {colorContrast,getThemeList,type ThemeName} from './theme';
import type {Preferences,WorkspacePreferences} from '../shared/preferences';
import {defaultPreferences} from '../shared/preferences';
import {StudyOptions} from './classic/StudyOptions';

type Category='appearance'|'study'|'access'|'chat'|'data'|'account'|'advanced';
type Props={
 preferences:WorkspacePreferences;locale:'id'|'en';onSave:(changes:Partial<Preferences>)=>Promise<void>;
 pending:boolean;conflict:boolean;onUseServer:()=>Promise<void>;
 online:boolean;syncing:boolean;pendingChanges:number;lastSync:string|null;guest:boolean;embedded:boolean;
 onOpenChat:()=>Promise<void>;onSync:()=>Promise<void>;dataActions?:ReactNode;accountActions?:ReactNode;
};
export function SettingsV3({preferences,locale,onSave,pending,conflict,onUseServer,online,syncing,pendingChanges,lastSync,guest,embedded,onOpenChat,onSync,dataActions,accountActions}:Props){
 const en=locale==='en',reduce=useReducedMotion()||document.documentElement.dataset.reducedMotion==='true';
 const [category,setCategory]=useState<Category>('appearance');
 const [draft,setDraft]=useState<Preferences>({theme:preferences.theme,language:preferences.language,design:preferences.design,studyOptions:preferences.studyOptions});
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setDraft({theme:preferences.theme,language:preferences.language,design:preferences.design,studyOptions:preferences.studyOptions});setMessage('');},[preferences.revision,preferences.updatedAt]);
 const themes=getThemeList();
 const selected=themes.find(t=>t.id===draft.theme)??themes[0];
 const custom=draft.design;
 const accent=custom.accent??(draft.theme==='default'?'#FFBA59':draft.theme==='editorial'?'#D9F45F':selected.textColor);
 const background=custom.background??selected.previewColor;
 const foreground=custom.text??selected.textColor;
 const muted=custom.muted??(draft.theme==='default'?'#485D69':foreground);
 const surface=custom.surface??(draft.theme==='default'?'#FFFFFF':background);
 const contrast=colorContrast(foreground,background);
 const isDirty=JSON.stringify({theme:draft.theme,language:draft.language,design:draft.design,studyOptions:draft.studyOptions})!==JSON.stringify({theme:preferences.theme,language:preferences.language,design:preferences.design,studyOptions:preferences.studyOptions});
 const categories=[
  {key:'appearance',icon:Palette,label:en?'Appearance':'Tampilan',desc:en?'Palette & layout':'Warna & layout'},
  {key:'study',icon:BookOpen,label:en?'Practice defaults':'Default latihan',desc:en?'Mode & questions':'Mode & soal'},
  {key:'access',icon:Accessibility,label:en?'Accessibility':'Aksesibilitas',desc:en?'Text & motion':'Teks & gerakan'},
  {key:'chat',icon:MessageSquare,label:'ChatGPT / MCP',desc:en?'Connected workflow':'Alur terhubung'},
  {key:'data',icon:Cloud,label:en?'Data & sync':'Data & sinkronisasi',desc:en?'Storage & exports':'Simpan & ekspor'},
  {key:'account',icon:ShieldCheck,label:en?'Account':'Akun',desc:en?'Privacy & session':'Privasi & sesi'},
  {key:'advanced',icon:Settings2,label:'Advanced',desc:en?'Technical tokens':'Token teknis'}
 ] as const;
 function patchDesign(patch:Partial<Preferences['design']>){setDraft(x=>({...x,design:{...x.design,...patch}}));setMessage('');}
 function reset(){setDraft({theme:preferences.theme,language:preferences.language,design:preferences.design,studyOptions:preferences.studyOptions});setError('');setMessage('');}
 function validate(){
  if(contrast<4.5)return en?'Text/background contrast must be at least 4.5:1.':'Kontras teks dengan background harus minimal 4,5:1.';
  if(custom.border&&colorContrast(custom.border,surface)<3)return en?'Control border needs at least 3:1 contrast against the surface.':'Border kontrol harus memiliki kontras minimal 3:1 terhadap surface.';
  return '';
 }
 async function save(){
  if(!isDirty||saving)return;
  const issue=validate();if(issue){setError(issue);return;}
  setError('');setMessage('');setSaving(true);
  try{await onSave({theme:draft.theme,language:draft.language,design:draft.design,studyOptions:draft.studyOptions});setMessage(en?'Preferences saved.':'Pengaturan tersimpan.');}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setSaving(false);}
 }
 function updateTheme(next:ThemeName){
  // Choosing a preset must clear old hex overrides, otherwise the new theme would appear unchanged.
  setDraft(x=>({...x,theme:next,design:{...x.design,accent:null,background:null,surface:null,text:null,muted:null,border:null}}));setMessage('');
 }
 const motionProps=reduce?{initial:false as const,animate:{opacity:1},exit:{opacity:0},transition:{duration:0}}:{initial:{opacity:0,y:7},animate:{opacity:1,y:0},exit:{opacity:0,y:-7},transition:{duration:.2}};
 return <section className="v3-settings" aria-labelledby="v3-settings-title">
  <header className="v3-settings-head"><span className="v3-eyebrow">NOODL / PERSONAL SPACE</span><h1 id="v3-settings-title">{en?'Settings':'Pengaturan'}</h1><p>{en?'Adjust your study workspace. Changes apply only after Save.':'Atur ruang belajarmu. Perubahan baru berlaku setelah disimpan.'}</p></header>
  <div className="v3-settings-layout">
   <nav className="v3-settings-menu" aria-label={en?'Settings categories':'Kategori pengaturan'}>
    {categories.map(({key,icon:Icon,label,desc})=><button key={key} aria-current={category===key?'page':undefined} onClick={()=>setCategory(key)}><Icon size={19}/><span><strong>{label}</strong><small>{desc}</small></span><ChevronRight size={17}/></button>)}
   </nav>
   <div className="v3-settings-content">
    <AnimatePresence mode="wait" initial={false}>
     <motion.section key={category} {...motionProps} aria-label={categories.find(c=>c.key===category)?.label} className="v3-settings-panel">
     {category==='appearance'&&<><h2>{en?'Appearance':'Tampilan'}</h2><p>{en?'Select a palette and preview before saving.':'Pilih palet lalu lihat hasilnya sebelum menyimpan.'}</p>
      <div className="v3-theme-grid">{themes.map(t=><button key={t.id} aria-pressed={draft.theme===t.id} className="v3-theme-choice" onClick={()=>updateTheme(t.id)}>
       <span className="v3-theme-swatch" style={{background:t.previewColor,color:t.textColor}}><span>noodl</span><span className="v3-swatch-line" style={{background:t.textColor}}/></span>
       <strong>{t.name}</strong><small>{t.desc}</small>{draft.theme===t.id&&<Check size={19} aria-label={en?'Selected':'Dipilih'}/>}
      </button>)}</div>
      <h3>{en?'Preview — not yet applied':'Preview — belum diterapkan'}</h3>
      <div className="v3-theme-preview" style={{background,color:foreground}}>
       <div className="v3-theme-preview-top"><strong>noodl ✦</strong><small style={{color:muted}}>{en?'Today':'Hari ini'}</small></div>
       <div className="v3-theme-preview-card" style={{background:surface,color:foreground,borderColor:foreground}}>
        <small>{en?'NEXT STEP':'LANGKAH BERIKUTNYA'}</small><strong>{en?'Continue practice':'Lanjutkan latihan'}</strong>
        <span className="v3-preview-cta" style={{background:accent,color:colorContrast(accent,'#172A36')>=4.5?'#172A36':'#000000'}}>{en?'Start practice':'Mulai latihan'}</span>
       </div>
      </div>
      <p className="v3-validation" role="status">{en?'Text contrast':'Kontras teks'}: {contrast.toFixed(2)}:1 · {contrast>=4.5?(en?'Pass AA':'Lulus AA'):(en?'Too low — choose another combination':'Terlalu rendah — ganti kombinasi')}</p>
     </>}
     {category==='study'&&<><h2>{en?'Practice defaults':'Default latihan'}</h2><p>{en?'These values are used when starting a new session. Existing attempts stay unchanged.':'Pengaturan ini dipakai saat membuat sesi baru. Sesi yang sudah ada tidak berubah.'}</p>
      <StudyOptions value={draft.studyOptions} onChange={v=>setDraft(x=>({...x,studyOptions:v}))} locale={locale}/>
     </>}
     {category==='access'&&<><h2>{en?'Accessibility':'Aksesibilitas'}</h2><p>{en?'Adjust reading size and animation comfort.':'Atur ukuran baca dan kenyamanan gerak.'}</p>
      <label className="v3-setting-control">{en?'Text size':'Ukuran teks'} <input type="range" min=".85" max="1.35" step=".05" value={custom.fontScale} onChange={e=>patchDesign({fontScale:Number(e.target.value)})}/><output>{Math.round(custom.fontScale*100)}%</output></label>
      <div className="v3-type-sample" style={{fontSize:`${custom.fontScale}rem`}}>{en?'Reading this question should feel effortless.':'Membaca pertanyaan harus terasa jelas, bukan membuat mata lelah.'}</div>
      <label className="v3-setting-toggle"><input type="checkbox" checked={custom.reduceMotion} onChange={e=>patchDesign({reduceMotion:e.target.checked})}/><span><strong>{en?'Reduce motion':'Kurangi animasi'}</strong><small>{en?'Keep state feedback without large movement.':'Status tetap terlihat tanpa gerakan berlebihan.'}</small></span></label>
     </>}
     {category==='chat'&&<><h2>ChatGPT & MCP</h2><p>{en?'ChatGPT reads source files and creates content. Noodl stores structured learning data and evaluates answers.':'ChatGPT membaca dokumen dan membuat materi. Noodl menyimpan data belajar terstruktur serta menilai jawaban.'}</p>
      <div className="v3-connection"><MessageSquare size={23}/><div><strong>{embedded?(en?'ChatGPT panel connected':'Terbuka dalam panel ChatGPT'):(en?'ChatGPT opens separately':'ChatGPT dibuka terpisah')}</strong><p>{embedded?(en?'Requests are sent to the conversation; a successful MCP write is confirmed separately.':'Permintaan dikirim ke percakapan; hasil tulis MCP baru dianggap selesai setelah dikonfirmasi.'):(en?'Context is copied and ChatGPT opens in a new tab. No automatic completion is claimed.':'Konteks disalin dan ChatGPT dibuka di tab baru. Belum berarti materi berhasil disimpan.')}</p></div></div>
      <button className="n-button primary" onClick={()=>void onOpenChat()}>{en?'Ask ChatGPT to create a bank':'Minta ChatGPT membuat bank soal'}</button>
      <p className="v3-note">{en?'Attach PDF, PPT or images in the ChatGPT conversation—not in Noodl.':'Lampirkan PDF, PPT, atau gambar di percakapan ChatGPT, bukan di Noodl.'}</p>
     </>}
     {category==='data'&&<><h2>{en?'Data & sync':'Data & sinkronisasi'}</h2>
      <div className="v3-connection">{online?<Cloud size={23}/>:<CloudOff size={23}/>}<div><strong>{!online?(en?'Offline':'Offline'):syncing?(en?'Synchronizing':'Menyinkronkan'):pendingChanges>0?`${pendingChanges} ${en?'changes pending':'perubahan tertunda'}`:(en?'Online':'Online')}</strong><p>{lastSync?`${en?'Last sync':'Sinkronisasi terakhir'}: ${new Date(lastSync).toLocaleString()}`:(en?'No confirmed synchronization recorded yet.':'Belum ada waktu sinkronisasi terkonfirmasi.')}</p></div></div>
      <button className="n-button" disabled={!online||syncing} onClick={()=>void onSync()}>{en?'Sync now':'Sinkronkan sekarang'}</button>
      {pending&&<p role="status">{en?'Preferences are waiting to sync.':'Pengaturan menunggu sinkronisasi.'}</p>}
      {dataActions}
     </>}
     {category==='account'&&<><h2>{en?'Account & privacy':'Akun & privasi'}</h2>
      <p>{guest?(en?'Guest data may depend on this device and session.':'Data Guest bisa bergantung pada perangkat dan sesi ini.'):(en?'Private study data is scoped to your signed-in account.':'Data belajar privat terikat pada akun yang masuk.')}</p>{accountActions}</>}
     {category==='advanced'&&<><h2>Advanced</h2><p>{en?'Custom color tokens and detailed layout controls. Invalid contrast cannot be saved.':'Token warna khusus dan kontrol layout. Kontras yang tidak memenuhi syarat tidak bisa disimpan.'}</p>
      <div className="v3-advanced-grid">{(['accent','background','surface','text','muted','border'] as const).map(key=><label key={key}>{key}<input type="text" inputMode="text" pattern="#[0-9a-fA-F]{6}" placeholder="#123456" value={custom[key]??''} onChange={e=>patchDesign({[key]:e.target.value||null})}/></label>)}
      <label>{en?'Corners':'Sudut'}<input type="range" min="0" max="32" value={custom.radius} onChange={e=>patchDesign({radius:Number(e.target.value)})}/><output>{custom.radius}px</output></label>
      <label>{en?'Density':'Kepadatan'}<select value={custom.density} onChange={e=>patchDesign({density:e.target.value as typeof custom.density})}>{(['compact','comfortable','spacious'] as const).map(v=><option key={v} value={v}>{v}</option>)}</select></label>
      <label>{en?'Content width':'Lebar konten'}<input type="number" min="640" max="1800" step="20" value={custom.contentWidth} onChange={e=>patchDesign({contentWidth:Number(e.target.value)})}/></label>
      <label>{en?'Bank layout':'Tampilan bank'}<select value={custom.cardLayout} onChange={e=>patchDesign({cardLayout:e.target.value as typeof custom.cardLayout})}><option value="list">List</option><option value="grid">Grid</option></select></label></div>
      <button className="n-button" onClick={()=>patchDesign({...defaultPreferences().design,accent:null,background:null,surface:null,text:null,muted:null,border:null})}>{en?'Reset design fields':'Reset kolom desain'}</button>
     </>}
     </motion.section>
    </AnimatePresence>
    <footer className="v3-settings-footer">
     <span role="status" aria-live="polite">{isDirty?(en?'Unsaved changes':'Perubahan belum disimpan'):message||(en?'Up to date':'Tersimpan')}</span>
     <button className="n-button" disabled={!isDirty||saving} onClick={reset}>{en?'Cancel':'Batalkan'}</button>
     <button className="n-button primary" disabled={!isDirty||saving||contrast<4.5} onClick={()=>void save()}>{saving?(en?'Saving…':'Menyimpan…'):(en?'Save changes':'Simpan perubahan')}</button>
    </footer>
    {error&&<p className="n-error" role="alert">{error}</p>}
    {conflict&&<div className="n-conflict" role="alert"><span>{en?'Settings were changed on another device.':'Pengaturan telah berubah dari perangkat lain.'}</span><button onClick={()=>void onUseServer().catch(e=>setError(String(e)))}>{en?'Load server settings':'Muat pengaturan server'}</button></div>}
   </div>
  </div>
 </section>;
}
