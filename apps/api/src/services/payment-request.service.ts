import {
  addressesEqual,
  assertTransition,
  nextStatusAfterSignature,
  type PaymentRequestStatus,
  type TreasuryConfig,
} from "@tron-payments/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  paymentRequests,
  signatures,
  signingSessions,
} from "../db/schema/index.js";
import type { AuditService } from "./audit.service.js";
import { hashSigningToken } from "./audit.service.js";
import { TransactionBuilderService } from "./transaction-builder.service.js";
import type { TronRpcService } from "./tron-rpc.service.js";
import { SignatureVerifierService } from "./signature-verifier.service.js";

export interface CreatePaymentRequestInput {
  recipientAddress: string;
  amountDisplay: string;
  purpose: string;
  externalReference: string;
  documentUrl?: string;
  expirationMinutes?: number;
  createdBy: string;
  config: TreasuryConfig;
  configValid: boolean;
}

export class PaymentRequestService {
  private readonly txBuilder: TransactionBuilderService;
  private readonly signatureVerifier: SignatureVerifierService;

  constructor(
    private readonly tronRpc: TronRpcService,
    private readonly audit: AuditService,
  ) {
    this.txBuilder = new TransactionBuilderService(tronRpc);
    this.signatureVerifier = new SignatureVerifierService(tronRpc);
  }

  private assertConfigValid(configValid: boolean) {
    if (!configValid) {
      throw new Error(
        "Treasury configuration validation failed — cannot create or broadcast payments",
      );
    }
  }

  private clampExpirationMinutes(minutes?: number): number {
    const value = minutes ?? 30;
    return Math.min(Math.max(value, 5), 60);
  }

  async create(input: CreatePaymentRequestInput) {
    this.assertConfigValid(input.configValid);

    const expirationMinutes = this.clampExpirationMinutes(input.expirationMinutes);
    const expirationAt = new Date(Date.now() + expirationMinutes * 60_000);

    const [{ nextval }] = await db.execute<{ nextval: number }>(
      sql`SELECT nextval('payment_request_sequence') as nextval`,
    );
    const sequenceNumber = Number(nextval);
    const requestId = `pay_${sequenceNumber}`;

    const built = await this.txBuilder.buildUsdtTransfer({
      requestId,
      recipientAddress: input.recipientAddress,
      amountDisplay: input.amountDisplay,
      expirationAt,
      config: input.config,
    });

    const [record] = await db
      .insert(paymentRequests)
      .values({
        sequenceNumber,
        status: "AWAITING_SIGNATURES",
        network: input.config.network,
        treasuryAddress: input.config.treasuryAddress,
        permissionId: input.config.activePermissionId,
        tokenContractAddress: input.config.usdtContractAddress,
        tokenSymbol: "USDT",
        tokenDecimals: input.config.usdtDecimals,
        recipientAddress: input.recipientAddress,
        amountRaw: built.amountRaw,
        amountDisplay: built.digest.amountDisplay,
        purpose: input.purpose,
        externalReference: input.externalReference,
        documentUrl: input.documentUrl ?? null,
        expirationAt,
        rawTransactionJson: built.rawTransaction,
        rawDataHex: built.rawDataHex,
        txId: built.txId,
        canonicalPayloadJson: built.canonicalPayloadJson,
        canonicalPayloadHash: built.canonicalPayloadHash,
        createdBy: input.createdBy,
      })
      .returning();

    await this.audit.record(
      "REQUEST_CREATED",
      { actorUserId: input.createdBy, actorRole: "requester" },
      {
        paymentRequestId: record.id,
        after: { status: record.status, txId: record.txId },
      },
    );

    return record;
  }

  async getById(id: string) {
    const [record] = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1);
    return record ?? null;
  }

  async list(limit = 50) {
    return db
      .select()
      .from(paymentRequests)
      .orderBy(desc(paymentRequests.createdAt))
      .limit(limit);
  }

  async listAwaitingSignature() {
    return db
      .select()
      .from(paymentRequests)
      .where(
        sql`${paymentRequests.status} IN ('AWAITING_SIGNATURES', 'PARTIALLY_SIGNED')`,
      )
      .orderBy(paymentRequests.expirationAt);
  }

  async getSignatures(paymentRequestId: string) {
    return db
      .select()
      .from(signatures)
      .where(eq(signatures.paymentRequestId, paymentRequestId));
  }

  async cancel(id: string, actorUserId: string, hasSignature: boolean) {
    const record = await this.getById(id);
    if (!record) throw new Error("Payment request not found");

    const nextStatus: PaymentRequestStatus = hasSignature
      ? "CANCELLED_IN_APP"
      : "CANCELLED_IN_APP";

    if (!hasSignature && record.status === "DRAFT") {
      assertTransition(record.status as PaymentRequestStatus, "CANCELLED_IN_APP");
    } else if (
      record.status === "AWAITING_SIGNATURES" ||
      record.status === "PARTIALLY_SIGNED"
    ) {
      assertTransition(record.status as PaymentRequestStatus, "CANCELLED_IN_APP");
    } else {
      throw new Error(`Cannot cancel request in status ${record.status}`);
    }

    const [updated] = await db
      .update(paymentRequests)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
        version: record.version + 1,
      })
      .where(and(eq(paymentRequests.id, id), eq(paymentRequests.version, record.version)))
      .returning();

    await this.audit.record(
      "REQUEST_CANCELLED",
      { actorUserId, actorRole: "requester" },
      {
        paymentRequestId: id,
        before: { status: record.status },
        after: { status: updated.status },
      },
    );

    return updated;
  }

  async createSigningSession(input: {
    paymentRequestId: string;
    userId: string;
    signerAddress: string;
    token: string;
    expiresAt: Date;
  }) {
    await db.insert(signingSessions).values({
      tokenHash: hashSigningToken(input.token),
      paymentRequestId: input.paymentRequestId,
      userId: input.userId,
      signerAddress: input.signerAddress,
      expiresAt: input.expiresAt,
    });
  }

  async getSigningPayload(id: string) {
    const record = await this.getById(id);
    if (!record) throw new Error("Payment request not found");
    if (
      record.status !== "AWAITING_SIGNATURES" &&
      record.status !== "PARTIALLY_SIGNED"
    ) {
      throw new Error(`Request not open for signing (${record.status})`);
    }
    if (record.expirationAt <= new Date()) {
      throw new Error("Payment request expired");
    }

    const existingSignatures = await db
      .select()
      .from(signatures)
      .where(eq(signatures.paymentRequestId, id));

    return {
      request: record,
      digest: JSON.parse(record.canonicalPayloadJson),
      rawTransaction: record.rawTransactionJson,
      rawDataHex: record.rawDataHex,
      txId: record.txId,
      payloadHash: record.canonicalPayloadHash,
      signatures: existingSignatures,
    };
  }

  async addSignature(input: {
    paymentRequestId: string;
    signatureHex: string;
    signerUserId: string;
    expectedSignerAddress: string;
    config: TreasuryConfig;
  }) {
    const record = await this.getById(input.paymentRequestId);
    if (!record) throw new Error("Payment request not found");

    if (record.expirationAt <= new Date()) {
      throw new Error("Payment request expired");
    }

    const allowedSigner = input.config.signers.find((s) =>
      addressesEqual(s.address, input.expectedSignerAddress),
    );
    if (!allowedSigner) {
      throw new Error("Signer address is not allowlisted");
    }

    const duplicate = await db
      .select()
      .from(signatures)
      .where(
        and(
          eq(signatures.paymentRequestId, input.paymentRequestId),
          eq(signatures.signerAddress, allowedSigner.address),
        ),
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new Error("Duplicate signature from same signer rejected");
    }

    const verification = await this.signatureVerifier.verifyAndApplySignature({
      rawTransaction: record.rawTransactionJson as Record<string, unknown>,
      signatureHex: input.signatureHex,
      expectedSignerAddress: allowedSigner.address,
      txId: record.txId,
      payloadHash: record.canonicalPayloadHash,
      permissionId: record.permissionId,
      threshold: input.config.threshold,
    });

    await db.insert(signatures).values({
      paymentRequestId: input.paymentRequestId,
      signerAddress: allowedSigner.address,
      signatureHex: input.signatureHex,
      recoveredAddress: verification.recoveredAddress,
      payloadHash: record.canonicalPayloadHash,
      txId: record.txId,
      signerUserId: input.signerUserId,
      verificationResult: verification.valid ? "verified" : "rejected",
    });

    if (!verification.valid) {
      throw new Error(verification.reason ?? "Signature verification failed");
    }

    const nextStatus = nextStatusAfterSignature(
      record.status as PaymentRequestStatus,
      verification.sufficientWeight,
    );

    const [updated] = await db
      .update(paymentRequests)
      .set({
        status: nextStatus,
        rawTransactionJson: verification.updatedTransaction,
        updatedAt: new Date(),
        version: record.version + 1,
      })
      .where(
        and(
          eq(paymentRequests.id, input.paymentRequestId),
          eq(paymentRequests.version, record.version),
        ),
      )
      .returning();

    await this.audit.record(
      "SIGNATURE_ADDED",
      { actorUserId: input.signerUserId, actorRole: allowedSigner.role },
      {
        paymentRequestId: input.paymentRequestId,
        after: {
          signer: allowedSigner.address,
          weight: verification.currentWeight,
          status: updated.status,
        },
      },
    );

    return {
      request: updated,
      signWeight: verification,
    };
  }

  async getSignWeight(paymentRequestId: string, threshold: number) {
    const record = await this.getById(paymentRequestId);
    if (!record) throw new Error("Payment request not found");

    const weight = await this.tronRpc.getSignWeight(
      record.rawTransactionJson as Record<string, unknown>,
    );

    const currentWeight = Number(
      weight?.current_weight ?? weight?.approved_list?.length ?? 0,
    );
    const approvedSigners: string[] = weight?.approved_list ?? [];

    return {
      threshold,
      currentWeight,
      approvedSigners,
      sufficient: currentWeight >= threshold,
      raw: weight,
    };
  }
}
