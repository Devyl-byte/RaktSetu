import {
  canConfirmDonor,
  canRecordArrival,
  canRecordOutcome,
  createDemoState,
  getNextAcceptanceOrder,
  isOpenParticipationStage,
  type AppRole,
  type DemoState,
  type DonorStage,
} from "./demo-domain";
import {
  isPermanentDeferralCode,
  isTemporaryDeferralCode,
  type RedCellReinfusionStatus,
} from "./donor-safety";

export type DemoAction =
  | { type: "RESET"; role: AppRole }
  | { type: "VERIFY_DEMO_IDENTITY"; role: "donor" }
  | { type: "ACCEPT_INVITATION"; role: "donor" }
  | { type: "DECLINE_INVITATION"; role: "donor" }
  | {
      type: "TRANSITION_DONOR";
      role: "hospital";
      membershipId: string;
      donorId: string;
      nextStage: DonorStage;
      outcomeReasonCode?: string;
      redCellReinfusionStatus?: RedCellReinfusionStatus;
      queueOverrideReason?: string;
    }
  | {
      type: "CANCEL_REQUEST";
      role: "hospital";
      membershipId: string;
      reason: string;
    };

export type DemoActionResult = {
  state: DemoState;
  notice: string;
  auditDetail: Record<string, string | number | boolean>;
};

export class DemoDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoDomainError";
  }
}

function cloneState(state: DemoState): DemoState {
  return JSON.parse(JSON.stringify(state)) as DemoState;
}

function notificationId() {
  return `note-${crypto.randomUUID()}`;
}

export function applyDemoAction(
  current: DemoState,
  action: DemoAction,
): DemoActionResult {
  if (action.type === "RESET") {
    return {
      state: createDemoState(),
      notice: "Workspace reset to its starting state.",
      auditDetail: { reset: true },
    };
  }

  const state = cloneState(current);
  const request = state.request;
  const currentDonor = request.donors.find(
    (donor) => donor.id === state.currentDonorId,
  );

  if (!currentDonor) {
    throw new DemoDomainError("The current donor record is unavailable.");
  }

  if (action.type === "VERIFY_DEMO_IDENTITY") {
    if (action.role !== "donor") {
      throw new DemoDomainError("Only a donor account can verify its identity.");
    }
    currentDonor.verified = true;
    currentDonor.personId = "RS-P-50742";
    return {
      state,
      notice:
        "Identity verification complete. Donor record RS-P-50742 is connected.",
      auditDetail: {
        donorId: currentDonor.id,
        personId: currentDonor.personId,
        synthetic: true,
      },
    };
  }

  if (action.type === "ACCEPT_INVITATION") {
    if (action.role !== "donor") {
      throw new DemoDomainError("Only a donor account can accept an invitation.");
    }
    if (request.status !== "OPEN_FOR_DONORS") {
      throw new DemoDomainError("This request is no longer open.");
    }
    if (currentDonor.stage !== "INVITED") {
      throw new DemoDomainError("This invitation has already been answered.");
    }
    const order = getNextAcceptanceOrder(request.donors);
    currentDonor.stage =
      order > request.unitsRequired
        ? "WAITLISTED"
        : "ACCEPTED_PENDING_SELECTION";
    currentDonor.acceptedOrder = order;
    currentDonor.responseTime = "Just now";
    return {
      state,
      notice:
        currentDonor.stage === "WAITLISTED"
          ? `Response received. You are number ${order} and currently on standby. Please do not travel unless a slot opens and the hospital confirms you.`
          : `Response received. You are number ${order} in the acceptance queue. Please do not travel yet.`,
      auditDetail: { donorId: currentDonor.id, acceptedOrder: order },
    };
  }

  if (action.type === "DECLINE_INVITATION") {
    if (action.role !== "donor") {
      throw new DemoDomainError("Only a donor account can decline an invitation.");
    }
    if (currentDonor.stage !== "INVITED") {
      throw new DemoDomainError("This invitation has already been answered.");
    }
    currentDonor.stage = "DECLINED";
    return {
      state,
      notice: "Invitation declined. Your availability has not been changed.",
      auditDetail: { donorId: currentDonor.id },
    };
  }

  if (action.type === "CANCEL_REQUEST") {
    if (action.role !== "hospital") {
      throw new DemoDomainError("Only an authorized hospital account can cancel a request.");
    }
    const reason = action.reason.trim();
    if (!reason) {
      throw new DemoDomainError("A cancellation reason is required.");
    }
    if (request.status !== "OPEN_FOR_DONORS") {
      throw new DemoDomainError("Only an open request can be cancelled.");
    }
    request.status = "CANCELLED";
    request.donors = request.donors.map((donor) =>
      isOpenParticipationStage(donor.stage)
        ? { ...donor, stage: "NOT_NEEDED" }
        : donor,
    );
    state.notifications.unshift({
      id: notificationId(),
      title: "Request cancelled by hospital",
      body: "Remaining donors have been told not to travel.",
      time: "Just now",
      tone: "warning",
    });
    return {
      state,
      notice: "Request cancelled. Remaining donors were notified.",
      auditDetail: { reason },
    };
  }

  if (action.type === "TRANSITION_DONOR") {
    if (action.role !== "hospital") {
      throw new DemoDomainError("Only an authorized hospital account can record an outcome.");
    }
    const donor = request.donors.find((item) => item.id === action.donorId);
    if (!donor) {
      throw new DemoDomainError("The selected donor does not exist.");
    }
    let queueOverrideRecorded = false;
    let normalizedQueueOverrideReason = "";

    if (
      action.nextStage === "HOSPITAL_CONFIRMED_TO_TRAVEL" &&
      !canConfirmDonor(donor.stage)
    ) {
      throw new DemoDomainError("This donor cannot be confirmed from the current stage.");
    }
    if (action.nextStage === "HOSPITAL_CONFIRMED_TO_TRAVEL") {
      const activeTravelCount = request.donors.filter((item) =>
        ["HOSPITAL_CONFIRMED_TO_TRAVEL", "ARRIVED_FOR_SCREENING"].includes(
          item.stage,
        ),
      ).length;
      const remainingTravelSlots = Math.max(
        0,
        request.unitsRequired - request.completedUnits - activeTravelCount,
      );
      if (remainingTravelSlots < 1) {
        throw new DemoDomainError(
          "All current travel slots are filled. Keep this donor on standby until a slot reopens.",
        );
      }

      const nextInQueue = request.donors
        .filter((item) => canConfirmDonor(item.stage))
        .sort((a, b) => (a.acceptedOrder ?? 999) - (b.acceptedOrder ?? 999))[0];
      const overridesQueueOrder = Boolean(
        nextInQueue && nextInQueue.id !== donor.id,
      );
      const queueOverrideReason = action.queueOverrideReason?.trim() ?? "";
      if (overridesQueueOrder && queueOverrideReason.length < 10) {
        throw new DemoDomainError(
          "Confirm donors in response order, or record an override reason of at least 10 characters.",
        );
      }
      queueOverrideRecorded = overridesQueueOrder;
      normalizedQueueOverrideReason = queueOverrideReason;
    }
    if (
      action.nextStage === "ARRIVED_FOR_SCREENING" &&
      !canRecordArrival(donor.stage)
    ) {
      throw new DemoDomainError("Arrival can only follow hospital confirmation.");
    }
    if (
      [
        "DONATION_COMPLETED",
        "TEMPORARILY_DEFERRED",
        "PERMANENTLY_DEFERRED",
        "DONATION_INTERRUPTED",
      ].includes(action.nextStage) &&
      !canRecordOutcome(donor.stage)
    ) {
      throw new DemoDomainError("A donation outcome requires a recorded arrival.");
    }
    if (
      action.nextStage === "TEMPORARILY_DEFERRED" &&
      !isTemporaryDeferralCode(action.outcomeReasonCode)
    ) {
      throw new DemoDomainError("Choose a valid temporary-deferral category.");
    }
    if (
      action.nextStage === "PERMANENTLY_DEFERRED" &&
      !isPermanentDeferralCode(action.outcomeReasonCode)
    ) {
      throw new DemoDomainError("Choose a valid permanent-deferral category.");
    }

    const fromStage = donor.stage;
    donor.stage = action.nextStage;

    if (action.nextStage === "HOSPITAL_CONFIRMED_TO_TRAVEL") {
      state.notifications.unshift({
        id: notificationId(),
        title: "Hospital confirmed your visit",
        body: `${request.hospital} has asked ${donor.name} to travel. The route and blood-centre desk details are now available.`,
        time: "Just now",
        tone: "success",
      });
      return {
        state,
        notice: `${donor.name} has been confirmed and may now receive travel instructions.`,
        auditDetail: {
          donorId: donor.id,
          fromStage,
          toStage: action.nextStage,
          acceptedOrder: donor.acceptedOrder ?? 0,
          queueOverrideRecorded,
          ...(queueOverrideRecorded
            ? { queueOverrideReason: normalizedQueueOverrideReason }
            : {}),
        },
      };
    }

    if (action.nextStage === "ARRIVED_FOR_SCREENING") {
      return {
        state,
        notice: `${donor.name} checked in. The hospital now performs all medical screening.`,
        auditDetail: { donorId: donor.id, fromStage, toStage: action.nextStage },
      };
    }

    if (action.nextStage === "TEMPORARILY_DEFERRED") {
      return {
        state,
        notice: `${donor.name} was marked temporarily deferred. The detailed reason remains restricted.`,
        auditDetail: {
          donorId: donor.id,
          fromStage,
          toStage: action.nextStage,
          restrictedReasonRecorded: true,
        },
      };
    }

    if (action.nextStage === "PERMANENTLY_DEFERRED") {
      state.notifications.unshift({
        id: notificationId(),
        title: "Blood-centre follow-up required",
        body:
          "The blood centre recorded that future donation invitations must stop. Contact its confidential counselling desk for details.",
        time: "Just now",
        tone: "warning",
      });
      return {
        state,
        notice: `${donor.name} will no longer receive donation invitations. The confidential reason remains restricted to the blood centre.`,
        auditDetail: {
          donorId: donor.id,
          fromStage,
          toStage: action.nextStage,
          restrictedReasonRecorded: true,
        },
      };
    }

    if (action.nextStage === "DONATION_INTERRUPTED") {
      return {
        state,
        notice: `${donor.name} was recorded as donation interrupted.`,
        auditDetail: { donorId: donor.id, fromStage, toStage: action.nextStage },
      };
    }

    if (action.nextStage === "DONATION_COMPLETED") {
      request.completedUnits = Math.min(
        request.unitsRequired,
        request.completedUnits + 1,
      );
      const fulfilled = request.completedUnits >= request.unitsRequired;
      if (fulfilled) {
        request.status = "REQUEST_FULFILLED";
        request.donors = request.donors.map((item) =>
          item.id !== donor.id && isOpenParticipationStage(item.stage)
            ? { ...item, stage: "NOT_NEEDED" }
            : item,
        );
        state.notifications.unshift({
          id: notificationId(),
          title: "Request fulfilled",
          body: "All remaining invited and standby donors have been notified that they are no longer needed.",
          time: "Just now",
          tone: "success",
        });
      }
      return {
        state,
        notice: fulfilled
          ? "Donation recorded. Request fulfilled and remaining donors notified."
          : "Donation recorded. The network-wide interval is now active for this person.",
        auditDetail: {
          donorId: donor.id,
          fromStage,
          toStage: action.nextStage,
          completedUnits: request.completedUnits,
          fulfilled,
          redCellReinfusionStatus:
            action.redCellReinfusionStatus ?? "NOT_RECORDED",
        },
      };
    }
  }

  throw new DemoDomainError("This action is not supported.");
}

export function isDemoAction(value: unknown): value is DemoAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (
    !["donor", "hospital", "district"].includes(String(action.role)) ||
    typeof action.type !== "string"
  ) {
    return false;
  }
  if (["RESET", "VERIFY_DEMO_IDENTITY", "ACCEPT_INVITATION", "DECLINE_INVITATION"].includes(action.type)) {
    return true;
  }
  if (action.type === "CANCEL_REQUEST") {
    return (
      typeof action.membershipId === "string" &&
      typeof action.reason === "string"
    );
  }
  if (action.type === "TRANSITION_DONOR") {
    return (
      typeof action.membershipId === "string" &&
      typeof action.donorId === "string" &&
      typeof action.nextStage === "string" &&
      (action.outcomeReasonCode === undefined ||
        typeof action.outcomeReasonCode === "string") &&
      (action.redCellReinfusionStatus === undefined ||
        typeof action.redCellReinfusionStatus === "string") &&
      (action.queueOverrideReason === undefined ||
        typeof action.queueOverrideReason === "string")
    );
  }
  return false;
}
