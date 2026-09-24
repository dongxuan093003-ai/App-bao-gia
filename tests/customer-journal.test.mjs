import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,stubs={}){
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function('require','module','exports',code)(n=>n in stubs?stubs[n]:require(n),m,m.exports);return m.exports;
}
const model=load('lib/data.ts'),schema=load('lib/data-schema.ts'),phone=load('lib/phone-format.ts'),book=load('lib/customers.ts',{'./phone-format':phone}),notes=load('lib/note-templates.ts');
const journal=load('lib/customer-journal.ts',{'./customers':book});
const {parseBackup}=load('lib/backup.ts',{'./price-lists':load('lib/price-lists.ts',{'./data':model}),'./data-schema':schema,'./customers':book,'./note-templates':notes});
function fixture(){
 const d=model.initialData();d.customers=[{id:'thu',name:'Chị Thư',phone:'0986000950',address:'Dâu Vải'},{id:'other',name:'Chị Thư',phone:'0900000000',address:'Hà Nội'}];
 const q={...model.blankQuote(d),id:'q1',date:'2026-09-12T09:00:00Z',customerId:'thu',customer:'Chị Thư',phone:'0986000950',address:'Dâu Vải',internal:'Bắt đầu làm 16/09',lines:[{id:'s',group:'Thép',name:'D6',unit:'kg',price:16000,note:'Gửi khách'}]};
 d.quotes=[q,{...q,id:'q2',date:'2026-09-13T09:00:00Z',internal:''},{...q,id:'q3',customerId:'other',internal:'Khách khác'}];return d;
}
function add(d,id,text,day='2026-09-15T09:00:00Z'){return journal.updateJournal(d,'c:thu',{type:'add',note:{id,customerKey:'c:thu',text,createdAt:day}});}

test('customer history spans quotations and imports old internal notes exactly once without changing snapshots',()=>{
 const d=fixture(),before=JSON.stringify(d),migrated=journal.migrateJournal(d);
 assert.equal(JSON.stringify(d),before);assert.deepEqual(migrated.quotes,d.quotes);
 assert.equal(journal.quoteJournalTarget(d,d.quotes[0]).key,journal.quoteJournalTarget(d,d.quotes[1]).key);
 assert.notEqual(journal.quoteJournalTarget(d,d.quotes[0]).key,journal.quoteJournalTarget(d,d.quotes[2]).key);
 assert.deepEqual(journal.journalQuotes(migrated,'c:thu').map(q=>q.id),['q2','q1']);
 assert.equal(journal.journalNotes(migrated,'c:thu')[0].text,'Bắt đầu làm 16/09');
 assert.equal(journal.migrateJournal(migrated),migrated);
 const removed=journal.updateJournal(migrated,'c:thu',{type:'delete',id:'legacy:q1'});
 assert.equal(journal.journalNotes(journal.migrateJournal(removed),'c:thu').length,0);
 assert.equal(removed.quotes[0].internal,d.quotes[0].internal);
 const noBook={...migrated,customers:[]};assert.equal(journal.quoteJournalTarget(noBook,d.quotes[0]).key,'c:thu');
});

test('newest notes come first; editing retains their date and cannot overwrite a changed note or another customer',()=>{
 let d=add(add(fixture(),'a','Cần gọi lại','2026-09-13T09:00:00Z'),'b','Đã chốt');
 const before=structuredClone(d);
 d=journal.updateJournal(d,'c:thu',{type:'edit',id:'a',originalText:'Cần gọi lại',text:'Cần gọi buổi chiều',updatedAt:'2026-09-16T09:00:00Z'});
 assert.deepEqual(journal.journalNotes(d,'c:thu').map(n=>n.id),['b','a','legacy:q1']);
 assert.equal(d.careNotes.find(n=>n.id==='a').createdAt,'2026-09-13T09:00:00Z');
 assert.deepEqual(d.quotes,before.quotes);assert.deepEqual(d.customers,before.customers);assert.deepEqual(d.products,before.products);
 assert.throws(()=>journal.updateJournal(d,'c:thu',{type:'edit',id:'a',originalText:'Cần gọi lại',text:'Ghi đè',updatedAt:'2026-09-17T09:00:00Z'}),/thiết bị khác/);
 assert.throws(()=>journal.updateJournal(d,'c:other',{type:'delete',id:'b'}),/không còn/);
 assert.equal(add(d,'b','Đã chốt'),d);assert.throws(()=>add(d,'b','Nội dung khác'),/thay đổi/);
 assert.throws(()=>add(d,'empty',' '),/Nhập ghi chú/);
});

test('backup and request validation retain the journal; damaged dates or duplicate note ids are rejected',()=>{
 const d=add(fixture(),'n1','Gọi lại ngày mai');
 assert.deepEqual(parseBackup(JSON.stringify({data:d})).data,d);
 assert.deepEqual(schema.workspaceRequestSchema.parse({version:4,data:d}).data.careNotes,d.careNotes);
 assert.throws(()=>parseBackup(JSON.stringify({data:{...d,careNotes:[...d.careNotes,d.careNotes[0]]}})));
 assert.equal(schema.workspaceSchema.safeParse({...d,careNotes:[{...d.careNotes[0],createdAt:'not-a-date'}]}).success,false);
 assert.deepEqual(journal.parseJournalDrafts(JSON.stringify({'c:thu':{text:'Chưa gửi',noteId:'stable',createdAt:'2026-09-15T09:00:00Z'}})),{'c:thu':{text:'Chưa gửi',noteId:'stable',createdAt:'2026-09-15T09:00:00Z'}});
 assert.deepEqual(journal.parseJournalDrafts('broken'),{});
 assert.deepEqual(journal.parseJournalDrafts('{"__proto__":{"text":"x"},"c:bad":{"text":42}}'),{});
});

test('cloud writes retain journal notes, reject concurrent stale changes, and remain isolated by account',async()=>{
 const rows=new Map();let owner='a';
 const db={
  prepare(sql){
   return {bind(...args){
    return {
     async first(){return rows.get(args[0])||null;},
     async run(){
      if(sql.startsWith('INSERT')){const [account,payload]=args;if(rows.has(account))return {meta:{changes:0}};rows.set(account,{payload,version:1});return {meta:{changes:1}};}
      const [payload,account,version]=args;if(rows.get(account)?.version!==version)return {meta:{changes:0}};rows.set(account,{payload,version:version+1});return {meta:{changes:1}};
     }
    };
   }};
  }
 };
 const api=load('app/api/data/route.ts',{'@/lib/backup-store':{automaticBackup:async()=>true},'@/lib/account':{currentAccount:async()=>({id:owner})},'@/db/raw':{database:()=>db},'@/lib/price-lists':load('lib/price-lists.ts',{'./data':model}),'@/lib/data-schema':schema,'@/lib/customers':book,'@/lib/note-templates':notes});
 const put=(version,data)=>api.PUT(new Request('https://quotes.example/api/data',{method:'PUT',headers:{origin:'https://quotes.example','x-workspace-features':'price-lists-v1'},body:JSON.stringify({version,data})}));
 const d=journal.migrateJournal(fixture());assert.equal((await put(0,d)).status,200);
 const a=add(d,'device-a','Gọi chiều nay'),b=add(d,'device-b','Hẹn ngày mai');
 assert.equal((await put(1,a)).status,200);assert.equal((await put(1,b)).status,409);
 let latest=await (await api.GET()).json();assert.deepEqual(latest.data.careNotes,a.careNotes);
 assert.equal((await put(latest.version,add(latest.data,'device-b','Hẹn ngày mai'))).status,200);
 latest=await (await api.GET()).json();assert.ok(latest.data.careNotes.some(n=>n.id==='device-a'));assert.ok(latest.data.careNotes.some(n=>n.id==='device-b'));
 owner='b';assert.equal((await (await api.GET()).json()).data,null);
});

test('Back closes inner controls first, then returns to the same list without growing the history stack',()=>{
 let effect,listener,consumed=false,closed=0,navigated=0,intercepted=0;
 const entries=[{router:'preserved'}];let position=0;
 const previous=globalThis.window;
 globalThis.window={location:{href:'https://quotes.example/'},history:{get state(){return entries[position];},pushState(state){entries.splice(position+1);entries.push(state);position++;},back(){position--;listener({stopImmediatePropagation(){intercepted++;}});}},addEventListener(name,fn,capture){assert.equal(capture,true);listener=fn;},removeEventListener(){}};
 try{
  const {useJournalBack}=load('app/use-journal-back.ts',{'react':{useRef:v=>({current:v}),useEffect:fn=>{effect=fn;}}});
  const close=useJournalBack(()=>consumed,()=>closed++);const cleanup=effect();
  assert.equal(entries.length,2);assert.equal(window.history.state.router,'preserved');
  consumed=true;window.history.back();assert.equal(closed,0);assert.equal(position,1);assert.equal(entries.length,2);
  consumed=false;close(()=>navigated++);assert.equal(closed,1);assert.equal(navigated,1);assert.equal(intercepted,2);assert.equal(position,0);assert.deepEqual(window.history.state,{router:'preserved'});cleanup();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
