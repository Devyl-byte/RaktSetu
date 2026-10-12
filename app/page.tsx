"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Droplets,
  Fingerprint,
  HeartHandshake,
  Hospital,
  Info,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPin,
  PhoneCall,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  AccessCard,
  AccessSplash,
  emptyProfile,
  normalizeAccountProfile,
  ProfileForm,
  PublicLanding,
  type AccessScreen,
  type AccountProfile,
  type AuthDraft,
  type AuthMode,
} from "@/components/raktsetu-access";

import {
  canConfirmDonor,
  canRecordArrival,
  canRecordOutcome,
  createDemoState,
  stageLabels,
  stageTone,
  type AppRole,
  type DemoDonor,
  type DemoState,
  type DonorStage,
} from "@/lib/demo-domain";
import { applyDemoAction, type DemoAction } from "@/lib/demo-engine";
import {
  bloodComponents,
  bloodGroups,
  collectionMethods,
  emergencyOverrideReasonLabel,
  emergencyOverrideReasons,
  hospitalRoleLabel,
  type CreateBloodRequestInput,
  type EmergencyOverrideReason,
  type HospitalMembership,
  type HospitalRequestRecord,
  type HospitalWorkspace,
} from "@/lib/hospital-domain";
import {
  applySelfReportedDonationHistory,
  type DonorSafetyAssessment,
} from "@/lib/donor-safety";
import {
  focusFirstInvalidField,
  validationClass,
} from "@/lib/form-validation";

const BloodFlowCanvas = lazy(() =>
  import("@/app/blood-flow-canvas").then((module) => ({
    default: module.BloodFlowCanvas,
  })),
);

const STORAGE_KEY = "raktsetu-mvp-demo-v1";
const ACCOUNTS_KEY = "raktsetu-accounts-v1";
const ACTIVE_ACCOUNT_KEY = "raktsetu-active-account-v1";

function RequiredFieldText({ children }: { children: string }) {
  return <span className="field-label">{children} <span className="required-mark" aria-hidden="true">*</span></span>;
}

const screenPaths: Record<AccessScreen, string> = {
  boot: "/",
  landing: "/",
  "sign-in": "/sign-in",
  register: "/register",
  "verify-otp": "/verify-otp",
  onboarding: "/onboarding",
  staff: "/staff",
  workspace: "/donor",
  account: "/account",
};

const pathScreens: Record<string, AccessScreen> = Object.fromEntries(
  Object.entries(screenPaths).map(([screen, path]) => [path, screen]),
) as Record<string, AccessScreen>;

type SyncMode = "connecting" | "server" | "local";

type AuditEvent = {
  id: string;
  actorRole: string;
  action: string;
  requestId: string;
  detailJson: string;
  createdAt: string;
};

const initialRequestDraft: CreateBloodRequestInput = {
  component: "Packed red cells",
  collectionMethod: "WHOLE_BLOOD",
  bloodGroup: "O+",
  unitsRequired: 2,
  urgency: "Urgent",
  caseReference: "RS-ER-3001",
};

const roleHeadings: Record<
  AppRole,
  { eyebrow: string; title: string; description: string }
> = {
  donor: {
    eyebrow: "Donor experience",
    title: "Help when it’s needed—without unnecessary travel.",
    description:
      "Respond from home. The hospital will tell you clearly if and when you should travel.",
  },
  hospital: {
    eyebrow: "Blood centre command view",
    title: "One request. A controlled response.",
    description:
      "Coordinate donor responses, confirm travel and close the loop from one auditable queue.",
  },
  district: {
    eyebrow: "District emergency oversight",
    title: "See the system—not private donor data.",
    description:
      "Aggregate operational visibility for the district nodal officer, with clinical decisions left to hospitals.",
  },
};

function formatStage(stage: DonorStage) {
  return stageLabels[stage];
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    SESSION_CREATED: "Workspace initialized",
    RESET: "Workspace reset",
    VERIFY_DEMO_IDENTITY: "Identity verification completed",
    ACCEPT_INVITATION: "Invitation accepted",
    DECLINE_INVITATION: "Invitation declined",
    TRANSITION_DONOR: "Donor stage changed",
    CANCEL_REQUEST: "Request cancelled",
    REQUEST_CREATED: "Request submitted for approval",
    REQUEST_APPROVED: "Request approved and opened",
    REQUEST_RATE_LIMITED: "Request approved but outreach rate-limited",
    EMERGENCY_OVERRIDE_REQUESTED: "Emergency override requested",
    EMERGENCY_OVERRIDE_APPROVED: "Emergency override approved",
    EMERGENCY_OVERRIDE_REJECTED: "Emergency override rejected",
    EMERGENCY_OVERRIDE_EXPIRED: "Emergency override expired",
  };
  return labels[action] ?? action.toLowerCase().replaceAll("_", " ");
}

function StatusPill({ stage }: { stage: DonorStage }) {
  return (
    <span className={`status-pill status-${stageTone[stage]}`}>
      <span className="status-dot" />
      {formatStage(stage)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "ink",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "red" | "green" | "blue";
}) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-icon">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function readAccounts() {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(ACCOUNTS_KEY) ?? "[]",
    ) as Partial<AccountProfile>[];
    return stored.map(normalizeAccountProfile);
  } catch {
    window.localStorage.removeItem(ACCOUNTS_KEY);
    return [];
  }
}

function persistAccount(profile: AccountProfile) {
  const accounts = readAccounts();
  const next = accounts.some((item) => item.id === profile.id)
    ? accounts.map((item) => (item.id === profile.id ? profile : item))
    : [...accounts, profile];
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, profile.id);
}

function createAccountId() {
  return `RS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function screenFromPath(pathname: string) {
  if (pathname === "/hospital" || pathname === "/district" || pathname === "/donor") {
    return "workspace" as const;
  }
  return pathScreens[pathname] ?? "landing";
}

export default function Home() {
  const [role, setRole] = useState<AppRole>("donor");
  const [accessScreen, setAccessScreen] = useState<AccessScreen>("boot");
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [authDraft, setAuthDraft] = useState<AuthDraft>({
    mode: "sign-in",
    phone: "",
    staffRole: "hospital",
    organization: "",
    staffId: "",
  });
  const [authError, setAuthError] = useState("");
  const [demo, setDemo] = useState<DemoState>(() => createDemoState());
  const [hydrated, setHydrated] = useState(false);
  const [revision, setRevision] = useState(0);
  const [syncMode, setSyncMode] = useState<SyncMode>("connecting");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [safetyAssessment, setSafetyAssessment] =
    useState<DonorSafetyAssessment | null>(null);
  const [hospitalWorkspace, setHospitalWorkspace] =
    useState<HospitalWorkspace | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [requestDraft, setRequestDraft] =
    useState<CreateBloodRequestInput>(initialRequestDraft);
  const [requestBusy, setRequestBusy] = useState(false);
  const [notice, setNotice] = useState("Your workspace is ready.");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;

    queueMicrotask(() => {
      if (!mounted) return;
      const accounts = readAccounts();
      const activeId = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
      const active = accounts.find((item) => item.id === activeId) ?? null;
      const requested = screenFromPath(window.location.pathname);
      const protectedScreen = requested === "workspace" || requested === "account";

      if (active) {
        setAccount(active);
        setRole(active.role);
        if (["landing", "sign-in", "register", "staff"].includes(requested)) {
          setAccessScreen("workspace");
          window.history.replaceState({}, "", active.role === "donor" ? "/donor" : `/${active.role}`);
        } else {
          setAccessScreen(requested);
        }
      } else if (protectedScreen) {
        setAccessScreen("sign-in");
        window.history.replaceState({}, "", "/sign-in");
      } else {
        setAccessScreen(requested);
        if (requested === "register") setAuthDraft((current) => ({ ...current, mode: "register" }));
        if (requested === "staff") setAuthDraft((current) => ({ ...current, mode: "staff" }));
      }
    });

    function handlePopState() {
      const next = screenFromPath(window.location.pathname);
      if ((next === "workspace" || next === "account") && !window.localStorage.getItem(ACTIVE_ACCOUNT_KEY)) {
        setAccessScreen("sign-in");
        return;
      }
      setAccessScreen(next);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      mounted = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/demo", { cache: "no-store" });
        if (!response.ok) throw new Error("Server session unavailable");
        const payload = (await response.json()) as {
          state: DemoState;
          revision: number;
        };
        if (!active) return;
        setDemo(payload.state);
        setRevision(payload.revision);
        setSyncMode("server");
        setNotice(
          "Your latest request activity is synchronized.",
        );
        void loadAudit();
        void loadHospitalWorkspace();
        void loadSafetyAssessment();
      } catch {
        if (!active) return;
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            setDemo(JSON.parse(saved) as DemoState);
          } catch {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
        setSyncMode("local");
        setNotice(
          "You are temporarily offline. Changes will remain on this device.",
        );
      } finally {
        if (active) setHydrated(true);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated && syncMode === "local") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
    }
  }, [demo, hydrated, syncMode]);

  function navigate(next: AccessScreen, replace = false, activeAccount = account) {
    let path = screenPaths[next];
    if (next === "workspace" && activeAccount) {
      path = activeAccount.role === "donor" ? "/donor" : `/${activeAccount.role}`;
    }
    window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setAccessScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startAccess(mode: AuthMode) {
    setAuthError("");
    setAuthDraft({
      mode,
      phone: "",
      staffRole: "hospital",
      organization: "",
      staffId: "",
    });
    navigate(mode === "staff" ? "staff" : mode === "register" ? "register" : "sign-in");
  }

  function requestOtp() {
    setAuthError("");
    if (authDraft.phone.trim().length < 6) {
      setAuthError("Enter a valid mobile number to continue.");
      return;
    }
    if (authDraft.mode === "staff" && (!authDraft.organization.trim() || !authDraft.staffId.trim())) {
      setAuthError("Enter your institution and staff ID to continue.");
      return;
    }
    navigate("verify-otp");
  }

  function verifyOtp(otp: string) {
    setAuthError("");
    if (!otp.trim()) {
      setAuthError("Enter the OTP shown on your device.");
      return;
    }

    if (authDraft.mode === "staff") {
      const staffRole: AppRole = authDraft.staffRole;
      const profile: AccountProfile = {
        ...emptyProfile(authDraft.phone),
        id: createAccountId(),
        role: staffRole,
        fullName: staffRole === "hospital" ? "Dr. R. Sharma" : "District Nodal Officer",
        bloodGroup: "Not applicable",
        city: "Lucknow",
        district: "Lucknow",
        pincode: "226001",
        organization: authDraft.organization,
        staffId: authDraft.staffId,
      };
      persistAccount(profile);
      setAccount(profile);
      setRole(profile.role);
      setNotice("Institutional workspace opened.");
      navigate("workspace", true, profile);
      return;
    }

    const existing = readAccounts().find(
      (item) => item.role === "donor" && item.phone === authDraft.phone,
    );
    if (authDraft.mode === "sign-in" && existing) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, existing.id);
      setAccount(existing);
      setRole("donor");
      setNotice(`Welcome back, ${existing.fullName.split(" ")[0] || "donor"}.`);
      navigate("workspace", true, existing);
      return;
    }

    setAuthDraft((current) => ({ ...current, mode: "register" }));
    navigate("onboarding", true);
  }

  function saveNewProfile(profile: AccountProfile) {
    const saved: AccountProfile = {
      ...profile,
      id: profile.id || createAccountId(),
      role: "donor",
      phone: authDraft.phone,
    };
    persistAccount(saved);
    setAccount(saved);
    setRole("donor");
    setNotice(`Welcome to RaktSetu, ${saved.fullName.split(" ")[0]}. Your donor account is ready.`);
    navigate("workspace", true, saved);
  }

  function updateProfile(profile: AccountProfile) {
    persistAccount(profile);
    setAccount(profile);
    setRole(profile.role);
    setNotice("Your account changes have been saved.");
    navigate("workspace", true, profile);
  }

  function deleteAccount() {
    if (!account) return;
    const confirmed = window.confirm(
      "Delete this locally stored RaktSetu account? This cannot be undone in this preview.",
    );
    if (!confirmed) return;
    const remaining = readAccounts().filter((item) => item.id !== account.id);
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));
    signOut();
  }

  function signOut() {
    window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    setAccount(null);
    setRole("donor");
    setNotice("Your workspace is ready.");
    navigate("landing");
  }

  const donorFacingDemo = useMemo(() => {
    if (!account || account.role !== "donor") return demo;

    const initials = account.fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "DN";
    const recordedSex = account.gender === "Male"
      ? "MALE" as const
      : account.gender === "Female"
        ? "FEMALE" as const
        : "UNSPECIFIED" as const;

    return {
      ...demo,
      request: {
        ...demo.request,
        donors: demo.request.donors.map((donor) =>
          donor.id === demo.currentDonorId
            ? {
                ...donor,
                name: account.fullName || donor.name,
                initials,
                bloodGroup: account.bloodGroup || donor.bloodGroup,
                recordedSex,
              }
            : donor,
        ),
      },
    };
  }, [account, demo]);

  const currentDonor = useMemo(
    () =>
      donorFacingDemo.request.donors.find((donor) => donor.id === donorFacingDemo.currentDonorId) ??
      donorFacingDemo.request.donors[0],
    [donorFacingDemo],
  );

  const donorSafetyAssessment = useMemo(() => {
    if (!account || account.role !== "donor") return safetyAssessment;
    return applySelfReportedDonationHistory(safetyAssessment, {
      donatedBefore: account.donatedBefore,
      lastDonationDate: account.lastDonationDate,
      lastDonationType: account.lastDonationType,
      requestedDonationType: demo.request.collectionMethod,
      recordedSex:
        account.gender === "Male"
          ? "MALE"
          : account.gender === "Female"
            ? "FEMALE"
            : "UNSPECIFIED",
    });
  }, [account, demo.request.collectionMethod, safetyAssessment]);

  const acceptedDonors = useMemo(
    () =>
      demo.request.donors
        .filter((donor) => donor.acceptedOrder)
        .sort((a, b) => (a.acceptedOrder ?? 0) - (b.acceptedOrder ?? 0)),
    [demo],
  );

  async function loadAudit() {
    try {
      const response = await fetch("/api/audit", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { events: AuditEvent[] };
      setAuditEvents(payload.events);
    } catch {
      // Audit remains unavailable in device-only fallback mode.
    }
  }

  async function loadHospitalWorkspace() {
    try {
      const response = await fetch("/api/hospital-workspace", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        workspace: HospitalWorkspace;
      };
      setHospitalWorkspace(payload.workspace);
      setSelectedMembershipId((current) => {
        if (
          current &&
          payload.workspace.memberships.some((item) => item.id === current)
        ) {
          return current;
        }
        return (
          payload.workspace.memberships.find(
            (item) => item.role === "BLOOD_BANK_OPERATOR",
          )?.id ?? payload.workspace.memberships[0]?.id ?? ""
        );
      });
    } catch {
      // The hospital desk remains unavailable in device-only fallback mode.
    }
  }

  async function loadSafetyAssessment() {
    try {
      const response = await fetch("/api/donor-safety", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        assessment: DonorSafetyAssessment;
      };
      setSafetyAssessment(payload.assessment);
    } catch {
      // Interval assessment requires the durable server-side event history.
    }
  }

  async function performAction(action: DemoAction) {
    if (syncMode === "server") {
      try {
        const response = await fetch("/api/demo/actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, expectedRevision: revision }),
        });
        const payload = (await response.json()) as {
          state?: DemoState;
          revision?: number;
          notice?: string;
          error?: string;
        };
        if (response.status === 409) {
          const latest = await fetch("/api/demo", { cache: "no-store" });
          if (latest.ok) {
            const current = (await latest.json()) as {
              state: DemoState;
              revision: number;
            };
            setDemo(current.state);
            setRevision(current.revision);
          }
          setNotice(payload.error ?? "Session refreshed. Please try the action again.");
          return;
        }
        if (!response.ok || !payload.state || !payload.revision) {
          throw new Error(payload.error ?? "The server rejected this action.");
        }
        setDemo(payload.state);
        setRevision(payload.revision);
        setNotice(payload.notice ?? "Action recorded.");
        void loadAudit();
        void loadSafetyAssessment();
        if (action.role === "hospital") void loadHospitalWorkspace();
        return;
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The durable session could not record this action.",
        );
        return;
      }
    }

    try {
      const result = applyDemoAction(demo, action);
      setDemo(result.state);
      setNotice(result.notice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action could not be completed.");
    }
  }

  function acceptInvitation() {
    void performAction({ type: "ACCEPT_INVITATION", role: "donor" });
  }

  function declineInvitation() {
    void performAction({ type: "DECLINE_INVITATION", role: "donor" });
  }

  async function verifyDemoIdentity() {
    setVerifying(true);
    setNotice("Opening identity verification…");
    await performAction({ type: "VERIFY_DEMO_IDENTITY", role: "donor" });
    setVerifying(false);
  }

  function transitionDonor(
    donorId: string,
    nextStage: DonorStage,
    options?: {
      outcomeReasonCode?: string;
      queueOverrideReason?: string;
    },
  ) {
    if (!selectedMembershipId) {
      setNotice("Choose an authorized hospital staff persona first.");
      return;
    }
    void performAction({
      type: "TRANSITION_DONOR",
      role: "hospital",
      membershipId: selectedMembershipId,
      donorId,
      nextStage,
      outcomeReasonCode: options?.outcomeReasonCode,
      queueOverrideReason: options?.queueOverrideReason,
      redCellReinfusionStatus:
        nextStage === "DONATION_COMPLETED" &&
        demo.request.collectionMethod === "PLATELETPHERESIS"
          ? "COMPLETE"
          : "NOT_APPLICABLE",
    });
  }

  function cancelRequest(reason: string) {
    if (!selectedMembershipId) {
      setNotice("Choose an authorized hospital staff persona first.");
      return;
    }
    if (!reason.trim()) {
      setNotice("Enter a cancellation reason for the audit trail.");
      return;
    }
    void performAction({
      type: "CANCEL_REQUEST",
      role: "hospital",
      membershipId: selectedMembershipId,
      reason,
    });
  }

  async function createHospitalRequest() {
    if (syncMode !== "server" || !selectedMembershipId) {
      setNotice("The request desk is temporarily unavailable. Please try again.");
      return;
    }
    setRequestBusy(true);
    try {
      const response = await fetch("/api/hospital-workspace/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          membershipId: selectedMembershipId,
          request: requestDraft,
        }),
      });
      const payload = (await response.json()) as {
        workspace?: HospitalWorkspace;
        notice?: string;
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error ?? "The request could not be created.");
      }
      setHospitalWorkspace(payload.workspace);
      const checker = payload.workspace.memberships.find(
        (item) => item.role === "BLOOD_BANK_APPROVER",
      );
      if (checker) setSelectedMembershipId(checker.id);
      setNotice(payload.notice ?? "Request awaiting independent approval.");
      void loadAudit();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The request could not be created.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  async function approveHospitalRequest(requestId: string) {
    if (syncMode !== "server" || !selectedMembershipId) {
      setNotice("Choose the request checker before approving.");
      return;
    }
    setRequestBusy(true);
    try {
      const response = await fetch(
        "/api/hospital-workspace/requests/approve",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            membershipId: selectedMembershipId,
            requestId,
          }),
        },
      );
      const payload = (await response.json()) as {
        workspace?: HospitalWorkspace;
        demoSession?: { state: DemoState; revision: number };
        notice?: string;
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error ?? "The request could not be approved.");
      }
      setHospitalWorkspace(payload.workspace);
      if (payload.demoSession) {
        setDemo(payload.demoSession.state);
        setRevision(payload.demoSession.revision);
      }
      setNotice(payload.notice ?? "Request approved and opened to donors.");
      void loadAudit();
      void loadSafetyAssessment();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The request could not be approved.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  async function requestEmergencyOverrideForRequest(input: {
    requestId: string;
    reasonCode: EmergencyOverrideReason;
    justification: string;
  }) {
    if (syncMode !== "server" || !selectedMembershipId) {
      setNotice("Choose the request checker before seeking an override.");
      return;
    }
    setRequestBusy(true);
    try {
      const response = await fetch("/api/emergency-overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST",
          membershipId: selectedMembershipId,
          requestId: input.requestId,
          override: {
            reasonCode: input.reasonCode,
            justification: input.justification,
          },
        }),
      });
      const payload = (await response.json()) as {
        workspace?: HospitalWorkspace;
        notice?: string;
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error ?? "The override could not be requested.");
      }
      setHospitalWorkspace(payload.workspace);
      setNotice(payload.notice ?? "Override sent to district review.");
      void loadAudit();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The override could not be requested.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  async function decideDistrictOverride(
    overrideId: string,
    decision: "APPROVE" | "REJECT",
  ) {
    const districtMembershipId =
      hospitalWorkspace?.districtAuthority.memberships[0]?.id;
    if (syncMode !== "server" || !districtMembershipId) {
      setNotice("District authorization is unavailable in this session.");
      return;
    }
    setRequestBusy(true);
    try {
      const response = await fetch("/api/emergency-overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "DECIDE",
          membershipId: districtMembershipId,
          overrideId,
          decision,
        }),
      });
      const payload = (await response.json()) as {
        workspace?: HospitalWorkspace;
        demoSession?: { state: DemoState; revision: number } | null;
        notice?: string;
        error?: string;
      };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error ?? "The district decision could not be saved.");
      }
      setHospitalWorkspace(payload.workspace);
      if (payload.demoSession) {
        setDemo(payload.demoSession.state);
        setRevision(payload.demoSession.revision);
      }
      setNotice(payload.notice ?? "District decision recorded.");
      void loadAudit();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The district decision could not be saved.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  const heading = roleHeadings[role];
  const selectedMembership = hospitalWorkspace?.memberships.find(
    (item) => item.id === selectedMembershipId,
  );
  const durableActiveRequest = hospitalWorkspace?.requests.find(
    (item) => item.requestCode === demo.request.id,
  );
  const outreachPaused =
    durableActiveRequest?.status === "AWAITING_DISTRICT_OVERRIDE";

  if (accessScreen === "boot") return <AccessSplash />;

  if (accessScreen === "landing") {
    return (
      <PublicLanding
        onRegister={() => startAccess("register")}
        onSignIn={() => startAccess("sign-in")}
        onStaff={() => startAccess("staff")}
      />
    );
  }

  if (["sign-in", "register", "staff", "verify-otp"].includes(accessScreen)) {
    return (
      <AccessCard
        draft={authDraft}
        error={authError}
        onBack={() => {
          setAuthError("");
          if (accessScreen === "verify-otp") {
            navigate(authDraft.mode === "staff" ? "staff" : authDraft.mode === "register" ? "register" : "sign-in");
          } else {
            navigate("landing");
          }
        }}
        onDraftChange={setAuthDraft}
        onRequestOtp={requestOtp}
        onSwitchMode={(mode) => startAccess(mode)}
        onVerifyOtp={verifyOtp}
        screen={accessScreen}
      />
    );
  }

  if (accessScreen === "onboarding") {
    return <ProfileForm initial={emptyProfile(authDraft.phone)} mode="create" onSave={saveNewProfile} />;
  }

  if (accessScreen === "account" && account) {
    return (
      <ProfileForm
        initial={account}
        mode="edit"
        onCancel={() => navigate("workspace")}
        onDelete={deleteAccount}
        onSave={updateProfile}
      />
    );
  }

  if (!account) {
    return (
      <AccessCard
        draft={authDraft}
        error={authError}
        onBack={() => navigate("landing")}
        onDraftChange={setAuthDraft}
        onRequestOtp={requestOtp}
        onSwitchMode={(mode) => startAccess(mode)}
        onVerifyOtp={verifyOtp}
        screen="sign-in"
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Droplets size={23} fill="currentColor" />
          </div>
          <div>
            <strong>RaktSetu</strong>
            <span>रक्त सेतु</span>
            <small>{role === "donor" ? "Donor network" : "Institutional workspace"}</small>
          </div>
        </div>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="role-navigation" aria-label="Current workspace">
          <button className="active" type="button">
            {role === "donor" ? <HeartHandshake size={19} /> : role === "hospital" ? <Hospital size={19} /> : <BarChart3 size={19} />}
            <span>{role === "donor" ? "Donor home" : role === "hospital" ? "Blood centre" : "District overview"}</span>
            <ChevronRight size={16} />
          </button>
          {role === "donor" && (
            <button onClick={() => navigate("account")} type="button">
              <Settings size={19} />
              <span>Account settings</span>
            </button>
          )}
        </nav>

        <div className="sidebar-callout">
          <ShieldCheck size={20} />
          <strong>Built around trust</strong>
          <p>Role-scoped access, hospital confirmation and an auditable trail.</p>
        </div>

        <button className="reset-button" onClick={signOut} type="button">
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Droplets size={22} fill="currentColor" />
            <strong>RaktSetu</strong>
          </div>
          <div className="topbar-context">
            <span className="network-pulse" />
            Lucknow coordination network
            <small>4 participating hospitals</small>
          </div>
          <div className="topbar-actions">
            <button aria-label="Notifications" className="icon-button" type="button">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <div className="profile-chip">
              <span>{account.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "RS"}</span>
              <div>
                <strong>{role === "hospital" ? selectedMembership?.displayName ?? account.fullName : account.fullName}</strong>
                <small>
                  {role === "hospital" && selectedMembership
                    ? hospitalRoleLabel(selectedMembership.role)
                    : role === "hospital"
                      ? "Blood centre"
                      : role === "district"
                        ? account.organization ?? "District authority"
                        : `${account.bloodGroup} donor`}
                </small>
              </div>
            </div>
          </div>
        </header>

        <div className="mobile-account-bar">
          <span>{role === "donor" ? <HeartHandshake size={17} /> : role === "hospital" ? <Hospital size={17} /> : <BarChart3 size={17} />}{role === "donor" ? "Donor home" : role === "hospital" ? "Blood centre" : "District overview"}</span>
          <div className="mobile-account-actions">
            {role === "donor" && <button onClick={() => navigate("account")} type="button"><Settings size={16} /> Settings</button>}
            <button onClick={signOut} type="button"><LogOut size={16} /> Sign out</button>
          </div>
        </div>

        <div className="page-container">
          <section className={`page-heading hero-${role}`}>
            <Suspense fallback={null}>
              <BloodFlowCanvas />
            </Suspense>
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <div className="hero-copy">
              <p><Sparkles size={13} />{heading.eyebrow}</p>
              <h1>{heading.title}</h1>
              <span>{heading.description}</span>
              <div className="hero-trust-row">
                <small><ShieldCheck size={14} /> Role-scoped access</small>
                <small><ScrollText size={14} /> Auditable handoffs</small>
                <small><Stethoscope size={14} /> Hospital-led screening</small>
              </div>
            </div>
            <div className="hero-status">
              <div className="request-reference">
                <small>Active request</small>
                <strong>{demo.request.id}</strong>
                <span
                  className={`request-state request-${outreachPaused ? "paused" : demo.request.status.toLowerCase()}`}
                >
                  {outreachPaused
                    ? "Paused"
                    : demo.request.status === "OPEN_FOR_DONORS"
                    ? "Open"
                    : demo.request.status === "REQUEST_FULFILLED"
                      ? "Fulfilled"
                      : "Cancelled"}
                </span>
              </div>
              <div className="hero-network-note">
                <span><CircleDot size={13} /> Coordinated response</span>
                <strong>{role === "donor" ? "Respond" : role === "hospital" ? "Coordinate" : "Oversee"}</strong>
                <small>Updates appear here as the request progresses.</small>
              </div>
            </div>
          </section>

          <div className="live-notice" aria-live="polite">
            <Info size={17} />
            <span>{notice}</span>
          </div>

          {role === "donor" && (
            <DonorView
              account={account}
              currentDonor={currentDonor}
              demo={donorFacingDemo}
              onAccept={acceptInvitation}
              onDecline={declineInvitation}
              onVerify={verifyDemoIdentity}
              outreachPaused={outreachPaused}
              safetyAssessment={donorSafetyAssessment}
              verifying={verifying}
            />
          )}

          {role === "hospital" && (
            <HospitalView
              acceptedDonors={acceptedDonors}
              auditEvents={auditEvents}
              demo={demo}
              hospitalWorkspace={hospitalWorkspace}
              onApproveRequest={approveHospitalRequest}
              onCancel={cancelRequest}
              onCreateRequest={createHospitalRequest}
              onDraftChange={setRequestDraft}
              onMembershipChange={setSelectedMembershipId}
              onRequestOverride={requestEmergencyOverrideForRequest}
              onTransition={transitionDonor}
              requestBusy={requestBusy}
              requestDraft={requestDraft}
              selectedMembership={selectedMembership}
              selectedMembershipId={selectedMembershipId}
              syncMode={syncMode}
            />
          )}

          {role === "district" && (
            <DistrictView
              demo={demo}
              onDecideOverride={decideDistrictOverride}
              requestBusy={requestBusy}
              workspace={hospitalWorkspace}
            />
          )}
          <footer className="preview-footer">RaktSetu coordinates communication. Clinical screening remains with licensed blood centres.</footer>
        </div>
      </main>
    </div>
  );
}

type DonorRequestOption = {
  id: string;
  hospital: string;
  bloodCentre: string;
  component: string;
  bloodGroup: string;
  urgency: "Urgent" | "Routine";
  distanceKm: number;
  expiresAt: string;
  district: string;
  primary: boolean;
};

function DonorView({
  account,
  currentDonor,
  demo,
  onAccept,
  onDecline,
  onVerify,
  outreachPaused,
  safetyAssessment,
  verifying,
}: {
  account: AccountProfile;
  currentDonor: DemoDonor;
  demo: DemoState;
  onAccept: () => void;
  onDecline: () => void;
  onVerify: () => void;
  outreachPaused: boolean;
  safetyAssessment: DonorSafetyAssessment | null;
  verifying: boolean;
}) {
  const allRequestOptions = useMemo<DonorRequestOption[]>(
    () => [
      {
        id: demo.request.id,
        hospital: demo.request.hospital,
        bloodCentre: demo.request.bloodCentre,
        component: demo.request.component,
        bloodGroup: demo.request.bloodGroup,
        urgency: demo.request.urgency,
        distanceKm: currentDonor.distanceKm,
        expiresAt: demo.request.expiresAt,
        district: demo.request.district,
        primary: true,
      },
      {
        id: "RS-KGMU-2048",
        hospital: "King George’s Medical University",
        bloodCentre: "Department of Transfusion Medicine",
        component: "Packed red cells",
        bloodGroup: demo.request.bloodGroup,
        urgency: "Urgent",
        distanceKm: 4.8,
        expiresAt: "Today, 7:30 PM",
        district: "Lucknow",
        primary: false,
      },
      {
        id: "RS-RML-1186",
        hospital: "Dr. Ram Manohar Lohia Institute",
        bloodCentre: "Licensed blood centre",
        component: "Whole blood",
        bloodGroup: demo.request.bloodGroup,
        urgency: "Routine",
        distanceKm: 7.2,
        expiresAt: "Tomorrow, 11:00 AM",
        district: "Lucknow",
        primary: false,
      },
    ],
    [currentDonor.distanceKm, demo.request],
  );
  const validDeclaredBloodGroup = /^(A|B|AB|O)[+-]$/.test(account.bloodGroup);
  const requestOptions = useMemo(
    () =>
      account.available && validDeclaredBloodGroup
        ? allRequestOptions.filter(
            (request) =>
              request.bloodGroup === account.bloodGroup &&
              request.district === account.district,
          )
        : [],
    [
      account.available,
      account.bloodGroup,
      account.district,
      allRequestOptions,
      validDeclaredBloodGroup,
    ],
  );
  const [selectedRequestId, setSelectedRequestId] = useState(demo.request.id);
  const [skippedRequestIds, setSkippedRequestIds] = useState<string[]>([]);
  const [localResponses, setLocalResponses] = useState<
    Record<string, "accepted" | "declined">
  >({});
  const [requestNotice, setRequestNotice] = useState("");

  const visibleRequests = requestOptions.filter(
    (request) => !skippedRequestIds.includes(request.id),
  );
  const selectedRequest =
    visibleRequests.find((request) => request.id === selectedRequestId) ??
    visibleRequests[0];
  const localResponse = selectedRequest
    ? localResponses[selectedRequest.id]
    : undefined;
  const matchingBlockReason = !account.available
    ? "You have paused donor outreach. Turn availability on in Account settings when you want to receive requests again."
    : !validDeclaredBloodGroup
      ? "Blood-group-specific matching is paused until your blood group is known and saved."
      : account.district !== demo.request.district
        ? `There are no matching requests in ${account.district || "your selected district"} right now.`
        : "You have reviewed or skipped every current matching request.";

  if (!selectedRequest) {
    return (
      <div className="content-grid donor-grid">
        <section className="primary-column">
          <article className="panel empty-match-panel">
            <div className="empty-match-icon"><MapPin size={24} /></div>
            <p>Matching status</p>
            <h2>No matching request to show</h2>
            <span>{matchingBlockReason}</span>
            {skippedRequestIds.length > 0 && (
              <button className="button button-secondary" onClick={() => { setSkippedRequestIds([]); setRequestNotice("Skipped requests are visible again."); }} type="button">
                Show skipped requests
              </button>
            )}
          </article>
        </section>
        <aside className="secondary-column">
          <article className="panel identity-card">
            <div className="panel-heading compact"><div><p>Donor profile</p><h2>{currentDonor.verified ? "Verified donor record" : "Identity not yet linked"}</h2></div><Fingerprint /></div>
            <div className="identity-person"><span>{currentDonor.initials}</span><div><strong>{currentDonor.name}</strong><small>{account.bloodGroup || "Blood group not set"} · {account.district || "Location not set"}</small></div></div>
            <p className="identity-copy">Matching requires availability, a known blood group and a request in your selected district.</p>
          </article>
          <article className="panel notification-panel">
            <div className="panel-heading compact"><div><p>Notifications</p><h2>{account.notifications ? "No relevant update" : "Notifications paused"}</h2></div><Bell /></div>
            <p className="identity-copy">{account.notifications ? "Relevant request and status updates will appear here." : "You can still review the dashboard, but request and status notification cards are hidden."}</p>
          </article>
        </aside>
      </div>
    );
  }

  const selectedStage: DonorStage = selectedRequest.primary
    ? currentDonor.stage
    : localResponse === "accepted"
      ? "ACCEPTED_PENDING_SELECTION"
      : localResponse === "declined"
        ? "DECLINED"
        : "INVITED";
  const selectedOutreachPaused = selectedRequest.primary && outreachPaused;
  const canRespond =
    selectedStage === "INVITED" &&
    (selectedRequest.primary ? demo.request.status === "OPEN_FOR_DONORS" : true) &&
    !selectedOutreachPaused;
  const canAccept =
    canRespond && safetyAssessment?.status === "POTENTIALLY_CONTACTABLE";
  const confirmed = selectedStage === "HOSPITAL_CONFIRMED_TO_TRAVEL";

  function skipSelectedRequest() {
    const nextSkipped = Array.from(
      new Set([...skippedRequestIds, selectedRequest.id]),
    );
    setSkippedRequestIds(nextSkipped);
    const next = requestOptions.find(
      (request) =>
        request.id !== selectedRequest.id && !nextSkipped.includes(request.id),
    );
    if (next) setSelectedRequestId(next.id);
    setRequestNotice(
      "Skipped for now. The request is still available until it closes or you respond.",
    );
  }

  function acceptSelectedRequest() {
    setRequestNotice("");
    if (selectedRequest.primary) {
      onAccept();
      return;
    }
    setLocalResponses((current) => ({
      ...current,
      [selectedRequest.id]: "accepted",
    }));
    setRequestNotice(
      "Response received. Wait for this hospital to confirm travel before leaving.",
    );
  }

  function declineSelectedRequest() {
    setRequestNotice("");
    if (selectedRequest.primary) {
      onDecline();
      return;
    }
    setLocalResponses((current) => ({
      ...current,
      [selectedRequest.id]: "declined",
    }));
    setRequestNotice("Request declined. You can still review the other matches.");
  }

  return (
    <div className="content-grid donor-grid">
      <section className="primary-column">
        <article className="panel request-picker">
          <div className="panel-heading compact">
            <div><p>Requests near you</p><h2>Choose which request to review</h2></div>
            <span className="request-count">{visibleRequests.length} available</span>
          </div>
          <div className="request-choice-list">
            {visibleRequests.map((request) => (
              <button
                className={request.id === selectedRequest.id ? "active" : ""}
                key={request.id}
                onClick={() => {
                  setSelectedRequestId(request.id);
                  setRequestNotice("");
                }}
                type="button"
              >
                <span className="request-choice-blood">{request.bloodGroup}</span>
                <span><strong>{request.hospital}</strong><small>{request.component} · {request.distanceKm} km</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {skippedRequestIds.length > 0 && (
            <button className="restore-skipped" onClick={() => { setSkippedRequestIds([]); setRequestNotice("Skipped requests are visible again."); }} type="button">
              Show {skippedRequestIds.length} skipped request{skippedRequestIds.length > 1 ? "s" : ""}
            </button>
          )}
          {requestNotice && <p className="request-picker-notice" aria-live="polite">{requestNotice}</p>}
        </article>

        <article className="request-card donor-request-card">
          <div className="request-card-topline">
            <span className="urgency-flag">
              <Activity size={15} /> {selectedRequest.urgency} request
            </span>
            <StatusPill stage={selectedStage} />
          </div>

          <div className="blood-request-hero">
            <div className="blood-group-orb">
              <span>{selectedRequest.bloodGroup}</span>
              <small>Group</small>
            </div>
            <div>
              <p>Potential match for</p>
              <h2>{selectedRequest.component}</h2>
              <div className="hospital-line">
                <Hospital size={17} />
                <span>
                  <strong>{selectedRequest.hospital}</strong>
                  {selectedRequest.bloodCentre}
                </span>
              </div>
            </div>
          </div>

          <div className="request-facts">
            <div>
              <MapPin size={17} />
              <span><small>Approx. distance</small><strong>{selectedRequest.distanceKm} km away</strong></span>
            </div>
            <div>
              <Clock3 size={17} />
              <span><small>Respond by</small><strong>{selectedRequest.expiresAt}</strong></span>
            </div>
            <div>
              <LockKeyhole size={17} />
              <span><small>Patient privacy</small><strong>No identity shared</strong></span>
            </div>
          </div>

          {canRespond && (
            <div className="response-panel">
              <div>
                <strong>
                  {canAccept
                    ? "Are you available if the hospital selects you?"
                    : safetyAssessment
                      ? "This invitation cannot be accepted yet"
                      : "Checking connected donation history…"}
                </strong>
                <p>
                  {canAccept
                    ? "Accepting holds your place. Do not travel until confirmed."
                    : safetyAssessment?.nextContactAt
                      ? `Contact is paused until ${new Date(safetyAssessment.nextContactAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
                      : safetyAssessment?.reason ?? "Please wait while the recorded interval is checked."}
                </p>
              </div>
              <div className="button-row">
                <button className="button button-primary" disabled={!canAccept} onClick={acceptSelectedRequest} type="button">
                  {canAccept ? "I’m available" : "Acceptance paused"} <ArrowRight size={17} />
                </button>
                <button className="button button-ghost" onClick={skipSelectedRequest} type="button">Skip for now</button>
                <button className="button button-ghost danger-text" onClick={declineSelectedRequest} type="button">Not this time</button>
              </div>
            </div>
          )}

          {selectedOutreachPaused && selectedStage === "INVITED" && (
            <div className="stage-message">
              <Clock3 size={18} />
              <div>
                <strong>Donor responses are paused</strong>
                <p>
                  The hospital outreach quota is active. A current, request-specific
                  district override is required before you can respond.
                </p>
              </div>
            </div>
          )}

          {!canRespond && !selectedOutreachPaused && (
            <div className={`stage-message ${confirmed ? "confirmed" : ""}`}>
              {confirmed ? <Route size={22} /> : <Clock3 size={22} />}
              <div>
                <strong>
                  {confirmed
                    ? "The hospital has confirmed your visit"
                    : selectedStage === "ACCEPTED_PENDING_SELECTION"
                      ? "Response received — wait for hospital confirmation"
                      : formatStage(selectedStage)}
                </strong>
                <p>
                  {confirmed
                    ? "Report to the Blood Centre reception. Carry an approved identity document."
                    : "You will receive a clear update. Please do not travel unless the status changes to confirmed."}
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="panel timeline-panel">
          <div className="panel-heading">
            <div><p>Safe coordination</p><h2>Your request journey</h2></div>
            <ShieldCheck size={22} />
          </div>
          <div className="timeline">
            <div className="timeline-step complete"><span><Check size={14} /></span><div><strong>Invitation received</strong><small>Potential match only</small></div></div>
            <div className={`timeline-step ${selectedStage !== "INVITED" ? "complete" : ""}`}><span>{selectedStage !== "INVITED" ? <Check size={14} /> : "2"}</span><div><strong>You respond</strong><small>No travel yet</small></div></div>
            <div className={`timeline-step ${["HOSPITAL_CONFIRMED_TO_TRAVEL", "ARRIVED_FOR_SCREENING", "DONATION_COMPLETED"].includes(selectedStage) ? "complete" : ""}`}><span>3</span><div><strong>Hospital confirms</strong><small>Travel details unlock</small></div></div>
            <div className={`timeline-step ${selectedStage === "DONATION_COMPLETED" ? "complete" : ""}`}><span>4</span><div><strong>Screening at centre</strong><small>Medical officer decides</small></div></div>
          </div>
        </article>
      </section>

      <aside className="secondary-column">
        <article className="panel identity-card">
          <div className="panel-heading compact">
            <div><p>Identity status</p><h2>{currentDonor.verified ? "Verified donor record" : "Identity not yet linked"}</h2></div>
            {currentDonor.verified ? <BadgeCheck className="success-icon" /> : <Fingerprint />}
          </div>

          <div className="identity-person">
            <span>{currentDonor.initials}</span>
            <div><strong>{currentDonor.name}</strong><small>{currentDonor.bloodGroup} · {account.district}</small></div>
          </div>

          {currentDonor.verified ? (
            <div className="verified-result">
              <CheckCircle2 size={18} />
              <span><strong>One network identity</strong><small>{currentDonor.personId}</small></span>
            </div>
          ) : (
            <>
              <p className="identity-copy">Verification joins donations and deferrals to one person across participating hospitals.</p>
              <button className="button button-secondary button-full" disabled={verifying} onClick={onVerify} type="button">
                <Fingerprint size={17} />
                {verifying ? "Verifying…" : "Preview identity verification"}
              </button>
            </>
          )}
          <p className="micro-warning">Preview verification does not collect or store an Aadhaar number.</p>
        </article>

        <article className="panel">
          <div className="panel-heading compact">
            <div><p>Recorded network history</p><h2>Contact readiness</h2></div>
            <CalendarClock />
          </div>
          <div className={`readiness-row readiness-${safetyAssessment?.status.toLowerCase() ?? "loading"}`}>
            <span className="readiness-indicator" />
            <div>
              <strong>{safetyAssessment?.label ?? "Checking recorded intervals…"}</strong>
              <small>
                {safetyAssessment?.nextContactAt
                  ? `Contact after ${new Date(safetyAssessment.nextContactAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                  : safetyAssessment?.reason ?? currentDonor.lastDonationLabel}
              </small>
            </div>
          </div>
          {safetyAssessment && (
            <div className="ruleset-note">
              <ShieldCheck size={15} />
              <span><strong>{safetyAssessment.ruleSetId}</strong><small>{safetyAssessment.recordedEventCount} connected event(s) checked</small></span>
            </div>
          )}
          <div className="medical-boundary"><Stethoscope size={17} /><p>{safetyAssessment?.finalEligibilityBoundary ?? "Final eligibility is always decided by the licensed blood centre."}</p></div>
        </article>

        <article className="panel notification-panel">
          <div className="panel-heading compact"><div><p>Latest update</p><h2>Notifications</h2></div><Bell /></div>
          {account.notifications ? demo.notifications.slice(0, 2).map((item) => (
              <div className={`notification-item notification-${item.tone}`} key={item.id}>
                <span /><div><strong>{item.title}</strong><p>{item.body}</p><small>{item.time}</small></div>
              </div>
            )) : <p className="identity-copy">Request and status notification cards are paused. You can turn them on again in Account settings.</p>}
        </article>
      </aside>
    </div>
  );
}

function requestDeskStatusLabel(status: HospitalRequestRecord["status"]) {
  if (status === "AWAITING_HOSPITAL_APPROVAL") return "Awaiting checker";
  if (status === "AWAITING_DISTRICT_OVERRIDE") return "Outreach rate-limited";
  if (status === "OPEN_FOR_DONORS") return "Open to donors";
  if (status === "REQUEST_FULFILLED") return "Fulfilled";
  if (status === "CANCELLED") return "Cancelled";
  return "Rejected";
}

function HospitalRequestDesk({
  onApproveRequest,
  onCreateRequest,
  onDraftChange,
  onMembershipChange,
  onRequestOverride,
  requestBusy,
  requestDraft,
  selectedMembership,
  selectedMembershipId,
  syncMode,
  workspace,
}: {
  onApproveRequest: (requestId: string) => void;
  onCreateRequest: () => void;
  onDraftChange: (value: CreateBloodRequestInput) => void;
  onMembershipChange: (membershipId: string) => void;
  onRequestOverride: (input: {
    requestId: string;
    reasonCode: EmergencyOverrideReason;
    justification: string;
  }) => void;
  requestBusy: boolean;
  requestDraft: CreateBloodRequestInput;
  selectedMembership: HospitalMembership | undefined;
  selectedMembershipId: string;
  syncMode: SyncMode;
  workspace: HospitalWorkspace | null;
}) {
  const [overrideReason, setOverrideReason] = useState<EmergencyOverrideReason>(
    "CRITICAL_SHORTAGE",
  );
  const [overrideJustification, setOverrideJustification] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestTouched, setRequestTouched] = useState<Set<string>>(() => new Set());
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);
  const [overrideTouched, setOverrideTouched] = useState(false);
  const requestFormRef = useRef<HTMLFormElement>(null);
  const overrideFormRef = useRef<HTMLFormElement>(null);
  const pendingRequest = workspace?.requests.find(
    (item) => item.status === "AWAITING_HOSPITAL_APPROVAL",
  );
  const rateLimitedRequest = workspace?.requests.find(
    (item) => item.status === "AWAITING_DISTRICT_OVERRIDE",
  );
  const pendingOverride = workspace?.emergencyOverrides.find(
    (item) =>
      item.requestId === rateLimitedRequest?.id && item.status === "PENDING",
  );
  const isMaker = selectedMembership?.role === "BLOOD_BANK_OPERATOR";
  const isChecker = selectedMembership?.role === "BLOOD_BANK_APPROVER";
  const requestFieldValid = {
    component: bloodComponents.includes(requestDraft.component as (typeof bloodComponents)[number]),
    collectionMethod: collectionMethods.some((method) => method.value === requestDraft.collectionMethod),
    bloodGroup: bloodGroups.includes(requestDraft.bloodGroup as (typeof bloodGroups)[number]),
    unitsRequired: Number.isInteger(requestDraft.unitsRequired) && requestDraft.unitsRequired >= 1 && requestDraft.unitsRequired <= 10,
    urgency: requestDraft.urgency === "Urgent" || requestDraft.urgency === "Routine",
    caseReference: /^[A-Z0-9][A-Z0-9/-]{3,31}$/.test(requestDraft.caseReference.trim().toUpperCase()),
  };
  const requestValid = Object.values(requestFieldValid).every(Boolean);
  const overrideValid = overrideJustification.trim().length >= 20;

  function touchRequestField(name: string) {
    setRequestTouched((current) => new Set(current).add(name));
  }

  function requestFieldClass(name: keyof typeof requestFieldValid) {
    const hasValue = name === "unitsRequired"
      ? Number.isFinite(requestDraft.unitsRequired)
      : Boolean(String(requestDraft[name]).trim());
    return validationClass(hasValue, requestFieldValid[name], requestTouched.has(name), requestSubmitted);
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestValid) {
      setRequestSubmitted(true);
      focusFirstInvalidField(requestFormRef.current);
      return;
    }
    setRequestSubmitted(false);
    onCreateRequest();
  }

  function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overrideValid || !rateLimitedRequest) {
      setOverrideSubmitted(true);
      focusFirstInvalidField(overrideFormRef.current);
      return;
    }
    setOverrideSubmitted(false);
    onRequestOverride({
      requestId: rateLimitedRequest.id,
      reasonCode: overrideReason,
      justification: overrideJustification,
    });
  }

  return (
    <article className="panel request-desk">
      <div className="request-desk-heading">
        <div>
          <p>Authorized hospital workflow</p>
          <h2>Create, verify, then notify</h2>
          <span>
            A maker records the requirement. A different checker must approve it
            before any donor is contacted.
          </span>
        </div>
        <div className="organization-seal">
          <Building2 size={18} />
          <span>
            <small>Bound organization</small>
            <strong>
              {workspace?.organization.name ?? "Loading hospital access…"}
            </strong>
          </span>
        </div>
      </div>

      <div className="persona-switcher" aria-label="Choose hospital staff account">
        {workspace?.memberships.map((membership) => (
          <button
            className={
              selectedMembershipId === membership.id ? "active" : undefined
            }
            key={membership.id}
            onClick={() => onMembershipChange(membership.id)}
            type="button"
          >
            <span>{membership.role === "BLOOD_BANK_OPERATOR" ? "1" : "2"}</span>
            <div>
              <strong>{membership.displayName}</strong>
              <small>{hospitalRoleLabel(membership.role)}</small>
            </div>
            {selectedMembershipId === membership.id && <Check size={15} />}
          </button>
        ))}
      </div>

      <div className="rate-limit-strip">
        <div>
          <small>Rolling outreach policy</small>
          <strong>
            {workspace
              ? `${workspace.rateLimit.usage.requestsOpenedInWindow} / ${workspace.rateLimit.policy.maxRequestsInWindow} requests in ${workspace.rateLimit.policy.windowHours}h`
              : "Loading quota…"}
          </strong>
        </div>
        <div>
          <small>Concurrent outreach</small>
          <strong>
            {workspace
              ? `${workspace.rateLimit.usage.concurrentOpenRequests} / ${workspace.rateLimit.policy.maxConcurrentOpenRequests} open`
              : "—"}
          </strong>
        </div>
        <div>
          <small>Donor contact cap</small>
          <strong>
            {workspace
              ? `${workspace.rateLimit.policy.maxDonorContactsPerRequest} per request`
              : "—"}
          </strong>
        </div>
        <span>Hospital-specific · server enforced</span>
      </div>

      <div className="request-desk-grid">
        <form className={`request-builder ${!isMaker ? "inactive" : ""}`} noValidate onSubmit={submitRequest} ref={requestFormRef}>
          <div className="desk-section-title">
            <span>Step 1</span>
            <div>
              <strong>Maker records requirement</strong>
              <small>No patient name or medical notes</small>
            </div>
          </div>
          <p className="required-note"><span>*</span> Required request fields</p>
          <div className="request-form-grid">
            <label className={requestFieldClass("component")}>
              <RequiredFieldText>Component</RequiredFieldText>
              <select
                aria-invalid={!requestFieldValid.component && (requestTouched.has("component") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                onChange={(event) => { touchRequestField("component"); onDraftChange({ ...requestDraft, component: event.target.value }); }}
                required
                value={requestDraft.component}
              >
                {bloodComponents.map((component) => (
                  <option key={component}>{component}</option>
                ))}
              </select>
            </label>
            <label className={`collection-method-field ${requestFieldClass("collectionMethod")}`}>
              <RequiredFieldText>Collection method</RequiredFieldText>
              <select
                aria-invalid={!requestFieldValid.collectionMethod && (requestTouched.has("collectionMethod") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                onChange={(event) => { touchRequestField("collectionMethod"); onDraftChange({
                    ...requestDraft,
                    collectionMethod: event.target
                      .value as CreateBloodRequestInput["collectionMethod"],
                  }); }}
                required
                value={requestDraft.collectionMethod}
              >
                {collectionMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={requestFieldClass("bloodGroup")}>
              <RequiredFieldText>Blood group</RequiredFieldText>
              <select
                aria-invalid={!requestFieldValid.bloodGroup && (requestTouched.has("bloodGroup") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                onChange={(event) => { touchRequestField("bloodGroup"); onDraftChange({ ...requestDraft, bloodGroup: event.target.value }); }}
                required
                value={requestDraft.bloodGroup}
              >
                {bloodGroups.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </label>
            <label className={requestFieldClass("unitsRequired")}>
              <RequiredFieldText>Units</RequiredFieldText>
              <input
                aria-invalid={!requestFieldValid.unitsRequired && (requestTouched.has("unitsRequired") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                max={10}
                min={1}
                onChange={(event) => { touchRequestField("unitsRequired"); onDraftChange({
                    ...requestDraft,
                    unitsRequired: Number(event.target.value),
                  }); }}
                required
                type="number"
                value={requestDraft.unitsRequired}
              />
              <small className="field-feedback">{requestFieldValid.unitsRequired ? "Valid quantity." : "Enter a whole number from 1 to 10."}</small>
            </label>
            <label className={requestFieldClass("urgency")}>
              <RequiredFieldText>Urgency</RequiredFieldText>
              <select
                aria-invalid={!requestFieldValid.urgency && (requestTouched.has("urgency") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                onChange={(event) => { touchRequestField("urgency"); onDraftChange({
                    ...requestDraft,
                    urgency: event.target.value as "Urgent" | "Routine",
                  }); }}
                required
                value={requestDraft.urgency}
              >
                <option>Urgent</option>
                <option>Routine</option>
              </select>
            </label>
            <label className={`case-reference-field ${requestFieldClass("caseReference")}`}>
              <RequiredFieldText>Case reference</RequiredFieldText>
              <input
                aria-invalid={!requestFieldValid.caseReference && (requestTouched.has("caseReference") || requestSubmitted)}
                disabled={!isMaker || requestBusy}
                maxLength={32}
                minLength={4}
                onChange={(event) => { touchRequestField("caseReference"); onDraftChange({
                    ...requestDraft,
                    caseReference: event.target.value.toUpperCase(),
                  }); }}
                pattern="[A-Z0-9][A-Z0-9/-]{3,31}"
                placeholder="RS-ER-3001"
                required
                value={requestDraft.caseReference}
              />
              <small className="field-feedback">{requestFieldValid.caseReference ? "Valid non-identifying case reference." : "Use 4–32 letters, numbers, / or -. Do not enter a patient name."}</small>
            </label>
          </div>
          <button
            className="button button-primary button-full"
            disabled={
              syncMode !== "server" || !isMaker || requestBusy || !!pendingRequest
            }
            type="submit"
          >
            {requestBusy ? "Recording…" : "Submit for checker approval"}
            <ArrowRight size={16} />
          </button>
          {!isMaker && (
            <p className="desk-help">Switch to the request maker to edit and submit.</p>
          )}
          {pendingRequest && (
            <p className="desk-help">Review the pending request before creating another.</p>
          )}
        </form>

        <div className={`approval-station ${!isChecker ? "inactive" : ""}`}>
          <div className="desk-section-title">
            <span>Step 2</span>
            <div>
              <strong>Checker independently approves</strong>
              <small>Server verifies membership and separation</small>
            </div>
          </div>

          {pendingRequest ? (
            <div className="pending-request-card">
              <div className="pending-request-topline">
                <span>{pendingRequest.bloodGroup}</span>
                <div>
                  <small>{pendingRequest.requestCode}</small>
                  <strong>{pendingRequest.component}</strong>
                </div>
                <em>{requestDeskStatusLabel(pendingRequest.status)}</em>
              </div>
              <dl>
                <div><dt>Units</dt><dd>{pendingRequest.unitsRequired}</dd></div>
                <div><dt>Urgency</dt><dd>{pendingRequest.urgency}</dd></div>
                <div><dt>Case</dt><dd>{pendingRequest.caseReference}</dd></div>
              </dl>
              <p className="collection-method-summary">
                {collectionMethods.find(
                  (method) => method.value === pendingRequest.collectionMethod,
                )?.label ?? pendingRequest.collectionMethod}
              </p>
              <div className="approval-safety-note">
                <ShieldCheck size={16} />
                Donors remain untouched until this approval succeeds.
              </div>
              <button
                className="button button-secondary button-full"
                disabled={!isChecker || requestBusy}
                onClick={() => onApproveRequest(pendingRequest.id)}
                type="button"
              >
                {requestBusy ? "Approving…" : "Approve and evaluate outreach quota"}
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="empty-approval">
              <ShieldCheck size={24} />
              <strong>No request awaiting review</strong>
              <p>Create one as the maker; this station will receive it for approval.</p>
            </div>
          )}
        </div>
      </div>

      {rateLimitedRequest && (
        <div className="override-request-panel">
          <div className="desk-section-title">
            <span>3</span>
            <div>
              <strong>Request-specific emergency override</strong>
              <small>
                {rateLimitedRequest.requestCode} passed maker–checker review, but
                donor outreach is paused by the hospital quota.
              </small>
            </div>
          </div>
          {pendingOverride ? (
            <div className="override-awaiting">
              <Clock3 size={19} />
              <div>
                <strong>Waiting for district decision</strong>
                <p>
                  {emergencyOverrideReasonLabel(pendingOverride.reasonCode)} ·
                  requested by {pendingOverride.requestedByName}
                </p>
              </div>
            </div>
          ) : (
            <form className="override-request-grid" noValidate onSubmit={submitOverride} ref={overrideFormRef}>
              <label className="field-valid">
                <RequiredFieldText>Emergency category</RequiredFieldText>
                <select
                  disabled={!isChecker || requestBusy}
                  onChange={(event) =>
                    setOverrideReason(event.target.value as EmergencyOverrideReason)
                  }
                  required
                  value={overrideReason}
                >
                  {emergencyOverrideReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={validationClass(Boolean(overrideJustification.trim()), overrideValid, overrideTouched, overrideSubmitted)}>
                <RequiredFieldText>Operational justification</RequiredFieldText>
                <textarea
                  aria-invalid={!overrideValid && (overrideTouched || overrideSubmitted)}
                  disabled={!isChecker || requestBusy}
                  maxLength={500}
                  minLength={20}
                  onBlur={() => setOverrideTouched(true)}
                  onChange={(event) => { setOverrideTouched(true); setOverrideJustification(event.target.value); }}
                  placeholder="Explain the verified district-level operational need. Do not enter patient or donor identity."
                  required
                  rows={3}
                  value={overrideJustification}
                />
                <small className="field-feedback">{overrideValid ? "Justification is detailed enough to submit." : `${Math.max(0, 20 - overrideJustification.trim().length)} more character${Math.max(0, 20 - overrideJustification.trim().length) === 1 ? "" : "s"} required.`}</small>
              </label>
              <button
                className="button button-danger"
                disabled={!isChecker || requestBusy}
                type="submit"
              >
                Submit to district oversight
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          <p className="override-boundary">
            A district approval lasts four hours and changes outreach quota only.
            Donor contact-readiness, consent, medical screening and hospital travel
            confirmation remain mandatory.
          </p>
        </div>
      )}

      <div className="production-boundary">
        <LockKeyhole size={15} />
        <span>{workspace?.productionBoundary ?? "Loading access boundary…"}</span>
      </div>
    </article>
  );
}

function HospitalView({
  acceptedDonors,
  auditEvents,
  demo,
  hospitalWorkspace,
  onApproveRequest,
  onCancel,
  onCreateRequest,
  onDraftChange,
  onMembershipChange,
  onRequestOverride,
  onTransition,
  requestBusy,
  requestDraft,
  selectedMembership,
  selectedMembershipId,
  syncMode,
}: {
  acceptedDonors: DemoDonor[];
  auditEvents: AuditEvent[];
  demo: DemoState;
  hospitalWorkspace: HospitalWorkspace | null;
  onApproveRequest: (requestId: string) => void;
  onCancel: (reason: string) => void;
  onCreateRequest: () => void;
  onDraftChange: (value: CreateBloodRequestInput) => void;
  onMembershipChange: (membershipId: string) => void;
  onRequestOverride: (input: {
    requestId: string;
    reasonCode: EmergencyOverrideReason;
    justification: string;
  }) => void;
  onTransition: (
    donorId: string,
    nextStage: DonorStage,
    options?: {
      outcomeReasonCode?: string;
      queueOverrideReason?: string;
    },
  ) => void;
  requestBusy: boolean;
  requestDraft: CreateBloodRequestInput;
  selectedMembership: HospitalMembership | undefined;
  selectedMembershipId: string;
  syncMode: SyncMode;
}) {
  const request = demo.request;
  const durableRequest = hospitalWorkspace?.requests.find(
    (item) => item.requestCode === request.id,
  );
  const outreachPaused =
    durableRequest?.status === "AWAITING_DISTRICT_OVERRIDE";
  const confirmedCount = request.donors.filter((donor) =>
    ["HOSPITAL_CONFIRMED_TO_TRAVEL", "ARRIVED_FOR_SCREENING", "DONATION_COMPLETED"].includes(donor.stage),
  ).length;
  const activeTravelCount = request.donors.filter((donor) =>
    ["HOSPITAL_CONFIRMED_TO_TRAVEL", "ARRIVED_FOR_SCREENING"].includes(
      donor.stage,
    ),
  ).length;
  const remainingTravelSlots = Math.max(
    0,
    request.unitsRequired - request.completedUnits - activeTravelCount,
  );
  const nextQueueDonor = request.donors
    .filter((donor) => canConfirmDonor(donor.stage))
    .sort((a, b) => (a.acceptedOrder ?? 999) - (b.acceptedOrder ?? 999))[0];
  const [actionDialog, setActionDialog] = useState<
    | {
        kind: "confirm" | "temporary" | "permanent";
        donor: DemoDonor;
        requiresQueueOverride?: boolean;
      }
    | { kind: "cancel" }
    | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [outcomeCode, setOutcomeCode] = useState("LOW_HAEMOGLOBIN");
  const [actionSubmitted, setActionSubmitted] = useState(false);
  const [actionTouched, setActionTouched] = useState(false);
  const actionFormRef = useRef<HTMLFormElement>(null);

  function closeActionDialog() {
    setActionDialog(null);
    setActionReason("");
    setActionSubmitted(false);
    setActionTouched(false);
  }

  function submitActionDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionDialog) return;
    const reasonMinimum = actionDialog.kind === "cancel"
      ? 5
      : actionDialog.kind === "confirm" && actionDialog.requiresQueueOverride
        ? 10
        : 0;
    if (reasonMinimum && actionReason.trim().length < reasonMinimum) {
      setActionSubmitted(true);
      focusFirstInvalidField(actionFormRef.current);
      return;
    }
    if (actionDialog.kind === "cancel") {
      onCancel(actionReason);
      closeActionDialog();
      return;
    }
    if (actionDialog.kind === "confirm") {
      onTransition(actionDialog.donor.id, "HOSPITAL_CONFIRMED_TO_TRAVEL", {
        queueOverrideReason: actionDialog.requiresQueueOverride
          ? actionReason
          : undefined,
      });
      closeActionDialog();
      return;
    }
    onTransition(
      actionDialog.donor.id,
      actionDialog.kind === "temporary"
        ? "TEMPORARILY_DEFERRED"
        : "PERMANENTLY_DEFERRED",
      { outcomeReasonCode: outcomeCode },
    );
    closeActionDialog();
  }

  return (
    <div className="hospital-content">
      <HospitalRequestDesk
        onApproveRequest={onApproveRequest}
        onCreateRequest={onCreateRequest}
        onDraftChange={onDraftChange}
        onMembershipChange={onMembershipChange}
        onRequestOverride={onRequestOverride}
        requestBusy={requestBusy}
        requestDraft={requestDraft}
        selectedMembership={selectedMembership}
        selectedMembershipId={selectedMembershipId}
        syncMode={syncMode}
        workspace={hospitalWorkspace}
      />

      <section className="stats-grid">
        <StatCard icon={Droplets} label="Units completed" value={`${request.completedUnits} / ${request.unitsRequired}`} detail={request.component} tone="red" />
        <StatCard icon={Users} label="Accepted donors" value={String(acceptedDonors.length)} detail="Ordered by response time" tone="blue" />
        <StatCard icon={Route} label="Confirmed to travel" value={String(confirmedCount)} detail="Controlled hospital release" tone="green" />
        <StatCard icon={Clock3} label="Open for" value="42 min" detail={`Created ${request.createdAt}`} />
      </section>

      <div className="content-grid hospital-grid">
        <section className="primary-column">
          <article className="panel request-command-card">
            <div className="command-heading">
              <div className="blood-group-tile">{request.bloodGroup}</div>
              <div>
                <div className="command-kicker"><span>{request.urgency}</span><small>{request.id}</small></div>
                <h2>{request.component}</h2>
                <p>
                  {request.unitsRequired} units · Case {request.caseReference} ·{
                    " "
                  }
                  {collectionMethods.find(
                    (method) => method.value === request.collectionMethod,
                  )?.label ?? request.collectionMethod}
                </p>
              </div>
            </div>

            <div className="fulfilment-block">
              <div><span>Request fulfilment</span><strong>{request.completedUnits} of {request.unitsRequired} units completed</strong></div>
              <div className="progress-track"><span style={{ width: `${(request.completedUnits / request.unitsRequired) * 100}%` }} /></div>
            </div>

            <div className="request-detail-grid">
              <div><MapPin size={17} /><span><small>Blood centre</small><strong>{request.hospital}</strong></span></div>
              <div><Clock3 size={17} /><span><small>Response window</small><strong>Until {request.expiresAt}</strong></span></div>
              <div><ShieldCheck size={17} /><span><small>Outreach authority</small><strong>{outreachPaused ? "Paused · district override required" : "Maker-checker passed"}</strong></span></div>
            </div>
          </article>

          <article className="panel donor-queue-card">
            <div className="panel-heading queue-heading">
              <div><p>Live response queue</p><h2>Donor coordination</h2></div>
              <span className={`live-chip ${outreachPaused ? "paused" : ""}`}><span /> {outreachPaused ? "Paused" : "Live"}</span>
            </div>

            <div className="queue-explainer"><Info size={16} />Acceptances stay in order. Only hospital-confirmed donors receive travel instructions.</div>

            <div className="donor-table" role="table" aria-label="Donor response queue">
              <div className="donor-table-head" role="row"><span>Donor</span><span>Response</span><span>Status</span><span>Hospital action</span></div>
              {request.donors
                .filter((donor) => donor.stage !== "INVITED" || donor.id === demo.currentDonorId)
                .sort((a, b) => (a.acceptedOrder ?? 99) - (b.acceptedOrder ?? 99))
                .map((donor) => (
                  <div className="donor-table-row" role="row" key={donor.id}>
                    <div className="donor-cell">
                      <span className="avatar">{donor.initials}</span>
                      <div><strong>{donor.name}</strong><small>{donor.bloodGroup} · {donor.distanceKm} km {donor.verified && <BadgeCheck size={13} />}</small></div>
                    </div>
                    <div className="response-cell"><strong>{donor.acceptedOrder ? `#${donor.acceptedOrder}` : "—"}</strong><small>{donor.responseTime ?? "No response"}</small></div>
                    <div><StatusPill stage={donor.stage} /></div>
                    <div className="action-cell">
                      {canConfirmDonor(donor.stage) && request.status === "OPEN_FOR_DONORS" && !outreachPaused && remainingTravelSlots > 0 && <button className="table-action primary" onClick={() => { const requiresQueueOverride = nextQueueDonor?.id !== donor.id; setActionReason(""); setActionDialog({ kind: "confirm", donor, requiresQueueOverride }); }} type="button">{nextQueueDonor?.id === donor.id ? "Confirm travel" : "Override queue"}</button>}
                      {canConfirmDonor(donor.stage) && remainingTravelSlots === 0 && <span className="recorded-label">Standby · slots filled</span>}
                      {canRecordArrival(donor.stage) && <button className="table-action" onClick={() => onTransition(donor.id, "ARRIVED_FOR_SCREENING")} type="button">Check in</button>}
                      {canRecordOutcome(donor.stage) && (
                        <div className="outcome-actions">
                          <button className="table-action primary" onClick={() => onTransition(donor.id, "DONATION_COMPLETED")} type="button">Complete</button>
                          <button aria-label={`Temporarily defer ${donor.name}`} className="square-action" onClick={() => { setOutcomeCode("LOW_HAEMOGLOBIN"); setActionDialog({ kind: "temporary", donor }); }} title="Record temporary deferral" type="button"><Clock3 size={14} /></button>
                          <button aria-label={`Permanently defer ${donor.name}`} className="square-action danger" onClick={() => { setOutcomeCode("CLINICAL_PERMANENT_DEFERRAL"); setActionDialog({ kind: "permanent", donor }); }} title="Record permanent deferral" type="button"><X size={14} /></button>
                        </div>
                      )}
                      {["DONATION_COMPLETED", "TEMPORARILY_DEFERRED", "PERMANENTLY_DEFERRED", "NOT_NEEDED", "DECLINED"].includes(donor.stage) && <span className="recorded-label">Recorded</span>}
                    </div>
                  </div>
                ))}
            </div>
          </article>
        </section>

        <aside className="secondary-column">
          <article className="panel action-summary">
            <div className="panel-heading compact"><div><p>Request controls</p><h2>Next safe action</h2></div><LayoutDashboard /></div>
            <div className="safe-action-list">
              <div className="done"><span><Check size={14} /></span><p><strong>Request approved</strong><small>Named approver · 10:18 AM</small></p></div>
              <div className={acceptedDonors.length ? "done" : ""}><span>{acceptedDonors.length ? <Check size={14} /> : "2"}</span><p><strong>Donors responding</strong><small>{acceptedDonors.length} accepted so far</small></p></div>
              <div className={confirmedCount ? "active" : ""}><span>3</span><p><strong>Confirm controlled travel</strong><small>Primary slots plus standby only</small></p></div>
              <div className={request.status === "REQUEST_FULFILLED" ? "done" : ""}><span>4</span><p><strong>Record outcomes & close</strong><small>Remaining donors auto-notified</small></p></div>
            </div>
            <button className="button button-danger button-full" disabled={request.status !== "OPEN_FOR_DONORS"} onClick={() => { setActionReason("Clinical requirement withdrawn"); setActionDialog({ kind: "cancel" }); }} type="button">Cancel request</button>
            <p className="micro-warning">Cancellation requires a reason and writes an audit event.</p>
          </article>

          <article className="panel audit-card">
            <div className="panel-heading compact">
              <div><p>Server record</p><h2>Recent audit events</h2></div>
              <ScrollText />
            </div>
            <div className="audit-feed">
              {auditEvents.length ? (
                auditEvents.slice(0, 5).map((event) => (
                  <div className="audit-row" key={event.id}>
                    <span className={`audit-role audit-${event.actorRole}`}>
                      {event.actorRole.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{auditActionLabel(event.action)}</strong>
                      <small>{event.actorRole} · {event.requestId}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-audit">
                  <ScrollText size={18} />
                  <p>{syncMode === "server" ? "No user actions recorded yet." : "Audit history is temporarily unavailable."}</p>
                </div>
              )}
            </div>
            <p className="audit-mode">
              {syncMode === "server" ? "Secure account activity" : "Temporarily offline"}
            </p>
          </article>

          <article className="panel boundary-card">
            <div className="panel-heading compact"><div><p>Clinical boundary</p><h2>Hospital decides</h2></div><Stethoscope /></div>
            <p>RaktSetu coordinates communication. Your licensed blood centre remains responsible for identity, history, screening, collection and testing.</p>
            <div className="boundary-badges"><span>Medical officer</span><span>Unit testing</span><span>Counselling</span></div>
          </article>
        </aside>
      </div>
      {actionDialog && (
        <div className="workflow-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeActionDialog(); }}>
          <form aria-labelledby="workflow-dialog-title" aria-modal="true" className="workflow-dialog" noValidate onSubmit={submitActionDialog} ref={actionFormRef} role="dialog">
            <div className="workflow-dialog-heading">
              <div>
                <p>{actionDialog.kind === "cancel" ? "Request action" : "Donor workflow"}</p>
                <h2 id="workflow-dialog-title">
                  {actionDialog.kind === "cancel"
                    ? "Cancel this request?"
                    : actionDialog.kind === "confirm"
                      ? `Confirm ${actionDialog.donor.name} to travel?`
                      : actionDialog.kind === "temporary"
                        ? `Record temporary deferral for ${actionDialog.donor.name}`
                        : `Record permanent deferral for ${actionDialog.donor.name}`}
                </h2>
              </div>
              <button aria-label="Close action form" onClick={closeActionDialog} type="button"><X size={18} /></button>
            </div>

            {actionDialog.kind === "confirm" && (
              <>
                <div className="workflow-dialog-summary"><Users size={18} /><span><strong>{remainingTravelSlots} travel slot{remainingTravelSlots === 1 ? "" : "s"} currently available</strong><small>Acceptance order #{actionDialog.donor.acceptedOrder ?? "—"}</small></span></div>
                {actionDialog.requiresQueueOverride ? (
                  <label className={validationClass(Boolean(actionReason.trim()), actionReason.trim().length >= 10, actionTouched, actionSubmitted)}><RequiredFieldText>Queue override reason</RequiredFieldText>
                    <textarea aria-invalid={actionReason.trim().length < 10 && (actionTouched || actionSubmitted)} autoFocus maxLength={300} minLength={10} onBlur={() => setActionTouched(true)} onChange={(event) => { setActionTouched(true); setActionReason(event.target.value); }} placeholder="Explain why an earlier responder is being passed over. This is written to the audit trail." required rows={4} value={actionReason} />
                    <small className="field-feedback">{actionReason.trim().length >= 10 ? "Reason is ready for the audit trail." : `${Math.max(0, 10 - actionReason.trim().length)} more character${Math.max(0, 10 - actionReason.trim().length) === 1 ? "" : "s"} required.`}</small>
                  </label>
                ) : <p className="workflow-dialog-note">This donor is first in the current response queue. No override reason is required.</p>}
              </>
            )}

            {actionDialog.kind === "cancel" && (
              <label className={validationClass(Boolean(actionReason.trim()), actionReason.trim().length >= 5, actionTouched, actionSubmitted)}><RequiredFieldText>Cancellation reason</RequiredFieldText>
                <textarea aria-invalid={actionReason.trim().length < 5 && (actionTouched || actionSubmitted)} autoFocus maxLength={300} minLength={5} onBlur={() => setActionTouched(true)} onChange={(event) => { setActionTouched(true); setActionReason(event.target.value); }} placeholder="Record why the clinical request is being withdrawn." required rows={4} value={actionReason} />
                <small>Required for the audit trail. Remaining donors will be told not to travel.</small>
                <small className="field-feedback">{actionReason.trim().length >= 5 ? "Cancellation reason is ready to record." : `${Math.max(0, 5 - actionReason.trim().length)} more character${Math.max(0, 5 - actionReason.trim().length) === 1 ? "" : "s"} required.`}</small>
              </label>
            )}

            {(actionDialog.kind === "temporary" || actionDialog.kind === "permanent") && (
              <label className="field-valid"><RequiredFieldText>Restricted outcome category</RequiredFieldText>
                <select autoFocus onChange={(event) => setOutcomeCode(event.target.value)} required value={outcomeCode}>
                  {actionDialog.kind === "temporary" ? (
                    <>
                      <option value="LOW_HAEMOGLOBIN">Low haemoglobin</option>
                      <option value="RECENT_ILLNESS">Recent illness</option>
                      <option value="MEDICATION_REVIEW">Medication review</option>
                      <option value="OTHER_TEMPORARY">Other temporary deferral</option>
                    </>
                  ) : (
                    <>
                      <option value="CLINICAL_PERMANENT_DEFERRAL">Clinical permanent deferral</option>
                      <option value="TTI_CONFIRMED">Confirmed transfusion-transmitted infection flag</option>
                      <option value="OTHER_PERMANENT">Other permanent deferral</option>
                    </>
                  )}
                </select>
                <small>The confidential clinical explanation remains inside the blood centre.</small>
              </label>
            )}

            <div className="workflow-dialog-actions">
              <button className="button button-ghost" onClick={closeActionDialog} type="button">Go back</button>
              <button
                className={actionDialog.kind === "cancel" || actionDialog.kind === "permanent" ? "button button-danger" : "button button-primary"}
                type="submit"
              >
                {actionDialog.kind === "cancel" ? "Cancel request" : actionDialog.kind === "confirm" ? "Confirm travel" : "Record outcome"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DistrictView({
  demo,
  onDecideOverride,
  requestBusy,
  workspace,
}: {
  demo: DemoState;
  onDecideOverride: (
    overrideId: string,
    decision: "APPROVE" | "REJECT",
  ) => void;
  requestBusy: boolean;
  workspace: HospitalWorkspace | null;
}) {
  const fulfilled = demo.request.status === "REQUEST_FULFILLED" ? 1 : 0;
  const pendingOverrides =
    workspace?.emergencyOverrides.filter((item) => item.status === "PENDING") ?? [];
  const activeOverrides =
    workspace?.emergencyOverrides.filter((item) => item.status === "APPROVED") ?? [];
  const hospitals = [
    { name: "Sanjeevani City Hospital", open: demo.request.status === "OPEN_FOR_DONORS" ? 1 : 0, fulfilled: 8 + fulfilled, rate: 86 },
    { name: "Lok Bandhu Hospital", open: 2, fulfilled: 6, rate: 74 },
    { name: "KGMU Blood Centre", open: 1, fulfilled: 11, rate: 91 },
    { name: "Balrampur Hospital", open: 0, fulfilled: 5, rate: 68 },
  ];
  const districtAlerts = [
    {
      tone: "amber",
      icon: Clock3,
      title: "2 requests over 90 minutes",
      summary: "Review hospital response workflow. No donor identity exposed.",
      scope: "KGMU Blood Centre · RS-KGMU-2048; Lok Bandhu Hospital · RS-LBH-1172",
      period: "Open-request age measured from approval to the current illustrative snapshot",
    },
    {
      tone: "red",
      icon: Droplets,
      title: "Platelet response below baseline",
      summary: "District aggregate is 14% below the weekly average.",
      scope: "Lucknow district · platelet requests across participating hospitals",
      period: "Rolling seven-day response rate compared with the preceding four-week baseline",
    },
    {
      tone: "green",
      icon: CheckCircle2,
      title: "Notification delivery operating normally",
      summary: "No queued app or SMS delivery failures in this illustrative dataset.",
      scope: "All four participating hospitals",
      period: "Delivery events recorded during the past 60 minutes",
    },
  ];

  return (
    <div className="district-content">
      <section className="privacy-banner">
        <LockKeyhole size={22} />
        <div><strong>Aggregate oversight only</strong><p>This view contains no donor names, phone numbers, precise locations, screening results or patient identity.</p></div>
        <span>Privacy boundary active</span>
      </section>

      <article className="panel emergency-override-centre">
        <div className="override-centre-heading">
          <div>
            <p>District-controlled exception path</p>
            <h2>Emergency outreach overrides</h2>
            <span>
              Request-specific, named approval with an automatic four-hour expiry.
              This never overrides donor safety or clinical screening.
            </span>
          </div>
          <div className="district-approver-chip">
            <ShieldCheck size={17} />
            <span>
              <small>Decision persona</small>
              <strong>
                {workspace?.districtAuthority.memberships[0]?.displayName ??
                  "Loading district authorization…"}
              </strong>
            </span>
          </div>
        </div>

        <div className="override-centre-summary">
          <span>
            <strong>{pendingOverrides.length}</strong> awaiting decision
          </span>
          <span>
            <strong>{activeOverrides.length}</strong> active override
          </span>
          <span>
            <strong>
              {workspace?.rateLimit.usage.concurrentOpenRequests ?? "—"} / {workspace?.rateLimit.policy.maxConcurrentOpenRequests ?? "—"}
            </strong>{" "}
            hospital outreach load
          </span>
        </div>

        {pendingOverrides.length ? (
          <div className="override-decision-list">
            {pendingOverrides.map((override) => (
              <div className="override-decision-card" key={override.id}>
                <div className="override-decision-topline">
                  <span>{override.bloodGroup}</span>
                  <div>
                    <small>{override.requestCode}</small>
                    <strong>
                      {override.hospitalName} · {override.component}
                    </strong>
                  </div>
                  <em>{override.unitsRequired} units</em>
                </div>
                <dl>
                  <div>
                    <dt>Emergency category</dt>
                    <dd>{emergencyOverrideReasonLabel(override.reasonCode)}</dd>
                  </div>
                  <div>
                    <dt>Requested by</dt>
                    <dd>{override.requestedByName}</dd>
                  </div>
                </dl>
                <p>{override.justification}</p>
                <div className="override-decision-actions">
                  <button
                    className="button button-danger"
                    disabled={requestBusy}
                    onClick={() => onDecideOverride(override.id, "REJECT")}
                    type="button"
                  >
                    Reject
                    <X size={15} />
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={requestBusy}
                    onClick={() => onDecideOverride(override.id, "APPROVE")}
                    type="button"
                  >
                    Approve for four hours
                    <Check size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-override-centre">
            <ShieldCheck size={21} />
            <div>
              <strong>No emergency override awaiting decision</strong>
              <p>
                Hospitals remain inside their configured outreach quota unless a
                checker submits a documented exception.
              </p>
            </div>
          </div>
        )}

        {activeOverrides.map((override) => (
          <div className="active-override-row" key={override.id}>
            <CheckCircle2 size={17} />
            <span>
              <strong>{override.requestCode} is temporarily open</strong>
              <small>
                Approved by {override.decidedByName} · expires {override.expiresAt
                  ? new Date(override.expiresAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </small>
            </span>
          </div>
        ))}
      </article>

      <section className="stats-grid district-stats">
        <StatCard icon={Activity} label="Open requests" value={demo.request.status === "OPEN_FOR_DONORS" ? "4" : "3"} detail="Across 4 participating hospitals" tone="red" />
        <StatCard icon={CheckCircle2} label="Fulfilled today" value={String(30 + fulfilled)} detail="Median fulfilment 64 minutes" tone="green" />
        <StatCard icon={Users} label="Donor responses" value={String(86 + demo.request.donors.filter((d) => d.acceptedOrder).length)} detail="61% accepted or declined" tone="blue" />
        <StatCard icon={PhoneCall} label="Delivery health" value="98.7%" detail="App and SMS delivery" />
      </section>
      <div className="dataset-boundary"><Info size={15} /><span><strong>Illustrative operational snapshot</strong> Metrics and alerts below show the intended district experience until live hospital feeds are connected. Snapshot: 12 Oct 2026 · 10:30 AM IST.</span></div>

      <div className="content-grid district-grid">
        <section className="primary-column">
          <article className="panel district-chart-card">
            <div className="panel-heading">
              <div><p>Last 7 days</p><h2>Request fulfilment trend</h2></div>
              <div className="chart-legend"><span className="legend-green" /> Fulfilled <span className="legend-red" /> Open</div>
            </div>
            <div className="bar-chart" aria-label="Seven day request fulfilment chart">
              {[{ day: "Sat", done: 62, open: 18 }, { day: "Sun", done: 46, open: 24 }, { day: "Mon", done: 78, open: 14 }, { day: "Tue", done: 69, open: 22 }, { day: "Wed", done: 84, open: 11 }, { day: "Thu", done: 72, open: 16 }, { day: "Today", done: 88, open: demo.request.status === "OPEN_FOR_DONORS" ? 13 : 8 }].map((item) => (
                <div className="bar-column" key={item.day}>
                  <div className="bar-stack"><span className="bar-open" style={{ height: `${item.open}%` }} /><span className="bar-done" style={{ height: `${item.done}%` }} /></div>
                  <small>{item.day}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel hospital-performance-card">
            <div className="panel-heading"><div><p>Network participation</p><h2>Hospital operations</h2></div><Building2 /></div>
            <div className="performance-table">
              <div className="performance-head"><span>Hospital</span><span>Open</span><span>Fulfilled today</span><span>Response health</span></div>
              {hospitals.map((hospital) => (
                <div className="performance-row" key={hospital.name}>
                  <strong>{hospital.name}</strong><span>{hospital.open}</span><span>{hospital.fulfilled}</span>
                  <div className="mini-progress"><span style={{ width: `${hospital.rate}%` }} /><small>{hospital.rate}%</small></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="secondary-column">
          <article className="panel district-alerts">
            <div className="panel-heading compact"><div><p>Operational signals</p><h2>Needs attention</h2></div><AlertCircle /></div>
            {districtAlerts.map((alert) => {
              const AlertIcon = alert.icon;
              return (
                <details className={`district-alert ${alert.tone}`} key={alert.title}>
                  <summary>
                    <span><AlertIcon size={17} /></span>
                    <div><strong>{alert.title}</strong><p>{alert.summary}</p></div>
                    <ChevronRight size={15} />
                  </summary>
                  <div className="district-alert-drilldown">
                    <span><strong>Affected scope</strong>{alert.scope}</span>
                    <span><strong>Measurement</strong>{alert.period}</span>
                    <span><strong>Last refreshed</strong>12 Oct 2026 · 10:30 AM IST · illustrative data</span>
                  </div>
                </details>
              );
            })}
          </article>

          <article className="panel governance-card">
            <div className="panel-heading compact"><div><p>Role boundary</p><h2>Oversight, not medicine</h2></div><ShieldCheck /></div>
            <ul>
              <li><Check size={15} /> View district aggregates</li>
              <li><Check size={15} /> Track hospital participation</li>
              <li><Check size={15} /> Escalate operational delays</li>
              <li><Check size={15} /> Decide time-limited outreach overrides</li>
              <li className="blocked"><X size={15} /> No donor identities</li>
              <li className="blocked"><X size={15} /> No clinical decisions</li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  );
}
