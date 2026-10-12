export type AppRole = "donor" | "hospital" | "district";

export type CollectionMethod =
  | "WHOLE_BLOOD"
  | "PLATELETPHERESIS"
  | "PLASMAPHERESIS";

export type DonorStage =
  | "INVITED"
  | "ACCEPTED_PENDING_SELECTION"
  | "WAITLISTED"
  | "HOSPITAL_CONFIRMED_TO_TRAVEL"
  | "ARRIVED_FOR_SCREENING"
  | "TEMPORARILY_DEFERRED"
  | "PERMANENTLY_DEFERRED"
  | "DONATION_INTERRUPTED"
  | "DONATION_COMPLETED"
  | "DECLINED"
  | "NOT_NEEDED";

export type RequestStatus =
  | "OPEN_FOR_DONORS"
  | "REQUEST_FULFILLED"
  | "CANCELLED";

export type DemoDonor = {
  id: string;
  name: string;
  initials: string;
  bloodGroup: string;
  distanceKm: number;
  lastDonationLabel: string;
  verified: boolean;
  personId?: string;
  recordedSex: "MALE" | "FEMALE" | "UNSPECIFIED";
  stage: DonorStage;
  acceptedOrder?: number;
  responseTime?: string;
};

export type DemoRequest = {
  id: string;
  hospital: string;
  bloodCentre: string;
  district: string;
  caseReference: string;
  component: string;
  collectionMethod: CollectionMethod;
  bloodGroup: string;
  unitsRequired: number;
  completedUnits: number;
  urgency: "Urgent" | "Routine";
  status: RequestStatus;
  createdAt: string;
  expiresAt: string;
  donors: DemoDonor[];
};

export type DemoNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: "info" | "success" | "warning";
};

export type DemoState = {
  currentDonorId: string;
  request: DemoRequest;
  notifications: DemoNotification[];
};

export const stageLabels: Record<DonorStage, string> = {
  INVITED: "Invited",
  ACCEPTED_PENDING_SELECTION: "Accepted · awaiting selection",
  WAITLISTED: "Standby",
  HOSPITAL_CONFIRMED_TO_TRAVEL: "Confirmed to travel",
  ARRIVED_FOR_SCREENING: "Arrived for screening",
  TEMPORARILY_DEFERRED: "Temporarily deferred",
  PERMANENTLY_DEFERRED: "Donation not permitted",
  DONATION_INTERRUPTED: "Donation interrupted",
  DONATION_COMPLETED: "Donation completed",
  DECLINED: "Declined",
  NOT_NEEDED: "No longer needed",
};

export const stageTone: Record<
  DonorStage,
  "neutral" | "blue" | "amber" | "green" | "red"
> = {
  INVITED: "blue",
  ACCEPTED_PENDING_SELECTION: "amber",
  WAITLISTED: "neutral",
  HOSPITAL_CONFIRMED_TO_TRAVEL: "green",
  ARRIVED_FOR_SCREENING: "blue",
  TEMPORARILY_DEFERRED: "amber",
  PERMANENTLY_DEFERRED: "red",
  DONATION_INTERRUPTED: "amber",
  DONATION_COMPLETED: "green",
  DECLINED: "neutral",
  NOT_NEEDED: "neutral",
};

const initialState: DemoState = {
  currentDonorId: "donor-aarav",
  request: {
    id: "RS-LKO-1048",
    hospital: "Sanjeevani City Hospital",
    bloodCentre: "Transfusion Medicine & Blood Centre",
    district: "Lucknow",
    caseReference: "SCH-ER-2941",
    component: "Platelet concentrate",
    collectionMethod: "PLATELETPHERESIS",
    bloodGroup: "O+",
    unitsRequired: 2,
    completedUnits: 0,
    urgency: "Urgent",
    status: "OPEN_FOR_DONORS",
    createdAt: "Today, 10:18 AM",
    expiresAt: "Today, 4:00 PM",
    donors: [
      {
        id: "donor-ananya",
        name: "Ananya S.",
        initials: "AS",
        bloodGroup: "O+",
        distanceKm: 2.4,
        lastDonationLabel: "Eligible by recorded interval",
        verified: true,
        personId: "RS-P-20481",
        recordedSex: "FEMALE",
        stage: "ACCEPTED_PENDING_SELECTION",
        acceptedOrder: 1,
        responseTime: "10:24 AM",
      },
      {
        id: "donor-ravi",
        name: "Ravi K.",
        initials: "RK",
        bloodGroup: "O+",
        distanceKm: 3.1,
        lastDonationLabel: "Eligible by recorded interval",
        verified: true,
        personId: "RS-P-11907",
        recordedSex: "MALE",
        stage: "ACCEPTED_PENDING_SELECTION",
        acceptedOrder: 2,
        responseTime: "10:27 AM",
      },
      {
        id: "donor-aarav",
        name: "Aarav Mehta",
        initials: "AM",
        bloodGroup: "O+",
        distanceKm: 4.2,
        lastDonationLabel: "First-time donor · history unverified",
        verified: false,
        recordedSex: "MALE",
        stage: "INVITED",
      },
      {
        id: "donor-nida",
        name: "Nida F.",
        initials: "NF",
        bloodGroup: "O+",
        distanceKm: 5.8,
        lastDonationLabel: "Eligible by recorded interval",
        verified: true,
        personId: "RS-P-38012",
        recordedSex: "FEMALE",
        stage: "INVITED",
      },
    ],
  },
  notifications: [
    {
      id: "note-invite",
      title: "New request near you",
      body: "Sanjeevani City Hospital needs O+ platelet donors. Accepting does not mean you should travel yet.",
      time: "10:20 AM",
      tone: "info",
    },
  ],
};

export function createDemoState(): DemoState {
  return JSON.parse(JSON.stringify(initialState)) as DemoState;
}

export function normalizeDemoState(value: DemoState): DemoState {
  const state = JSON.parse(JSON.stringify(value)) as DemoState;
  if (state.request.caseReference.startsWith("DEMO-")) {
    state.request.caseReference = state.request.caseReference.replace(/^DEMO-/, "RS-");
  }
  state.request.collectionMethod ??=
    state.request.component === "Platelet concentrate"
      ? "PLATELETPHERESIS"
      : state.request.component === "Fresh frozen plasma"
        ? "PLASMAPHERESIS"
        : "WHOLE_BLOOD";
  state.request.donors = state.request.donors.map((donor) => ({
    ...donor,
    recordedSex: donor.recordedSex ?? "UNSPECIFIED",
    stage:
      donor.acceptedOrder &&
      (donor.stage === "ACCEPTED_PENDING_SELECTION" ||
        donor.stage === "WAITLISTED")
        ? donor.acceptedOrder <= state.request.unitsRequired
          ? "ACCEPTED_PENDING_SELECTION"
          : "WAITLISTED"
        : donor.stage,
  }));
  return state;
}

export function getNextAcceptanceOrder(donors: DemoDonor[]) {
  return donors.reduce(
    (highest, donor) => Math.max(highest, donor.acceptedOrder ?? 0),
    0,
  ) + 1;
}

export function canConfirmDonor(stage: DonorStage) {
  return stage === "ACCEPTED_PENDING_SELECTION" || stage === "WAITLISTED";
}

export function canRecordArrival(stage: DonorStage) {
  return stage === "HOSPITAL_CONFIRMED_TO_TRAVEL";
}

export function canRecordOutcome(stage: DonorStage) {
  return stage === "ARRIVED_FOR_SCREENING";
}

export function isOpenParticipationStage(stage: DonorStage) {
  return [
    "INVITED",
    "ACCEPTED_PENDING_SELECTION",
    "WAITLISTED",
    "HOSPITAL_CONFIRMED_TO_TRAVEL",
  ].includes(stage);
}
