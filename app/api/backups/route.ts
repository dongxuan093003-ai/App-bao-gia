import {currentAccount,sameOrigin} from '@/lib/account';
import {database} from '@/db/raw';
import {BackupError,createBackup,listBackups,readBackup,restoreWorkspace} from '@/lib/backup-store';
import {MAX_BACKUP_BYTES,parseBackup} from '@/lib/backup';
import {migrateJournal} from '@/lib/customer-journal';

const noCache={'Cache-Control':'no-store'};
function failure(error:unknown){
 if(!(error instanceof BackupError))console.error(error);
 return Response.json({error:error instanceof BackupError?error.message:'Chưa thực hiện được. Dữ liệu hiện tại vẫn được giữ, hãy thử lại.'},{status:error instanceof BackupError?error.status:503,headers:noCache});
}
export async function GET(request:Request){try{
 const owner=(await currentAccount())?.id;
 if(!owner)return Response.json({error:'Vui lòng đăng nhập lại.'},{status:401,headers:noCache});
 const id=new URL(request.url).searchParams.get('id');
 const db=database();
 return Response.json(id?{backup:await readBackup(db,owner,id)}:{backups:await listBackups(db,owner)},{headers:noCache});
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 const owner=(await currentAccount())?.id;
 if(!owner)return Response.json({error:'Vui lòng đăng nhập lại.'},{status:401,headers:noCache});
 if(!sameOrigin(request))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers:noCache});
 const raw=await request.text();
 if(raw.length>MAX_BACKUP_BYTES)throw new BackupError('File sao lưu quá lớn.',413);
 let body;try{body=JSON.parse(raw);}catch{throw new BackupError('Dữ liệu không hợp lệ.',400);}
 if(!body||!Number.isSafeInteger(body.version)||body.version<0)throw new BackupError('Dữ liệu không hợp lệ.',400);
 const db=database();
 if(body.action==='create'){
  const id=await createBackup(db,owner,'manual',body.version);
  return Response.json({id,backups:await listBackups(db,owner)},{headers:noCache});
 }
 if(body.id!==undefined&&(typeof body.id!=='string'||!body.id||body.id.length>100))throw new BackupError('Bản sao lưu không hợp lệ.',400);
 if(body.action!=='restore')throw new BackupError('Yêu cầu không hợp lệ.',400);
 let backup;
 try{backup=body.id?await readBackup(db,owner,body.id):parseBackup(JSON.stringify(body.backup));}
 catch(error){if(error instanceof BackupError)throw error;throw new BackupError((error as Error).message,400);}
 const result=await restoreWorkspace(db,owner,migrateJournal(backup.data),body.version);
 return Response.json(result,{headers:noCache});
}catch(error){return failure(error);}}
