import { cookies } from 'next/headers';
import { database } from '@/db/raw';
import { currentAccount,startSession,sameOrigin,SESSION_COOKIE } from '@/lib/account';
import { normalizePhone,validPin,hashPin,equalHash,secretToken,digest } from '@/lib/credentials';
const response=(body:object,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return response({error:'Yêu cầu không hợp lệ.'},403);
  const raw=await request.text();if(raw.length>2048)return response({error:'Yêu cầu quá dài.'},400);
  let p:{action?:string;phone?:string;pin?:string;confirmPin?:string};try{p=JSON.parse(raw);}catch{return response({error:'Dữ liệu không hợp lệ.'},400);}
  if(p.action==='logout'){
   const token=(await cookies()).get(SESSION_COOKIE)?.value;
   if(token)await database().prepare('DELETE FROM phone_sessions WHERE token_hash=?').bind(await digest(token)).run();
   return response({ok:true},200,SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  }
  if(!['login','register'].includes(p.action||''))return response({error:'Thao tác không hợp lệ.'},400);
  if(!validPin(p.pin))return response({error:'Mật khẩu phải gồm đúng 3 chữ số.'},400);
  let phone:string;try{phone=normalizePhone(typeof p.phone==='string'?p.phone:'');}catch(e){return response({error:(e as Error).message},400);}
  const db=database();
  if(p.action==='register'){
   if(p.confirmPin!==p.pin)return response({error:'Hai lần nhập mật khẩu chưa khớp.'},400);
   const accountId='phone:'+crypto.randomUUID(),salt=secretToken(),pinHash=await hashPin(p.pin,salt);
   const result=await db.prepare('INSERT INTO phone_accounts (id,phone,pin_hash,salt,created_at) VALUES (?,?,?,?,?) ON CONFLICT(phone) DO NOTHING').bind(accountId,phone,pinHash,salt,Date.now()).run();
   if(!result.meta.changes)return response({error:'Số điện thoại đã đăng ký. Hãy chuyển sang Đăng nhập.'},409);
   return response({ok:true},201,await startSession(accountId));
  }
  const account=await db.prepare('SELECT id,pin_hash,salt FROM phone_accounts WHERE phone=?').bind(phone).first<{id:string;pin_hash:string;salt:string}>();
  const computed=await hashPin(p.pin,account?.salt||'00000000000000000000000000000000');
  if(!account||!equalHash(computed,account.pin_hash))return response({error:'Số điện thoại hoặc mật khẩu chưa đúng.'},401);
  return response({ok:true},200,await startSession(account.id));
 }catch(e){console.error('Account request failed',e);return response({error:'Chưa kết nối được. Vui lòng thử lại.'},503);}
}
export async function GET(){try{const account=await currentAccount();return response(account?{phone:account.phone}:{phone:null});}catch{return response({error:'Chưa kết nối được.'},503);}}
