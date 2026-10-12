import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";
import {
  approveBloodRequest,
  HospitalAccessError,
} from "@/lib/hospital-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      membershipId?: unknown;
      requestId?: unknown;
    };
    if (
      typeof payload.membershipId !== "string" ||
      typeof payload.requestId !== "string"
    ) {
      return Response.json(
        { error: "A staff membership and request are required." },
        { status: 400 },
      );
    }

    await getOrCreateDemoSession(user.userId);
    const result = await approveBloodRequest({
      userId: user.userId,
      membershipId: payload.membershipId,
      requestId: payload.requestId,
    });
    return Response.json({
      ...result,
      notice: result.overrideRequired
        ? "Independent hospital approval recorded. Outreach is paused by the hospital quota; submit a reasoned district override for this request."
        : "Independent approval recorded. The request is now open to the matched donor pool.",
    });
  } catch (error) {
    if (error instanceof HospitalAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to approve the request.";
    return Response.json({ error: message }, { status: 500 });
  }
}
