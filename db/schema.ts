import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('quote_workspaces', {owner: text('owner').primaryKey(),payload: text('payload').notNull(),version: integer('version').notNull().default(0)});
export const phoneAccounts=sqliteTable('phone_accounts',{id:text('id').primaryKey(),phone:text('phone').notNull().unique(),pinHash:text('pin_hash').notNull(),salt:text('salt').notNull(),createdAt:integer('created_at').notNull()});
export const phoneSessions=sqliteTable('phone_sessions',{tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>phoneAccounts.id),expiresAt:integer('expires_at').notNull()});
export const workspaceBackups=sqliteTable('quote_backups',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),
 workspaceVersion:integer('workspace_version').notNull(),createdAt:integer('created_at').notNull(),
 reason:text('reason').notNull(),summary:text('summary').notNull(),
},table=>[index('idx_quote_backups_owner_created').on(table.owner,table.createdAt)]);
