import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";
import {
  bootstrapHospitalWorkspace,
  HospitalAccessError,
} from "@/lib/hospital-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    await getOrCreateDemoSession(user.userId);
    const workspace = await bootstrapHospitalWorkspace(user.userId);
    return Response.json({ workspace });
  } catch (error) {
    if (error instanceof HospitalAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to load hospital access.";
    return Response.json({ error: message }, { status: 500 });
  }
}
