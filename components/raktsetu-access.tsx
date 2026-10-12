"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Droplets,
  FileCheck,
  Fingerprint,
  HeartHandshake,
  History,
  Hospital,
  ListChecks,
  LockKeyhole,
  MapPin,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { AppRole, CollectionMethod } from "@/lib/demo-domain";
import {
  focusFirstInvalidField,
  validationClass,
} from "@/lib/form-validation";

const RaktSetuReferenceLanding = lazy(() =>
  import("@/components/raktsetu-reference-landing").then((module) => ({
    default: module.RaktSetuReferenceLanding,
  })),
);

export type AccessScreen =
  | "boot"
  | "landing"
  | "sign-in"
  | "register"
  | "verify-otp"
  | "onboarding"
  | "staff"
  | "workspace"
  | "account";

export type AuthMode = "sign-in" | "register" | "staff";

export type AuthDraft = {
  mode: AuthMode;
  phone: string;
  staffRole: "hospital" | "district";
  organization: string;
  staffId: string;
};

export type AccountProfile = {
  id: string;
  role: AppRole;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  country: string;
  state: string;
  city: string;
  district: string;
  area: string;
  pincode: string;
  donatedBefore: "yes" | "no" | "";
  lastDonationDate: string;
  lastDonationType: CollectionMethod | "UNKNOWN" | "";
  language: string;
  available: boolean;
  notifications: boolean;
  aadhaarVerified: boolean;
  organization?: string;
  staffId?: string;
};

export const emptyProfile = (phone = ""): AccountProfile => ({
  id: "",
  role: "donor",
  fullName: "",
  phone,
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  country: "India",
  state: "Uttar Pradesh",
  city: "",
  district: "",
  area: "",
  pincode: "",
  donatedBefore: "",
  lastDonationDate: "",
  lastDonationType: "",
  language: "English",
  available: true,
  notifications: true,
  aadhaarVerified: false,
});

export function normalizeAccountProfile(
  value: Partial<AccountProfile>,
): AccountProfile {
  const base = emptyProfile(value.phone ?? "");
  const area = value.area ?? value.city ?? "";
  return {
    ...base,
    ...value,
    country: value.country || base.country,
    state: value.state || base.state,
    area,
    city: area,
    donatedBefore:
      value.donatedBefore === "yes" || value.donatedBefore === "no"
        ? value.donatedBefore
        : "",
    lastDonationDate: value.lastDonationDate ?? "",
    lastDonationType:
      value.lastDonationType === "WHOLE_BLOOD" ||
      value.lastDonationType === "PLATELETPHERESIS" ||
      value.lastDonationType === "PLASMAPHERESIS" ||
      value.lastDonationType === "UNKNOWN"
        ? value.lastDonationType
        : "",
  };
}

type LandingProps = {
  onRegister: () => void;
  onSignIn: () => void;
  onStaff: () => void;
};

type JourneyId = "donor" | "hospital" | "district";

type JourneyStep = {
  title: string;
  shortTitle: string;
  actor: string;
  description: string;
  details: string[];
  guardrail: string;
  status: string;
  icon: typeof ArrowRight;
};

const journeyLabels: Record<JourneyId, { label: string; description: string }> = {
  donor: {
    label: "Donor journey",
    description: "From account creation to a safely recorded donation outcome.",
  },
  hospital: {
    label: "Hospital operations",
    description: "The maker–checker workflow from clinical request to closure.",
  },
  district: {
    label: "District oversight",
    description: "Aggregate monitoring and controlled emergency overrides.",
  },
};

const journeySteps: Record<JourneyId, JourneyStep[]> = {
  donor: [
    {
      shortTitle: "Create account",
      title: "Create a donor account",
      actor: "Donor",
      description: "Start with a mobile number so RaktSetu can create one contactable donor profile.",
      details: [
        "Choose Join as a donor from the public homepage.",
        "Enter a mobile number and agree to receive relevant coordination messages.",
        "The production service will apply consent, retention and identity controls.",
      ],
      guardrail: "Creating an account does not declare a person medically eligible to donate.",
      status: "Account started",
      icon: UserRound,
    },
    {
      shortTitle: "Verify contact",
      title: "Confirm the mobile number",
      actor: "Donor + system",
      description: "A one-time password confirms that the donor controls the number used for notifications.",
      details: [
        "The MVP accepts any entered OTP so the complete journey can be tested.",
        "Production will use an approved OTP provider with attempt limits and expiry.",
        "A changed mobile number must be verified again before it replaces the old one.",
      ],
      guardrail: "OTP proves control of a phone number; it is not medical or identity verification.",
      status: "Contact verified",
      icon: Phone,
    },
    {
      shortTitle: "Build profile",
      title: "Complete the donor profile",
      actor: "Donor",
      description: "Provide the minimum information needed for relevant outreach and communication.",
      details: [
        "Add name, date of birth, declared blood group and preferred language.",
        "Choose an Uttar Pradesh district and postal area, or enter the PIN first to fill both automatically.",
        "Turn availability and notifications on or off at any time.",
      ],
      guardrail: "A self-declared blood group is only a matching hint until the blood centre verifies it.",
      status: "Profile ready",
      icon: ListChecks,
    },
    {
      shortTitle: "Verify record",
      title: "Connect one verified donor record",
      actor: "Donor + approved identity service",
      description: "Identity verification is designed to prevent duplicate verified profiles across participating hospitals.",
      details: [
        "First-time donors may enter the journey before physical verification.",
        "The first participating blood-centre visit can establish the verified clinical record.",
        "Live Aadhaar authentication remains behind an approved provider and authorization layer.",
      ],
      guardrail: "RaktSetu will not store a plain Aadhaar number or use it as the public donor identifier.",
      status: "Verification path",
      icon: Fingerprint,
    },
    {
      shortTitle: "Receive request",
      title: "Receive a relevant blood request",
      actor: "Hospital → donor",
      description: "An approved hospital request is matched to potentially contactable donors by component, group, area and availability.",
      details: [
        "The notification shows the requesting blood centre, component, urgency and approximate area.",
        "Only the minimum information required to make a decision is shown.",
        "The donor can ignore or decline without losing access to the platform.",
      ],
      guardrail: "A notification is an invitation to respond—not an instruction to travel.",
      status: "Request received",
      icon: BellRing,
    },
    {
      shortTitle: "Respond",
      title: "Accept or decline from home",
      actor: "Donor",
      description: "The donor gives request-specific consent before entering the hospital response queue.",
      details: [
        "Accept places the response into a first-come queue for that request.",
        "Decline closes the invitation without requiring a medical explanation.",
        "The donor can see that hospital confirmation is still pending.",
      ],
      guardrail: "Acceptance does not reserve blood, guarantee donation or confirm eligibility.",
      status: "Response recorded",
      icon: HeartHandshake,
    },
    {
      shortTitle: "Wait in queue",
      title: "Wait while the hospital confirms need",
      actor: "Hospital + system",
      description: "Accepted donors stay in a controlled queue while the hospital confirms how many people should travel.",
      details: [
        "Responses are ordered by acceptance time, with transparent stage changes.",
        "The hospital confirms only the number currently needed and keeps others as backup.",
        "If the requirement changes, waiting donors receive an immediate update.",
      ],
      guardrail: "No route or travel instruction is released while the donor is only in the response queue.",
      status: "Awaiting hospital",
      icon: Clock,
    },
    {
      shortTitle: "Travel confirmed",
      title: "Travel only after hospital confirmation",
      actor: "Hospital → donor",
      description: "A selected donor receives a clear confirmation, reporting window and blood-centre destination.",
      details: [
        "The message states the hospital, reporting desk, time window and contact channel.",
        "The donor can withdraw if circumstances change before departure.",
        "Other accepted donors remain informed and are not asked to travel unnecessarily.",
      ],
      guardrail: "Confirmation authorizes a visit for screening; it still does not declare medical eligibility.",
      status: "Travel confirmed",
      icon: Navigation,
    },
    {
      shortTitle: "Screen & donate",
      title: "Complete blood-centre screening",
      actor: "Licensed blood centre",
      description: "Hospital staff verify the donor and perform the required history, haemoglobin, vital and clinical checks.",
      details: [
        "The blood centre—not RaktSetu—makes the final donation decision.",
        "The visit may end in donation, temporary deferral, permanent deferral or no collection.",
        "Collection and infectious-disease testing remain within regulated blood-bank procedures.",
      ],
      guardrail: "RaktSetu coordinates communication and records outcomes; it does not diagnose or replace screening.",
      status: "Clinical screening",
      icon: Stethoscope,
    },
    {
      shortTitle: "Close the loop",
      title: "Record the outcome and update readiness",
      actor: "Hospital + system",
      description: "The hospital records a restricted outcome and the system closes every open notification safely.",
      details: [
        "A completed donation updates the donation history and the applicable cooldown window.",
        "A deferral stores only the controlled category and next-safe date needed for future matching.",
        "All donors still waiting are told that the request is fulfilled, changed or cancelled.",
      ],
      guardrail: "Sensitive clinical details stay role-restricted and are never shown to other donors.",
      status: "Outcome recorded",
      icon: History,
    },
  ],
  hospital: [
    {
      shortTitle: "Staff access",
      title: "Open a role-scoped blood-centre workspace",
      actor: "Authorized hospital staff",
      description: "Only approved blood-bank personnel use the institutional workspace assigned to their hospital.",
      details: [
        "The user signs in with their institution and staff identity.",
        "Membership controls which hospital and actions the staff member can access.",
        "Every meaningful action is attributed to a staff role in the audit trail.",
      ],
      guardrail: "A registered hospital does not automatically authorize every employee.",
      status: "Staff authenticated",
      icon: Hospital,
    },
    {
      shortTitle: "Maker drafts",
      title: "The maker creates a clinical request",
      actor: "Blood-bank operator — maker",
      description: "The maker enters the component, group, units, urgency and internal case reference.",
      details: [
        "Required fields prevent an incomplete request from entering outreach.",
        "The case reference stays linked to the hospital’s own clinical record.",
        "The request remains pending and cannot notify donors yet.",
      ],
      guardrail: "RaktSetu carries the hospital’s request; it does not independently assert clinical need.",
      status: "Draft pending",
      icon: FileCheck,
    },
    {
      shortTitle: "Checker reviews",
      title: "An independent checker approves or returns it",
      actor: "Medical officer / authorized checker",
      description: "A second authorized person validates the request before donor outreach begins.",
      details: [
        "The checker reviews case reference, component, group, units and urgency.",
        "They can approve, reject or return the request for correction.",
        "Maker and checker identities are stored separately in the audit record.",
      ],
      guardrail: "The maker cannot self-approve the same request in the production role model.",
      status: "Independent review",
      icon: ShieldCheck,
    },
    {
      shortTitle: "Policy check",
      title: "Apply hospital outreach limits",
      actor: "System policy engine",
      description: "Before opening outreach, the system checks the hospital’s rate limit and current request pressure.",
      details: [
        "Normal requests consume the configured hospital outreach allowance.",
        "Duplicate or overlapping requests can be surfaced for review.",
        "A blocked emergency request can enter the district override path.",
      ],
      guardrail: "Rate limits reduce unnecessary mass contact; they do not silently cancel clinical requests.",
      status: "Policy evaluated",
      icon: Activity,
    },
    {
      shortTitle: "Match & notify",
      title: "Contact suitable donors in controlled waves",
      actor: "System → potentially contactable donors",
      description: "Matching uses the hospital request, donor availability, area and recorded safety intervals.",
      details: [
        "Only donors relevant to the request enter the outreach set.",
        "Notifications can be released in waves instead of contacting everyone at once.",
        "Delivery, acceptance and expiry states are tracked without exposing donors to one another.",
      ],
      guardrail: "The match is operational, not a declaration that the donor can donate that day.",
      status: "Outreach active",
      icon: Send,
    },
    {
      shortTitle: "Queue responses",
      title: "Manage first-come donor responses",
      actor: "Blood-bank team",
      description: "Accepted donors enter a visible stage-one response queue until the hospital confirms travel.",
      details: [
        "Acceptance order is preserved so staff can coordinate consistently.",
        "The hospital sees response state, not unrestricted medical histories.",
        "Declined, expired and unreachable responses are separated from active candidates.",
      ],
      guardrail: "Stage one means available to contact; it must never be displayed as medically eligible.",
      status: "Responses queued",
      icon: Users,
    },
    {
      shortTitle: "Confirm travel",
      title: "Confirm only the donors currently required",
      actor: "Authorized hospital staff",
      description: "Staff move selected donors into travel-confirmed status while keeping remaining responders informed.",
      details: [
        "The number confirmed is tied to the current unit requirement and response plan.",
        "Reporting instructions unlock only for selected donors.",
        "If a confirmed donor withdraws, the next suitable responder can be contacted.",
      ],
      guardrail: "The workflow prevents ten accepted donors being told to travel for a two-unit requirement.",
      status: "Visits coordinated",
      icon: Navigation,
    },
    {
      shortTitle: "Record screening",
      title: "Record arrival, screening and collection outcome",
      actor: "Licensed blood-centre staff",
      description: "The hospital records whether the donor arrived and the restricted result of the clinical process.",
      details: [
        "Arrival is recorded before screening or collection outcomes.",
        "Donation type and relevant reinfusion status support interval calculation.",
        "Deferrals use controlled categories rather than free-text diagnoses.",
      ],
      guardrail: "Only the blood centre can mark screening and donation outcomes.",
      status: "Outcome captured",
      icon: Stethoscope,
    },
    {
      shortTitle: "Close request",
      title: "Fulfil, cancel or safely close the request",
      actor: "Hospital + system",
      description: "Once the clinical requirement is met or withdrawn, the hospital closes the request and every donor branch.",
      details: [
        "Waiting donors receive a no-longer-needed, fulfilled or cancelled notice.",
        "Completion metrics and handoff times remain available for operational review.",
        "The final state, staff actor and reason are preserved in the audit history.",
      ],
      guardrail: "RaktSetu does not promise blood availability; it records the hospital-controlled outcome.",
      status: "Request closed",
      icon: Check,
    },
  ],
  district: [
    {
      shortTitle: "Monitor system",
      title: "View district-level operational health",
      actor: "District Magistrate / authorized nodal office",
      description: "The district view shows participating hospitals, request pressure and response performance without exposing donor lists.",
      details: [
        "See active, fulfilled, cancelled and rate-limited request counts.",
        "Review response and fulfilment times by hospital, component and blood group.",
        "Operational alerts highlight bottlenecks requiring coordination.",
      ],
      guardrail: "District oversight is aggregate; clinical decisions and donor screening remain with hospitals.",
      status: "District overview",
      icon: Building2,
    },
    {
      shortTitle: "Limit reached",
      title: "A hospital reaches its outreach limit",
      actor: "System policy engine",
      description: "A new approved request is held when normal outreach capacity has been exhausted.",
      details: [
        "The hospital sees the applicable limit and why outreach is paused.",
        "The clinical request remains recorded instead of disappearing.",
        "A genuine emergency can be escalated through the controlled override process.",
      ],
      guardrail: "The platform never bypasses a limit merely because a request is marked urgent.",
      status: "Outreach paused",
      icon: AlertTriangle,
    },
    {
      shortTitle: "Request override",
      title: "The hospital checker requests an emergency override",
      actor: "Hospital checker",
      description: "The checker submits a structured reason, linked request and limited extension for district review.",
      details: [
        "The submission identifies the affected hospital and request.",
        "A controlled emergency reason and concise operational justification are required.",
        "The requested allowance and expiry are bounded rather than open-ended.",
      ],
      guardrail: "An override request does not activate extra outreach until the district decision is recorded.",
      status: "Review requested",
      icon: Send,
    },
    {
      shortTitle: "District review",
      title: "The district authority reviews the exception",
      actor: "District Magistrate / delegated authorized reviewer",
      description: "The reviewer assesses the hospital, linked case, current pressure, prior use and requested duration.",
      details: [
        "The dashboard shows the decision inputs without exposing unnecessary donor data.",
        "The reviewer may approve, reject or let the request expire.",
        "A decision note becomes part of the immutable operational history.",
      ],
      guardrail: "The district authority governs outreach capacity; it does not determine donor eligibility.",
      status: "Under review",
      icon: FileCheck,
    },
    {
      shortTitle: "Timed decision",
      title: "Approve a narrow, time-limited exception",
      actor: "District authority + system",
      description: "Approval temporarily raises the hospital’s outreach allowance only for the authorized scope.",
      details: [
        "The allowance, start time, expiry and approving officer are explicit.",
        "A rejection leaves the standard limit in place and notifies the hospital.",
        "The system prevents the exception from becoming a permanent entitlement.",
      ],
      guardrail: "No approval removes maker–checker review or other hospital safeguards.",
      status: "Decision recorded",
      icon: ShieldCheck,
    },
    {
      shortTitle: "Controlled release",
      title: "Release and monitor emergency outreach",
      actor: "System + hospital",
      description: "The approved temporary capacity is applied and the hospital continues through normal matching and queue controls.",
      details: [
        "The dashboard shows how much of the exception has been used.",
        "Donor notifications still follow consent, matching and travel-confirmation rules.",
        "District staff can see operational progress without entering the clinical workflow.",
      ],
      guardrail: "Emergency mode increases bounded outreach; it does not broadcast donor identities.",
      status: "Exception active",
      icon: Activity,
    },
    {
      shortTitle: "Expire & audit",
      title: "Expire the override and review its outcome",
      actor: "System + district oversight",
      description: "The exception closes automatically at expiry and remains available for accountability and policy review.",
      details: [
        "Unused temporary allowance is removed automatically.",
        "The decision, duration, outreach use and request result stay in the audit trail.",
        "Repeated exceptions can inform hospital support or revised district policy.",
      ],
      guardrail: "Expiry is automatic; hospitals cannot silently extend their own exception.",
      status: "Override closed",
      icon: History,
    },
  ],
};

function JourneyIllustration({ journey, step }: { journey: JourneyId; step: JourneyStep }) {
  const Icon = step.icon;
  return (
    <div className={`journey-device journey-device-${journey}`} aria-label={`${step.title} illustration`}>
      <div className="journey-device-top">
        <span>9:41</span>
        <span><Activity size={12} /> ●●●</span>
      </div>
      <div className="journey-device-header">
        <span className="journey-mini-mark"><Droplets size={14} fill="currentColor" /></span>
        <strong>RaktSetu</strong>
        <span className="journey-secure"><LockKeyhole size={12} /> Secure</span>
      </div>
      <div className="journey-scene">
        <div className="journey-scene-orbit" />
        <div className="journey-scene-icon"><Icon size={34} strokeWidth={1.8} /></div>
        <span>{step.actor}</span>
        <strong>{step.status}</strong>
      </div>
      <div className="journey-screen-copy">
        <small>Current step</small>
        <h4>{step.shortTitle}</h4>
        <p>{step.description}</p>
      </div>
      <div className="journey-screen-status">
        <Check size={14} /> State recorded in the workflow
      </div>
    </div>
  );
}

export function PublicLanding(props: LandingProps) {
  return (
    <Suspense fallback={<AccessSplash />}>
      <RaktSetuReferenceLanding {...props} />
    </Suspense>
  );
}

export function PublicLandingLegacy({ onRegister, onSignIn, onStaff }: LandingProps) {
  const [journey, setJourney] = useState<JourneyId>("donor");
  const [activeStep, setActiveStep] = useState(0);
  const steps = journeySteps[journey];
  const step = steps[activeStep];

  function selectJourney(next: JourneyId) {
    setJourney(next);
    setActiveStep(0);
  }

  function moveStep(direction: -1 | 1) {
    setActiveStep((current) => {
      const next = current + direction;
      if (next < 0) return steps.length - 1;
      if (next >= steps.length) return 0;
      return next;
    });
  }

  return (
    <div className="public-site reference-theme">
      <header className="public-header">
        <button className="public-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
          <span className="public-brand-mark"><Droplets size={23} fill="currentColor" /></span>
          <span><strong>RaktSetu</strong><small>रक्त सेतु</small></span>
        </button>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How to use</a>
          <a href="#trust">Safety & privacy</a>
        </nav>
        <div className="public-actions">
          <button className="text-action" onClick={onStaff} type="button">Institutional login</button>
          <button className="text-action" onClick={onSignIn} type="button">Sign in</button>
          <button className="primary-action compact" onClick={onRegister} type="button">Join as a donor</button>
        </div>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <p className="eyebrow"><span /> A public coordination bridge for safer blood donation</p>
            <h1>From your first hello to someone&apos;s <em>second chance.</em></h1>
            <p className="hero-lead">
              RaktSetu connects potentially contactable donors with participating blood centres, keeps every response visible, and asks you to travel only after the hospital confirms the need.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={onRegister} type="button">
                Join as a donor <ArrowRight size={18} />
              </button>
              <button className="secondary-action" onClick={onSignIn} type="button">I already have an account</button>
            </div>
            <div className="hero-assurances">
              <span><Check size={15} /> Respond from home</span>
              <span><Check size={15} /> Hospital-confirmed travel</span>
              <span><Check size={15} /> Consent-led contact</span>
            </div>
          </div>

          <div className="hero-reference-visual" aria-label="Illustration of a safe donor request journey">
            <div className="hero-device">
              <div className="hero-device-bar"><span>9:41</span><strong>RaktSetu</strong><span>●●●</span></div>
              <div className="hero-device-screen">
                <div className="hero-request-heading"><span className="request-blood">O+</span><div><small>New request</small><strong>Packed red cells</strong></div></div>
                <div className="hero-map-card">
                  <span className="hero-map-route" />
                  <span className="hero-map-home"><UserRound size={15} /></span>
                  <span className="hero-map-hospital"><Hospital size={15} /></span>
                </div>
                <div className="request-location"><MapPin size={17} /><span><strong>Sanjeevani City Hospital</strong>Near your selected area</span></div>
                <div className="request-rule"><Clock size={19} /><span><strong>Wait for confirmation</strong>Accept from home. Travel details come later.</span></div>
                <button onClick={onRegister} type="button">Review request <ChevronRight size={17} /></button>
              </div>
            </div>
            <div className="hero-flow-note hero-flow-note-one"><Check size={14} /><span><strong>Response accepted</strong>Waiting for hospital</span></div>
            <div className="hero-flow-note hero-flow-note-two"><Navigation size={14} /><span><strong>Travel locked</strong>Until confirmed</span></div>
          </div>
        </section>

        <section className="public-proof" aria-label="RaktSetu principles">
          <span>Designed for district coordination</span>
          <span>Hospital-led screening</span>
          <span>Auditable request handoffs</span>
          <span>Privacy by default</span>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-intro">
            <p>Help & how to use</p>
            <h2>See the complete process before you take part.</h2>
            <span>Choose a journey, open each step and see who acts, what changes, and which safeguard remains in control.</span>
          </div>

          <div className="journey-tabs" role="tablist" aria-label="RaktSetu process journeys">
            {(Object.keys(journeyLabels) as JourneyId[]).map((item) => (
              <button
                aria-selected={journey === item}
                className={journey === item ? "active" : ""}
                key={item}
                onClick={() => selectJourney(item)}
                role="tab"
                type="button"
              >
                <span>{item === "donor" ? <HeartHandshake /> : item === "hospital" ? <Hospital /> : <Building2 />}</span>
                <div><strong>{journeyLabels[item].label}</strong><small>{journeyLabels[item].description}</small></div>
              </button>
            ))}
          </div>

          <div className="journey-track" aria-label={`${journeyLabels[journey].label} steps`}>
            {steps.map((item, index) => (
              <button
                aria-current={index === activeStep ? "step" : undefined}
                className={index === activeStep ? "active" : index < activeStep ? "complete" : ""}
                key={item.shortTitle}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <span>{index < activeStep ? <Check size={14} /> : String(index + 1).padStart(2, "0")}</span>
                <strong>{item.shortTitle}</strong>
              </button>
            ))}
          </div>

          <div className="journey-stage" role="tabpanel">
            <JourneyIllustration journey={journey} step={step} />

            <article className="journey-detail">
              <div className="journey-detail-meta"><span>Step {activeStep + 1} of {steps.length}</span><strong>{step.actor}</strong></div>
              <h3>{step.title}</h3>
              <p className="journey-detail-lead">{step.description}</p>
              <div className="journey-detail-list">
                {step.details.map((detail) => <p key={detail}><Check size={16} />{detail}</p>)}
              </div>
              <div className="journey-guardrail"><ShieldCheck size={21} /><div><strong>Safeguard at this step</strong><span>{step.guardrail}</span></div></div>
              <div className="journey-controls">
                <button onClick={() => moveStep(-1)} type="button"><ArrowLeft size={17} /> Previous</button>
                <span>{steps.map((_, index) => <i className={index === activeStep ? "active" : ""} key={index} />)}</span>
                <button onClick={() => moveStep(1)} type="button">{activeStep === steps.length - 1 ? "Replay" : "Next"} <ArrowRight size={17} /></button>
              </div>
            </article>
          </div>

          <div className="journey-nonnegotiables">
            <p><ShieldCheck /><span><strong>Potentially contactable—not medically eligible</strong>Final eligibility is decided at every visit by the licensed blood centre.</span></p>
            <p><Clock /><span><strong>Accept first, travel only after confirmation</strong>The response queue prevents unnecessary donor travel and over-response.</span></p>
            <p><FileCheck /><span><strong>Every institutional handoff is accountable</strong>Maker, checker, district exception and hospital outcome are recorded separately.</span></p>
          </div>
        </section>

        <section className="trust-section" id="trust">
          <div className="trust-visual">
            <div className="trust-shield"><LockKeyhole size={34} /></div>
            <div><span>Private by design</span><strong>Your identity is not exposed to other donors.</strong></div>
          </div>
          <div className="trust-copy">
            <p>Built around informed participation</p>
            <h2>Coordination never replaces clinical judgment.</h2>
            <p>RaktSetu identifies potentially contactable donors. Final eligibility is always determined at the licensed blood centre after identity, history and medical screening.</p>
            <ul>
              <li><ShieldCheck /> Role-scoped institutional access</li>
              <li><Fingerprint /> One verified donor record across participating centres</li>
              <li><MapPin /> Approximate-area matching until travel is confirmed</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-brand"><span className="public-brand-mark"><Droplets size={20} fill="currentColor" /></span><span><strong>RaktSetu</strong><small>Government-supported public infrastructure platform</small></span></div>
        <p>RaktSetu coordinates communication. Clinical screening remains with licensed blood centres.</p>
        <button onClick={onStaff} type="button">Institutional access</button>
      </footer>
    </div>
  );
}

type AccessCardProps = {
  draft: AuthDraft;
  error: string;
  screen: AccessScreen;
  onBack: () => void;
  onDraftChange: (next: AuthDraft) => void;
  onRequestOtp: () => void;
  onVerifyOtp: (otp: string) => void;
  onSwitchMode: (mode: "sign-in" | "register") => void;
};

function RequiredFieldLabel({ children }: { children: string }) {
  return <span className="field-label">{children} <span className="required-mark" aria-hidden="true">*</span></span>;
}

export function AccessCard({
  draft,
  error,
  screen,
  onBack,
  onDraftChange,
  onRequestOtp,
  onVerifyOtp,
  onSwitchMode,
}: AccessCardProps) {
  const [otp, setOtp] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [localError, setLocalError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isStaff = draft.mode === "staff" || screen === "staff";
  const title = screen === "verify-otp"
    ? "Enter the OTP"
    : isStaff
      ? "Institutional access"
      : draft.mode === "register"
        ? "Create your donor account"
        : "Welcome back";

  function resetValidation() {
    setSubmitted(false);
    setTouched(new Set());
    setLocalError("");
    setOtp("");
  }

  const phoneValid = /^[6-9]\d{9}$/.test(draft.phone);
  const organizationValid = draft.organization.trim().length >= 2;
  const staffIdValid = draft.staffId.trim().length >= 2;
  const otpValid = otp.trim().length > 0;

  function markTouched(name: string) {
    setTouched((current) => new Set(current).add(name));
  }

  function revealInvalid(message: string) {
    setSubmitted(true);
    setLocalError(message);
    focusFirstInvalidField(formRef.current);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screen === "verify-otp") {
      if (!otpValid) {
        revealInvalid("Enter the one-time password to continue.");
        return;
      }
      setLocalError("");
      onVerifyOtp(otp);
      return;
    }
    if (isStaff && !organizationValid) {
      revealInvalid("Enter the institution assigned to this staff account.");
      return;
    }
    if (isStaff && !staffIdValid) {
      revealInvalid("Enter a valid staff ID.");
      return;
    }
    if (!phoneValid) {
      revealInvalid("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setLocalError("");
    setSubmitted(false);
    setTouched(new Set());
    onRequestOtp();
  }

  return (
    <div className="access-page">
      <button className="access-back" onClick={() => { resetValidation(); onBack(); }} type="button"><ArrowLeft size={17} /> Back</button>
      <section className="access-card">
        <div className="access-brand"><span className="public-brand-mark"><Droplets size={22} fill="currentColor" /></span><strong>RaktSetu</strong></div>
        <div className="access-icon">{isStaff ? <Building2 /> : screen === "verify-otp" ? <LockKeyhole /> : <HeartHandshake />}</div>
        <p className="eyebrow">{isStaff ? "Authorized personnel only" : "Donor access"}</p>
        <h1>{title}</h1>
        <p className="access-description">
          {screen === "verify-otp"
            ? `We sent a one-time password to ${draft.phone}.`
            : isStaff
              ? "Sign in to the workspace assigned to your institution and role."
              : draft.mode === "register"
                ? "Start with your mobile number. Your donor profile comes next."
                : "Use the mobile number connected to your RaktSetu account."}
        </p>

        <p className="required-note"><span>*</span> Required fields</p>
        <form noValidate onSubmit={submit} ref={formRef}>
          {isStaff && screen !== "verify-otp" && (
            <>
              <div className="role-choice" aria-label="Institution type">
                <button className={draft.staffRole === "hospital" ? "active" : ""} onClick={() => onDraftChange({ ...draft, staffRole: "hospital" })} type="button"><Hospital /> Hospital</button>
                <button className={draft.staffRole === "district" ? "active" : ""} onClick={() => onDraftChange({ ...draft, staffRole: "district" })} type="button"><Building2 /> District</button>
              </div>
              <label className={validationClass(Boolean(draft.organization.trim()), organizationValid, touched.has("organization"), submitted)}><RequiredFieldLabel>Institution</RequiredFieldLabel>
                <input aria-invalid={!organizationValid && (touched.has("organization") || submitted)} name="organization" onBlur={() => markTouched("organization")} onChange={(event) => { setLocalError(""); onDraftChange({ ...draft, organization: event.target.value }); }} placeholder={draft.staffRole === "hospital" ? "Hospital or blood centre" : "District authority"} required value={draft.organization} />
                {(touched.has("organization") || submitted || organizationValid) && <small className="field-feedback">{organizationValid ? "Institution entered correctly." : "Enter your hospital, blood centre or district authority."}</small>}
              </label>
              <label className={validationClass(Boolean(draft.staffId.trim()), staffIdValid, touched.has("staffId"), submitted)}><RequiredFieldLabel>Staff ID</RequiredFieldLabel>
                <input aria-invalid={!staffIdValid && (touched.has("staffId") || submitted)} name="staffId" onBlur={() => markTouched("staffId")} onChange={(event) => { setLocalError(""); onDraftChange({ ...draft, staffId: event.target.value }); }} placeholder="Enter your staff ID" required value={draft.staffId} />
                {(touched.has("staffId") || submitted || staffIdValid) && <small className="field-feedback">{staffIdValid ? "Staff ID entered correctly." : "Staff ID is required."}</small>}
              </label>
            </>
          )}

          {screen === "verify-otp" ? (
            <label className={validationClass(Boolean(otp.trim()), otpValid, touched.has("otp"), submitted)}><RequiredFieldLabel>One-time password</RequiredFieldLabel>
              <input aria-invalid={!otpValid && (touched.has("otp") || submitted)} autoComplete="one-time-code" autoFocus inputMode="numeric" name="otp" onBlur={() => markTouched("otp")} onChange={(event) => { setLocalError(""); setOtp(event.target.value.replace(/[^0-9]/g, "").slice(0, 6)); }} placeholder="Enter any OTP" required value={otp} />
              {(touched.has("otp") || submitted || otpValid) && <small className="field-feedback">{otpValid ? "Code entered. You can continue." : "Enter the code to continue."}</small>}
            </label>
          ) : (
            <label className={validationClass(Boolean(draft.phone), phoneValid, touched.has("phone"), submitted)}><RequiredFieldLabel>Mobile number</RequiredFieldLabel>
              <div className="phone-input"><span>+91</span><input aria-invalid={!phoneValid && (touched.has("phone") || submitted)} autoComplete="tel" inputMode="tel" name="phone" onBlur={() => markTouched("phone")} onChange={(event) => { setLocalError(""); onDraftChange({ ...draft, phone: event.target.value.replace(/[^0-9]/g, "").slice(0, 10) }); }} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" required value={draft.phone} /></div>
              {(touched.has("phone") || submitted || phoneValid) && <small className="field-feedback">{phoneValid ? "Mobile number format is correct." : "Enter 10 digits beginning with 6, 7, 8 or 9."}</small>}
            </label>
          )}

          {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
          {screen === "verify-otp" && <div className="preview-helper"><BadgeCheck size={16} /><span>OTP delivery connects during rollout. Enter any value to continue here.</span></div>}
          <button className="primary-action full" type="submit">
            {screen === "verify-otp" ? "Verify and continue" : "Send OTP"} <ArrowRight size={18} />
          </button>
        </form>

        {!isStaff && screen !== "verify-otp" && (
          <p className="mode-switch">
            {draft.mode === "register" ? "Already registered?" : "New to RaktSetu?"}
            <button onClick={() => { resetValidation(); onSwitchMode(draft.mode === "register" ? "sign-in" : "register"); }} type="button">
              {draft.mode === "register" ? "Sign in" : "Create an account"}
            </button>
          </p>
        )}
        <small className="access-privacy"><ShieldCheck size={14} /> Your details are used only for account access and donor coordination.</small>
      </section>
    </div>
  );
}

type ProfileFormProps = {
  initial: AccountProfile;
  mode: "create" | "edit";
  onCancel?: () => void;
  onDelete?: () => void;
  onSave: (profile: AccountProfile) => void;
};

type PostalAreaOption = {
  id: string;
  name: string;
  pincode: string;
  delivery: boolean;
};

type LocationPayload = {
  country: string;
  state: string;
  district?: string;
  districts?: string[];
  areas?: PostalAreaOption[];
  selectedAreaId?: string;
  error?: string;
};

function yearsOld(dateOfBirth: string, today = new Date()) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function contactReadyDate(profile: AccountProfile) {
  if (
    profile.donatedBefore !== "yes" ||
    !profile.lastDonationDate ||
    profile.lastDonationType !== "WHOLE_BLOOD"
  ) {
    return null;
  }
  const donatedAt = new Date(`${profile.lastDonationDate}T00:00:00`);
  if (Number.isNaN(donatedAt.getTime())) return null;
  const intervalDays = profile.gender === "Male" ? 90 : 120;
  donatedAt.setDate(donatedAt.getDate() + intervalDays);
  return donatedAt;
}

export function ProfileForm({ initial, mode, onCancel, onDelete, onSave }: ProfileFormProps) {
  const [profile, setProfile] = useState<AccountProfile>(() =>
    normalizeAccountProfile(initial),
  );
  const [error, setError] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerificationPending, setPhoneVerificationPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [districts, setDistricts] = useState<string[]>([]);
  const [areas, setAreas] = useState<PostalAreaOption[]>([]);
  const [areaQuery, setAreaQuery] = useState(() =>
    initial.area && initial.pincode
      ? `${initial.area} · ${initial.pincode}`
      : initial.area ?? "",
  );
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);
  const [pinCheck, setPinCheck] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >(() =>
    initial.district && initial.area && /^\d{6}$/.test(initial.pincode)
      ? "valid"
      : "idle",
  );
  const [pinMessage, setPinMessage] = useState(() =>
    initial.district && initial.area && /^\d{6}$/.test(initial.pincode)
      ? `${initial.district} · ${initial.area} saved and ready to verify.`
      : "",
  );
  const pinLookupSequence = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  const todayValue = useMemo(() => localDateValue(new Date()), []);
  const adultDobLimit = useMemo(() => {
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - 18);
    return localDateValue(limit);
  }, []);
  const age = useMemo(() => yearsOld(profile.dateOfBirth), [profile.dateOfBirth]);
  const ageMessage = useMemo(() => {
    if (age === null) return "You must be at least 18 years old to register as a donor.";
    if (age < 18) return "You are under 18 and cannot continue as a blood donor.";
    if (age > 65) return "Blood donation registration is limited to people aged 18 to 65.";
    if (profile.donatedBefore === "no" && age > 60) {
      return "A first-time donor must be 60 or younger under the current national criteria.";
    }
    return `${age} years old · age requirement met.`;
  }, [age, profile.donatedBefore]);
  const ageValid =
    age !== null &&
    age >= 18 &&
    age <= 65 &&
    !(profile.donatedBefore === "no" && age > 60);
  const readyDate = useMemo(() => contactReadyDate(profile), [profile]);
  const todayTimestamp = useMemo(
    () => new Date(`${todayValue}T23:59:59`).getTime(),
    [todayValue],
  );
  const fullNameValid = profile.fullName.trim().length >= 2;
  const phoneValid = /^\d{10}$/.test(profile.phone);
  const genderValid = Boolean(profile.gender);
  const bloodGroupValid = Boolean(profile.bloodGroup);
  const donationChoiceValid = profile.donatedBefore === "yes" || profile.donatedBefore === "no";
  const lastDonationTypeValid = profile.donatedBefore !== "yes" || Boolean(profile.lastDonationType);
  const lastDonationDateValid = useMemo(() => {
    if (profile.donatedBefore !== "yes") return true;
    if (!profile.lastDonationDate || !profile.dateOfBirth) return false;
    const eighteenthBirthday = new Date(`${profile.dateOfBirth}T00:00:00`);
    eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);
    return profile.lastDonationDate <= todayValue && profile.lastDonationDate >= localDateValue(eighteenthBirthday);
  }, [profile.donatedBefore, profile.lastDonationDate, profile.dateOfBirth, todayValue]);
  const districtValid = Boolean(profile.district);
  const areaValid = Boolean(profile.area && profile.pincode);
  const pincodeValid = /^\d{6}$/.test(profile.pincode) && pinCheck === "valid";
  const phoneOtpValid = !phoneVerificationPending || Boolean(phoneOtp.trim());

  function markTouched(name: string) {
    setTouched((current) => new Set(current).add(name));
  }

  function fieldClass(name: string, hasValue: boolean, valid: boolean) {
    return validationClass(hasValue, valid, touched.has(name), submitted);
  }

  function revealInvalid(message: string) {
    setSubmitted(true);
    setError(message);
    focusFirstInvalidField(formRef.current);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadDistricts() {
      try {
        const response = await fetch("/api/locations/up", {
          signal: controller.signal,
        });
        const payload = (await response.json()) as LocationPayload;
        if (!response.ok) throw new Error(payload.error);
        setDistricts(payload.districts ?? []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError("The Uttar Pradesh district list could not be loaded. Please retry.");
      } finally {
        if (!controller.signal.aborted) setDistrictsLoading(false);
      }
    }
    void loadDistricts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profile.district) return;
    const controller = new AbortController();
    async function loadAreas() {
      setAreasLoading(true);
      try {
        const response = await fetch(
          `/api/locations/up?district=${encodeURIComponent(profile.district)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as LocationPayload;
        if (!response.ok) throw new Error(payload.error);
        setAreas(payload.areas ?? []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setPinMessage("Areas for this district could not be loaded. Please retry.");
      } finally {
        if (!controller.signal.aborted) setAreasLoading(false);
      }
    }
    void loadAreas();
    return () => controller.abort();
  }, [profile.district]);

  function update<K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) {
    setError("");
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function lookupPincode(pincode: string) {
    const lookupId = ++pinLookupSequence.current;
    if (pincode.length !== 6) {
      setPinCheck("idle");
      setPinMessage(
        pincode.length ? "Enter all six digits to check and autofill your area." : "",
      );
      return;
    }
    setPinCheck("checking");
    setPinMessage("Checking this PIN against the Uttar Pradesh postal directory…");
    try {
      const response = await fetch(
        `/api/locations/up?pincode=${encodeURIComponent(pincode)}`,
      );
      const payload = (await response.json()) as LocationPayload;
      if (lookupId !== pinLookupSequence.current) return;
      if (!response.ok || !payload.district || !payload.areas?.length) {
        throw new Error(payload.error ?? "This PIN code is not in Uttar Pradesh.");
      }
      const preferred =
        payload.areas.find((area) => area.id === payload.selectedAreaId) ??
        payload.areas[0];
      setAreas(payload.areas);
      setProfile((current) => ({
        ...current,
        country: payload.country,
        state: payload.state,
        district: payload.district ?? "",
        area: preferred.name,
        city: preferred.name,
        pincode,
      }));
      setAreaQuery(`${preferred.name} · ${pincode}`);
      setPinCheck("valid");
      setPinMessage(
        `${payload.district} · ${preferred.name} filled from PIN ${pincode}.`,
      );
    } catch (lookupError) {
      if (lookupId !== pinLookupSequence.current) return;
      setPinCheck("invalid");
      setPinMessage(
        lookupError instanceof Error
          ? lookupError.message
          : "This PIN code is not in Uttar Pradesh.",
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = normalizeAccountProfile({
      ...profile,
      phone: profile.phone.replace(/[^0-9]/g, "").slice(0, 10),
      fullName: profile.fullName.trim(),
      city: profile.area,
    });
    if (
      !next.fullName ||
      !next.dateOfBirth ||
      !next.gender ||
      !next.bloodGroup ||
      !next.district ||
      !next.area ||
      !next.pincode ||
      next.phone.length !== 10
    ) {
      revealInvalid("Please complete all required fields before continuing.");
      return;
    }
    if (!ageValid) {
      revealInvalid(ageMessage);
      return;
    }
    if (!next.donatedBefore) {
      revealInvalid("Tell us whether you have donated blood before.");
      return;
    }
    if (next.donatedBefore === "yes") {
      if (!next.lastDonationDate) {
        revealInvalid("Enter the date of your most recent donation.");
        return;
      }
      if (!next.lastDonationType) {
        revealInvalid("Choose the type of your most recent donation, or select Not sure.");
        return;
      }
      if (next.lastDonationDate > todayValue) {
        revealInvalid("The last donation date cannot be in the future.");
        return;
      }
      const eighteenthBirthday = new Date(`${next.dateOfBirth}T00:00:00`);
      eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);
      if (next.lastDonationDate < localDateValue(eighteenthBirthday)) {
        revealInvalid("The last donation date must be on or after your 18th birthday.");
        return;
      }
    }
    setPinCheck("checking");
    setPinMessage("Confirming the selected Uttar Pradesh postal area…");
    try {
      const response = await fetch(
        `/api/locations/up?pincode=${encodeURIComponent(next.pincode)}`,
      );
      const payload = (await response.json()) as LocationPayload;
      const areaMatches = payload.areas?.some(
        (area) => area.name === next.area && area.pincode === next.pincode,
      );
      if (!response.ok || payload.district !== next.district || !areaMatches) {
        throw new Error(
          payload.error ?? "Choose the district and area that match this PIN code.",
        );
      }
      setPinCheck("valid");
      setPinMessage(`${next.district} · ${next.area} verified.`);
    } catch (lookupError) {
      setPinCheck("invalid");
      setPinMessage(
        lookupError instanceof Error
          ? lookupError.message
          : "This PIN code is not in Uttar Pradesh.",
      );
      revealInvalid("Enter a valid Uttar Pradesh PIN code and matching area.");
      return;
    }
    if (mode === "edit" && next.phone !== initial.phone && !phoneVerificationPending) {
      setProfile(next);
      setPhoneVerificationPending(true);
      setError("");
      return;
    }
    if (phoneVerificationPending && !phoneOtp.trim()) {
      revealInvalid("Enter the OTP to confirm your new mobile number.");
      return;
    }
    setError("");
    onSave(next);
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="public-brand"><span className="public-brand-mark"><Droplets size={22} fill="currentColor" /></span><span><strong>RaktSetu</strong><small>{mode === "create" ? "Donor registration" : "Account settings"}</small></span></div>
        {onCancel && <button className="secondary-action compact" onClick={onCancel} type="button"><ArrowLeft size={16} /> Back to dashboard</button>}
      </header>
      <main className="profile-layout">
        <aside>
          <p>{mode === "create" ? "Create your profile" : "Your account"}</p>
          <h1>{mode === "create" ? "Tell us how to contact you safely." : "Keep your donor information current."}</h1>
          <div className="profile-progress"><span className="complete"><Check /></span><div><strong>Mobile verified</strong><small>+91 {profile.phone}</small></div></div>
          <div className="profile-progress"><span>2</span><div><strong>Personal details</strong><small>Used for donor coordination</small></div></div>
          <div className="profile-progress"><span>3</span><div><strong>Identity verification</strong><small>{profile.aadhaarVerified ? "Verified donor record linked" : "Identity not yet linked"}</small></div></div>
        </aside>
        <form className="profile-form" noValidate onSubmit={submit} ref={formRef}>
          <div className="form-heading"><UserRound /><div><p>Personal information</p><h2>{mode === "create" ? "Complete your donor profile" : "Edit profile"}</h2></div></div>
          <p className="required-note"><span>*</span> Required fields are checked as you complete them.</p>
          <div className="form-grid">
            {mode === "edit" && <label className={`span-two ${fieldClass("phone", Boolean(profile.phone), phoneValid)}`}><RequiredFieldLabel>Mobile number</RequiredFieldLabel><input aria-invalid={!phoneValid && (touched.has("phone") || submitted)} inputMode="tel" name="phone" onBlur={() => markTouched("phone")} onChange={(event) => { markTouched("phone"); update("phone", event.target.value.replace(/[^0-9]/g, "").slice(0, 10)); }} pattern="[0-9]{10}" placeholder="10-digit mobile number" required value={profile.phone} /><small className="field-feedback">{phoneValid ? "Mobile number format is correct." : "Enter exactly 10 digits."}</small></label>}
            <label className={`span-two ${fieldClass("fullName", Boolean(profile.fullName.trim()), fullNameValid)}`}><RequiredFieldLabel>Full name</RequiredFieldLabel><input aria-invalid={!fullNameValid && (touched.has("fullName") || submitted)} autoComplete="name" name="fullName" onBlur={() => markTouched("fullName")} onChange={(event) => { markTouched("fullName"); update("fullName", event.target.value); }} placeholder="As shown on your identity document" required value={profile.fullName} /><small className="field-feedback">{fullNameValid ? "Name entered correctly." : "Enter at least two characters."}</small></label>
            <label className={fieldClass("dateOfBirth", Boolean(profile.dateOfBirth), ageValid)}><RequiredFieldLabel>Date of birth</RequiredFieldLabel><input aria-invalid={!ageValid && (touched.has("dateOfBirth") || submitted)} max={adultDobLimit} name="dateOfBirth" onBlur={() => markTouched("dateOfBirth")} onChange={(event) => { markTouched("dateOfBirth"); update("dateOfBirth", event.target.value); }} required type="date" value={profile.dateOfBirth} /><small className={`field-status ${profile.dateOfBirth ? (ageValid ? "valid" : "invalid") : ""}`}>{ageMessage}</small></label>
            <label className={fieldClass("gender", Boolean(profile.gender), genderValid)}><RequiredFieldLabel>Gender</RequiredFieldLabel><select aria-invalid={!genderValid && (touched.has("gender") || submitted)} name="gender" onBlur={() => markTouched("gender")} onChange={(event) => { markTouched("gender"); update("gender", event.target.value); }} required value={profile.gender}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select><small className="field-feedback">{genderValid ? "Selection saved." : "Choose an option."}</small></label>
            <label className={fieldClass("bloodGroup", Boolean(profile.bloodGroup), bloodGroupValid)}><RequiredFieldLabel>Blood group</RequiredFieldLabel><select aria-invalid={!bloodGroupValid && (touched.has("bloodGroup") || submitted)} name="bloodGroup" onBlur={() => markTouched("bloodGroup")} onChange={(event) => { markTouched("bloodGroup"); update("bloodGroup", event.target.value); }} required value={profile.bloodGroup}><option value="">Select</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"].map((group) => <option key={group}>{group}</option>)}</select><small className="field-feedback">{bloodGroupValid ? profile.bloodGroup === "Not sure" ? "Hospital verification is required before group-specific matching." : "Blood group selected." : "Choose a blood group or Not sure."}</small></label>
            <label className="field-valid"><RequiredFieldLabel>Preferred language</RequiredFieldLabel><select name="language" onChange={(event) => update("language", event.target.value)} required value={profile.language}><option>English</option><option>हिन्दी</option><option>English + हिन्दी</option></select><small className="field-feedback">Language preference saved.</small></label>
          </div>

          <div className="form-divider" />
          <div className="form-heading"><History /><div><p>Donation history</p><h2>Have you donated before? <span className="required-mark" aria-hidden="true">*</span></h2></div></div>
          <div className={`donation-history-choice ${fieldClass("donatedBefore", donationChoiceValid, donationChoiceValid)}`} data-field-group data-invalid={!donationChoiceValid && (touched.has("donatedBefore") || submitted)} role="group" aria-label="Previous blood donation, required">
            <button className={profile.donatedBefore === "yes" ? "active" : ""} onClick={() => { markTouched("donatedBefore"); update("donatedBefore", "yes"); }} type="button"><Check /> Yes, I have donated</button>
            <button className={profile.donatedBefore === "no" ? "active" : ""} onClick={() => { markTouched("donatedBefore"); setProfile((current) => ({ ...current, donatedBefore: "no", lastDonationDate: "", lastDonationType: "" })); }} type="button">No, this will be my first time</button>
          </div>
          {(touched.has("donatedBefore") || submitted || donationChoiceValid) && <small className={`field-feedback group-feedback ${donationChoiceValid ? "valid" : "invalid"}`}>{donationChoiceValid ? "Donation history choice saved." : "Choose Yes or No before continuing."}</small>}
          {profile.donatedBefore === "yes" && (
            <div className="last-donation-grid">
              <label className={`last-donation-field ${fieldClass("lastDonationType", Boolean(profile.lastDonationType), lastDonationTypeValid)}`}><RequiredFieldLabel>Most recent donation type</RequiredFieldLabel>
                <select aria-invalid={!lastDonationTypeValid && (touched.has("lastDonationType") || submitted)} name="lastDonationType" onBlur={() => markTouched("lastDonationType")} onChange={(event) => { markTouched("lastDonationType"); update("lastDonationType", event.target.value as AccountProfile["lastDonationType"]); }} required value={profile.lastDonationType}>
                  <option value="">Choose donation type</option>
                  <option value="WHOLE_BLOOD">Whole blood</option>
                  <option value="PLATELETPHERESIS">Plateletpheresis</option>
                  <option value="PLASMAPHERESIS">Plasmapheresis</option>
                  <option value="UNKNOWN">Not sure</option>
                </select>
                <small className="field-feedback">{lastDonationTypeValid ? "Donation type recorded." : "Choose a type or Not sure."}</small>
              </label>
              <label className={`last-donation-field ${fieldClass("lastDonationDate", Boolean(profile.lastDonationDate), lastDonationDateValid)}`}><RequiredFieldLabel>Most recent donation date</RequiredFieldLabel>
                <input aria-invalid={!lastDonationDateValid && (touched.has("lastDonationDate") || submitted)} max={todayValue} name="lastDonationDate" onBlur={() => markTouched("lastDonationDate")} onChange={(event) => { markTouched("lastDonationDate"); update("lastDonationDate", event.target.value); }} required type="date" value={profile.lastDonationDate} />
                <small className="field-feedback">{lastDonationDateValid ? "Donation date is within the accepted range." : "Enter a valid past date after your 18th birthday."}</small>
              </label>
              <small className="field-status span-two">
                {profile.lastDonationType === "UNKNOWN"
                  ? "The donation method is uncertain, so contact readiness will require blood-centre review."
                  : profile.lastDonationType && profile.lastDonationType !== "WHOLE_BLOOD"
                    ? "Apheresis history requires blood-centre review because procedure frequency and reinfusion details are not available here."
                    : readyDate
                      ? readyDate.getTime() > todayTimestamp
                        ? `Self-reported whole-blood interval runs until ${readyDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
                        : "The self-reported whole-blood interval has passed; the blood centre will still screen you at every visit."
                      : "This declaration is used only for contact readiness until a participating hospital records a verified donation."}
              </small>
            </div>
          )}

          <div className="form-divider" />
          <div className="form-heading"><MapPin /><div><p>Matching area</p><h2>Where can hospitals contact you?</h2></div></div>
          <div className="form-grid">
            <label>Country<input aria-readonly="true" readOnly value="India" /><small className="field-status">Current rollout</small></label>
            <label>State<input aria-readonly="true" readOnly value="Uttar Pradesh" /><small className="field-status">Other states will be added later.</small></label>
            <label className={fieldClass("district", Boolean(profile.district), districtValid)}><RequiredFieldLabel>District</RequiredFieldLabel><select aria-invalid={!districtValid && (touched.has("district") || submitted)} disabled={districtsLoading} name="district" onBlur={() => markTouched("district")} onChange={(event) => { markTouched("district"); setAreas([]); setAreaQuery(""); setPinCheck("idle"); setPinMessage(""); setProfile((current) => ({ ...current, district: event.target.value, area: "", city: "", pincode: "" })); }} required value={profile.district}><option value="">{districtsLoading ? "Loading districts…" : "Choose district"}</option>{districts.map((district) => <option key={district}>{district}</option>)}</select><small className="field-feedback">{districtValid ? "District selected." : "Choose a district."}</small></label>
            <label className={fieldClass("area", Boolean(areaQuery), areaValid)}><RequiredFieldLabel>Postal area / post office</RequiredFieldLabel>
              <input
                aria-invalid={!areaValid && (touched.has("area") || submitted)}
                disabled={!profile.district || areasLoading}
                list="up-postal-areas"
                name="area"
                onBlur={() => markTouched("area")}
                onChange={(event) => {
                  markTouched("area");
                  const value = event.target.value;
                  setAreaQuery(value);
                  const selected = areas.find((area) => `${area.name} · ${area.pincode}` === value);
                  if (!selected) {
                    setProfile((current) => ({ ...current, area: "", city: "", pincode: "" }));
                    setPinCheck("idle");
                    setPinMessage(value ? "Choose a matching postal area from the searchable list." : "");
                    return;
                  }
                  setProfile((current) => ({ ...current, area: selected.name, city: selected.name, pincode: selected.pincode }));
                  setPinCheck("valid");
                  setPinMessage(`${profile.district} · ${selected.name} selected.`);
                }}
                placeholder={!profile.district ? "Choose district first" : areasLoading ? "Loading postal areas…" : "Type to search postal areas"}
                required
                value={areaQuery}
              />
              <datalist id="up-postal-areas">{areas.map((area) => <option key={area.id} value={`${area.name} · ${area.pincode}`} />)}</datalist>
              <small className="field-feedback">{areaValid ? "Postal area matches the selected PIN." : "Choose an area from the searchable list."}</small>
            </label>
            <label className={`span-two pin-first-field ${pinCheck === "checking" ? "field-checking" : fieldClass("pincode", Boolean(profile.pincode), pincodeValid)}`}><RequiredFieldLabel>PIN code</RequiredFieldLabel><input aria-invalid={!pincodeValid && pinCheck !== "checking" && (touched.has("pincode") || submitted)} autoComplete="postal-code" inputMode="numeric" name="pincode" onBlur={() => markTouched("pincode")} onChange={(event) => { markTouched("pincode"); const pincode = event.target.value.replace(/[^0-9]/g, "").slice(0, 6); update("pincode", pincode); void lookupPincode(pincode); }} pattern="[0-9]{6}" placeholder="Enter PIN first to autofill" required value={profile.pincode} /><small className={`field-status ${pinCheck === "valid" ? "valid" : pinCheck === "invalid" ? "invalid" : ""}`} aria-live="polite">{pinMessage || "Only Uttar Pradesh PIN codes are accepted in the current rollout."}</small></label>
          </div>

          <div className="form-divider" />
          <div className="preference-row"><div><strong>Available to be contacted</strong><span>You can switch this off whenever you need a break.</span></div><button aria-pressed={profile.available} className={`toggle-control ${profile.available ? "active" : ""}`} onClick={() => update("available", !profile.available)} type="button"><span /></button></div>
          <div className="preference-row"><div><strong>Request and status notifications</strong><span>Receive updates for relevant requests and accepted responses.</span></div><button aria-pressed={profile.notifications} className={`toggle-control ${profile.notifications ? "active" : ""}`} onClick={() => update("notifications", !profile.notifications)} type="button"><span /></button></div>

          <div className="identity-placeholder">
            <Fingerprint />
            <div><strong>Aadhaar verification</strong><span>The live connection will use an approved authentication provider. No Aadhaar number is collected in this preview.</span></div>
            <span>Connect later</span>
          </div>

          {phoneVerificationPending && (
            <label className={`phone-verification ${fieldClass("phoneOtp", Boolean(phoneOtp.trim()), phoneOtpValid)}`}><RequiredFieldLabel>Confirm new mobile number</RequiredFieldLabel>
              <input aria-invalid={!phoneOtpValid && (touched.has("phoneOtp") || submitted)} autoComplete="one-time-code" inputMode="numeric" name="phoneOtp" onBlur={() => markTouched("phoneOtp")} onChange={(event) => { markTouched("phoneOtp"); setPhoneOtp(event.target.value.replace(/[^0-9]/g, "").slice(0, 6)); }} placeholder="Enter any OTP" required value={phoneOtp} />
              <small>OTP delivery connects during rollout. Enter any value to verify the change here.</small>
            </label>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions">{onCancel && <button className="secondary-action" onClick={onCancel} type="button">Cancel</button>}<button className="primary-action" type="submit">{mode === "create" ? "Create account" : "Save changes"} <ArrowRight size={17} /></button></div>
          <p className="consent-copy">By continuing, you agree to be contacted for relevant blood donation requests. Accepting a request never confirms medical eligibility or requires you to travel.</p>
          {mode === "edit" && onDelete && (
            <div className="danger-zone"><div><strong>Delete this account</strong><span>Removes the locally stored donor profile and signs you out.</span></div><button onClick={onDelete} type="button">Delete account</button></div>
          )}
        </form>
      </main>
    </div>
  );
}

export function AccessSplash() {
  return <div className="access-splash"><span className="public-brand-mark"><Droplets size={26} fill="currentColor" /></span><strong>RaktSetu</strong><small>Preparing your secure workspace…</small></div>;
}
