import { addressesEqual } from "@tron-payments/shared";

export const DEFAULT_DERIVATION_PATH =
  import.meta.env.VITE_LEDGER_DERIVATION_PATH ?? "m/44'/195'/0'/0/0";

export class LedgerWebError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerWebError";
  }
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export function utf8ToHex(message: string): string {
  return Array.from(new TextEncoder().encode(message))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function withTrxApp<T>(
  fn: (app: InstanceType<typeof import("@ledgerhq/hw-app-trx").default>, derivationPath: string) => Promise<T>,
  derivationPath = DEFAULT_DERIVATION_PATH,
): Promise<T> {
  if (!isWebHidSupported()) {
    throw new LedgerWebError(
      "WebHID is not supported in this browser. Use Chrome or Edge over HTTPS/localhost.",
    );
  }

  const [{ default: TransportWebHID }, { default: Trx }] = await Promise.all([
    import("@ledgerhq/hw-transport-webhid"),
    import("@ledgerhq/hw-app-trx"),
  ]);

  let transport: Awaited<ReturnType<typeof TransportWebHID.create>> | null =
    null;
  try {
    transport = await TransportWebHID.create();
    const app = new Trx(transport);
    return await fn(app, derivationPath);
  } catch (err) {
    if (err instanceof LedgerWebError) throw err;
    throw new LedgerWebError(
      err instanceof Error
        ? err.message
        : "Ledger not connected or Tron app not open",
    );
  } finally {
    await transport?.close().catch(() => undefined);
  }
}

export async function connectAndGetAddress(
  derivationPath = DEFAULT_DERIVATION_PATH,
): Promise<{ address: string; derivationPath: string }> {
  return withTrxApp(async (app, path) => {
    const result = await app.getAddress(path);
    return { address: result.address, derivationPath: path };
  }, derivationPath);
}

export async function signPersonalMessage(
  message: string,
  derivationPath = DEFAULT_DERIVATION_PATH,
): Promise<{ address: string; signature: string; derivationPath: string }> {
  return withTrxApp(async (app, path) => {
    const { address } = await app.getAddress(path);
    const signature = await app.signPersonalMessage(path, utf8ToHex(message));
    return {
      address,
      signature: signature.startsWith("0x") ? signature.slice(2) : signature,
      derivationPath: path,
    };
  }, derivationPath);
}

export async function signTransactionHash(
  rawDataHex: string,
  expectedAddress?: string,
  derivationPath = DEFAULT_DERIVATION_PATH,
): Promise<{ address: string; signature: string; derivationPath: string }> {
  return withTrxApp(async (app, path) => {
    const { address } = await app.getAddress(path);
    if (expectedAddress && !addressesEqual(address, expectedAddress)) {
      throw new LedgerWebError(
        `Connected Ledger address ${address} does not match authorized signer ${expectedAddress}`,
      );
    }
    const signature = await app.signTransactionHash(path, rawDataHex);
    return {
      address,
      signature: signature.startsWith("0x") ? signature.slice(2) : signature,
      derivationPath: path,
    };
  }, derivationPath);
}

export type SigningEligibilityStatus =
  | "can_sign"
  | "address_mismatch"
  | "not_in_treasury"
  | "missing_signer_role"
  | "no_profile_address"
  | "unsupported_browser";

export function evaluateSigningEligibility(input: {
  deviceAddress: string | null;
  profileAddress: string | null;
  treasuryAddresses: string[];
  hasSignerRole: boolean;
  webHidSupported: boolean;
}): { status: SigningEligibilityStatus; detail: string } {
  if (!input.webHidSupported) {
    return {
      status: "unsupported_browser",
      detail: "WebHID is not available in this browser.",
    };
  }
  if (!input.deviceAddress) {
    return {
      status: "unsupported_browser",
      detail: "Connect a Ledger device first.",
    };
  }
  if (!input.profileAddress) {
    return {
      status: "no_profile_address",
      detail:
        "Your account has no signer address. An admin must bind your Ledger address.",
    };
  }
  if (!addressesEqual(input.deviceAddress, input.profileAddress)) {
    return {
      status: "address_mismatch",
      detail: `Ledger ${input.deviceAddress} does not match your profile address ${input.profileAddress}.`,
    };
  }
  const inTreasury = input.treasuryAddresses.some((a) =>
    addressesEqual(a, input.deviceAddress!),
  );
  if (!inTreasury) {
    return {
      status: "not_in_treasury",
      detail: "This address is not in the treasury signer allowlist.",
    };
  }
  if (!input.hasSignerRole) {
    return {
      status: "missing_signer_role",
      detail: "Your account does not have the Signer role.",
    };
  }
  return {
    status: "can_sign",
    detail: "This Ledger can sign treasury payments.",
  };
}
