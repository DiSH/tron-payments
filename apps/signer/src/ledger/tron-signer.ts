import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import Trx from "@ledgerhq/hw-app-trx";
import { TronWeb, Types } from "tronweb";
import { addressesEqual } from "@tron-payments/shared";

export class LedgerDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerDeviceError";
  }
}

export interface LedgerSignResult {
  signature: string;
  address: string;
  derivationPath: string;
}

export class LedgerTronSigner {
  constructor(private readonly derivationPath: string) {}

  async getAddress(): Promise<string> {
    const transport = await this.openTransport();
    try {
      const app = new Trx(transport);
      const result = await app.getAddress(this.derivationPath);
      return result.address;
    } finally {
      await transport.close();
    }
  }

  async signTransactionHash(
    rawDataHex: string,
    expectedAddress: string,
  ): Promise<LedgerSignResult> {
    const transport = await this.openTransport();
    try {
      const app = new Trx(transport);
      const { address } = await app.getAddress(this.derivationPath);

      if (!addressesEqual(address, expectedAddress)) {
        throw new LedgerDeviceError(
          `Connected Ledger address ${address} does not match authorized signer ${expectedAddress}`,
        );
      }

      const signature = await app.signTransactionHash(
        this.derivationPath,
        rawDataHex,
      );

      return {
        signature: signature.startsWith("0x") ? signature.slice(2) : signature,
        address,
        derivationPath: this.derivationPath,
      };
    } finally {
      await transport.close();
    }
  }

  private async openTransport() {
    try {
      return await TransportNodeHid.create();
    } catch (err) {
      throw new LedgerDeviceError(
        err instanceof Error
          ? err.message
          : "Ledger not connected or Tron app not open",
      );
    }
  }
}

export function recoverSignerFromSignature(
  transaction: Record<string, unknown>,
): string {
  const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });
  const recovered = tronWeb.trx.ecRecover(
    transaction as unknown as Types.SignedTransaction,
  );
  return Array.isArray(recovered)
    ? (recovered[recovered.length - 1] ?? "")
    : recovered;
}
