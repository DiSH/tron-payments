export const PROJECT_NAME = "tron-payments" as const;

export const PAYMENT_REQUEST_STATUSES = [
  "DRAFT",
  "AWAITING_SIGNATURES",
  "PARTIALLY_SIGNED",
  "READY_TO_BROADCAST",
  "BROADCASTING",
  "BROADCASTED",
  "CONFIRMED",
  "BROADCAST_FAILED",
  "EXPIRED",
  "CANCELLED_IN_APP",
  "REJECTED",
] as const;

export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export const ROLES = [
  "requester",
  "signer",
  "executor",
  "admin",
  "auditor",
] as const;

export type Role = (typeof ROLES)[number];

export const ALLOWED_OPERATION = "transfer(address,uint256)" as const;
export const NETWORK_MAINNET = "tron-mainnet" as const;
export const NETWORK_TESTNET = "tron-testnet" as const;

export type Network = typeof NETWORK_MAINNET | typeof NETWORK_TESTNET;

export * from "./types/payment-request.js";
export * from "./types/config.js";
export * from "./canonical/digest.js";
export * from "./state-machine/transitions.js";
export * from "./tron/address.js";
export * from "./tron/amount.js";
export * from "./tron/trc20.js";
