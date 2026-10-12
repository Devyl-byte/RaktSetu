CREATE TABLE `blood_request_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`actor_membership_id` text NOT NULL,
	`action` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `blood_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `blood_request_events_request_created_idx` ON `blood_request_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `blood_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_code` text NOT NULL,
	`organization_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_by_membership_id` text NOT NULL,
	`approved_by_membership_id` text,
	`status` text NOT NULL,
	`component` text NOT NULL,
	`blood_group` text NOT NULL,
	`units_required` integer NOT NULL,
	`urgency` text NOT NULL,
	`case_reference` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blood_requests_code_idx` ON `blood_requests` (`request_code`);--> statement-breakpoint
CREATE INDEX `blood_requests_owner_created_idx` ON `blood_requests` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `blood_requests_org_status_idx` ON `blood_requests` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`account_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`is_demo_persona` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_memberships_user_idx` ON `organization_memberships` (`account_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `org_memberships_user_role_idx` ON `organization_memberships` (`account_user_id`,`organization_id`,`role`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`district` text NOT NULL,
	`registry_code` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
