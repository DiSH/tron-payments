import "dotenv/config";
import {
  envToTreasuryConfig,
  loadEnv,
} from "../config/env.js";
import { createTronRpcService } from "../services/tron-rpc.service.js";

async function main() {
  const env = loadEnv();
  const config = envToTreasuryConfig(env);
  const tronRpc = createTronRpcService(env.TRON_RPC_URL, env.TRON_RPC_API_KEY);
  const result = await tronRpc.validateTreasuryConfig(config);

  console.log(JSON.stringify(result, null, 2));

  if (!result.valid) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
