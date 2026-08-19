import bs58check from "bs58check";

const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function isValidTronAddress(address: string): boolean {
  if (!address || !TRON_ADDRESS_REGEX.test(address)) return false;
  try {
    const decoded = bs58check.decode(address);
    return decoded.length === 21 && decoded[0] === 0x41;
  } catch {
    return false;
  }
}

export function tronBase58ToHex(address: string): string {
  if (!isValidTronAddress(address)) {
    throw new Error(`Invalid TRON address: ${address}`);
  }
  return Buffer.from(bs58check.decode(address)).toString("hex");
}

export function normalizeTronAddress(address: string): string {
  return tronBase58ToHex(address);
}

export function addressesEqual(a: string, b: string): boolean {
  if (!isValidTronAddress(a) || !isValidTronAddress(b)) return false;
  return tronBase58ToHex(a) === tronBase58ToHex(b);
}

export function isBlockedRecipient(
  recipient: string,
  blocked: readonly string[],
): boolean {
  return blocked.some((addr) => addressesEqual(recipient, addr));
}
