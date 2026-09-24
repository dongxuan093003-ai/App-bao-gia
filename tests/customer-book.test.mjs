import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function loadTs(path,stubs={}){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>name in stubs?stubs[name]:require(name),module,module.exports);
 return module.exports;
}
const schema=loadTs('lib/data-schema.ts');
const phone=loadTs('lib/phone-format.ts');
const model=loadTs('lib/data.ts');
const book=loadTs('lib/customers.ts',{'./phone-format':phone});
const customer={id:'customer-1',name:'Anh Chiến',phone:'0964 023 003',address:'Phú Cát'};
function quote(overrides={}){return {...model.blankQuote(model.initialData()),id:'quote-1',code:'BG-001',date:'2026-09-09T02:12:00Z',customer:customer.name,phone:customer.phone,address:customer.address,lines:[{id:'steel',group:'Thép',name:'Thép D6',unit:'kg',price:16000,note:''}],...overrides};}
function legacy(quotes){const data={...model.initialData(),quotes};delete data.customers;return data;}

test('legacy upgrade groups phone formats and preserves exact quote snapshots',()=>{
 const newer=quote({id:'new',date:'2026-09-09T03:00:00Z',customer:'Anh Chiến mới',phone:'+84 964 023 003',address:'Địa chỉ mới'});
 const older=quote();
 const old=legacy([older,newer,quote({id:'template',template:true}),quote({id:'trash',deleted:true,phone:'0900000000'})]);
 const before=JSON.stringify(old),upgraded=book.migrateCustomers(old);
 assert.equal(upgraded.customers.length,1);
 assert.equal(upgraded.customers[0].name,'Anh Chiến mới');
 assert.equal(upgraded.quotes[0].customerId,upgraded.quotes[1].customerId);
 for(let i=0;i<old.quotes.length;i++){const {customerId,...snapshot}=upgraded.quotes[i];assert.deepEqual(snapshot,old.quotes[i]);}
 assert.equal(JSON.stringify(old),before);
 assert.deepEqual(book.migrateCustomers(JSON.parse(before)),upgraded);
 assert.equal(book.migrateCustomers(upgraded),upgraded);
});

test('customers without phone are grouped by name and address, not by name alone',()=>{
 const data=book.migrateCustomers(legacy([quote({id:'a',phone:'',address:'Phú Cát'}),quote({id:'b',phone:'',address:'Phú Cát'}),quote({id:'c',phone:'',address:'Đồng Chằm'})]));
 assert.equal(data.customers.length,2);
 assert.equal(data.quotes[0].customerId,data.quotes[1].customerId);
 assert.notEqual(data.quotes[0].customerId,data.quotes[2].customerId);
});

test('editing a customer preserves history and quote snapshots; deleting last quote preserves customer',()=>{
 const data=book.migrateCustomers(legacy([quote()])),before=JSON.stringify(data.quotes);
 const changed=book.upsertCustomer(data.customers,{...data.customers[0],name:'Chị Thu',phone:'0987654321',address:'Hà Nội'});
 assert.equal(changed[0].phone,'0987 654 321');
 assert.equal(book.quotesForCustomer(data.quotes,changed[0].id).length,1);
 assert.equal(JSON.stringify(data.quotes),before);
 assert.deepEqual(book.migrateCustomers({...data,customers:changed,quotes:[]}).customers,changed);
});

test('deleted customers stay deleted on reload and on unrelated quote edits',()=>{
 const data=book.migrateCustomers(legacy([quote()]));
 const deleted={...data,customers:[]};
 assert.equal(book.migrateCustomers(deleted),deleted);
 const result=book.linkQuoteCustomer([], {...data.quotes[0],note:'Ghi chú mới'},'new-id');
 assert.equal(result.customers.length,0);
 assert.equal(result.quote.customerId,data.quotes[0].customerId);
});

test('standalone customers are linked without duplicates; templates never create contacts',()=>{
 const customers=book.upsertCustomer([],customer);
 const result=book.linkQuoteCustomer(customers,quote({phone:'+84 964 023 003'}),'unused');
 assert.equal(result.customers,customers);
 assert.equal(result.quote.customerId,customer.id);
 assert.equal(customers[0].address,'Phú Cát');
 assert.equal(book.linkQuoteCustomer([],quote({template:true}),'template-contact').customers.length,0);
 const other=book.linkQuoteCustomer(customers,quote({customer:'Chị Thu',phone:'0901234567'}),'new-customer');
 assert.equal(other.customers.length,2);
 assert.equal(other.quote.customerId,'new-customer');
 assert.equal(customers.length,1);
});

test('search accepts accents, spacing and complete international phone; clearing restores matches',()=>{
 for(const term of ['chien','CHIẾN','0964023003','0964 023 003','+84 964 023 003',''])assert.equal(book.customerMatchesSearch(customer,term),true,term);
 for(const term of ['hoang','0900','+++'])assert.equal(book.customerMatchesSearch(customer,term),false,term);
 assert.throws(()=>book.upsertCustomer([],{...customer,name:'  '}),/Nhập tên/);
});

test('customer ordering uses the newest real quote, then preserves unquoted customers',()=>{
 const customers=['unquoted','a','b','empty'].map(id=>({...customer,id,name:id}));
 const quotes=[
  quote({id:'b-new',customerId:'b',date:'2026-09-10T01:00:00Z'}),
  quote({id:'a-old',customerId:'a',date:'2026-09-08T23:00:00Z'}),
  quote({id:'b-old',customerId:'b',date:'2026-09-01T00:00:00Z'}),
  quote({id:'a-new',customerId:'a',date:'2026-09-09T23:00:00Z'}),
  quote({id:'template',customerId:'a',date:'2026-09-11T00:00:00Z',template:true}),
  quote({id:'deleted',customerId:'unquoted',date:'2026-09-12T00:00:00Z',deleted:true}),
  quote({id:'invalid',customerId:'empty',date:'invalid'})
 ];
 const ids=data=>book.customersByLatestQuote(customers,data).map(c=>c.id);
 assert.deepEqual(ids(quotes),['b','a','unquoted','empty']);
 assert.deepEqual(ids([...quotes,quote({id:'a-latest',customerId:'a',date:'2026-09-10T02:00:00Z'})]),['a','b','unquoted','empty']);
 assert.deepEqual(ids(quotes.filter(q=>q.id!=='b-new')),['a','b','unquoted','empty']);
 assert.deepEqual(ids([]),['unquoted','a','b','empty']);
 assert.deepEqual(customers.map(c=>c.id),['unquoted','a','b','empty']);
});

test('API roundtrip retains address book and quote links, rejects stale or obsolete writes',async()=>{
 const rows=new Map();let owner='account-a';
 const db={prepare(sql){return {bind(...args){return {
  async first(){assert.equal(args[0],owner);return rows.get(args[0])||null;},
  async run(){if(sql.startsWith('INSERT')){const [account,payload]=args;if(rows.has(account))return {meta:{changes:0}};rows.set(account,{payload,version:1});return {meta:{changes:1}};}
   const [payload,account,version]=args,current=rows.get(account);if(!current||current.version!==version)return {meta:{changes:0}};
   rows.set(account,{payload,version:version+1});return {meta:{changes:1}};
  }
 };}};}};
 const api=loadTs('app/api/data/route.ts',{'@/lib/backup-store':{automaticBackup:async()=>true},'@/lib/account':{currentAccount:async()=>({id:owner})},'@/db/raw':{database:()=>db},'@/lib/customers':book,'@/lib/price-lists':loadTs('lib/price-lists.ts',{'./data':model}),'@/lib/data-schema':schema,'@/lib/note-templates':loadTs('lib/note-templates.ts')});
 const data=book.migrateCustomers(legacy([quote()]));
 data.customers=book.upsertCustomer(data.customers,{id:'standalone',name:'Khách mới',phone:'',address:'Hà Nội'});
 const put=(version,payload)=>api.PUT(new Request('https://quotes.example/api/data',{method:'PUT',headers:{origin:'https://quotes.example','x-workspace-features':'price-lists-v1'},body:JSON.stringify({version,data:payload})}));
 assert.equal((await put(0,data)).status,200);
 let loaded=await (await api.GET()).json();assert.deepEqual(loaded.data,data);assert.equal(loaded.version,1);
 const updated={...data,customers:book.upsertCustomer(data.customers,{...data.customers[0],name:'Tên mới'})};
 assert.equal((await put(1,updated)).status,200);
 assert.equal((await put(1,data)).status,409);
 const obsolete={...updated};delete obsolete.customers;
 assert.equal((await put(2,obsolete)).status,400);
 loaded=await (await api.GET()).json();assert.deepEqual(loaded.data,updated);
 owner='account-b';assert.equal((await (await api.GET()).json()).data,null);
});
