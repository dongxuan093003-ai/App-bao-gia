'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,DatabaseBackup,Download,Loader2,RotateCcw,Upload,ChevronRight} from 'lucide-react';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {toast} from 'sonner';
import {MAX_BACKUP_BYTES,backupFilename,backupSummary,parseBackup,serializeBackup,type Backup,type BackupEntry} from '@/lib/backup';
import './backup-panel.css';

type Props={backupWarning:boolean;version:number;disabled:boolean;unsaved:boolean;onBackup:()=>void;onRestore:(backup:Backup,version:number,id?:string)=>Promise<boolean>;onActiveChange:(active:boolean)=>void};
const reasons={automatic:'Tự động',manual:'Thủ công',before_restore:'Trước khôi phục'};
const dateLabel=(date:string)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{cache:'no-store',...init,signal:AbortSignal.timeout(20000)});
 const result=await response.json() as T&{error?:string};
 if(!response.ok)throw new Error(result.error||'Chưa thực hiện được. Hãy thử lại.');
 return result;
}
function download(backup:Backup){
 const date=backup.exportedAt||new Date().toISOString();
 const url=URL.createObjectURL(new Blob([serializeBackup(backup.data,backup.draft,date)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=backupFilename(date);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function BackupPanel({backupWarning,version,disabled,unsaved,onBackup,onRestore,onActiveChange}:Props){
 const [entries,setEntries]=useState<BackupEntry[]|null>(null),[error,setError]=useState(''),[pending,setPending]=useState('');
 const [restore,setRestore]=useState<{backup:Backup;name:string;version:number;id?:string}|null>(null),[includeDraft,setIncludeDraft]=useState(true);
 const input=useRef<HTMLInputElement>(null),alive=useRef(true),operation=useRef(false),sequence=useRef(0);
 const locked=disabled||unsaved||!!pending;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{onActiveChange(!!restore||!!pending);return()=>onActiveChange(false);},[restore,pending,onActiveChange]);
 const refresh=useCallback(async()=>{
  const seq=++sequence.current;
  try{const result=await request<{backups:BackupEntry[]}>('/api/backups');if(alive.current&&seq===sequence.current){setEntries(result.backups);setError('');}}
  catch(e){if(alive.current&&seq===sequence.current)setError((e as Error).message);}
 },[]);
 useEffect(()=>{void refresh();},[refresh,version]);
 async function run(key:string,action:()=>Promise<void>){
  if(locked||operation.current)return;
  operation.current=true;setPending(key);setError('');
  try{await action();}catch(e){if(alive.current)setError((e as Error).message);}
  finally{operation.current=false;if(alive.current)setPending('');}
 }
 async function create(){await run('create',async()=>{
  const result=await request<{backups:BackupEntry[]}>('/api/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',version})});
  if(alive.current){sequence.current++;setEntries(result.backups);toast.success('Đã tạo bản sao lưu.');}
 });}
 async function open(entry:BackupEntry,saveFile=false){const expected=version;await run(entry.id,async()=>{
  const result=await request<{backup:Backup}>('/api/backups?id='+encodeURIComponent(entry.id));
  const backup=parseBackup(JSON.stringify(result.backup));
  if(!alive.current)return;
  if(saveFile)download(backup);else{setRestore({backup,name:backupFilename(entry.createdAt),version:expected,id:entry.id});setIncludeDraft(true);}
 });}
 async function readFile(file:File){const expected=version;await run('file',async()=>{
  if(file.size>MAX_BACKUP_BYTES)throw new Error('File quá lớn. Hãy chọn file sao lưu của ứng dụng.');
  const backup=parseBackup(await file.text());
  if(alive.current){setRestore({backup,name:file.name,version:expected});setIncludeDraft(true);}
 });}
 async function confirmRestore(){if(!restore)return;await run('restore',async()=>{
  if(await onRestore({...restore.backup,draft:includeDraft?restore.backup.draft:null},restore.version,restore.id)){
   if(alive.current)setRestore(null);await refresh();
  }
 });}
 const latest=entries?.[0],summary=restore?backupSummary(restore.backup.data):null;
 return <div className="settings-backup-list">
  <section className="panel settings-backup-card backup-status">
   <div className="backup-status-heading"><span className="backup-status-icon"><DatabaseBackup/></span><div><h2>Sao lưu tự động</h2><span className="backup-status-enabled"><Check/>Đang bật · 7 ngày/lần</span></div></div>
   <p>Khi dùng app, tự sao lưu nếu đã đủ 7 ngày và có thay đổi. Giữ 8 bản gần nhất.</p>
   <div className="backup-latest"><span>Bản gần nhất</span><strong>{latest?dateLabel(latest.createdAt):entries?'Chưa có bản sao lưu':'Đang tải…'}</strong></div>
   <div className="backup-actions"><button className="primary" disabled={locked||version===0} onClick={()=>void create()}>{pending==='create'?<Loader2 className="animate-spin"/>:<DatabaseBackup/>}Sao lưu ngay</button><button disabled={disabled||!!pending} onClick={onBackup}><Download/>Tải file</button></div>
   <p className="backup-independent">Tải file để giữ thêm một bản riêng trên điện thoại hoặc máy tính.</p>
   {backupWarning&&<p className="backup-warning" role="status">Lần sao lưu tự động vừa rồi chưa thành công. Bạn có thể bấm Sao lưu ngay để thử lại.</p>}
   {unsaved&&<p className="backup-warning" role="status">Hãy lưu thay đổi hiện tại trước khi sao lưu trên máy chủ hoặc khôi phục.</p>}
   {version===0&&<p role="status">Bản tự động đầu tiên sẽ được tạo khi bạn lưu dữ liệu.</p>}
  </section>
  {error&&<div className="backup-error" role="alert"><span>{error}</span><button onClick={()=>void refresh()} disabled={!!pending}>Tải lại danh sách</button></div>}
  <section className="panel settings-backup-card backup-history"><div className="backup-history-heading"><h2>Bản sao lưu đã giữ</h2>{entries&&<span>{entries.length}/8</span>}</div>
   {entries===null?<p>{error?'Chưa tải được danh sách.':'Đang tải bản sao lưu…'}</p>:!entries.length?<p>Chưa có bản sao lưu trên máy chủ.</p>:<ul>{entries.map(entry=><li key={entry.id}>
    <div className="backup-entry-heading"><strong>{dateLabel(entry.createdAt)}</strong><span className={'backup-reason '+(entry.reason==='before_restore'?'backup-checkpoint':'')}>{reasons[entry.reason]}</span></div>
    <p>{entry.summary.products} mặt hàng · {entry.summary.customers} khách · {entry.summary.quotes} báo giá</p>
    <div className="backup-entry-actions"><button disabled={locked} onClick={()=>void open(entry)}>{pending===entry.id?<Loader2 className="animate-spin"/>:<RotateCcw/>}Khôi phục</button><button disabled={locked} onClick={()=>void open(entry,true)} aria-label={'Tải bản sao lưu '+dateLabel(entry.createdAt)}><Download/>Tải file</button></div>
   </li>)}</ul>}
  </section>
  <section className="panel settings-backup-card"><h2>Khôi phục từ file</h2><p>Chọn file .json để kiểm tra trước khi khôi phục.</p><input ref={input} type="file" accept=".json,application/json" hidden onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void readFile(file);}}/><button disabled={locked} onClick={()=>input.current?.click()}>{pending==='file'?<Loader2 className="animate-spin"/>:<Upload/>}Chọn file sao lưu</button><a href="/du-lieu-cu" target="_top" className="settings-legacy">Nhập dữ liệu từ bản cũ<ChevronRight/></a></section>
  <AlertDialog open={!!restore} onOpenChange={open=>{if(!open&&!pending){setRestore(null);setError('');}}}><AlertDialogContent className="settings-restore-dialog">
   <AlertDialogTitle>Khôi phục dữ liệu?</AlertDialogTitle><AlertDialogDescription>Toàn bộ dữ liệu hiện tại sẽ được thay bằng bản đã chọn. App tự giữ một bản trước khi khôi phục để bạn có thể quay lại.</AlertDialogDescription>
   {restore&&summary&&<><div className="settings-restore-file"><strong>{restore.name}</strong>{restore.backup.exportedAt&&<span>{dateLabel(restore.backup.exportedAt)}</span>}</div>
    <dl className="settings-restore-counts">{[['Bảng giá',summary.priceLists],['Mặt hàng',summary.products],['Khách hàng',summary.customers],['Báo giá',summary.quotes],['Mẫu báo giá',summary.templates],['Ghi chú chăm sóc',summary.careNotes],['Tiêu đề cửa hàng',summary.headers],['Mẫu ghi chú',summary.notes]].map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    {restore.backup.draft&&<label className="settings-restore-draft"><input type="checkbox" checked={includeDraft} disabled={!!pending} onChange={e=>setIncludeDraft(e.target.checked)}/>Mở lại báo giá đang soạn trong file</label>}
   </>}{error&&<p className="backup-warning" role="alert">{error}</p>}
   <AlertDialogFooter><AlertDialogCancel disabled={!!pending}>Hủy</AlertDialogCancel><AlertDialogAction disabled={locked} onClick={e=>{e.preventDefault();void confirmRestore();}}>{pending==='restore'?'Đang khôi phục…':'Khôi phục'}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>
 </div>;
}
