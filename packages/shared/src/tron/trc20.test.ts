import { describe, it, expect } from "vitest";
import {
  decodeTrc20TransferCalldata,
  encodeTrc20TransferCalldata,
  tronHexToBase58Address,
} from "./trc20.js";

describe("TRC-20 transfer encoding", () => {
  const recipient = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const amountRaw = 125_000_000n;

  it("encodes transfer(address,uint256) calldata", () => {
    const calldata = encodeTrc20TransferCalldata(recipient, amountRaw);
    expect(calldata.startsWith("0xa9059cbb")).toBe(true);
    expect(calldata.length).toBe(2 + 8 + 64 + 64);
  });

  it("decodes encoded calldata back to amount", () => {
    const calldata = encodeTrc20TransferCalldata(recipient, amountRaw);
    const decoded = decodeTrc20TransferCalldata(calldata);
    expect(decoded.amountRaw).toBe(amountRaw);
    expect(tronHexToBase58Address(decoded.recipientHex)).toBe(recipient);
  });

  it("rejects non-transfer calldata", () => {
    expect(() => decodeTrc20TransferCalldata("0xdeadbeef")).toThrow(
      /transfer\(address,uint256\)/,
    );
  });
});
