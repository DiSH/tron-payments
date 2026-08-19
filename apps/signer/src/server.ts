import "dotenv/config";
import { createServer } from "node:http";
import { URL } from "node:url";
import { z } from "zod";
import { LedgerTronSigner, LedgerDeviceError } from "./ledger/tron-signer.js";
import {
  formatReviewScreen,
  validateSigningPayload,
} from "./validation/payload-validator.js";

const PORT = Number(process.env.SIGNER_CLIENT_PORT ?? 3847);
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const DERIVATION_PATH =
  process.env.SIGNER_LEDGER_DERIVATION_PATH ?? "m/44'/195'/0'/0/0";

const signQuerySchema = z.object({
  requestId: z.string().uuid(),
  token: z.string().min(16),
  authToken: z.string().min(10),
  expectedSignerAddress: z.string().min(1),
});

async function fetchSigningPayload(requestId: string, authToken: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/payment-requests/${requestId}/signing-payload`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${response.status}`);
  }
  return response.json();
}

async function submitSignature(input: {
  requestId: string;
  authToken: string;
  signature: string;
  txId: string;
  payloadHash: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/payment-requests/${input.requestId}/signatures`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature: input.signature,
        txId: input.txId,
        payloadHash: input.payloadHash,
        independentReviewConfirmed: true,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `Submit failed ${response.status}`);
  }
  return body;
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

    if (url.pathname === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/address") {
      const signer = new LedgerTronSigner(DERIVATION_PATH);
      const address = await signer.getAddress();
      res.writeHead(200);
      res.end(JSON.stringify({ address, derivationPath: DERIVATION_PATH }));
      return;
    }

    if (url.pathname === "/sign" && req.method === "GET") {
      const parsed = signQuerySchema.safeParse({
        requestId: url.searchParams.get("requestId"),
        token: url.searchParams.get("token"),
        authToken: url.searchParams.get("authToken"),
        expectedSignerAddress: url.searchParams.get("expectedSignerAddress"),
      });

      if (!parsed.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing query parameters for signing" }));
        return;
      }

      const payload = await fetchSigningPayload(
        parsed.data.requestId,
        parsed.data.authToken,
      );

      validateSigningPayload({
        digest: payload.digest,
        rawTransaction: payload.rawTransaction,
        rawDataHex: payload.rawDataHex,
        txId: payload.txId,
        payloadHash: payload.payloadHash,
      });

      console.log(
        formatReviewScreen({
          digest: payload.digest,
          rawTransaction: payload.rawTransaction,
          rawDataHex: payload.rawDataHex,
          txId: payload.txId,
          payloadHash: payload.payloadHash,
        }),
      );

      const ledger = new LedgerTronSigner(DERIVATION_PATH);
      const signed = await ledger.signTransactionHash(
        payload.rawDataHex,
        parsed.data.expectedSignerAddress,
      );

      const result = await submitSignature({
        requestId: parsed.data.requestId,
        authToken: parsed.data.authToken,
        signature: signed.signature,
        txId: payload.txId,
        payloadHash: payload.payloadHash,
      });

      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          signerAddress: signed.address,
          result,
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    const message =
      err instanceof LedgerDeviceError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    res.writeHead(400);
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Signer client listening on http://127.0.0.1:${PORT}`);
});
