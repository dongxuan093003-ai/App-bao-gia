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
const model=loadTs('lib/data.ts'),schema=loadTs('lib/data-schema.ts');
const book=loadTs('lib/customers.ts',{'./phone-format':loadTs('lib/phone-format.ts')});
const {parseBackup}=loadTs('lib/backup.ts',{'./price-lists':loadTs('lib/price-lists.ts',{'./data':model}),'./data-schema':schema,'./customers':book,'./note-templates':loadTs('lib/note-templates.ts')});
function sample(){
 const data=model.initialData();
 data.products[0].prices=[0,null,16000];
 data.customers=[{id:'kh-1',name:'Anh Công',phone:'0964 023 003',address:'Phú Cát'}];
 data.quotes=[{...model.blankQuote(data),customer:'Tên tại lúc báo',customerId:'kh-1',date:'2026-09-09T02:12:00Z',header:{...data.headers[0],name:'Tiêu đề cũ'},lines:[{id:'removed-product',group:'Thép',name:'Tên cũ',unit:'kg',price:15000,note:'Ghi chú riêng'}]}];
 return {data,draft:{...model.blankQuote(data),customer:'Khách đang nhập'},exportedAt:'2026-09-09T14:00:00Z'};
}

test('backup round trip preserves every price, snapshot, customer and unsaved draft',()=>{
 const source=sample(),raw=JSON.stringify(source),result=parseBackup('\uFEFF'+raw);
 assert.deepEqual(result,source);
 assert.equal(JSON.stringify(source),raw);
 assert.ok(schema.workspaceRequestSchema.safeParse({data:result.data,version:23}).success);
 assert.equal(result.data.quotes[0].header.name,'Tiêu đề cũ');
 assert.equal(result.data.quotes[0].lines[0].price,15000);
});

test('older backups gain a customer directory, but an explicitly empty directory stays empty',()=>{
 const source=sample();delete source.data.customers;delete source.data.quotes[0].customerId;delete source.draft;
 source.data.notes=source.data.notes.map(n=>n.text);
 const result=parseBackup(JSON.stringify(source));
 assert.equal(result.data.notes[0].name,'Mẫu 1');
 assert.equal(result.data.notes[0].text,source.data.notes[0]);
 assert.equal(result.draft,null);
 assert.equal(result.data.customers.length,1);
 assert.equal(result.data.quotes[0].customerId,result.data.customers[0].id);
 assert.deepEqual(result.data.quotes[0].lines,source.data.quotes[0].lines);
 source.data.customers=[];
 assert.deepEqual(parseBackup(JSON.stringify(source)).data.customers,[]);
});

test('damaged backups are rejected before any restore: shape, prices, ids, default header and dates',()=>{
 for(const raw of ['oops','{}','{"data":null}'])assert.throws(()=>parseBackup(raw));
 const corruptions=[
  s=>{s.data.products[0].prices=[100];},s=>{s.data.products[0].prices[0]=-1;},
  s=>{s.data.products.push(s.data.products[0]);},s=>{s.data.customers=null;},
  s=>{s.data.defaultHeader='missing';},s=>{s.data.quotes[0].date='not a date';},
  s=>{s.data.quotes[0].lines.push(s.data.quotes[0].lines[0]);},
  s=>{s.draft.lines=[{id:'bad'}];},s=>{s.data.nextNumber=0;},
 ];
 for(const corrupt of corruptions){const source=sample();corrupt(source);assert.throws(()=>parseBackup(JSON.stringify(source)));}
});

test('backup cannot supply an account or cloud version, and large data is rejected',()=>{
 const source=sample();source.owner='another-account';source.version=999;source.data.owner='another-account';
 const result=parseBackup(JSON.stringify(source));
 assert.equal(result.owner,undefined);assert.equal(result.version,undefined);assert.equal(result.data.owner,undefined);
 const large=sample();large.data.quotes=Array.from({length:1300},(_,i)=>({...large.data.quotes[0],id:'quote-'+i,note:'x'.repeat(4000)}));
 assert.throws(()=>parseBackup(JSON.stringify(large)),/dung lượng/);
});
