'use client';
import {useRef,useState} from 'react';
import {Check,Pencil,Plus,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {uid,type PriceList} from '@/lib/data';
import type {PriceListAction} from '@/lib/price-lists';

type Props={open:boolean;onOpenChange:(open:boolean)=>void;lists:PriceList[];selectedId:string;disabled:boolean;onSave:(action:PriceListAction)=>Promise<boolean>};
export default function PriceListManager({open,onOpenChange,lists,selectedId,disabled,onSave}:Props){
 const [form,setForm]=useState<{id:string;name:string;adding:boolean;copyFrom:string}|null>(null);
 const [deleting,setDeleting]=useState<PriceList|null>(null),[saving,setSaving]=useState(false);
 const title=useRef<HTMLHeadingElement>(null);
 const locked=disabled||saving;
 async function save(action:PriceListAction){
  if(locked)return false;
  setSaving(true);
  try{const ok=await onSave(action);if(ok){setForm(null);setDeleting(null);}return ok;}
  finally{setSaving(false);}
 }
 return <>
  <Dialog open={open} onOpenChange={value=>{if(locked)return;if(!value&&form){setForm(null);return;}onOpenChange(value);}}>
   <DialogContent className="price-list-manager" onOpenAutoFocus={e=>{e.preventDefault();title.current?.focus({preventScroll:true});}} onEscapeKeyDown={e=>{if(locked)e.preventDefault();}}>
    <DialogTitle ref={title} tabIndex={-1}>{form?(form.adding?'Thêm bảng giá':'Đổi tên bảng giá'):'Quản lý bảng giá'}</DialogTitle>
    <DialogDescription>{form?'Đặt tên dễ phân biệt khi chọn để báo khách.':'Dùng chung mặt hàng, đơn giá riêng cho từng bảng.'}</DialogDescription>
    {form?<form className="price-list-form" onSubmit={e=>{e.preventDefault();void save(form.adding?{type:'add',id:form.id,name:form.name,copyFrom:form.copyFrom==='empty'?undefined:form.copyFrom}:{type:'rename',id:form.id,name:form.name});}}>
     <label className="field"><span>Tên bảng giá</span><input aria-label="Tên bảng giá" placeholder="Ví dụ: Giá khách quen" maxLength={100} value={form.name} disabled={locked} onChange={e=>setForm({...form,name:e.target.value})} enterKeyHint="done"/></label>
     {form.adding&&<label className="field"><span>Giá ban đầu</span><Select value={form.copyFrom} onValueChange={copyFrom=>setForm({...form,copyFrom})} disabled={locked}><SelectTrigger className="choice" aria-label="Giá ban đầu"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="empty">Để giá trống</SelectItem>{lists.map(list=><SelectItem key={list.id} value={list.id}>Sao chép: {list.name}</SelectItem>)}</SelectContent></Select></label>}
     <div className="price-list-form-actions"><button type="button" disabled={locked} onClick={()=>setForm(null)}>Hủy</button><button className="primary" type="submit" disabled={locked||!form.name.trim()}>{saving?'Đang lưu…':'Lưu'}</button></div>
    </form>:<>
     <button className="price-list-add" disabled={locked||lists.length>=100} onClick={()=>setForm({id:uid(),name:'',adding:true,copyFrom:'empty'})}><Plus/>Thêm bảng giá</button>
     <div className="price-list-rows">{lists.map(list=><div className="price-list-row" key={list.id}><span>{list.name}{list.id===selectedId&&<small><Check/>Đang chọn</small>}</span><button disabled={locked} aria-label={'Đổi tên '+list.name} onClick={()=>setForm({id:list.id,name:list.name,adding:false,copyFrom:'empty'})}><Pencil/></button><button className="price-list-delete" disabled={locked||lists.length===1} title={lists.length===1?'Cần giữ ít nhất một bảng giá':'Xóa bảng giá'} aria-label={'Xóa '+list.name} onClick={()=>setDeleting(list)}><Trash2/></button></div>)}</div>
    </>}
   </DialogContent>
  </Dialog>
  <AlertDialog open={!!deleting} onOpenChange={value=>{if(!value&&!locked)setDeleting(null);}}><AlertDialogContent><AlertDialogTitle>Xóa {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>Đơn giá trong bảng này sẽ bị xóa. Danh sách mặt hàng và báo giá đã lưu vẫn được giữ nguyên.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={locked}>Hủy</AlertDialogCancel><AlertDialogAction disabled={locked} onClick={e=>{e.preventDefault();if(deleting)void save({type:'delete',id:deleting.id});}}>{saving?'Đang xóa…':'Xóa bảng giá'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
