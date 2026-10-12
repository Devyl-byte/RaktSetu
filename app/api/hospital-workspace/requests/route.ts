import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";
import {
  createBloodRequest,
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
      request?: unknown;
    };
    if (typeof payload.membershipId !== "string") {
      return Response.json(
        { error: "A hospital staff membership is required." },
        { status: 400 },
      );
    }

    await getOrCreateDemoSession(user.userId);
    const workspace = await createBloodRequest({
      userId: user.userId,
      membershipId: payload.membershipId,
      request: payload.request,
    });
    return Response.json({
      workspace,
      notice: "Request saved for independent hospital approval. Donors have not been contacted.",
    });
  } catch (error) {
    if (error instanceof HospitalAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to create the request.";
    return Response.json({ error: message }, { status: 500 });
  }
}
