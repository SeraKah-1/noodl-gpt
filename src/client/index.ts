import type {Preferences,WorkspacePreferences} from '../shared/preferences';
import type { Attempt, Operation, Pack, Publication, ReviewEvent, Snapshot, User } from '../shared/types';
import { LocalStore, type PendingOperation } from './store';
import { callHost, isEmbedded } from './bridge';
export { isEmbedded, requestTutor, sendChatRequest } from './bridge';
export { LocalStore } from './store';
export interface ClientState {
 user:User|null; packs:Pack[]; attempts:Attempt[]; reviews:ReviewEvent[]; online:boolean;
 pending:number; conflicts:PendingOperation[]; error:string|null; lastSync?:string; syncing:boolean;
 downloaded:string[]; initialized:boolean; preferences?:WorkspacePreferences;preferencesPending?:boolean;preferencesConflict?:boolean;
}
export class NoodlClient {
 private state:ClientState={user:null,packs:[],attempts:[],reviews:[],online:typeof navigator==='undefined'||navigator.onLine!==false,pending:0,conflicts:[],error:null,syncing:false,downloaded:[],initialized:false};
 private listeners=new Set<()=>void>(); private lease=crypto.randomUUID(); private syncTask?:Promise<void>;private initialization?:Promise<User|null>;private retryTimer?:ReturnType<typeof setTimeout>;private retryDelay=2000;private channel?:BroadcastChannel;
 constructor(private local=new LocalStore(),private fetcher:typeof fetch=fetch){ }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getState=()=>this.state;
 private patch(patch:Partial<ClientState>){this.state={...this.state,...patch};for(const l of this.listeners)l();}
 private async request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  if(isEmbedded()){
   const names:Record<string,string>={'/api/me':'app_identity','/api/snapshot':'app_snapshot','/api/mutate':'app_mutate'};
   if(names[path])return callHost<T>(names[path],(body??{}) as Record<string,unknown>);
   if(path==='/api/preferences')return callHost<T>(method==='GET'?'app_get_preferences':'app_update_preferences',(body??{}) as Record<string,unknown>);
   if(path==='/api/publications')return callHost<T>(method==='GET'?'app_publications':'app_publish',(body??{}) as Record<string,unknown>);
   const match=path.match(/^\/api\/publications\/([^/]+)(\/copy)?$/);
   if(match)return callHost<T>(match[2]?'app_copy_publication':'app_unpublish',{publicationId:decodeURIComponent(match[1]),...body as object});
  }
  const response=await this.fetcher(path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  if(!response.ok){const message=await response.text();const error=new Error(response.status===401?'Login kembali untuk menyinkronkan.':message||`HTTP ${response.status}`);Object.assign(error,{status:response.status});throw error;}
  return response.json() as Promise<T>;
 }
 async initialize():Promise<User|null>{return this.initialization??=this.initializeOnce();}
 private async initializeOnce():Promise<User|null>{
  if(typeof window!=='undefined'){
   window.addEventListener('online',()=>{this.patch({online:true});void this.sync();});
   window.addEventListener('offline',()=>this.patch({online:false}));
   window.addEventListener('focus',()=>{if(this.state.online)void this.sync();});
   window.addEventListener('noodl-host-update',()=>{if(this.state.online)void this.sync();});
   this.channel=new BroadcastChannel('noodl-sync');this.channel.onmessage=()=>{void this.refreshAccount();};
  }
  const profile=await this.local.profile();
  if(profile?.locked){this.patch({initialized:true});return null;}
  try{const user=await this.request<User>('/api/me');await this.local.setProfile(user);this.patch({user});}
  catch(error){if(profile&&!profile.locked)this.patch({user:profile.user});else this.patch({error:(error as Error).message});}
  await this.reload();this.patch({initialized:true});if(this.state.user&&this.state.online)await this.sync();return this.state.user;
 }
 private async refreshAccount(){
  const profile=await this.local.profile();
  if(profile?.locked||profile?.user.id!==this.state.user?.id){this.patch({user:null,packs:[],attempts:[],reviews:[],pending:0,conflicts:[],downloaded:[],preferences:undefined,preferencesPending:false,preferencesConflict:false});return;}
  await this.reload();
 }
 private async reload(){
  const owner=this.state.user?.id;if(!owner)return;
  const data=await this.local.read(owner);const preferences=await this.local.preferences(owner);const preferencePending=await this.local.pendingPreferences(owner);if(this.state.user?.id!==owner)return;
  this.patch({preferences,preferencesPending:!!preferencePending,packs:data.records.filter(r=>r.kind==='packs'&&!(r.value as Pack).deletedAt).map(r=>r.value as Pack),attempts:data.records.filter(r=>r.kind==='attempts'&&!(r.value as Attempt & {deletedAt?:string}).deletedAt).map(r=>r.value as Attempt),reviews:data.records.filter(r=>r.kind==='reviews'&&!(r.value as ReviewEvent & {deletedAt?:string}).deletedAt).map(r=>r.value as ReviewEvent),pending:data.pending.length,conflicts:data.pending.filter(r=>r.status==='conflict'),lastSync:data.lastSync,downloaded:data.records.filter(r=>r.kind==='packs'&&r.downloaded).map(r=>r.id)});
 }
 private owner(){if(!this.state.user)throw new Error('Login terlebih dahulu.');return this.state.user.id;}
 private async enqueue(kind:Operation['kind'],value:Pack|Attempt|ReviewEvent){const owner=this.owner();const next=await this.local.enqueue(owner,kind,value);await this.reload();this.channel?.postMessage('changed');if(this.state.online)void this.sync();return next;}
 async savePack(pack:Pack){return this.enqueue('pack.put',pack) as Promise<Pack>;}
 async deletePack(pack:Pack){await this.enqueue('pack.delete',pack);}
 async saveAttempt(attempt:Attempt){return this.enqueue('attempt.put',attempt) as Promise<Attempt>;}
 async addReview(event:ReviewEvent){return this.enqueue('review.add',event) as Promise<ReviewEvent>;}
 async downloadPack(pack:Pack){await this.local.markDownloaded(this.owner(),pack);await this.reload();}
 isDownloaded(id:string){return this.state.downloaded.includes(id);}
 async sync(){if(!this.state.user||!this.state.online)return;return this.syncTask??=(this.syncOnce().finally(()=>{this.syncTask=undefined;}));}
 private async syncOnce(){
  const owner=this.owner();this.patch({syncing:true,error:null});
  let succeeded=false;
  try{
   for(let sent=0;sent<500;sent++){
    if(this.state.user?.id!==owner)return;
    const row=await this.local.claim(owner,this.lease);if(!row)break;
    try{
     const reply=await this.request<{results:import('../shared/types').MutationResult[]}>('/api/mutate','POST',{operations:[row.operation]});
     const result=reply.results.find(r=>r.operationId===row.id);if(!result)throw new Error('Server belum mengakui perubahan; akan dicoba lagi.');
     await this.local.acknowledge(owner,result);
    }catch(error){await this.local.release(owner,row.id);throw error;}
   }
   const snapshot=await this.request<Snapshot>('/api/snapshot');
   if(this.state.user?.id===owner){await this.local.merge(owner,snapshot);await this.syncPreferences(owner);}
   succeeded=true;this.retryDelay=2000;this.channel?.postMessage('changed');
  }catch(error){
   this.patch({error:(error as Error).message});
   const status=(error as {status?:number}).status;
   if(status!==401&&this.state.user?.id===owner){clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{void this.sync();},this.retryDelay);this.retryDelay=Math.min(this.retryDelay*2,60000);this.retryTimer.unref?.();}
  }finally{await this.reload();this.patch({syncing:false});
   if(succeeded&&this.state.user?.id===owner&&(this.state.pending>this.state.conflicts.length||(this.state.preferencesPending&&!this.state.preferencesConflict))){clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{void this.sync();},1000);this.retryTimer.unref?.();}
  }
 }
 private async syncPreferences(owner:string){
  const pending=await this.local.pendingPreferences(owner);
  if(pending){try{const result=await this.request<WorkspacePreferences>('/api/preferences','PATCH',pending);await this.local.cachePreferences(owner,result,pending.operationId);this.patch({preferencesConflict:false});}catch(error){if((error as {status?:number}).status===409||/conflict|revision changed/i.test((error as Error).message)){this.patch({preferencesConflict:true,error:'Pengaturan berubah di perangkat lain. Muat versi server atau simpan ulang setelah memeriksanya.'});return;}throw error;}}
  const result=await this.request<WorkspacePreferences>('/api/preferences');if(this.state.user?.id===owner)await this.local.cachePreferences(owner,result);
 }
 async updatePreferences(patch:Partial<Preferences>){const owner=this.owner();await this.local.queuePreferences(owner,patch);this.patch({preferencesConflict:false});await this.reload();this.channel?.postMessage('changed');if(this.state.online)await this.sync();}
 async useServerPreferences(){const owner=this.owner();const result=await this.request<WorkspacePreferences>('/api/preferences');await this.local.discardPreferences(owner);await this.local.cachePreferences(owner,result);this.patch({preferencesConflict:false});await this.reload();}
 async resolveConflict(operationId:string,action:'server'|'copy'){
  const copy=await this.local.resolve(this.owner(),operationId,action);if(copy)await this.savePack(copy);await this.reload();if(this.state.online)void this.sync();
 }
 async logout(){clearTimeout(this.retryTimer);await this.local.lock();this.patch({user:null,packs:[],attempts:[],reviews:[],pending:0,conflicts:[],downloaded:[],preferences:undefined,preferencesPending:false,preferencesConflict:false});this.channel?.postMessage('changed');}
 async prepareLogin(){const profile=await this.local.profile();if(profile)await this.local.setProfile(profile.user,false);}
 async login(){
  const user=await this.request<User>('/api/me');await this.local.setProfile(user);this.patch({user});await this.reload();await this.sync();return user;
 }
 async listPublications():Promise<Publication[]>{const reply=await this.request<{publications:Publication[]}>('/api/publications');return reply.publications;}
 async publishPack(id:string){const pack=this.state.packs.find(p=>p.id===id);if(!pack)throw new Error('Bank tidak ditemukan.');if((await this.local.read(this.owner())).pending.some(p=>p.operation.entityId===id))throw new Error('Sinkronkan perubahan bank sebelum membagikan.');return this.request<Publication>('/api/publications','POST',{packId:id,expectedRevision:pack.revision,operationId:crypto.randomUUID()});}
 async unpublish(id:string){await this.request(`/api/publications/${encodeURIComponent(id)}`,'DELETE');}
 async copyPublication(id:string){const pack=await this.request<Pack>(`/api/publications/${encodeURIComponent(id)}/copy`,'POST',{operationId:crypto.randomUUID()});await this.sync();return pack;}
 async dispose(){clearTimeout(this.retryTimer);this.channel?.close();await this.local.close();}
}
export const client=new NoodlClient();
