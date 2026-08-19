import { describe, it, expect } from "vitest";
import {
  assertAmountWithinLimit,
  usdtDisplayToRaw,
  usdtRawToDisplay,
} from "./amount.js";

describe("USDT amount conversion", () => {
  it("converts display to raw without float", () => {
    expect(usdtDisplayToRaw("125")).toBe(125_000_000n);
    expect(usdtDisplayToRaw("125.5")).toBe(125_500_000n);
    expect(usdtDisplayToRaw("0.000001")).toBe(1n);
  });

  it("converts raw to display with 6 decimals", () => {
    expect(usdtRawToDisplay(125_000_000n)).toBe("125.000000");
    expect(usdtRawToDisplay("1")).toBe("0.000001");
  });

  it("rejects too many decimal places", () => {
    expect(() => usdtDisplayToRaw("1.1234567")).toThrow(/fractional digits/);
  });

  it("rejects zero and over-limit amounts", () => {
    expect(() => usdtDisplayToRaw("0")).toThrow();
    expect(() => assertAmountWithinLimit(0n, 1000n)).toThrow(/greater than zero/);
    expect(() => assertAmountWithinLimit(2000n, 1000n)).toThrow(/maximum/);
  });

  it("round-trips display amounts", () => {
    const raw = usdtDisplayToRaw("42.123456");
    expect(usdtRawToDisplay(raw)).toBe("42.123456");
  });
});
