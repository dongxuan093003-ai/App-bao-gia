import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const dbRef={current:null},account={id:'owner-a'};
const stubs={'@/db/raw':{database:()=>dbRef.current},'@/lib/account':{currentAccount:async()=>account.id?account:null,sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin}};
const cache=new Map();
function load(path){
 const full=resolve(root,path);if(cache.has(full))return cache.get(full);
 const code=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};cache.set(full,m.exports);
 new Function('require','module','exports',code)(name=>{
  if(name in stubs)return stubs[name];
  if(name.startsWith('./')||name.startsWith('../'))return load(resolve(dirname(full),name+'.ts'));
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  return require(name);
 },m,m.exports);return m.exports;
}
const model=load('lib/data.ts'),backup=load('lib/backup.ts'),store=load('lib/backup-store.ts'),api=load('app/api/backups/route.ts'),dataApi=load('app/api/data/route.ts');
function fixture(){
 const data=model.initialData();data.customers=[{id:'thu',name:'Chị Thư',phone:'0986000950',address:'Dâu Vải'}];
 data.quotes=[{...model.blankQuote(data),id:'q',customer:'Chị Thư',customerId:'thu',lines:[{id:'old',group:'Thép',name:'D6 cũ',unit:'kg',price:0,note:'Ghi chú'}]}];
 data.quotes.push({...structuredClone(data.quotes[0]),id:'template',template:true,customer:'Mẫu thép'});
 data.careNotes=[{id:'note',customerKey:'c:thu',text:'Gọi lại',createdAt:'2026-09-21T09:00:00Z'}];return data;
}
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(resolve(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(resolve(root,'drizzle',file),'utf8'));
 const db={sql,fail:false,beforeBatch:null,prepare(query){return {bind(...args){return {
  first:async()=>sql.prepare(query).get(...args)??null,
  all:async()=>({results:sql.prepare(query).all(...args)}),
  run:async()=>{if(db.fail&&query.startsWith('UPDATE quote_workspaces'))throw new Error('injected storage failure');return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},
 };}};},async batch(statements){
  if(db.beforeBatch){const fn=db.beforeBatch;db.beforeBatch=null;fn();}
  sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}
 }};
 dbRef.current=db;account.id='owner-a';
 return db;
}
function seed(db,owner='owner-a',data=fixture(),version=1){db.sql.prepare('INSERT OR REPLACE INTO quote_workspaces(owner,payload,version) VALUES (?,?,?)').run(owner,JSON.stringify(data),version);return data;}
const t0=Date.parse('2026-09-21T14:30:00Z');
const req=(body,origin='https://example.test')=>new Request('https://example.test/api/backups',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const live=db=>db.sql.prepare('SELECT * FROM quote_workspaces WHERE owner=?').get('owner-a');

test('JSON filenames use Vietnam time; new files round trip and legacy files remain compatible',()=>{
 const data=fixture(),draft=model.blankQuote(data);
 assert.equal(backup.backupFilename(new Date(t0)),'Baogia_2130_21-09-2026.json');
 assert.equal(backup.backupFilename('2026-09-21T17:00:00Z'),'Baogia_0000_22-09-2026.json');
 assert.deepEqual(backup.parseBackup(backup.serializeBackup(data,draft,new Date(t0).toISOString())),{data,draft,exportedAt:new Date(t0).toISOString()});
 assert.deepEqual(backup.parseBackup(JSON.stringify({data})).data,data);
 assert.throws(()=>backup.parseBackup(JSON.stringify({data,schemaVersion:999})));
});
test('first automatic backup, seven-day threshold, unchanged content, and concurrent devices',async()=>{
 const db=setup(),data=seed(db);
 assert.ok(await store.createBackup(db,'owner-a','automatic',undefined,t0));
 assert.equal(await store.createBackup(db,'owner-a','automatic',undefined,t0),null);
 const changed=structuredClone(data);changed.products[0].prices[0]=123;
 seed(db,'owner-a',changed,2);
 assert.equal(await store.createBackup(db,'owner-a','automatic',undefined,t0+store.BACKUP_INTERVAL_MS-1),null);
 assert.ok(await store.createBackup(db,'owner-a','automatic',undefined,t0+store.BACKUP_INTERVAL_MS));
 seed(db,'owner-a',changed,3);
 assert.equal(await store.createBackup(db,'owner-a','automatic',undefined,t0+store.BACKUP_INTERVAL_MS*3),null);
 assert.equal((await store.listBackups(db,'owner-a')).length,2);
 db.beforeBatch=()=>seed(db,'owner-a',data,4);
 assert.equal(await store.createBackup(db,'owner-a','automatic',undefined,t0+store.BACKUP_INTERVAL_MS*4),null);
});
test('retention keeps eight newest complete snapshots, account isolation, and stale manual requests',async()=>{
 const db=setup();seed(db);seed(db,'owner-b');
 const b=await store.createBackup(db,'owner-b','manual',1,t0);
 for(let i=0;i<11;i++)await store.createBackup(db,'owner-a','manual',1,t0+i);
 const entries=await store.listBackups(db,'owner-a');assert.equal(entries.length,8);
 assert.equal(entries[0].createdAt,new Date(t0+10).toISOString());
 const saved=await store.readBackup(db,'owner-a',entries[0].id);assert.deepEqual(saved.data,fixtureComparable(saved.data));
 assert.equal(saved.data.quotes[0].lines[0].price,0);assert.equal(saved.data.careNotes[0].text,'Gọi lại');
 assert.equal(entries[0].summary.templates,1);assert.equal(entries[0].summary.quotes,1);
 assert.equal((await store.listBackups(db,'owner-b')).length,1);
 await assert.rejects(store.readBackup(db,'owner-a',b),e=>e.status===404);
 await assert.rejects(store.createBackup(db,'owner-a','manual',999),e=>e.status===409);
});
// Verify deep structural identity against the persisted payload (which contains generated IDs).
function fixtureComparable(data){return JSON.parse(dbRef.current.sql.prepare('SELECT payload FROM quote_workspaces WHERE owner=?').get('owner-a').payload);}
test('restore atomically captures current state, permits returning to it, and never overwrites a concurrent save',async()=>{
 const db=setup(),original=seed(db),replacement=structuredClone(original);replacement.customers=[];replacement.products[0].prices[0]=987;
 const result=await store.restoreWorkspace(db,'owner-a',replacement,1,t0);
 assert.equal(result.version,2);assert.deepEqual(JSON.parse(live(db).payload),replacement);
 const previous=await store.readBackup(db,'owner-a',result.checkpoint);assert.deepEqual(previous.data,original);
 assert.equal((await store.listBackups(db,'owner-a'))[0].reason,'before_restore');
 await store.restoreWorkspace(db,'owner-a',previous.data,2,t0+1);assert.deepEqual(JSON.parse(live(db).payload),original);
 db.beforeBatch=()=>seed(db,'owner-a',replacement,4);
 await assert.rejects(store.restoreWorkspace(db,'owner-a',original,3,t0+2),e=>e.status===409);
 assert.equal(live(db).version,4);assert.deepEqual(JSON.parse(live(db).payload),replacement);
 assert.equal((await store.listBackups(db,'owner-a')).length,2);
});
test('storage failure rolls back checkpoint and replacement; a fresh account can restore a file',async()=>{
 const db=setup(),original=seed(db);db.fail=true;
 await assert.rejects(store.restoreWorkspace(db,'owner-a',fixture(),1,t0),/storage failure/);
 assert.deepEqual(JSON.parse(live(db).payload),original);assert.equal((await store.listBackups(db,'owner-a')).length,0);
 db.fail=false;await store.restoreWorkspace(db,'new-owner',original,0,t0);
 assert.equal((await store.listBackups(db,'new-owner')).length,1);
 assert.equal(db.sql.prepare('SELECT version FROM quote_workspaces WHERE owner=?').get('new-owner').version,1);
});
test('legacy file without an export date survives preview and server restore validation',async()=>{
 for(const exportedAt of [undefined,null,'unknown-date']){
  const db=setup(),original=seed(db),replacement=fixture();
  replacement.customers[0].name='Khách từ bản cũ';
  // The file is first parsed for the preview, then the normalized object is sent to the server.
  const preview=backup.parseBackup(JSON.stringify({data:replacement,exportedAt}));
  assert.equal(preview.exportedAt,null);
  const response=await api.POST(req({action:'restore',version:1,backup:preview}));
  assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(live(db).payload),preview.data);
  const checkpoint=(await store.listBackups(db,'owner-a'))[0];
  assert.deepEqual((await store.readBackup(db,'owner-a',checkpoint.id)).data,original);
 }
});
test('API rejects malformed files, unauthenticated and cross-origin writes, and reads scoped to owner',async()=>{
 const db=setup(),original=seed(db);
 assert.equal((await api.POST(req({action:'restore',version:1,backup:{data:{}}}))).status,400);
 assert.deepEqual(JSON.parse(live(db).payload),original);assert.equal((await store.listBackups(db,'owner-a')).length,0);
 assert.equal((await api.POST(req({action:'create',version:1},'https://other.test'))).status,403);
 account.id=null;assert.equal((await api.GET(new Request('https://example.test/api/backups'))).status,401);
 assert.equal((await api.POST(req({action:'create',version:1}))).status,401);account.id='owner-a';
 seed(db,'owner-b');const id=await store.createBackup(db,'owner-b','manual',1,t0);
 assert.equal((await api.GET(new Request('https://example.test/api/backups?id='+id))).status,404);
 assert.equal((await api.POST(req({action:'restore',version:1,id}))).status,404);
 assert.equal((await api.POST(req({action:'create',version:1}))).status,200);
 const entry=(await store.listBackups(db,'owner-a'))[0];
 const response=await api.POST(req({action:'restore',version:1,id:entry.id}));assert.equal(response.status,200);assert.equal((await response.json()).version,2);
});
test('ordinary data load/save triggers backups; backup failure does not report successful data save as failed',async()=>{
 const db=setup(),data=seed(db);
 assert.equal((await dataApi.GET()).status,200);assert.equal((await store.listBackups(db,'owner-a')).length,1);
 db.sql.exec('DROP TABLE quote_backups');
 data.products[0].prices[0]=321;
 const request=new Request('https://example.test/api/data',{method:'PUT',headers:{origin:'https://example.test','Content-Type':'application/json','X-Workspace-Features':'price-lists-v1'},body:JSON.stringify({version:1,data})});
 const response=await dataApi.PUT(request),result=await response.json();assert.equal(response.status,200);assert.equal(result.version,2);assert.equal(result.backupOk,false);
 assert.equal(JSON.parse(live(db).payload).products[0].prices[0],321);
});
