import type { CollectionMethod } from "./demo-domain";

export type HospitalStaffRole =
  | "BLOOD_BANK_OPERATOR"
  | "BLOOD_BANK_APPROVER"
  | "DISTRICT_OVERSIGHT";

export type HospitalMembership = {
  id: string;
  organizationId: string;
  displayName: string;
  role: HospitalStaffRole;
  status: "ACTIVE";
  isDemoPersona: boolean;
};

export type HospitalOrganization = {
  id: string;
  name: string;
  type: "HOSPITAL";
  district: string;
  registryCode: string;
};

export type HospitalRequestStatus =
  | "AWAITING_HOSPITAL_APPROVAL"
  | "AWAITING_DISTRICT_OVERRIDE"
  | "OPEN_FOR_DONORS"
  | "REJECTED"
  | "CANCELLED"
  | "REQUEST_FULFILLED";

export type HospitalRequestRecord = {
  id: string;
  requestCode: string;
  organizationId: string;
  createdByMembershipId: string;
  approvedByMembershipId: string | null;
  status: HospitalRequestStatus;
  component: string;
  collectionMethod: CollectionMethod;
  bloodGroup: string;
  unitsRequired: number;
  urgency: "Urgent" | "Routine";
  caseReference: string;
  createdAt: string;
  approvedAt: string | null;
  outreachOpenedAt: string | null;
  outreachExpiresAt: string | null;
  rateLimitReason: string | null;
};

export type HospitalRateLimitPolicy = {
  windowHours: number;
  maxRequestsInWindow: number;
  maxConcurrentOpenRequests: number;
  maxDonorContactsPerRequest: number;
};

export type HospitalRateLimitUsage = {
  requestsOpenedInWindow: number;
  concurrentOpenRequests: number;
  remainingRequestsInWindow: number;
  windowStartedAt: string;
};

export type EmergencyOverrideStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "REVOKED";

export type EmergencyOverrideReason =
  | "MASS_CASUALTY"
  | "CRITICAL_SHORTAGE"
  | "DISASTER_RESPONSE"
  | "OTHER_OPERATIONAL_EMERGENCY";

export type EmergencyOverrideRecord = {
  id: string;
  requestId: string;
  requestCode: string;
  hospitalName: string;
  bloodGroup: string;
  component: string;
  unitsRequired: number;
  urgency: "Urgent" | "Routine";
  status: EmergencyOverrideStatus;
  reasonCode: EmergencyOverrideReason;
  justification: string;
  requestedByName: string;
  decidedByName: string | null;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
};

export type HospitalWorkspace = {
  organization: HospitalOrganization;
  memberships: HospitalMembership[];
  districtAuthority: {
    name: string;
    district: string;
    memberships: HospitalMembership[];
  };
  requests: HospitalRequestRecord[];
  rateLimit: {
    policy: HospitalRateLimitPolicy;
    usage: HospitalRateLimitUsage;
  };
  emergencyOverrides: EmergencyOverrideRecord[];
  productionBoundary: string;
};

export type CreateBloodRequestInput = {
  component: string;
  collectionMethod: CollectionMethod;
  bloodGroup: string;
  unitsRequired: number;
  urgency: "Urgent" | "Routine";
  caseReference: string;
};

export const bloodGroups = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const bloodComponents = [
  "Whole blood",
  "Packed red cells",
  "Platelet concentrate",
  "Fresh frozen plasma",
] as const;

export const collectionMethods: Array<{
  value: CollectionMethod;
  label: string;
}> = [
  { value: "WHOLE_BLOOD", label: "Whole-blood collection" },
  { value: "PLATELETPHERESIS", label: "Plateletpheresis" },
  { value: "PLASMAPHERESIS", label: "Plasmapheresis" },
];

export const emergencyOverrideReasons: Array<{
  value: EmergencyOverrideReason;
  label: string;
}> = [
  { value: "MASS_CASUALTY", label: "Mass-casualty incident" },
  { value: "CRITICAL_SHORTAGE", label: "Critical component shortage" },
  { value: "DISASTER_RESPONSE", label: "District disaster response" },
  {
    value: "OTHER_OPERATIONAL_EMERGENCY",
    label: "Other verified operational emergency",
  },
];

export function emergencyOverrideReasonLabel(reason: EmergencyOverrideReason) {
  return (
    emergencyOverrideReasons.find((item) => item.value === reason)?.label ??
    reason.replaceAll("_", " ").toLowerCase()
  );
}

export function hospitalRoleLabel(role: HospitalStaffRole) {
  if (role === "BLOOD_BANK_OPERATOR") return "Request maker";
  if (role === "BLOOD_BANK_APPROVER") return "Request checker";
  return "District oversight";
}
