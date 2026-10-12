import type { CollectionMethod } from "./demo-domain";

export const ACTIVE_DONOR_RULESET = {
  id: "IN-BTS-MVP-2026.10",
  label: "India blood-donation interval rules · MVP edition",
  sourceNote:
    "Derived from national blood-centre standards. Hospitals must review and formally adopt every ruleset version before clinical use.",
  finalEligibilityBoundary:
    "This result controls network contact only. A qualified medical officer at the licensed blood centre decides final donation eligibility at every visit.",
} as const;

export type RedCellReinfusionStatus =
  | "COMPLETE"
  | "INCOMPLETE"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export type SafetyEventType =
  | "DONATION_COMPLETED"
  | "TEMPORARY_DEFERRAL"
  | "PERMANENT_DEFERRAL";

export type DonorSafetyEvent = {
  id: string;
  personId: string;
  donorId: string;
  eventType: SafetyEventType;
  donationType: CollectionMethod | null;
  occurredAt: string;
  redCellReinfusionStatus: RedCellReinfusionStatus | null;
  reasonCode: string | null;
  sourceRequestCode: string;
};

export type ContactabilityStatus =
  | "POTENTIALLY_CONTACTABLE"
  | "WAIT_UNTIL"
  | "REQUIRES_MEDICAL_REVIEW"
  | "NOT_CONTACTABLE";

export type DonorSafetyAssessment = {
  status: ContactabilityStatus;
  label: string;
  reason: string;
  nextContactAt: string | null;
  ruleSetId: string;
  ruleSetLabel: string;
  finalEligibilityBoundary: string;
  recordedEventCount: number;
};

export function applySelfReportedDonationHistory(
  assessment: DonorSafetyAssessment | null,
  input: {
    donatedBefore: "yes" | "no" | "";
    lastDonationDate: string;
    lastDonationType: CollectionMethod | "UNKNOWN" | "";
    requestedDonationType: CollectionMethod;
    recordedSex: "MALE" | "FEMALE" | "UNSPECIFIED";
    now?: Date;
  },
) {
  if (!assessment || assessment.recordedEventCount > 0) return assessment;
  if (input.donatedBefore === "no") {
    return {
      ...assessment,
      reason:
        "No previous donation was self-reported. The blood centre will still complete medical screening before donation.",
    };
  }
  if (input.donatedBefore !== "yes" || !input.lastDonationDate) return assessment;

  if (!input.lastDonationType || input.lastDonationType === "UNKNOWN") {
    return {
      ...assessment,
      status: "REQUIRES_MEDICAL_REVIEW" as const,
      label: "Medical review required",
      reason:
        "The previous donation method was not known, so RaktSetu will not calculate a contact interval from the date alone.",
      nextContactAt: null,
    };
  }

  if (input.lastDonationType !== "WHOLE_BLOOD") {
    return {
      ...assessment,
      status: "REQUIRES_MEDICAL_REVIEW" as const,
      label: "Medical review required",
      reason:
        "Self-reported apheresis history needs blood-centre review because procedure frequency and red-cell reinfusion details are not available in the initial declaration.",
      nextContactAt: null,
    };
  }

  const donatedAt = new Date(`${input.lastDonationDate}T00:00:00`);
  if (Number.isNaN(donatedAt.getTime())) return assessment;
  if (input.requestedDonationType === "PLASMAPHERESIS") {
    return {
      ...assessment,
      status: "REQUIRES_MEDICAL_REVIEW" as const,
      label: "Medical review required",
      reason:
        "RaktSetu does not automatically clear plasmapheresis after a self-reported whole-blood donation.",
      nextContactAt: null,
    };
  }

  const intervalDays =
    input.requestedDonationType === "PLATELETPHERESIS"
      ? 28
      : input.recordedSex === "MALE"
        ? 90
        : 120;
  const nextContactAt = addDays(donatedAt.toISOString(), intervalDays);
  const now = input.now ?? new Date();

  if (new Date(nextContactAt).getTime() > now.getTime()) {
    return {
      ...assessment,
      status: "WAIT_UNTIL" as const,
      label: "Self-reported interval active",
      reason:
        "The most recent self-reported whole-blood donation is still inside the applicable contact interval for this request. A connected hospital record can replace this estimate.",
      nextContactAt,
    };
  }

  return {
    ...assessment,
    reason:
      "The conservative interval from the self-reported donation date has passed. Final eligibility remains with the blood centre.",
  };
}

export const temporaryDeferralCodes = [
  "LOW_HAEMOGLOBIN",
  "RECENT_ILLNESS",
  "MEDICATION_REVIEW",
  "OTHER_TEMPORARY",
] as const;

export const permanentDeferralCodes = [
  "CLINICAL_PERMANENT_DEFERRAL",
  "TTI_CONFIRMED",
  "OTHER_PERMANENT",
] as const;

function addMilliseconds(iso: string, milliseconds: number) {
  return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}

function addDays(iso: string, days: number) {
  return addMilliseconds(iso, days * 24 * 60 * 60 * 1000);
}

function laterDate(...values: string[]) {
  return values.reduce((latest, value) =>
    new Date(value).getTime() > new Date(latest).getTime() ? value : latest,
  );
}

function result(
  input: Omit<
    DonorSafetyAssessment,
    | "ruleSetId"
    | "ruleSetLabel"
    | "finalEligibilityBoundary"
    | "recordedEventCount"
  >,
  eventCount: number,
): DonorSafetyAssessment {
  return {
    ...input,
    ruleSetId: ACTIVE_DONOR_RULESET.id,
    ruleSetLabel: ACTIVE_DONOR_RULESET.label,
    finalEligibilityBoundary: ACTIVE_DONOR_RULESET.finalEligibilityBoundary,
    recordedEventCount: eventCount,
  };
}

export function assessDonorContactability(input: {
  events: DonorSafetyEvent[];
  requestedDonationType: CollectionMethod;
  recordedSex: "MALE" | "FEMALE" | "UNSPECIFIED";
  now?: Date;
}): DonorSafetyAssessment {
  const now = input.now ?? new Date();
  const events = [...input.events].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const permanentDeferral = events.find(
    (event) => event.eventType === "PERMANENT_DEFERRAL",
  );
  if (permanentDeferral) {
    return result(
      {
        status: "NOT_CONTACTABLE",
        label: "Not contactable",
        reason:
          "A participating blood centre recorded a permanent deferral. The confidential reason is not shown here.",
        nextContactAt: null,
      },
      events.length,
    );
  }

  const latestDonation = events.find(
    (event) => event.eventType === "DONATION_COMPLETED",
  );
  const latestTemporaryDeferral = events.find(
    (event) => event.eventType === "TEMPORARY_DEFERRAL",
  );
  if (
    latestTemporaryDeferral &&
    (!latestDonation ||
      new Date(latestTemporaryDeferral.occurredAt).getTime() >
        new Date(latestDonation.occurredAt).getTime())
  ) {
    return result(
      {
        status: "REQUIRES_MEDICAL_REVIEW",
        label: "Medical review required",
        reason:
          "A temporary deferral is active in the connected network. Only the blood centre may clear it.",
        nextContactAt: null,
      },
      events.length,
    );
  }

  if (!latestDonation || !latestDonation.donationType) {
    return result(
      {
        status: "POTENTIALLY_CONTACTABLE",
        label: "Potentially contactable",
        reason:
          "No connected-hospital interval block was found. First-visit history and screening are still required.",
        nextContactAt: null,
      },
      events.length,
    );
  }

  let nextContactAt: string | null = null;
  let reason = "The recorded minimum donation interval has not elapsed.";

  if (input.requestedDonationType === "WHOLE_BLOOD") {
    if (latestDonation.donationType === "WHOLE_BLOOD") {
      const days = input.recordedSex === "MALE" ? 90 : 120;
      nextContactAt = addDays(latestDonation.occurredAt, days);
      reason = `Whole-blood interval: ${days} days using the recorded donor sex; unspecified records use the conservative 120-day interval.`;
    } else if (latestDonation.donationType === "PLATELETPHERESIS") {
      if (latestDonation.redCellReinfusionStatus === "COMPLETE") {
        nextContactAt = addDays(latestDonation.occurredAt, 28);
        reason =
          "Whole blood after plateletpheresis requires 28 days when red-cell reinfusion was complete.";
      } else if (latestDonation.redCellReinfusionStatus === "INCOMPLETE") {
        nextContactAt = addDays(latestDonation.occurredAt, 90);
        reason =
          "Whole blood after plateletpheresis requires 90 days when red-cell reinfusion was incomplete.";
      } else {
        return result(
          {
            status: "REQUIRES_MEDICAL_REVIEW",
            label: "Medical review required",
            reason:
              "The red-cell reinfusion record is missing, so RaktSetu will not calculate a whole-blood interval.",
            nextContactAt: null,
          },
          events.length,
        );
      }
    } else {
      return result(
        {
          status: "REQUIRES_MEDICAL_REVIEW",
          label: "Medical review required",
          reason:
            "The ruleset does not automatically clear whole blood after the recorded plasma procedure.",
          nextContactAt: null,
        },
        events.length,
      );
    }
  } else {
    const apheresisEvents = events.filter(
      (event) =>
        event.eventType === "DONATION_COMPLETED" &&
        (event.donationType === "PLATELETPHERESIS" ||
          event.donationType === "PLASMAPHERESIS"),
    );
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const yearAgo = now.getTime() - 365 * 24 * 60 * 60 * 1000;
    const recentWeek = apheresisEvents.filter(
      (event) => new Date(event.occurredAt).getTime() >= sevenDaysAgo,
    );
    const recentYear = apheresisEvents.filter(
      (event) => new Date(event.occurredAt).getTime() >= yearAgo,
    );

    if (recentWeek.length >= 2) {
      nextContactAt = addDays(recentWeek[recentWeek.length - 1].occurredAt, 7);
      reason = "Apheresis is limited to two procedures in a rolling seven-day window.";
    }
    if (recentYear.length >= 24) {
      const annualReset = addDays(recentYear[recentYear.length - 1].occurredAt, 365);
      nextContactAt = nextContactAt
        ? laterDate(nextContactAt, annualReset)
        : annualReset;
      reason = "Apheresis is limited to 24 procedures in a rolling year.";
    }

    if (latestDonation.donationType === "WHOLE_BLOOD") {
      if (input.requestedDonationType !== "PLATELETPHERESIS") {
        return result(
          {
            status: "REQUIRES_MEDICAL_REVIEW",
            label: "Medical review required",
            reason:
              "RaktSetu does not automatically clear plasmapheresis after whole blood in this ruleset.",
            nextContactAt: null,
          },
          events.length,
        );
      }
      const afterWholeBlood = addDays(latestDonation.occurredAt, 28);
      nextContactAt = nextContactAt
        ? laterDate(nextContactAt, afterWholeBlood)
        : afterWholeBlood;
      reason = "Plateletpheresis after whole blood requires a 28-day interval.";
    } else {
      const afterApheresis = addMilliseconds(
        latestDonation.occurredAt,
        48 * 60 * 60 * 1000,
      );
      nextContactAt = nextContactAt
        ? laterDate(nextContactAt, afterApheresis)
        : afterApheresis;
      if (recentWeek.length < 2 && recentYear.length < 24) {
        reason = "At least 48 hours is required between platelet/plasma apheresis procedures.";
      }
    }
  }

  if (nextContactAt && new Date(nextContactAt).getTime() > now.getTime()) {
    return result(
      {
        status: "WAIT_UNTIL",
        label: "Contact paused by recorded interval",
        reason,
        nextContactAt,
      },
      events.length,
    );
  }

  return result(
    {
      status: "POTENTIALLY_CONTACTABLE",
      label: "Potentially contactable",
      reason:
        "The recorded network interval has elapsed. Medical screening is still required at the blood centre.",
      nextContactAt: null,
    },
    events.length,
  );
}

export function isTemporaryDeferralCode(value: unknown): value is string {
  return temporaryDeferralCodes.includes(
    value as (typeof temporaryDeferralCodes)[number],
  );
}

export function isPermanentDeferralCode(value: unknown): value is string {
  return permanentDeferralCodes.includes(
    value as (typeof permanentDeferralCodes)[number],
  );
}
