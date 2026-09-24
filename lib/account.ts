import { cookies } from 'next/headers';
import { database } from '@/db/raw';
import { digest,secretToken } from './credentials';
export const SESSION_COOKIE='__Host-sung-session';
export type Account={id:string;phone:string};
export async function currentAccount():Promise<Account|null>{
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 if(!token||!/^([a-f0-9]{64})$/.test(token))return null;
 return database().prepare('SELECT a.id,a.phone FROM phone_sessions s JOIN phone_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<Account>();
}
export async function startSession(accountId:string){
 const token=secretToken(),age=60*60*24*30;
 await database().prepare('INSERT INTO phone_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await digest(token),accountId,Date.now()+age*1000).run();
 return SESSION_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 return !!origin && origin===new URL(request.url).origin;
}
