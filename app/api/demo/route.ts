import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getOrCreateDemoSession } from "@/lib/demo-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const session = await getOrCreateDemoSession(user.userId);
    return Response.json({
      ...session,
      actor: {
        displayName: user.displayName,
        email: user.email,
      },
      storage: "d1",
      roleMode: "simulation",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load demo session.";
    return Response.json({ error: message }, { status: 500 });
  }
}

