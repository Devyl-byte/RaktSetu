CREATE TABLE `emergency_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`requested_by_membership_id` text NOT NULL,
	`decided_by_membership_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reason_code` text NOT NULL,
	`justification` text NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	`expires_at` text,
	FOREIGN KEY (`request_id`) REFERENCES `blood_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `emergency_overrides_request_status_idx` ON `emergency_overrides` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `emergency_overrides_org_requested_idx` ON `emergency_overrides` (`organization_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `hospital_rate_limit_policies` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`window_hours` integer DEFAULT 24 NOT NULL,
	`max_requests_in_window` integer DEFAULT 3 NOT NULL,
	`max_concurrent_open_requests` integer DEFAULT 1 NOT NULL,
	`max_donor_contacts_per_request` integer DEFAULT 4 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hospital_rate_limit_policy_updated_idx` ON `hospital_rate_limit_policies` (`updated_at`);--> statement-breakpoint
ALTER TABLE `blood_requests` ADD `outreach_opened_at` text;--> statement-breakpoint
ALTER TABLE `blood_requests` ADD `outreach_expires_at` text;--> statement-breakpoint
ALTER TABLE `blood_requests` ADD `rate_limit_reason` text;