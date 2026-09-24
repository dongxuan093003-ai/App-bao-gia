import {backupSummary,parseBackup,type BackupEntry,type BackupReason} from './backup';
import {initialData,type Data} from './data';

export const BACKUP_INTERVAL_MS=7*24*60*60*1000;
export const BACKUP_LIMIT=8;
type WorkspaceRow={payload:string;version:number};
export class BackupError extends Error{constructor(message:string,public status=409){super(message);}}
const changed='Dữ liệu vừa thay đổi trên thiết bị khác. Hãy tải lại dữ liệu rồi thử lại.';
function trim(db:D1Database,owner:string){
 return db.prepare('DELETE FROM quote_backups WHERE owner=? AND id NOT IN (SELECT id FROM quote_backups WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT ?)').bind(owner,owner,BACKUP_LIMIT);
}
export async function createBackup(db:D1Database,owner:string,reason:'automatic'|'manual',expectedVersion?:number,now=Date.now()){
 if(reason==='automatic'){
  const latest=await db.prepare('SELECT created_at FROM quote_backups WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(owner).first<{created_at:number}>();
  if(latest&&latest.created_at>now-BACKUP_INTERVAL_MS)return null;
 }
 const row=await db.prepare('SELECT payload,version FROM quote_workspaces WHERE owner=?').bind(owner).first<WorkspaceRow>();
 if(!row){if(reason==='automatic')return null;throw new BackupError('Chưa có dữ liệu đã lưu để sao lưu.');}
 if(expectedVersion!==undefined&&row.version!==expectedVersion)throw new BackupError(changed);
 const id=crypto.randomUUID(),summary=JSON.stringify(backupSummary(JSON.parse(row.payload)));
 // INSERT SELECT rechecks the version inside the transaction. Simultaneous devices cannot create duplicate weekly snapshots.
 const insert=reason==='automatic'
  ?db.prepare(`INSERT INTO quote_backups (id,owner,payload,workspace_version,created_at,reason,summary)
    SELECT ?,owner,payload,version,?,'automatic',? FROM quote_workspaces WHERE owner=? AND version=?
    AND NOT EXISTS (SELECT 1 FROM quote_backups WHERE owner=? AND created_at>?)
    AND (NOT EXISTS (SELECT 1 FROM quote_backups WHERE owner=?) OR payload<>(SELECT payload FROM quote_backups WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT 1))`)
    .bind(id,now,summary,owner,row.version,owner,now-BACKUP_INTERVAL_MS,owner,owner)
  :db.prepare(`INSERT INTO quote_backups (id,owner,payload,workspace_version,created_at,reason,summary)
    SELECT ?,owner,payload,version,?,'manual',? FROM quote_workspaces WHERE owner=? AND version=?`).bind(id,now,summary,owner,row.version);
 const results=await db.batch([insert,trim(db,owner)]);
 if(!results[0].meta.changes){if(reason==='manual')throw new BackupError(changed);return null;}
 return id;
}
export async function automaticBackup(db:D1Database,owner:string){
 try{await createBackup(db,owner,'automatic');return true;}
 catch(error){console.error('Automatic backup failed',error);return false;}
}
export async function listBackups(db:D1Database,owner:string):Promise<BackupEntry[]>{
 const rows=await db.prepare('SELECT id,workspace_version,created_at,reason,summary FROM quote_backups WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT ?').bind(owner,BACKUP_LIMIT).all<{id:string;workspace_version:number;created_at:number;reason:BackupReason;summary:string}>();
 return rows.results.map(row=>({id:row.id,version:row.workspace_version,createdAt:new Date(row.created_at).toISOString(),reason:row.reason,summary:JSON.parse(row.summary)}));
}
export async function readBackup(db:D1Database,owner:string,id:string){
 const row=await db.prepare('SELECT payload,created_at FROM quote_backups WHERE owner=? AND id=?').bind(owner,id).first<{payload:string;created_at:number}>();
 if(!row)throw new BackupError('Không tìm thấy bản sao lưu. Hãy tải lại danh sách.',404);
 return parseBackup(JSON.stringify({data:JSON.parse(row.payload),exportedAt:new Date(row.created_at).toISOString()}));
}
export async function restoreWorkspace(db:D1Database,owner:string,data:Data,version:number,now=Date.now()){
 const row=await db.prepare('SELECT payload,version FROM quote_workspaces WHERE owner=?').bind(owner).first<WorkspaceRow>();
 if((row?.version??0)!==version)throw new BackupError(changed);
 const checkpoint=crypto.randomUUID(),payload=JSON.stringify(data);
 const previous=row?.payload??JSON.stringify(initialData()),summary=JSON.stringify(backupSummary(JSON.parse(previous)));
 const savePrevious=row
  ?db.prepare(`INSERT INTO quote_backups (id,owner,payload,workspace_version,created_at,reason,summary)
    SELECT ?,owner,payload,version,?,'before_restore',? FROM quote_workspaces WHERE owner=? AND version=?`).bind(checkpoint,now,summary,owner,version)
  :db.prepare(`INSERT INTO quote_backups (id,owner,payload,workspace_version,created_at,reason,summary)
    SELECT ?,?,?,0,?,'before_restore',? WHERE NOT EXISTS (SELECT 1 FROM quote_workspaces WHERE owner=?)`).bind(checkpoint,owner,previous,now,summary,owner);
 const replace=row
  ?db.prepare('UPDATE quote_workspaces SET payload=?,version=version+1 WHERE owner=? AND version=? AND EXISTS (SELECT 1 FROM quote_backups WHERE id=? AND owner=?)').bind(payload,owner,version,checkpoint,owner)
  :db.prepare('INSERT INTO quote_workspaces (owner,payload,version) SELECT ?,?,1 WHERE EXISTS (SELECT 1 FROM quote_backups WHERE id=? AND owner=?) ON CONFLICT(owner) DO NOTHING').bind(owner,payload,checkpoint,owner);
 // D1 batch is atomic: failure to save the checkpoint prevents replacement of the live workspace.
 const result=await db.batch([savePrevious,replace,trim(db,owner)]);
 if(!result[1].meta.changes)throw new BackupError(changed);
 return {version:version+1,checkpoint};
}
