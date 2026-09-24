'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,CalendarClock,Check,FileText,MoreHorizontal,Pencil,Phone,Plus,Save,Trash2,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {CareNote,Customer,Quote} from '@/lib/data';
import {uid} from '@/lib/data';
import type {JournalAction,JournalDraft,JournalTarget} from '@/lib/customer-journal';
import {careDay,careStatusLabel,careStatuses,quoteCare,type QuoteCare} from '@/lib/quote-care';
import {formatPhone} from '@/lib/phone-format';
import {quoteDateTime} from '@/lib/quote-display';
import {useJournalBack} from './use-journal-back';

type Props={target:JournalTarget;notes:CareNote[];quotes:Quote[];customer?:Customer;draft:JournalDraft;disabled:boolean;conflict:boolean;onDraft:(draft:JournalDraft)=>void;onSave:(action:JournalAction)=>Promise<boolean>;onCare:(id:string,fields:QuoteCare)=>Promise<boolean>;onClose:()=>void;onOpenQuote:(q:Quote)=>void;onCreate:(c:Customer)=>void;onRefresh:()=>void};
export default function CustomerJournal({target,notes,quotes,customer,draft,disabled,conflict,onDraft,onSave,onCare,onClose,onOpenQuote,onCreate,onRefresh}:Props){
 const person=customer||target.customer;
 const [mode,setMode]=useState<'notes'|'quotes'|'reminder'>('notes'),[limit,setLimit]=useState(30),[error,setError]=useState(''),[pending,setPending]=useState(false),[deleting,setDeleting]=useState<CareNote|null>(null),[menu,setMenu]=useState(false);
 const [reminder,setReminder]=useState<{id:string;fields:QuoteCare}|null>(null);
 const [discardReminder,setDiscardReminder]=useState(false);
 const title=useRef<HTMLHeadingElement>(null),input=useRef<HTMLTextAreaElement>(null),list=useRef<HTMLDivElement>(null),saving=useRef(false),baseline=useRef(0),keepFocus=useRef(false);
 const locked=disabled||pending,activeQuote=quotes.find(q=>q.id===target.quoteId)||quotes[0];
 const reminderQuote=reminder?quotes.find(q=>q.id===reminder.id):undefined;
 const reminderDirty=!!reminder&&!!reminderQuote&&(reminder.fields.followUp!==reminderQuote.followUp||reminder.fields.status!==reminderQuote.status);
 const consumeBack=()=>{
  if(pending)return true;
  if(discardReminder){setDiscardReminder(false);return true;}
  if(deleting){setDeleting(null);return true;}
  if(menu){setMenu(false);return true;}
  const focused=document.activeElement;
  const height=window.visualViewport?.height||window.innerHeight;
  if(focused instanceof HTMLElement&&focused.matches('input,textarea')&&window.innerWidth<900&&baseline.current-height>80){focused.blur();return true;}
  if(mode==='reminder'&&reminderDirty){setDiscardReminder(true);return true;}
  if(mode!=='notes'){setMode('notes');return true;}
  return false;
 };
 const close=useJournalBack(consumeBack,onClose);
 useEffect(()=>{baseline.current=window.visualViewport?.height||window.innerHeight;},[]);
 useEffect(()=>{if(input.current){input.current.style.height='auto';input.current.style.height=Math.min(input.current.scrollHeight,110)+'px';}},[draft.text,mode]);
 function change(text:string){onDraft({...draft,text,noteId:undefined,createdAt:undefined});setError('');}
 async function run(action:()=>Promise<boolean>,done:()=>void){
  if(locked||saving.current)return;
  saving.current=true;setPending(true);setError('');
  try{if(await action())done();else setError('Chưa lưu được. Nội dung đang nhập vẫn được giữ.');}
  catch(e){setError((e as Error).message||'Chưa lưu được. Hãy thử lại.');}
  finally{saving.current=false;setPending(false);}
 }
 function send(){
  if(!draft.text.trim()||locked||saving.current)return;
  let action:JournalAction;
  if(draft.editingId)action={type:'edit',id:draft.editingId,text:draft.text,originalText:draft.originalText||'',updatedAt:new Date().toISOString()};
  else{
   const stable={...draft,noteId:draft.noteId||uid(),createdAt:draft.createdAt||new Date().toISOString()};onDraft(stable);
   action={type:'add',note:{id:stable.noteId,createdAt:stable.createdAt,customerKey:target.key,text:stable.text}};
  }
  void run(()=>onSave(action),()=>{onDraft({text:''});list.current?.scrollTo({top:0});input.current?.focus({preventScroll:true});});
 }
 function openReminder(q:Quote){setReminder(current=>current?.id===q.id?current:{id:q.id,fields:quoteCare(q)});setMode('reminder');setError('');}
 function saveReminder(completed=false){if(reminder)void run(()=>onCare(reminder.id,{...reminder.fields,...(completed?{followUp:''}:{})}),()=>{setReminder(null);setMode('notes');});}
 function back(){if(!consumeBack())close();}
 return <>
  <Dialog open onOpenChange={open=>{if(!open)back();}}><DialogContent showCloseButton={false} className="customer-journal-dialog" onOpenAutoFocus={e=>{e.preventDefault();title.current?.focus({preventScroll:true});}} onEscapeKeyDown={e=>{e.preventDefault();back();}} onPointerDownOutside={e=>e.preventDefault()}>
   <header className="journal-top"><button className="journal-back" type="button" aria-label="Quay lại" disabled={pending} onClick={back}><ArrowLeft/></button><div><DialogTitle ref={title} tabIndex={-1}>{person.name}</DialogTitle><DialogDescription>{mode==='notes'?'Nhật ký chăm sóc':mode==='quotes'?'Các báo giá':'Hẹn liên hệ'}</DialogDescription></div>
    <DropdownMenu open={menu} onOpenChange={setMenu}><DropdownMenuTrigger asChild><button aria-label="Thao tác khách hàng" disabled={locked||mode==='reminder'}><MoreHorizontal/></button></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={e=>{if(keepFocus.current){e.preventDefault();keepFocus.current=false;}}}>
     {activeQuote&&<DropdownMenuItem onSelect={()=>{keepFocus.current=true;openReminder(activeQuote);}}><CalendarClock/>Hẹn liên hệ</DropdownMenuItem>}
     <DropdownMenuItem onSelect={()=>setMode(mode==='quotes'?'notes':'quotes')}><FileText/>{mode==='quotes'?'Nhật ký chăm sóc':`Các báo giá (${quotes.length})`}</DropdownMenuItem>
     {customer&&<DropdownMenuItem onSelect={()=>{keepFocus.current=true;close(()=>onCreate(customer));}}><Plus/>Tạo báo giá</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>
   </header>
   {(person.phone||person.address)&&<div className="journal-contact">{person.phone&&<a href={'tel:'+person.phone.replace(/[^+\d]/g,'')}><Phone/>{formatPhone(person.phone)}</a>}{person.address&&<p>{person.address}</p>}</div>}
   <div ref={list} className="journal-scroll" role="region" aria-label={mode==='notes'?'Ghi chú chăm sóc':'Thông tin chăm sóc'} tabIndex={0}>
    {mode==='notes'&&<>
     {quotes.some(q=>q.followUp)&&<div className="journal-reminders">{quotes.filter(q=>q.followUp).map(q=><button key={q.id} disabled={locked} onClick={()=>openReminder(q)}><CalendarClock/><span>Hẹn {q.followUp.split('-').reverse().join('/')} · {careStatusLabel(q.status)}</span></button>)}</div>}
     {!notes.length?<div className="journal-empty"><p>Chưa có ghi chú chăm sóc.</p><span>Ghi lại lần trao đổi đầu tiên ở bên dưới.</span></div>:notes.slice(0,limit).map(note=>{
      const stamp=quoteDateTime(note.createdAt);
      return <article className="journal-message" key={note.id}><div className="journal-message-top"><time dateTime={note.createdAt}>{note.legacy?'Ghi chú cũ · báo giá ':''}{stamp.date}<span>{note.legacy?'':' · '+stamp.time}{note.updatedAt?' · đã sửa':''}</span></time><DropdownMenu><DropdownMenuTrigger asChild><button aria-label="Thao tác ghi chú" disabled={locked}><MoreHorizontal/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!!draft.text.trim()&&draft.editingId!==note.id} onSelect={()=>{onDraft({text:note.text,editingId:note.id,originalText:note.text});setError('');}}><Pencil/>Sửa</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={()=>setDeleting(note)}><Trash2/>Xóa</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><p>{note.text}</p></article>;
     })}
     {limit<notes.length&&<button className="journal-more" onClick={()=>setLimit(limit+30)}>Xem ghi chú cũ hơn</button>}
    </>}
    {mode==='quotes'&&<div className="journal-quotes">{quotes.length?quotes.map(q=><article key={q.id}><button onClick={()=>close(()=>onOpenQuote(q))}><FileText/><span>{quoteDateTime(q.date).label}</span></button><button disabled={locked} onClick={()=>openReminder(q)}><CalendarClock/>{careStatusLabel(q.status)}</button></article>):<p>Chưa có báo giá cho khách này.</p>}</div>}
    {mode==='reminder'&&reminder&&<section className="journal-reminder-form"><p>Báo giá {quoteDateTime(quotes.find(q=>q.id===reminder.id)?.date||'').label}</p>
     <label className="field"><span>Tình trạng</span><Select value={reminder.fields.status} disabled={locked} onValueChange={status=>setReminder({...reminder,fields:{...reminder.fields,status}})}><SelectTrigger className="choice" aria-label="Tình trạng"><SelectValue/></SelectTrigger><SelectContent>{careStatuses.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></label>
     <label className="field"><span>Ngày liên hệ lại</span><input type="date" disabled={locked} value={reminder.fields.followUp} onChange={e=>setReminder({...reminder,fields:{...reminder.fields,followUp:e.target.value}})}/></label>
     <div className="care-quick-dates">{[0,1].map(offset=><button key={offset} disabled={locked} onClick={()=>setReminder({...reminder,fields:{...reminder.fields,followUp:careDay(offset)}})}>{offset?'Ngày mai':'Hôm nay'}</button>)}</div>
     <div className="care-actions"><button disabled={locked||!reminder.fields.followUp} onClick={()=>saveReminder(true)}><Check/>Đã liên hệ</button><button className="primary" disabled={locked} onClick={()=>saveReminder()}><Save/>{pending?'Đang lưu…':'Lưu lịch hẹn'}</button></div>
    </section>}
   </div>
   {(error||conflict)&&<div className="journal-error" role="alert"><p>{conflict?'Thiết bị khác vừa cập nhật. Tải dữ liệu mới để tiếp tục; nội dung đang gõ được giữ tạm.':error}</p>{conflict&&<button onClick={()=>close(onRefresh)}>Tải dữ liệu mới</button>}</div>}
   {mode==='notes'&&<footer className="journal-composer">{draft.editingId&&<div className="journal-editing"><span>Đang sửa ghi chú</span><button aria-label="Hủy sửa ghi chú" disabled={pending} onClick={()=>onDraft({text:''})}><X/></button></div>}<div><textarea ref={input} aria-label="Ghi chú chăm sóc" placeholder="Ghi chú chăm sóc…" rows={1} maxLength={4000} readOnly={locked} value={draft.text} onChange={e=>change(e.target.value)} onFocus={()=>{baseline.current=Math.max(baseline.current,window.visualViewport?.height||window.innerHeight);}} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/><button type="button" className="primary" aria-label={draft.editingId?'Lưu ghi chú':'Gửi ghi chú'} disabled={locked||!draft.text.trim()} onMouseDown={e=>e.preventDefault()} onClick={send}>{pending?<span>…</span>:draft.editingId?<Check/>:<ArrowUp/>}</button></div></footer>}
  </DialogContent></Dialog>
  <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!pending)setDeleting(null);}}><AlertDialogContent><AlertDialogTitle>Xóa ghi chú này?</AlertDialogTitle><AlertDialogDescription>Ghi chú sẽ bị xóa hẳn khỏi nhật ký chăm sóc.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={pending}>Quay lại</AlertDialogCancel><AlertDialogAction disabled={locked} onClick={e=>{e.preventDefault();if(deleting)void run(()=>onSave({type:'delete',id:deleting.id}),()=>setDeleting(null));}}>Xóa ghi chú</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={discardReminder} onOpenChange={setDiscardReminder}><AlertDialogContent><AlertDialogTitle>Bỏ thay đổi lịch hẹn?</AlertDialogTitle><AlertDialogDescription>Tình trạng và ngày liên hệ đang sửa chưa được lưu.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Tiếp tục sửa</AlertDialogCancel><AlertDialogAction onClick={()=>{setReminder(null);setMode('notes');setDiscardReminder(false);}}>Bỏ thay đổi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
