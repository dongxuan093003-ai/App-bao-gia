export type Product = {id:string; group:string; name:string; unit:string; prices:(number|null)[]};
export type PriceList = {id:string;name:string};
export type Header = {id:string; name:string; address:string; phone:string};
export type Line = {id:string; group:string; name:string; unit:string; price:number|null; note:string};
export type Customer = {id:string;name:string;phone:string;address:string};
export type CareNote = {id:string;customerKey:string;text:string;createdAt:string;updatedAt?:string;legacy?:boolean};
export type NoteTemplate = {id:string;name:string;text:string};
export type QuoteNoteTemplate = NoteTemplate & {enabled:boolean};
export type Quote = {id:string; code:string; date:string; customer:string; customerId?:string; phone:string; address:string; tier:number; priceListId?:string; priceListName?:string; header:Header; lines:Line[]; note:string; noteCustom?:string; noteTemplates?:QuoteNoteTemplate[]; internal:string; followUp:string; status:string; deleted:boolean; template:boolean};
export type Data = {products:Product[]; priceLists?:PriceList[]; headers:Header[]; defaultHeader:string; notes:NoteTemplate[]; quotes:Quote[]; customers:Customer[]; careNotes?:CareNote[]; nextNumber:number};
export const defaultPriceLists:PriceList[]=[{id:'price-sang-xe',name:'Giá sang xe'},{id:'price-cong-trinh',name:'Giá công trình'},{id:'price-ban-le',name:'Giá bán lẻ'}];
export const getPriceLists=(data:Pick<Data,'priceLists'>):PriceList[]=>data.priceLists??defaultPriceLists;
export const uid = () => crypto.randomUUID();
export const money = (n:number|null) => n === null ? '' : n.toLocaleString('vi-VN');
export function parsePrice(v:string):number|null {if(!v.trim())return null; if(!/^\d+(?:[.,]\d{3})*$/.test(v.trim()) && !/^\d+$/.test(v.trim())) throw new Error('Nhập số tiền đầy đủ, ví dụ 105.000 (không dùng k).'); const n=Number(v.replace(/[.,]/g,'')); if(!Number.isSafeInteger(n)||n>1e12)throw new Error('Giá không hợp lệ.');return n;}
export function initialData():Data {
 const groups:[string,string,string[]][] = [
 ['Sắt thép Hòa Phát','kg',['Thép D6','Thép D8']],
 ['Sắt thép Hòa Phát','cây',['Thép D10','Thép D12','Thép D14','Thép D16','Thép D18','Thép D20']],
 ['Xi măng','tấn',['XM Trung Sơn','Trung Sơn PCB30','Trung Sơn PCB40','Vicem Bút Sơn PCB40','Thịnh Thành PCB40']],
 ['Gạch','viên',['Gạch Quang Tiến','Gạch HTL']],
 ['Cát đá','m³',['Cát','Cát Vàng Đỏ','Cát Vàng Đẹp','Đá 1x2','Cát Vàng + Đá 1x2']],
 ['Hàng khác','kg',['Đinh 5','Đinh 7']],['Hàng khác','thùng',['Con kê sàn V2','Con kê sàn V7']]];
 return {priceLists:structuredClone(defaultPriceLists),products:groups.flatMap(([group,unit,names])=>names.map((name)=>({id:uid(),name,group,unit,prices:[null,null,null]}))),headers:[{id:'main',name:'Nhà phân phối VLXD SÙNG TUYẾN',address:'Lập Thành - Đông Xuân - Quốc Oai - HN',phone:'0966.825.950 - 0964.02.3003'}],defaultHeader:'main',notes:[{id:'note-1',name:'Mẫu 1',text:'Đơn giá có thể thay đổi theo thị trường và sẽ được cập nhật bằng báo giá mới.'},{id:'note-2',name:'Mẫu 2',text:'Đơn giá chưa bao gồm VAT. Nhận hàng thanh toán.'}],quotes:[],customers:[],nextNumber:1};
}
export function blankQuote(d:Data):Quote {return {id:uid(),code:'',date:new Date().toISOString(),customer:'',phone:'',address:'',tier:0,priceListId:getPriceLists(d)[0].id,priceListName:getPriceLists(d)[0].name,header:structuredClone(d.headers.find(h=>h.id===d.defaultHeader)||d.headers[0]),lines:[],note:d.notes[0]?.text||'',noteCustom:'',noteTemplates:d.notes[0]?[{...d.notes[0],enabled:true}]:[],internal:'',followUp:'',status:'Mới báo',deleted:false,template:false};}
