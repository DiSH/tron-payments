import { describe, it, expect } from "vitest";
import {
  buildDigestHash,
  canonicalSerialize,
  hashCanonicalPayload,
} from "./digest.js";
import { NETWORK_MAINNET } from "../index.js";

const sampleDigest = {
  network: NETWORK_MAINNET,
  treasuryAddress: "TXyz123456789012345678901234567890",
  permissionId: 2,
  token: {
    symbol: "USDT",
    contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    decimals: 6,
  },
  operation: "transfer(address,uint256)" as const,
  recipient: "TAbc1234567890123456789012345678901",
  amountRaw: "125000000",
  amountDisplay: "125.000000",
  expiration: "2026-08-19T12:00:00.000Z",
  requestId: "pay_test_001",
};

describe("canonical digest", () => {
  it("produces deterministic serialization regardless of key order", () => {
    const a = canonicalSerialize({
      requestId: "pay_test_001",
      amountRaw: "125000000",
      token: { decimals: 6, symbol: "USDT", contractAddress: "TR7..." },
    });
    const b = canonicalSerialize({
      token: { contractAddress: "TR7...", symbol: "USDT", decimals: 6 },
      amountRaw: "125000000",
      requestId: "pay_test_001",
    });
    expect(a).toBe(b);
  });

  it("produces identical hash for identical digest fields", () => {
    const first = hashCanonicalPayload(sampleDigest);
    const second = hashCanonicalPayload({ ...sampleDigest });
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("changes hash when recipient changes", () => {
    const base = hashCanonicalPayload(sampleDigest);
    const altered = hashCanonicalPayload({
      ...sampleDigest,
      recipient: "TOther123456789012345678901234567",
    });
    expect(base).not.toBe(altered);
  });

  it("buildDigestHash returns digest, serialized JSON, and hash", () => {
    const result = buildDigestHash(sampleDigest);
    expect(result.digest.operation).toBe("transfer(address,uint256)");
    expect(result.serialized).toContain('"requestId":"pay_test_001"');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
