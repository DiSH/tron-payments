import { describe, it, expect } from "vitest";
import { PAYMENT_REQUEST_STATUSES, ALLOWED_OPERATION } from "./index";

describe("shared constants", () => {
  it("defines all payment request statuses", () => {
    expect(PAYMENT_REQUEST_STATUSES).toContain("AWAITING_SIGNATURES");
    expect(PAYMENT_REQUEST_STATUSES).toContain("READY_TO_BROADCAST");
  });

  it("allows only USDT transfer operation", () => {
    expect(ALLOWED_OPERATION).toBe("transfer(address,uint256)");
  });
});
