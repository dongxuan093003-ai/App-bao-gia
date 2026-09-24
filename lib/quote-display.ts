/** Stable Vietnamese local date/time for quotation labels and exports. */
export function quoteDateTime(value:string){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return {time:'—',date:'—',label:'—'};
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const time=Number(part('hour'))+':'+part('minute'),day=part('day')+'/'+part('month')+'/'+part('year');
 return {time,date:day,label:time+'   '+day};
}
export function quoteImageName(quote:{customer:string;date:string}){
 const name=quote.customer.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'khach-hang';
 const stamp=quoteDateTime(quote.date).label.replace(/[^0-9]+/g,'-');
 return 'Bao-gia-'+name+'-'+stamp+'.png';
}
