import {z} from 'zod';
import type {Data,Quote} from './data';
import {workspaceSchema,quoteSchema,validPriceListColumns} from './data-schema';
import {migratePriceLists,migrateQuotePriceList} from './price-lists';
import {migrateCustomers} from './customers';
import {migrateNotes} from './note-templates';

export const MAX_BACKUP_BYTES=8_000_000;
export type Backup={data:Data;draft:Quote|null;exportedAt:string|null};
export type BackupReason='automatic'|'manual'|'before_restore';
export type BackupSummary=ReturnType<typeof backupSummary>;
export type BackupEntry={id:string;createdAt:string;reason:BackupReason;version:number;summary:BackupSummary};
export function backupSummary(data:Data){return {
 priceLists:data.priceLists?.length??3,products:data.products.length,customers:data.customers?.length??0,
 quotes:data.quotes.filter(q=>!q.template&&!q.deleted).length,templates:data.quotes.filter(q=>q.template&&!q.deleted).length,
 headers:data.headers.length,notes:data.notes.length,careNotes:data.careNotes?.length??0,
};}
export function backupFilename(date:Date|string=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date));
 const value=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `Baogia_${value('hour')}${value('minute')}_${value('day')}-${value('month')}-${value('year')}.json`;
}
export function serializeBackup(data:Data,draft:Quote|null=null,exportedAt=new Date().toISOString()){
 return JSON.stringify({format:'baogia',schemaVersion:1,exportedAt,data,draft},null,2);
}
const backupSchema=z.object({
 format:z.literal('baogia').optional(),schemaVersion:z.literal(1).optional(),
 data:workspaceSchema.extend({customers:workspaceSchema.shape.customers.optional(),notes:z.array(z.union([z.string().max(4000),workspaceSchema.shape.notes.element])).max(100)}),
 draft:quoteSchema.nullable().optional(),exportedAt:z.string().nullable().optional(),
});
function unique(rows:{id:string}[]){return new Set(rows.map(r=>r.id)).size===rows.length;}
export function parseBackup(raw:string):Backup{
 let json:unknown;
 try{json=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{throw new Error('File không đúng định dạng sao lưu JSON.');}
 const result=backupSchema.safeParse(json);
 if(!result.success)throw new Error('File sao lưu thiếu dữ liệu hoặc có nội dung không hợp lệ.');
 if(!validPriceListColumns(result.data.data))throw new Error('Các cột bảng giá trong file không hợp lệ.');
 const data=migratePriceLists(migrateCustomers(migrateNotes(result.data.data)));
 const draft=result.data.draft?migrateQuotePriceList(result.data.draft,data):null;
 if(![data.products,data.headers,data.customers,data.quotes,data.notes,data.careNotes||[]].every(unique)||
    !data.headers.some(h=>h.id===data.defaultHeader)||
    [...data.quotes,...(draft?[draft]:[])].some(q=>!unique(q.lines)||!Number.isFinite(Date.parse(q.date)))){
  throw new Error('File có mã trùng, ngày báo giá hoặc tiêu đề mặc định không hợp lệ.');
 }
 // The restored payload must fit the same request limit as a normal cloud save.
 if(JSON.stringify({version:Number.MAX_SAFE_INTEGER,data}).length>5_000_000)throw new Error('Dữ liệu vượt dung lượng cho phép.');
 return {data,draft,exportedAt:result.data.exportedAt&&Number.isFinite(Date.parse(result.data.exportedAt))?result.data.exportedAt:null};
}
