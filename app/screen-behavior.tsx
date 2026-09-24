'use client';
import {useEffect} from 'react';

export default function ScreenBehavior(){
 useEffect(()=>{
  const root=document.documentElement,viewport=window.visualViewport;
  let frame=0;
  const revealInput=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const active=document.activeElement;
    if(!(active instanceof HTMLElement)||!active.matches('input,textarea,[contenteditable="true"]'))return;
    const list=active.closest<HTMLElement>('.catalog-scroll,.editor-scroll');
    if(!list)return;
    const inputRect=active.getBoundingClientRect(),listRect=list.getBoundingClientRect();
    const heading=active.closest('.quote-group')?.querySelector<HTMLElement>(':scope > .group-check');
    const visibleTop=listRect.top+(heading?.getBoundingClientRect().height||0)+8;
    if(inputRect.bottom>listRect.bottom-8)list.scrollTop+=inputRect.bottom-listRect.bottom+8;
    else if(inputRect.top<visibleTop)list.scrollTop+=inputRect.top-visibleTop;
   });
  };
  const resize=()=>{
   root.style.setProperty('--visible-height',`${viewport?.height||window.innerHeight}px`);
   // Mobile keyboards may pan the visual viewport as well as resize it.
   root.style.setProperty('--visible-top',`${Math.max(0,viewport?.offsetTop||0)}px`);
   revealInput();
  };
  const pinch=(event:TouchEvent)=>{if(event.touches.length>1&&event.cancelable)event.preventDefault();};
  const gesture=(event:Event)=>{if(event.cancelable)event.preventDefault();};
  resize();window.addEventListener('resize',resize);viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  document.addEventListener('focusin',revealInput);
  document.addEventListener('touchstart',pinch,{passive:false});
  document.addEventListener('touchmove',pinch,{passive:false});
  document.addEventListener('gesturestart',gesture,{passive:false});
  document.addEventListener('gesturechange',gesture,{passive:false});
  return()=>{
   window.removeEventListener('resize',resize);viewport?.removeEventListener('resize',resize);
   viewport?.removeEventListener('scroll',resize);
   document.removeEventListener('focusin',revealInput);cancelAnimationFrame(frame);
   document.removeEventListener('touchstart',pinch);document.removeEventListener('touchmove',pinch);
   document.removeEventListener('gesturestart',gesture);document.removeEventListener('gesturechange',gesture);
   root.style.removeProperty('--visible-height');
   root.style.removeProperty('--visible-top');
  };
 },[]);
 return null;
}
