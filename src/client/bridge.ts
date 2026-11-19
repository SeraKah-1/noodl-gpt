import { App } from '@modelcontextprotocol/ext-apps';
import type { Pack, Question } from '../shared/types';

export function isEmbedded(): boolean {
 return typeof window !== 'undefined' && (window.parent !== window || new URLSearchParams(window.location.search).get('embedded')==='1');
}
let connection: Promise<App>|undefined;
export async function hostApp(): Promise<App> {
 if (!isEmbedded()) throw new Error('Panel ChatGPT tidak tersedia.');
 return connection ??= (async()=>{
  const app=new App({name:'Noodl',version:'1.0.0'},{});
  app.ontoolresult=(result)=>{const data=result.structuredContent;if(data&&typeof data==='object'&&('packId' in data||'pack' in data||'id' in data||'view' in data||'attemptId' in data||'design' in data||'preferences' in data))window.dispatchEvent(new CustomEvent('noodl-host-update',{detail:data}));};
  await app.connect();
  return app;
 })().catch(error=>{connection=undefined;throw error;});
}
export async function callHost<T>(name:string,args:Record<string,unknown>={}):Promise<T> {
 const result=await (await hostApp()).callServerTool({name,arguments:args});
 if(result.isError) {
  const error = new Error(result.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n')||'Operasi gagal.');
  throw Object.assign(error,{status:result._meta?.['noodl/status']});
 }
 if(result.structuredContent!==undefined) return result.structuredContent as T;
 const block=result.content?.find(x=>x.type==='text');
 if(block?.type==='text') return JSON.parse(block.text) as T;
 throw new Error('Server tidak mengembalikan data.');
}
export async function sendChatRequest(message:string,context?:unknown):Promise<void> {
 if(isEmbedded()){
  const app=await hostApp();
  if(context) await app.updateModelContext({content:[{type:'text',text:JSON.stringify(context)}]});
  await app.sendMessage({role:'user',content:[{type:'text',text:message}]});
 }else{
  const text=context?`${message}\n\nKonteks Noodl:\n${JSON.stringify(context)}`:message;
  // Copy before opening: browsers may block navigation after an asynchronous clipboard operation.
  const opened=window.open('https://chatgpt.com/','_blank','noopener,noreferrer');
  try{await navigator.clipboard.writeText(text);}catch{opened?.close();throw new Error('Salin konteks gagal. Gunakan panel ChatGPT atau izinkan clipboard.');}
 }
}
export async function requestTutor(pack:Pack,question?:Question,message?:string):Promise<void>{
 const guest=pack.ownerId.startsWith('web-guest:')||pack.ownerId.startsWith('guest:');
 const prompt=message??(question?'Jelaskan soal ini dan bantu saya memahami konsepnya.':'Bantu saya mempelajari bank soal ini.');
 await sendChatRequest(guest?prompt+' Bank ini milik guest browser. Untuk hasil baru, kembalikan bank JSON lengkap yang bisa diimpor dari File. Pertahankan soal dan artefak yang ada.':prompt,{packId:pack.id,title:pack.title,revision:pack.revision,...(question?{question}:{questions:pack.questions,...(guest?{artifacts:pack.artifacts,description:pack.description,tags:pack.tags}:{})})});
}
