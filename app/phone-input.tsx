'use client';
import {useState,type InputHTMLAttributes} from 'react';
import {formatPhone} from '@/lib/phone-format';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:string;onValueChange:(value:string)=>void};
export default function PhoneInput({value,onValueChange,...props}:Props){
 const [focused,setFocused]=useState(false);
 return <input {...props} type="tel" inputMode="tel" enterKeyHint="done" value={focused?value:formatPhone(value)} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onChange={e=>onValueChange(e.target.value)} onBlur={e=>{setFocused(false);onValueChange(formatPhone(e.target.value));props.onBlur?.(e);}}/>;
}
