import bs58check from "bs58check";
import { isValidTronAddress, tronBase58ToHex } from "./address.js";

export const TRANSFER_SELECTOR = "transfer(address,uint256)";

/** Encode TRC-20 transfer(address,uint256) calldata without float. */
export function encodeTrc20TransferCalldata(
  recipientBase58: string,
  amountRaw: bigint | string,
): string {
  if (!isValidTronAddress(recipientBase58)) {
    throw new Error(`Invalid TRON address: ${recipientBase58}`);
  }
  const amount = typeof amountRaw === "string" ? BigInt(amountRaw) : amountRaw;
  const recipientHex = tronBase58ToHex(recipientBase58).replace(/^41/, "");
  const paddedRecipient = recipientHex.padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `0xa9059cbb${paddedRecipient}${amountHex}`;
}

export function decodeTrc20TransferCalldata(calldata: string): {
  recipientHex: string;
  amountRaw: bigint;
} {
  const normalized = calldata.startsWith("0x") ? calldata.slice(2) : calldata;
  if (!normalized.startsWith("a9059cbb")) {
    throw new Error("Calldata is not transfer(address,uint256)");
  }
  const recipientHex = normalized.slice(8, 8 + 64);
  const amountHex = normalized.slice(8 + 64, 8 + 128);
  return {
    recipientHex,
    amountRaw: BigInt(`0x${amountHex}`),
  };
}

export function tronHexToBase58Address(hexWithPrefix: string): string {
  const normalized = hexWithPrefix.startsWith("41")
    ? hexWithPrefix
    : `41${hexWithPrefix.replace(/^0+/, "")}`;
  return bs58check.encode(Buffer.from(normalized, "hex"));
}
