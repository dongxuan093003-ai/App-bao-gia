'use client';
import {useRef,useState} from 'react';
import {Copy,Share2} from 'lucide-react';
import {toast} from 'sonner';

const appUrl='https://bao-gia-sung-tuyen.dongxuan-093003.chatgpt.site';
const appTitle='Ứng dụng báo giá VLXD Sùng Tuyến';

export default function AppShare(){
 const [pending,setPending]=useState(false);
 const link=useRef<HTMLInputElement>(null),sharing=useRef(false);
 async function copy(){
  try{await navigator.clipboard.writeText(appUrl);toast.success('Đã sao chép liên kết ứng dụng.');}
  catch{link.current?.focus();link.current?.select();toast.info('Liên kết đã được chọn. Nhấn giữ hoặc bấm Ctrl+C để sao chép.');}
 }
 async function share(){
  if(sharing.current)return;
  const data={title:appTitle,text:appTitle,url:appUrl};
  if(!navigator.share||(navigator.canShare&&!navigator.canShare(data))){await copy();return;}
  sharing.current=true;setPending(true);
  try{await navigator.share(data);}
  catch(error){if((error as Error).name!=='AbortError')toast.info('Chưa mở được bảng chia sẻ. Chọn Sao chép liên kết để gửi.');}
  finally{sharing.current=false;setPending(false);}
 }
 return <section className="panel settings-share-card"><h2>{appTitle}</h2><p>Chia sẻ qua Zalo hoặc gửi liên kết cho người cần dùng.</p><input ref={link} readOnly aria-label="Liên kết ứng dụng" value={appUrl} onFocus={event=>event.currentTarget.select()}/><div className="settings-share-actions"><button type="button" className="primary" disabled={pending} onClick={()=>void share()}><Share2/>Chia sẻ</button><button type="button" disabled={pending} onClick={()=>void copy()}><Copy/>Sao chép liên kết</button></div></section>;
}
