import { z } from "zod";
import type { TreasuryConfig } from "@tron-payments/shared";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  NETWORK: z.enum(["tron-mainnet", "tron-testnet"]).default("tron-mainnet"),
  TRON_RPC_URL: z.string().url(),
  TRON_RPC_API_KEY: z.string().optional(),
  TREASURY_ADDRESS: z.string().min(1),
  ACTIVE_PERMISSION_ID: z.coerce.number().int().positive(),
  ACTIVE_PERMISSION_NAME: z.string().default("Treasury payments"),
  THRESHOLD: z.coerce.number().int().positive().default(2),
  SIGNER_A_ADDRESS: z.string().min(1),
  SIGNER_A_LABEL: z.string().default("Finance A"),
  SIGNER_B_ADDRESS: z.string().min(1),
  SIGNER_B_LABEL: z.string().default("Finance B"),
  SIGNER_C_ADDRESS: z.string().min(1),
  SIGNER_C_LABEL: z.string().default("Finance C"),
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

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function envToTreasuryConfig(env: AppEnv): TreasuryConfig {
  return {
    network: env.NETWORK,
    treasuryAddress: env.TREASURY_ADDRESS,
    activePermissionId: env.ACTIVE_PERMISSION_ID,
    activePermissionName: env.ACTIVE_PERMISSION_NAME,
    threshold: env.THRESHOLD,
    signers: [
      {
        label: env.SIGNER_A_LABEL,
        address: env.SIGNER_A_ADDRESS,
        weight: 1,
        role: "signer_a",
      },
      {
        label: env.SIGNER_B_LABEL,
        address: env.SIGNER_B_ADDRESS,
        weight: 1,
        role: "signer_b",
      },
      {
        label: env.SIGNER_C_LABEL,
        address: env.SIGNER_C_ADDRESS,
        weight: 1,
        role: "signer_c",
      },
    ],
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
  return config.signers.find(
    (s) => s.address.toLowerCase() === address.toLowerCase(),
  );
}
