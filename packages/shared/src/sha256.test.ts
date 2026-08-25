import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex } from "./sha256.js";

describe("sha256Hex", () => {
  it("matches node:crypto for empty string", () => {
    expect(sha256Hex("")).toBe(
      createHash("sha256").update("", "utf8").digest("hex"),
    );
  });

  it("matches node:crypto for ASCII payload", () => {
    const sample = '{"amountRaw":"125000000","requestId":"pay_test_001"}';
    expect(sha256Hex(sample)).toBe(
      createHash("sha256").update(sample, "utf8").digest("hex"),
    );
  });

  it("matches node:crypto for unicode", () => {
    const sample = "TRON Payments — USDT";
    expect(sha256Hex(sample)).toBe(
      createHash("sha256").update(sample, "utf8").digest("hex"),
    );
  });
});
