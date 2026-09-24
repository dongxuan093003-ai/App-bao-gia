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
const model=loadTs('lib/data.ts'),notes=loadTs('lib/note-templates.ts'),{prepareQuotePreview}=loadTs('lib/quote-preview.ts');
const schema=loadTs('lib/data-schema.ts');

test('legacy template migration adds stable titles without changing quote snapshots',()=>{
 const data=model.initialData();data.notes=['Nội dung một','Nội dung hai'];
 const q={...model.blankQuote({...data,notes:[]}),note:'Nội dung cũ tự nhập'};
 data.quotes=[q];const before=JSON.stringify(data);
 const first=notes.migrateNotes(data),second=notes.migrateNotes(data);
 assert.deepEqual(first,second);assert.equal(JSON.stringify(data),before);
 assert.deepEqual(first.quotes,[q]);assert.equal(first.notes[1].name,'Mẫu 2');
 assert.equal(notes.nextNoteName(first.notes),'Mẫu 3');
 assert.equal(notes.nextNoteName([first.notes[1]]),'Mẫu 3');
 assert.deepEqual(notes.migrateNotes(first),first);
});

test('each template toggles independently without deleting manually entered wording or duplicating text',()=>{
 const data=model.initialData();let q=model.blankQuote(data);
 const manual='Gọi trước khi giao.\n'+data.notes[0].text;
 q=notes.changeCustomNote(q,manual,data.notes);
 q=notes.toggleQuoteNote(q,data.notes[1],data.notes);
 assert.ok(q.note.includes(data.notes[1].text));
 q=notes.toggleQuoteNote(q,data.notes[0],data.notes);
 assert.equal(q.noteCustom,manual);
 assert.equal(q.note,data.notes[1].text+'\n'+manual);
 q=notes.toggleQuoteNote(q,data.notes[1],data.notes);
 assert.equal(q.note,manual);
 q=notes.toggleQuoteNote(q,data.notes[1],data.notes);
 q=notes.toggleQuoteNote(q,data.notes[1],data.notes);
 assert.equal(q.note,manual);
 assert.equal(q.noteTemplates.length,2);
 assert.ok(schema.quoteSchema.safeParse(q).success);
});

test('saved template content remains a snapshot after rename, edit or delete in settings',()=>{
 const data=model.initialData();let q=model.blankQuote(data);
 const oldText=q.note,changed=data.notes.map(n=>({...n,name:'Tên mới',text:'Nội dung mới'}));
 q=notes.toggleQuoteNote(q,changed[0],changed);assert.equal(q.note,'');
 q=notes.toggleQuoteNote(q,changed[0],changed);assert.equal(q.note,oldText);
 assert.equal(notes.quoteNoteState(q,[]).templates[0].name,'Mẫu 1');
 assert.equal(notes.quoteNoteState(q,[]).templates[0].text,oldText);
 assert.equal(model.blankQuote({...data,notes:changed}).note,'Nội dung mới');
});

test('legacy default text can be switched off; custom legacy text is preserved',()=>{
 const data=model.initialData(),q=model.blankQuote(data);
 delete q.noteCustom;delete q.noteTemplates;
 assert.equal(notes.toggleQuoteNote(q,data.notes[0],data.notes).note,'');
 q.note=data.notes[0].text+'\n'+data.notes[1].text+'\nLời nhắn riêng';
 const legacyState=notes.quoteNoteState(q,data.notes);
 assert.equal(legacyState.templates.length,2);assert.equal(legacyState.manual,'Lời nhắn riêng');
 assert.equal(notes.toggleQuoteNote(q,data.notes[1],data.notes).note,data.notes[0].text+'\nLời nhắn riêng');
 q.note='Lời nhắn riêng\nKhông có trong mẫu';
 const toggled=notes.toggleQuoteNote(q,data.notes[0],data.notes);
 assert.equal(toggled.noteCustom,q.note);
 assert.equal(notes.toggleQuoteNote(toggled,data.notes[0],data.notes).note,q.note);
});

test('preview accepts a nameless unsaved quote, sorts a copy and leaves saved identity untouched',()=>{
 const data=model.initialData(),q=model.blankQuote(data);
 q.lines=[...data.products.slice(0,2)].reverse().map(p=>({id:p.id,group:p.group,name:p.name,unit:p.unit,price:0,note:''}));
 const before=JSON.stringify(q),snapshot=prepareQuotePreview(q,data.products);
 assert.equal(snapshot.customer,'');assert.equal(snapshot.code,'');assert.equal(snapshot.date,q.date);
 assert.equal(snapshot.lines[0].id,data.products[0].id);assert.equal(JSON.stringify(q),before);
 snapshot.lines[0].price=123;assert.equal(q.lines[1].price,0);
 assert.throws(()=>prepareQuotePreview({...q,lines:[]},data.products),/mặt hàng/);
 assert.throws(()=>prepareQuotePreview({...q,lines:[{...q.lines[0],price:null}]},data.products),/chưa nhập giá/);
});

test('PNG export accepts missing customer and includes only enabled note content, never template titles',async()=>{
 const data=model.initialData();let q=model.blankQuote(data);
 q.lines=[{...data.products[0],price:16000,note:''}];
 q.customer='   ';q.phone='0964023003';q.address='Lập Thành';
 q=notes.toggleQuoteNote(q,data.notes[0],data.notes);
 q=notes.toggleQuoteNote(q,data.notes[1],data.notes);
 const drawn=[],context={measureText:t=>({width:t.length*14}),fillText:t=>drawn.push(t),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const savedDocument=globalThis.document;
 globalThis.document={fonts:{ready:Promise.resolve()},createElement:()=>({getContext:()=>context,toBlob:callback=>callback(new Blob(['png'],{type:'image/png'}))})};
 try{
  const image=loadTs('lib/quote-image.ts',{'./data':model,'./phone-format':loadTs('lib/phone-format.ts'),'./quote-display':loadTs('lib/quote-display.ts')});
  const blob=await image.quoteImage(prepareQuotePreview(q,data.products));
  assert.equal(blob.type,'image/png');
  const text=drawn.join(' ');assert.ok(text.includes(data.notes[1].text));
  assert.ok(!text.includes(data.notes[0].text));assert.ok(!text.includes('Mẫu 2'));assert.ok(!text.includes('Khách hàng :'));
  assert.ok(text.includes('Số điện thoại :'));assert.ok(text.includes('0964 023 003'));assert.ok(text.includes('Địa chỉ :'));assert.ok(text.includes('Lập Thành'));assert.ok(!text.includes('Chưa đặt tên'));
 }finally{globalThis.document=savedDocument;}
});
