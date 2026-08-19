import Fastify from "fastify";
import { PROJECT_NAME } from "@tron-payments/shared";

const PORT = Number(process.env.API_PORT ?? 3000);
const HOST = process.env.API_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

app.get("/health/live", async () => ({ status: "ok" }));

app.get("/health/ready", async () => ({
  status: "ok",
  project: PROJECT_NAME,
  note: "API skeleton — full implementation pending",
}));

app.get("/api/config/public", async () => ({
  network: process.env.NETWORK ?? "tron-mainnet",
  treasuryAddress: process.env.TREASURY_ADDRESS ?? null,
  threshold: Number(process.env.THRESHOLD ?? 2),
  usdtDecimals: Number(process.env.USDT_DECIMALS ?? 6),
}));

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
