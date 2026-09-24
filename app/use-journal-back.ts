'use client';
import {useEffect,useRef} from 'react';

/** One history entry per customer window; Back never navigates away from the app. */
export function useJournalBack(onBack:()=>boolean,onClose:()=>void){
 const token=useRef(''),handler=useRef(onBack),close=useRef(onClose),afterClose=useRef<(()=>void)|null>(null);
 handler.current=onBack;close.current=onClose;
 const closeWindow=()=>{close.current();const next=afterClose.current;afterClose.current=null;next?.();};
 const requestClose=(next?:()=>void)=>{
  afterClose.current=next||null;
  if(window.history.state?.sungCustomerPanel===token.current)window.history.back();
  else closeWindow();
 };
 useEffect(()=>{
  if(!token.current)token.current=typeof window.history.state?.sungCustomerPanel==='string'?window.history.state.sungCustomerPanel:crypto.randomUUID();
  const base=window.history.state,href=window.location.href;
  if(base?.sungCustomerPanel!==token.current)window.history.pushState({...base,sungCustomerPanel:token.current},'');
  const pop=(event:PopStateEvent)=>{
   if(window.location.href!==href)return;
   // Consume this local step before the framework treats it as a route reload.
   event.stopImmediatePropagation();
   if(window.history.state?.sungCustomerPanel===token.current)return;
   if(!afterClose.current&&handler.current()){
    window.history.pushState({...window.history.state,sungCustomerPanel:token.current},'');return;
   }
   closeWindow();
  };
  window.addEventListener('popstate',pop,true);
  return()=>window.removeEventListener('popstate',pop,true);
 },[]);
 return requestClose;
}
