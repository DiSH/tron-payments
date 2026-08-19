import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextStatusAfterSignature,
  usdtDisplayToRaw,
  buildDigestHash,
  NETWORK_MAINNET,
} from "@tron-payments/shared";

describe("API domain helpers (shared integration)", () => {
  it("supports payment lifecycle transitions used by API", () => {
    expect(canTransition("AWAITING_SIGNATURES", "PARTIALLY_SIGNED")).toBe(true);
    expect(nextStatusAfterSignature("AWAITING_SIGNATURES", true)).toBe(
      "READY_TO_BROADCAST",
    );
  });

  it("builds stable digest for API-created requests", () => {
    const { hash } = buildDigestHash({
      network: NETWORK_MAINNET,
      treasuryAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      permissionId: 2,
      token: {
        symbol: "USDT",
        contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        decimals: 6,
      },
      operation: "transfer(address,uint256)",
      recipient: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      amountRaw: usdtDisplayToRaw("10").toString(),
      amountDisplay: "10.000000",
      expiration: "2026-08-19T12:00:00.000Z",
      requestId: "pay_1001",
    });
    expect(hash).toHaveLength(64);
  });
});
