'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,ChevronRight,MoreHorizontal,Pencil,Trash2,X,Save} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import type {Customer,Quote} from '@/lib/data';
import {uid} from '@/lib/data';
import {customerMatchesSearch,customerPhoneKey,customersByLatestQuote} from '@/lib/customers';
import {formatPhone} from '@/lib/phone-format';
import PhoneInput from './phone-input';

type Props={customers:Customer[];quotes:Quote[];disabled:boolean;onCustomer:(c:Customer)=>void;onCreate:(c:Customer)=>void;onSave:(c:Customer)=>Promise<boolean>;onDelete:(c:Customer)=>Promise<boolean>;onDirtyChange:(dirty:boolean)=>void};
export default function Customers({customers,quotes,disabled,onCustomer,onCreate,onSave,onDelete,onDirtyChange}:Props){
 const [search,setSearch]=useState('');
 const [editing,setEditing]=useState<{draft:Customer;original:Customer}|null>(null);
 const [deleting,setDeleting]=useState<Customer|null>(null);
 const keepDialogFocus=useRef(false),searchInput=useRef<HTMLInputElement>(null);
 const draft=editing?.draft;
 const draftDirty=!!editing&&['name','phone','address'].some(key=>editing.draft[key as keyof Customer]!==editing.original[key as keyof Customer]);
 useEffect(()=>{onDirtyChange(draftDirty);},[draftDirty,onDirtyChange]);
 useEffect(()=>()=>onDirtyChange(false),[onDirtyChange]);
 const entries=customersByLatestQuote(customers,quotes).filter(c=>customerMatchesSearch(c,search));
 const phoneKey=draft?customerPhoneKey(draft.phone):'';
 const duplicates=phoneKey?customers.filter(c=>c.id!==draft?.id&&customerPhoneKey(c.phone)===phoneKey):[];
 const edit=(customer:Customer)=>setEditing({draft:{...customer},original:{...customer}});
 const update=(field:'name'|'phone'|'address',value:string)=>setEditing(current=>current?{...current,draft:{...current.draft,[field]:value}}:current);
 const save=async()=>{if(draft&&await onSave(draft))setEditing(null);};
 const remove=async()=>{if(deleting&&await onDelete(deleting)){setDeleting(null);}};

 return <>
  <div className="customer-page-heading"><h1>Khách hàng <span>· {customers.length}</span></h1></div>
  <div className="customer-toolbar">
   <div className="customer-search-box"><input ref={searchInput} placeholder="Tìm khách hàng" aria-label="Tìm tên hoặc số điện thoại khách hàng" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Xóa nội dung tìm kiếm và đóng bàn phím" onClick={()=>{searchInput.current?.blur();setSearch('');}}><X size={17}/></button>}</div>
   <button type="button" className="customer-add" disabled={disabled} onClick={()=>edit({id:uid(),name:'',phone:'',address:''})}><Plus size={18}/>Thêm khách</button>
  </div>
  <section className="panel customer-directory" role="region" aria-label="Danh sách khách hàng" tabIndex={0}>
   {!entries.length?<div className="empty"><h2>{search?'Không tìm thấy khách':'Chưa có khách hàng'}</h2><p>{search?'Thử tên hoặc số điện thoại khác.':'Bấm + Thêm khách để lưu khách hàng đầu tiên.'}</p></div>:entries.map(c=><article className="customer-entry" key={c.id}>
    <div className="customer-entry-info"><button className="customer-name-button" onClick={()=>onCustomer(c)}>{c.name}</button>{c.phone&&<a className="customer-phone-link" href={'tel:'+c.phone.replace(/[^+\d]/g,'')} aria-label={'Gọi '+c.name}>{formatPhone(c.phone)}</a>}{c.address&&<p className="customer-entry-address">{c.address}</p>}</div>
    <DropdownMenu><DropdownMenuTrigger asChild><button className="customer-more" disabled={disabled} aria-label={'Thao tác với '+c.name}><MoreHorizontal size={19}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="customer-action-menu" onCloseAutoFocus={e=>{if(keepDialogFocus.current){e.preventDefault();keepDialogFocus.current=false;}}}>
     <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;onCreate(c);}}><Plus/>Tạo báo giá</DropdownMenuItem>
     <DropdownMenuItem disabled={disabled} onSelect={()=>{keepDialogFocus.current=true;edit(c);}}><Pencil/>Chỉnh sửa</DropdownMenuItem>
     <DropdownMenuItem disabled={disabled} variant="destructive" onSelect={()=>{keepDialogFocus.current=true;setDeleting(c);}}><Trash2/>Xóa</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
   </article>)}
  </section>

  <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!disabled)setEditing(null);}}><DialogContent className="customer-edit-dialog" onOpenAutoFocus={e=>{e.preventDefault();document.getElementById('customer-edit-title')?.focus({preventScroll:true});}}><DialogTitle id="customer-edit-title" tabIndex={-1}>{customers.some(c=>c.id===draft?.id)?'Chỉnh sửa khách':'Thêm khách'}</DialogTitle><DialogDescription className="sr-only">Nhập tên, số điện thoại và địa chỉ khách hàng.</DialogDescription>{draft&&<>
   <div className="customer-edit-fields"><input placeholder="Tên khách" aria-label="Tên khách hàng" autoComplete="off" maxLength={4000} value={draft.name} onChange={e=>update('name',e.target.value)}/><PhoneInput placeholder="Số điện thoại" aria-label="Số điện thoại" maxLength={4000} value={draft.phone} onValueChange={value=>update('phone',value)}/><input placeholder="Địa chỉ" aria-label="Địa chỉ" maxLength={4000} value={draft.address} onChange={e=>update('address',e.target.value)}/></div>
   {duplicates.length>0&&<div className="customer-duplicate"><p>Số điện thoại này đã có trong danh sách:</p>{duplicates.slice(0,3).map(c=><button key={c.id} onClick={()=>{setEditing(null);onCustomer(c);}}><span>{c.name}</span><ChevronRight size={16}/></button>)}</div>}
   <button className="primary customer-save" disabled={disabled||!draft.name.trim()} onClick={()=>void save()}><Save size={18}/>Lưu khách hàng</button>
  </>}</DialogContent></Dialog>

  <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!disabled)setDeleting(null);}}><AlertDialogContent><AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle><AlertDialogDescription>Xóa {deleting?.name} khỏi danh sách khách hàng. Các báo giá đã lưu vẫn được giữ nguyên.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={disabled}>Quay lại</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={e=>{e.preventDefault();void remove();}}>Xóa khách</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
