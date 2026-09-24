CREATE TABLE `phone_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`pin_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_accounts_phone_unique` ON `phone_accounts` (`phone`);--> statement-breakpoint
CREATE TABLE `phone_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `phone_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
