import type {Data,Quote} from './data';

// Keep stored status values compatible with existing quotes and backups.
export const careStatuses=[
 {value:'Mới báo',label:'Mới báo'},
 {value:'Đang cân nhắc',label:'Đang trao đổi'},
 {value:'Đã chốt',label:'Đã chốt'},
 {value:'Không chốt',label:'Không lấy'},
];
export const careStatusLabel=(status:string)=>careStatuses.find(s=>s.value===status)?.label||status;
export type QuoteCare=Pick<Quote,'status'|'followUp'|'internal'>;
export const quoteCare=(q:Quote):QuoteCare=>({status:q.status,followUp:q.followUp,internal:q.internal});

export function careDay(offset=0,now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const day=new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
 day.setUTCDate(day.getUTCDate()+offset);
 return day.toISOString().slice(0,10);
}
function validDay(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const date=new Date(day+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===day;
}
export function isCareDue(q:Quote,today=careDay()){
 return !q.deleted&&!q.template&&validDay(q.followUp)&&q.followUp<=today&&!['Đã chốt','Không chốt'].includes(q.status);
}
export function updateQuoteCare(data:Data,id:string,draft:QuoteCare):Data{
 const target=data.quotes.find(q=>q.id===id&&!q.deleted&&!q.template);
 if(!target)throw new Error('Báo giá không còn trong danh sách. Hãy tải lại dữ liệu.');
 if(!careStatuses.some(s=>s.value===draft.status))throw new Error('Chọn tình trạng báo giá.');
 if(draft.followUp&&!validDay(draft.followUp))throw new Error('Chọn ngày liên hệ hợp lệ.');
 if(draft.internal.length>4000)throw new Error('Ghi chú tối đa 4.000 ký tự.');
 const fields:QuoteCare={status:draft.status,followUp:draft.followUp,internal:draft.internal};
 return {...data,quotes:data.quotes.map(q=>q.id===id?{...q,...fields}:q)};
}
