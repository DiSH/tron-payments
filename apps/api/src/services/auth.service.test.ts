import { describe, expect, it } from "vitest";
import { buildLedgerChallengeMessage } from "./auth.service.js";

describe("buildLedgerChallengeMessage", () => {
  it("stays under Ledger 255-byte personal-message limit", () => {
    const message = buildLedgerChallengeMessage(
      "a".repeat(32),
      new Date("2026-01-01T00:00:00.000Z").toISOString(),
    );
    expect(message.startsWith("TRON Payments login")).toBe(true);
    expect(Buffer.byteLength(message, "utf8")).toBeLessThan(255);
  });
});
