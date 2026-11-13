CREATE TABLE IF NOT EXISTS `form_prefills` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`field_key` text NOT NULL,
	`param_name` text NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `form_prefills_form_id_idx` ON `form_prefills` (`form_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `form_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`source_field` text NOT NULL,
	`operator` text DEFAULT 'equals' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`action` text DEFAULT 'hide' NOT NULL,
	`target_field` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `form_rules_form_id_idx` ON `form_rules` (`form_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `form_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`name` text NOT NULL,
	`trigger_event` text DEFAULT 'submission.created' NOT NULL,
	`trigger_conditions` text DEFAULT '{}' NOT NULL,
	`actions_definition` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `form_workflows_form_trigger_idx` ON `form_workflows` (`form_id`,`trigger_event`,`is_active`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `otp_codes_form_id_idx` ON `otp_codes` (`form_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `otp_codes_email_idx` ON `otp_codes` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `partial_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`completed_field_keys` text DEFAULT '[]' NOT NULL,
	`last_step` integer DEFAULT 0 NOT NULL,
	`user_agent` text,
	`referer` text,
	`ip_hash` text,
	`converted_submission_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `partial_submissions_form_id_idx` ON `partial_submissions` (`form_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `partial_submissions_token_hash_idx` ON `partial_submissions` (`token_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `partial_submissions_expires_at_idx` ON `partial_submissions` (`expires_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `submission_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`author` text DEFAULT 'owner' NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `submission_notes_submission_id_idx` ON `submission_notes` (`submission_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `submission_notes_created_at_idx` ON `submission_notes` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`url` text NOT NULL,
	`event` text DEFAULT 'form.submitted' NOT NULL,
	`status_code` integer,
	`latency_ms` integer,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`next_retry_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `webhook_logs_form_id_idx` ON `webhook_logs` (`form_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `webhook_logs_submission_id_idx` ON `webhook_logs` (`submission_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `webhook_logs_created_at_idx` ON `webhook_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `webhook_logs_retry_idx` ON `webhook_logs` (`status`,`next_retry_at`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `altcha_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `autoresponder_subject` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `autoresponder_body` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `spam_blocklist` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `retention_days` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `forms` ADD `email_verification_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_host` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_port` integer;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_user` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_pass` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `smtp_from` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `gas_url` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `telegram_bot_token` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `ntfy_topic` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `otp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `submission_limit` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `forms` ADD `email_subject_template` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `autoresponder_reply_to` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `max_attachment_size_mb` integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE `forms` ADD `allowed_file_extensions` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `forms` ADD `display_mode` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `tags` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `rate_limit_per_minute` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `password_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `slack_webhook_url` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `discord_webhook_url` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `capture_utm` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `encrypt_payloads` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `partial_submissions_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `close_at` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip_hash` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `workflow_status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `duplicate_of` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `fingerprint` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `submissions_form_created_idx` ON `submissions` (`form_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_host` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_port` integer DEFAULT 587;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_user` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_pass` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_smtp_from` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_gas_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_gas_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_webhook_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_webhook_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `global_notify_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_on_login` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_on_submission` integer DEFAULT true NOT NULL;
