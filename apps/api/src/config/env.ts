import { z } from "zod";
import {
  addressesEqual,
  type SignerConfig,
  type TreasuryConfig,
} from "@tron-payments/shared";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  NETWORK: z.enum(["tron-mainnet", "tron-testnet"]).default("tron-mainnet"),
  TRON_RPC_URL: z.string().url(),
  TRON_RPC_API_KEY: z.string().optional(),
  USDT_CONTRACT_ADDRESS: z.string().min(1),
  USDT_DECIMALS: z.coerce.number().int().default(6),
  TRANSACTION_TTL_SECONDS: z.coerce.number().int().default(1800),
  MAX_PAYMENT_AMOUNT_RAW: z.string().default("1000000000"),
  DAILY_CUMULATIVE_LIMIT_RAW: z.string().optional(),
  RECIPIENT_ALLOWLIST_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  REQUIRED_CONFIRMATIONS_BEFORE_BROADCAST: z.coerce.number().int().default(1),
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(16),
  LOG_LEVEL: z.string().default("info"),
});

export type AppEnv = z.infer<typeof envSchema>;

export interface PolicyConfig {
  network: string;
  usdtContractAddress: string;
  usdtDecimals: number;
  transactionTtlSeconds: number;
  maxPaymentAmountRaw: string;
  dailyCumulativeLimitRaw: string | null;
  recipientAllowlistEnabled: boolean;
  requiredConfirmationsBeforeBroadcast: number;
}

export type StoredTreasuryFields = {
  treasuryAddress: string;
  activePermissionId: number;
  activePermissionName: string;
  threshold: number;
  signers: SignerConfig[];
};

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function envToPolicyConfig(env: AppEnv): PolicyConfig {
  return {
    network: env.NETWORK,
    usdtContractAddress: env.USDT_CONTRACT_ADDRESS,
    usdtDecimals: env.USDT_DECIMALS,
    transactionTtlSeconds: env.TRANSACTION_TTL_SECONDS,
    maxPaymentAmountRaw: env.MAX_PAYMENT_AMOUNT_RAW,
    dailyCumulativeLimitRaw: env.DAILY_CUMULATIVE_LIMIT_RAW ?? null,
    recipientAllowlistEnabled: env.RECIPIENT_ALLOWLIST_ENABLED ?? false,
    requiredConfirmationsBeforeBroadcast:
      env.REQUIRED_CONFIRMATIONS_BEFORE_BROADCAST,
  };
}

export function mergeTreasuryConfig(
  policy: PolicyConfig,
  stored: StoredTreasuryFields,
): TreasuryConfig {
  return {
    ...policy,
    treasuryAddress: stored.treasuryAddress,
    activePermissionId: stored.activePermissionId,
    activePermissionName: stored.activePermissionName,
    threshold: stored.threshold,
    signers: stored.signers,
  };
}

export function getBlockedRecipientAddresses(config: TreasuryConfig): string[] {
  return [
    config.treasuryAddress,
    ...config.signers.map((s) => s.address),
  ];
}

export function getSignerByAddress(
  config: TreasuryConfig,
  address: string,
): TreasuryConfig["signers"][number] | undefined {
  return config.signers.find((s) => addressesEqual(s.address, address));
}

/** Re-export for callers that still expect the type from this module. */
export type { TreasuryConfig };
