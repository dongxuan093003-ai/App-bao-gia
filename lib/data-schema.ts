import {z} from 'zod';

const text=z.string().max(4000),id=z.string().min(1).max(100);
const price=z.number().int().min(0).max(1e12).nullable();
export const priceListSchema=z.object({id,name:z.string().trim().min(1).max(100)});
export const headerSchema=z.object({id,name:text,address:text,phone:text});
const lineSchema=z.object({id,group:text,name:text,unit:text,price,note:text});
export const noteTemplateSchema=z.object({id,name:z.string().min(1).max(100),text});
export const careNoteSchema=z.object({id:z.string().min(1).max(120),customerKey:z.string().min(1).max(110),text:z.string().trim().min(1).max(4000),createdAt:z.string().datetime(),updatedAt:z.string().datetime().optional(),legacy:z.boolean().optional()});
export const quoteSchema=z.object({
 id,code:text,date:text,customer:text,customerId:id.optional(),phone:text,address:text,
 tier:z.number().int().min(0).max(99),priceListId:id.optional(),priceListName:z.string().max(100).optional(),header:headerSchema,lines:z.array(lineSchema).max(1000),
 note:text,noteCustom:text.optional(),noteTemplates:z.array(noteTemplateSchema.extend({enabled:z.boolean()})).max(100).optional(),internal:text,followUp:text,status:z.enum(['Mới báo','Đang cân nhắc','Đã chốt','Không chốt']),
 deleted:z.boolean(),template:z.boolean(),
});
export const workspaceSchema=z.object({
 priceLists:z.array(priceListSchema).min(1).max(100).optional(),
 careNotes:z.array(careNoteSchema).max(10000).optional(),
 customers:z.array(z.object({id,name:text,phone:text,address:text})).max(5000),
 products:z.array(z.object({id,group:text,name:text,unit:text,prices:z.array(price).min(1).max(100)})).max(1000),
 headers:z.array(headerSchema).min(1).max(100),defaultHeader:id,notes:z.array(noteTemplateSchema).max(100),
 nextNumber:z.number().int().positive(),quotes:z.array(quoteSchema).max(5000),
});
export function validPriceListColumns(data:{priceLists?:{id:string;name:string}[];products:{prices:unknown[]}[]}):boolean{
 const lists=data.priceLists;
 return data.products.every(p=>p.prices.length===(lists?.length??3))&&(!lists||(
  new Set(lists.map(l=>l.id)).size===lists.length&&new Set(lists.map(l=>l.name.toLocaleLowerCase('vi'))).size===lists.length));
}
export const workspaceRequestSchema=z.object({version:z.number().int().min(0),data:workspaceSchema}).refine(value=>validPriceListColumns(value.data),'Các cột bảng giá không hợp lệ.');
