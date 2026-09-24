export function normalizePhone(value:string):string {
 const compact=value.trim().replace(/[\s().-]/g,'');
 const phone=compact.startsWith('+84')?'0'+compact.slice(3):compact.startsWith('84')?'0'+compact.slice(2):compact;
 if(!/^0[35789]\d{8}$/.test(phone))throw new Error('Nhập số di động Việt Nam gồm 10 số.');
 return phone;
}
export function validPin(value:unknown):value is string{return typeof value==='string'&&/^\d{3}$/.test(value);}
export const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function secretToken(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
export async function digest(text:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));}
export async function hashPin(pin:string,salt:string) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)));
}
export function equalHash(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
