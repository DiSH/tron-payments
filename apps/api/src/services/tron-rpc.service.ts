import { TronWeb } from "tronweb";
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
    return this.tronWeb.trx.getSignWeight(transaction);
  }

  async broadcastTransaction(transaction: Record<string, unknown>) {
    return this.tronWeb.trx.sendRawTransaction(transaction);
  }

  async getTransactionInfo(txId: string) {
    return this.tronWeb.trx.getTransactionInfo(txId);
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

        const operations: string[] = permission.operations ?? [];
        const allowsTrigger = operations.some((op) =>
          op.toLowerCase().includes("trigger"),
        );
        if (!allowsTrigger) {
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
