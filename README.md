# RaktSetu

RaktSetu is a demonstration-stage blood-donor coordination platform for donors, participating hospital blood centres, and district oversight teams.

Public MVP: [raktsetu-mvp.mr-devyanshuagrawal.chatgpt.site](https://raktsetu-mvp.mr-devyanshuagrawal.chatgpt.site/)

> **Important:** This repository is not approved for clinical use or live emergencies. It is not connected to UIDAI, eRaktKosh, a hospital HIS/LIS, an OTP gateway, or a clinical data source. Use only synthetic data.

## Repository status

The `raktsetu` branch is a clean, history-free snapshot of the latest working version. It contains the current frontend, API routes, persistence layer, database migrations, business rules, audit flow, location dataset, build system, and deployment configuration. Previous proposal drafts, starter examples, unused UI scaffolding, and default template assets are intentionally excluded.

## What is implemented

### Public and donor experience

- Public donor-first homepage following the finalized blood-red and white visual system.
- Donor registration and sign-in journeys with simulated OTP acceptance.
- Profile creation with:
  - country fixed to India;
  - Uttar Pradesh rollout restriction;
  - district and searchable postal-area selection;
  - Uttar Pradesh PIN validation and PIN-based location autofill;
  - date-of-birth and minimum-age checks;
  - previous-donation question, date, and collection method;
  - explicit handling when the previous donation method is unknown.
- Required-field markers, live valid/invalid feedback, and automatic focus on the first invalid field.
- Donor availability, notification preference, request selection, skip-for-now, accept, decline, travel-confirmation, check-in, donation, and deferral screens.
- Blood-group, location, availability, notification, stage, and contact-readiness filtering.
- Hospital requests are never rewritten to match a donor profile.
- Donors are described as contactable candidates, not medically eligible donors.

### Hospital blood-centre workspace

- Organization-bound institutional access experience.
- Separate request-maker and request-checker roles.
- Structured requests for blood component, group, quantity, urgency, case reference, and collection method.
- Maker-checker separation: a maker cannot approve their own request.
- First-come response queue with:
  - primary slots limited to remaining units;
  - explicit standby donors;
  - standby promotion when a slot reopens;
  - authorized order override only with a recorded reason.
- Hospital-controlled travel confirmation.
- Check-in, successful donation, temporary deferral, permanent deferral, cancellation, and request-closure workflows.
- Automatic closure and notification of donors who are no longer needed.
- Per-hospital outreach limits and blocked-over-limit requests.

### District oversight

- Aggregate district dashboard without donor identity, phone number, precise location, screening result, or patient identity.
- Hospital/request drill-down for operational alerts.
- Time-stamped reporting periods and network health indicators.
- District emergency outreach override with:
  - named decision-maker;
  - categorized justification;
  - request-specific approval;
  - four-hour automatic expiry;
  - complete audit trail.
- An outreach override never bypasses donor safety, consent, clinical screening, hospital confirmation, or privacy controls.

### Backend and durability

- Next.js/Vinext application with React and TypeScript.
- Cloudflare Worker-compatible API routes.
- Cloudflare D1 schema and committed Drizzle migrations.
- Signed-in synthetic sessions for hosted demonstrations.
- Server-side action validation and optimistic revision checks.
- Append-only audit events for state-changing actions.
- Browser-local fallback when the demonstration API is unavailable.
- Versioned contact-readiness rules covering whole blood, plateletpheresis, and plasmapheresis.
- Conservative “medical review required” outcomes whenever the available information is insufficient.
- Replaceable synthetic identity-provider interface; the current Aadhaar flow does not accept or store a real Aadhaar number.
- Locally vendored Three.js module used by the visual experience.

## Demonstration boundaries

The following are simulated:

- mobile OTP delivery and verification;
- Aadhaar/identity verification;
- hospital and district staff identities;
- patient cases, donors, requests, outcomes, and audit records;
- notifications;
- hospital screening and blood testing;
- district authorization;
- eRaktKosh and hospital-system integration.

RaktSetu currently coordinates a workflow demonstration. It does not diagnose, determine final donor eligibility, allocate blood, guarantee availability, or replace the licensed blood centre’s medical officer.

## Approvals required before real-world use

These items require external authorization or formal institutional adoption and cannot be completed by code alone.

### Government and blood-transfusion governance

- Written pilot participation from the relevant State Blood Transfusion Council and participating licensed blood centres.
- Formal definition of district oversight authority and whether the District Magistrate, a delegated nodal officer, or another body operates the district role.
- Approval of operating procedures, escalation paths, audit access, grievance handling, and emergency-override policy.
- Agreement with the appropriate authorities for any eRaktKosh integration and permitted API/data use.

### Identity and Aadhaar

- An approved lawful purpose and privacy review for identity verification.
- UIDAI-compliant onboarding through the applicable AUA/Sub-AUA or KUA/Sub-KUA arrangement.
- Approval of the exact authentication/e-KYC flow, consent language, data fields, retention, security controls, audits, and vendor relationship.
- Use of approved UID tokens or domain identifiers instead of a permanent Aadhaar-derived hash.
- A non-Aadhaar access path where required by law or policy.

Until those approvals exist, the identity adapter must remain synthetic and no real Aadhaar number may be collected.

### Clinical approval

- Review and adoption of every donation-interval and contact-readiness rule by qualified transfusion-medicine professionals.
- Hospital-approved pre-donation screening, testing, deferral, adverse-event, counselling, and donor-notification procedures.
- Formal rules for recording unusable donations and restricted health outcomes without exposing sensitive details.
- Clinical validation of HIS/LIS interfaces and outcome codes.
- Confirmation that the platform remains a communication layer and that final eligibility is decided at every visit by the licensed blood centre.

### Privacy, legal, and security

- Identification of data fiduciary/controller and processor roles.
- Data-protection impact assessment, lawful-purpose analysis, consent/notice review, retention schedule, deletion process, access/correction process, and grievance mechanism.
- Contracts and data-sharing agreements with hospitals, identity providers, communication providers, and hosting operators.
- Independent threat modelling, secure-code review, vulnerability assessment/penetration testing, and remediation sign-off.
- Production identity and access management, least-privilege roles, staff lifecycle controls, key management, secret rotation, encryption review, security monitoring, incident response, backups, and disaster-recovery exercises.

### Pilot and operations

- Approved hospitals, named operational owners, 24/7 escalation contacts, training, support responsibilities, and liability allocation.
- Approved communication channel and templates for SMS/app/other notifications.
- Measurable pilot success and safety criteria, reporting cadence, suspension criteria, and post-pilot review.

## Engineering still required for production

After the approvals above define the permitted design, production engineering must add or complete:

- real staff account provisioning, organization tenancy, MFA, recovery, and de-provisioning;
- approved OTP and identity-provider integrations;
- reliable notification outbox with retries, deduplication, delivery receipts, consent controls, and quiet-hours policy;
- production HIS/LIS and approved eRaktKosh adapters;
- configurable, formally versioned clinical and outreach policies;
- automated unit, integration, state-machine, migration, accessibility, load, and security tests;
- production observability, alerting, audit export, backup/restore, disaster recovery, and incident tooling;
- formal data-retention/deletion jobs and user-rights workflows;
- multi-hospital onboarding and district-to-hospital authorization management;
- clinical-safety and privacy acceptance testing before any governed pilot.

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm ci
npm run dev
```

Open the local address printed by the development server.

Validation and production build:

```bash
npm run lint
npm run build
```

After changing `db/schema.ts`:

```bash
npm run db:generate
```

Commit the generated migration with the schema change.

## Main structure

- `app/page.tsx` — public, donor, hospital, and district product experience.
- `components/raktsetu-access.tsx` — access, registration, profile, and help journeys.
- `components/raktsetu-reference-landing.tsx` — public landing and interactive workflow.
- `app/api/` — authenticated demonstration APIs.
- `lib/demo-engine.ts` — role-aware workflow state transitions.
- `lib/hospital-repository.ts` — hospital authorization, request policy, maker-checker, and district override persistence.
- `lib/donor-safety.ts` — versioned contact-readiness rules.
- `lib/form-validation.ts` — shared live validation and first-invalid-field focus.
- `db/schema.ts` and `drizzle/` — durable schema and migrations.
- `data/up-postal-directory.json` — Uttar Pradesh PIN, district, and postal-area data.
- `.openai/hosting.json` — hosted Site binding.

## Clinical references informing the demonstration

- [MoHFW National Standards for Blood Centres](https://clinicalestablishments.mohfw.gov.in/sites/default/files/2023-03/1491_0.pdf)
- [DGHS/NBTC Transfusion Medicine Technical Manual, 2023](https://dghs.mohfw.gov.in/uploads/assets/QxrLHZs7kH7VIBtakQ3Xxt7xjy4rfUdzffPWNnam.pdf)

These references inform demonstration rules only. They do not constitute approval or clinical adoption.

