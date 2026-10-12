import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { donorSafetyEvents } from "@/db/schema";
import type { CollectionMethod, DemoDonor, DonorStage } from "./demo-domain";
import {
  assessDonorContactability,
  isPermanentDeferralCode,
  isTemporaryDeferralCode,
  type DonorSafetyEvent,
  type RedCellReinfusionStatus,
} from "./donor-safety";
import { HospitalAccessError } from "./hospital-repository";

function personKey(donor: DemoDonor) {
  return donor.personId ?? `demo-person:${donor.id}`;
}

function mapEvent(row: typeof donorSafetyEvents.$inferSelect): DonorSafetyEvent {
  return {
    id: row.id,
    personId: row.personId,
    donorId: row.donorId,
    eventType: row.eventType as DonorSafetyEvent["eventType"],
    donationType: row.donationType as CollectionMethod | null,
    occurredAt: row.occurredAt,
    redCellReinfusionStatus:
      row.redCellReinfusionStatus as RedCellReinfusionStatus | null,
    reasonCode: row.reasonCode,
    sourceRequestCode: row.sourceRequestCode,
  };
}

export async function getDonorSafetyAssessment(input: {
  userId: string;
  donor: DemoDonor;
  requestedDonationType: CollectionMethod;
}) {
  const db = getDb();
  const events = await db
    .select()
    .from(donorSafetyEvents)
    .where(
      and(
        eq(donorSafetyEvents.ownerUserId, input.userId),
        eq(donorSafetyEvents.personId, personKey(input.donor)),
      ),
    )
    .orderBy(desc(donorSafetyEvents.occurredAt), desc(donorSafetyEvents.id));

  const assessment = assessDonorContactability({
    events: events.map(mapEvent),
    requestedDonationType: input.requestedDonationType,
    recordedSex: input.donor.recordedSex,
  });

  return {
    assessment,
    publicHistory: events.slice(0, 8).map((event) => ({
      id: event.id,
      eventType: event.eventType,
      donationType: event.donationType,
      occurredAt: event.occurredAt,
      sourceRequestCode: event.sourceRequestCode,
    })),
  };
}

export async function recordDonorSafetyOutcome(input: {
  userId: string;
  membershipId: string;
  donor: DemoDonor;
  nextStage: DonorStage;
  donationType: CollectionMethod;
  sourceRequestCode: string;
  outcomeReasonCode?: string;
  redCellReinfusionStatus?: RedCellReinfusionStatus;
}) {
  const relevantStages: DonorStage[] = [
    "DONATION_COMPLETED",
    "TEMPORARILY_DEFERRED",
    "PERMANENTLY_DEFERRED",
  ];
  if (!relevantStages.includes(input.nextStage)) return;

  let eventType: DonorSafetyEvent["eventType"];
  let reasonCode: string | null = null;
  if (input.nextStage === "DONATION_COMPLETED") {
    eventType = "DONATION_COMPLETED";
  } else if (input.nextStage === "TEMPORARILY_DEFERRED") {
    if (!isTemporaryDeferralCode(input.outcomeReasonCode)) {
      throw new HospitalAccessError(
        "Choose a valid temporary-deferral category.",
      );
    }
    eventType = "TEMPORARY_DEFERRAL";
    reasonCode = input.outcomeReasonCode;
  } else {
    if (!isPermanentDeferralCode(input.outcomeReasonCode)) {
      throw new HospitalAccessError(
        "Choose a valid permanent-deferral category.",
      );
    }
    eventType = "PERMANENT_DEFERRAL";
    reasonCode = input.outcomeReasonCode;
  }

  const reinfusionStatus =
    eventType === "DONATION_COMPLETED" &&
    input.donationType === "PLATELETPHERESIS"
      ? input.redCellReinfusionStatus ?? "UNKNOWN"
      : "NOT_APPLICABLE";

  const db = getDb();
  await db.insert(donorSafetyEvents).values({
    id: crypto.randomUUID(),
    ownerUserId: input.userId,
    personId: personKey(input.donor),
    donorId: input.donor.id,
    eventType,
    donationType: eventType === "DONATION_COMPLETED" ? input.donationType : null,
    occurredAt: new Date().toISOString(),
    redCellReinfusionStatus: reinfusionStatus,
    reasonCode,
    recordedByMembershipId: input.membershipId,
    sourceRequestCode: input.sourceRequestCode,
  });
}
