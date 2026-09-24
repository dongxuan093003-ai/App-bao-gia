'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,DatabaseBackup,FileText,Loader2,MoreHorizontal,Pencil,Plus,Share2,Store,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {toast} from 'sonner';
import type {Data,Header,NoteTemplate} from '@/lib/data';
import {uid} from '@/lib/data';
import {nextNoteName} from '@/lib/note-templates';
import {formatPhone} from '@/lib/phone-format';
import type {Backup} from '@/lib/backup';
import BackupPanel from './backup-panel';
import PhoneInput from './phone-input';
import AppShare from './app-share';

type Section='headers'|'notes'|'backup'|'share';
type Editing={kind:'header';draft:Header;original:Header}|{kind:'note';draft:NoteTemplate;original:NoteTemplate;isNew:boolean};
export type SettingsUpdate=(current:Data)=>Data;
type Props={
 data:Data;version:number;disabled:boolean;unsaved:boolean;backupWarning:boolean;
 onSave:(update:SettingsUpdate)=>Promise<boolean>;
 onBackup:()=>void;
 onRestore:(backup:Backup,version:number,id?:string)=>Promise<boolean>;
 onDirtyChange:(dirty:boolean)=>void;
};
const cards=[
 {key:'headers',title:'Tiêu đề cửa hàng',icon:Store},
 {key:'notes',title:'Mẫu ghi chú',icon:FileText},
 {key:'backup',title:'Sao lưu và khôi phục',icon:DatabaseBackup},
 {key:'share',title:'Chia sẻ ứng dụng',icon:Share2},
] as const;

export default function SettingsPanel({data,version,disabled,unsaved,backupWarning,onSave,onBackup,onRestore,onDirtyChange}:Props){
 const [section,setSection]=useState<Section|null>(null);
 const [editing,setEditing]=useState<Editing|null>(null);
 const [deleting,setDeleting]=useState<{kind:'header';id:string;name:string}|{kind:'note';id:string;name:string}|null>(null);
 const [discard,setDiscard]=useState(false);
 const [pending,setPending]=useState(false),[backupActive,setBackupActive]=useState(false);
 const title=useRef<HTMLHeadingElement>(null),keepFocus=useRef(false);
 const draftDirty=!!editing&&JSON.stringify(editing.draft)!==JSON.stringify(editing.original);
 useEffect(()=>{onDirtyChange(!!editing||!!deleting||backupActive);return()=>onDirtyChange(false);},[editing,deleting,backupActive,onDirtyChange]);
 const locked=disabled||pending||backupActive;
 function add(){
  if(section==='headers'){const header={id:uid(),name:'',phone:'',address:''};setEditing({kind:'header',draft:header,original:header});}
  else {const note={id:uid(),name:nextNoteName(data.notes),text:''};setEditing({kind:'note',draft:note,original:note,isNew:true});}
 }
 async function commit(update:SettingsUpdate){
  if(locked)return false;
  setPending(true);
  try{return await onSave(update);}finally{setPending(false);}
 }
 async function saveEditor(){
  if(!editing)return;
  if(editing.kind==='header'){
   const header={...editing.draft,name:editing.draft.name.trim(),address:editing.draft.address.trim()};
   if(!header.name){toast.error('Nhập tên cửa hàng.');return;}
   if(await commit(current=>({...current,headers:current.headers.some(h=>h.id===header.id)?current.headers.map(h=>h.id===header.id?header:h):[...current.headers,header]})))setEditing(null);
  }else{
   const note={...editing.draft,name:editing.draft.name.trim(),text:editing.draft.text.trim()};
   if(!note.name||!note.text){toast.error('Nhập tên mẫu và nội dung ghi chú.');return;}
   if(await commit(current=>({...current,notes:current.notes.some(n=>n.id===note.id)?current.notes.map(n=>n.id===note.id?note:n):[...current.notes,note]})))setEditing(null);
  }
 }
 async function remove(){
  if(!deleting)return;
  const target=deleting;
  const ok=await commit(current=>{
   if(target.kind==='note')return {...current,notes:current.notes.filter(n=>n.id!==target.id)};
   const headers=current.headers.filter(h=>h.id!==target.id);
   return headers.length?{...current,headers,defaultHeader:current.defaultHeader===target.id?headers[0].id:current.defaultHeader}:current;
  });
  if(ok)setDeleting(null);
 }

 return <div className="settings-page">
  <div className="settings-heading">
   {section&&<button className="settings-back" aria-label="Quay lại Cài đặt" onClick={()=>{setSection(null);}} disabled={locked}><ArrowLeft/></button>}
   <h1>{section?cards.find(c=>c.key===section)!.title:'Cài đặt'}</h1>
   {(section==='headers'||section==='notes')&&<button className="settings-add" onClick={add} disabled={locked||(section==='headers'?data.headers.length>=100:data.notes.length>=100)}><Plus/>Thêm</button>}
  </div>
  {!section&&<div className="settings-overview">{cards.map(({key,title,icon:Icon})=><button key={key} className="settings-nav-card" onClick={()=>setSection(key)}><span className="settings-card-icon"><Icon/></span><span>{title}</span><ChevronRight className="settings-chevron"/></button>)}</div>}
  {section==='headers'&&<div className="panel settings-entries">{data.headers.map(header=><article className="settings-entry" key={header.id}>
   <div className="settings-entry-copy"><strong>{header.name}</strong>{header.id===data.defaultHeader&&<span className="settings-default"><Check/>Mặc định</span>}{header.address&&<p>{header.address}</p>}{header.phone&&<p>{formatPhone(header.phone)}</p>}</div>
   <DropdownMenu><DropdownMenuTrigger asChild><button className="settings-more" aria-label={'Thao tác tiêu đề '+header.name} disabled={locked}><MoreHorizontal/></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" onCloseAutoFocus={e=>{if(keepFocus.current){e.preventDefault();keepFocus.current=false;}}}>
     <DropdownMenuItem onSelect={()=>{keepFocus.current=true;setEditing({kind:'header',draft:{...header},original:header});}}><Pencil/>Chỉnh sửa</DropdownMenuItem>
     <DropdownMenuItem disabled={header.id===data.defaultHeader} onSelect={()=>void commit(current=>({...current,defaultHeader:header.id}))}><Check/>{header.id===data.defaultHeader?'Đang mặc định':'Đặt mặc định'}</DropdownMenuItem>
     <DropdownMenuItem variant="destructive" disabled={data.headers.length===1} onSelect={()=>{keepFocus.current=true;setDeleting({kind:'header',id:header.id,name:header.name});}}><Trash2/>Xóa</DropdownMenuItem>
    </DropdownMenuContent>
   </DropdownMenu>
  </article>)}</div>}
  {section==='notes'&&<div className="panel settings-entries">{data.notes.length?data.notes.map(note=><article className="settings-entry" key={note.id}>
   <div className="settings-entry-copy settings-template-copy"><strong>{note.name}</strong><p className="settings-note-copy">{note.text}</p></div><DropdownMenu><DropdownMenuTrigger asChild><button className="settings-more" aria-label={'Thao tác '+note.name} disabled={locked}><MoreHorizontal/></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" onCloseAutoFocus={e=>{if(keepFocus.current){e.preventDefault();keepFocus.current=false;}}}>
     <DropdownMenuItem onSelect={()=>{keepFocus.current=true;setEditing({kind:'note',draft:{...note},original:note,isNew:false});}}><Pencil/>Chỉnh sửa</DropdownMenuItem>
     <DropdownMenuItem variant="destructive" onSelect={()=>{keepFocus.current=true;setDeleting({kind:'note',id:note.id,name:note.name});}}><Trash2/>Xóa</DropdownMenuItem>
    </DropdownMenuContent>
   </DropdownMenu>
  </article>):<p className="settings-empty">Chưa có mẫu ghi chú. Bấm + Thêm để lưu mẫu.</p>}</div>}
  {section==='backup'&&<BackupPanel version={version} backupWarning={backupWarning} disabled={disabled} unsaved={unsaved} onBackup={onBackup} onRestore={onRestore} onActiveChange={setBackupActive}/>}
  {section==='share'&&<AppShare/>}
  <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!pending){if(draftDirty)setDiscard(true);else setEditing(null);}}}>
   <DialogContent className="settings-edit-dialog" onOpenAutoFocus={e=>{e.preventDefault();title.current?.focus();}}>
    <DialogTitle ref={title} tabIndex={-1}>{editing?.kind==='header'?'Tiêu đề cửa hàng':editing?.kind==='note'&&editing.isNew?'Thêm mẫu ghi chú':'Sửa mẫu ghi chú'}</DialogTitle>
    <DialogDescription className="sr-only">Nhập nội dung rồi bấm Lưu.</DialogDescription>
    {editing?.kind==='header'&&<div className="settings-fields">
     <input aria-label="Tên cửa hàng" placeholder="Tên cửa hàng" maxLength={4000} value={editing.draft.name} onChange={e=>setEditing({...editing,draft:{...editing.draft,name:e.target.value}})}/>
     <PhoneInput aria-label="Điện thoại bán hàng" placeholder="Điện thoại bán hàng" maxLength={4000} value={editing.draft.phone} onValueChange={phone=>setEditing({...editing,draft:{...editing.draft,phone}})}/>
     <input aria-label="Địa chỉ" placeholder="Địa chỉ" maxLength={4000} value={editing.draft.address} onChange={e=>setEditing({...editing,draft:{...editing.draft,address:e.target.value}})}/>
    </div>}
    {editing?.kind==='note'&&<><input aria-label="Tên mẫu" placeholder="Tên mẫu" maxLength={100} value={editing.draft.name} onChange={e=>setEditing({...editing,draft:{...editing.draft,name:e.target.value}})}/><textarea aria-label="Nội dung ghi chú" placeholder="Nhập ghi chú gửi khách…" rows={5} maxLength={4000} value={editing.draft.text} onChange={e=>setEditing({...editing,draft:{...editing.draft,text:e.target.value}})}/></>}
    <button className="primary settings-save" disabled={locked} onClick={()=>void saveEditor()}>{pending?<Loader2 className="animate-spin"/>:<Check/>}{pending?'Đang lưu…':'Lưu'}</button>
   </DialogContent>
  </Dialog>
  <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent><AlertDialogTitle>Bỏ thay đổi chưa lưu?</AlertDialogTitle><AlertDialogDescription>Nội dung vừa nhập sẽ không được lưu.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Tiếp tục sửa</AlertDialogCancel><AlertDialogAction onClick={()=>setEditing(null)}>Bỏ thay đổi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!pending)setDeleting(null);}}><AlertDialogContent><AlertDialogTitle>{deleting?.kind==='header'?'Xóa tiêu đề cửa hàng?':'Xóa mẫu ghi chú?'}</AlertDialogTitle><AlertDialogDescription>{deleting?.kind==='header'?deleting.name:'Mẫu ghi chú này sẽ bị xóa.'} Nội dung trong báo giá đã lưu vẫn giữ nguyên.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel><AlertDialogAction disabled={locked} onClick={e=>{e.preventDefault();void remove();}}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

 </div>;
}
