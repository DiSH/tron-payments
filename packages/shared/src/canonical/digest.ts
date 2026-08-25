import type { CanonicalPaymentDigest } from "../types/payment-request.js";
import { sha256Hex } from "../sha256.js";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(record[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Deterministic JSON serialization with sorted object keys at every level. */
export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashCanonicalPayload(digest: CanonicalPaymentDigest): string {
  return sha256Hex(canonicalSerialize(digest));
}

export function buildCanonicalDigest(
  input: CanonicalPaymentDigest,
): CanonicalPaymentDigest {
  return {
    network: input.network,
    treasuryAddress: input.treasuryAddress,
    permissionId: input.permissionId,
    token: {
      symbol: input.token.symbol,
      contractAddress: input.token.contractAddress,
      decimals: input.token.decimals,
    },
    operation: "transfer(address,uint256)",
    recipient: input.recipient,
    amountRaw: input.amountRaw,
    amountDisplay: input.amountDisplay,
    expiration: input.expiration,
    requestId: input.requestId,
  };
}

export function buildDigestHash(input: CanonicalPaymentDigest): {
  digest: CanonicalPaymentDigest;
  hash: string;
  serialized: string;
} {
  const digest = buildCanonicalDigest(input);
  const serialized = canonicalSerialize(digest);
  const hash = sha256Hex(serialized);
  return { digest, hash, serialized };
}
