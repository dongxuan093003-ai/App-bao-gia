'use client';
import {useEffect} from 'react';
export default function KeyboardDone(){
 useEffect(()=>{
  const editable=(target:EventTarget|null):target is HTMLInputElement=>target instanceof HTMLInputElement&&['text','tel','number','email','password','search','url'].includes(target.type);
  const focus=(event:FocusEvent)=>{if(editable(event.target))event.target.enterKeyHint='done';};
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Enter'&&!event.isComposing&&editable(event.target)){
    if(event.target.getAttribute('role')==='combobox'&&event.target.getAttribute('aria-activedescendant'))return;
    event.preventDefault();event.stopPropagation();event.target.blur();
   }
  };
  document.addEventListener('focusin',focus);
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('focusin',focus);document.removeEventListener('keydown',key,true);};
 },[]);
 return null;
}
