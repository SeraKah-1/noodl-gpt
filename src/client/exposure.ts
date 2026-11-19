import {LocalStore} from './store';
import type {Exposure} from '../shared/practice';

const local=new LocalStore();
const key=(owner:string,pack:string)=>JSON.stringify(['autopilot',owner,pack]);
export async function readExposures(owner:string,pack:string):Promise<Exposure[]>{
  return await (await local.db()).get('meta',key(owner,pack)) as Exposure[]??[];
}
export async function saveExposure(owner:string,pack:string,session:Exposure){
  const snapshot=structuredClone(session);
  const tx=(await local.db()).transaction('meta','readwrite');
  const k=key(owner,pack);
  const sessions=(await tx.store.get(k) as Exposure[]|undefined)??[];
  const previous=sessions.find(s=>s.id===snapshot.id);
  if(!previous || (snapshot.shown.length>=previous.shown.length&&snapshot.activeMs>=previous.activeMs)){
    const recent=[...sessions.filter(s=>s.id!==snapshot.id),snapshot].sort((a,b)=>b.startedAt-a.startedAt);
    await tx.store.put(recent.slice(0,30),k);
  }
  await tx.done;
}
