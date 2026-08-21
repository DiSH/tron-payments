import {
  buildDigestHash,
  encodeTrc20TransferCalldata,
  isBlockedRecipient,
  isValidTronAddress,
  usdtDisplayToRaw,
  assertAmountWithinLimit,
  type CanonicalPaymentDigest,
  type TreasuryConfig,
} from "@tron-payments/shared";
import type { TronRpcService } from "./tron-rpc.service.js";

export interface BuildPaymentTransactionInput {
  requestId: string;
  recipientAddress: string;
  amountDisplay: string;
  expirationAt: Date;
  config: TreasuryConfig;
}

export interface BuiltPaymentTransaction {
  digest: CanonicalPaymentDigest;
  canonicalPayloadJson: string;
  canonicalPayloadHash: string;
  rawTransaction: Record<string, unknown>;
  rawDataHex: string;
  txId: string;
  amountRaw: string;
  calldata: string;
}

export class TransactionBuilderService {
  constructor(private readonly tronRpc: TronRpcService) {}

  async buildUsdtTransfer(
    input: BuildPaymentTransactionInput,
  ): Promise<BuiltPaymentTransaction> {
    const { config } = input;

    if (!isValidTronAddress(input.recipientAddress)) {
      throw new Error("Invalid recipient TRON address");
    }

    const blocked = [
      config.treasuryAddress,
      ...config.signers.map((s) => s.address),
    ];
    if (isBlockedRecipient(input.recipientAddress, blocked)) {
      throw new Error("Recipient is blocked (treasury or signer address)");
    }

    const amountRaw = usdtDisplayToRaw(input.amountDisplay);
    assertAmountWithinLimit(amountRaw, BigInt(config.maxPaymentAmountRaw));

    const amountRawString = amountRaw.toString();
    const amountDisplay = input.amountDisplay.includes(".")
      ? input.amountDisplay
      : `${input.amountDisplay}.000000`;

    const digestInput: CanonicalPaymentDigest = {
      network: config.network as CanonicalPaymentDigest["network"],
      treasuryAddress: config.treasuryAddress,
      permissionId: config.activePermissionId,
      token: {
        symbol: "USDT",
        contractAddress: config.usdtContractAddress,
        decimals: config.usdtDecimals,
      },
      operation: "transfer(address,uint256)",
      recipient: input.recipientAddress,
      amountRaw: amountRawString,
      amountDisplay,
      expiration: input.expirationAt.toISOString(),
      requestId: input.requestId,
    };

    const { digest, hash, serialized } = buildDigestHash(digestInput);
    const calldata = encodeTrc20TransferCalldata(
      input.recipientAddress,
      amountRaw,
    );

    const tronWeb = this.tronRpc.client;
    tronWeb.setAddress(config.treasuryAddress);

    const trigger = await tronWeb.transactionBuilder.triggerSmartContract(
      config.usdtContractAddress,
      "transfer(address,uint256)",
      {
        feeLimit: 100_000_000,
        callValue: 0,
        permissionId: config.activePermissionId,
      },
      [
        { type: "address", value: input.recipientAddress },
        { type: "uint256", value: amountRawString },
      ],
      config.treasuryAddress,
    );

    if (!trigger.result?.result) {
      throw new Error(
        trigger.result?.message ?? "Failed to build TRON transaction",
      );
    }

    const transaction = trigger.transaction as unknown as Record<
      string,
      unknown
    > & {
      txID?: string;
      raw_data?: { expiration?: number };
    };

    if (transaction.raw_data) {
      transaction.raw_data.expiration = input.expirationAt.getTime();
    }

    const txPb = tronWeb.utils.transaction.txJsonToPb(transaction);
    const rawDataHex = Buffer.from(txPb.getRawData().serializeBinary()).toString("hex");
    // txPbToTxID already returns a hex string in TronWeb 6.x (not BytesLike).
    const txId = transaction.txID ?? tronWeb.utils.transaction.txPbToTxID(txPb);

    return {
      digest,
      canonicalPayloadJson: serialized,
      canonicalPayloadHash: hash,
      rawTransaction: transaction,
      rawDataHex: Buffer.from(rawDataHex).toString("hex"),
      txId: txId,
      amountRaw: amountRawString,
      calldata,
    };
  }
}
