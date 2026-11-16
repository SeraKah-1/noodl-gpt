import React,{useEffect,useRef,useState} from 'react';
import {Camera,Hand,Power,X} from 'lucide-react';
import './Assistive.css';
/** Optional, on-device gesture controls. No camera frames leave this browser. */
export function Assistive(){
 const [open,setOpen]=useState(false),[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[status,setStatus]=useState(''),[gesture,setGesture]=useState<number|null>(null);
 const video=useRef<HTMLVideoElement>(null);const stop=useRef<()=>void>(()=>{});
 const embedded=new URLSearchParams(window.location.search).get('embedded')==='1'||window.parent!==window;
 useEffect(()=>()=>stop.current(),[]);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false,frame=0;let stream:MediaStream|undefined;let tracker:import('@mediapipe/tasks-vision').HandLandmarker|undefined;
  const cleanup=()=>{cancelled=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());tracker?.close();if(video.current)video.current.srcObject=null;};stop.current=cleanup;
  const run=async()=>{
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera tidak tersedia di browser ini.');
    setStatus('Memuat kontrol lokal…');
    const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');
    const files=await FilesetResolver.forVisionTasks('/vision/wasm');if(cancelled)return;
    const detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/vision/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
    if(cancelled){detector.close();return;}tracker=detector;
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:480},height:{ideal:360}},audio:false});
    if(cancelled){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
    if(!video.current)throw new Error('Pratinjau kamera tidak tersedia.');video.current.srcObject=stream;await video.current.play();if(cancelled)return;setReady(true);setStatus('Tunjukkan tangan, lalu tahan gestur.');
    let lastTime=-1,candidate=-1,since=0,fired=-1;
    const tick=()=>{
     if(cancelled||!video.current||!tracker)return;
     if(video.current.readyState>=2&&video.current.currentTime!==lastTime){
      lastTime=video.current.currentTime;
      try{
       const points=tracker.detectForVideo(video.current,performance.now()).landmarks[0];let count=-1;
       if(points){const distance=(a:number,b:number)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);count=[8,12,16,20].filter(t=>distance(t,0)>distance(t-2,0)*1.18).length;
        // Thumb extension distinguishes open palm (Enter) from four fingers (D).
        if(count===4&&distance(4,17)>distance(3,17)*1.2)count=5;
       }
       const now=performance.now();
       if(count!==candidate){candidate=count;since=now;setGesture(count>0?count:null);if(count<=0)fired=-1;}
       if(count>0&&count!==fired&&now-since>=700){
        fired=count;const key=count===5?'Enter':String(count);
        const active=document.activeElement;
        // Do not type a gesture into a free-text answer or unrelated input.
        if(!(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement||active instanceof HTMLSelectElement))window.dispatchEvent(new KeyboardEvent('keydown',{key,code:key==='Enter'?'Enter':`Digit${key}`,bubbles:true}));
        setStatus(count===5?'Lanjut dikirim. Lepaskan tangan untuk mengulang.':`Pilihan ${String.fromCharCode(64+count)} dikirim. Lepaskan tangan untuk mengulang.`);
       }
      }catch{setStatus('Tangan belum terbaca. Coba pencahayaan lebih terang.');}
     }
     frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
   }catch(e){if(!cancelled){cleanup();setEnabled(false);setReady(false);setStatus(e instanceof Error?e.message:'Kamera gagal dimulai.');}}
  };void run();return cleanup;
 },[enabled]);
 return <div className="assistive"><button className="assistive-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><Hand size={15}/>Kontrol tangan{enabled&&<span className="assistive-live"/>}</button>{open&&<aside className="assistive-panel" aria-label="Pengaturan kontrol tangan"><header><b><Hand size={16}/>Kontrol tangan</b><button aria-label="Tutup pengaturan kamera" onClick={()=>setOpen(false)}><X size={17}/></button></header>{embedded?<><p>Kontrol kamera tersedia di website.</p><a href={`${window.location.origin}/`} target="_blank" rel="noreferrer">Buka website Noodl</a></>:<><p>Angkat 1–4 jari untuk memilih A–D. Telapak terbuka untuk lanjut. Tahan 0,7 detik, lalu turunkan tangan sebelum mengulang.</p><p className="assistive-note">Kamera diproses lokal di perangkat. Tombol dan keyboard tetap bisa dipakai.</p><video ref={video} muted playsInline className={enabled?'':'assistive-hidden'}/>{enabled&&ready&&<div className="assistive-gesture">{gesture?gesture===5?'Telapak → lanjut':`${gesture} jari → ${String.fromCharCode(64+gesture)}`:'Menunggu tangan'}</div>}<button className={`assistive-power ${enabled?'is-on':''}`} onClick={()=>{if(enabled){stop.current();setReady(false);setEnabled(false);setGesture(null);setStatus('Kamera dimatikan.');}else setEnabled(true);}}>{enabled?<Power size={15}/>:<Camera size={15}/>} {enabled?'Matikan kamera':'Aktifkan kamera'}</button>{status&&<p role="status" className="assistive-status">{status}</p>}</>}</aside>}</div>;
}
