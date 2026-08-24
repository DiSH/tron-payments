import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import type { AppContext } from "./context.js";
import {
  registerAuditRoutes,
  registerAuthRoutes,
  registerAdminTreasuryConfigRoutes,
  registerAdminUserRoutes,
  registerConfigRoutes,
  registerHealthRoutes,
  registerPaymentRequestRoutes,
  registerTreasuryRoutes,
} from "./routes/index.js";
import { AuditService } from "./services/audit.service.js";
import { AuthService } from "./services/auth.service.js";
import { BroadcastService } from "./services/broadcast.service.js";
import { PaymentRequestService } from "./services/payment-request.service.js";
import { createTronRpcService } from "./services/tron-rpc.service.js";
import { TreasuryConfigService } from "./services/treasury-config.service.js";
import { UserService } from "./services/user.service.js";

export async function buildApp() {
  const env = loadEnv();
  const tronRpc = createTronRpcService(env.TRON_RPC_URL, env.TRON_RPC_API_KEY);
  const audit = new AuditService();
  const auth = new AuthService(env.JWT_SECRET);
  const userAdmin = new UserService(audit);
  const treasuryConfig = new TreasuryConfigService(env, tronRpc, audit);
  const paymentRequests = new PaymentRequestService(tronRpc, audit);
  const broadcast = new BroadcastService(tronRpc, paymentRequests, audit);

  let config = await treasuryConfig.load();
  let configValid = false;
  let validationErrors: string[] = ["Treasury not configured"];

  if (!config) {
    await treasuryConfig.validate(); // persists "not configured" into app_config_state
    console.warn(
      "Treasury not configured — set via Admin → Treasury Settings. Create/broadcast blocked until configured.",
    );
  } else {
    try {
      const { validation } = await treasuryConfig.validate();
      configValid = validation?.valid ?? false;
      validationErrors = validation?.errors ?? [];
      if (validation?.warnings?.length) {
        console.warn("Treasury config warnings:", validation.warnings);
      }
      if (!configValid) {
        console.error("Treasury config validation failed:", validationErrors);
      }
    } catch (err) {
      validationErrors = [
        err instanceof Error ? err.message : "Unknown validation error",
      ];
      configValid = false;
      console.error("Startup config validation error:", validationErrors);
    }
  }

  const ctx: AppContext = {
    env,
    config,
    configValid,
    validationErrors,
    auth,
    audit,
    users: userAdmin,
    paymentRequests,
    broadcast,
    tronRpc,
    treasuryConfig,
    applyTreasuryRuntime(nextConfig, nextValid, nextErrors) {
      ctx.config = nextConfig;
      ctx.configValid = nextValid;
      ctx.validationErrors = nextErrors;
    },
  };

  const app = Fastify({ logger: true, trustProxy: true });
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await registerHealthRoutes(app, ctx);
  await registerAuthRoutes(app, ctx);
  await registerConfigRoutes(app, ctx);
  await registerAdminTreasuryConfigRoutes(app, ctx);
  await registerAdminUserRoutes(app, ctx);
  await registerTreasuryRoutes(app, ctx);
  await registerPaymentRequestRoutes(app, ctx);
  await registerAuditRoutes(app, ctx);

  return { app, ctx };
}

async function start() {
  const { app, ctx } = await buildApp();
  await app.listen({ port: ctx.env.API_PORT, host: ctx.env.API_HOST });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
