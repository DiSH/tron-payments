/**
 * Local signer client HTTP helper.
 * Runs on signer's machine only. Ledger integration via @ledgerhq/hw-app-trx (TODO).
 * See project bible §7.2 and §11.
 */

import { createServer } from "node:http";
import { PROJECT_NAME } from "@tron-payments/shared";

const PORT = Number(process.env.SIGNER_CLIENT_PORT ?? 3847);

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      project: PROJECT_NAME,
      note: "Signer client skeleton — Ledger integration pending POC",
    }),
  );
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Signer client listening on http://127.0.0.1:${PORT}`);
});
