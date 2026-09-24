import {getPriceLists,type Data,type Quote} from './data';

// Capture the legacy column once. A removed column must never point at its neighbour.
export function migrateQuotePriceList(quote:Quote,data:Pick<Data,'priceLists'>):Quote{
 if(quote.priceListId)return quote;
 const list=getPriceLists(data)[quote.tier];
 return {...quote,priceListId:list?.id??'legacy-price-'+quote.tier,priceListName:list?.name??'Bảng giá cũ'};
}
export function migratePriceLists(data:Data):Data{
 const priceLists=getPriceLists(data).map(list=>({...list}));
 return {...data,priceLists,quotes:data.quotes.map(q=>migrateQuotePriceList(q,{priceLists}))};
}
export function quotePriceIndex(data:Data,quote:Quote):number{
 const saved=migrateQuotePriceList(quote,data);
 return getPriceLists(data).findIndex(list=>list.id===saved.priceListId);
}
export type PriceListAction={type:'add';id:string;name:string;copyFrom?:string}|{type:'rename';id:string;name:string}|{type:'delete';id:string};
export function updatePriceLists(source:Data,action:PriceListAction):Data{
 const data=migratePriceLists(source),lists=data.priceLists!;
 const index=lists.findIndex(list=>list.id===action.id);
 if(action.type==='delete'){
  if(index<0)throw new Error('Bảng giá này đã được xóa.');
  if(lists.length===1)throw new Error('Cần giữ ít nhất một bảng giá.');
  return {...data,priceLists:lists.filter(list=>list.id!==action.id),products:data.products.map(p=>({...p,prices:p.prices.filter((_,i)=>i!==index)}))};
 }
 const name=action.name.trim();
 if(!name||name.length>100)throw new Error('Nhập tên bảng giá từ 1 đến 100 ký tự.');
 if(lists.some(list=>list.id!==action.id&&list.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))throw new Error('Tên bảng giá đã có. Hãy chọn tên khác.');
 if(action.type==='rename'){
  if(index<0)throw new Error('Bảng giá này đã được xóa.');
  return {...data,priceLists:lists.map(list=>list.id===action.id?{...list,name}:list)};
 }
 if(index>=0)throw new Error('Bảng giá đã được thêm.');
 if(lists.length>=100)throw new Error('Đã đạt giới hạn 100 bảng giá.');
 const from=action.copyFrom?lists.findIndex(list=>list.id===action.copyFrom):-1;
 if(action.copyFrom&&from<0)throw new Error('Bảng giá nguồn đã thay đổi. Hãy chọn lại.');
 return {...data,priceLists:[...lists,{id:action.id,name}],products:data.products.map(p=>({...p,prices:[...p.prices,from<0?null:p.prices[from]??null]}))};
}
