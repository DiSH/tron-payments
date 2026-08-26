import {
  addressesEqual,
  isValidTronAddress,
  toBase58TronAddress,
  type SignerConfig,
  type TreasuryConfig,
} from "@tron-payments/shared";
import { eq } from "drizzle-orm";
import {
  envToPolicyConfig,
  mergeTreasuryConfig,
  type AppEnv,
  type PolicyConfig,
} from "../config/env.js";
import { db } from "../db/client.js";
import {
  appConfigState,
  treasurySettings,
  type TreasurySignerRow,
} from "../db/schema/index.js";
import type { AuditService } from "./audit.service.js";
import {
  permissionAllowsTriggerSmartContract,
  type ConfigValidationResult,
  type TronRpcService,
} from "./tron-rpc.service.js";

export interface DiscoveredPermissionKey {
  address: string;
  weight: number;
}

export interface DiscoveredPermission {
  id: number;
  name: string;
  threshold: number;
  keys: DiscoveredPermissionKey[];
  operations: string[];
  allowsTriggerSmartContract: boolean;
}

export interface DiscoverResult {
  treasuryAddress: string;
  treasuryExists: boolean;
  activePermissions: DiscoveredPermission[];
}

export interface SaveTreasuryConfigInput {
  treasuryAddress: string;
  activePermissionId: number;
  signers: Array<{
    role: "signer";
    label: string;
    address: string;
  }>;
}

export class TreasuryConfigError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "TreasuryConfigError";
  }
}

export class TreasuryConfigService {
  private readonly policy: PolicyConfig;

  constructor(
    private readonly env: AppEnv,
    private readonly tronRpc: TronRpcService,
    private readonly audit: AuditService,
  ) {
    this.policy = envToPolicyConfig(env);
  }

  getPolicy(): PolicyConfig {
    return this.policy;
  }

  async load(): Promise<TreasuryConfig | null> {
    const [row] = await db
      .select()
      .from(treasurySettings)
      .where(eq(treasurySettings.id, 1))
      .limit(1);

    if (!row) return null;

    return mergeTreasuryConfig(this.policy, {
      treasuryAddress: row.treasuryAddress,
      activePermissionId: row.activePermissionId,
      activePermissionName: row.activePermissionName,
      threshold: row.threshold,
      signers: row.signers as SignerConfig[],
    });
  }

  async loadValidationState(): Promise<{
    configValid: boolean;
    validationErrors: string[];
    lastValidatedAt: Date | null;
  }> {
    const [row] = await db
      .select()
      .from(appConfigState)
      .where(eq(appConfigState.id, 1))
      .limit(1);

    if (!row) {
      return {
        configValid: false,
        validationErrors: ["Treasury not configured"],
        lastValidatedAt: null,
      };
    }

    return {
      configValid: row.configValid,
      validationErrors: (row.validationErrors ?? []) as string[],
      lastValidatedAt: row.lastValidatedAt,
    };
  }

  async discover(treasuryAddress: string): Promise<DiscoverResult> {
    if (!isValidTronAddress(treasuryAddress)) {
      throw new TreasuryConfigError("Invalid treasury address");
    }

    try {
      const account = await this.tronRpc.getAccount(treasuryAddress);
      const treasuryExists = Boolean(account?.address);
      const rawPermissions = account?.active_permission ?? [];

      const activePermissions: DiscoveredPermission[] = rawPermissions.map(
        (p: {
          id?: number;
          permission_name?: string;
          threshold?: number;
          keys?: Array<{ address: string; weight: number }>;
          operations?: string | string[];
        }) => {
          const operations = normalizeOperations(p.operations);
          const keys = (p.keys ?? []).map((k) => ({
            address: toBase58TronAddress(k.address),
            weight: k.weight,
          }));
          return {
            id: Number(p.id),
            name: p.permission_name ?? `Permission ${p.id}`,
            threshold: Number(p.threshold ?? 0),
            keys,
            operations,
            allowsTriggerSmartContract: permissionAllowsTriggerSmartContract(
              p.operations,
            ),
          };
        },
      );

      return {
        treasuryAddress,
        treasuryExists,
        activePermissions,
      };
    } catch (err) {
      throw new TreasuryConfigError(
        `Failed to discover treasury: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }
  }

  async save(
    input: SaveTreasuryConfigInput,
    actorUserId: string,
  ): Promise<{
    config: TreasuryConfig;
    validation: ConfigValidationResult;
  }> {
    if (!isValidTronAddress(input.treasuryAddress)) {
      throw new TreasuryConfigError("Invalid treasury address");
    }

    if (input.signers.length < 1) {
      throw new TreasuryConfigError("At least one signer is required");
    }
    if (input.signers.some((s) => s.role !== "signer")) {
      throw new TreasuryConfigError('Each signer must have role "signer"');
    }

    const addresses = input.signers.map((s) => s.address);
    for (const addr of addresses) {
      if (!isValidTronAddress(addr)) {
        throw new TreasuryConfigError(`Invalid signer address: ${addr}`);
      }
    }
    const unique = new Set(addresses.map((a) => a.toLowerCase()));
    if (unique.size !== addresses.length) {
      throw new TreasuryConfigError("Signer addresses must be unique");
    }

    const discovered = await this.discover(input.treasuryAddress);
    if (!discovered.treasuryExists) {
      throw new TreasuryConfigError(
        "Treasury address not found on-chain",
        422,
      );
    }

    const permission = discovered.activePermissions.find(
      (p) => p.id === input.activePermissionId,
    );
    if (!permission) {
      throw new TreasuryConfigError(
        `Active permission ID ${input.activePermissionId} not found on treasury`,
        422,
      );
    }

    if (input.signers.length > permission.keys.length) {
      throw new TreasuryConfigError(
        `Cannot allowlist ${input.signers.length} signers; permission has ${permission.keys.length} keys`,
        422,
      );
    }

    const signers: TreasurySignerRow[] = input.signers.map((s, index) => {
      const onChain = permission.keys.find((k) =>
        addressesEqual(k.address, s.address),
      );
      if (!onChain) {
        throw new TreasuryConfigError(
          `Signer ${s.label || s.address} address not found in selected permission`,
          422,
        );
      }
      return {
        role: "signer" as const,
        label: s.label.trim() || defaultLabel(index),
        address: s.address,
        weight: onChain.weight,
      };
    });

    const weightSum = signers.reduce((sum, s) => sum + s.weight, 0);
    if (weightSum < permission.threshold) {
      throw new TreasuryConfigError(
        `Allowlisted signer weight ${weightSum} is below permission threshold ${permission.threshold}`,
        422,
      );
    }

    const candidate = mergeTreasuryConfig(this.policy, {
      treasuryAddress: input.treasuryAddress,
      activePermissionId: permission.id,
      activePermissionName: permission.name,
      threshold: permission.threshold,
      signers: signers as SignerConfig[],
    });

    const validation = await this.tronRpc.validateTreasuryConfig(candidate);
    if (!validation.valid) {
      throw new TreasuryConfigError(
        "On-chain validation failed",
        422,
        validation.errors,
      );
    }

    const before = await this.load();

    await db
      .insert(treasurySettings)
      .values({
        id: 1,
        treasuryAddress: candidate.treasuryAddress,
        activePermissionId: candidate.activePermissionId,
        activePermissionName: candidate.activePermissionName,
        threshold: candidate.threshold,
        signers,
        updatedAt: new Date(),
        updatedBy: actorUserId,
      })
      .onConflictDoUpdate({
        target: treasurySettings.id,
        set: {
          treasuryAddress: candidate.treasuryAddress,
          activePermissionId: candidate.activePermissionId,
          activePermissionName: candidate.activePermissionName,
          threshold: candidate.threshold,
          signers,
          updatedAt: new Date(),
          updatedBy: actorUserId,
        },
      });

    await this.persistValidationState(validation);

    await this.audit.record(
      "TREASURY_CONFIG_UPDATED",
      { actorUserId, actorRole: "admin" },
      {
        before: before
          ? {
              treasuryAddress: before.treasuryAddress,
              activePermissionId: before.activePermissionId,
              activePermissionName: before.activePermissionName,
              threshold: before.threshold,
              signers: before.signers,
            }
          : null,
        after: {
          treasuryAddress: candidate.treasuryAddress,
          activePermissionId: candidate.activePermissionId,
          activePermissionName: candidate.activePermissionName,
          threshold: candidate.threshold,
          signers: candidate.signers,
        },
      },
    );

    return { config: candidate, validation };
  }

  async validate(): Promise<{
    config: TreasuryConfig | null;
    validation: ConfigValidationResult | null;
  }> {
    const config = await this.load();
    if (!config) {
      const empty: ConfigValidationResult = {
        valid: false,
        errors: ["Treasury not configured"],
        warnings: [],
        treasuryExists: false,
        permissionMatched: false,
        usdtContractMatched: false,
      };
      await this.persistValidationState(empty);
      return { config: null, validation: empty };
    }

    const validation = await this.tronRpc.validateTreasuryConfig(config);
    await this.persistValidationState(validation);
    return { config, validation };
  }

  private async persistValidationState(
    validation: ConfigValidationResult,
  ): Promise<void> {
    await db
      .insert(appConfigState)
      .values({
        id: 1,
        configValid: validation.valid,
        lastValidatedAt: new Date(),
        validationErrors: validation.errors,
      })
      .onConflictDoUpdate({
        target: appConfigState.id,
        set: {
          configValid: validation.valid,
          lastValidatedAt: new Date(),
          validationErrors: validation.errors,
        },
      });
  }
}

function defaultLabel(index: number): string {
  return `Signer ${index + 1}`;
}

function normalizeOperations(operations: string | string[] | undefined): string[] {
  if (!operations) return [];
  if (Array.isArray(operations)) return operations.map(String);
  // TRON often returns a hex bitmask string for operations
  return [String(operations)];
}
