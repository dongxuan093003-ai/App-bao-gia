'use client';
import {useId,useRef,useState} from 'react';
import {BookUser,ChevronRight,X} from 'lucide-react';
import {Command,CommandInput,CommandList,CommandItem} from '@/components/ui/command';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Customer,Quote} from '@/lib/data';
import {customerMatchesSearch} from '@/lib/customers';
import {formatPhone} from '@/lib/phone-format';
import PhoneInput from './phone-input';

export default function QuoteCustomer({quote,customers,onChange}:{quote:Quote;customers:Customer[];onChange:(q:Quote)=>void}){
 const [suggest,setSuggest]=useState(false),[directory,setDirectory]=useState(false),[query,setQuery]=useState('');
 const directoryTitle=useRef<HTMLHeadingElement>(null),directorySearch=useRef<HTMLInputElement>(null);
 const matches=customers.filter(c=>customerMatchesSearch(c,quote.customer)).slice(0,6);
 const directoryMatches=customers.filter(c=>customerMatchesSearch(c,query));
 const nameInputId=useId();
 function select(customer:Customer){
  onChange({...quote,customer:customer.name,customerId:customer.id,phone:customer.phone,address:customer.address});
  setSuggest(false);setDirectory(false);(document.activeElement as HTMLElement)?.blur();
 }
 return <section className="quote-customer-card customer-redesigned customer-fixed" aria-label={quote.template?'Tên mẫu báo giá':'Thông tin khách hàng'}>
  <div className="customer-fixed-row quote-customer-name-row">
   <label className="quote-customer-label" htmlFor={nameInputId}>{quote.template?'Tên mẫu:':'Khách hàng:'}</label>
   <div className="customer-name-input"><Command shouldFilter={false}>
    <CommandInput id={nameInputId} aria-label={quote.template?'Tên mẫu':'Tên khách hàng'} placeholder="" value={quote.customer} onValueChange={customer=>{onChange({...quote,customer,customerId:undefined});setSuggest(true);}} onFocus={()=>setSuggest(true)} onBlur={()=>setSuggest(false)}/>
    {suggest&&!quote.template&&matches.length>0&&<CommandList aria-label="Khách hàng đã có">{matches.map(c=><CommandItem key={c.id} value={c.id} onPointerDown={e=>e.preventDefault()} onSelect={()=>select(c)}><span><strong>{c.name}</strong><small>{[formatPhone(c.phone),c.address].filter(Boolean).join(' · ')}</small></span></CommandItem>)}</CommandList>}
   </Command></div>
   <div className="quote-customer-actions"><button className={'quote-customer-icon '+(!quote.customer?'is-hidden':'')} disabled={!quote.customer} aria-label={quote.template?'Xóa tên mẫu':'Xóa tên khách hàng'} onClick={()=>{onChange({...quote,customer:'',customerId:undefined});setSuggest(false);(document.activeElement as HTMLElement)?.blur();}}><X/></button>
   {!quote.template&&<button className="quote-customer-icon customer-directory-button" aria-label="Chọn khách hàng đã lưu" onClick={()=>{setQuery('');setDirectory(true);setSuggest(false);}}><BookUser/></button>}</div>
  </div>
  {!quote.template&&<><label className="customer-fixed-row"><span className="quote-customer-label">Số điện thoại:</span><PhoneInput aria-label="Số điện thoại" value={quote.phone} onValueChange={phone=>onChange({...quote,phone})}/></label>
  <label className="customer-fixed-row"><span className="quote-customer-label">Địa chỉ:</span><input aria-label="Địa chỉ" value={quote.address} onChange={e=>onChange({...quote,address:e.target.value})}/></label></>}
  <Dialog open={directory} onOpenChange={setDirectory}><DialogContent className="quote-customer-directory" onOpenAutoFocus={e=>{e.preventDefault();directoryTitle.current?.focus({preventScroll:true});}}>
   <DialogTitle ref={directoryTitle} tabIndex={-1}>Chọn khách hàng</DialogTitle><DialogDescription className="sr-only">Tìm và chọn khách hàng đã lưu.</DialogDescription>
   <div className="quote-directory-search"><input ref={directorySearch} aria-label="Tìm khách hàng" placeholder="Tìm khách hàng" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Xóa tìm kiếm" onClick={()=>{directorySearch.current?.blur();setQuery('');}}><X/></button>}</div>
   <div className="quote-directory-list">{directoryMatches.length?directoryMatches.map(c=><button key={c.id} onClick={()=>select(c)}><span><strong>{c.name}</strong><small>{[formatPhone(c.phone),c.address].filter(Boolean).join(' · ')}</small></span><ChevronRight/></button>):<p>{customers.length?'Không tìm thấy khách hàng.':'Chưa có khách đã lưu. Có thể nhập tên trực tiếp trên báo giá.'}</p>}</div>
  </DialogContent></Dialog>
 </section>;
}
