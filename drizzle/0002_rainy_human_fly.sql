CREATE TABLE `quote_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`workspace_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`reason` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quote_backups_owner_created` ON `quote_backups` (`owner`,`created_at`);