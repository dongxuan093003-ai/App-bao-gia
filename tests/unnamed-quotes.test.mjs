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
const model=load('lib/data.ts'),schema=load('lib/data-schema.ts');
const book=load('lib/customers.ts',{'./phone-format':load('lib/phone-format.ts')});
const journal=load('lib/customer-journal.ts',{'./customers':book});
const source=readFileSync(new URL('../app/workspace.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let saveSource;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='saveQuote')saveSource=node.getText(ast);ts.forEachChild(node,visit);}visit(ast);
const saveJs=ts.transpileModule(saveSource,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(data,fail=false){
 const factory=new Function('model','book','schema','data','fail',`
  const dataRef={current:structuredClone(data)},stateRef={current:{busy:false,quoteDirty:true}},focusHistoryOnClose={current:false};
  const uid=model.uid,linkQuoteCustomer=book.linkQuoteCustomer,conflict=false,document={activeElement:null},HTMLElement=class {};
  const events={errors:[],writes:[],tab:'prices',quote:'editing',historyMode:'due'};
  const toast={error:message=>events.errors.push(message)};
  const setQuote=value=>events.quote=value,setQuoteDirty=value=>events.dirty=value,setKeyboardOpen=value=>events.keyboard=value,setSearch=value=>events.search=value,setHistoryMode=value=>events.historyMode=value,setTab=value=>events.tab=value,setSavedQuote=value=>events.saved=value;
  async function persist(next){schema.workspaceRequestSchema.parse({version:1,data:next});events.writes.push(next);if(fail)return false;dataRef.current=next;return true;}
  ${saveJs}
  return {saveQuote,events,data:()=>dataRef.current};
 `);
 return factory(model,book,schema,data,fail);
}
function fixture(data){return {...model.blankQuote(data),phone:'0964 023 003',address:'Lập Thành',lines:[{id:data.products[0].id,group:'Thép',name:'Thép D6',unit:'kg',price:16000,note:''}]};}

test('nameless quotes save separately, return to history and can later be named without duplicating the quote',async()=>{
 const data=model.initialData();data.customers=[{id:'known',name:'Anh Chiến',phone:'0964 023 003',address:'Lập Thành'}];
 const h=harness(data),first=fixture(data);first.customer='   ';
 const saved=await h.saveQuote(first);
 assert.equal(saved.customer,'');assert.equal(saved.customerId,undefined);
 assert.deepEqual(h.data().customers,data.customers);
 assert.equal(h.events.tab,'quotes');assert.equal(h.events.quote,null);assert.equal(h.events.historyMode,'all');assert.equal(h.events.saved.id,saved.id);
 const second=await h.saveQuote(fixture(data));
 assert.notEqual(second.id,saved.id);assert.equal(h.data().quotes.length,2);assert.equal(h.data().customers.length,1);
 assert.equal(journal.quoteJournalTarget(h.data(),saved).key,'q:'+saved.id);
 assert.equal(journal.quoteJournalTarget(h.data(),second).key,'q:'+second.id);
 const named=await h.saveQuote({...saved,customer:'Anh Chiến'});
 assert.equal(named.id,saved.id);assert.equal(named.date,saved.date);assert.equal(named.code,saved.code);
 assert.equal(named.customerId,'known');assert.deepEqual(named.lines,saved.lines);assert.equal(h.data().quotes.length,2);
 assert.equal(h.data().nextNumber,3);assert.equal(h.data().quotes.find(q=>q.id===second.id).customer,'');
});

test('save failures and missing item prices keep the editor open; templates still require a title',async()=>{
 const data=model.initialData(),q=fixture(data),h=harness(data,true);
 assert.equal(await h.saveQuote(q),null);assert.equal(h.events.quote,'editing');assert.equal(h.events.tab,'prices');assert.deepEqual(h.data(),data);
 for(const invalid of [{...q,lines:[]},{...q,lines:[{...q.lines[0],price:null}]},{...q,template:true}]){
  const h=harness(data);assert.equal(await h.saveQuote(invalid),null);assert.equal(h.events.writes.length,0);assert.equal(h.events.quote,'editing');assert.equal(h.events.errors.length,1);
 }
 const zero=harness(data);assert.ok(await zero.saveQuote({...q,lines:[{...q.lines[0],price:0}]}));
});

test('blank names never join contacts by phone and keep their own care notes after naming',()=>{
 const data=model.initialData();data.customers=[{id:'known',name:'Anh Chiến',phone:'0964 023 003',address:'Lập Thành'}];
 const a=fixture(data),b=fixture(data);data.quotes=[a,b];
 assert.equal(book.linkQuoteCustomer(data.customers,{...a,customerId:'known'},'unused').quote.customerId,undefined);
 assert.equal(journal.quoteJournalTarget(data,a).customer.name,'Chưa đặt tên');
 let next=journal.updateJournal(data,'q:'+a.id,{type:'add',note:{id:'a-note',customerKey:'q:'+a.id,text:'Hẹn giao cát',createdAt:'2026-09-21T07:00:00Z'}});
 assert.equal(journal.journalNotes(next,'q:'+b.id).length,0);assert.equal(journal.journalNotes(next,'c:known').length,0);
 const named=book.linkQuoteCustomer(next.customers,{...a,customer:'Anh Chiến'},'unused').quote;
 next={...next,quotes:[named,b]};
 assert.equal(journal.journalNotes(next,'c:known')[0].text,'Hẹn giao cát');
 next=journal.updateJournal(next,'c:known',{type:'edit',id:'a-note',originalText:'Hẹn giao cát',text:'Giao chiều',updatedAt:'2026-09-21T08:00:00Z'});
 assert.equal(journal.journalNotes(next,'c:known')[0].text,'Giao chiều');
 assert.throws(()=>journal.updateJournal(next,'q:'+b.id,{type:'delete',id:'a-note'}),/không còn/);
 next=journal.updateJournal(next,'c:known',{type:'delete',id:'a-note'});assert.equal(journal.journalNotes(next,'c:known').length,0);
});
