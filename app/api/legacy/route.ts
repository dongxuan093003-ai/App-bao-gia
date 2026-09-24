import { headers } from 'next/headers';
import {currentAccount,sameOrigin} from '@/lib/account';
import {database} from '@/db/raw';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Yêu cầu không hợp lệ.',{status:403});
 try{
  const account=await currentAccount(),legacyOwner=(await headers()).get('oai-authenticated-user-id');
  if(!account||!legacyOwner)return new Response('Cần đăng nhập cả tài khoản mới và tài khoản ChatGPT cũ.',{status:401});
  const result=await database().prepare('INSERT INTO quote_workspaces (owner,payload,version) SELECT ?,payload,1 FROM quote_workspaces WHERE owner=? ON CONFLICT(owner) DO NOTHING').bind(account.id,legacyOwner).run();
  if(!result.meta.changes)return new Response('Không có dữ liệu cũ hoặc tài khoản mới đã có dữ liệu. Không ghi đè.',{status:409});
  return new Response(null,{status:303,headers:{Location:'/', 'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return new Response('Chưa chuyển được dữ liệu. Vui lòng thử lại.',{status:503});}
}
