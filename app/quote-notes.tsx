'use client';
import {Check,Plus} from 'lucide-react';
import {toast} from 'sonner';
import type {NoteTemplate,Quote} from '@/lib/data';
import {changeCustomNote,quoteNoteState,toggleQuoteNote} from '@/lib/note-templates';

export default function QuoteNotes({quote,templates,onChange}:{quote:Quote;templates:NoteTemplate[];onChange:(q:Quote)=>void}){
 const state=quoteNoteState(quote,templates);
 const choices=[...templates.map(t=>state.templates.find(n=>n.id===t.id)||t),...state.templates.filter(n=>!templates.some(t=>t.id===n.id))];
 function update(action:()=>Quote){try{onChange(action());}catch(error){toast.error((error as Error).message);}}
 return <div className="quote-note-editor">
  <div className="note-chips">{choices.map(template=>{
   const enabled=state.templates.some(n=>n.id===template.id&&n.enabled);
   return <button key={template.id} className={enabled?'note-enabled':''} aria-pressed={enabled} onClick={()=>update(()=>toggleQuoteNote(quote,template,templates))}>{enabled?<Check/>:<Plus/>}{template.name}</button>;
  })}</div>
  {state.templates.some(t=>t.enabled)&&<div className="quote-enabled-notes">{state.templates.filter(t=>t.enabled).map(t=><p key={t.id}>{t.text}</p>)}</div>}
  <textarea value={state.manual} placeholder="Ghi chú thêm…" rows={2} aria-label="Ghi chú tự nhập" onChange={e=>update(()=>changeCustomNote(quote,e.target.value,templates))}/>
 </div>;
}
