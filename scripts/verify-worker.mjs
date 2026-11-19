import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Statement(this.sql,args)}async first(){return sqlite.prepare(this.sql).get(...this.args)??null}async all(){return {results:sqlite.prepare(this.sql).all(...this.args)}}async run(){return sqlite.prepare(this.sql).run(...this.args)}}
const DB={prepare:sql=>new Statement(sql),batch:async rows=>{sqlite.exec('BEGIN');try{const results=[];for(const row of rows)results.push(await row.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const request=(path,method='GET',body)=>new Request('https://worker.test'+path,{method,headers:{'oai-authenticated-user-id':'bundle-test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
assert.equal((await worker.fetch(request('/api/health'),{DB},{})).status,200);
const serviceWorker=await worker.fetch(request('/sw.js'),{DB},{});
assert.equal(serviceWorker.status,200);
const sw=await serviceWorker.text();
const files=JSON.parse(sw.match(/const FILES=(\[[^;]*\]);/)?.[1]??'null');
assert.ok(files?.includes('/index.html'));
for(const file of files) {
 const response=await worker.fetch(request(file),{DB},{});
 assert.equal(response.status,200,`Offline cache asset: ${file}`);
}
async function tool(name,args){const r=await worker.fetch(request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),{DB},{});const rpc=await r.json();assert.ok(!rpc.error,JSON.stringify(rpc));assert.ok(!rpc.result.isError,JSON.stringify(rpc));return rpc.result.structuredContent;}
const pack=await tool('create_pack',{operationId:'bundle-input',pack:{title:'Bundle smoke',questions:[{id:'q',type:'FILL_BLANK',text:'2 + 2',acceptedAnswers:['4'],explanation:'Four',difficulty:'Easy'}]}});
const output=await tool('export_pack',{packId:pack.id,operationId:'bundle-pdf',format:'pdf'});
const file=await tool('get_export',{exportId:output.id,includeContent:true});assert.equal(atob(file.content).slice(0,5),'%PDF-');
sqlite.close();console.log('Worker bundle startup, database and PDF output passed.');
