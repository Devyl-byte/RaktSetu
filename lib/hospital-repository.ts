import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  auditEvents,
  bloodRequestEvents,
  bloodRequests,
  demoSessions,
  emergencyOverrides,
  hospitalRateLimitPolicies,
  organizationMemberships,
  organizations,
} from "@/db/schema";
import { createDemoState, type DemoState } from "./demo-domain";
import { getOrCreateDemoSession, type StoredDemoSession } from "./demo-repository";
import {
  bloodComponents,
  bloodGroups,
  collectionMethods,
  type EmergencyOverrideReason,
  type EmergencyOverrideRecord,
  type CreateBloodRequestInput,
  type HospitalMembership,
  type HospitalRequestRecord,
  type HospitalStaffRole,
  type HospitalWorkspace,
} from "./hospital-domain";

const DEMO_ORGANIZATION = {
  id: "org-sanjeevani-lucknow-demo",
  name: "Sanjeevani City Hospital",
  type: "HOSPITAL" as const,
  district: "Lucknow",
  registryCode: "DEMO-UP-LKO-001",
};

const DEMO_DISTRICT_AUTHORITY = {
  id: "org-lucknow-district-oversight-demo",
  name: "District Magistrate Office — Lucknow",
  type: "DISTRICT_AUTHORITY" as const,
  district: "Lucknow",
  registryCode: "DEMO-UP-LKO-DM-001",
};

const DEFAULT_RATE_LIMIT_POLICY = {
  windowHours: 24,
  maxRequestsInWindow: 3,
  maxConcurrentOpenRequests: 1,
  maxDonorContactsPerRequest: 4,
};

const EMERGENCY_OVERRIDE_DURATION_MS = 4 * 60 * 60 * 1000;

const PRODUCTION_BOUNDARY =
  "Maker and checker are separate authorized roles. An emergency override changes outreach quota only—never donor cooldowns, deferrals, consent, screening, privacy or travel confirmation.";

export class HospitalAccessError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "HospitalAccessError";
    this.status = status;
  }
}

function membershipSeeds(userId: string) {
  return [
    {
      id: `demo-maker:${userId}`,
      organizationId: DEMO_ORGANIZATION.id,
      accountUserId: userId,
      displayName: "Dr. R. Sharma",
      role: "BLOOD_BANK_OPERATOR",
      status: "ACTIVE",
      isDemoPersona: true,
    },
    {
      id: `demo-checker:${userId}`,
      organizationId: DEMO_ORGANIZATION.id,
      accountUserId: userId,
      displayName: "Dr. M. Khan",
      role: "BLOOD_BANK_APPROVER",
      status: "ACTIVE",
      isDemoPersona: true,
    },
  ];
}

function districtMembershipSeeds(userId: string) {
  return [
    {
      id: `demo-district-approver:${userId}`,
      organizationId: DEMO_DISTRICT_AUTHORITY.id,
      accountUserId: userId,
      displayName: "Ananya Verma, IAS",
      role: "DISTRICT_OVERSIGHT",
      status: "ACTIVE",
      isDemoPersona: true,
    },
  ];
}

function mapMembership(row: typeof organizationMemberships.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    displayName: row.displayName,
    role: row.role as HospitalStaffRole,
    status: "ACTIVE" as const,
    isDemoPersona: row.isDemoPersona,
  } satisfies HospitalMembership;
}

function mapRequest(row: typeof bloodRequests.$inferSelect) {
  return {
    id: row.id,
    requestCode: row.requestCode,
    organizationId: row.organizationId,
    createdByMembershipId: row.createdByMembershipId,
    approvedByMembershipId: row.approvedByMembershipId,
    status: row.status as HospitalRequestRecord["status"],
    component: row.component,
    collectionMethod: row.collectionMethod as HospitalRequestRecord["collectionMethod"],
    bloodGroup: row.bloodGroup,
    unitsRequired: row.unitsRequired,
    urgency: row.urgency as HospitalRequestRecord["urgency"],
    caseReference: row.caseReference,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    outreachOpenedAt: row.outreachOpenedAt,
    outreachExpiresAt: row.outreachExpiresAt,
    rateLimitReason: row.rateLimitReason,
  } satisfies HospitalRequestRecord;
}

function mapEmergencyOverride(
  row: typeof emergencyOverrides.$inferSelect,
  request: typeof bloodRequests.$inferSelect,
  membershipNames: Map<string, string>,
) {
  return {
    id: row.id,
    requestId: row.requestId,
    requestCode: request.requestCode,
    hospitalName: DEMO_ORGANIZATION.name,
    bloodGroup: request.bloodGroup,
    component: request.component,
    unitsRequired: request.unitsRequired,
    urgency: request.urgency as "Urgent" | "Routine",
    status: row.status as EmergencyOverrideRecord["status"],
    reasonCode: row.reasonCode as EmergencyOverrideRecord["reasonCode"],
    justification: row.justification,
    requestedByName:
      membershipNames.get(row.requestedByMembershipId) ?? "Authorized checker",
    decidedByName: row.decidedByMembershipId
      ? membershipNames.get(row.decidedByMembershipId) ?? "District approver"
      : null,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    expiresAt: row.expiresAt,
  } satisfies EmergencyOverrideRecord;
}

export async function bootstrapHospitalWorkspace(
  userId: string,
): Promise<HospitalWorkspace> {
  const db = getDb();

  await db
    .insert(organizations)
    .values([DEMO_ORGANIZATION, DEMO_DISTRICT_AUTHORITY])
    .onConflictDoNothing();
  await db
    .insert(organizationMemberships)
    .values([...membershipSeeds(userId), ...districtMembershipSeeds(userId)])
    .onConflictDoNothing();
  await db
    .insert(hospitalRateLimitPolicies)
    .values({
      organizationId: DEMO_ORGANIZATION.id,
      ...DEFAULT_RATE_LIMIT_POLICY,
    })
    .onConflictDoNothing();

  return getHospitalWorkspace(userId);
}

export async function getHospitalWorkspace(
  userId: string,
): Promise<HospitalWorkspace> {
  const db = getDb();
  await expireOutdatedOverrides(userId);
  const [membershipRows, districtMembershipRows, requestRows, overrideRows, rateLimit] = await Promise.all([
    db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.accountUserId, userId),
          eq(organizationMemberships.organizationId, DEMO_ORGANIZATION.id),
          eq(organizationMemberships.status, "ACTIVE"),
        ),
      ),
    db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.accountUserId, userId),
          eq(
            organizationMemberships.organizationId,
            DEMO_DISTRICT_AUTHORITY.id,
          ),
          eq(organizationMemberships.status, "ACTIVE"),
        ),
      ),
    db
      .select()
      .from(bloodRequests)
      .where(eq(bloodRequests.ownerUserId, userId))
      .orderBy(desc(bloodRequests.createdAt), desc(bloodRequests.id))
      .limit(12),
    db
      .select()
      .from(emergencyOverrides)
      .where(
        and(
          eq(emergencyOverrides.organizationId, DEMO_ORGANIZATION.id),
          inArray(
            emergencyOverrides.requestId,
            db
              .select({ id: bloodRequests.id })
              .from(bloodRequests)
              .where(eq(bloodRequests.ownerUserId, userId)),
          ),
        ),
      )
      .orderBy(desc(emergencyOverrides.requestedAt))
      .limit(12),
    getRateLimitSnapshot(userId, DEMO_ORGANIZATION.id),
  ]);

  const membershipNames = new Map(
    [...membershipRows, ...districtMembershipRows].map((membership) => [
      membership.id,
      membership.displayName,
    ]),
  );
  const requestById = new Map(requestRows.map((request) => [request.id, request]));

  return {
    organization: DEMO_ORGANIZATION,
    memberships: membershipRows
      .map(mapMembership)
      .sort((a, b) =>
        a.role === b.role ? 0 : a.role === "BLOOD_BANK_OPERATOR" ? -1 : 1,
      ),
    districtAuthority: {
      name: DEMO_DISTRICT_AUTHORITY.name,
      district: DEMO_DISTRICT_AUTHORITY.district,
      memberships: districtMembershipRows.map(mapMembership),
    },
    requests: requestRows.map(mapRequest),
    rateLimit,
    emergencyOverrides: overrideRows.flatMap((override) => {
      const request = requestById.get(override.requestId);
      return request
        ? [mapEmergencyOverride(override, request, membershipNames)]
        : [];
    }),
    productionBoundary: PRODUCTION_BOUNDARY,
  };
}

export async function requireHospitalMembership(
  userId: string,
  membershipId: string,
  allowedRoles: HospitalStaffRole[],
) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.id, membershipId),
        eq(organizationMemberships.accountUserId, userId),
        eq(organizationMemberships.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HospitalAccessError(
      "This hospital staff membership does not belong to the signed-in account.",
      403,
    );
  }
  if (!allowedRoles.includes(membership.role as HospitalStaffRole)) {
    throw new HospitalAccessError(
      "This staff role is not allowed to perform that hospital action.",
      403,
    );
  }
  return membership;
}

async function getRateLimitPolicy(organizationId: string) {
  const db = getDb();
  const [policy] = await db
    .select()
    .from(hospitalRateLimitPolicies)
    .where(eq(hospitalRateLimitPolicies.organizationId, organizationId))
    .limit(1);

  if (!policy) {
    throw new HospitalAccessError(
      "This hospital does not have an active outreach-rate policy.",
      409,
    );
  }
  return policy;
}

async function getRateLimitSnapshot(userId: string, organizationId: string) {
  const db = getDb();
  const policy = await getRateLimitPolicy(organizationId);
  const windowStartedAt = new Date(
    Date.now() - policy.windowHours * 60 * 60 * 1000,
  ).toISOString();
  const [openedRows, concurrentRows] = await Promise.all([
    db
      .select({ id: bloodRequests.id })
      .from(bloodRequests)
      .where(
        and(
          eq(bloodRequests.ownerUserId, userId),
          eq(bloodRequests.organizationId, organizationId),
          gte(bloodRequests.outreachOpenedAt, windowStartedAt),
        ),
      ),
    db
      .select({ id: bloodRequests.id })
      .from(bloodRequests)
      .where(
        and(
          eq(bloodRequests.ownerUserId, userId),
          eq(bloodRequests.organizationId, organizationId),
          eq(bloodRequests.status, "OPEN_FOR_DONORS"),
        ),
      ),
  ]);

  return {
    policy: {
      windowHours: policy.windowHours,
      maxRequestsInWindow: policy.maxRequestsInWindow,
      maxConcurrentOpenRequests: policy.maxConcurrentOpenRequests,
      maxDonorContactsPerRequest: policy.maxDonorContactsPerRequest,
    },
    usage: {
      requestsOpenedInWindow: openedRows.length,
      concurrentOpenRequests: concurrentRows.length,
      remainingRequestsInWindow: Math.max(
        0,
        policy.maxRequestsInWindow - openedRows.length,
      ),
      windowStartedAt,
    },
  } satisfies HospitalWorkspace["rateLimit"];
}

async function expireOutdatedOverrides(userId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  const ownedRequests = await db
    .select({ id: bloodRequests.id })
    .from(bloodRequests)
    .where(eq(bloodRequests.ownerUserId, userId));
  if (!ownedRequests.length) return;
  const expired = await db
    .select()
    .from(emergencyOverrides)
    .where(
      and(
        eq(emergencyOverrides.organizationId, DEMO_ORGANIZATION.id),
        inArray(
          emergencyOverrides.requestId,
          ownedRequests.map((request) => request.id),
        ),
        eq(emergencyOverrides.status, "APPROVED"),
        sql`${emergencyOverrides.expiresAt} IS NOT NULL AND ${emergencyOverrides.expiresAt} <= ${now}`,
      ),
    );

  for (const override of expired) {
    await db
      .update(emergencyOverrides)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(emergencyOverrides.id, override.id),
          eq(emergencyOverrides.status, "APPROVED"),
        ),
      );
    const [request] = await db
      .update(bloodRequests)
      .set({
        status: "AWAITING_DISTRICT_OVERRIDE",
        outreachExpiresAt: null,
        rateLimitReason: "EMERGENCY_OVERRIDE_EXPIRED",
        updatedAt: now,
      })
      .where(
        and(
          eq(bloodRequests.id, override.requestId),
          eq(bloodRequests.ownerUserId, userId),
          eq(bloodRequests.status, "OPEN_FOR_DONORS"),
        ),
      )
      .returning();
    if (request) {
      await db.insert(auditEvents).values({
        id: crypto.randomUUID(),
        userId,
        actorRole: "system",
        action: "EMERGENCY_OVERRIDE_EXPIRED",
        requestId: request.requestCode,
        detailJson: JSON.stringify({ overrideId: override.id }),
      });
    }
  }
}

function validateRequestInput(value: unknown): CreateBloodRequestInput {
  if (!value || typeof value !== "object") {
    throw new HospitalAccessError("Request details are required.");
  }
  const input = value as Record<string, unknown>;
  const component = String(input.component ?? "").trim();
  const collectionMethod = String(input.collectionMethod ?? "").trim();
  const bloodGroup = String(input.bloodGroup ?? "").trim();
  const urgency = String(input.urgency ?? "").trim();
  const unitsRequired = Number(input.unitsRequired);
  const caseReference = String(input.caseReference ?? "")
    .trim()
    .toUpperCase();

  if (!bloodComponents.includes(component as (typeof bloodComponents)[number])) {
    throw new HospitalAccessError("Choose a supported blood component.");
  }
  if (!collectionMethods.some((method) => method.value === collectionMethod)) {
    throw new HospitalAccessError("Choose a supported collection method.");
  }
  if (!bloodGroups.includes(bloodGroup as (typeof bloodGroups)[number])) {
    throw new HospitalAccessError("Choose a valid blood group.");
  }
  if (!Number.isInteger(unitsRequired) || unitsRequired < 1 || unitsRequired > 10) {
    throw new HospitalAccessError("Units required must be a whole number from 1 to 10.");
  }
  if (urgency !== "Urgent" && urgency !== "Routine") {
    throw new HospitalAccessError("Choose a valid urgency level.");
  }
  if (!/^[A-Z0-9][A-Z0-9/-]{3,31}$/.test(caseReference)) {
    throw new HospitalAccessError(
      "Use a case reference of 4–32 letters, numbers, / or -. Do not enter a patient name.",
    );
  }

  return {
    component,
    collectionMethod: collectionMethod as CreateBloodRequestInput["collectionMethod"],
    bloodGroup,
    unitsRequired,
    urgency,
    caseReference,
  };
}

function newRequestCode() {
  return `RS-LKO-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export async function createBloodRequest(input: {
  userId: string;
  membershipId: string;
  request: unknown;
}) {
  const membership = await requireHospitalMembership(
    input.userId,
    input.membershipId,
    ["BLOOD_BANK_OPERATOR"],
  );
  const request = validateRequestInput(input.request);
  const db = getDb();
  const [pendingRequest] = await db
    .select({ id: bloodRequests.id })
    .from(bloodRequests)
    .where(
      and(
        eq(bloodRequests.ownerUserId, input.userId),
        eq(bloodRequests.status, "AWAITING_HOSPITAL_APPROVAL"),
      ),
    )
    .limit(1);
  if (pendingRequest) {
    throw new HospitalAccessError(
      "Review the pending request before creating another.",
      409,
    );
  }
  const id = crypto.randomUUID();
  const requestCode = newRequestCode();

  await db.insert(bloodRequests).values({
    id,
    requestCode,
    organizationId: membership.organizationId,
    ownerUserId: input.userId,
    createdByMembershipId: membership.id,
    status: "AWAITING_HOSPITAL_APPROVAL",
    ...request,
  });
  await db.insert(bloodRequestEvents).values({
    id: crypto.randomUUID(),
    requestId: id,
    actorMembershipId: membership.id,
    action: "REQUEST_CREATED",
    detailJson: JSON.stringify({ status: "AWAITING_HOSPITAL_APPROVAL" }),
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorRole: "hospital-maker",
    action: "REQUEST_CREATED",
    requestId: requestCode,
    detailJson: JSON.stringify({ membershipId: membership.id }),
  });

  return getHospitalWorkspace(input.userId);
}

function buildActivatedDemoState(
  current: DemoState,
  request: typeof bloodRequests.$inferSelect,
  maxDonorContacts: number,
) {
  const next = createDemoState();
  const previousDonor = current.request.donors.find(
    (donor) => donor.id === current.currentDonorId,
  );
  const nextCurrentDonor = next.request.donors.find(
    (donor) => donor.id === next.currentDonorId,
  );
  if (previousDonor?.verified && nextCurrentDonor) {
    nextCurrentDonor.verified = true;
    nextCurrentDonor.personId = previousDonor.personId;
    nextCurrentDonor.lastDonationLabel = previousDonor.lastDonationLabel;
  }

  next.request.id = request.requestCode;
  next.request.hospital = DEMO_ORGANIZATION.name;
  next.request.district = DEMO_ORGANIZATION.district;
  next.request.caseReference = request.caseReference;
  next.request.component = request.component;
  next.request.collectionMethod = request.collectionMethod as DemoState["request"]["collectionMethod"];
  next.request.bloodGroup = request.bloodGroup;
  next.request.unitsRequired = request.unitsRequired;
  next.request.completedUnits = 0;
  next.request.urgency = request.urgency as "Urgent" | "Routine";
  next.request.status = "OPEN_FOR_DONORS";
  next.request.createdAt = "Just now";
  next.request.expiresAt = request.urgency === "Urgent" ? "In 4 hours" : "Today, 8:00 PM";
  next.request.donors = next.request.donors
    .slice(0, maxDonorContacts)
    .map((donor) => ({
      ...donor,
      bloodGroup: request.bloodGroup,
    }));
  next.notifications = [
    {
      id: `note-${crypto.randomUUID()}`,
      title: "New approved request near you",
      body: `${DEMO_ORGANIZATION.name} needs ${request.bloodGroup} ${request.component.toLowerCase()} donors. Do not travel unless confirmed.`,
      time: "Just now",
      tone: "info",
    },
  ];
  return next;
}

async function activateApprovedRequest(
  userId: string,
  request: typeof bloodRequests.$inferSelect,
  maxDonorContacts: number,
): Promise<StoredDemoSession> {
  const db = getDb();
  const current = await getOrCreateDemoSession(userId);
  const state = buildActivatedDemoState(current.state, request, maxDonorContacts);
  const [updated] = await db
    .update(demoSessions)
    .set({
      stateJson: JSON.stringify(state),
      revision: sql`${demoSessions.revision} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(demoSessions.userId, userId))
    .returning({ revision: demoSessions.revision });

  if (!updated) {
    throw new HospitalAccessError("The approved request could not be activated.", 409);
  }
  return { state, revision: updated.revision };
}

export async function approveBloodRequest(input: {
  userId: string;
  membershipId: string;
  requestId: string;
}) {
  const membership = await requireHospitalMembership(
    input.userId,
    input.membershipId,
    ["BLOOD_BANK_APPROVER"],
  );
  const db = getDb();
  const [request] = await db
    .select()
    .from(bloodRequests)
    .where(
      and(
        eq(bloodRequests.id, input.requestId),
        eq(bloodRequests.ownerUserId, input.userId),
        eq(bloodRequests.organizationId, membership.organizationId),
      ),
    )
    .limit(1);

  if (!request) {
    throw new HospitalAccessError("The request was not found.", 404);
  }
  if (request.createdByMembershipId === membership.id) {
    throw new HospitalAccessError("The maker cannot approve their own request.", 403);
  }
  if (request.status !== "AWAITING_HOSPITAL_APPROVAL") {
    throw new HospitalAccessError("Only a pending request can be approved.");
  }

  const now = new Date().toISOString();
  const rateLimit = await getRateLimitSnapshot(
    input.userId,
    membership.organizationId,
  );
  const rateLimitReason =
    rateLimit.usage.concurrentOpenRequests >=
    rateLimit.policy.maxConcurrentOpenRequests
      ? "CONCURRENT_OUTREACH_LIMIT"
      : rateLimit.usage.requestsOpenedInWindow >=
          rateLimit.policy.maxRequestsInWindow
        ? "REQUEST_WINDOW_EXHAUSTED"
        : null;
  const nextStatus = rateLimitReason
    ? "AWAITING_DISTRICT_OVERRIDE"
    : "OPEN_FOR_DONORS";
  const [approved] = await db
    .update(bloodRequests)
    .set({
      status: nextStatus,
      approvedByMembershipId: membership.id,
      approvedAt: now,
      outreachOpenedAt: rateLimitReason ? null : now,
      rateLimitReason,
      updatedAt: now,
    })
    .where(
      and(
        eq(bloodRequests.id, request.id),
        eq(bloodRequests.status, "AWAITING_HOSPITAL_APPROVAL"),
      ),
    )
    .returning();

  if (!approved) {
    throw new HospitalAccessError("This request was already reviewed.", 409);
  }

  await db.insert(bloodRequestEvents).values({
    id: crypto.randomUUID(),
    requestId: approved.id,
    actorMembershipId: membership.id,
    action: rateLimitReason ? "REQUEST_RATE_LIMITED" : "REQUEST_APPROVED",
    detailJson: JSON.stringify({ status: nextStatus, rateLimitReason }),
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorRole: "hospital-checker",
    action: rateLimitReason ? "REQUEST_RATE_LIMITED" : "REQUEST_APPROVED",
    requestId: approved.requestCode,
    detailJson: JSON.stringify({
      membershipId: membership.id,
      rateLimitReason,
    }),
  });

  const demoSession = rateLimitReason
    ? null
    : await activateApprovedRequest(
        input.userId,
        approved,
        rateLimit.policy.maxDonorContactsPerRequest,
      );
  const workspace = await getHospitalWorkspace(input.userId);
  return {
    workspace,
    demoSession,
    overrideRequired: Boolean(rateLimitReason),
  };
}

function validateEmergencyOverrideRequest(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new HospitalAccessError("Emergency override details are required.");
  }
  const record = value as Record<string, unknown>;
  const reasonCode = String(record.reasonCode ?? "").trim();
  const justification = String(record.justification ?? "").trim();
  const allowedReasons: EmergencyOverrideReason[] = [
    "MASS_CASUALTY",
    "CRITICAL_SHORTAGE",
    "DISASTER_RESPONSE",
    "OTHER_OPERATIONAL_EMERGENCY",
  ];
  if (!allowedReasons.includes(reasonCode as EmergencyOverrideReason)) {
    throw new HospitalAccessError("Choose a valid emergency reason category.");
  }
  if (justification.length < 20 || justification.length > 500) {
    throw new HospitalAccessError(
      "Provide a 20–500 character operational justification without patient or donor identity.",
    );
  }
  if (
    /\b\d{10,12}\b/.test(justification) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(justification)
  ) {
    throw new HospitalAccessError(
      "Remove phone numbers, Aadhaar-like numbers and email addresses from the operational justification.",
    );
  }
  return {
    reasonCode: reasonCode as EmergencyOverrideReason,
    justification,
  };
}

export async function requestEmergencyOverride(input: {
  userId: string;
  membershipId: string;
  requestId: string;
  override: unknown;
}) {
  const membership = await requireHospitalMembership(
    input.userId,
    input.membershipId,
    ["BLOOD_BANK_APPROVER"],
  );
  const details = validateEmergencyOverrideRequest(input.override);
  const db = getDb();
  const [request] = await db
    .select()
    .from(bloodRequests)
    .where(
      and(
        eq(bloodRequests.id, input.requestId),
        eq(bloodRequests.ownerUserId, input.userId),
        eq(bloodRequests.organizationId, membership.organizationId),
      ),
    )
    .limit(1);
  if (!request) {
    throw new HospitalAccessError("The rate-limited request was not found.", 404);
  }
  if (request.status !== "AWAITING_DISTRICT_OVERRIDE") {
    throw new HospitalAccessError(
      "Only a checker-approved, rate-limited request can seek an emergency override.",
    );
  }
  const [pendingOverride] = await db
    .select({ id: emergencyOverrides.id })
    .from(emergencyOverrides)
    .where(
      and(
        eq(emergencyOverrides.requestId, request.id),
        eq(emergencyOverrides.status, "PENDING"),
      ),
    )
    .limit(1);
  if (pendingOverride) {
    throw new HospitalAccessError(
      "This request already has an override awaiting district review.",
      409,
    );
  }

  const overrideId = crypto.randomUUID();
  await db.insert(emergencyOverrides).values({
    id: overrideId,
    requestId: request.id,
    organizationId: request.organizationId,
    requestedByMembershipId: membership.id,
    reasonCode: details.reasonCode,
    justification: details.justification,
    status: "PENDING",
  });
  await db.insert(bloodRequestEvents).values({
    id: crypto.randomUUID(),
    requestId: request.id,
    actorMembershipId: membership.id,
    action: "EMERGENCY_OVERRIDE_REQUESTED",
    detailJson: JSON.stringify({
      overrideId,
      reasonCode: details.reasonCode,
      rateLimitReason: request.rateLimitReason,
    }),
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorRole: "hospital-checker",
    action: "EMERGENCY_OVERRIDE_REQUESTED",
    requestId: request.requestCode,
    detailJson: JSON.stringify({
      membershipId: membership.id,
      overrideId,
      reasonCode: details.reasonCode,
    }),
  });

  return getHospitalWorkspace(input.userId);
}

export async function decideEmergencyOverride(input: {
  userId: string;
  membershipId: string;
  overrideId: string;
  decision: "APPROVE" | "REJECT";
}) {
  const membership = await requireHospitalMembership(
    input.userId,
    input.membershipId,
    ["DISTRICT_OVERSIGHT"],
  );
  if (membership.organizationId !== DEMO_DISTRICT_AUTHORITY.id) {
    throw new HospitalAccessError(
      "This district membership cannot decide Lucknow emergency overrides.",
      403,
    );
  }
  const db = getDb();
  const [override] = await db
    .select()
    .from(emergencyOverrides)
    .where(eq(emergencyOverrides.id, input.overrideId))
    .limit(1);
  if (!override) {
    throw new HospitalAccessError("The emergency override was not found.", 404);
  }
  if (override.status !== "PENDING") {
    throw new HospitalAccessError(
      "This emergency override has already been decided.",
      409,
    );
  }
  const [request] = await db
    .select()
    .from(bloodRequests)
    .where(
      and(
        eq(bloodRequests.id, override.requestId),
        eq(bloodRequests.ownerUserId, input.userId),
      ),
    )
    .limit(1);
  if (!request || request.status !== "AWAITING_DISTRICT_OVERRIDE") {
    throw new HospitalAccessError(
      "The linked request is no longer awaiting a district decision.",
      409,
    );
  }

  const now = new Date();
  const decidedAt = now.toISOString();
  const approved = input.decision === "APPROVE";
  const expiresAt = approved
    ? new Date(now.getTime() + EMERGENCY_OVERRIDE_DURATION_MS).toISOString()
    : null;
  const [decided] = await db
    .update(emergencyOverrides)
    .set({
      status: approved ? "APPROVED" : "REJECTED",
      decidedByMembershipId: membership.id,
      decidedAt,
      expiresAt,
    })
    .where(
      and(
        eq(emergencyOverrides.id, override.id),
        eq(emergencyOverrides.status, "PENDING"),
      ),
    )
    .returning();
  if (!decided) {
    throw new HospitalAccessError(
      "This emergency override was decided by another session.",
      409,
    );
  }

  let openedRequest: typeof bloodRequests.$inferSelect | null = null;
  if (approved) {
    [openedRequest] = await db
      .update(bloodRequests)
      .set({
        status: "OPEN_FOR_DONORS",
        outreachOpenedAt: decidedAt,
        outreachExpiresAt: expiresAt,
        updatedAt: decidedAt,
      })
      .where(
        and(
          eq(bloodRequests.id, request.id),
          eq(bloodRequests.status, "AWAITING_DISTRICT_OVERRIDE"),
        ),
      )
      .returning();
    if (!openedRequest) {
      throw new HospitalAccessError(
        "The request changed before the override could be applied.",
        409,
      );
    }
  }

  await db.insert(bloodRequestEvents).values({
    id: crypto.randomUUID(),
    requestId: request.id,
    actorMembershipId: membership.id,
    action: approved ? "EMERGENCY_OVERRIDE_APPROVED" : "EMERGENCY_OVERRIDE_REJECTED",
    detailJson: JSON.stringify({
      overrideId: override.id,
      expiresAt,
      approverName: membership.displayName,
    }),
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorRole: "district",
    action: approved ? "EMERGENCY_OVERRIDE_APPROVED" : "EMERGENCY_OVERRIDE_REJECTED",
    requestId: request.requestCode,
    detailJson: JSON.stringify({
      membershipId: membership.id,
      overrideId: override.id,
      expiresAt,
    }),
  });

  const rateLimit = await getRateLimitPolicy(request.organizationId);
  const demoSession = openedRequest
    ? await activateApprovedRequest(
        input.userId,
        openedRequest,
        rateLimit.maxDonorContactsPerRequest,
      )
    : null;
  const workspace = await getHospitalWorkspace(input.userId);
  return { workspace, demoSession };
}

export async function assertRequestOutreachAvailable(input: {
  userId: string;
  requestCode: string;
}) {
  await expireOutdatedOverrides(input.userId);
  const db = getDb();
  const [request] = await db
    .select({
      status: bloodRequests.status,
      outreachExpiresAt: bloodRequests.outreachExpiresAt,
    })
    .from(bloodRequests)
    .where(
      and(
        eq(bloodRequests.ownerUserId, input.userId),
        eq(bloodRequests.requestCode, input.requestCode),
      ),
    )
    .limit(1);
  if (!request) return;
  if (request.status !== "OPEN_FOR_DONORS") {
    throw new HospitalAccessError(
      "Donor outreach is paused for this request. A valid hospital approval and, when rate-limited, a current district override are required.",
      409,
    );
  }
  if (
    request.outreachExpiresAt &&
    new Date(request.outreachExpiresAt).getTime() <= Date.now()
  ) {
    throw new HospitalAccessError(
      "The four-hour emergency outreach override has expired.",
      409,
    );
  }
}

export async function syncWorkflowRequestStatus(input: {
  userId: string;
  requestCode: string;
  status: "CANCELLED" | "REQUEST_FULFILLED";
}) {
  const db = getDb();
  await db
    .update(bloodRequests)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(bloodRequests.ownerUserId, input.userId),
        eq(bloodRequests.requestCode, input.requestCode),
        eq(bloodRequests.status, "OPEN_FOR_DONORS"),
      ),
    );
}
