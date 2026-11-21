import type {WorkspacePreferences,Preferences} from '../shared/preferences';
import {defaultPreferences,mergePreferences} from '../shared/preferences';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attempt, MutationResult, Operation, Pack, ReviewEvent, Snapshot, User } from '../shared/types';
import type {SweepDecision} from '../shared/examCoverage';

type RecordValue = Pack | Attempt | ReviewEvent;
type Kind = 'packs' | 'attempts' | 'reviews';
type PackMetadata = Pick<Pack, 'title' | 'folder'>;
type Adoption = { localRevision: number; cloudRevision: number };
const recordKind = (kind: Operation['kind']): Kind =>
 kind.startsWith('pack.') ? 'packs' : kind === 'attempt.put' ? 'attempts' : 'reviews';
const entityKey = ({operation}: PendingOperation) => JSON.stringify([recordKind(operation.kind), operation.entityId]);
function unblocked(rows: PendingOperation[]) {
 const blocked = new Set(rows.filter(row => row.status === 'conflict').map(entityKey));
 return rows.filter(row => row.status === 'pending' && !blocked.has(entityKey(row)));
}
export function samePackContent(a: Pack, b: Pack) {
 const content = ({title,folder,description,tags,questions,artifacts}: Pack) => ({title,folder,description,tags,questions,artifacts});
 return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
export interface StoredRecord { ownerId: string; id: string; kind: Kind; value: RecordValue; downloaded?: boolean }
export interface PendingOperation { ownerId: string; id: string; sequence: number; operation: Operation; status: 'pending'|'conflict'; failure?: MutationResult; leaseOwner?: string; leaseUntil?: number }
interface LocalSchema extends DBSchema {
 records: { key: [string, Kind, string]; value: StoredRecord; indexes: { owner: string } };
 outbox: { key: [string, string]; value: PendingOperation; indexes: { owner: string } };
 meta: { key: string; value: unknown };
}
export class LocalStore {
 private database?: Promise<IDBPDatabase<LocalSchema>>;
 constructor(private name = 'noodl-chatgpt-v1') {}
 db() {
  return this.database ??= openDB<LocalSchema>(this.name, 1, { upgrade(db) {
   db.createObjectStore('records', {keyPath:['ownerId','kind','id']}).createIndex('owner','ownerId');
   db.createObjectStore('outbox', {keyPath:['ownerId','id']}).createIndex('owner','ownerId');
   db.createObjectStore('meta');
  }});
 }
 /** All Sweep decisions are isolated by account and bank and are never answer events. */
 async coverage(ownerId:string,packId:string){
  const db=await this.db();
  const events=(await db.get('meta',`${ownerId}:coverage:${packId}`)) as SweepDecision[]|undefined;
  const queue=(await db.get('meta',`${ownerId}:coverage-pending`)) as
   {event:SweepDecision;status:'pending'|'conflict';error?:string}[]|undefined;
  return {decisions:events??[],pending:(queue??[]).filter(row=>row.event.packId===packId&&row.status==='pending').length,
   conflicts:(queue??[]).filter(row=>row.event.packId===packId&&row.status==='conflict')};
 }
 async saveCoverage(ownerId:string,event:SweepDecision,localOnly:boolean){
  if(ownerId!==event.ownerId)throw new Error('Different owner for Sweep decision');
  if(localOnly&&!ownerId.startsWith('guest:'))throw new Error('Expected a local Guest');
  const db=await this.db(),tx=db.transaction('meta','readwrite');
  const key=`${ownerId}:coverage:${event.packId}`,pendingKey=`${ownerId}:coverage-pending`;
  const existing=(await tx.store.get(key)) as SweepDecision[]|undefined??[];
  const pending=(await tx.store.get(pendingKey)) as
   {event:SweepDecision;status:'pending'|'conflict';error?:string}[]|undefined??[];
  const same=existing.find(v=>v.id===event.id);
  if(same){if(JSON.stringify(same)!==JSON.stringify(event))throw new Error('Sweep decision ID was reused');await tx.done;return;}
  if(existing.length>=3000||pending.length>=3000)throw new Error('Too many Sweep decisions pending; resolve sync before adding more');
  await tx.store.put([...existing,event],key);
  if(!localOnly)await tx.store.put([...pending,{event,status:'pending'}],pendingKey);
  await tx.done;
 }
 async pendingCoverage(ownerId:string){
  const pending=(await (await this.db()).get('meta',`${ownerId}:coverage-pending`)) as
   {event:SweepDecision;status:'pending'|'conflict';error?:string}[]|undefined;
  return (pending??[]).filter(r=>r.status==='pending').map(r=>r.event);
 }
 async coverageConfirmed(ownerId:string,event:SweepDecision){
  const db=await this.db(),tx=db.transaction('meta','readwrite');
  const key=`${ownerId}:coverage:${event.packId}`,pendingKey=`${ownerId}:coverage-pending`;
  const entries=(await tx.store.get(key)) as SweepDecision[]|undefined??[];
  const queue=(await tx.store.get(pendingKey)) as {event:SweepDecision;status:'pending'|'conflict';error?:string}[]|undefined??[];
  await tx.store.put(entries.some(e=>e.id===event.id)?entries.map(e=>e.id===event.id?event:e):[...entries,event],key);
  await tx.store.put(queue.filter(x=>x.event.id!==event.id),pendingKey);
  await tx.done;
 }
 async coverageConflict(ownerId:string,eventId:string,error:string){
  const db=await this.db(),key=`${ownerId}:coverage-pending`;
  const queue=(await db.get('meta',key)) as {event:SweepDecision;status:'pending'|'conflict';error?:string}[]|undefined??[];
  const next=queue.map(row=>row.event.id===eventId?{...row,status:'conflict' as const,error}:row);
  await db.put('meta',next,key);
 }
 async mergeCoverage(ownerId:string,packId:string,remote:SweepDecision[]){
  const db=await this.db(),key=`${ownerId}:coverage:${packId}`;
  const local=(await db.get('meta',key)) as SweepDecision[]|undefined??[];
  const events=new Map(local.map(e=>[e.id,e]));
  for(const event of remote)if(event.ownerId===ownerId&&event.packId===packId)events.set(event.id,event);
  await db.put('meta',[...events.values()],key);
 }
 async preferences(ownerId:string):Promise<WorkspacePreferences|undefined>{return await (await this.db()).get('meta',`${ownerId}:preferences`) as WorkspacePreferences|undefined;}
 async pendingPreferences(ownerId:string):Promise<{operationId:string;expectedRevision:number;patch:Preferences}|undefined>{return await (await this.db()).get('meta',`${ownerId}:preferences-pending`) as {operationId:string;expectedRevision:number;patch:Preferences}|undefined;}
 async queuePreferences(ownerId:string,patch:Partial<Preferences>):Promise<WorkspacePreferences>{
  const db=await this.db();const tx=db.transaction('meta','readwrite');const current=await tx.store.get(`${ownerId}:preferences`) as WorkspacePreferences|undefined;const pending=await tx.store.get(`${ownerId}:preferences-pending`) as {operationId:string;expectedRevision:number;patch:Preferences}|undefined;
  const value={...mergePreferences(current?{theme:current.theme,language:current.language,design:current.design,studyOptions:current.studyOptions}:defaultPreferences(),patch),id:'workspace' as const,ownerId,revision:current?.revision??0,updatedAt:new Date().toISOString()};
  await tx.store.put(value,`${ownerId}:preferences`);await tx.store.put({operationId:crypto.randomUUID(),expectedRevision:pending?.expectedRevision??current?.revision??0,patch:{theme:value.theme,language:value.language,design:value.design,studyOptions:value.studyOptions}},`${ownerId}:preferences-pending`);await tx.done;return value;
 }
 async cachePreferences(ownerId:string,value:WorkspacePreferences,operationId?:string){if(value.ownerId!==ownerId)throw new Error('Preferences owner mismatch');const db=await this.db();const tx=db.transaction('meta','readwrite');const pending=await tx.store.get(`${ownerId}:preferences-pending`) as {operationId:string}|undefined;
  if(!pending||pending.operationId===operationId){await tx.store.put(value,`${ownerId}:preferences`);if(operationId)await tx.store.delete(`${ownerId}:preferences-pending`);}else if(operationId){const queued=await tx.store.get(`${ownerId}:preferences-pending`) as {operationId:string;expectedRevision:number;patch:Preferences};queued.expectedRevision=value.revision;await tx.store.put(queued,`${ownerId}:preferences-pending`);const local=await tx.store.get(`${ownerId}:preferences`) as WorkspacePreferences;await tx.store.put({...local,revision:value.revision},`${ownerId}:preferences`);}await tx.done;}
 async discardPreferences(ownerId:string){await (await this.db()).delete('meta',`${ownerId}:preferences-pending`);}
 async close() { (await this.db()).close(); this.database=undefined; }
 async profile(): Promise<{user:User;locked:boolean}|undefined> { return await (await this.db()).get('meta','profile') as {user:User;locked:boolean}|undefined; }
 async setProfile(user:User,locked=false) { await (await this.db()).put('meta',{user,locked},'profile'); }
 async clearProfile() { await (await this.db()).delete('meta','profile'); }
 async lock() { const profile=await this.profile(); if(profile) await this.setProfile(profile.user,true); }
 async read(ownerId:string) {
  const db=await this.db(); const tx=db.transaction(['records','outbox','meta'],'readonly');
  const [records,pending,lastSync] = await Promise.all([tx.objectStore('records').index('owner').getAll(ownerId),tx.objectStore('outbox').index('owner').getAll(ownerId),tx.objectStore('meta').get(`${ownerId}:lastSync`)]);
  await tx.done; return {records,pending:pending.sort((a,b)=>a.sequence-b.sequence),lastSync:lastSync as string|undefined,hasSyncable:unblocked(pending).length>0};
 }
 async enqueue(ownerId:string,kind:Operation['kind'],value:RecordValue) {
  return (await this.write(ownerId,kind,[value],false))[0];
 }
 async saveGuest(ownerId:string,kind:Operation['kind'],value:RecordValue) {
  return (await this.write(ownerId,kind,[value],true))[0];
 }
 async saveBanks(ownerId:string,packs:Pack[],localOnly:boolean) {
  return await this.write(ownerId,'pack.put',packs,localOnly) as Pack[];
 }
 async renamePack(ownerId:string,id:string,metadata:PackMetadata,localOnly:boolean) {
  await this.write(ownerId,'pack.put',[],localOnly,{id,metadata});
 }
 private async write(ownerId:string,kind:Operation['kind'],values:RecordValue[],localOnly:boolean,rename?:{id:string;metadata:PackMetadata}){
  if(localOnly&&!ownerId.startsWith('guest:'))throw new Error('Invalid guest owner');
  const db=await this.db();
  const tx=db.transaction(['records','outbox','meta'],'readwrite');
  // Attach a rejection handler before the first request. A failed write aborts the whole batch.
  const committed=tx.done.catch(()=>{});
  const records=tx.objectStore('records'),outbox=tx.objectStore('outbox'),meta=tx.objectStore('meta');
  const sequenceKey=`${ownerId}:sequence`;
  const kindOfRecord=recordKind(kind);
  try {
   if(rename){
    const current=(await records.get([ownerId,'packs',rename.id]))?.value as Pack|undefined;
    if(!current||current.deletedAt)throw new Error('Bank tidak ditemukan.');
    if(!rename.metadata.title.trim())throw new Error('Nama bank tidak boleh kosong.');
    values=[{...current,...rename.metadata}];
   }
   let sequence=localOnly?0:Number(await meta.get(sequenceKey)??0);
   const result:RecordValue[]=[];
   for(const value of values){
    if('ownerId' in value&&value.ownerId!==ownerId)throw new Error('Data ini milik akun lain.');
    const existing=await records.get([ownerId,kindOfRecord,value.id]);
    if(kind==='review.add'&&existing){result.push(existing.value);continue;}
    const expectedRevision=existing&&'revision' in existing.value?existing.value.revision:0;
    if(kind==='attempt.put'&&'options' in value&&value.options.mode==='BATCH'&&existing&&
       (value.revision!==expectedRevision+1 || (existing.value as Attempt).status==='completed')){
      throw new Error('Sesi sudah berubah. Buka kembali untuk mengambil versi terbaru.');
    }
    if(kind==='pack.put'&&(('revision' in value&&value.revision!==expectedRevision)||(existing?.value as Pack|undefined)?.deletedAt)){
     throw new Error('Bank sudah berubah. Buka kembali untuk mengambil versi terbaru.');
    }
    const next=structuredClone(value);
    const now=new Date().toISOString();
    if('revision' in next){next.revision=expectedRevision+1;next.updatedAt=now;}
    if(kind==='pack.delete')(next as Pack).deletedAt=now;
    await records.put({ownerId,kind:kindOfRecord,id:value.id,value:next,downloaded:existing?.downloaded});
    if(!localOnly){
     const operation:Operation={id:crypto.randomUUID(),kind,entityId:value.id,expectedRevision:kindOfRecord==='reviews'?undefined:expectedRevision,payload:next,createdAt:now};
     await outbox.put({ownerId,id:operation.id,sequence:++sequence,operation,status:'pending'});
    }
    result.push(next);
   }
   if(!localOnly)await meta.put(sequence,sequenceKey);
   await tx.done;
   return result;
  }catch(error){
   try{tx.abort();}catch{/* A failed request may already have aborted the transaction. */}
   await committed;
   throw error;
  }
 }
 async guestUser():Promise<User>{
  const db=await this.db();const tx=db.transaction('meta','readwrite');
  let user=await tx.store.get('guest-profile') as User|undefined;
  if(!user){user={id:'guest:'+crypto.randomUUID(),name:'Guest'};await tx.store.put(user,'guest-profile');}
  await tx.done;return user;
 }
 async adoptLocalGuestBanks(ownerId: string): Promise<string[]> {
  const db = await this.db();
  const tx = db.transaction(['meta', 'records', 'outbox'], 'readwrite');
  void tx.done.catch(()=>{});
  const meta = tx.objectStore('meta');
  const local = await meta.get('guest-profile') as User | undefined;
  if (!local) { await tx.done; return []; }
  const legacyAdoption = await meta.get(`${ownerId}:adopted-local-banks`);
  const records = tx.objectStore('records');
  const outbox = tx.objectStore('outbox');
  const source = await records.index('owner').getAll(local.id);
  const conflicts: string[] = [];
  let sequence = Number(await meta.get(`${ownerId}:sequence`) ?? 0);
  for (const row of source) {
   if (row.kind !== 'packs') continue;
   const pack = row.value as Pack;
   if (pack.deletedAt) continue;
   const marker = JSON.stringify([ownerId,'adopted-bank',pack.id]);
   const adoption = await meta.get(marker) as Adoption | undefined;
   const targetRow = await records.get([ownerId, 'packs', pack.id]);
   const target = targetRow?.value as Pack | undefined;
   if (target&&!target.deletedAt&&samePackContent(pack,target)) {
    await meta.put({localRevision:pack.revision,cloudRevision:target.revision},marker);
    continue;
   }
   if (adoption?.localRevision===pack.revision&&target&&!target.deletedAt&&target.revision>adoption.cloudRevision) continue;
   const unchangedTarget = target && (adoption
    ? target.revision===adoption.cloudRevision&&pack.revision>adoption.localRevision
    : legacyAdoption && target.revision===1);
   if (target?.deletedAt||(!target&&adoption)||(target&&!unchangedTarget)) {
    conflicts.push(pack.id);
    continue;
   }
   const expectedRevision=target?.revision??0;
   const value={...pack,ownerId,revision:expectedRevision+1,createdAt:target?.createdAt??pack.createdAt};
   const operation:Operation={id:crypto.randomUUID(),kind:'pack.put',entityId:pack.id,
    expectedRevision,payload:value,createdAt:new Date().toISOString()};
   await records.put({...row,ownerId,value,downloaded:row.downloaded||targetRow?.downloaded});
   await outbox.put({ownerId,id:operation.id,sequence:++sequence,operation,status:'pending'});
   await meta.put({localRevision:pack.revision,cloudRevision:value.revision},marker);
  }
  await meta.put(sequence,`${ownerId}:sequence`);
  await tx.done;
  return conflicts;
 }
 async markDownloaded(ownerId:string,pack:Pack) {
  const db=await this.db();const tx=db.transaction('records','readwrite');
  const key:[string,Kind,string]=[ownerId,'packs',pack.id];const existing=await tx.store.get(key);
  if(pack.ownerId!==ownerId) {tx.abort();throw new Error('Bank bukan milik akun aktif.');}
  await tx.store.put({ownerId,kind:'packs',id:pack.id,value:existing?.value??pack,downloaded:true});await tx.done;
 }
 async claim(ownerId:string,leaseOwner:string):Promise<PendingOperation|undefined> {
  const db=await this.db();const tx=db.transaction('outbox','readwrite');const rows=await tx.store.index('owner').getAll(ownerId);
  const row=unblocked(rows).sort((a,b)=>a.sequence-b.sequence)[0];
  // Keep order: another tab owns the first operation; do not overtake it.
  if(!row||(row.leaseUntil&&row.leaseUntil>Date.now()&&row.leaseOwner!==leaseOwner)){await tx.done;return;}
  row.leaseOwner=leaseOwner;row.leaseUntil=Date.now()+30000;await tx.store.put(row);await tx.done;return row;
 }
 async release(ownerId:string,id:string) {const db=await this.db();const tx=db.transaction('outbox','readwrite');const row=await tx.store.get([ownerId,id]);if(row){delete row.leaseOwner;delete row.leaseUntil;await tx.store.put(row);}await tx.done;}
 async acknowledge(ownerId:string,result:MutationResult) {
  const db=await this.db();const tx=db.transaction(['records','outbox'],'readwrite');const row=await tx.objectStore('outbox').get([ownerId,result.operationId]);
  if(!row){await tx.done;return;}
  if(!result.ok){row.status='conflict';row.failure=result;delete row.leaseOwner;delete row.leaseUntil;await tx.objectStore('outbox').put(row);await tx.done;return;}
  await tx.objectStore('outbox').delete([ownerId,result.operationId]);
  const others=await tx.objectStore('outbox').index('owner').getAll(ownerId);
  const newer=others.some(x=>x.operation.entityId===row.operation.entityId&&x.operation.kind.split('.')[0]===row.operation.kind.split('.')[0]);
  if(result.record&&!newer){const kind:Kind=row.operation.kind.startsWith('pack.')?'packs':row.operation.kind==='attempt.put'?'attempts':'reviews';const previous=await tx.objectStore('records').get([ownerId,kind,result.record.id]);await tx.objectStore('records').put({ownerId,id:result.record.id,kind,value:result.record,downloaded:previous?.downloaded});}
  await tx.done;
 }
 async merge(ownerId:string,snapshot:Snapshot) {
  const db=await this.db();const tx=db.transaction(['records','outbox','meta'],'readwrite');
  const previousCursor=Number(await tx.objectStore('meta').get(`${ownerId}:cursor`)??0);
  if(snapshot.cursor<previousCursor){await tx.done;return;}
  const pending=await tx.objectStore('outbox').index('owner').getAll(ownerId);
  const isPending=(kind:Kind,id:string)=>pending.some(r=>r.operation.entityId===id&&(kind==='packs'?r.operation.kind.startsWith('pack.'):kind==='attempts'?r.operation.kind==='attempt.put':r.operation.kind==='review.add'));
  const records=await tx.objectStore('records').index('owner').getAll(ownerId);
  for(const kind of ['packs','attempts','reviews'] as const){
   const remote=snapshot[kind];const ids=new Set(remote.map(x=>x.id));
   for(const row of records.filter(x=>x.kind===kind))if(!ids.has(row.id)&&!isPending(kind,row.id))await tx.objectStore('records').delete([ownerId,kind,row.id]);
   for(const value of remote){if('ownerId'in value&&value.ownerId!==ownerId)continue;if(isPending(kind,value.id))continue;const old=records.find(r=>r.kind===kind&&r.id===value.id);if(old&&'revision' in old.value&&'revision' in value&&old.value.revision>value.revision)continue;await tx.objectStore('records').put({ownerId,kind,id:value.id,value,downloaded:old?.downloaded});}
  }
  await tx.objectStore('meta').put(snapshot.cursor,`${ownerId}:cursor`);await tx.objectStore('meta').put(new Date().toISOString(),`${ownerId}:lastSync`);await tx.done;
 }
 async resolve(ownerId:string,id:string,action:'server'|'copy'):Promise<Pack|undefined> {
  const db=await this.db();const tx=db.transaction(['records','outbox'],'readwrite');const row=await tx.objectStore('outbox').get([ownerId,id]);
  if(!row||row.status!=='conflict'){await tx.done;return;}
  const kind:Kind=row.operation.kind.startsWith('pack.')?'packs':row.operation.kind==='attempt.put'?'attempts':'reviews';
  const currentLocal=await tx.objectStore('records').get([ownerId,kind,row.operation.entityId]);
  if(action==='copy'&&kind!=='packs'){tx.abort();throw new Error('Hanya bank soal yang dapat disalin.');}
  const queued=await tx.objectStore('outbox').index('owner').getAll(ownerId);
  for(const other of queued)if(other.operation.entityId===row.operation.entityId&&other.operation.kind.split('.')[0]===row.operation.kind.split('.')[0])await tx.objectStore('outbox').delete([ownerId,other.id]);
  if(row.failure?.current)await tx.objectStore('records').put({ownerId,kind,id:row.operation.entityId,value:row.failure.current,downloaded:currentLocal?.downloaded});
  else await tx.objectStore('records').delete([ownerId,kind,row.operation.entityId]);
  await tx.done;
  if(action==='copy'&&currentLocal){const pack=structuredClone(currentLocal.value as Pack);pack.id=crypto.randomUUID();pack.title+=' (salinan lokal)';pack.revision=0;pack.createdAt=new Date().toISOString();delete pack.deletedAt;pack.questions=pack.questions.map(q=>({...q,id:crypto.randomUUID()}));return pack;}
 }
}
