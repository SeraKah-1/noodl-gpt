import type {Database} from './index';
import {defaultPreferences,mergePreferences,preferencesSchema,designSchema,type WorkspacePreferences} from '../shared/preferences';
const str={type:'string'},integer={type:'integer',minimum:0};
const color={anyOf:[{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},{type:'null'}]};
const designInput={type:'object',additionalProperties:false,properties:{accent:color,background:color,surface:color,text:color,muted:color,border:color,radius:{type:'integer',minimum:0,maximum:32},density:{type:'string',enum:['compact','comfortable','spacious']},fontScale:{type:'number',minimum:.85,maximum:1.35},contentWidth:{type:'integer',minimum:640,maximum:1800},cardLayout:{type:'string',enum:['grid','list']},reduceMotion:{type:'boolean'}}};
const patchInput={type:'object',additionalProperties:false,properties:{theme:{type:'string',enum:['default','matcha','lilac','blush','sky','vanilla','sunset','midnight','oled','paper']},language:{type:'string',enum:['id','en']},design:designInput,studyOptions:{type:'object',additionalProperties:false,properties:{mode:{type:'string',enum:['STANDARD','SURVIVAL','TIME_RUSH']},shuffle:{type:'boolean'},retention:{type:'boolean'},mixed:{type:'boolean'}}}}};
function tool(name:string,description:string,properties:Record<string,unknown>={},required:string[]=[],readOnly=false,app=false){return {name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:true},_meta:{ui:{visibility:app?['app']:['model','app']}}};}
const writes={operationId:str,expectedRevision:integer};
export const preferenceTools=[tool('get_preferences','Read all current account design, language and study defaults.',{},[],true),tool('update_preferences','Patch account preferences; affects the real website and ChatGPT UI. Read revision first.',{...writes,patch:patchInput},['operationId','expectedRevision','patch']),tool('reset_preferences','Reset account preferences to defaults.',writes,['operationId','expectedRevision']),tool('get_design','Read current theme and design tokens (colors, spacing, type size, radius, layout, motion).',{},[],true),tool('update_design','Change live UI design using validated tokens, without a code deployment. Changes apply to your account.',{...writes,theme:patchInput.properties.theme,design:designInput},['operationId','expectedRevision','design']),tool('reset_design','Restore theme and design defaults while keeping language/study preferences.',writes,['operationId','expectedRevision']),tool('app_get_preferences','Read UI preferences.',{},[],true,true),tool('app_update_preferences','Save UI preferences.',{...writes,patch:patchInput},['operationId','expectedRevision','patch'],false,true)];
export async function getPreferences(db:Database,owner:string):Promise<WorkspacePreferences>{const row=await db.prepare("SELECT data FROM records WHERE owner_id=? AND kind='preferences' AND id='workspace'").bind(owner).first<{data:string}>();return row?JSON.parse(row.data):{...defaultPreferences(),id:'workspace',ownerId:owner,revision:0,updatedAt:new Date(0).toISOString()};}
export async function updatePreferences(db:Database,owner:string,args:any):Promise<WorkspacePreferences>{
 if(typeof args.operationId!=='string'||!args.operationId.trim()||args.operationId.length>200)throw new Error('Invalid operationId');
 const old=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,args.operationId).first<{result:string}>();if(old){const result=JSON.parse(old.result);if(result.type!=='preferences')throw new Error('operationId already belongs to another operation');return result.record;}
 const current=await getPreferences(db,owner);if(!Number.isSafeInteger(args.expectedRevision)||args.expectedRevision!==current.revision)throw Object.assign(new Error('CONFLICT: Preferences changed. Read current revision and retry.'),{status:409});
 const value=mergePreferences(preferencesSchema.parse({theme:current.theme,language:current.language,design:current.design,studyOptions:current.studyOptions}),args.patch);
 const record:WorkspacePreferences={...value,id:'workspace',ownerId:owner,revision:current.revision+1,updatedAt:new Date().toISOString()};const nonce=crypto.randomUUID();
 await db.batch([db.prepare("INSERT INTO operations(owner_id,id,nonce,result) SELECT ?,?,?,? WHERE COALESCE((SELECT revision FROM records WHERE owner_id=? AND kind='preferences' AND id='workspace'),0)=? ON CONFLICT(owner_id,id) DO NOTHING").bind(owner,args.operationId,nonce,JSON.stringify({type:'preferences',record}),owner,current.revision),db.prepare("INSERT INTO records(owner_id,kind,id,revision,data) SELECT ?,'preferences','workspace',?,? WHERE EXISTS(SELECT 1 FROM operations WHERE owner_id=? AND id=? AND nonce=?) ON CONFLICT(owner_id,kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data").bind(owner,record.revision,JSON.stringify(record),owner,args.operationId,nonce)]);
 const saved=await db.prepare('SELECT result FROM operations WHERE owner_id=? AND id=?').bind(owner,args.operationId).first<{result:string}>();if(!saved)throw Object.assign(new Error('CONFLICT: Concurrent preferences update'),{status:409});return JSON.parse(saved.result).record;
}
export async function callPreferenceTool(db:Database,owner:string,name:string,args:any):Promise<unknown|undefined>{
 if(!preferenceTools.some(t=>t.name===name))return undefined;
 if(name==='get_design'){const p=await getPreferences(db,owner);return {id:p.id,revision:p.revision,theme:p.theme,design:p.design};}
 if(name==='get_preferences'||name==='app_get_preferences')return getPreferences(db,owner);
 let patch=args.patch;
 if(name==='update_design')patch={design:args.design,...(args.theme!==undefined?{theme:args.theme}:{})};
 if(name==='reset_design')patch={theme:'default',design:designSchema.parse({})};
 if(name==='reset_preferences')patch=defaultPreferences();
 // Reset must remove optional color overrides, not merge them back into the previous design.
 if(name.startsWith('reset_')){const current=await getPreferences(db,owner);const clean={...current,design:designSchema.parse({})};if(name==='reset_preferences')Object.assign(clean,defaultPreferences());const final={theme:patch.theme,language:patch.language??current.language,design:patch.design,studyOptions:patch.studyOptions??current.studyOptions};return updatePreferencesReplacingDesign(db,owner,args,final);}
 return updatePreferences(db,owner,{...args,patch});
}
async function updatePreferencesReplacingDesign(db:Database,owner:string,args:any,patch:any){
 // Explicit undefined optional colors replace overrides during validation after the merge.
 const cleared={accent:undefined,background:undefined,surface:undefined,text:undefined,muted:undefined,border:undefined,...patch.design};
 return updatePreferences(db,owner,{...args,patch:{...patch,design:cleared}});
}
