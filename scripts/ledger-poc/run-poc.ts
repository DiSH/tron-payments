/**
 * Ledger TRON multisig POC script (testnet).
 *
 * Usage (with Ledger connected and Tron app open):
 *   devbox run -- npm run poc:ledger -w @tron-payments/api
 *
 * Requires env:
 *   TRON_RPC_URL, TREASURY_ADDRESS, ACTIVE_PERMISSION_ID, SIGNER_* addresses
 */

import "dotenv/config";
import { loadEnv, envToTreasuryConfig } from "../../apps/api/src/config/env.js";
import { createTronRpcService } from "../../apps/api/src/services/tron-rpc.service.js";
import { TransactionBuilderService } from "../../apps/api/src/services/transaction-builder.service.js";

async function main() {
  const env = loadEnv();
  const config = envToTreasuryConfig(env);
  const tronRpc = createTronRpcService(env.TRON_RPC_URL, env.TRON_RPC_API_KEY);
  const builder = new TransactionBuilderService(tronRpc);

  console.log("Step 1: Validate treasury config on-chain...");
  const validation = await tronRpc.validateTreasuryConfig(config);
  console.log(JSON.stringify(validation, null, 2));
  if (!validation.valid) {
    throw new Error("Treasury config invalid for POC");
  }

  console.log("Step 2: Build unsigned USDT transfer with Active Permission...");
  const expirationAt = new Date(Date.now() + 30 * 60_000);
  const built = await builder.buildUsdtTransfer({
    requestId: "poc_test_001",
    recipientAddress: config.signers[0].address,
    amountDisplay: "0.000001",
    expirationAt,
    config,
  });

  console.log("Built txID:", built.txId);
  console.log("Payload hash:", built.canonicalPayloadHash);
  console.log("Calldata:", built.calldata);
  console.log("");
  console.log("Step 3+: Sign with Ledger via apps/signer, collect 2 signatures, broadcast.");
  console.log("Document results in docs/ledger-poc-report.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
