import type {NoteTemplate,Quote,QuoteNoteTemplate} from './data';

/** Deterministic IDs keep templates stable until the first upgraded cloud save. */
export function migrateNotes<T extends {notes:(string|NoteTemplate)[]}>(data:T):Omit<T,'notes'>&{notes:NoteTemplate[]}{
 return {...data,notes:data.notes.map((note,index)=>typeof note==='string'?{id:'note-'+(index+1),name:'Mẫu '+(index+1),text:note}:note)};
}
export function nextNoteName(notes:NoteTemplate[]):string{
 return 'Mẫu '+(Math.max(0,...notes.map(n=>Number(/^Mẫu\s+(\d+)$/i.exec(n.name)?.[1]||0)))+1);
}
export function quoteNoteState(quote:Quote,available:NoteTemplate[]):{manual:string;templates:QuoteNoteTemplate[]}{
 if(quote.noteCustom!==undefined&&quote.noteTemplates)return {manual:quote.noteCustom,templates:quote.noteTemplates};
 // Older editors appended templates, starting with the default one. Recognize
 // only complete leading blocks, keeping all other wording exactly as entered.
 let manual=quote.note;
 const templates:QuoteNoteTemplate[]=[];
 const candidates=[...available].filter(n=>n.text.trim()).sort((a,b)=>b.text.length-a.text.length);
 while(manual){
  const match=candidates.find(n=>!templates.some(t=>t.id===n.id)&&(manual===n.text||manual.startsWith(n.text+'\n')));
  if(!match)break;
  templates.push({...match,enabled:true});manual=manual.slice(match.text.length+(manual.length>match.text.length?1:0));
 }
 const composed=[...templates.map(n=>n.text),manual].filter(Boolean).join('\n');
 return composed===quote.note?{manual,templates}:{manual:quote.note,templates:[]};
}
function applyNotes(quote:Quote,manual:string,templates:QuoteNoteTemplate[]):Quote{
 const note=[...templates.filter(n=>n.enabled).map(n=>n.text),manual].filter(Boolean).join('\n');
 if(note.length>4000)throw new Error('Ghi chú quá dài. Vui lòng giữ tổng nội dung dưới 4.000 ký tự.');
 return {...quote,note,noteCustom:manual,noteTemplates:templates};
}
export function toggleQuoteNote(quote:Quote,template:NoteTemplate,available:NoteTemplate[]):Quote{
 const state=quoteNoteState(quote,available),exists=state.templates.some(n=>n.id===template.id);
 const templates=exists?state.templates.map(n=>n.id===template.id?{...n,enabled:!n.enabled}:n):[...state.templates,{...template,enabled:true}];
 return applyNotes(quote,state.manual,templates);
}
export function changeCustomNote(quote:Quote,manual:string,available:NoteTemplate[]):Quote{
 return applyNotes(quote,manual,quoteNoteState(quote,available).templates);
}
