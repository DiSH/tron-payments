import type { PaymentRequestStatus } from "../index.js";

const ALLOWED_TRANSITIONS: Record<
  PaymentRequestStatus,
  readonly PaymentRequestStatus[]
> = {
  DRAFT: ["AWAITING_SIGNATURES", "CANCELLED_IN_APP", "REJECTED"],
  AWAITING_SIGNATURES: [
    "PARTIALLY_SIGNED",
    "READY_TO_BROADCAST",
    "EXPIRED",
    "CANCELLED_IN_APP",
    "REJECTED",
  ],
  PARTIALLY_SIGNED: [
    "READY_TO_BROADCAST",
    "EXPIRED",
    "CANCELLED_IN_APP",
    "REJECTED",
  ],
  READY_TO_BROADCAST: [
    "BROADCASTING",
    "EXPIRED",
    "CANCELLED_IN_APP",
    "REJECTED",
  ],
  BROADCASTING: ["BROADCASTED", "BROADCAST_FAILED"],
  BROADCASTED: ["CONFIRMED", "BROADCAST_FAILED"],
  CONFIRMED: [],
  BROADCAST_FAILED: [],
  EXPIRED: [],
  CANCELLED_IN_APP: [],
  REJECTED: [],
};

const TERMINAL_STATUSES = new Set<PaymentRequestStatus>([
  "CONFIRMED",
  "BROADCAST_FAILED",
  "EXPIRED",
  "CANCELLED_IN_APP",
  "REJECTED",
]);

export function canTransition(
  from: PaymentRequestStatus,
  to: PaymentRequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: PaymentRequestStatus,
  to: PaymentRequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}

export function isTerminalStatus(status: PaymentRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function nextStatusAfterSignature(
  current: PaymentRequestStatus,
  sufficientWeight: boolean,
): PaymentRequestStatus {
  if (current === "AWAITING_SIGNATURES" || current === "PARTIALLY_SIGNED") {
    return sufficientWeight ? "READY_TO_BROADCAST" : "PARTIALLY_SIGNED";
  }
  throw new Error(`Cannot add signature in status ${current}`);
}

export function getAllowedTransitions(
  from: PaymentRequestStatus,
): readonly PaymentRequestStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
