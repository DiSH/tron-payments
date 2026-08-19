const AMOUNT_REGEX = /^\d+(?:\.\d{1,6})?$/;

export class AmountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountValidationError";
  }
}

export function parseUsdtDisplayAmount(amountDisplay: string): {
  integerPart: bigint;
  fractionalPart: bigint;
  decimalsUsed: number;
} {
  const trimmed = amountDisplay.trim();
  if (!AMOUNT_REGEX.test(trimmed)) {
    throw new AmountValidationError(
      "Amount must be a decimal string with up to 6 fractional digits",
    );
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > 6) {
    throw new AmountValidationError("USDT supports at most 6 decimal places");
  }

  const paddedFraction = fraction.padEnd(6, "0");
  return {
    integerPart: BigInt(whole),
    fractionalPart: BigInt(paddedFraction),
    decimalsUsed: fraction.length,
  };
}

export function usdtDisplayToRaw(amountDisplay: string): bigint {
  const { integerPart, fractionalPart } = parseUsdtDisplayAmount(amountDisplay);
  const raw = integerPart * 1_000_000n + fractionalPart;
  if (raw <= 0n) {
    throw new AmountValidationError("Amount must be greater than zero");
  }
  return raw;
}

export function usdtRawToDisplay(amountRaw: bigint | string): string {
  const raw = typeof amountRaw === "string" ? BigInt(amountRaw) : amountRaw;
  if (raw < 0n) {
    throw new AmountValidationError("Amount cannot be negative");
  }
  const whole = raw / 1_000_000n;
  const fraction = raw % 1_000_000n;
  return `${whole}.${fraction.toString().padStart(6, "0")}`;
}

export function assertAmountWithinLimit(
  amountRaw: bigint,
  maxPaymentAmountRaw: bigint,
): void {
  if (amountRaw <= 0n) {
    throw new AmountValidationError("Amount must be greater than zero");
  }
  if (amountRaw > maxPaymentAmountRaw) {
    throw new AmountValidationError("Amount exceeds configured maximum");
  }
}
