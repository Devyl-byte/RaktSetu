import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { auditEvents, demoSessions } from "@/db/schema";
import {
  createDemoState,
  normalizeDemoState,
  type AppRole,
  type DemoState,
} from "./demo-domain";

export type StoredDemoSession = {
  state: DemoState;
  revision: number;
};

export async function getOrCreateDemoSession(
  userId: string,
): Promise<StoredDemoSession> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(demoSessions)
    .where(eq(demoSessions.userId, userId))
    .limit(1);

  if (existing) {
    return {
      state: normalizeDemoState(JSON.parse(existing.stateJson) as DemoState),
      revision: existing.revision,
    };
  }

  const state = createDemoState();
  await db.insert(demoSessions).values({
    userId,
    stateJson: JSON.stringify(state),
    revision: 1,
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId,
    actorRole: "system",
    action: "SESSION_CREATED",
    requestId: state.request.id,
    detailJson: JSON.stringify({ synthetic: true }),
  });

  return { state, revision: 1 };
}

export async function saveDemoSession(input: {
  userId: string;
  expectedRevision: number;
  state: DemoState;
  role: AppRole;
  action: string;
  detail: Record<string, string | number | boolean>;
}): Promise<number | null> {
  const db = getDb();
  const nextRevision = input.expectedRevision + 1;
  const [updated] = await db
    .update(demoSessions)
    .set({
      stateJson: JSON.stringify(input.state),
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(demoSessions.userId, input.userId),
        eq(demoSessions.revision, input.expectedRevision),
      ),
    )
    .returning({ revision: demoSessions.revision });

  if (!updated) return null;

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorRole: input.role,
    action: input.action,
    requestId: input.state.request.id,
    detailJson: JSON.stringify(input.detail),
  });
  return updated.revision;
}

export async function getRecentAuditEvents(userId: string) {
  const db = getDb();
  return db
    .select({
      id: auditEvents.id,
      actorRole: auditEvents.actorRole,
      action: auditEvents.action,
      requestId: auditEvents.requestId,
      detailJson: auditEvents.detailJson,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(eq(auditEvents.userId, userId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(12);
}
