import bs58check from "bs58check";
import { bytesToHex, hexToBytes } from "../bytes.js";

const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const TRON_HEX_REGEX = /^(0x)?(41)?[0-9a-fA-F]{40}$/;

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
  return bytesToHex(bs58check.decode(address));
}

/** Normalize base58 or hex (41… / 0x41…) to lowercase 42-char hex with 41 prefix. */
export function toComparableHex(address: string): string | null {
  if (!address) return null;
  if (isValidTronAddress(address)) {
    return tronBase58ToHex(address).toLowerCase();
  }
  if (!TRON_HEX_REGEX.test(address)) return null;
  let hex = address.startsWith("0x") || address.startsWith("0X")
    ? address.slice(2)
    : address;
  hex = hex.toLowerCase();
  if (!hex.startsWith("41")) {
    hex = `41${hex}`;
  }
  return hex.length === 42 ? hex : null;
}

export function tronHexToBase58(hexAddress: string): string {
  const hex = toComparableHex(hexAddress);
  if (!hex) {
    throw new Error(`Invalid TRON hex address: ${hexAddress}`);
  }
  return bs58check.encode(hexToBytes(hex));
}

/** Convert hex or base58 to base58 for storage/display. */
export function toBase58TronAddress(address: string): string {
  if (isValidTronAddress(address)) return address;
  return tronHexToBase58(address);
}

export function normalizeTronAddress(address: string): string {
  const hex = toComparableHex(address);
  if (!hex) {
    throw new Error(`Invalid TRON address: ${address}`);
  }
  return hex;
}

export function addressesEqual(a: string, b: string): boolean {
  const ha = toComparableHex(a);
  const hb = toComparableHex(b);
  if (!ha || !hb) return false;
  return ha === hb;
}

export function isBlockedRecipient(
  recipient: string,
  blocked: readonly string[],
): boolean {
  return blocked.some((addr) => addressesEqual(recipient, addr));
}
