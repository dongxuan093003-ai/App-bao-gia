import { requireChatGPTUser } from '../chatgpt-auth';
import { currentAccount } from '@/lib/account';
import { headers } from 'next/headers';
import { database } from '@/db/raw';
export const dynamic='force-dynamic';
export default async function Legacy(){
 await requireChatGPTUser('/du-lieu-cu');
 const account=await currentAccount();
 if(!account)return <main className="loading"><h1>Đăng nhập tài khoản số điện thoại trước</h1><a className="button" href="/">Về đăng nhập</a></main>;
 const legacyOwner=(await headers()).get('oai-authenticated-user-id');
 const old=legacyOwner?await database().prepare('SELECT version FROM quote_workspaces WHERE owner=?').bind(legacyOwner).first():null;
 const existing=await database().prepare('SELECT version FROM quote_workspaces WHERE owner=?').bind(account.id).first();
 return <main className="loading"><h1>Dữ liệu từ bản cũ</h1><p>Tài khoản nhận: {account.phone}</p><p>{!old?'Không có dữ liệu cũ cho tài khoản ChatGPT này.':existing?'Tài khoản số điện thoại đã có dữ liệu. Không tự ghi đè.':'Sao chép bảng giá, báo giá và ghi chú từ tài khoản ChatGPT của bạn.'}</p>{old&&!existing&&<form action="/api/legacy" method="post"><button className="primary" type="submit">Nhập dữ liệu cũ vào tài khoản này</button></form>}<a className="button" href="/">Về báo giá</a></main>;
}
