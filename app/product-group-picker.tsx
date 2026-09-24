'use client';
import {useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectSeparator,SelectTrigger,SelectValue} from '@/components/ui/select';

export default function ProductGroupPicker({value,groups,onChange}:{value:string;groups:string[];onChange:(value:string)=>void}){
 const labelId=useId(),input=useRef<HTMLInputElement>(null),previous=useRef(value),focusNew=useRef(false);
 const [adding,setAdding]=useState(false);
 const choices=[...new Set([...groups,...(!adding&&value?[value]:[])])].filter(group=>group.trim());
 function choose(selected:string){
  if(selected==='new'){
   previous.current=value;focusNew.current=true;setAdding(true);onChange('');
  }else{
   focusNew.current=false;setAdding(false);onChange(selected.slice(6));
  }
 }
 return <div className="field product-group-picker">
  <span id={labelId}>Nhóm hàng</span>
  <Select value={adding?'new':value?'group:'+value:undefined} onValueChange={choose}>
   <SelectTrigger className="choice" aria-labelledby={labelId}><SelectValue placeholder="Chọn nhóm hàng"/></SelectTrigger>
   <SelectContent className="product-group-menu" position="popper" align="start" sideOffset={4} onCloseAutoFocus={event=>{
    if(focusNew.current){event.preventDefault();focusNew.current=false;input.current?.focus({preventScroll:true});}
   }}>
    {choices.map(group=><SelectItem key={group} value={'group:'+group}>{group}</SelectItem>)}
    {choices.length>0&&<SelectSeparator/>}
    <SelectItem value="new">+ Nhóm mới</SelectItem>
   </SelectContent>
  </Select>
  {adding&&<div className="product-new-group">
   <input ref={input} autoFocus value={value} maxLength={4000} aria-label="Tên nhóm mới" placeholder="Nhập tên nhóm mới" enterKeyHint="done" onChange={event=>onChange(event.target.value)}/>
   <button type="button" aria-label="Hủy tạo nhóm mới" title="Hủy tạo nhóm mới" onClick={()=>{setAdding(false);focusNew.current=false;onChange(previous.current);}}><X/></button>
  </div>}
 </div>;
}
