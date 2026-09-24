'use client';
import {useRef} from 'react';
import {Eye,Share2,Pencil,Trash2,LoaderCircle,MoreHorizontal,CalendarClock,FilePlus2,Type,ChevronRight} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import type {Quote} from '@/lib/data';
import {quoteDateTime} from '@/lib/quote-display';
import {formatPhone} from '@/lib/phone-format';

export default function QuoteHistoryCard({quote:q,highlighted=false,disabled,loading,due,onCustomer,onView,onShare,onEdit,onCare,onDelete,onSaveTemplate,onUseTemplate,onRenameTemplate}:{quote:Quote;highlighted?:boolean;disabled:boolean;loading:boolean;due:boolean;onCustomer:()=>void;onView:()=>void;onShare:()=>void;onEdit:()=>void;onCare:()=>void;onDelete:()=>void;onSaveTemplate:()=>void;onUseTemplate:()=>void;onRenameTemplate:()=>void}){
 const stamp=quoteDateTime(q.date);
 const name=q.customer.trim()||(q.template?'Mẫu báo giá':'Chưa đặt tên');
 const keepDialogFocus=useRef(false);
 const phone=q.phone.trim(),address=q.address.trim();
 const phoneDigits=phone.replace(/\D/g,''),dialNumber=(phone.startsWith('+')?'+':'')+phoneDigits;
 return <article className="history-quote-card" data-saved-quote={highlighted?'true':undefined} aria-busy={loading}>
  <time dateTime={q.date} className="history-quote-time"><span>{stamp.time}</span><span>{stamp.date}</span></time>
  <div className="history-quote-info">
   <h2 className="history-quote-customer">{q.template?<button className="history-customer-open template-use" disabled={disabled} onClick={onUseTemplate} aria-label={'Dùng mẫu '+name}>{name}<ChevronRight aria-hidden="true"/></button>:<button className="history-customer-open" disabled={disabled} onClick={onCustomer} aria-label={'Mở nhật ký chăm sóc '+name}>{name}</button>}{!q.template&&due&&<button type="button" className="care-due-icon" disabled={disabled} aria-label={'Cần chăm sóc '+name} title={'Hẹn liên hệ '+q.followUp.split('-').reverse().join('/')} onClick={onCare}><CalendarClock/></button>}</h2>
   {!q.template&&phone&&<p className="history-quote-contact"><span>Số điện thoại: </span>{phoneDigits?<a href={'tel:'+dialNumber} aria-label={'Gọi '+name+' theo số '+formatPhone(phone)}>{formatPhone(phone)}</a>:phone}</p>}
   {!q.template&&address&&<p className="history-quote-contact"><span>Địa chỉ: </span>{address}</p>}
  </div>
  <div className="history-quote-actions">
   <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" disabled={disabled} title={loading?'Đang tạo ảnh…':q.template?'Thao tác mẫu':'Thao tác báo giá'} aria-label={(q.template?'Thao tác mẫu ':loading?'Đang tạo ảnh báo giá của ':'Thao tác báo giá của ')+name}>{loading?<LoaderCircle className="quote-image-loading" aria-hidden="true"/>:<MoreHorizontal aria-hidden="true"/>}</button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="history-quote-menu" onCloseAutoFocus={e=>{if(keepDialogFocus.current){e.preventDefault();keepDialogFocus.current=false;}}}>
     <DropdownMenuItem disabled={disabled} onSelect={onView}><Eye/>Xem báo giá</DropdownMenuItem>
     {q.template?<>
      <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onEdit();}}><Pencil/>Sửa mẫu</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onRenameTemplate();}}><Type/>Đổi tên</DropdownMenuItem>
     </>:<>
      <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onEdit();}}><Pencil/>Chỉnh sửa</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={onShare}><Share2/>Chia sẻ</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onSaveTemplate();}}><FilePlus2/>Lưu thành mẫu</DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onCare();}}><CalendarClock/>Theo dõi nội bộ</DropdownMenuItem>
     </>}
     <DropdownMenuItem disabled={disabled} variant="destructive" onSelect={()=>{keepDialogFocus.current=true;onDelete();}}><Trash2/>Xóa</DropdownMenuItem>
    </DropdownMenuContent>
   </DropdownMenu>
  </div>
 </article>;
}
