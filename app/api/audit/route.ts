import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getRecentAuditEvents } from "@/lib/demo-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const events = await getRecentAuditEvents(user.userId);
    return Response.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load audit events.";
    return Response.json({ error: message }, { status: 500 });
  }
}

