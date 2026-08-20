import { describe, it, expect } from "vitest";
import {
  addressesEqual,
  isBlockedRecipient,
  isValidTronAddress,
  toBase58TronAddress,
  tronBase58ToHex,
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

  it("compares base58 with on-chain hex form", () => {
    const a = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const hex = tronBase58ToHex(a);
    expect(addressesEqual(a, hex)).toBe(true);
    expect(toBase58TronAddress(hex)).toBe(a);
  });

  it("detects blocked recipients", () => {
    const treasury = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(isBlockedRecipient(treasury, [treasury])).toBe(true);
    expect(isBlockedRecipient("TInvalid", [treasury])).toBe(false);
  });
});
