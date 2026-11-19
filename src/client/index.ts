import type {Preferences,WorkspacePreferences} from '../shared/preferences';
import type { Attempt, Operation, Pack, Publication, ReviewEvent, Snapshot, User } from '../shared/types';
import { requestTooLarge, validatePackInput, type PackInput } from '../shared/validation';
import { LocalStore, samePackContent, type PendingOperation } from './store';
import { callHost, isEmbedded } from './bridge';
export { isEmbedded, requestTutor, sendChatRequest } from './bridge';
export { LocalStore } from './store';
export interface ClientState {
 guest?:boolean; localOnly?:boolean; user:User|null; packs:Pack[]; attempts:Attempt[]; reviews:ReviewEvent[]; online:boolean;
 pending:number; conflicts:PendingOperation[]; error:string|null; lastSync?:string; syncing:boolean;
 downloaded:string[]; initialized:boolean; preferences?:WorkspacePreferences;preferencesPending?:boolean;preferencesConflict?:boolean;
}
export class NoodlClient {
 private state:ClientState={user:null,packs:[],attempts:[],reviews:[],online:typeof navigator==='undefined'||navigator.onLine!==false,pending:0,conflicts:[],error:null,syncing:false,downloaded:[],initialized:false};
 private listeners=new Set<()=>void>(); private lease=crypto.randomUUID(); private syncTask?:{owner:string;task:Promise<void>};private initialization?:Promise<User|null>;private retryTimer?:ReturnType<typeof setTimeout>;private retryDelay=2000;private channel?:BroadcastChannel;
 constructor(private local=new LocalStore(),private fetcher:typeof fetch=(input,init)=>fetch(input,init)){ }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getState=()=>this.state;
 private patch(patch:Partial<ClientState>){this.state={...this.state,...patch};for(const l of this.listeners)l();}
 private async request<T>(path:string,method='GET',body?:unknown,guestOwner=this.state.guest?this.state.user?.id:undefined,expectedOwner=this.state.user?.id):Promise<T>{
  const serialized=body===undefined?undefined:JSON.stringify(body);
  if(path==='/api/mutate'&&serialized!==undefined&&requestTooLarge(serialized)) {
   throw Object.assign(new Error('Perubahan melebihi batas sinkronisasi 8 MiB.'),{status:413});
  }
  if(isEmbedded()){
   const appArgs = {...body as object,...(expectedOwner?{expectedOwner}:{})};
   const names:Record<string,string>={'/api/me':'app_identity','/api/snapshot':'app_snapshot','/api/mutate':'app_mutate'};
   if(names[path])return callHost<T>(names[path],path==='/api/me'?{}:appArgs);
   if(path==='/api/preferences')return callHost<T>(method==='GET'?'app_get_preferences':'app_update_preferences',appArgs);
   if(path==='/api/publications')return callHost<T>(method==='GET'?'app_publications':'app_publish',appArgs);
   const match=path.match(/^\/api\/publications\/([^/]+)(\/copy)?$/);
   if(match)return callHost<T>(match[2]?'app_copy_publication':'app_unpublish',{publicationId:decodeURIComponent(match[1]),...appArgs});
  }
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (guestOwner) headers.set('X-Noodl-Guest', guestOwner);
  if (expectedOwner&&path!=='/api/me'&&path!=='/api/guest') headers.set('X-Noodl-Owner',expectedOwner);
  const response = await this.fetcher(path, {method, credentials:'same-origin', headers, body: serialized});
  if (!response.ok) {
   const detail = await response.text();
   let message = detail;
   try { message = JSON.parse(detail).error ?? detail; } catch {}
   if (response.status === 401) message = guestOwner ? 'Sesi guest di server tidak tersedia. Salinan di browser ini masih bisa dibuka.' : 'Login kembali untuk menyinkronkan.';
   throw Object.assign(new Error(message || `HTTP ${response.status}`), {status: response.status});
  }
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
  const profile = await this.local.profile();
  if (profile?.locked) { this.patch({initialized: true}); return null; }

  if (!isEmbedded() && profile?.user.id.startsWith('guest:')) return this.useLocalGuest();

  const cloudGuest = !isEmbedded() && profile?.user.id.startsWith('web-guest:') ? profile.user : undefined;
  try {
   const user = await this.request<User>('/api/me', 'GET', undefined, cloudGuest?.id ?? '');
   if (cloudGuest && user.id !== cloudGuest.id) {
    this.patch({user: cloudGuest, guest: true, error: 'Sesi guest sudah berganti. Ekspor bank lokal untuk menyimpannya.'});
   } else {
    await this.local.setProfile(user);
    this.patch({user, guest: !!cloudGuest});
   }
  } catch (error) {
   if (!isEmbedded() && !profile && ((error as {status?:number}).status===401 || (error as {status?:number}).status===undefined)) return this.startGuest();
   if (profile) this.patch({user: profile.user, guest: !!cloudGuest, error: (error as Error).message});
   else this.patch({error: (error as Error).message});
  }
  await this.reload();
  this.patch({initialized: true});
  if (this.state.user && this.state.online) await this.sync();
  return this.state.user;
 }

 async startGuest(): Promise<User> {
  if (isEmbedded()) return this.useLocalGuest();
  try {
   return await this.enableGuestStorage();
  } catch {
   return this.useLocalGuest();
  }
 }

 async enableGuestStorage(requireAllBanks = false): Promise<User> {
  if (isEmbedded()) throw new Error('Buka Noodl di browser untuk memakai penyimpanan guest.');
  // Serialize first-session creation across tabs when the browser supports Web Locks.
  const open = async () => {
   const user = await this.request<User>('/api/guest', 'POST', undefined, '');
   if (!user.id?.startsWith('web-guest:')) throw new Error('Server belum menyediakan penyimpanan guest.');
   const conflicts = await this.local.adoptLocalGuestBanks(user.id);
   const message = 'Versi bank lokal dan server berbeda. Buka ruang guest lokal untuk mengekspor bank yang belum tersalin.';
   if (requireAllBanks && conflicts.length) throw new Error(message);
   await this.switchToGuest(user, false);
   await this.sync();
   if (conflicts.length) this.patch({error:message});
   return user;
  };
  return typeof navigator !== 'undefined' && navigator.locks
   ? navigator.locks.request('noodl-guest-session', open)
   : open();
 }

 async useLocalGuest(): Promise<User> {
  const user = await this.local.guestUser();
  await this.switchToGuest(user, true);
  return user;
 }

 private async switchToGuest(user: User, localOnly: boolean) {
  clearTimeout(this.retryTimer);
  await this.local.setProfile(user);
  this.patch({user, guest:true, localOnly, packs:[], attempts:[], reviews:[], preferences:undefined,
   preferencesPending:false, preferencesConflict:false, pending:0, conflicts:[], error:null, initialized:true});
  await this.reload();
 }
 private async refreshAccount(){
  const profile=await this.local.profile();
  if(profile?.locked||profile?.user.id!==this.state.user?.id){this.patch({guest:false,localOnly:false,user:null,packs:[],attempts:[],reviews:[],pending:0,conflicts:[],downloaded:[],preferences:undefined,preferencesPending:false,preferencesConflict:false});return;}
  await this.reload();
 }
 private async reload(){
  const owner=this.state.user?.id;if(!owner)return;
  const data=await this.local.read(owner);const preferences=await this.local.preferences(owner);const preferencePending=await this.local.pendingPreferences(owner);if(this.state.user?.id!==owner)return;
  this.patch({preferences,preferencesPending:!!preferencePending,packs:data.records.filter(r=>r.kind==='packs'&&!(r.value as Pack).deletedAt).map(r=>r.value as Pack),attempts:data.records.filter(r=>r.kind==='attempts'&&!(r.value as Attempt & {deletedAt?:string}).deletedAt).map(r=>r.value as Attempt),reviews:data.records.filter(r=>r.kind==='reviews'&&!(r.value as ReviewEvent & {deletedAt?:string}).deletedAt).map(r=>r.value as ReviewEvent),pending:data.pending.length,conflicts:data.pending.filter(r=>r.status==='conflict'),lastSync:data.lastSync,downloaded:data.records.filter(r=>r.kind==='packs'&&r.downloaded).map(r=>r.id)});
 }
 private owner(){if(!this.state.user)throw new Error('Login terlebih dahulu.');return this.state.user.id;}
 private async enqueue(kind:Operation['kind'],value:Pack|Attempt|ReviewEvent){const owner=this.owner();const next=this.state.localOnly?await this.local.saveGuest(owner,kind,value):await this.local.enqueue(owner,kind,value);await this.afterWrite();return next;}
 async savePack(pack:Pack){return this.enqueue('pack.put',pack) as Promise<Pack>;}
 async renamePack(id:string,owner:string,metadata:Pick<Pack,'title'|'folder'>){
  if(this.owner()!==owner)throw new Error('Data ini milik akun lain.');
  await this.local.renamePack(owner,id,metadata,!!this.state.localOnly);
  await this.afterWrite();
 }
 private async afterWrite(){
  await this.reload();
  this.channel?.postMessage('changed');
  if(this.state.online)void this.sync();
 }
 async deletePack(pack:Pack){await this.enqueue('pack.delete',pack);}
 async saveAttempt(attempt:Attempt){return this.enqueue('attempt.put',attempt) as Promise<Attempt>;}
 async addReview(event:ReviewEvent){return this.enqueue('review.add',event) as Promise<ReviewEvent>;}
 async downloadPack(pack:Pack){await this.local.markDownloaded(this.owner(),pack);await this.reload();}
 isDownloaded(id:string){return this.state.downloaded.includes(id);}
 async sync():Promise<void>{
  const owner=this.state.user?.id;
  if(!owner||!this.state.online||this.state.localOnly)return;
  if(this.syncTask){
   if(this.syncTask.owner===owner)return this.syncTask.task;
   await this.syncTask.task;
   if(this.state.user?.id===owner)return this.sync();
   return;
  }
  const guestOwner=this.state.guest?owner:undefined;
  clearTimeout(this.retryTimer);
  const task=this.syncOnce(owner,guestOwner).finally(()=>{this.syncTask=undefined;});
  this.syncTask={owner,task};
  return task;
 }
 private async syncOnce(owner:string,guestOwner:string|undefined){
  this.patch({syncing:true,error:null});
  let succeeded=false;
  try{
   for(let sent=0;sent<500;sent++){
    if(this.state.user?.id!==owner)return;
    const row=await this.local.claim(owner,this.lease);if(!row)break;
    try{
     if(this.state.user?.id!==owner){await this.local.release(owner,row.id);return;}
     const batch={operations:[row.operation],expectedOwner:owner};
     const reply=await this.request<{results:import('../shared/types').MutationResult[]}>('/api/mutate','POST',batch,guestOwner??'',owner);
     const result=reply.results.find(r=>r.operationId===row.id);if(!result)throw new Error('Server belum mengakui perubahan; akan dicoba lagi.');
     await this.local.acknowledge(owner,result);
    }catch(error){
     const status=(error as {status?:number}).status;
     if(status===400||status===413||status===422){
      await this.local.acknowledge(owner,{operationId:row.id,ok:false,code:'INVALID',error:(error as Error).message});
      continue;
     }
     await this.local.release(owner,row.id);throw error;
    }
   }
   if(this.state.user?.id!==owner)return;
   const snapshot=await this.request<Snapshot>('/api/snapshot','GET',undefined,guestOwner??'',owner);
   if(this.state.user?.id===owner){await this.local.merge(owner,snapshot);await this.syncPreferences(owner,guestOwner??'');}
   succeeded=true;this.retryDelay=2000;this.channel?.postMessage('changed');
  }catch(error){
   if(this.state.user?.id!==owner)return;
   this.patch({error:(error as Error).message});
   const status=(error as {status?:number}).status;
   if(status!==401){clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{void this.sync();},this.retryDelay);this.retryDelay=Math.min(this.retryDelay*2,60000);this.retryTimer.unref?.();}
  }finally{
   await this.reload();this.patch({syncing:false});
   if(succeeded&&this.state.user?.id===owner){
    const {hasSyncable}=await this.local.read(owner);
    if(this.state.user?.id===owner&&(hasSyncable||(this.state.preferencesPending&&!this.state.preferencesConflict))){
     clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{void this.sync();},1000);this.retryTimer.unref?.();
    }
   }
  }
 }
 private async syncPreferences(owner:string,guestOwner:string){
  const pending=await this.local.pendingPreferences(owner);
  if(this.state.user?.id!==owner)return;
  if(pending){try{const result=await this.request<WorkspacePreferences>('/api/preferences','PATCH',pending,guestOwner,owner);await this.local.cachePreferences(owner,result,pending.operationId);if(this.state.user?.id===owner)this.patch({preferencesConflict:false});}catch(error){if((error as {status?:number}).status===409||/conflict|revision changed/i.test((error as Error).message)){if(this.state.user?.id===owner)this.patch({preferencesConflict:true,error:'Pengaturan berubah di perangkat lain. Muat versi server atau simpan ulang setelah memeriksanya.'});return;}throw error;}}
  if(this.state.user?.id!==owner)return;
  const result=await this.request<WorkspacePreferences>('/api/preferences','GET',undefined,guestOwner,owner);if(this.state.user?.id===owner)await this.local.cachePreferences(owner,result);
 }
 async updatePreferences(patch:Partial<Preferences>){const owner=this.owner();const queued=await this.local.queuePreferences(owner,patch);if(this.state.localOnly){const pending=await this.local.pendingPreferences(owner);await this.local.cachePreferences(owner,queued,pending!.operationId);}this.patch({preferencesConflict:false});await this.reload();this.channel?.postMessage('changed');if(this.state.online)await this.sync();}
 async useServerPreferences(){if(this.state.localOnly)return;const owner=this.owner();const result=await this.request<WorkspacePreferences>('/api/preferences');await this.local.discardPreferences(owner);await this.local.cachePreferences(owner,result);this.patch({preferencesConflict:false});await this.reload();}
 async resolveConflict(operationId:string,action:'server'|'copy'){
  const copy=await this.local.resolve(this.owner(),operationId,action);if(copy)await this.savePack(copy);await this.reload();if(this.state.online)void this.sync();
 }
 async logout(){clearTimeout(this.retryTimer);await this.local.lock();this.patch({guest:false,localOnly:false,user:null,packs:[],attempts:[],reviews:[],pending:0,conflicts:[],downloaded:[],preferences:undefined,preferencesPending:false,preferencesConflict:false});this.channel?.postMessage('changed');}
 async prepareAccountLogin(){clearTimeout(this.retryTimer);await this.local.clearProfile();}
 async prepareLogin(){const profile=await this.local.profile();if(profile)await this.local.setProfile(profile.user,false);}
 async login(){
  const user=await this.request<User>('/api/me','GET',undefined,'');await this.local.setProfile(user);this.patch({user,guest:false,localOnly:false});await this.reload();await this.sync();return user;
 }
 async listPublications(): Promise<Publication[]> {
  const reply = await this.request<{publications: Publication[]}>(this.state.guest ? '/api/public/catalog' : '/api/publications');
  return reply.publications;
 }
 async getPublication(id: string): Promise<Publication> {
  return this.request(`/api/public/catalog/${encodeURIComponent(id)}`);
 }
 private async syncedPack(id: string) {
  const source = this.state.localOnly ? this.state.packs.find(p => p.id === id) : undefined;
  const owner = this.state.localOnly ? (await this.enableGuestStorage()).id : this.owner();
  await this.sync();
  if (this.owner() !== owner) throw new Error('Akun aktif sudah berubah.');
  const pack = this.state.packs.find(p => p.id === id);
  if (!pack) throw new Error('Bank tidak ditemukan.');
  if (source && !samePackContent(source,pack)) throw new Error('Versi bank lokal belum tersalin ke server.');
  if ((await this.local.read(owner)).pending.some(p => p.operation.kind.startsWith('pack.') && p.operation.entityId === id)) {
   throw new Error('Sinkronkan perubahan bank sebelum membagikan.');
  }
  return pack;
 }
 async publishPack(id: string) {
  const pack = await this.syncedPack(id);
  return this.request<Publication>('/api/publications', 'POST', {
   packId: id, expectedRevision: pack.revision, operationId: crypto.randomUUID()
  }, pack.ownerId.startsWith('web-guest:')?pack.ownerId:'', pack.ownerId);
 }
 async unpublishPack(id: string) {
  if (this.state.localOnly) throw new Error('Aktifkan penyimpanan guest untuk mengelola publikasi.');
  await this.request(`/api/publications/${encodeURIComponent(this.owner() + ':' + id)}`, 'DELETE');
 }
 async copyPublication(id: string) {
  if (this.state.guest) return this.importLocalPack((await this.getPublication(id)).pack);
  const pack = await this.request<Pack>(`/api/publications/${encodeURIComponent(id)}/copy`, 'POST', {operationId: crypto.randomUUID()});
  await this.sync();
  return pack;
 }
 async storageStatus() {
  return this.request<{configured: boolean}>('/api/storage');
 }
 async backupBanks() {
  const owner = this.state.localOnly ? (await this.enableGuestStorage(true)).id : this.owner();
  await this.sync();
  const {pending} = await this.local.read(owner);
  if (this.owner() !== owner) throw new Error('Akun aktif sudah berubah.');
  if (pending.some(p => p.operation.kind.startsWith('pack.'))) {
   throw new Error('Selesaikan sinkronisasi bank sebelum membuat cadangan.');
  }
  return this.request<{ok: true; count: number}>('/api/storage/banks', 'PUT', undefined, owner.startsWith('web-guest:')?owner:'', owner);
 }
 async downloadBankBackup() {
  return this.request<{version: number; banks: PackInput[]}>('/api/storage/banks');
 }
 async importLocalPack(input:unknown){return (await this.importLocalBanks([input]))[0];}
 async importLocalBanks(inputs:unknown[]){
  const ownerId=this.owner(),time=new Date().toISOString();
  const packs=inputs.map(input=>({...validatePackInput(input),id:crypto.randomUUID(),ownerId,revision:0,createdAt:time,updatedAt:time}));
  const saved=await this.local.saveBanks(ownerId,packs,!!this.state.localOnly);
  await this.afterWrite();
  return saved;
 }
 async dispose(){clearTimeout(this.retryTimer);this.channel?.close();await this.local.close();}
}
export const client=new NoodlClient();
