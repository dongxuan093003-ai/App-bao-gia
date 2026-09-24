import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function loadTs(path,stubs={}){
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>stubs[name]||require(name),module,module.exports);
 return module.exports;
}
const data=loadTs('lib/data.ts'),phone=loadTs('lib/phone-format.ts'),display=loadTs('lib/quote-display.ts');
const {quotePrintHtml,openQuotePrint}=loadTs('lib/quote-print.ts',{'./data':data,'./phone-format':phone,'./quote-display':display});
function fixture(){
 return {...data.blankQuote(data.initialData()),date:'2026-09-09T23:30:00Z',customer:'Anh Chiến',phone:'0964023003',address:'Lập Thành',internal:'PRIVATE-CARE',followUp:'2026-09-14',note:'Giao tại chân công trình.',lines:[
  {id:'steel',group:'Thép',name:'Thép D6',unit:'kg',price:16000,note:''},
  {id:'cement',group:'Xi măng',name:'XM Trung Sơn',unit:'tấn',price:1100000,note:'Giao cả kiện'},
 ]};
}

test('print is a text snapshot with all four columns, local date and no private care data',()=>{
 const q=fixture(),before=structuredClone(q),html=quotePrintHtml(q);
 assert.deepEqual(q,before);
 for(const text of ['Anh Chiến','0964 023 003','Lập Thành','16.000','1.100.000','Giao cả kiện','Giao tại chân công trình.','ngày 10/09/2026'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/<th scope="col">GHI CHÚ/g)||[]).length,2);
 assert.equal((html.match(/class="item-note"/g)||[]).length,2);
 assert.ok(!html.includes('PRIVATE-CARE'));assert.ok(!html.includes('2026-09-14'));
 assert.ok(!/<img|<canvas|<script/i.test(html));
 assert.ok(html.indexOf('Thép D6')<html.indexOf('XM Trung Sơn'));
});

test('customer, store and item text cannot inject markup into the print document',()=>{
 const q=fixture(),unsafe='</title><img src=x onerror="alert(1)">';
 q.customer=q.address=q.header.name=q.header.address=q.lines[0].name=q.lines[0].group=q.lines[0].note=q.note=unsafe;
 const html=quotePrintHtml(q);
 assert.ok(!html.includes(unsafe));assert.ok(!/<img|<script/i.test(html));
 assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
});

test('printing a nameless quote omits only the customer-name row and retains supplied contact details',()=>{
 const html=quotePrintHtml({...fixture(),customer:'   '});
 assert.ok(!html.includes('<dt>Khách hàng :'));assert.ok(!html.includes('Chưa đặt tên'));
 assert.ok(html.includes('<dt>Số điện thoại :'));assert.ok(html.includes('0964 023 003'));assert.ok(html.includes('<dt>Địa chỉ :'));assert.ok(html.includes('Lập Thành'));
});

test('empty or unpriced quotes cannot print, and a blocked popup leaves the quote intact',()=>{
 const q=fixture(),before=structuredClone(q);
 assert.throws(()=>quotePrintHtml({...q,lines:[]}),/mặt hàng/);
 assert.throws(()=>quotePrintHtml({...q,lines:[{...q.lines[0],price:null}]}),/chưa nhập giá/);
 const previous=globalThis.window;globalThis.window={open:()=>null};
 try{assert.throws(()=>openQuotePrint(q),/chặn cửa sổ in/);assert.deepEqual(q,before);}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
