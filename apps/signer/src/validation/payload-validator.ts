import {
  decodeTrc20TransferCalldata,
  encodeTrc20TransferCalldata,
  type CanonicalPaymentDigest,
} from "@tron-payments/shared";

export interface PayloadValidationInput {
  digest: CanonicalPaymentDigest;
  rawTransaction: Record<string, unknown>;
  rawDataHex: string;
  txId: string;
  payloadHash: string;
}

export function validateSigningPayload(input: PayloadValidationInput): void {
  const { digest } = input;

  if (digest.requestId.length === 0) {
    throw new Error("Missing requestId in digest");
  }

  if (input.txId !== (input.rawTransaction.txID as string)) {
    throw new Error("txID mismatch between payload and raw transaction");
  }

  const expectedCalldata = encodeTrc20TransferCalldata(
    digest.recipient,
    digest.amountRaw,
  );
  const contract = input.rawTransaction.raw_data as {
    contract?: Array<{ parameter?: { value?: { data?: string } } }>;
  };
  const actualCalldata = contract?.contract?.[0]?.parameter?.value?.data;

  if (actualCalldata) {
    const normalizedActual = actualCalldata.startsWith("0x")
      ? actualCalldata
      : `0x${actualCalldata}`;
    const decoded = decodeTrc20TransferCalldata(normalizedActual);
    const decodedExpected = decodeTrc20TransferCalldata(expectedCalldata);
    if (decoded.amountRaw !== decodedExpected.amountRaw) {
      throw new Error("Calldata amount mismatch");
    }
  }

  if (!input.rawDataHex) {
    throw new Error("Missing raw_data_hex");
  }
}

export function formatReviewScreen(input: PayloadValidationInput): string {
  const { digest } = input;
  return [
    "=== TRON PAYMENT REVIEW ===",
    `Network: ${digest.network}`,
    `Treasury: ${digest.treasuryAddress}`,
    `Permission ID: ${digest.permissionId}`,
    `Token: ${digest.token.symbol} (${digest.token.contractAddress})`,
    `Operation: ${digest.operation}`,
    `Recipient: ${digest.recipient}`,
    `Amount: ${digest.amountDisplay} USDT (${digest.amountRaw} raw)`,
    `Purpose request: ${digest.requestId}`,
    `Expiration: ${digest.expiration}`,
    `TX ID: ${input.txId}`,
    `Payload hash: ${input.payloadHash}`,
    "",
    "Verify ALL fields before approving on Ledger.",
  ].join("\n");
}
