import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";
import { getDonorSafetyAssessment } from "@/lib/donor-safety-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const session = await getOrCreateDemoSession(user.userId);
    const donor = session.state.request.donors.find(
      (item) => item.id === session.state.currentDonorId,
    );
    if (!donor) {
      return Response.json(
        { error: "The synthetic donor was not found." },
        { status: 404 },
      );
    }
    const result = await getDonorSafetyAssessment({
      userId: user.userId,
      donor,
      requestedDonationType: session.state.request.collectionMethod,
    });
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to evaluate recorded donation intervals.";
    return Response.json({ error: message }, { status: 500 });
  }
}
