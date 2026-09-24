'use client';
import {useRef,useState} from 'react';
import {CalendarDays,Check,Phone,Save} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {Quote} from '@/lib/data';
import {careDay,careStatuses,quoteCare,type QuoteCare} from '@/lib/quote-care';
import {formatPhone} from '@/lib/phone-format';
import {quoteDateTime} from '@/lib/quote-display';

type Props={quote:Quote;disabled:boolean;conflict:boolean;onClose:()=>void;onSave:(id:string,fields:QuoteCare)=>Promise<boolean>};
export default function QuoteCareDialog({quote,disabled,conflict,onClose,onSave}:Props){
 const [draft,setDraft]=useState(()=>quoteCare(quote)),[pending,setPending]=useState(false),[discard,setDiscard]=useState(false),[error,setError]=useState('');
 const title=useRef<HTMLHeadingElement>(null),dateInput=useRef<HTMLInputElement>(null),saving=useRef(false);
 const dirty=JSON.stringify(draft)!==JSON.stringify(quoteCare(quote)),locked=disabled||pending;
 function change(fields:Partial<QuoteCare>){setDraft(current=>({...current,...fields}));setError('');}
 async function save(completed=false){
  if(locked||saving.current)return;
  saving.current=true;setPending(true);setError('');
  try{
   if(await onSave(quote.id,completed?{...draft,followUp:''}:draft))onClose();
   else setError('Chưa lưu được. Nội dung đang nhập vẫn được giữ để thử lại.');
  }catch{setError('Chưa lưu được. Vui lòng thử lại.');}
  finally{saving.current=false;setPending(false);}
 }
 return <>
  <Dialog open onOpenChange={open=>{if(!open&&!pending){if(dirty)setDiscard(true);else onClose();}}}>
   <DialogContent className="quote-care-dialog" onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus({preventScroll:true});}}>
    <DialogTitle ref={title} tabIndex={-1}>Theo dõi nội bộ</DialogTitle>
    <DialogDescription>Chỉ dùng nội bộ, không xuất lên ảnh báo giá.</DialogDescription>
    <div className="care-customer"><strong>{quote.customer||'Khách hàng'}</strong><span>{quoteDateTime(quote.date).label}</span>{quote.phone&&<a href={'tel:'+quote.phone.replace(/[^+\d]/g,'')}><Phone/>{formatPhone(quote.phone)}</a>}</div>
    <label className="field"><span>Tình trạng</span><Select value={draft.status} onValueChange={status=>change({status})} disabled={locked}><SelectTrigger className="choice" aria-label="Tình trạng báo giá"><SelectValue/></SelectTrigger><SelectContent>{careStatuses.map(status=><SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></label>
    <div className="care-date-field"><label className="field"><span>Ngày liên hệ lại</span><input ref={dateInput} type="date" aria-label="Ngày liên hệ lại" value={draft.followUp} disabled={locked} onChange={e=>change({followUp:e.target.value})}/></label>
     <div className="care-quick-dates"><button type="button" disabled={locked} aria-pressed={draft.followUp===careDay()} onClick={()=>change({followUp:careDay()})}>Hôm nay</button><button type="button" disabled={locked} aria-pressed={draft.followUp===careDay(1)} onClick={()=>change({followUp:careDay(1)})}>Ngày mai</button><button type="button" disabled={locked} onClick={()=>{try{if(dateInput.current?.showPicker)dateInput.current.showPicker();else dateInput.current?.focus();}catch{dateInput.current?.focus();}}}><CalendarDays/>Chọn ngày</button></div>
    </div>
    <label className="field"><span>Ghi chú</span><textarea aria-label="Ghi chú nội bộ" placeholder="Khách đang so giá, gọi lại chiều mai…" maxLength={4000} readOnly={locked} value={draft.internal} onChange={e=>change({internal:e.target.value})}/></label>
    {(conflict||error)&&<p className="care-error" role="alert">{conflict?'Dữ liệu đã thay đổi trên thiết bị khác. Hãy giữ lại ghi chú, đóng cửa sổ rồi tải dữ liệu mới.':error}</p>}
    <div className="care-actions"><button type="button" disabled={locked||!draft.followUp} onClick={()=>void save(true)}><Check/>Đã liên hệ</button><button type="button" className="primary" disabled={locked} onClick={()=>void save()}><Save/>{pending?'Đang lưu…':'Lưu'}</button></div>
   </DialogContent>
  </Dialog>
  <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent><AlertDialogTitle>Bỏ thay đổi chưa lưu?</AlertDialogTitle><AlertDialogDescription>Ghi chú và lịch hẹn đang sửa chưa được lưu.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Quay lại</AlertDialogCancel><AlertDialogAction onClick={onClose}>Bỏ thay đổi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
