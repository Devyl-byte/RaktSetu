import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  applyDemoAction,
  DemoDomainError,
  isDemoAction,
} from "@/lib/demo-engine";
import {
  getOrCreateDemoSession,
  saveDemoSession,
} from "@/lib/demo-repository";
import { demoAadhaarProvider } from "@/lib/identity-providers";
import {
  getDonorSafetyAssessment,
  recordDonorSafetyOutcome,
} from "@/lib/donor-safety-repository";
import {
  assertRequestOutreachAvailable,
  bootstrapHospitalWorkspace,
  HospitalAccessError,
  requireHospitalMembership,
  syncWorkflowRequestStatus,
} from "@/lib/hospital-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      action?: unknown;
      expectedRevision?: unknown;
    };
    if (!isDemoAction(payload.action)) {
      return Response.json({ error: "Invalid demonstration action." }, { status: 400 });
    }
    if (!Number.isInteger(payload.expectedRevision)) {
      return Response.json({ error: "A valid revision is required." }, { status: 400 });
    }

    const session = await getOrCreateDemoSession(user.userId);
    if (session.revision !== payload.expectedRevision) {
      return Response.json(
        { error: "The session changed. Reloading the latest state is required." },
        { status: 409 },
      );
    }

    if (
      payload.action.type === "TRANSITION_DONOR" ||
      payload.action.type === "CANCEL_REQUEST"
    ) {
      await bootstrapHospitalWorkspace(user.userId);
      await requireHospitalMembership(
        user.userId,
        payload.action.membershipId,
        ["BLOOD_BANK_OPERATOR", "BLOOD_BANK_APPROVER"],
      );
    }

    if (payload.action.type === "VERIFY_DEMO_IDENTITY") {
      const challenge = await demoAadhaarProvider.startVerification("aarav-demo");
      await demoAadhaarProvider.completeVerification(
        challenge.challengeId,
        "aarav-demo",
      );
    }

    if (payload.action.type === "ACCEPT_INVITATION") {
      await assertRequestOutreachAvailable({
        userId: user.userId,
        requestCode: session.state.request.id,
      });
      const donor = session.state.request.donors.find(
        (item) => item.id === session.state.currentDonorId,
      );
      if (!donor) {
        return Response.json(
          { error: "The synthetic donor was not found." },
          { status: 404 },
        );
      }
      const { assessment } = await getDonorSafetyAssessment({
        userId: user.userId,
        donor,
        requestedDonationType: session.state.request.collectionMethod,
      });
      if (assessment.status !== "POTENTIALLY_CONTACTABLE") {
        return Response.json(
          {
            error:
              "This invitation cannot be accepted while the connected-network contact status is paused or requires blood-centre review.",
            contactStatus: assessment.status,
            nextContactAt: assessment.nextContactAt,
          },
          { status: 422 },
        );
      }
    }

    if (
      payload.action.type === "TRANSITION_DONOR" &&
      payload.action.nextStage === "HOSPITAL_CONFIRMED_TO_TRAVEL"
    ) {
      await assertRequestOutreachAvailable({
        userId: user.userId,
        requestCode: session.state.request.id,
      });
      const donorId = payload.action.donorId;
      const donor = session.state.request.donors.find(
        (item) => item.id === donorId,
      );
      if (!donor) {
        return Response.json(
          { error: "The synthetic donor was not found." },
          { status: 404 },
        );
      }
      const { assessment } = await getDonorSafetyAssessment({
        userId: user.userId,
        donor,
        requestedDonationType: session.state.request.collectionMethod,
      });
      if (assessment.status !== "POTENTIALLY_CONTACTABLE") {
        return Response.json(
          {
            error:
              "Travel cannot be confirmed while the connected-network contact status is paused or requires blood-centre review.",
            contactStatus: assessment.status,
            nextContactAt: assessment.nextContactAt,
          },
          { status: 422 },
        );
      }
    }

    const result = applyDemoAction(session.state, payload.action);
    const revision = await saveDemoSession({
      userId: user.userId,
      expectedRevision: session.revision,
      state: result.state,
      role: payload.action.role,
      action: payload.action.type,
      detail: result.auditDetail,
    });

    if (!revision) {
      return Response.json(
        { error: "The session changed during this action. Reload and try again." },
        { status: 409 },
      );
    }

    if (payload.action.type === "TRANSITION_DONOR") {
      const transitionAction = payload.action;
      const donor = result.state.request.donors.find(
        (item) => item.id === transitionAction.donorId,
      );
      if (donor) {
        await recordDonorSafetyOutcome({
          userId: user.userId,
          membershipId: transitionAction.membershipId,
          donor,
          nextStage: transitionAction.nextStage,
          donationType: result.state.request.collectionMethod,
          sourceRequestCode: result.state.request.id,
          outcomeReasonCode: transitionAction.outcomeReasonCode,
          redCellReinfusionStatus:
            transitionAction.redCellReinfusionStatus,
        });
      }
    }

    if (
      result.state.request.status === "CANCELLED" ||
      result.state.request.status === "REQUEST_FULFILLED"
    ) {
      await syncWorkflowRequestStatus({
        userId: user.userId,
        requestCode: result.state.request.id,
        status: result.state.request.status,
      });
    }

    return Response.json({
      state: result.state,
      revision,
      notice: result.notice,
      storage: "d1",
    });
  } catch (error) {
    if (error instanceof HospitalAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof DemoDomainError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unable to perform action.";
    return Response.json({ error: message }, { status: 500 });
  }
}
