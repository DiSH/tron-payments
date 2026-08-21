import { addressesEqual } from "@tron-payments/shared";
import type { Types } from "tronweb";
import type { TronRpcService } from "./tron-rpc.service.js";

export interface SignatureVerificationResult {
  valid: boolean;
  recoveredAddress: string;
  sufficientWeight: boolean;
  currentWeight: number;
  updatedTransaction: Record<string, unknown>;
  reason?: string;
}

export class SignatureVerifierService {
  constructor(private readonly tronRpc: TronRpcService) {}

  async verifyAndApplySignature(input: {
    rawTransaction: Record<string, unknown>;
    signatureHex: string;
    expectedSignerAddress: string;
    txId: string;
    payloadHash: string;
    permissionId: number;
    threshold: number;
  }): Promise<SignatureVerificationResult> {
    const tronWeb = this.tronRpc.client;
    const transaction = structuredClone(input.rawTransaction);

    if (!transaction.txID || transaction.txID !== input.txId) {
      return {
        valid: false,
        recoveredAddress: "",
        sufficientWeight: false,
        currentWeight: 0,
        updatedTransaction: transaction,
        reason: "Transaction txID mismatch",
      };
    }

    const normalizedSignature = input.signatureHex.startsWith("0x")
      ? input.signatureHex.slice(2)
      : input.signatureHex;

    const existingSignatures: string[] = Array.isArray(transaction.signature)
      ? [...(transaction.signature as string[])]
      : [];

    if (existingSignatures.includes(normalizedSignature)) {
      return {
        valid: false,
        recoveredAddress: "",
        sufficientWeight: false,
        currentWeight: 0,
        updatedTransaction: transaction,
        reason: "Duplicate signature",
      };
    }

    existingSignatures.push(normalizedSignature);
    transaction.signature = existingSignatures;

    let recoveredAddress = "";
    try {
      const recovered = tronWeb.trx.ecRecover(
        transaction as unknown as Types.SignedTransaction,
      );
      recoveredAddress = Array.isArray(recovered)
        ? (recovered[recovered.length - 1] ?? "")
        : recovered;
    } catch {
      return {
        valid: false,
        recoveredAddress: "",
        sufficientWeight: false,
        currentWeight: 0,
        updatedTransaction: input.rawTransaction,
        reason: "Unable to recover signer address from signature",
      };
    }

    if (!addressesEqual(recoveredAddress, input.expectedSignerAddress)) {
      return {
        valid: false,
        recoveredAddress,
        sufficientWeight: false,
        currentWeight: 0,
        updatedTransaction: input.rawTransaction,
        reason: "Recovered signer does not match expected allowlisted signer",
      };
    }

    const weightResult = await this.tronRpc.getSignWeight(transaction);
    const currentWeight = Number(weightResult?.current_weight ?? 0);
    const sufficientWeight = currentWeight >= input.threshold;

    return {
      valid: true,
      recoveredAddress,
      sufficientWeight,
      currentWeight,
      updatedTransaction: transaction,
    };
  }
}
