import {useEffect,useState} from 'react';

export function StudyDeskSkeleton({label='Menyiapkan ruang belajar…'}:{label?:string}){
 const [show,setShow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setShow(true),180);return()=>clearTimeout(timer);},[]);
 return <div className="desk-boot" aria-busy="true" role="status">
  {show?<div className="desk-boot-content"><span className="desk-boot-logo">noodl<span>✦</span></span>
   <div className="desk-skeleton desk-skeleton-line" aria-hidden="true"/>
   <div className="desk-skeleton desk-skeleton-hero" aria-hidden="true"/>
   <div className="desk-skeleton desk-skeleton-row" aria-hidden="true"/>
   <div className="desk-skeleton desk-skeleton-row desk-skeleton-short" aria-hidden="true"/>
  </div>:<span className="desk-boot-minimal">noodl✦</span>}
  <span className="sr-only">{label}</span>
 </div>;
}

export function CatalogSkeleton({label='Memuat bank publik…'}:{label?:string}){
 return <section className="desk-catalog-loading" role="status" aria-busy="true">
  <p>{label}</p><div className="desk-library-grid desk-catalog-grid" aria-hidden="true">
   {[0,1,2].map(i=><div key={i} className="desk-skeleton desk-catalog-card"/>)}
  </div>
 </section>;
}
