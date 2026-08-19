import { assertTransition, type PaymentRequestStatus } from "@tron-payments/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { paymentRequests } from "../db/schema/index.js";
import type { AuditService } from "./audit.service.js";
import type { PaymentRequestService } from "./payment-request.service.js";
import type { TronRpcService } from "./tron-rpc.service.js";

export class BroadcastService {
  constructor(
    private readonly tronRpc: TronRpcService,
    private readonly paymentRequests: PaymentRequestService,
    private readonly audit: AuditService,
  ) {}

  async broadcast(input: {
    paymentRequestId: string;
    actorUserId: string;
    threshold: number;
    configValid: boolean;
  }) {
    if (!input.configValid) {
      throw new Error("Treasury configuration invalid — broadcast blocked");
    }

    const record = await this.paymentRequests.getById(input.paymentRequestId);
    if (!record) throw new Error("Payment request not found");

    if (record.status === "BROADCASTED" || record.status === "CONFIRMED") {
      return { record, idempotent: true };
    }

    if (record.status !== "READY_TO_BROADCAST") {
      throw new Error(`Cannot broadcast from status ${record.status}`);
    }

    if (record.expirationAt <= new Date()) {
      await db
        .update(paymentRequests)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(eq(paymentRequests.id, record.id));
      throw new Error("Transaction expired");
    }

    const signWeight = await this.paymentRequests.getSignWeight(
      input.paymentRequestId,
      input.threshold,
    );
    if (!signWeight.sufficient) {
      throw new Error("Insufficient on-chain signature weight");
    }

    assertTransition(
      record.status as PaymentRequestStatus,
      "BROADCASTING",
    );

    await db
      .update(paymentRequests)
      .set({
        status: "BROADCASTING",
        updatedAt: new Date(),
        version: record.version + 1,
      })
      .where(
        and(
          eq(paymentRequests.id, record.id),
          eq(paymentRequests.version, record.version),
        ),
      );

    await this.audit.record(
      "BROADCAST_STARTED",
      { actorUserId: input.actorUserId, actorRole: "executor" },
      { paymentRequestId: record.id },
    );

    try {
      const result = await this.tronRpc.broadcastTransaction(
        record.rawTransactionJson as Record<string, unknown>,
      );

      if (!result.result) {
        throw new Error(result.message ?? result.code ?? "Broadcast failed");
      }

      const [updated] = await db
        .update(paymentRequests)
        .set({
          status: "BROADCASTED",
          broadcastTxId: record.txId,
          broadcastedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentRequests.id, record.id))
        .returning();

      await this.audit.record(
        "BROADCAST_SUCCEEDED",
        { actorUserId: input.actorUserId, actorRole: "executor" },
        {
          paymentRequestId: record.id,
          after: { txId: record.txId, result },
        },
      );

      return { record: updated, idempotent: false, result };
    } catch (err) {
      await db
        .update(paymentRequests)
        .set({
          status: "BROADCAST_FAILED",
          failureReason: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(paymentRequests.id, record.id));

      await this.audit.record(
        "BROADCAST_FAILED",
        { actorUserId: input.actorUserId, actorRole: "executor" },
        {
          paymentRequestId: record.id,
          after: {
            error: err instanceof Error ? err.message : String(err),
          },
        },
      );

      throw err;
    }
  }
}
