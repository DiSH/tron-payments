import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  envToTreasuryConfig,
  loadEnv,
} from "./config/env.js";
import type { AppContext } from "./context.js";
import {
  registerAuditRoutes,
  registerAuthRoutes,
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

export async function buildApp() {
  const env = loadEnv();
  const config = envToTreasuryConfig(env);
  const tronRpc = createTronRpcService(env.TRON_RPC_URL, env.TRON_RPC_API_KEY);

  let configValid = false;
  let validationErrors: string[] = [];

  try {
    const validation = await tronRpc.validateTreasuryConfig(config);
    configValid = validation.valid;
    validationErrors = validation.errors;
    if (validation.warnings.length > 0) {
      console.warn("Treasury config warnings:", validation.warnings);
    }
    if (!configValid) {
      console.error("Treasury config validation failed:", validation.errors);
    }
  } catch (err) {
    validationErrors = [
      err instanceof Error ? err.message : "Unknown validation error",
    ];
    console.error("Startup config validation error:", validationErrors);
  }

  const audit = new AuditService();
  const auth = new AuthService(env.JWT_SECRET);
  const paymentRequests = new PaymentRequestService(tronRpc, audit);
  const broadcast = new BroadcastService(tronRpc, paymentRequests, audit);

  const ctx: AppContext = {
    env,
    config,
    configValid,
    validationErrors,
    auth,
    audit,
    paymentRequests,
    broadcast,
    tronRpc,
  };

  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await registerHealthRoutes(app, ctx);
  await registerAuthRoutes(app, ctx);
  await registerConfigRoutes(app, ctx);
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
