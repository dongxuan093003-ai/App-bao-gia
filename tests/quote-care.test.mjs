import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file){
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);return module.exports;
}
const model=load('lib/data.ts'),care=load('lib/quote-care.ts'),schema=load('lib/data-schema.ts');
const quote=()=>({...model.blankQuote(model.initialData()),customer:'Anh Hoàng',date:'2026-09-13T08:30:00.000Z',followUp:'2026-09-14',internal:'Khách hẹn gọi chiều.'});

test('care dates follow Vietnam midnight and quick dates cross month/year boundaries',()=>{
 assert.equal(care.careDay(0,new Date('2026-09-13T16:59:59Z')),'2026-09-13');
 assert.equal(care.careDay(0,new Date('2026-09-13T17:00:00Z')),'2026-09-14');
 assert.equal(care.careDay(1,new Date('2026-12-31T08:00:00Z')),'2027-01-01');
});
test('due list includes today and overdue quotes, excluding future, completed, templates and invalid dates',()=>{
 const q=quote();assert.equal(care.isCareDue(q,'2026-09-14'),true);assert.equal(care.isCareDue(q,'2026-09-15'),true);assert.equal(care.isCareDue(q,'2026-09-13'),false);
 for(const fields of [{followUp:''},{followUp:'2026-02-31'},{status:'Đã chốt'},{status:'Không chốt'},{template:true},{deleted:true}])assert.equal(care.isCareDue({...q,...fields},'2026-09-15'),false);
});
test('saving and completing care preserve quotation content, timestamps, order, customers and saved notes',()=>{
 const data=model.initialData(),q=quote(),other=quote();
 q.lines=[{id:'steel',group:'Thép',name:'Thép D6',unit:'kg',price:16000,note:'Giá giao công trình'}];
 data.quotes=[other,q];const before=JSON.stringify(data);
 const next=care.updateQuoteCare(data,q.id,{status:'Đang cân nhắc',followUp:'2026-09-16',internal:'Gọi lại chiều.'});
 assert.equal(JSON.stringify(data),before);assert.strictEqual(next.customers,data.customers);assert.strictEqual(next.products,data.products);assert.strictEqual(next.quotes[0],other);
 const saved=next.quotes[1];assert.deepEqual({...saved,...care.quoteCare(q)},q);assert.strictEqual(saved.lines,q.lines);assert.equal(saved.date,q.date);
 assert.ok(schema.workspaceSchema.safeParse(next).success);assert.equal(care.careStatusLabel(saved.status),'Đang trao đổi');
 const completed=care.updateQuoteCare(next,q.id,{...care.quoteCare(saved),followUp:''}).quotes[1];
 assert.equal(completed.internal,'Gọi lại chiều.');assert.equal(completed.followUp,'');assert.equal(care.isCareDue(completed,'2026-09-16'),false);
});
test('care cannot recreate removed quotes or write invalid status/date/note data',()=>{
 const data=model.initialData(),q=quote();data.quotes=[q];
 assert.throws(()=>care.updateQuoteCare(data,'missing',care.quoteCare(q)),/không còn/);
 for(const fields of [{status:'Other'},{followUp:'2026-02-31'},{internal:'a'.repeat(4001)}])assert.throws(()=>care.updateQuoteCare(data,q.id,{...care.quoteCare(q),...fields}));
 assert.throws(()=>care.updateQuoteCare({...data,quotes:[{...q,template:true}]},q.id,care.quoteCare(q)),/không còn/);
});
