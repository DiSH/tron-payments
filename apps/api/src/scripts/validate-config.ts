import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { AuditService } from "../services/audit.service.js";
import { createTronRpcService } from "../services/tron-rpc.service.js";
import { TreasuryConfigService } from "../services/treasury-config.service.js";

async function main() {
  const env = loadEnv();
  const tronRpc = createTronRpcService(env.TRON_RPC_URL, env.TRON_RPC_API_KEY);
  const audit = new AuditService();
  const treasuryConfig = new TreasuryConfigService(env, tronRpc, audit);

  const config = await treasuryConfig.load();
  if (!config) {
    console.log(
      JSON.stringify(
        {
          configured: false,
          message:
            "Treasury not configured. Set via Admin → Treasury Settings in the web UI.",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const { validation } = await treasuryConfig.validate();
  console.log(JSON.stringify({ configured: true, ...validation }, null, 2));

  if (!validation?.valid) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
