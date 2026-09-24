'use client';
import {useId,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export default function QuoteTemplateName({mode,initialName,disabled,onSave,onClose,onReturnFocus}:{mode:'create'|'rename';initialName:string;disabled:boolean;onSave:(name:string)=>Promise<boolean>;onClose:()=>void;onReturnFocus:()=>void}){
 const [name,setName]=useState(initialName),[saving,setSaving]=useState(false);
 const input=useRef<HTMLInputElement>(null),submitting=useRef(false),id=useId();
 const locked=disabled||saving;
 async function submit(){
  if(locked||submitting.current||!name.trim())return;
  submitting.current=true;setSaving(true);
  try{await onSave(name.trim());}finally{submitting.current=false;setSaving(false);}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!locked)onClose();}}>
  <DialogContent className="template-name-dialog" onOpenAutoFocus={e=>{e.preventDefault();input.current?.focus();input.current?.select();}} onCloseAutoFocus={e=>{e.preventDefault();onReturnFocus();}} onEscapeKeyDown={e=>{if(locked)e.preventDefault();}}>
   <DialogTitle>{mode==='create'?'Lưu thành mẫu':'Đổi tên mẫu'}</DialogTitle>
   <DialogDescription>{mode==='create'?'Lưu mặt hàng, đơn giá và ghi chú để dùng cho báo giá mới.':'Nhập tên để dễ nhận biết mẫu.'}</DialogDescription>
   <form onSubmit={e=>{e.preventDefault();void submit();}}>
    <label className="field" htmlFor={id}><span>Tên mẫu</span><input ref={input} id={id} value={name} maxLength={4000} placeholder="Ví dụ: Thép và xi măng" autoComplete="off" enterKeyHint="done" disabled={locked} onChange={e=>setName(e.target.value)}/></label>
    <div className="actions"><button type="button" disabled={locked} onClick={onClose}>Hủy</button><button className="primary" type="submit" disabled={locked||!name.trim()}>{saving?'Đang lưu…':mode==='create'?'Lưu mẫu':'Lưu tên'}</button></div>
   </form>
  </DialogContent>
 </Dialog>;
}
