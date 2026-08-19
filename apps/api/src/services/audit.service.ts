import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditEvents } from "../db/schema/index.js";

export interface AuditContext {
  actorUserId?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class AuditService {
  async record(
    eventType: string,
    context: AuditContext,
    details: {
      paymentRequestId?: string;
      before?: unknown;
      after?: unknown;
    },
  ) {
    const payload = JSON.stringify({
      eventType,
      ...context,
      ...details,
      occurredAt: new Date().toISOString(),
    });
    const immutableEventHash = createHash("sha256")
      .update(payload)
      .digest("hex");

    const [event] = await db
      .insert(auditEvents)
      .values({
        eventType,
        actorUserId: context.actorUserId,
        actorRole: context.actorRole,
        paymentRequestId: details.paymentRequestId,
        beforeStateJson: details.before ?? null,
        afterStateJson: details.after ?? null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId,
        immutableEventHash,
      })
      .returning();

    return event;
  }

  async list(filters: {
    paymentRequestId?: string;
    limit?: number;
  }) {
    const limit = filters.limit ?? 100;
    if (filters.paymentRequestId) {
      return db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.paymentRequestId, filters.paymentRequestId))
        .limit(limit);
    }
    return db.select().from(auditEvents).limit(limit);
  }
}

export function hashSigningToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSigningToken(): string {
  return randomBytes(32).toString("hex");
}
