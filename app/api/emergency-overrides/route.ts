import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";
import {
  bootstrapHospitalWorkspace,
  decideEmergencyOverride,
  HospitalAccessError,
  requestEmergencyOverride,
} from "@/lib/hospital-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    if (typeof payload.membershipId !== "string") {
      return Response.json(
        { error: "An authorized membership is required." },
        { status: 400 },
      );
    }
    await getOrCreateDemoSession(user.userId);
    await bootstrapHospitalWorkspace(user.userId);

    if (payload.action === "REQUEST") {
      if (typeof payload.requestId !== "string") {
        return Response.json(
          { error: "A rate-limited request is required." },
          { status: 400 },
        );
      }
      const workspace = await requestEmergencyOverride({
        userId: user.userId,
        membershipId: payload.membershipId,
        requestId: payload.requestId,
        override: payload.override,
      });
      return Response.json({
        workspace,
        notice:
          "Emergency override sent to district review. No donor outreach has started.",
      });
    }

    if (payload.action === "DECIDE") {
      if (
        typeof payload.overrideId !== "string" ||
        (payload.decision !== "APPROVE" && payload.decision !== "REJECT")
      ) {
        return Response.json(
          { error: "A pending override and valid decision are required." },
          { status: 400 },
        );
      }
      const result = await decideEmergencyOverride({
        userId: user.userId,
        membershipId: payload.membershipId,
        overrideId: payload.overrideId,
        decision: payload.decision,
      });
      return Response.json({
        ...result,
        notice:
          payload.decision === "APPROVE"
            ? "District override approved for four hours. The request is open to the policy-limited donor pool."
            : "District override rejected. Donor outreach remains paused.",
      });
    }

    return Response.json(
      { error: "Choose a supported emergency-override action." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof HospitalAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error
        ? error.message
        : "Unable to process the emergency override.";
    return Response.json({ error: message }, { status: 500 });
  }
}
