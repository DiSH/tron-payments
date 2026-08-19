import { describe, it, expect } from "vitest";
import {
  addressesEqual,
  isBlockedRecipient,
  isValidTronAddress,
} from "./address.js";

describe("TRON address validation", () => {
  it("accepts valid mainnet base58 addresses", () => {
    expect(isValidTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidTronAddress("not-an-address")).toBe(false);
    expect(isValidTronAddress("")).toBe(false);
  });

  it("compares addresses case-insensitively by hex", () => {
    const a = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(addressesEqual(a, a)).toBe(true);
  });

  it("detects blocked recipients", () => {
    const treasury = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(isBlockedRecipient(treasury, [treasury])).toBe(true);
    expect(isBlockedRecipient("TInvalid", [treasury])).toBe(false);
  });
});
