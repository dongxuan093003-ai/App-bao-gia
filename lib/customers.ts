import type {Customer,Data,Quote} from './data';
import {formatPhone} from './phone-format';

export function customerSearchKey(value:string):string {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
}
export function customerPhoneKey(value:string):string {
 const digits=value.replace(/\D/g,'');
 return digits.startsWith('84')&&digits.length===11?'0'+digits.slice(2):digits;
}
function sameNameAddress(a:Customer,b:Customer):boolean {
 return customerSearchKey(a.name)===customerSearchKey(b.name)&&customerSearchKey(a.address)===customerSearchKey(b.address);
}
export function matchCustomer(customers:Customer[],candidate:Customer):Customer|undefined {
 const phone=customerPhoneKey(candidate.phone);
 const matches=customers.filter(c=>phone?customerPhoneKey(c.phone)===phone:!customerPhoneKey(c.phone)&&sameNameAddress(c,candidate));
 return matches.length===1?matches[0]:matches.find(c=>sameNameAddress(c,candidate));
}
export function customerMatchesSearch(customer:Customer,query:string):boolean {
 const text=customerSearchKey(query);
 if(!text)return true;
 if(customerSearchKey(customer.name).includes(text))return true;
 const digits=customerPhoneKey(query);
 return !!digits&&/^[+\d\s().-]+$/.test(query)&&customerPhoneKey(customer.phone).includes(digits);
}

/** Upgrade once: an existing (even empty) address book is authoritative. */
export function migrateCustomers(data:Omit<Data,'customers'> & {customers?:Customer[]}):Data {
 if(Array.isArray(data.customers))return data as Data;
 const customers:Customer[]=[],links=new Map<string,string>(),byKey=new Map<string,Customer>();
 for(const q of [...data.quotes].sort((a,b)=>b.date.localeCompare(a.date))){
  if(q.deleted||q.template||!q.customer.trim())continue;
  const candidate={id:`kh-${customers.length+1}-${q.id.slice(0,80)}`,name:q.customer.trim(),phone:formatPhone(q.phone.trim()),address:q.address.trim()};
  const phone=customerPhoneKey(candidate.phone),key=phone?'phone:'+phone:'name:'+customerSearchKey(candidate.name)+'|'+customerSearchKey(candidate.address);
  let customer=byKey.get(key);
  if(!customer){customer=candidate;customers.push(customer);byKey.set(key,customer);}
  links.set(q.id,customer.id);
 }
 return {...data,customers,quotes:data.quotes.map(q=>links.has(q.id)?{...q,customerId:links.get(q.id)}:q)};
}

/** Link a snapshot; never rewrite an existing customer's details or old quotes. */
export function linkQuoteCustomer(customers:Customer[],quote:Quote,newId:string):{customers:Customer[];quote:Quote} {
 if(!quote.customer.trim())return {customers,quote:quote.customerId?{...quote,customerId:undefined}:quote};
 if(quote.template||quote.customerId)return {customers,quote};
 const candidate={id:newId,name:quote.customer.trim(),phone:formatPhone(quote.phone.trim()),address:quote.address.trim()};
 const existing=matchCustomer(customers,candidate);
 return {customers:existing?customers:[candidate,...customers],quote:{...quote,customerId:(existing||candidate).id}};
}
export function upsertCustomer(customers:Customer[],customer:Customer):Customer[] {
 const next={...customer,name:customer.name.trim(),phone:formatPhone(customer.phone.trim()),address:customer.address.trim()};
 if(!next.name)throw new Error('Nhập tên khách hàng.');
 return customers.some(c=>c.id===next.id)?customers.map(c=>c.id===next.id?next:c):[next,...customers];
}
export function quotesForCustomer(quotes:Quote[],customerId:string):Quote[] {
 return quotes.filter(q=>!q.deleted&&!q.template&&q.customerId===customerId).sort((a,b)=>b.date.localeCompare(a.date));
}
export function customersByLatestQuote(customers:Customer[],quotes:Quote[]):Customer[] {
 const latest=new Map<string,number>();
 for(const q of quotes){
  if(!q.customerId||q.deleted||q.template)continue;
  const time=Date.parse(q.date);
  if(Number.isFinite(time)&&time>(latest.get(q.customerId)??-Infinity))latest.set(q.customerId,time);
 }
 return [...customers].sort((a,b)=>{
  const left=latest.get(a.id)??-Infinity,right=latest.get(b.id)??-Infinity;
  return left===right?0:right-left;
 });
}
