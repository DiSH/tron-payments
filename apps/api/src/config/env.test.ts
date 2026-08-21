import { describe, it, expect } from "vitest";
import {
  envToPolicyConfig,
  mergeTreasuryConfig,
  type AppEnv,
} from "./env.js";

const env = {
  NODE_ENV: "test",
  NETWORK: "tron-testnet",
  TRON_RPC_URL: "https://example.com",
  USDT_CONTRACT_ADDRESS: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  USDT_DECIMALS: 6,
  TRANSACTION_TTL_SECONDS: 1800,
  MAX_PAYMENT_AMOUNT_RAW: "1000000000",
  REQUIRED_CONFIRMATIONS_BEFORE_BROADCAST: 1,
  DATABASE_URL: "postgresql://localhost/test",
  API_HOST: "0.0.0.0",
  API_PORT: 3000,
  CORS_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "test-secret-at-least-16",
  SESSION_SECRET: "test-session-at-least",
  LOG_LEVEL: "info",
  RECIPIENT_ALLOWLIST_ENABLED: false,
} as AppEnv;

describe("env policy + treasury merge", () => {
  it("builds policy from env without treasury addresses", () => {
    const policy = envToPolicyConfig(env);
    expect(policy.network).toBe("tron-testnet");
    expect(policy.usdtContractAddress).toBe(
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    );
    expect(policy).not.toHaveProperty("treasuryAddress");
  });

  it("merges stored treasury fields with policy", () => {
    const config = mergeTreasuryConfig(envToPolicyConfig(env), {
      treasuryAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      activePermissionId: 2,
      activePermissionName: "payments",
      threshold: 2,
      signers: [
        {
          role: "signer_a",
          label: "A",
          address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          weight: 1,
        },
        {
          role: "signer_b",
          label: "B",
          address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          weight: 1,
        },
        {
          role: "signer_c",
          label: "C",
          address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          weight: 1,
        },
      ],
    });
    expect(config.treasuryAddress).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    expect(config.threshold).toBe(2);
    expect(config.usdtDecimals).toBe(6);
    expect(config.network).toBe("tron-testnet");
  });
});
