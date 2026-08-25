import { describe, expect, it } from "vitest";
import {
  collectLedgerAccounts,
  derivationPathForAccount,
  evaluateSigningEligibility,
  LedgerWebError,
  mapLedgerError,
  pickPreferredAccount,
  utf8ToHex,
} from "./tron-webhid";

describe("utf8ToHex", () => {
  it("encodes ASCII", () => {
    expect(utf8ToHex("AB")).toBe("4142");
  });
});

describe("derivationPathForAccount", () => {
  it("uses BIP44 TRON account indexes", () => {
    expect(derivationPathForAccount(0)).toBe("m/44'/195'/0'/0/0");
    expect(derivationPathForAccount(1)).toBe("m/44'/195'/1'/0/0");
    expect(derivationPathForAccount(4)).toBe("m/44'/195'/4'/0/0");
  });
});

describe("collectLedgerAccounts", () => {
  it("defaults to five BIP44 accounts", async () => {
    const accounts = await collectLedgerAccounts(async (path) => ({
      address: `addr:${path}`,
    }));
    expect(accounts).toHaveLength(5);
    expect(accounts[4]?.derivationPath).toBe("m/44'/195'/4'/0/0");
  });

  it("scans sequential BIP44 account indexes", async () => {
    const accounts = await collectLedgerAccounts(
      async (path) => ({ address: `addr:${path}` }),
      3,
    );
    expect(accounts).toEqual([
      {
        accountIndex: 0,
        derivationPath: "m/44'/195'/0'/0/0",
        address: "addr:m/44'/195'/0'/0/0",
      },
      {
        accountIndex: 1,
        derivationPath: "m/44'/195'/1'/0/0",
        address: "addr:m/44'/195'/1'/0/0",
      },
      {
        accountIndex: 2,
        derivationPath: "m/44'/195'/2'/0/0",
        address: "addr:m/44'/195'/2'/0/0",
      },
    ]);
  });
});

describe("pickPreferredAccount", () => {
  const accounts = [
    {
      accountIndex: 0,
      derivationPath: "m/44'/195'/0'/0/0",
      address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    },
    {
      accountIndex: 1,
      derivationPath: "m/44'/195'/1'/0/0",
      address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    },
  ];

  it("returns null for an empty list", () => {
    expect(pickPreferredAccount([], "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBeNull();
  });

  it("prefers the profile address when present", () => {
    const preferred = pickPreferredAccount(
      accounts,
      "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    );
    expect(preferred?.accountIndex).toBe(1);
  });

  it("falls back to the first account", () => {
    expect(pickPreferredAccount(accounts, null)?.accountIndex).toBe(0);
  });
});

describe("mapLedgerError", () => {
  it("passes LedgerWebError through", () => {
    const original = new LedgerWebError("already friendly");
    expect(mapLedgerError(original)).toBe(original);
  });

  it("maps a locked device status code", () => {
    expect(mapLedgerError({ statusCode: 0x5515, message: "Locked" }).message).toBe(
      "Unlock your Ledger, then try again.",
    );
  });

  it("maps LockedDeviceError by name", () => {
    const err = Object.assign(new Error("Locked device (0x5515)"), {
      name: "LockedDeviceError",
    });
    expect(mapLedgerError(err).message).toBe("Unlock your Ledger, then try again.");
  });

  it("maps security-status-not-satisfied as locked", () => {
    expect(mapLedgerError({ statusCode: 0x6982 }).message).toBe(
      "Unlock your Ledger, then try again.",
    );
  });

  it("maps wrong-app status codes", () => {
    expect(mapLedgerError({ statusCode: 0x6d00 }).message).toBe(
      "Open the Tron app on your Ledger, then try again.",
    );
    expect(mapLedgerError({ statusCode: 0x6e00 }).message).toBe(
      "Open the Tron app on your Ledger, then try again.",
    );
  });

  it("maps INS_NOT_SUPPORTED from the message", () => {
    expect(
      mapLedgerError(new Error("Ledger device: INS_NOT_SUPPORTED (0x6d00)")).message,
    ).toBe("Open the Tron app on your Ledger, then try again.");
  });

  it("maps user rejection", () => {
    expect(mapLedgerError({ statusCode: 0x6985 }).message).toBe(
      "The request was rejected on the Ledger.",
    );
  });

  it("maps HID picker cancellation", () => {
    const err = Object.assign(new Error("No device selected."), {
      name: "NotFoundError",
    });
    expect(mapLedgerError(err).message).toBe(
      "No Ledger was selected. Plug it in and choose it in the browser prompt.",
    );
  });

  it("maps Ledger Live occupying the device", () => {
    expect(mapLedgerError(new Error("Unable to claim interface.")).message).toBe(
      "Close Ledger Live (and other apps using the device), then try again.",
    );
  });

  it("falls back to unlock-and-open-Tron-app", () => {
    expect(mapLedgerError(new Error("USB timeout")).message).toBe(
      "Unlock the Ledger, open the Tron app, and try again.",
    );
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
