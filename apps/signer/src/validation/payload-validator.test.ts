import { describe, it, expect } from "vitest";
import {
  formatReviewScreen,
  validateSigningPayload,
} from "./payload-validator.js";
import { NETWORK_MAINNET } from "@tron-payments/shared";

describe("signer payload validation", () => {
  const digest = {
    network: NETWORK_MAINNET,
    treasuryAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    permissionId: 2,
    token: {
      symbol: "USDT",
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      decimals: 6,
    },
    operation: "transfer(address,uint256)" as const,
    recipient: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    amountRaw: "1000000",
    amountDisplay: "1.000000",
    expiration: "2026-08-19T12:00:00.000Z",
    requestId: "pay_1000",
  };

  it("formats review screen with critical fields", () => {
    const screen = formatReviewScreen({
      digest,
      rawTransaction: { txID: "abc123" },
      rawDataHex: "deadbeef",
      txId: "abc123",
      payloadHash: "hash",
    });
    expect(screen).toContain("TRON PAYMENT REVIEW");
    expect(screen).toContain(digest.recipient);
    expect(screen).toContain("1.000000 USDT");
  });

  it("validates matching txID", () => {
    expect(() =>
      validateSigningPayload({
        digest,
        rawTransaction: { txID: "abc123" },
        rawDataHex: "deadbeef",
        txId: "abc123",
        payloadHash: "hash",
      }),
    ).not.toThrow();
  });

  it("rejects txID mismatch", () => {
    expect(() =>
      validateSigningPayload({
        digest,
        rawTransaction: { txID: "other" },
        rawDataHex: "deadbeef",
        txId: "abc123",
        payloadHash: "hash",
      }),
    ).toThrow(/txID mismatch/);
  });
});
