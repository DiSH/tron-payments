import { addressesEqual } from "@tron-payments/shared";

export const DEFAULT_DERIVATION_PATH =
  import.meta.env.VITE_LEDGER_DERIVATION_PATH ?? "m/44'/195'/0'/0/0";

export const LEDGER_ACCOUNT_SCAN_COUNT = 5;

const DERIVATION_PATH_STORAGE_KEY = "ledgerDerivationPath";

export class LedgerWebError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerWebError";
  }
}

export type LedgerAccount = {
  accountIndex: number;
  derivationPath: string;
  address: string;
};

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export function utf8ToHex(message: string): string {
  return Array.from(new TextEncoder().encode(message))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function derivationPathForAccount(accountIndex: number): string {
  return `m/44'/195'/${accountIndex}'/0/0`;
}

export function getStoredDerivationPath(): string | null {
  try {
    return sessionStorage.getItem(DERIVATION_PATH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredDerivationPath(path: string): void {
  try {
    sessionStorage.setItem(DERIVATION_PATH_STORAGE_KEY, path);
  } catch {
    // sessionStorage may be unavailable (private mode / tests)
  }
}

export function clearStoredDerivationPath(): void {
  try {
    sessionStorage.removeItem(DERIVATION_PATH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function pickPreferredAccount(
  accounts: LedgerAccount[],
  profileAddress: string | null,
): LedgerAccount | null {
  if (accounts.length === 0) return null;
  if (profileAddress) {
    const match = accounts.find((account) =>
      addressesEqual(account.address, profileAddress),
    );
    if (match) return match;
  }
  return accounts[0] ?? null;
}

export async function collectLedgerAccounts(
  getAddress: (path: string) => Promise<{ address: string }>,
  count = LEDGER_ACCOUNT_SCAN_COUNT,
): Promise<LedgerAccount[]> {
  const accounts: LedgerAccount[] = [];
  for (let accountIndex = 0; accountIndex < count; accountIndex += 1) {
    const derivationPath = derivationPathForAccount(accountIndex);
    const { address } = await getAddress(derivationPath);
    accounts.push({ accountIndex, derivationPath, address });
  }
  return accounts;
}

function readStatusCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    if (typeof code === "number" && Number.isFinite(code)) return code;
  }
  const message = errorMessage(err);
  const hex = message.match(/0x([0-9a-fA-F]+)/);
  if (hex) return Number.parseInt(hex[1], 16);
  return undefined;
}

function errorName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(err);
}

export function mapLedgerError(err: unknown): LedgerWebError {
  if (err instanceof LedgerWebError) return err;

  const statusCode = readStatusCode(err);
  const name = errorName(err);
  const message = errorMessage(err).toLowerCase();

  if (statusCode === 0x6985 || message.includes("conditions of use not satisfied")) {
    return new LedgerWebError("The request was rejected on the Ledger.");
  }

  if (
    statusCode === 0x5515 ||
    statusCode === 0x6982 ||
    name === "LockedDeviceError" ||
    message.includes("locked device")
  ) {
    return new LedgerWebError("Unlock your Ledger, then try again.");
  }

  if (
    statusCode === 0x6d00 ||
    statusCode === 0x6e00 ||
    message.includes("ins_not_supported") ||
    message.includes("cla_not_supported")
  ) {
    return new LedgerWebError("Open the Tron app on your Ledger, then try again.");
  }

  if (
    name === "NotFoundError" ||
    name === "TransportOpenUserCancelled" ||
    message.includes("no device selected")
  ) {
    return new LedgerWebError(
      "No Ledger was selected. Plug it in and choose it in the browser prompt.",
    );
  }

  if (
    message.includes("unable to claim interface") ||
    message.includes("already in use")
  ) {
    return new LedgerWebError(
      "Close Ledger Live (and other apps using the device), then try again.",
    );
  }

  return new LedgerWebError(
    "Unlock the Ledger, open the Tron app, and try again.",
  );
}

async function withTrxApp<T>(
  fn: (
    app: InstanceType<typeof import("@ledgerhq/hw-app-trx").default>,
    derivationPath: string,
  ) => Promise<T>,
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
    throw mapLedgerError(err);
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

export async function listLedgerAccounts(
  count = LEDGER_ACCOUNT_SCAN_COUNT,
): Promise<LedgerAccount[]> {
  return withTrxApp(async (app) =>
    collectLedgerAccounts((path) => app.getAddress(path), count),
  );
}

export async function signPersonalMessage(
  message: string,
  derivationPath = DEFAULT_DERIVATION_PATH,
): Promise<{ address: string; signature: string; derivationPath: string }> {
  return withTrxApp(async (app, path) => {
    const { address } = await app.getAddress(path);
    const signature = await app.signPersonalMessage(path, utf8ToHex(message));
    setStoredDerivationPath(path);
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
  derivationPath?: string,
): Promise<{ address: string; signature: string; derivationPath: string }> {
  const preferredPath =
    derivationPath ?? getStoredDerivationPath() ?? DEFAULT_DERIVATION_PATH;

  return withTrxApp(async (app) => {
    let path = preferredPath;
    let { address } = await app.getAddress(path);

    if (expectedAddress && !addressesEqual(address, expectedAddress)) {
      const accounts = await collectLedgerAccounts((p) => app.getAddress(p));
      const match = accounts.find((account) =>
        addressesEqual(account.address, expectedAddress),
      );
      if (!match) {
        throw new LedgerWebError(
          `Connected Ledger address ${address} does not match authorized signer ${expectedAddress}`,
        );
      }
      path = match.derivationPath;
      address = match.address;
    }

    const signature = await app.signTransactionHash(path, rawDataHex);
    setStoredDerivationPath(path);
    return {
      address,
      signature: signature.startsWith("0x") ? signature.slice(2) : signature,
      derivationPath: path,
    };
  }, preferredPath);
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
