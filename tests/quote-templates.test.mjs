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
const model=load('lib/data.ts'),schema=load('lib/data-schema.ts'),templates=load('lib/quote-templates.ts');
const book=load('lib/customers.ts',{'./phone-format':load('lib/phone-format.ts')});
const priceLists=load('lib/price-lists.ts',{'./data':model});
const source=readFileSync(new URL('../app/workspace.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=[];let listSource;
function visit(node){
 if(ts.isFunctionDeclaration(node)&&['openQuote','saveQuote','startTemplate','saveTemplateName','deleteSaved'].includes(node.name?.text))functions.push(node.getText(ast));
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='list'&&node.initializer?.getText(ast).includes("historyMode==='templates'"))listSource=node.initializer.getText(ast);
 ts.forEachChild(node,visit);
}visit(ast);
const handlers=ts.transpileModule(functions.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(data,options={}){
 return new Function('model','schema','book','templates','priceLists','data','options',`
  const dataRef={current:structuredClone(data)},stateRef={current:{busy:false,quoteDirty:false}},focusHistoryOnClose={current:false};
  const {copyQuoteForCustomer,createQuoteTemplate,renameQuoteTemplate}=templates,{migrateQuotePriceList}=priceLists;
  const uid=model.uid,linkQuoteCustomer=book.linkQuoteCustomer,conflict=!!options.conflict,document={activeElement:null},HTMLElement=class {};
  let templateForm=null,quote=options.quote||null,quoteDirty=false;
  const events={errors:[],writes:[],tab:'quotes',historyMode:'all',quote};
  const toast={error:message=>events.errors.push(message)};
  const setQuote=value=>{quote=value;events.quote=value;},setQuoteDirty=value=>{quoteDirty=value;events.dirty=value;},setKeyboardOpen=value=>events.keyboard=value,setSearch=value=>events.search=value,setHistoryMode=value=>events.historyMode=value,setTab=value=>events.tab=value,setSavedQuote=value=>events.saved=value;
  const setTemplateForm=value=>{templateForm=value;events.form=value;},setConfirm=value=>events.confirm=value;
  const quoteDateTime=date=>({label:date});
  async function persist(next,automatic,retainOnFailure){schema.workspaceRequestSchema.parse({version:1,data:next});events.writes.push({next,automatic,retainOnFailure});if(options.fail)return false;dataRef.current=next;return true;}
  ${handlers}
  return {openQuote,saveQuote,startTemplate,saveTemplateName,deleteSaved,events,data:()=>dataRef.current};
 `)(model,schema,book,templates,priceLists,data,options);
}
function fixture(){
 const data=priceLists.migratePriceLists(model.initialData());
 const q={...model.blankQuote(data),id:'original',code:'BG-001',date:'2026-09-20T08:00:00.000Z',customer:'Chị Thư',customerId:'thu',phone:'0986 000 950',address:'Dâu Vải',internal:'Hẹn gọi',followUp:'2026-09-22',status:'Đã chốt',
  lines:[{id:data.products[0].id,group:'Thép cũ',name:'Thép D6',unit:'kg',price:12345,note:'Giao sáng'},{id:'deleted-product',group:'Khác',name:'Hàng tặng',unit:'cái',price:0,note:''}],
  note:'Giao tại công trình\nHẹn sáng',noteCustom:'Hẹn sáng',noteTemplates:[{id:'note-1',name:'Vận chuyển',text:'Giao tại công trình',enabled:true}]};
 data.quotes=[q];data.nextNumber=2;data.customers=[{id:'thu',name:'Chị Thư',phone:q.phone,address:q.address}];
 return {data,q};
}

test('save as template preserves original quote and contacts, without consuming quotation numbers',async()=>{
 const {data,q}=fixture(),h=harness(data);
 h.startTemplate(q);assert.equal(await h.saveTemplateName('  Thép công trình  '),true);
 const t=h.data().quotes.find(q=>q.template);
 assert.notEqual(t.id,q.id);assert.equal(t.customer,'Thép công trình');assert.equal(t.code,'');
 for(const field of ['phone','address','internal','followUp'])assert.equal(t[field],'');
 assert.equal(t.customerId,undefined);assert.equal(t.status,'Mới báo');
 assert.deepEqual(t.lines,q.lines);assert.deepEqual(t.header,q.header);assert.deepEqual(t.noteTemplates,q.noteTemplates);assert.equal(t.note,q.note);
 assert.deepEqual(h.data().quotes.find(x=>x.id===q.id),q);assert.deepEqual(h.data().customers,data.customers);assert.equal(h.data().nextNumber,2);
 assert.equal(h.events.historyMode,'templates');assert.equal(h.events.form,null);assert.equal(h.events.saved.id,t.id);
});

test('using a template copies stored prices even after catalog changes and never mutates the template',async()=>{
 const {data,q}=fixture();const template=templates.createQuoteTemplate(q,'Mẫu thép','template','2026-09-20T09:00:00.000Z');data.quotes.push(template);
 data.products[0].prices=data.products[0].prices.map(()=>99999);data.headers[0].name='Tiêu đề mới';data.notes[0].text='Nội dung mới';
 const h=harness(data);h.openQuote(template,true);const draft=h.events.quote;
 assert.notEqual(draft.id,template.id);assert.equal(draft.template,false);assert.equal(draft.code,'');assert.notEqual(draft.date,template.date);
 assert.equal(draft.customer,'');assert.equal(draft.customerId,undefined);assert.equal(draft.phone,'');assert.equal(draft.address,'');assert.equal(draft.followUp,'');assert.equal(draft.internal,'');
 assert.deepEqual(draft.lines,template.lines);assert.deepEqual(draft.header,template.header);assert.deepEqual(draft.noteTemplates,template.noteTemplates);
 draft.lines[0].price=15000;draft.lines[0].note='Thay riêng';draft.header.name='Riêng khách này';draft.noteTemplates[0].text='Sửa riêng';
 assert.deepEqual(h.data().quotes.find(q=>q.id===template.id),template);
 const saved=await h.saveQuote(draft);assert.ok(saved);assert.equal(saved.code,'BG-002');assert.equal(saved.template,false);assert.equal(saved.customer,'');
 assert.deepEqual(h.data().quotes.find(q=>q.id===template.id),template);assert.equal(h.data().quotes.length,3);assert.equal(h.events.historyMode,'all');assert.equal(h.events.quote,null);
 const h2=harness(h.data());h2.openQuote(template,true);assert.equal(h2.events.quote.lines[0].price,12345);
});

test('explicit template edits update only the template; rename uses current stored data',async()=>{
 const {data,q}=fixture(),t=templates.createQuoteTemplate(q,'Mẫu thép','template','2026-09-20T09:00:00.000Z');data.quotes.push(t);
 const h=harness(data);h.openQuote(t);const draft=h.events.quote;draft.lines[0].price=13500;draft.note='Ghi chú mẫu mới';
 assert.equal((await h.saveQuote(draft)).id,t.id);assert.equal(h.events.historyMode,'templates');assert.equal(h.data().nextNumber,2);assert.deepEqual(h.data().quotes.find(x=>x.id===q.id),q);
 h.startTemplate(t,'rename');assert.equal(await h.saveTemplateName('Mẫu mới'),true);
 const edited=h.data().quotes.find(x=>x.id===t.id);assert.equal(edited.customer,'Mẫu mới');assert.equal(edited.lines[0].price,13500);assert.equal(edited.note,'Ghi chú mẫu mới');
 assert.equal(h.data().quotes.length,2);assert.deepEqual(h.data().customers,data.customers);
});

test('deletion requires confirmation and removes only the selected template',async()=>{
 const {data,q}=fixture(),t=templates.createQuoteTemplate(q,'Mẫu thép','template','2026-09-20T09:00:00.000Z');
 const fromTemplate=templates.copyQuoteForCustomer(t,'new-quote','2026-09-21T09:00:00.000Z');data.quotes.push(t,fromTemplate);
 const h=harness(data);h.deleteSaved(t);assert.equal(h.events.writes.length,0);assert.match(h.events.confirm.title,/Xóa mẫu/);
 h.events.confirm.action();assert.equal(h.data().quotes.some(q=>q.id===t.id),false);assert.deepEqual(h.data().quotes,[q,fromTemplate]);
 const failed=harness(data,{fail:true});failed.deleteSaved(t);failed.events.confirm.action();assert.deepEqual(failed.data(),data);
});

test('failed or invalid template saves preserve form and data; saving from editor keeps original draft open',async()=>{
 const {data,q}=fixture();
 for(const options of [{fail:true},{conflict:true}]){
  const h=harness(data,options);h.startTemplate(q);assert.equal(await h.saveTemplateName('Mẫu'),false);assert.deepEqual(h.data(),data);assert.equal(h.events.historyMode,'all');
  if(options.fail){assert.ok(h.events.form);assert.equal(h.events.writes[0].retainOnFailure,false);}
 }
 for(const [source,name] of [[q,' '],[{...q,lines:[]},'Mẫu'],[{...q,lines:[{...q.lines[0],price:null}]},'Mẫu']]){
  const h=harness(data);h.startTemplate(source);assert.equal(await h.saveTemplateName(name),false);assert.equal(h.events.writes.length,0);assert.ok(h.events.form);
 }
 const h=harness(data,{quote:q});h.startTemplate(q);assert.equal(await h.saveTemplateName('Mẫu'),true);assert.equal(h.events.quote,q);assert.equal(h.events.historyMode,'all');assert.deepEqual(h.data().quotes.find(x=>x.id===q.id),q);
 assert.throws(()=>templates.renameQuoteTemplate(data,q.id,'Không phải mẫu'),/không còn/);
});

test('template tab ignores stale customer search while normal history still filters',()=>{
 const {data,q}=fixture(),t=templates.createQuoteTemplate(q,'Mẫu thép','template','2026-09-20T09:00:00.000Z');data.quotes.push(t,{...t,id:'deleted-template',deleted:true});
 const list=new Function('data','historyMode','search','active','due','customerMatchesSearch','return '+listSource);
 assert.deepEqual(list(data,'templates','không có',[q],[],book.customerMatchesSearch),[t]);
 assert.deepEqual(list(data,'all','không có',[q],[],book.customerMatchesSearch),[]);
 for(const query of ['chi thu','Chị Thư','0986000950','0986 000 950','+84 986 000 950','000 950']){
  assert.deepEqual(list(data,'all',query,[q],[],book.customerMatchesSearch),[q],query);
  assert.deepEqual(list(data,'due',query,[q],[q],book.customerMatchesSearch),[q],query);
 }
 assert.deepEqual(list(data,'all','0964023003',[q],[],book.customerMatchesSearch),[]);
 assert.deepEqual(list(data,'all','',[q],[],book.customerMatchesSearch),[q]);
 const nameless={...q,customer:''};
 assert.deepEqual(list(data,'all','chua dat ten',[nameless],[],book.customerMatchesSearch),[nameless]);
 assert.deepEqual(list(data,'all','0986000950',[nameless],[],book.customerMatchesSearch),[nameless]);
});
