'use client';
import {formatPhone} from '@/lib/phone-format';
import {useState} from 'react';
import {LogOut} from 'lucide-react';
import {toast} from 'sonner';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
export default function AccountControls({phone,unsaved}:{phone:string;unsaved:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 return <><div className="account-controls"><span>{formatPhone(phone)}</span><button title="Đăng xuất" aria-label="Đăng xuất" disabled={busy} onClick={()=>setOpen(true)}><LogOut size={16}/></button></div><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent><AlertDialogTitle>Bạn muốn đăng xuất?</AlertDialogTitle><AlertDialogDescription>{unsaved?'Có thay đổi chưa lưu. Quay lại và lưu trước để tránh mất nội dung đang nhập.':'Bạn có thể đăng nhập lại bằng số điện thoại và mật khẩu 3 số.'}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw new Error('Chưa đăng xuất được. Hãy thử lại.');window.location.replace('/');}catch(e){toast.error((e as Error).message);setBusy(false);}}}>Đăng xuất</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
