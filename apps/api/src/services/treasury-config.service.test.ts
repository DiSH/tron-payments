import { describe, it, expect, vi, beforeEach } from "vitest";
import { tronBase58ToHex } from "@tron-payments/shared";
import { permissionAllowsTriggerSmartContract } from "./tron-rpc.service.js";
import {
  TreasuryConfigError,
  TreasuryConfigService,
} from "./treasury-config.service.js";
import type { AppEnv } from "../config/env.js";

const ADDR_A = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
/** Well-known TRON blackhole address (valid base58check). */
const ADDR_B = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

vi.mock("../db/client.js", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const handler = () => chain;
  for (const key of [
    "select",
    "from",
    "where",
    "limit",
    "insert",
    "values",
    "onConflictDoUpdate",
  ]) {
    chain[key] = vi.fn(handler);
  }
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  return { db: chain };
});

function makeEnv(): AppEnv {
  return {
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
  };
}

describe("permissionAllowsTriggerSmartContract", () => {
  it("detects trigger keyword", () => {
    expect(permissionAllowsTriggerSmartContract(["TriggerSmartContract"])).toBe(
      true,
    );
  });

  it("detects bit 31 in hex operations bitmask", () => {
    const buf = Buffer.alloc(32, 0);
    buf[Math.floor(31 / 8)] |= 1 << (31 % 8);
    expect(permissionAllowsTriggerSmartContract(buf.toString("hex"))).toBe(true);
  });

  it("returns false for empty bitmask", () => {
    expect(permissionAllowsTriggerSmartContract("00".repeat(32))).toBe(false);
  });
});

describe("TreasuryConfigService.discover", () => {
  const audit = { record: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid treasury address", async () => {
    const tronRpc = { getAccount: vi.fn() };
    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );
    await expect(svc.discover("not-valid")).rejects.toBeInstanceOf(
      TreasuryConfigError,
    );
  });

  it("parses active permissions and converts hex keys to base58", async () => {
    const hexA = tronBase58ToHex(ADDR_A);
    const ops = Buffer.alloc(32, 0);
    ops[Math.floor(31 / 8)] |= 1 << (31 % 8);

    const tronRpc = {
      getAccount: vi.fn().mockResolvedValue({
        address: hexA,
        active_permission: [
          {
            id: 2,
            permission_name: "payments",
            threshold: 2,
            keys: [{ address: hexA, weight: 1 }],
            operations: ops.toString("hex"),
          },
        ],
      }),
    };

    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );
    const result = await svc.discover(ADDR_A);
    expect(result.treasuryExists).toBe(true);
    expect(result.activePermissions).toHaveLength(1);
    expect(result.activePermissions[0].id).toBe(2);
    expect(result.activePermissions[0].keys[0].address).toBe(ADDR_A);
    expect(result.activePermissions[0].allowsTriggerSmartContract).toBe(true);
  });
});

describe("TreasuryConfigService.save validation", () => {
  const audit = { record: vi.fn().mockResolvedValue({}) };

  it("rejects empty signer set before hitting chain", async () => {
    const tronRpc = {
      getAccount: vi.fn(),
      validateTreasuryConfig: vi.fn(),
    };
    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );

    await expect(
      svc.save(
        {
          treasuryAddress: ADDR_A,
          activePermissionId: 2,
          signers: [],
        },
        "user-1",
      ),
    ).rejects.toMatchObject({ message: "At least one signer is required" });

    expect(tronRpc.getAccount).not.toHaveBeenCalled();
  });

  it("rejects duplicate signer addresses", async () => {
    const tronRpc = {
      getAccount: vi.fn(),
      validateTreasuryConfig: vi.fn(),
    };
    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );

    await expect(
      svc.save(
        {
          treasuryAddress: ADDR_A,
          activePermissionId: 2,
          signers: [
            { role: "signer", label: "A", address: ADDR_A },
            { role: "signer", label: "B", address: ADDR_A },
          ],
        },
        "user-1",
      ),
    ).rejects.toMatchObject({ message: "Signer addresses must be unique" });
  });

  it("rejects when allowlisted weight is below permission threshold", async () => {
    const hexA = tronBase58ToHex(ADDR_A);
    const hexB = tronBase58ToHex(ADDR_B);
    const ops = Buffer.alloc(32, 0);
    ops[Math.floor(31 / 8)] |= 1 << (31 % 8);

    const tronRpc = {
      getAccount: vi.fn().mockResolvedValue({
        address: hexA,
        active_permission: [
          {
            id: 2,
            permission_name: "active",
            threshold: 2,
            keys: [
              { address: hexA, weight: 1 },
              { address: hexB, weight: 1 },
            ],
            operations: ops.toString("hex"),
          },
        ],
      }),
      validateTreasuryConfig: vi.fn(),
    };
    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );

    await expect(
      svc.save(
        {
          treasuryAddress: ADDR_A,
          activePermissionId: 2,
          signers: [{ role: "signer", label: "A", address: ADDR_A }],
        },
        "user-1",
      ),
    ).rejects.toMatchObject({
      message:
        "Allowlisted signer weight 1 is below permission threshold 2",
    });

    expect(tronRpc.validateTreasuryConfig).not.toHaveBeenCalled();
  });

  it("accepts two allowlisted signers when weight meets threshold", async () => {
    const hexA = tronBase58ToHex(ADDR_A);
    const hexB = tronBase58ToHex(ADDR_B);
    const ops = Buffer.alloc(32, 0);
    ops[Math.floor(31 / 8)] |= 1 << (31 % 8);

    const tronRpc = {
      getAccount: vi.fn().mockResolvedValue({
        address: hexA,
        active_permission: [
          {
            id: 2,
            permission_name: "active",
            threshold: 2,
            keys: [
              { address: hexA, weight: 1 },
              { address: hexB, weight: 1 },
            ],
            operations: ops.toString("hex"),
          },
        ],
      }),
      validateTreasuryConfig: vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        treasuryExists: true,
        permissionMatched: true,
        usdtContractMatched: true,
      }),
    };
    const svc = new TreasuryConfigService(
      makeEnv(),
      tronRpc as never,
      audit as never,
    );

    const result = await svc.save(
      {
        treasuryAddress: ADDR_A,
        activePermissionId: 2,
        signers: [
          { role: "signer", label: "A", address: ADDR_A },
          { role: "signer", label: "B", address: ADDR_B },
        ],
      },
      "user-1",
    );

    expect(result.config.threshold).toBe(2);
    expect(result.config.signers).toHaveLength(2);
    expect(result.validation.valid).toBe(true);
    expect(audit.record).toHaveBeenCalled();
  });
});
