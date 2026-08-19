import "dotenv/config";
import { db, sql } from "./db/client.js";
import { AuthService } from "./services/auth.service.js";
import { loadEnv } from "./config/env.js";

async function main() {
  const env = loadEnv();
  const auth = new AuthService(env.JWT_SECRET);

  const seeds = [
    {
      email: "requester@example.com",
      password: "changeme-requester",
      roles: ["requester", "executor"] as const,
    },
    {
      email: "signer-a@example.com",
      password: "changeme-signer-a",
      roles: ["signer_a", "requester"] as const,
      signerAddress: env.SIGNER_A_ADDRESS,
    },
    {
      email: "signer-b@example.com",
      password: "changeme-signer-b",
      roles: ["signer_b"] as const,
      signerAddress: env.SIGNER_B_ADDRESS,
    },
    {
      email: "admin@example.com",
      password: "changeme-admin",
      roles: ["admin", "auditor", "executor", "requester"] as const,
    },
  ];

  for (const seed of seeds) {
    try {
      await auth.register({
        email: seed.email,
        password: seed.password,
        roles: [...seed.roles],
        signerAddress: "signerAddress" in seed ? seed.signerAddress : undefined,
      });
      console.log(`Created user ${seed.email}`);
    } catch {
      console.log(`Skipped existing user ${seed.email}`);
    }
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
