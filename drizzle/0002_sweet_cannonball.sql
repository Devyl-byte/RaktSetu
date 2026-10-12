CREATE TABLE `donor_safety_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`person_id` text NOT NULL,
	`donor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`donation_type` text,
	`occurred_at` text NOT NULL,
	`red_cell_reinfusion_status` text,
	`reason_code` text,
	`recorded_by_membership_id` text NOT NULL,
	`source_request_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recorded_by_membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `donor_safety_owner_person_occurred_idx` ON `donor_safety_events` (`owner_user_id`,`person_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `donor_safety_owner_donor_idx` ON `donor_safety_events` (`owner_user_id`,`donor_id`);--> statement-breakpoint
ALTER TABLE `blood_requests` ADD `collection_method` text DEFAULT 'WHOLE_BLOOD' NOT NULL;