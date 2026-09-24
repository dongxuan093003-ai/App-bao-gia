'use client';
import { useEffect,useRef,useState } from 'react';
import { Plus,ClipboardPaste,Copy,Share2,FileText,Settings,History,Table2,ArrowUp,ArrowDown,Trash2,RotateCcw,Save,Eye,Phone,CalendarClock,Check,Cloud,Package,ChevronRight,Pencil, X,Users,MoreHorizontal,MoreVertical,Printer } from 'lucide-react';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { Toaster,toast } from 'sonner';
import { Data,Product,Quote,Header,Customer,initialData,blankQuote,getPriceLists,money,parsePrice,uid } from '@/lib/data';
import { quoteImage } from '@/lib/quote-image';
import {openQuotePrint} from '@/lib/quote-print';
import PhoneInput from './phone-input';
import {formatPhone} from '@/lib/phone-format';
import AccountControls from './account-controls';
import Customers from './customers';
import SettingsPanel,{type SettingsUpdate} from './settings-panel';
import {backupFilename,serializeBackup,type Backup} from '@/lib/backup';
import QuoteCustomer from './quote-customer';
import QuoteNotes from './quote-notes';
import {prepareQuotePreview} from '@/lib/quote-preview';
import QuotePreviewSheet from './quote-preview-sheet';
import CatalogTable from './catalog-table';
import ProductGroupPicker from './product-group-picker';
import PriceListManager from './price-list-manager';
import {migratePriceLists,migrateQuotePriceList,quotePriceIndex,updatePriceLists,type PriceListAction} from '@/lib/price-lists';
import QuoteHistoryCard from './quote-history-card';
import QuoteTemplateName from './quote-template-name';
import {copyQuoteForCustomer,createQuoteTemplate,renameQuoteTemplate} from '@/lib/quote-templates';
import CustomerJournal from './customer-journal';
import {customerJournalTarget,quoteJournalTarget,migrateJournal,journalNotes,journalQuotes,updateJournal,parseJournalDrafts,type JournalTarget,type JournalDraft,type JournalAction} from '@/lib/customer-journal';
import {careDay,isCareDue,updateQuoteCare,type QuoteCare} from '@/lib/quote-care';
import {quoteDateTime,quoteImageName} from '@/lib/quote-display';
import {upsertProduct} from '@/lib/catalog-order';
import {linkQuoteCustomer,upsertCustomer,quotesForCustomer,customerMatchesSearch} from '@/lib/customers';
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from '@/components/ui/collapsible';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';

function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem value={o.value} key={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
function Field({label,value,onChange,type='text',placeholder=''}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}){return <label className="field"><span>{label}</span>{type==='tel'?<PhoneInput value={value} onValueChange={onChange} placeholder={placeholder}/>:<input type={type} enterKeyHint="done" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>;}
function Price({value,onChange,onPaste,onNext}:{value:number|null;onChange:(v:number|null)=>void;onPaste?:(text:string)=>void;onNext?:()=>void}){const [s,setS]=useState(money(value));useEffect(()=>setS(money(value)),[value]);return <input className={'price '+(value===0?'zero':'')} aria-label="Đơn giá" inputMode="numeric" value={s} placeholder="—" onChange={e=>setS(e.target.value)} onFocus={e=>e.target.select()} onBlur={()=>{try{const n=parsePrice(s);onChange(n);setS(money(n));}catch(e){toast.error((e as Error).message);setS(money(value));}}} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();onNext?.();}}} onPaste={e=>{const t=e.clipboardData.getData('text');if(onPaste&&/[\t\n]/.test(t)){e.preventDefault();onPaste(t);}}}/>;}
type Change={id:string;tier:number;old:number|null;value:number;name:string};
export default function Workspace({phone}:{phone:string}){
 const [data,setData]=useState<Data|null>(null),[version,setVersion]=useState(0),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[tab,setTab]=useState('quotes');
 const [quote,setQuote]=useState<Quote|null>(null),[quoteDirty,setQuoteDirty]=useState(false),[preview,setPreview]=useState<{url:string;blob:Blob;quote:Quote}|null>(null);
 const catalogMenuFocus=useRef(false),editorMenuFocus=useRef(false);
 const [templateForm,setTemplateForm]=useState<{mode:'create'|'rename';source:Quote}|null>(null);
 const [imageBusy,setImageBusy]=useState<string|null>(null);const imageJob=useRef(false);
 const [product,setProduct]=useState<Product|null>(null),[header,setHeader]=useState<Header|null>(null),[historyMode,setHistoryMode]=useState('all'),[search,setSearch]=useState('');
 const [savedQuote,setSavedQuote]=useState<{id:string}|null>(null);
 const historyResults=useRef<HTMLDivElement>(null),historySearch=useRef<HTMLInputElement>(null),focusHistoryOnClose=useRef(false);
 useEffect(()=>{
  if(!savedQuote)return;
  const container=historyResults.current;
  let frame=0;
  const reveal=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const card=container?.querySelector<HTMLElement>('[data-saved-quote="true"]');
    if(container&&card)container.scrollTo({top:container.scrollTop+card.getBoundingClientRect().top-container.getBoundingClientRect().top-8,behavior:'instant'});
   });
  };
  // Keep the saved card visible while the keyboard and dialog finish closing.
  const observer=new ResizeObserver(reveal);
  if(container)observer.observe(container);
  reveal();
  const stopFollowing=()=>{observer.disconnect();cancelAnimationFrame(frame);};
  container?.addEventListener('pointerdown',stopFollowing,{once:true});
  container?.addEventListener('wheel',stopFollowing,{once:true,passive:true});
  const timer=setTimeout(()=>setSavedQuote(null),5000);
  return()=>{clearTimeout(timer);stopFollowing();container?.removeEventListener('pointerdown',stopFollowing);container?.removeEventListener('wheel',stopFollowing);};
 },[savedQuote]);
 const [pasteOpen,setPasteOpen]=useState(false),[pasteText,setPasteText]=useState(''),[pasteMode,setPasteMode]=useState('names'),[startId,setStartId]=useState(''),[startTier,setStartTier]=useState('0'),[changes,setChanges]=useState<Change[]>([]),[pasteErrors,setPasteErrors]=useState<string[]>([]),[unmatched,setUnmatched]=useState<string[]>([]),[mapping,setMapping]=useState<Record<string,string>>({});
 const [confirm,setConfirm]=useState<{title:string;description:string;action:()=>void;confirmLabel?:string}|null>(null);
 const [selectedPriceList,setSelectedPriceList]=useState('price-sang-xe'),[priceListsOpen,setPriceListsOpen]=useState(false),[keyboardOpen,setKeyboardOpen]=useState(false);
 const [customerDirty,setCustomerDirty]=useState(false),[settingsDirty,setSettingsDirty]=useState(false);
 const [autoSaving,setAutoSaving]=useState(false);
 const [catalogSorting,setCatalogSorting]=useState(false),[catalogGroupsOpen,setCatalogGroupsOpen]=useState(false);
 const [journal,setJournal]=useState<JournalTarget|null>(null),[today,setToday]=useState(()=>careDay());
 const [journalDrafts,setJournalDrafts]=useState<Record<string,JournalDraft>>({});
 const journalDraftsLoaded=useRef(false);
 useEffect(()=>{try{setJournalDrafts(parseJournalDrafts(sessionStorage.getItem('sung-care-drafts:'+phone)));}catch{}journalDraftsLoaded.current=true;},[phone]);
 function changeJournalDraft(key:string,draft:JournalDraft){setJournalDrafts(current=>{const next={...current};if(draft.text||draft.editingId)next[key]=draft;else delete next[key];try{if(journalDraftsLoaded.current)sessionStorage.setItem('sung-care-drafts:'+phone,JSON.stringify(next));}catch{}return next;});}
 const hasJournalDrafts=Object.values(journalDrafts).some(d=>!!d.text.trim());
 useEffect(()=>{const update=()=>setToday(careDay());const timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[]);
 const [backupWarning,setBackupWarning]=useState(false);
 const dataRef=useRef<Data|null>(null),versionRef=useRef(0),autoWanted=useRef(false);
 useEffect(()=>{const viewport=window.visualViewport;let baseline=window.innerHeight;const update=()=>{const focused=document.activeElement?.matches('input,textarea,[contenteditable="true"]');if(!focused)baseline=Math.max(baseline,window.innerHeight);setKeyboardOpen(window.innerWidth<900&&!!focused&&(baseline-(viewport?.height||window.innerHeight)>100||window.innerWidth<800));};window.addEventListener('focusin',update);window.addEventListener('focusout',update);viewport?.addEventListener('resize',update);return()=>{window.removeEventListener('focusin',update);window.removeEventListener('focusout',update);viewport?.removeEventListener('resize',update);};},[]);
 const [noteEditing,setNoteEditing]=useState<Record<string,boolean>>({});
 useEffect(()=>setNoteEditing({}),[quote?.id]);
 const catalogEditing=priceListsOpen||pasteOpen||!!product||catalogGroupsOpen;
 const templateOpen=!!templateForm;
 const stateRef=useRef({templateOpen,catalogEditing,dirty,quoteDirty,customerDirty,settingsDirty,careOpen:!!journal,journalDraftDirty:hasJournalDrafts,busy});stateRef.current={templateOpen,catalogEditing,dirty,quoteDirty,customerDirty,settingsDirty,careOpen:!!journal,journalDraftDirty:hasJournalDrafts,busy};
 useEffect(()=>{if(!busy||autoSaving)return;const elements=Array.from(document.querySelectorAll<HTMLElement>('.app-tabs,[data-slot="dialog-content"]'));elements.forEach(el=>el.inert=true);return()=>elements.forEach(el=>el.inert=false);},[busy,autoSaving]);
 async function load(force=false){try{const r=await fetch('/api/data',{cache:'no-store'});const j=await r.json() as {error?:string;version:number;data:Data|null;backupOk?:boolean};if(!r.ok)throw new Error(j.error);setBackupWarning(j.backupOk===false);if(j.version<versionRef.current)return;if(!force&&(document.activeElement?.matches('.catalog-table input')||stateRef.current.dirty||stateRef.current.quoteDirty||stateRef.current.customerDirty||stateRef.current.settingsDirty||stateRef.current.catalogEditing||stateRef.current.templateOpen||stateRef.current.careOpen||stateRef.current.busy))return;versionRef.current=j.version;setVersion(j.version);const loaded=migratePriceLists(migrateJournal(j.data||initialData()));dataRef.current=loaded;setData(loaded);stateRef.current.dirty=!j.data;setDirty(!j.data);autoWanted.current=false;setError('');setConflict(false);if(force){setQuote(null);setQuoteDirty(false);setJournal(null);setPriceListsOpen(false);setPasteOpen(false);setProduct(null);setCatalogGroupsOpen(false);setTemplateForm(null);}}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();const t=setInterval(()=>{if(!stateRef.current.dirty&&!stateRef.current.quoteDirty&&!stateRef.current.customerDirty&&!stateRef.current.settingsDirty&&!stateRef.current.catalogEditing&&!stateRef.current.templateOpen&&!stateRef.current.careOpen&&!stateRef.current.busy)void load();},15000);return()=>clearInterval(t);},[]);
 useEffect(()=>{const f=(e:BeforeUnloadEvent)=>{if(stateRef.current.dirty||stateRef.current.quoteDirty||stateRef.current.customerDirty||stateRef.current.settingsDirty||stateRef.current.catalogEditing||stateRef.current.templateOpen||stateRef.current.careOpen||stateRef.current.journalDraftDirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f);},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 function edit(next:Data){if(next.products!==dataRef.current?.products)autoWanted.current=true;dataRef.current=next;stateRef.current.dirty=true;setData(next);setDirty(true);}
 function editQuote(next:Quote){setQuote(next);setQuoteDirty(true);}
 async function persist(next:Data,automatic=false,retainOnFailure=true){
  if(stateRef.current.busy||conflict)return false;
  const previous=dataRef.current;
  stateRef.current.busy=true;setAutoSaving(automatic);setBusy(true);
  try{
   const r=await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json','X-Workspace-Features':'price-lists-v1'},body:JSON.stringify({version:versionRef.current,data:next}),signal:AbortSignal.timeout(20000)});
   const j=await r.json() as {error?:string;version:number;backupOk?:boolean};
   if(!r.ok){if(r.status===409)setConflict(true);throw new Error(j.error||'Chưa lưu được. Hãy thử lại.');}
   setBackupWarning(j.backupOk===false);versionRef.current=j.version;setVersion(j.version);
   if(dataRef.current===previous){dataRef.current=next;setData(next);stateRef.current.dirty=false;setDirty(false);autoWanted.current=false;}
   setError('');if(!automatic)toast.success('Đã lưu lên đám mây');return true;
  }catch(e){
   if(retainOnFailure){if(!automatic&&dataRef.current===previous){dataRef.current=next;setData(next);}
   stateRef.current.dirty=true;setDirty(true);}setError((e as Error).message||'Chưa lưu được. Hãy thử lại.');
   if(!automatic)toast.error((e as Error).message);return false;
  }finally{stateRef.current.busy=false;setBusy(false);setAutoSaving(false);}
 }
 useEffect(()=>{
  if(!data||!dirty||busy||error||conflict||!autoWanted.current)return;
  const timer=setTimeout(()=>{if(dataRef.current)void persist(dataRef.current,true);},350);
  return()=>clearTimeout(timer);
 },[data,dirty,busy,error,conflict]);
 useEffect(()=>{const retry=()=>{if(autoWanted.current&&!stateRef.current.busy)setError('');};window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[]);
 function download(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 function backup(){if(data){const now=new Date();download(new Blob([serializeBackup(data,quote,now.toISOString())],{type:'application/json'}),backupFilename(now));}}
 async function saveSettings(update:SettingsUpdate){const current=dataRef.current;return current?persist(update(current),false,false):false;}
 async function restoreBackup(backup:Backup,expectedVersion:number,id?:string){
  if(stateRef.current.busy||conflict)return false;
  if(expectedVersion!==versionRef.current){toast.error('Dữ liệu vừa thay đổi. Hãy mở lại bản sao lưu để kiểm tra.');return false;}
  if(stateRef.current.dirty&&expectedVersion>0){toast.error('Hãy lưu thay đổi hiện tại trước khi khôi phục.');return false;}
  stateRef.current.busy=true;setBusy(true);
  try{
   const r=await fetch('/api/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore',version:expectedVersion,...(id?{id}:{backup})}),signal:AbortSignal.timeout(20000)});
   const j=await r.json() as {error?:string;version:number};
   if(!r.ok){if(r.status===409){setConflict(true);setError(j.error||'Dữ liệu vừa thay đổi. Hãy tải lại dữ liệu.');}throw new Error(j.error||'Chưa khôi phục được. Hãy thử lại.');}
   const restored=migratePriceLists(migrateJournal(backup.data));
   dataRef.current=restored;setData(restored);versionRef.current=j.version;setVersion(j.version);
   stateRef.current.dirty=false;setDirty(false);autoWanted.current=false;setError('');
   stateRef.current.quoteDirty=!!backup.draft;setQuote(backup.draft);setQuoteDirty(!!backup.draft);setSettingsDirty(false);
   setProduct(null);setHeader(null);setPreview(null);setTemplateForm(null);setHistoryMode('all');setSearch('');
   toast.success('Đã khôi phục. Bản trước đó được giữ trong lịch sử sao lưu.');return true;
  }catch(e){toast.error((e as Error).message||'Chưa khôi phục được. Hãy thử lại.');return false;}
  finally{stateRef.current.busy=false;setBusy(false);}
 }

 function fresh(){if(!data)return;const action=()=>{setQuote(blankQuote(data));setQuoteDirty(false);};if(quoteDirty)setConfirm({title:'Tạo báo giá mới?',description:'Bản đang nhập chưa lưu sẽ được bỏ.',action});else action();}
 function openQuote(q:Quote,copy=false){if(dataRef.current)q=migrateQuotePriceList(q,dataRef.current);const action=()=>{setQuote(copy?copyQuoteForCustomer(q,uid(),new Date().toISOString()):structuredClone(q));setQuoteDirty(copy);};if(quoteDirty)setConfirm({title:'Mở báo giá khác?',description:'Bản đang nhập chưa lưu sẽ được bỏ.',action});else action();}
 async function saveQuote(q:Quote,asNew=false){const current=dataRef.current;if(!current||stateRef.current.busy||conflict)return null;if(q.template&&!q.customer.trim()){toast.error('Nhập tên mẫu.');return null;}if(!q.lines.length){toast.error('Tích ít nhất một mặt hàng.');return null;}if(q.lines.some(l=>l.price===null)){toast.error('Còn mặt hàng chưa nhập giá.');return null;}
 const n=structuredClone(q);n.customer=n.customer.trim();if(!q.code||asNew)n.date=new Date().toISOString();if(!q.template&&(!q.code||asNew)){const order=new Map(current.products.map((p,i)=>[p.id,i]));n.lines.sort((a,b)=>(order.get(a.id)??9999)-(order.get(b.id)??9999));}if(asNew)n.id=uid();if(n.template){n.customerId=undefined;n.phone='';n.address='';n.internal='';n.followUp='';n.status='Mới báo';}else if(!n.code||asNew)n.code='BG-'+String(current.nextNumber).padStart(3,'0');
 const linked=linkQuoteCustomer(current.customers,n,uid()),saved=linked.quote;
 const exists=current.quotes.some(x=>x.id===saved.id);const next={...current,customers:linked.customers,quotes:[saved,...current.quotes.filter(x=>x.id!==saved.id)],nextNumber:current.nextNumber+(!exists&&!saved.template?1:0)};
 if(!await persist(next,false,false))return null;
 if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
 focusHistoryOnClose.current=true;stateRef.current.quoteDirty=false;
 setQuote(null);setQuoteDirty(false);setKeyboardOpen(false);setSearch('');
 setHistoryMode(saved.template?'templates':'all');setTab('quotes');setSavedQuote({id:saved.id});
 return saved;}
 function startTemplate(q:Quote,mode:'create'|'rename'='create'){
  if(stateRef.current.busy||conflict)return;
  stateRef.current.templateOpen=true;
  setTemplateForm({mode,source:structuredClone(q)});
 }
 async function saveTemplateName(name:string){
  const current=dataRef.current,form=templateForm;
  if(!current||!form||stateRef.current.busy||conflict)return false;
  try{
   let next:Data,id:string;
   if(form.mode==='rename'){
    next=renameQuoteTemplate(current,form.source.id,name);id=form.source.id;
   }else{
    const template=createQuoteTemplate(form.source,name,uid(),new Date().toISOString());
    id=template.id;next={...current,quotes:[template,...current.quotes]};
   }
   if(!await persist(next,false,false))return false;
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   setTemplateForm(null);stateRef.current.templateOpen=false;setKeyboardOpen(false);
   if(!quote){setSearch('');setHistoryMode('templates');setTab('quotes');setSavedQuote({id});}
   return true;
  }catch(e){toast.error((e as Error).message);return false;}
 }
 async function makePreview(q:Quote){
  try{const snapshot=prepareQuotePreview(q,dataRef.current?.products||[]);
   if(snapshot.lines.some(l=>l.price===0))setConfirm({title:'Có mặt hàng giá 0đ',description:'Kiểm tra lại trước khi xuất ảnh. Vẫn tiếp tục?',action:()=>void viewSaved(snapshot)});
   else await viewSaved(snapshot);
  }catch(e){toast.error((e as Error).message);}
 }
 function printQuote(q:Quote){try{openQuotePrint(q);}catch(e){toast.error((e as Error).message);}}
 function printDraft(q:Quote){
  try{const snapshot=prepareQuotePreview(q,dataRef.current?.products||[]);
   if(snapshot.lines.some(line=>line.price===0))setConfirm({title:'Có mặt hàng giá 0đ',description:'Kiểm tra lại trước khi in. Vẫn tiếp tục?',action:()=>printQuote(snapshot)});
   else printQuote(snapshot);
  }catch(e){toast.error((e as Error).message);}
 }
 async function shareImage(blob:Blob,q:Quote){
  const name=quoteImageName(q),file=new File([blob],name,{type:'image/png'});
  try{
   if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});
   else{download(blob,name);toast.info('Ảnh đã tải xuống. Mở Zalo và chọn ảnh để gửi.');}
  }catch(e){
   if((e as Error).name==='AbortError')return;
   setPreview({url:URL.createObjectURL(blob),blob,quote:q});
   toast.info('Ảnh đã sẵn sàng. Bấm Gửi Zalo để chọn nơi gửi, hoặc Tải ảnh.');
  }
 }
 async function viewSaved(q:Quote,share=false){
  if(imageJob.current)return;imageJob.current=true;setImageBusy(q.id);
  try{const snapshot=q.template?copyQuoteForCustomer(q,q.id,q.date):structuredClone(q),blob=await quoteImage(snapshot);if(share)await shareImage(blob,snapshot);else setPreview({url:URL.createObjectURL(blob),blob,quote:snapshot});}
  catch(e){toast.error((e as Error).message||'Chưa tạo được ảnh. Hãy thử lại.');}
  finally{imageJob.current=false;setImageBusy(null);}
 }
 function deleteSaved(q:Quote){setConfirm({title:q.template?'Xóa mẫu?':'Xóa hẳn báo giá?',description:q.template?'Mẫu “'+q.customer+'” sẽ bị xóa. Các báo giá đã tạo từ mẫu này vẫn được giữ nguyên.':'Báo giá · '+(q.customer.trim()||'Chưa đặt tên')+' · '+quoteDateTime(q.date).label+' sẽ bị xóa vĩnh viễn. Không thể khôi phục.',confirmLabel:q.template?'Xóa mẫu':'Xóa hẳn',action:()=>{const current=dataRef.current;if(current)void persist({...current,quotes:current.quotes.filter(x=>x.id!==q.id)},false,false);}});}
 function pastePlan(text:string,mode=pasteMode,first=startId,col=Number(startTier)){if(!data)return;const rows=text.replace(/\r/g,'').split('\n').filter(r=>r.trim());const out:Change[]=[];const errs:string[]=[];const misses:string[]=[];const start=data.products.findIndex(p=>p.id===first);const seen=new Set<string>();rows.forEach((r,i)=>{const cells=r.split('\t');let p:Product|undefined,values:string[];if(mode==='names'){const name=cells[0].trim();if(i===0&&/^(mặt hàng|tên hàng|sản phẩm)$/i.test(name))return;p=data.products.find(x=>x.id===mapping[name])||data.products.find(x=>x.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'));values=cells.slice(1);if(!p){misses.push(name);return;}}else {p=data.products[start+i];values=cells;}
 if(!p){errs.push('Dòng '+(i+1)+': vượt danh mục.');return;}if(values.length>(getPriceLists(data).length-col)){errs.push(p.name+': số cột vượt quá bảng giá.');return;}values.forEach((v,k)=>{try{const n=parsePrice(v);if(n===null)return;const key=p!.id+':'+(col+k);if(seen.has(key)){errs.push(p!.name+': trùng mặt hàng/cột giá.');return;}seen.add(key);if(n!==p!.prices[col+k])out.push({id:p!.id,tier:col+k,old:p!.prices[col+k],value:n,name:p!.name});}catch(e){errs.push(p!.name+': '+(e as Error).message);}});});setChanges(out);setPasteErrors(errs);setUnmatched([...new Set(misses)]);}
 function directPaste(text:string,id:string,tier:number){setPasteText(text);setPasteMode('position');setStartId(id);setStartTier(String(tier));setPasteOpen(true);pastePlan(text,'position',id,tier);}
 function applyChanges(){if(!data||pasteErrors.length||unmatched.length)return;const products=data.products.map(p=>{const c={...p,prices:[...p.prices]};changes.filter(x=>x.id===p.id).forEach(x=>c.prices[x.tier]=x.value);return c;});edit({...data,products});setChanges([]);setPasteOpen(false);toast.success('Đã áp dụng giá. Đang đồng bộ…');}

 async function saveCustomerRecord(customer:Customer){
  const current=dataRef.current;if(!current)return false;
  try{return await persist({...current,customers:upsertCustomer(current.customers,customer)});}
  catch(e){toast.error((e as Error).message);return false;}
 }
 async function deleteCustomerRecord(customer:Customer){
  const current=dataRef.current;if(!current)return false;
  return persist({...current,customers:current.customers.filter(c=>c.id!==customer.id)});
 }
 function createCustomerQuote(customer:Customer){
  const current=dataRef.current;if(!current)return;
  const last=quotesForCustomer(current.quotes,customer.id)[0];
  const index=last?quotePriceIndex(current,last):0,tier=Math.max(0,index),list=getPriceLists(current)[tier];
  setQuote({...blankQuote(current),customerId:customer.id,customer:customer.name,phone:customer.phone,address:customer.address,tier,priceListId:list.id,priceListName:list.name});setQuoteDirty(true);
 }
 function openCare(q:Quote){if(dataRef.current)setJournal(quoteJournalTarget(dataRef.current,q));}
 function openCustomerJournal(c:Customer){setJournal(customerJournalTarget(c));}
 async function saveJournal(key:string,action:JournalAction){
  const current=dataRef.current;if(!current)return false;
  return persist(updateJournal(current,key,action),true,false);
 }
 async function saveCare(id:string,fields:QuoteCare){
  const current=dataRef.current;if(!current)return false;
  try{return await persist(updateQuoteCare(current,id,fields),false,false);}
  catch(error){toast.error((error as Error).message);return false;}
 }
 async function savePriceList(action:PriceListAction){
  const current=dataRef.current;if(!current||stateRef.current.busy||conflict)return false;
  try{
   const next=updatePriceLists(current,action);
   if(!await persist(next,false,false))return false;
   if(action.type==='add')setSelectedPriceList(action.id);
   else if(action.type==='delete'&&selectedPriceList===action.id)setSelectedPriceList(getPriceLists(next)[0].id);
   setChanges([]);setPasteOpen(false);return true;
  }catch(e){toast.error((e as Error).message);return false;}
 }
 function editProducts(products:Product[]){const current=dataRef.current;if(current&&products!==current.products)edit({...current,products});}
 if(!data)return <div className="loading"><FileText size={42}/><h1>Báo giá Sùng Tuyến</h1><p>{error||'Đang tải bảng giá…'}</p>{error&&<button onClick={()=>void load()}>Thử lại</button>}</div>;
 const priceLists=getPriceLists(data),priceTier=Math.max(0,priceLists.findIndex(list=>list.id===selectedPriceList));
 const quoteTier=quote?quotePriceIndex(data,quote):0;
 const groups=[...new Set(data.products.map(p=>p.group))];
 const active=data.quotes.filter(q=>!q.deleted&&!q.template),due=active.filter(q=>isCareDue(q,today));
 const list=(historyMode==='templates'?data.quotes.filter(q=>q.template&&!q.deleted):historyMode==='due'?due:active).filter(q=>historyMode==='templates'||customerMatchesSearch({id:q.id,name:q.customer.trim()||'Chưa đặt tên',phone:q.phone,address:q.address},search)).sort((a,b)=>b.date.localeCompare(a.date));

 const searching=historyMode!=='templates'&&!!search.trim();
 const changesTable=<div className="change-list">{changes.map(c=><div key={c.id+c.tier}><span>{c.name}<small>{priceLists[c.tier]?.name}</small></span><span><del>{money(c.old)||'—'}</del> → <b className={c.value===0?'warning':''}>{money(c.value)}</b></span></div>)}{!changes.length&&<p>Chưa có giá thay đổi.</p>}</div>;
 return <div className={'app-shell '+((tab==='quotes'||tab==='prices'||tab==='customers')?'workspace-fixed ':'')+(tab==='quotes'?'history-fixed ':'')+(keyboardOpen?'has-keyboard':'')}><Toaster richColors position="top-center"/><header className="topbar"><div className="brand"><span className="brand-mark"><FileText size={25}/></span><div><strong>SÙNG TUYẾN</strong><small>BÁO GIÁ VẬT LIỆU XÂY DỰNG</small></div></div><AccountControls phone={phone} unsaved={dirty||quoteDirty||customerDirty||settingsDirty||templateOpen||priceListsOpen||!!journal||hasJournalDrafts}/></header>
 <Tabs value={tab} onValueChange={setTab} className="app-tabs">
 <main className="workspace">{error&&<div className="error"><span>{error}</span>{dirty&&!conflict&&<button disabled={busy} onClick={()=>{if(dataRef.current)void persist(dataRef.current,true);}}>Thử lưu lại</button>}{conflict&&<button onClick={backup}>Tải bản đang nhập</button>}<button onClick={()=>setConfirm({title:'Tải dữ liệu mới?',description:'Thay đổi chưa lưu sẽ được bỏ. Có thể tải bản sao lưu trước.',action:()=>void load(true)})}>Tải lại</button></div>}
 <TabsContent value="quotes" className="history-page"><div className="page-heading"><div><p className="eyebrow">BÁO GIÁ & KHÁCH HÀNG</p><h1>Báo giá của bạn</h1><p>Chọn hàng, chỉnh giá và gửi khách trong một ảnh.</p></div><button className="primary" onClick={fresh}><Plus/>Tạo báo giá</button></div>
 <div className="summary-strip"><div><span>Báo giá đã lưu</span><strong>{active.length.toString().padStart(2,'0')}</strong></div><button onClick={()=>setHistoryMode('due')}><span>Cần chăm sóc</span><strong>{due.length.toString().padStart(2,'0')}<CalendarClock size={22}/></strong></button><div><span>Mặt hàng</span><strong>{data.products.length}</strong></div></div>
 <section className="panel history-panel"><div className="panel-toolbar"><div className="filter-buttons">{[['all','Gần đây'],['templates','Mẫu đã lưu'],['due','Cần chăm sóc']].map(([v,l])=><button className={historyMode===v?'active':''} onClick={()=>setHistoryMode(v)} key={v}>{l}</button>)}</div>{historyMode!=='templates'&&<div className="history-search"><input ref={historySearch} className="search" placeholder="Tìm khách hàng" aria-label="Tìm báo giá theo tên hoặc số điện thoại" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" className="history-search-clear" aria-label="Xóa nội dung tìm kiếm và đóng bàn phím" onPointerDown={e=>e.preventDefault()} onClick={()=>{historySearch.current?.blur();setSearch('');setKeyboardOpen(false);}}><X aria-hidden="true"/></button>}</div>}</div>
 <div ref={historyResults} className="history-results" key={historyMode} role="region" aria-label="Danh sách báo giá" tabIndex={0}>{!list.length?<div className="empty"><span className="empty-icon"><FileText size={33}/></span><h2>{searching?'Không tìm thấy báo giá':historyMode==='all'?'Báo giá đầu tiên bắt đầu từ đây':historyMode==='templates'?'Chưa có mẫu báo giá':'Chưa có báo giá trong mục này'}</h2><p>{searching?'Thử tên hoặc số điện thoại khác.':historyMode==='all'?'Nhập bảng giá, chọn các mặt hàng cần báo rồi gửi ảnh cho khách.':historyMode==='templates'?'Mở menu ⋯ của một báo giá và chọn Lưu thành mẫu.':'Các báo giá phù hợp sẽ xuất hiện ở đây.'}</p>{historyMode==='all'&&!searching&&<div className="actions"><button onClick={()=>setTab('prices')}><Table2/>Nhập bảng giá</button><button className="primary" onClick={fresh}><Plus/>Tạo báo giá</button></div>}</div>:<div className="quote-list">{list.map(q=><QuoteHistoryCard key={q.id} quote={q} highlighted={savedQuote?.id===q.id} disabled={busy||conflict||!!imageBusy} loading={imageBusy===q.id} due={isCareDue(q,today)} onCustomer={()=>openCare(q)} onCare={()=>openCare(q)} onView={()=>void viewSaved(q)} onShare={()=>void viewSaved(q,true)} onEdit={()=>openQuote(q)} onDelete={()=>deleteSaved(q)} onSaveTemplate={()=>startTemplate(q)} onUseTemplate={()=>openQuote(q,true)} onRenameTemplate={()=>startTemplate(q,'rename')}/>)}</div>}<div className="bottom-note"><Check size={16}/> Giá trong báo giá đã lưu không thay đổi khi cập nhật bảng giá chung.</div></div></section></TabsContent>
 <TabsContent value="prices" className="prices-page"><div className="price-heading"><h1>Bảng giá</h1><div className="price-save"><small role="status">{busy?'Đang lưu…':dirty?'Chưa lưu':'Đã đồng bộ'}</small></div></div>
 <CatalogTable products={data.products} sorting={catalogSorting} onDone={()=>setCatalogSorting(false)} groupsOpen={catalogGroupsOpen} onGroupsOpen={setCatalogGroupsOpen} onProducts={editProducts} onEdit={setProduct} pricePicker={<><DropdownMenu><DropdownMenuTrigger asChild><button className="catalog-menu-button" aria-label="Thao tác bảng giá"><MoreVertical/></button></DropdownMenuTrigger><DropdownMenuContent align="start" onCloseAutoFocus={e=>{if(catalogMenuFocus.current){e.preventDefault();catalogMenuFocus.current=false;}}}><DropdownMenuItem onSelect={()=>{catalogMenuFocus.current=true;setPriceListsOpen(true);}}><Table2/>Quản lý bảng giá</DropdownMenuItem><DropdownMenuItem onSelect={()=>setCatalogSorting(true)}><ArrowUp/>Sắp xếp mặt hàng</DropdownMenuItem><DropdownMenuItem onSelect={()=>setCatalogGroupsOpen(true)}><Pencil/>Sửa / sắp xếp nhóm</DropdownMenuItem><DropdownMenuItem onSelect={()=>{setPasteOpen(true);setChanges([]);setStartId(data.products[0]?.id||'');setStartTier(String(priceTier));}}><ClipboardPaste/>Dán từ Excel</DropdownMenuItem><DropdownMenuItem onSelect={()=>setProduct({id:uid(),group:groups[0]||'Hàng khác',name:'',unit:'kg',prices:priceLists.map(()=>null)})}><Plus/>Thêm mặt hàng</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Choice label="Chọn bảng giá" value={String(priceTier)} options={priceLists.map((list,i)=>({value:String(i),label:list.name}))} onChange={v=>setSelectedPriceList(priceLists[Number(v)].id)}/></>} renderPrice={p=><Price key={p.id+':'+priceLists[priceTier].id} value={p.prices[priceTier]??null} onChange={v=>{const current=dataRef.current;if(!current)return;const index=getPriceLists(current).findIndex(list=>list.id===priceLists[priceTier].id);if(index>=0&&v!==current.products.find(x=>x.id===p.id)?.prices[index])editProducts(current.products.map(x=>x.id===p.id?{...x,prices:x.prices.map((n,j)=>j===index?v:n)}:x));}} onPaste={t=>directPaste(t,p.id,priceTier)}/>}/>
 </TabsContent>
 <TabsContent value="customers" className="customers-page"><Customers customers={data.customers} quotes={active} disabled={busy||conflict} onCustomer={openCustomerJournal} onCreate={createCustomerQuote} onSave={saveCustomerRecord} onDelete={deleteCustomerRecord} onDirtyChange={setCustomerDirty}/></TabsContent>
 <TabsContent value="settings"><SettingsPanel data={data} version={version} backupWarning={backupWarning} unsaved={dirty&&version>0} disabled={busy||conflict} onSave={saveSettings} onBackup={backup} onRestore={restoreBackup} onDirtyChange={setSettingsDirty}/></TabsContent></main><div className={'bottom-nav-wrap '+(keyboardOpen?'keyboard-hidden':'')}><TabsList aria-label="Điều hướng chính" className="bottom-nav"><TabsTrigger value="quotes"><History/><span>Báo giá</span></TabsTrigger><TabsTrigger value="prices"><Table2/><span>Bảng giá</span></TabsTrigger><button type="button" className="nav-create" onClick={fresh}><Plus/><span>Tạo báo giá</span></button><TabsTrigger value="customers"><Users/><span>Khách hàng</span></TabsTrigger><TabsTrigger value="settings"><Settings/><span>Cài đặt</span></TabsTrigger></TabsList></div></Tabs>
 <Dialog open={!!quote} onOpenChange={open=>{if(!open&&!stateRef.current.busy){if(quoteDirty)setConfirm({title:'Đóng bản đang nhập?',description:'Các thay đổi chưa lưu sẽ được bỏ.',action:()=>{setQuote(null);setQuoteDirty(false);}});else setQuote(null);}}}><DialogContent className="editor-dialog compact-editor" onCloseAutoFocus={e=>{if(focusHistoryOnClose.current){e.preventDefault();focusHistoryOnClose.current=false;historyResults.current?.focus({preventScroll:true});}}} onEscapeKeyDown={e=>{if(stateRef.current.busy)e.preventDefault();}} onOpenAutoFocus={e=>{e.preventDefault();document.getElementById('quote-dialog-title')?.focus();}}><DialogTitle id="quote-dialog-title" tabIndex={-1} className="sr-only">{quote?.template?'Sửa mẫu':quote?.code?'Sửa báo giá':'Tạo báo giá'}</DialogTitle><DialogDescription className="sr-only">Chỉnh sửa báo giá và chọn mặt hàng.</DialogDescription>{quote&&<><div className="quote-store-top"><Choice label="Tiêu đề cửa hàng" value={quote.header.id} options={[...data.headers,...(data.headers.some(h=>h.id===quote.header.id)?[]:[quote.header])].map(h=>({value:h.id,label:h.name.replace(/^Nhà phân phối\s+VLXD\s*/i,'')||h.name}))} onChange={v=>{const h=data.headers.find(h=>h.id===v);if(h)editQuote({...quote,header:structuredClone(h)});}}/><span className="quote-header-code" title={quoteDateTime(quote.date).label}>{quoteDateTime(quote.date).time}</span>{quote.template&&<span className="quote-header-template">Mẫu</span>}<button aria-label="Sửa tiêu đề riêng lần này" onClick={()=>setHeader({...quote.header,id:'once-'+uid()})}><Pencil/></button></div><div className="quote-editor-fixed"><QuoteCustomer key={quote.id} quote={quote} customers={data.customers} onChange={editQuote}/>

 <div className="section-heading"><div className="quote-tier-picker"><Choice label="Chọn bảng giá báo khách" value={quoteTier<0?'removed':String(quoteTier)} options={[...(quoteTier<0?[{value:'removed',label:(quote.priceListName||'Bảng giá cũ')+' (đã xóa)'}]:[]),...priceLists.map((list,i)=>({value:String(i),label:list.name}))]} onChange={v=>{if(v==='removed')return;const tier=Number(v),list=priceLists[tier];const action=()=>editQuote({...quote,tier,priceListId:list.id,priceListName:list.name,lines:quote.lines.map(l=>({...l,price:data.products.find(p=>p.id===l.id)?.prices[tier]??null}))});if(quote.lines.length)setConfirm({title:'Đổi sang '+list.name+'?',description:'Giá các mặt hàng đang chọn sẽ được thay bằng giá của bảng này.',action});else action();}}/></div><button onClick={()=>editQuote({...quote,lines:[]})}>Bỏ chọn tất cả</button></div>
 </div><div className="editor-scroll" role="region" aria-label="Mặt hàng và ghi chú báo giá" tabIndex={0}>
 {groups.map(g=>{const products=data.products.filter(p=>p.group===g);return <Collapsible defaultOpen className="quote-group" key={quote.id+g}><div className="group-check"><Checkbox aria-label={'Chọn nhóm '+g} checked={products.every(p=>quote.lines.some(l=>l.id===p.id))} onCheckedChange={c=>editQuote({...quote,lines:c?[...quote.lines,...products.filter(p=>!quote.lines.some(l=>l.id===p.id)).map(p=>({id:p.id,group:p.group,name:p.name,unit:p.unit,price:p.prices[quoteTier]??null,note:''}))]:quote.lines.filter(l=>l.group!==g)})}/><CollapsibleTrigger className="group-toggle"><strong>{g}</strong><ChevronRight/></CollapsibleTrigger></div><CollapsibleContent>{products.map(p=>{const l=quote.lines.find(l=>l.id===p.id);return <div className={'select-row '+(l?'selected':'')} key={p.id}><Checkbox aria-label={'Chọn '+p.name} checked={!!l} onCheckedChange={c=>editQuote({...quote,lines:c?[...quote.lines,{id:p.id,group:p.group,name:p.name,unit:p.unit,price:p.prices[quoteTier]??null,note:''}]:quote.lines.filter(x=>x.id!==p.id)})}/><div className="select-name" title={p.name}>{p.name}</div><span className="select-unit">{p.unit}</span>{l?<><Price value={l.price} onChange={v=>{if(v!==l.price)editQuote({...quote,lines:quote.lines.map(x=>x.id===p.id?{...x,price:v}:x)});}}/><button className={'line-note-toggle '+(l.note?'has-note':'')} aria-label={'Ghi chú '+p.name} aria-expanded={!!noteEditing[p.id]} onClick={()=>setNoteEditing({...noteEditing,[p.id]:!noteEditing[p.id]})}><Pencil/></button>{noteEditing[p.id]?<input className="line-note" aria-label={'Ghi chú '+p.name} placeholder="Ghi chú gửi khách" value={l.note} onChange={e=>editQuote({...quote,lines:quote.lines.map(x=>x.id===p.id?{...x,note:e.target.value}:x)})}/>:l.note?<button className="line-note-summary" onClick={()=>setNoteEditing({...noteEditing,[p.id]:true})}>{l.note}</button>:null}</>:<span className="muted">{money(p.prices[quoteTier]??null)||'Chưa có giá'}</span>}</div>;})}</CollapsibleContent></Collapsible>;})}
 {quote.lines.filter(l=>!data.products.some(p=>p.id===l.id)).map(l=><div className="select-row" key={l.id}><button title="Bỏ mặt hàng" onClick={()=>editQuote({...quote,lines:quote.lines.filter(x=>x.id!==l.id)})}><X/></button><span className="select-name" title={l.name+' (đã xóa khỏi danh mục)'}>{l.name}</span><span className="select-unit">{l.unit}</span><Price value={l.price} onChange={v=>editQuote({...quote,lines:quote.lines.map(x=>x.id===l.id?{...x,price:v}:x)})}/></div>)}
 <Fold key={'notes-'+quote.id} title="Ghi chú gửi khách" summary={quote.note}><QuoteNotes quote={quote} templates={data.notes} onChange={editQuote}/></Fold>
 </div>
 <div className="editor-footer"><button className="primary" disabled={!!imageBusy} onClick={()=>void makePreview(quote)}><Eye/>{imageBusy===quote.id?'Đang tạo ảnh…':'Xem ảnh'}</button><button disabled={busy||conflict} onClick={()=>void saveQuote(quote)}><Save/>{busy?'Đang lưu…':quote.template?'Lưu mẫu':'Lưu'}</button><DropdownMenu><DropdownMenuTrigger asChild><button aria-label="Thao tác báo giá khác"><MoreHorizontal/></button></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={e=>{if(editorMenuFocus.current){e.preventDefault();editorMenuFocus.current=false;}}}><DropdownMenuItem onSelect={()=>printDraft(quote)}><Printer/>In A5</DropdownMenuItem><DropdownMenuItem onSelect={()=>openQuote(quote,true)}><Copy/>{quote.template?'Dùng mẫu':'Sao chép cho khách khác'}</DropdownMenuItem>{!quote.template&&<><DropdownMenuItem disabled={busy||conflict} onSelect={()=>void saveQuote(quote,true)}><Copy/>Lưu bản mới</DropdownMenuItem><DropdownMenuItem disabled={busy||conflict} onSelect={()=>{editorMenuFocus.current=true;startTemplate(quote);}}><FileText/>Lưu thành mẫu</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div></>}</DialogContent></Dialog>


 {templateForm&&<QuoteTemplateName key={templateForm.mode+templateForm.source.id} mode={templateForm.mode} initialName={templateForm.mode==='rename'?templateForm.source.customer:''} disabled={busy||conflict} onSave={saveTemplateName} onClose={()=>{setTemplateForm(null);stateRef.current.templateOpen=false;setKeyboardOpen(false);}} onReturnFocus={()=>{if(quote)document.getElementById('quote-dialog-title')?.focus({preventScroll:true});else historyResults.current?.focus({preventScroll:true});}}/>}
 {journal&&<CustomerJournal key={journal.key} target={journal} customer={journal.key.startsWith('c:')?data.customers.find(c=>'c:'+c.id===journal.key):undefined} notes={journalNotes(data,journal.key)} quotes={journalQuotes(data,journal.key)} draft={journalDrafts[journal.key]||{text:''}} disabled={busy||conflict} conflict={conflict} onDraft={draft=>changeJournalDraft(journal.key,draft)} onSave={action=>saveJournal(journal.key,action)} onCare={saveCare} onClose={()=>setJournal(null)} onOpenQuote={q=>openQuote(q)} onCreate={createCustomerQuote} onRefresh={()=>void load(true)}/>}
  {preview&&<QuotePreviewSheet key={preview.url} preview={preview} onClose={()=>setPreview(null)} onDownload={()=>download(preview.blob,quoteImageName(preview.quote))} onPrint={()=>printQuote(preview.quote)} onShare={()=>void shareImage(preview.blob,preview.quote)}/>}
 <Dialog open={pasteOpen} onOpenChange={setPasteOpen}><DialogContent className="import-dialog"><DialogTitle>Dán giá từ Excel</DialogTitle><DialogDescription>Copy các ô trong Excel rồi dán vào đây. Ô trống không thay đổi giá cũ.</DialogDescription><div className="fieldgrid"><Choice label="Cách ghép" value={pasteMode} options={[{value:'names',label:'Ghép theo tên mặt hàng'},{value:'position',label:'Dán giá theo thứ tự dòng'}]} onChange={v=>{setPasteMode(v);setChanges([]);}}/><Choice label="Cột giá bắt đầu" value={startTier} options={priceLists.map((list,i)=>({value:String(i),label:'Bắt đầu: '+list.name}))} onChange={v=>{setStartTier(v);setChanges([]);}}/>{pasteMode==='position'&&<Choice label="Mặt hàng bắt đầu" value={startId} options={data.products.map(p=>({value:p.id,label:p.name}))} onChange={v=>{setStartId(v);setChanges([]);}}/>}</div><textarea className="paste-area" placeholder={'Thép D10\t105.000\t118.000\t120.000'} value={pasteText} onChange={e=>{setPasteText(e.target.value);setChanges([]);}}/><button onClick={()=>pastePlan(pasteText)}><Eye/>Kiểm tra & xem trước</button>{unmatched.map(n=><div className="field" key={n}><span>Chưa khớp: {n}</span><Choice label={'Ghép '+n} value={mapping[n]||''} options={data.products.map(p=>({value:p.id,label:p.name}))} onChange={v=>{setMapping({...mapping,[n]:v});setChanges([]);}}/></div>)}{unmatched.length>0&&<p className="warning">Chọn tên khớp rồi bấm Kiểm tra lại.</p>}{pasteErrors.map((e,i)=><p className="warning" key={i}>{e}</p>)}{changesTable}<button className="primary" disabled={!changes.length||!!pasteErrors.length||!!unmatched.length} onClick={applyChanges}><Check/>Áp dụng {changes.length} giá</button></DialogContent></Dialog>
 <PriceListManager open={priceListsOpen} onOpenChange={setPriceListsOpen} lists={priceLists} selectedId={priceLists[priceTier].id} disabled={busy||conflict} onSave={savePriceList}/>

 <Dialog open={!!product} onOpenChange={open=>{if(!open)setProduct(null);}}><DialogContent className="product-edit-dialog" onOpenAutoFocus={e=>{e.preventDefault();document.getElementById('product-dialog-title')?.focus({preventScroll:true});}}><DialogTitle id="product-dialog-title" tabIndex={-1}>Mặt hàng</DialogTitle><DialogDescription>Giá và tên trên báo giá cũ vẫn được giữ nguyên.</DialogDescription>{product&&<><Field label="Tên mặt hàng" value={product.name} onChange={v=>setProduct({...product,name:v})}/><ProductGroupPicker key={product.id} value={product.group} groups={groups} onChange={group=>setProduct({...product,group})}/><Field label="Đơn vị" value={product.unit} onChange={v=>setProduct({...product,unit:v})}/><button className="primary" onClick={()=>{if(!product.name.trim()||!product.group.trim()||!product.unit.trim()){toast.error('Nhập đủ tên, nhóm và đơn vị.');return;}if(data.products.some(p=>p.id!==product.id&&p.name.trim().toLowerCase()===product.name.trim().toLowerCase())){toast.error('Tên mặt hàng đã có.');return;}editProducts(upsertProduct(dataRef.current?.products||data.products,product));setProduct(null);}}>Áp dụng</button>{data.products.some(p=>p.id===product.id)&&<button className="delete-product" onClick={()=>setConfirm({title:'Xóa '+product.name+'?',description:'Báo giá cũ vẫn được giữ nguyên.',action:()=>{if(dataRef.current)editProducts(dataRef.current.products.filter(p=>p.id!==product.id));setProduct(null);}})}><Trash2/>Xóa mặt hàng</button>}</>}</DialogContent></Dialog>
 <Dialog open={!!header} onOpenChange={open=>{if(!open)setHeader(null);}}><DialogContent><DialogTitle>{header?.id.startsWith('once-')?'Tiêu đề riêng báo giá này':'Mẫu tiêu đề'}</DialogTitle><DialogDescription>Không sử dụng logo.</DialogDescription>{header&&<><Field label="Tên cửa hàng / người báo" value={header.name} onChange={v=>setHeader({...header,name:v})}/><Field label="Địa chỉ" value={header.address} onChange={v=>setHeader({...header,address:v})}/><Field label="Điện thoại bán hàng" type="tel" value={header.phone} onChange={v=>setHeader({...header,phone:v})}/><button className="primary" onClick={()=>{if(!header.name.trim()){toast.error('Nhập tên cửa hàng.');return;}if(header.id.startsWith('once-')&&quote)editQuote({...quote,header});else edit({...data,headers:data.headers.some(h=>h.id===header.id)?data.headers.map(h=>h.id===header.id?header:h):[...data.headers,header]});setHeader(null);}}>Áp dụng</button></>}</DialogContent></Dialog>
 <AlertDialog open={!!confirm} onOpenChange={open=>{if(!open)setConfirm(null);}}><AlertDialogContent><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Quay lại</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={()=>{confirm?.action();setConfirm(null);}}>{confirm?.confirmLabel||'Tiếp tục'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}

function Fold({title,summary,children}:{title:string;summary?:string;children:React.ReactNode}){return <Collapsible className="quote-fold"><CollapsibleTrigger className="fold-toggle"><span>{title}</span><ChevronRight/></CollapsibleTrigger>{summary&&<p className="fold-summary">{summary}</p>}<CollapsibleContent className="fold-content">{children}</CollapsibleContent></Collapsible>;}
