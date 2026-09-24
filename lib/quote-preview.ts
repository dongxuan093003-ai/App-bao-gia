import type {Product,Quote} from './data';

/** Preview is a local snapshot and never requires a customer or writes a quote. */
export function prepareQuotePreview(quote:Quote,products:Product[]):Quote{
 if(!quote.lines.length)throw new Error('Tích ít nhất một mặt hàng để xem ảnh.');
 if(quote.lines.some(line=>line.price===null))throw new Error('Còn mặt hàng chưa nhập giá.');
 const snapshot=structuredClone(quote);
 if(!snapshot.code){
  const order=new Map(products.map((p,i)=>[p.id,i]));
  snapshot.lines.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
 }
 return snapshot;
}
