import type {CareNote,Customer,Data,Quote} from './data';
import {matchCustomer} from './customers';

export type JournalTarget={key:string;customer:Customer;quoteId?:string};
export type JournalDraft={text:string;editingId?:string;originalText?:string;noteId?:string;createdAt?:string};
export type JournalAction={type:'add';note:CareNote}|{type:'edit';id:string;text:string;originalText:string;updatedAt:string}|{type:'delete';id:string};
export function parseJournalDrafts(raw:string|null):Record<string,JournalDraft>{
 try{
  const parsed=JSON.parse(raw||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
  return Object.fromEntries(Object.entries(parsed).filter(([key,d])=>/^[cq]:/.test(key)&&key.length<=110&&d&&typeof d==='object'&&typeof (d as JournalDraft).text==='string'&&(d as JournalDraft).text.length<=4000).map(([key,value])=>{
   const d=value as JournalDraft;return [key,{text:d.text,...(typeof d.editingId==='string'&&typeof d.originalText==='string'?{editingId:d.editingId,originalText:d.originalText}:{}),...(typeof d.noteId==='string'&&typeof d.createdAt==='string'?{noteId:d.noteId,createdAt:d.createdAt}:{})}];
  }));
 }catch{return {};}
}
export function customerJournalTarget(customer:Customer):JournalTarget{return {key:'c:'+customer.id,customer};}
export function quoteJournalTarget(data:Data,q:Quote):JournalTarget{
 const snapshot={id:q.customerId||q.id,name:q.customer.trim()||'Chưa đặt tên',phone:q.phone,address:q.address};
 if(!q.customer.trim())return {key:'q:'+q.id,customer:{...snapshot,id:q.id},quoteId:q.id};
 const customer=q.customerId?data.customers.find(c=>c.id===q.customerId):matchCustomer(data.customers,snapshot);
 return {key:q.customerId?'c:'+q.customerId:customer?'c:'+customer.id:'q:'+q.id,customer:customer||snapshot,quoteId:q.id};
}
/** Existing internal notes are imported once; an empty journal stays empty after deletion. */
export function migrateJournal(data:Data):Data{
 if(Array.isArray(data.careNotes))return data;
 return {...data,careNotes:data.quotes.filter(q=>!q.deleted&&!q.template&&q.internal.trim()).map(q=>({
  id:'legacy:'+q.id,customerKey:quoteJournalTarget(data,q).key,text:q.internal,
  createdAt:Number.isFinite(Date.parse(q.date))?new Date(q.date).toISOString():'1970-01-01T00:00:00.000Z',legacy:true,
 }))};
}
export function journalNotes(data:Data,key:string):CareNote[]{
 const keys=journalNoteKeys(data,key);
 return (migrateJournal(data).careNotes||[]).filter(n=>keys.has(n.customerKey)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
// Notes written before a customer is named remain attached to that quotation.
function journalNoteKeys(data:Data,key:string):Set<string>{
 return new Set([key,...data.quotes.filter(q=>!q.deleted&&!q.template&&quoteJournalTarget(data,q).key===key).map(q=>'q:'+q.id)]);
}
export function journalQuotes(data:Data,key:string):Quote[]{
 return data.quotes.filter(q=>!q.deleted&&!q.template&&quoteJournalTarget(data,q).key===key).sort((a,b)=>b.date.localeCompare(a.date));
}
export function updateJournal(data:Data,key:string,action:JournalAction):Data{
 const notes=migrateJournal(data).careNotes!;
 if(!key||key.length>110)throw new Error('Không xác định được khách hàng.');
 if(action.type==='add'){
  const n=action.note;
  if(n.customerKey!==key||!n.id||n.id.length>120||!Number.isFinite(Date.parse(n.createdAt)))throw new Error('Ghi chú không hợp lệ.');
  const duplicate=notes.find(x=>x.id===n.id);
  if(duplicate){if(duplicate.customerKey===key&&duplicate.text===n.text.trim())return data;throw new Error('Ghi chú đã thay đổi. Hãy tải lại.');}
  if(!n.text.trim()||n.text.length>4000)throw new Error('Nhập ghi chú từ 1 đến 4.000 ký tự.');
  if(notes.length>=10000)throw new Error('Nhật ký đã đầy. Hãy sao lưu và xóa bớt ghi chú cũ.');
  return {...data,careNotes:[{id:n.id,customerKey:key,text:n.text.trim(),createdAt:n.createdAt},...notes]};
 }
 const keys=journalNoteKeys(data,key);
 const target=notes.find(n=>n.id===action.id&&keys.has(n.customerKey));
 if(!target)throw new Error('Ghi chú không còn trong danh sách. Hãy tải lại.');
 if(action.type==='delete')return {...data,careNotes:notes.filter(n=>n!==target)};
 if(target.text!==action.originalText)throw new Error('Ghi chú đã được sửa trên thiết bị khác. Giữ lại nội dung đang nhập và mở lại ghi chú.');
 if(!action.text.trim()||action.text.length>4000||!Number.isFinite(Date.parse(action.updatedAt)))throw new Error('Nội dung ghi chú không hợp lệ.');
 return {...data,careNotes:notes.map(n=>n===target?{...n,text:action.text.trim(),updatedAt:action.updatedAt}:n)};
}
