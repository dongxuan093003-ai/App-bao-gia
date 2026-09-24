import type {Data,Quote} from './data';

/** A new quote owns its entire snapshot, including stored prices and notes. */
export function copyQuoteForCustomer(source:Quote,id:string,date:string):Quote{
 return {...structuredClone(source),id,code:'',date,customer:'',customerId:undefined,
  phone:'',address:'',internal:'',followUp:'',status:'Mới báo',deleted:false,template:false};
}

export function createQuoteTemplate(source:Quote,name:string,id:string,date:string):Quote{
 const title=name.trim();
 if(!title)throw new Error('Nhập tên mẫu.');
 if(!source.lines.length)throw new Error('Tích ít nhất một mặt hàng.');
 if(source.lines.some(line=>line.price===null))throw new Error('Còn mặt hàng chưa nhập giá.');
 return {...copyQuoteForCustomer(source,id,date),customer:title,template:true};
}

export function renameQuoteTemplate(data:Data,id:string,name:string):Data{
 const title=name.trim();
 if(!title)throw new Error('Nhập tên mẫu.');
 if(!data.quotes.some(q=>q.id===id&&q.template&&!q.deleted))throw new Error('Mẫu không còn tồn tại. Hãy tải lại danh sách.');
 return {...data,quotes:data.quotes.map(q=>q.id===id?{...q,customer:title}:q)};
}
