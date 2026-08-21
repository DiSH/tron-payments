import { TronWeb, Types } from "tronweb";
import {
  addressesEqual,
  type TreasuryConfig,
} from "@tron-payments/shared";

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  treasuryExists: boolean;
  permissionMatched: boolean;
  usdtContractMatched: boolean;
}

export class TronRpcService {
  private readonly tronWeb: TronWeb;

  constructor(rpcUrl: string, apiKey?: string) {
    const headers = apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined;
    this.tronWeb = new TronWeb({
      fullHost: rpcUrl,
      headers,
    });
  }

  get client(): TronWeb {
    return this.tronWeb;
  }

  async getAccount(address: string) {
    return this.tronWeb.trx.getAccount(address);
  }

  async getSignWeight(transaction: Record<string, unknown>) {
    return this.tronWeb.trx.getSignWeight(
      transaction as unknown as Types.Transaction,
    );
  }

  async broadcastTransaction(transaction: Record<string, unknown>) {
    return this.tronWeb.trx.sendRawTransaction(
      transaction as unknown as Types.SignedTransaction,
    );
  }

  async getTransactionInfo(txId: string) {
    return this.tronWeb.trx.getTransactionInfo(txId);
  }

  async probeRpc(): Promise<void> {
    await this.tronWeb.trx.getNodeInfo();
  }

  async getTrc20Balance(contractAddress: string, ownerAddress: string) {
    this.tronWeb.setAddress(ownerAddress);
    const contract = await this.tronWeb.contract().at(contractAddress);
    const balance = await contract.balanceOf(ownerAddress).call();
    return BigInt(balance.toString());
  }

  async validateTreasuryConfig(
    config: TreasuryConfig,
  ): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let treasuryExists = false;
    let permissionMatched = false;
    let usdtContractMatched = false;

    try {
      const account = await this.getAccount(config.treasuryAddress);
      treasuryExists = Boolean(account?.address);

      if (!treasuryExists) {
        errors.push(`Treasury address not found on-chain: ${config.treasuryAddress}`);
        return {
          valid: false,
          errors,
          warnings,
          treasuryExists,
          permissionMatched,
          usdtContractMatched,
        };
      }

      const activePermissions = account.active_permission ?? [];
      const permission = activePermissions.find(
        (p: { id?: number }) => p.id === config.activePermissionId,
      );

      if (!permission) {
        errors.push(
          `Active permission ID ${config.activePermissionId} not found on treasury`,
        );
      } else {
        permissionMatched = permission.threshold === config.threshold;
        if (!permissionMatched) {
          errors.push(
            `Active permission threshold ${permission.threshold} != configured ${config.threshold}`,
          );
        }

        const permissionKeys: Array<{ address: string; weight: number }> =
          permission.keys ?? [];
        for (const signer of config.signers) {
          const match = permissionKeys.find((k) =>
            addressesEqual(k.address, signer.address),
          );
          if (!match) {
            errors.push(`Signer ${signer.label} not found in active permission`);
          } else if (match.weight !== signer.weight) {
            errors.push(
              `Signer ${signer.label} weight mismatch: on-chain ${match.weight}, config ${signer.weight}`,
            );
          }
        }

        if (!permissionAllowsTriggerSmartContract(permission.operations)) {
          errors.push("Active permission does not allow TriggerSmartContract");
        }
      }

      if (config.usdtContractAddress !== "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") {
        warnings.push("USDT contract differs from well-known mainnet USDT");
      }
      usdtContractMatched = Boolean(config.usdtContractAddress);

      const trxBalance = BigInt(account.balance ?? 0);
      if (trxBalance < 1_000_000n) {
        warnings.push("Treasury TRX balance appears low for fees/energy");
      }
    } catch (err) {
      errors.push(
        `TRON RPC error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      treasuryExists,
      permissionMatched,
      usdtContractMatched,
    };
  }
}

export function createTronRpcService(
  rpcUrl: string,
  apiKey?: string,
): TronRpcService {
  return new TronRpcService(rpcUrl, apiKey);
}

/** TriggerSmartContract = contract type 31 in TRON permission bitmask. */
export function permissionAllowsTriggerSmartContract(
  operations: unknown,
): boolean {
  if (operations == null) return false;
  const values = Array.isArray(operations) ? operations : [operations];
  return values.some((op) => {
    const s = String(op).toLowerCase();
    if (s.includes("trigger")) return true;
    const hex = s.startsWith("0x") ? s.slice(2) : s;
    if (!/^[0-9a-f]+$/.test(hex) || hex.length < 2) return false;
    try {
      const padded = hex.padEnd(64, "0").slice(0, 64);
      const buf = Buffer.from(padded, "hex");
      const bitIndex = 31;
      return (buf[Math.floor(bitIndex / 8)] & (1 << (bitIndex % 8))) !== 0;
    } catch {
      return false;
    }
  });
}
