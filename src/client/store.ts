import type {WorkspacePreferences,Preferences} from '../shared/preferences';
import {defaultPreferences,mergePreferences} from '../shared/preferences';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attempt, MutationResult, Operation, Pack, ReviewEvent, Snapshot, User } from '../shared/types';

type RecordValue = Pack | Attempt | ReviewEvent;
type Kind = 'packs' | 'attempts' | 'reviews';
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
  await tx.done; return {records,pending:pending.sort((a,b)=>a.sequence-b.sequence),lastSync:lastSync as string|undefined};
 }
 async enqueue(ownerId:string,kind:Operation['kind'],value:RecordValue):Promise<RecordValue> {
  if('ownerId' in value && value.ownerId!==ownerId) throw new Error('Data ini milik akun lain.');
  const db=await this.db(); const tx=db.transaction(['records','outbox','meta'],'readwrite');
  const recordKind:Kind=kind.startsWith('pack.')?'packs':kind==='attempt.put'?'attempts':'reviews';
  const key:[string,Kind,string]=[ownerId,recordKind,value.id];
  const existing=await tx.objectStore('records').get(key);
  if(kind==='review.add'&&existing) {await tx.done;return existing.value;}
  const now=new Date().toISOString();
  const expectedRevision=existing&&'revision' in existing.value?existing.value.revision:0;
  const next=structuredClone(value);
  if('revision' in next) { next.revision=expectedRevision+1; next.updatedAt=now; }
  if(kind==='pack.delete') (next as Pack).deletedAt=now;
  const sequence=Number(await tx.objectStore('meta').get(`${ownerId}:sequence`)??0)+1;
  const operation:Operation={id:crypto.randomUUID(),kind,entityId:value.id,expectedRevision:recordKind==='reviews'?undefined:expectedRevision,payload:next,createdAt:now};
  await tx.objectStore('records').put({ownerId,kind:recordKind,id:value.id,value:next,downloaded:existing?.downloaded});
  await tx.objectStore('outbox').put({ownerId,id:operation.id,sequence,operation,status:'pending'});
  await tx.objectStore('meta').put(sequence,`${ownerId}:sequence`);
  await tx.done; return next;
 }
 async guestUser():Promise<User>{
  const db=await this.db();const tx=db.transaction('meta','readwrite');
  let user=await tx.store.get('guest-profile') as User|undefined;
  if(!user){user={id:'guest:'+crypto.randomUUID(),name:'Guest'};await tx.store.put(user,'guest-profile');}
  await tx.done;return user;
 }
 async adoptLocalGuestBanks(ownerId: string): Promise<void> {
  const db = await this.db();
  const tx = db.transaction(['meta', 'records', 'outbox'], 'readwrite');
  const meta = tx.objectStore('meta');
  const local = await meta.get('guest-profile') as User | undefined;
  const marker = `${ownerId}:adopted-local-banks`;
  if (!local || await meta.get(marker)) { await tx.done; return; }
  const records = tx.objectStore('records');
  const outbox = tx.objectStore('outbox');
  const source = await records.index('owner').getAll(local.id);
  let sequence = Number(await meta.get(`${ownerId}:sequence`) ?? 0);
  for (const row of source) {
   if (row.kind !== 'packs') continue;
   const pack = row.value as Pack;
   if (pack.deletedAt || await records.get([ownerId, 'packs', pack.id])) continue;
   const value = {...pack, ownerId, revision: 1};
   const operation = {id: crypto.randomUUID(), kind: 'pack.put' as const, entityId: pack.id,
    expectedRevision: 0, payload: value, createdAt: new Date().toISOString()};
   await records.put({...row, ownerId, value});
   await outbox.put({ownerId, id: operation.id, sequence: ++sequence, operation, status: 'pending'});
  }
  await meta.put(sequence, `${ownerId}:sequence`);
  await meta.put(true, marker);
  await tx.done;
 }
 async saveGuest(ownerId:string,kind:Operation['kind'],value:RecordValue):Promise<RecordValue>{
  if(!ownerId.startsWith('guest:')||('ownerId' in value&&value.ownerId!==ownerId))throw new Error('Invalid guest owner');
  const db=await this.db();const tx=db.transaction('records','readwrite');const recordKind:Kind=kind.startsWith('pack.')?'packs':kind==='attempt.put'?'attempts':'reviews';
  const old=await tx.store.get([ownerId,recordKind,value.id]);
  const next=structuredClone(value);if('revision' in next){next.revision=(old&&'revision' in old.value?old.value.revision:0)+1;next.updatedAt=new Date().toISOString();}
  if(kind==='pack.delete')(next as Pack).deletedAt=new Date().toISOString();
  await tx.store.put({ownerId,kind:recordKind,id:value.id,value:next,downloaded:old?.downloaded});await tx.done;return next;
 }
 async markDownloaded(ownerId:string,pack:Pack) {
  const db=await this.db();const tx=db.transaction('records','readwrite');
  const key:[string,Kind,string]=[ownerId,'packs',pack.id];const existing=await tx.store.get(key);
  if(pack.ownerId!==ownerId) {tx.abort();throw new Error('Bank bukan milik akun aktif.');}
  await tx.store.put({ownerId,kind:'packs',id:pack.id,value:existing?.value??pack,downloaded:true});await tx.done;
 }
 async claim(ownerId:string,leaseOwner:string):Promise<PendingOperation|undefined> {
  const db=await this.db();const tx=db.transaction('outbox','readwrite');const rows=await tx.store.index('owner').getAll(ownerId);
  const blocked=new Set(rows.filter(r=>r.status==='conflict').map(r=>`${r.operation.kind.split('.')[0]}:${r.operation.entityId}`));
  const row=rows.sort((a,b)=>a.sequence-b.sequence).find(r=>r.status==='pending'&&!blocked.has(`${r.operation.kind.split('.')[0]}:${r.operation.entityId}`));
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
