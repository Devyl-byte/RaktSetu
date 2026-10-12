import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const demoSessions = sqliteTable("demo_sessions", {
  userId: text("user_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => demoSessions.userId, { onDelete: "cascade" }),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    requestId: text("request_id").notNull(),
    detailJson: text("detail_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  district: text("district").notNull(),
  registryCode: text("registry_code").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const organizationMemberships = sqliteTable(
  "organization_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountUserId: text("account_user_id").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    isDemoPersona: integer("is_demo_persona", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("org_memberships_user_idx").on(table.accountUserId),
    uniqueIndex("org_memberships_user_role_idx").on(
      table.accountUserId,
      table.organizationId,
      table.role,
    ),
  ],
);

export const hospitalRateLimitPolicies = sqliteTable(
  "hospital_rate_limit_policies",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    windowHours: integer("window_hours").notNull().default(24),
    maxRequestsInWindow: integer("max_requests_in_window").notNull().default(3),
    maxConcurrentOpenRequests: integer("max_concurrent_open_requests")
      .notNull()
      .default(1),
    maxDonorContactsPerRequest: integer("max_donor_contacts_per_request")
      .notNull()
      .default(4),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("hospital_rate_limit_policy_updated_idx").on(table.updatedAt)],
);

export const bloodRequests = sqliteTable(
  "blood_requests",
  {
    id: text("id").primaryKey(),
    requestCode: text("request_code").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    ownerUserId: text("owner_user_id").notNull(),
    createdByMembershipId: text("created_by_membership_id")
      .notNull()
      .references(() => organizationMemberships.id),
    approvedByMembershipId: text("approved_by_membership_id").references(
      () => organizationMemberships.id,
    ),
    status: text("status").notNull(),
    component: text("component").notNull(),
    collectionMethod: text("collection_method")
      .notNull()
      .default("WHOLE_BLOOD"),
    bloodGroup: text("blood_group").notNull(),
    unitsRequired: integer("units_required").notNull(),
    urgency: text("urgency").notNull(),
    caseReference: text("case_reference").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    approvedAt: text("approved_at"),
    outreachOpenedAt: text("outreach_opened_at"),
    outreachExpiresAt: text("outreach_expires_at"),
    rateLimitReason: text("rate_limit_reason"),
  },
  (table) => [
    uniqueIndex("blood_requests_code_idx").on(table.requestCode),
    index("blood_requests_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
    index("blood_requests_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const emergencyOverrides = sqliteTable(
  "emergency_overrides",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => bloodRequests.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    requestedByMembershipId: text("requested_by_membership_id")
      .notNull()
      .references(() => organizationMemberships.id),
    decidedByMembershipId: text("decided_by_membership_id").references(
      () => organizationMemberships.id,
    ),
    status: text("status").notNull().default("PENDING"),
    reasonCode: text("reason_code").notNull(),
    justification: text("justification").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    decidedAt: text("decided_at"),
    expiresAt: text("expires_at"),
  },
  (table) => [
    index("emergency_overrides_request_status_idx").on(
      table.requestId,
      table.status,
    ),
    index("emergency_overrides_org_requested_idx").on(
      table.organizationId,
      table.requestedAt,
    ),
  ],
);

export const donorSafetyEvents = sqliteTable(
  "donor_safety_events",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    personId: text("person_id").notNull(),
    donorId: text("donor_id").notNull(),
    eventType: text("event_type").notNull(),
    donationType: text("donation_type"),
    occurredAt: text("occurred_at").notNull(),
    redCellReinfusionStatus: text("red_cell_reinfusion_status"),
    reasonCode: text("reason_code"),
    recordedByMembershipId: text("recorded_by_membership_id")
      .notNull()
      .references(() => organizationMemberships.id),
    sourceRequestCode: text("source_request_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("donor_safety_owner_person_occurred_idx").on(
      table.ownerUserId,
      table.personId,
      table.occurredAt,
    ),
    index("donor_safety_owner_donor_idx").on(
      table.ownerUserId,
      table.donorId,
    ),
  ],
);

export const bloodRequestEvents = sqliteTable(
  "blood_request_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => bloodRequests.id, { onDelete: "cascade" }),
    actorMembershipId: text("actor_membership_id")
      .notNull()
      .references(() => organizationMemberships.id),
    action: text("action").notNull(),
    detailJson: text("detail_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("blood_request_events_request_created_idx").on(
      table.requestId,
      table.createdAt,
    ),
  ],
);
