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
const model=load('lib/data.ts'),lists=load('lib/price-lists.ts',{'./data':model}),schema=load('lib/data-schema.ts');
const book=load('lib/customers.ts',{'./phone-format':load('lib/phone-format.ts')}),notes=load('lib/note-templates.ts');
const backup=load('lib/backup.ts',{'./price-lists':lists,'./data-schema':schema,'./customers':book,'./note-templates':notes});
function fixture(){
 const data=model.initialData();
 data.products=data.products.slice(0,2).map((p,i)=>({...p,prices:i?[0,null,300]:[100,200,300]}));
 data.quotes=[0,1,2].map(tier=>({...model.blankQuote(data),id:'quote-'+tier,tier,priceListId:undefined,priceListName:undefined,customer:'Khách',lines:[{id:data.products[0].id,name:'Tên cũ',group:'Thép',unit:'kg',price:900+tier,note:'Ghi chú cũ'}]}));
 return data;
}

test('legacy columns gain stable identities without changing saved quotation content',()=>{
 const data=fixture();delete data.priceLists;const before=JSON.stringify(data);
 const next=lists.migratePriceLists(data);
 assert.equal(JSON.stringify(data),before);
 assert.deepEqual(next.products,data.products);
 assert.deepEqual(next.priceLists.map(p=>p.name),['Giá sang xe','Giá công trình','Giá bán lẻ']);
 next.quotes.forEach((q,i)=>{assert.equal(q.priceListId,next.priceLists[i].id);assert.deepEqual(q.lines,data.quotes[i].lines);});
 assert.deepEqual(lists.migratePriceLists(next),next);
});

test('new lists can be blank or copy zero/null/prices independently; names cannot collide',()=>{
 const data=lists.migratePriceLists(fixture()),before=JSON.stringify(data);
 const blank=lists.updatePriceLists(data,{type:'add',id:'wholesale',name:'  Giá đại lý  '});
 assert.equal(blank.priceLists.at(-1).name,'Giá đại lý');assert.ok(blank.products.every(p=>p.prices.at(-1)===null));
 const copy=lists.updatePriceLists(blank,{type:'add',id:'copy',name:'Giá khách quen',copyFrom:data.priceLists[0].id});
 assert.deepEqual(copy.products.map(p=>p.prices.at(-1)),[100,0]);
 copy.products[0].prices[4]=500;assert.equal(copy.products[0].prices[0],100);assert.equal(JSON.stringify(data),before);
 assert.throws(()=>lists.updatePriceLists(copy,{type:'rename',id:'copy',name:'GIÁ ĐẠI LÝ'}),/đã có/);
 assert.throws(()=>lists.updatePriceLists(copy,{type:'add',id:'missing',name:'Khác',copyFrom:'gone'}),/nguồn/);
});

test('deleting a middle list keeps remaining prices aligned and old snapshots unchanged across reload',()=>{
 const data=lists.migratePriceLists(fixture()),snapshots=structuredClone(data.quotes);
 const renamed=lists.updatePriceLists(data,{type:'rename',id:data.priceLists[1].id,name:'Giá công trình mới'});
 assert.deepEqual(renamed.quotes,snapshots);
 const removed=lists.updatePriceLists(renamed,{type:'delete',id:data.priceLists[1].id});
 assert.deepEqual(removed.products.map(p=>p.prices),[[100,300],[0,300]]);
 assert.deepEqual(removed.quotes,snapshots);
 const reloaded=lists.migratePriceLists(JSON.parse(JSON.stringify(removed)));
 assert.equal(lists.quotePriceIndex(reloaded,reloaded.quotes[1]),-1);
 assert.equal(lists.quotePriceIndex(reloaded,reloaded.quotes[2]),1);
 assert.deepEqual(reloaded.quotes,snapshots);
 const restored=backup.parseBackup(JSON.stringify({data:reloaded,draft:reloaded.quotes[1]}));
 assert.deepEqual(restored.data,reloaded);assert.equal(lists.quotePriceIndex(restored.data,restored.draft),-1);
 const one=lists.updatePriceLists(reloaded,{type:'delete',id:reloaded.priceLists[0].id});
 assert.throws(()=>lists.updatePriceLists(one,{type:'delete',id:one.priceLists[0].id}),/ít nhất/);
 assert.equal(model.blankQuote(one).priceListId,one.priceLists[0].id);
});

test('dynamic columns and legacy backups validate; mismatched or duplicate lists are rejected',()=>{
 const legacy=fixture();delete legacy.priceLists;
 const restored=backup.parseBackup(JSON.stringify({data:legacy}));assert.equal(restored.data.priceLists.length,3);
 const four=lists.updatePriceLists(restored.data,{type:'add',id:'four',name:'Giá thứ tư',copyFrom:restored.data.priceLists[1].id});
 assert.deepEqual(four.products.map(p=>p.prices[3]),[200,null]);
 assert.ok(schema.workspaceRequestSchema.safeParse({version:1,data:four}).success);
 for(const corrupt of [d=>d.products[0].prices.pop(),d=>d.priceLists.push(d.priceLists[0]),d=>d.priceLists.splice(0),d=>d.priceLists[1].name=d.priceLists[0].name.toUpperCase()]){
  const bad=structuredClone(four);corrupt(bad);
  assert.equal(schema.workspaceRequestSchema.safeParse({version:1,data:bad}).success,false);
  assert.throws(()=>backup.parseBackup(JSON.stringify({data:bad})));
 }
});

test('cloud keeps the exact list mutation, rejects old clients and stale saves, and isolates accounts',async()=>{
 let owner='account-a';const rows=new Map();
 const db={prepare(sql){return {bind(...args){return {
  async first(){return rows.get(args[0])??null;},
  async run(){if(sql.startsWith('INSERT')){const [key,payload]=args;if(rows.has(key))return {meta:{changes:0}};rows.set(key,{payload,version:1});return {meta:{changes:1}};}
   const [payload,key,version]=args;if(rows.get(key)?.version!==version)return {meta:{changes:0}};rows.set(key,{payload,version:version+1});return {meta:{changes:1}};}
 };}};}};
 const api=load('app/api/data/route.ts',{'@/lib/backup-store':{automaticBackup:async()=>true},'@/lib/account':{currentAccount:async()=>({id:owner})},'@/db/raw':{database:()=>db},'@/lib/data-schema':schema,'@/lib/customers':book,'@/lib/note-templates':notes,'@/lib/price-lists':lists});
 const put=(version,data,modern=true)=>api.PUT(new Request('https://quotes.example/api/data',{method:'PUT',headers:{origin:'https://quotes.example',...(modern?{'x-workspace-features':'price-lists-v1'}:{})},body:JSON.stringify({version,data})}));
 const original=lists.migratePriceLists(fixture());assert.equal((await put(0,original)).status,200);
 const changed=lists.updatePriceLists(original,{type:'add',id:'new',name:'Giá mới',copyFrom:original.priceLists[2].id});
 assert.equal((await put(1,changed)).status,200);
 assert.equal((await put(2,original,false)).status,426);
 assert.equal((await put(1,original)).status,409);
 assert.deepEqual((await (await api.GET()).json()).data,changed);
 owner='account-b';assert.equal((await (await api.GET()).json()).data,null);
});
