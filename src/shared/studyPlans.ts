export const bloomLevels=['C1','C2','C3','C4','C5','C6'] as const;
export function bloomAllocation(total:number,weights:number[]):number[]{
 if(!Number.isInteger(total)||total<1||weights.length!==6||weights.some(n=>!Number.isInteger(n)||n<0||n>100)||weights.reduce((a,b)=>a+b,0)!==100)throw new Error('Total persentase Bloom harus 100%.');
 const quotas=weights.map(weight=>total*weight/100);
 const counts=quotas.map(Math.floor);
 const remaining=total-counts.reduce((a,b)=>a+b,0);
 const order=quotas.map((quota,i)=>({i,fraction:quota-counts[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(const {i} of order.slice(0,remaining))counts[i]++;
 return counts;
}
export function generationBrief(total:number,weights:number[]|null,source:string,instructions:string){
 const counts=weights?bloomAllocation(total,weights):null;
 return [
  counts?'Bloom: '+counts.map((count,i)=>count+' '+bloomLevels[i]).join(', '):'',
  source.trim()?'Sumber belajar: '+source.trim()+'. Jika sumber belum tersedia dalam percakapan, minta pengguna melampirkannya.':'',
  instructions.trim()
 ].filter(Boolean).join('\n');
}
export function dailyStudyCalendar(time:string,now:Date,uid:string){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Pilih waktu yang valid.');
 const [hour,minute]=time.split(':').map(Number);
 const first=new Date(now);first.setHours(hour,minute,0,0);
 if(first<=now)first.setDate(first.getDate()+1);
 const pad=(n:number)=>String(n).padStart(2,'0');
 const date=String(first.getFullYear())+pad(first.getMonth()+1)+pad(first.getDate());
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Noodl//Study//ID','BEGIN:VEVENT',
  'UID:'+uid+'@noodl','DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),
  'DTSTART:'+date+'T'+time.replace(':','')+'00','DURATION:PT30M','RRULE:FREQ=DAILY','SUMMARY:Latihan Noodl',
  'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Latihan Noodl','END:VALARM',
  'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
