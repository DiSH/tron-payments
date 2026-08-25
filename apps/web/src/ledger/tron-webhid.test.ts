import { describe, expect, it } from "vitest";
import { evaluateSigningEligibility, utf8ToHex } from "./tron-webhid";

describe("utf8ToHex", () => {
  it("encodes ASCII", () => {
    expect(utf8ToHex("AB")).toBe("4142");
  });
});

describe("evaluateSigningEligibility", () => {
  const addr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  const other = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";

  it("returns can_sign when all gates pass", () => {
    const result = evaluateSigningEligibility({
      deviceAddress: addr,
      profileAddress: addr,
      treasuryAddresses: [addr],
      hasSignerRole: true,
      webHidSupported: true,
    });
    expect(result.status).toBe("can_sign");
  });

  it("detects address mismatch", () => {
    const result = evaluateSigningEligibility({
      deviceAddress: addr,
      profileAddress: other,
      treasuryAddresses: [addr],
      hasSignerRole: true,
      webHidSupported: true,
    });
    expect(result.status).toBe("address_mismatch");
  });

  it("detects missing signer role", () => {
    const result = evaluateSigningEligibility({
      deviceAddress: addr,
      profileAddress: addr,
      treasuryAddresses: [addr],
      hasSignerRole: false,
      webHidSupported: true,
    });
    expect(result.status).toBe("missing_signer_role");
  });
});
