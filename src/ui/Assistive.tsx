import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera,Hand,Power,X,ScanFace} from 'lucide-react';
import './Assistive.css';
/** Optional on-device controls; frames are never uploaded. */
export function Assistive({flashcards=false}:{flashcards?:boolean}={}){
 const en=document.documentElement.lang==='en',t=(id:string,english:string)=>en?english:id;
 const [open,setOpen]=useState(false),[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[mode,setMode]=useState<'hand'|'nose'>('hand'),[status,setStatus]=useState(''),[gesture,setGesture]=useState<number|null>(null),[pointer,setPointer]=useState<{x:number;y:number;progress:number}|null>(null);
 const video=useRef<HTMLVideoElement>(null),stop=useRef<()=>void>(()=>{}),calibrate=useRef(false);
 const embedded=new URLSearchParams(window.location.search).get('embedded')==='1'||window.parent!==window;
 const disable=()=>{stop.current();setEnabled(false);setReady(false);setPointer(null);setGesture(null);setStatus(t('Kamera dimatikan.','Camera turned off.'));};
 useEffect(()=>()=>stop.current(),[]);
 useEffect(()=>{
  if(!enabled||embedded)return;
  let cancelled=false,cleaned=false,frame=0;let stream:MediaStream|undefined;
  let hand:import('@mediapipe/tasks-vision').HandLandmarker|undefined,face:import('@mediapipe/tasks-vision').FaceLandmarker|undefined;
  const cleanup=()=>{if(cleaned)return;cleaned=true;cancelled=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());hand?.close();face?.close();if(video.current)video.current.srcObject=null;};stop.current=cleanup;
  const run=async()=>{
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error(t('Kamera tidak tersedia di browser ini.','Camera unavailable in this browser.'));
    setStatus(t('Memuat kontrol lokal…','Loading local controls…'));
    const {FilesetResolver,HandLandmarker,FaceLandmarker}=await import('@mediapipe/tasks-vision');
    const files=await FilesetResolver.forVisionTasks('/vision/wasm');if(cancelled)return;
    const detector=mode==='hand'?await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/vision/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65}):await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/vision/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.65,minFacePresenceConfidence:.65,minTrackingConfidence:.65});
    if(cancelled){detector.close();return;}
    if(mode==='hand')hand=detector as import('@mediapipe/tasks-vision').HandLandmarker;else face=detector as import('@mediapipe/tasks-vision').FaceLandmarker;
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:480},height:{ideal:360}},audio:false});
    if(cancelled){acquired.getTracks().forEach(track=>track.stop());return;}stream=acquired;
    if(!video.current)throw new Error(t('Pratinjau kamera tidak tersedia.','Camera preview unavailable.'));
    video.current.srcObject=stream;await video.current.play();if(cancelled)return;setReady(true);setStatus(mode==='hand'?t('Tunjukkan tangan, lalu tahan gestur.','Show your hand and hold a gesture.'):t('Hadap lurus ke kamera selama kalibrasi.','Look straight at the camera during calibration.'));
    let lastTime=-1,candidate=-1,since=0,fired=-1;
    let center:{x:number;y:number}|null=null,samples:{x:number;y:number}[]=[],px=innerWidth/2,py=innerHeight/2;
    let target:HTMLElement|null=null,targetSince=0,clicked:HTMLElement|null=null;
    const tick=()=>{
     if(cancelled||!video.current)return;
     if(video.current.readyState>=2&&video.current.currentTime!==lastTime){
      lastTime=video.current.currentTime;const now=performance.now();
      try{
       if(hand){
        const points=hand.detectForVideo(video.current,now).landmarks[0];let count=-1;
        if(points){const distance=(a:number,b:number)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);count=[8,12,16,20].filter(tip=>distance(tip,0)>distance(tip-2,0)*1.18).length;if(count===4&&distance(4,17)>distance(3,17)*1.2)count=5;}
        if(count!==candidate){candidate=count;since=now;setGesture(count>0?count:null);if(count<=0)fired=-1;}
        if(count>0&&count!==fired&&now-since>=700){
         fired=count;const key=count===5?'Enter':String(count),active=document.activeElement;
         if(!(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement||active instanceof HTMLSelectElement))window.dispatchEvent(new KeyboardEvent('keydown',{key,code:key==='Enter'?'Enter':`Digit${key}`,bubbles:true}));
         setStatus(flashcards?t('Gestur kartu dikirim. Turunkan tangan sebelum mengulang.','Card gesture sent. Lower your hand before repeating.'):count===5?t('Lanjut dikirim. Turunkan tangan sebelum mengulang.','Next sent. Lower your hand before repeating.'):t(`Pilihan ${String.fromCharCode(64+count)} dikirim.`,`Choice ${String.fromCharCode(64+count)} sent.`));
        }
       }
       if(face){
        if(calibrate.current){calibrate.current=false;center=null;samples=[];target=null;clicked=null;setPointer(null);setStatus(t('Hadap lurus ke kamera selama kalibrasi.','Look straight at the camera during calibration.'));}
        const nose=face.detectForVideo(video.current,now).faceLandmarks[0]?.[1];
        if(!nose){target=null;clicked=null;setPointer(null);}
        else if(!center){
         samples.push({x:nose.x,y:nose.y});if(samples.length>=24){center={x:samples.reduce((a,p)=>a+p.x,0)/samples.length,y:samples.reduce((a,p)=>a+p.y,0)/samples.length};px=innerWidth/2;py=innerHeight/2;setStatus(t('Gerakkan kepala pelan. Diam di atas tombol selama 0,9 detik untuk klik.','Move your head slowly. Dwell on a button for 0.9 seconds to click.'));}
        }else{
         const x=Math.max(10,Math.min(innerWidth-10,innerWidth/2-(nose.x-center.x)*innerWidth*5));
         const y=Math.max(10,Math.min(innerHeight-10,innerHeight/2+(nose.y-center.y)*innerHeight*6));px+=(x-px)*.22;py+=(y-py)*.22;
         const element=document.elementFromPoint(px,py)?.closest<HTMLElement>('button,a[href],[role="button"]')??null;
         const available=element&&!element.matches(':disabled,[aria-disabled="true"]')?element:null;
         if(available!==target){target=available;targetSince=now;if(available!==clicked)clicked=null;}
         const progress=target&&target!==clicked?Math.min(1,(now-targetSince)/900):0;
         setPointer({x:px,y:py,progress});
         if(target&&target!==clicked&&progress>=1){clicked=target;target.click();}
        }
       }
      }catch{setStatus(t('Belum terbaca. Coba pencahayaan lebih terang.','Tracking unavailable. Try brighter lighting.'));}
     }
     frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
   }catch(e){if(!cancelled){cleanup();setEnabled(false);setReady(false);setPointer(null);setStatus(e instanceof Error?e.message:t('Kamera gagal dimulai.','Unable to start camera.'));}}
  };void run();return cleanup;
 },[enabled,mode,embedded]);
 return <div className="assistive"><button className="assistive-toggle" aria-expanded={open} onClick={()=>{if(open&&enabled)disable();setOpen(!open);}}><Hand size={15}/>{t('Kontrol kamera','Camera controls')}{enabled&&<span className="assistive-live"/>}</button>{open&&<aside className="assistive-panel" aria-label={t('Pengaturan kontrol kamera','Camera control settings')}><header><b><Hand size={16}/>{t('Kontrol kamera','Camera controls')}</b><button aria-label={t('Tutup dan matikan kamera','Close and stop camera')} onClick={()=>{disable();setOpen(false);}}><X size={17}/></button></header>{embedded?<><p>{t('Kontrol kamera tersedia di website.','Camera controls are available on the website.')}</p><a href={new URL('/',document.baseURI).href} target="_blank" rel="noreferrer">{t('Buka website Noodl','Open Noodl website')}</a></>:<><div className="assistive-modes" role="group" aria-label={t('Pilih kontrol','Choose controls')}><button disabled={enabled} aria-pressed={mode==='hand'} onClick={()=>setMode('hand')}><Hand size={15}/>{t('Tangan','Hand')}</button><button disabled={enabled} aria-pressed={mode==='nose'} onClick={()=>setMode('nose')}><ScanFace size={15}/>{t('Pointer hidung','Nose pointer')}</button></div><p>{mode==='hand'&&flashcards?t('Telapak untuk membalik. Setelah dibalik, tahan 1–4 jari untuk Lupa, Sulit, Bagus, atau Mudah.','Open palm flips. After flipping, hold 1–4 fingers to rate Again, Hard, Good or Easy.'):mode==='hand'?t('Angkat 1–4 jari untuk memilih A–D. Telapak terbuka untuk lanjut. Tahan 0,7 detik, lalu turunkan tangan sebelum mengulang.','Raise 1–4 fingers to choose A–D. Open palm moves forward. Hold for 0.7 seconds, then lower your hand before repeating.'):t('Hadap lurus saat kalibrasi. Gerakkan kepala untuk mengarahkan pointer. Diam di atas tombol selama 0,9 detik untuk klik.','Look straight during calibration. Move your head to steer the pointer. Dwell over a button for 0.9 seconds to click.')}</p><p className="assistive-note">{t('Kamera diproses lokal di perangkat. Tombol dan keyboard tetap bisa dipakai.','Camera frames stay on your device. Buttons and keyboard remain available.')}</p><video ref={video} muted playsInline className={enabled?'':'assistive-hidden'}/>{enabled&&ready&&mode==='hand'&&<div className="assistive-gesture">{gesture?flashcards?(gesture===5?t('Balik','Flip'):['Lupa','Sulit','Bagus','Mudah'][gesture-1]):gesture===5?t('Telapak → lanjut','Open palm → next'):`${gesture} → ${String.fromCharCode(64+gesture)}`:t('Menunggu tangan','Waiting for hand')}</div>}{enabled&&ready&&mode==='nose'&&<button className="assistive-calibrate" onClick={()=>{calibrate.current=true;}}>{t('Kalibrasi ulang','Recalibrate')}</button>}<button className={`assistive-power ${enabled?'is-on':''}`} onClick={()=>{if(enabled)disable();else setEnabled(true);}}>{enabled?<Power size={15}/>:<Camera size={15}/>} {enabled?t('Matikan kamera','Stop camera'):t('Aktifkan kamera','Start camera')}</button>{status&&<p role="status" className="assistive-status">{status}</p>}</>}</aside>}{enabled&&mode==='nose'&&pointer&&createPortal(<div className="assistive-nose-cursor" aria-hidden="true" style={{left:pointer.x,top:pointer.y,background:`conic-gradient(#7c3aed ${pointer.progress*360}deg,rgba(124,58,237,.15) 0)`}}><span/></div>,document.body)}</div>;
}
