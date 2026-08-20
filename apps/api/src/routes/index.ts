import type { FastifyInstance } from "fastify";
import { createAuthHook, requireRoles } from "../plugins/auth.js";
import type { AppContext } from "../context.js";
import { generateSigningToken } from "../services/audit.service.js";
import { TreasuryConfigError } from "../services/treasury-config.service.js";

export async function registerAuthRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return reply.code(400).send({ error: "email and password required" });
    }
    try {
      const result = await ctx.auth.login(body.email, body.password);
      return result;
    } catch {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
  });

  app.get(
    "/api/me",
    { preHandler: createAuthHook(ctx.auth) },
    async (request) => {
      const user = await ctx.auth.getUserById(request.user!.id);
      return user;
    },
  );
}

export async function registerConfigRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/config/public", async () => {
    if (!ctx.config) {
      return {
        configured: false,
        network: ctx.env.NETWORK,
        treasuryAddress: null,
        activePermissionId: null,
        activePermissionName: null,
        threshold: null,
        signers: [],
        usdtContractAddress: ctx.env.USDT_CONTRACT_ADDRESS,
        usdtDecimals: ctx.env.USDT_DECIMALS,
        configValid: false,
        validationErrors: ctx.validationErrors,
      };
    }

    return {
      configured: true,
      network: ctx.env.NETWORK,
      treasuryAddress: ctx.config.treasuryAddress,
      activePermissionId: ctx.config.activePermissionId,
      activePermissionName: ctx.config.activePermissionName,
      threshold: ctx.config.threshold,
      signers: ctx.config.signers.map((s) => ({
        label: s.label,
        address: s.address,
        weight: s.weight,
        role: s.role,
      })),
      usdtContractAddress: ctx.config.usdtContractAddress,
      usdtDecimals: ctx.config.usdtDecimals,
      configValid: ctx.configValid,
      validationErrors: ctx.validationErrors,
    };
  });
}

export async function registerAdminTreasuryConfigRoutes(
  app: FastifyInstance,
  ctx: AppContext,
) {
  const auth = createAuthHook(ctx.auth);
  const adminOnly = requireRoles("admin");

  app.get(
    "/api/admin/treasury-config",
    { preHandler: [auth, adminOnly] },
    async () => {
      const config = await ctx.treasuryConfig.load();
      const state = await ctx.treasuryConfig.loadValidationState();
      if (!config) {
        return {
          configured: false,
          configValid: false,
          validationErrors: state.validationErrors,
          lastValidatedAt: state.lastValidatedAt,
          config: null,
        };
      }
      return {
        configured: true,
        configValid: state.configValid,
        validationErrors: state.validationErrors,
        lastValidatedAt: state.lastValidatedAt,
        config: {
          treasuryAddress: config.treasuryAddress,
          activePermissionId: config.activePermissionId,
          activePermissionName: config.activePermissionName,
          threshold: config.threshold,
          signers: config.signers,
          network: config.network,
          usdtContractAddress: config.usdtContractAddress,
        },
      };
    },
  );

  app.get(
    "/api/admin/treasury-config/discover",
    { preHandler: [auth, adminOnly] },
    async (request, reply) => {
      const query = request.query as { address?: string };
      if (!query.address) {
        return reply.code(400).send({ error: "address query parameter required" });
      }
      try {
        return await ctx.treasuryConfig.discover(query.address);
      } catch (err) {
        return sendTreasuryConfigError(reply, err);
      }
    },
  );

  app.put(
    "/api/admin/treasury-config",
    { preHandler: [auth, adminOnly] },
    async (request, reply) => {
      const body = request.body as {
        treasuryAddress?: string;
        activePermissionId?: number;
        signers?: Array<{
          role?: "signer_a" | "signer_b" | "signer_c";
          label?: string;
          address?: string;
        }>;
      };

      if (
        !body.treasuryAddress ||
        body.activePermissionId == null ||
        !Array.isArray(body.signers)
      ) {
        return reply
          .code(400)
          .send({ error: "treasuryAddress, activePermissionId, and signers required" });
      }

      const signers = body.signers.map((s) => ({
        role: s.role!,
        label: s.label ?? "",
        address: s.address!,
      }));

      if (signers.some((s) => !s.role || !s.address)) {
        return reply
          .code(400)
          .send({ error: "Each signer requires role and address" });
      }

      try {
        const { config, validation } = await ctx.treasuryConfig.save(
          {
            treasuryAddress: body.treasuryAddress,
            activePermissionId: body.activePermissionId,
            signers,
          },
          request.user!.id,
        );
        ctx.applyTreasuryRuntime(config, validation.valid, validation.errors);
        return {
          configured: true,
          configValid: validation.valid,
          validationErrors: validation.errors,
          warnings: validation.warnings,
          config: {
            treasuryAddress: config.treasuryAddress,
            activePermissionId: config.activePermissionId,
            activePermissionName: config.activePermissionName,
            threshold: config.threshold,
            signers: config.signers,
          },
        };
      } catch (err) {
        return sendTreasuryConfigError(reply, err);
      }
    },
  );

  app.post(
    "/api/admin/treasury-config/validate",
    { preHandler: [auth, adminOnly] },
    async (_request, reply) => {
      try {
        const { config, validation } = await ctx.treasuryConfig.validate();
        ctx.applyTreasuryRuntime(
          config,
          validation?.valid ?? false,
          validation?.errors ?? ["Treasury not configured"],
        );
        return {
          configured: Boolean(config),
          validation,
        };
      } catch (err) {
        return sendTreasuryConfigError(reply, err);
      }
    },
  );
}

function sendTreasuryConfigError(
  reply: import("fastify").FastifyReply,
  err: unknown,
) {
  if (err instanceof TreasuryConfigError) {
    return reply.code(err.statusCode).send({
      error: err.message,
      details: err.details,
    });
  }
  return reply.code(500).send({
    error: err instanceof Error ? err.message : String(err),
  });
}

export async function registerTreasuryRoutes(
  app: FastifyInstance,
  ctx: AppContext,
) {
  const auth = createAuthHook(ctx.auth);

  app.get("/api/treasury/health", { preHandler: auth }, async (_request, reply) => {
    if (!ctx.config) {
      return reply.code(404).send({ error: "not_configured" });
    }
    const validation = await ctx.tronRpc.validateTreasuryConfig(ctx.config);
    return validation;
  });

  app.get(
    "/api/treasury/permissions",
    { preHandler: auth },
    async (_request, reply) => {
      if (!ctx.config) {
        return reply.code(404).send({ error: "not_configured" });
      }
      const account = await ctx.tronRpc.getAccount(ctx.config.treasuryAddress);
      return {
        ownerPermission: account.owner_permission,
        activePermissions: account.active_permission,
      };
    },
  );

  app.get(
    "/api/treasury/balances",
    { preHandler: auth },
    async (_request, reply) => {
      if (!ctx.config) {
        return reply.code(404).send({ error: "not_configured" });
      }
      const account = await ctx.tronRpc.getAccount(ctx.config.treasuryAddress);
      const usdtBalance = await ctx.tronRpc.getTrc20Balance(
        ctx.config.usdtContractAddress,
        ctx.config.treasuryAddress,
      );
      return {
        trxBalance: account.balance?.toString?.() ?? account.balance,
        usdtBalance: usdtBalance.toString(),
      };
    },
  );
}

export async function registerPaymentRequestRoutes(
  app: FastifyInstance,
  ctx: AppContext,
) {
  const auth = createAuthHook(ctx.auth);

  app.post(
    "/api/payment-requests",
    { preHandler: [auth, requireRoles("requester", "admin")] },
    async (request, reply) => {
      if (!ctx.config) {
        return reply.code(400).send({ error: "Treasury not configured" });
      }

      const body = request.body as {
        recipientAddress?: string;
        amountDisplay?: string;
        purpose?: string;
        externalReference?: string;
        documentUrl?: string;
        expirationMinutes?: number;
      };

      if (
        !body.recipientAddress ||
        !body.amountDisplay ||
        !body.purpose ||
        !body.externalReference
      ) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      try {
        const record = await ctx.paymentRequests.create({
          recipientAddress: body.recipientAddress,
          amountDisplay: body.amountDisplay,
          purpose: body.purpose,
          externalReference: body.externalReference,
          documentUrl: body.documentUrl,
          expirationMinutes: body.expirationMinutes,
          createdBy: request.user!.id,
          config: ctx.config,
          configValid: ctx.configValid,
        });
        return record;
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.get("/api/payment-requests", { preHandler: auth }, async () => {
    return ctx.paymentRequests.list();
  });

  app.get("/api/payment-requests/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await ctx.paymentRequests.getById(id);
    if (!record) return reply.code(404).send({ error: "Not found" });
    return record;
  });

  app.post(
    "/api/payment-requests/:id/cancel",
    { preHandler: [auth, requireRoles("requester", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const record = await ctx.paymentRequests.getById(id);
        if (!record) return reply.code(404).send({ error: "Not found" });
        const sigs = await ctx.paymentRequests.getSignatures(id);
        const hasSignature = sigs.length > 0;
        const updated = await ctx.paymentRequests.cancel(
          id,
          request.user!.id,
          hasSignature,
        );
        return updated;
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.post(
    "/api/payment-requests/:id/signing-session",
    { preHandler: [auth, requireRoles("signer_a", "signer_b", "signer_c", "admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      if (!user.signerAddress) {
        return reply.code(400).send({ error: "User has no registered signer address" });
      }

      const token = generateSigningToken();
      const expiresAt = new Date(Date.now() + 5 * 60_000);

      await ctx.paymentRequests.createSigningSession({
        paymentRequestId: id,
        userId: user.id,
        signerAddress: user.signerAddress,
        token,
        expiresAt,
      });

      return {
        requestId: id,
        signingToken: token,
        signerClientUrl: `http://127.0.0.1:${process.env.SIGNER_CLIENT_PORT ?? 3847}/sign?requestId=${id}&token=${token}`,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  app.get(
    "/api/payment-requests/:id/signing-payload",
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await ctx.paymentRequests.getSigningPayload(id);
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.post(
    "/api/payment-requests/:id/signatures",
    { preHandler: [auth, requireRoles("signer_a", "signer_b", "signer_c", "admin")] },
    async (request, reply) => {
      if (!ctx.config) {
        return reply.code(400).send({ error: "Treasury not configured" });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        signature?: string;
        txId?: string;
        payloadHash?: string;
        independentReviewConfirmed?: boolean;
      };
      const user = request.user!;

      if (!body.signature || !body.txId || !body.payloadHash) {
        return reply.code(400).send({ error: "Missing signature fields" });
      }
      if (!body.independentReviewConfirmed) {
        return reply.code(400).send({ error: "Independent review confirmation required" });
      }
      if (!user.signerAddress) {
        return reply.code(400).send({ error: "User has no registered signer address" });
      }

      await ctx.audit.record(
        "INDEPENDENT_REVIEW_CONFIRMED",
        { actorUserId: user.id },
        { paymentRequestId: id },
      );

      try {
        const result = await ctx.paymentRequests.addSignature({
          paymentRequestId: id,
          signatureHex: body.signature,
          signerUserId: user.id,
          expectedSignerAddress: user.signerAddress,
          config: ctx.config,
        });
        return result;
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.get(
    "/api/payment-requests/:id/sign-weight",
    { preHandler: auth },
    async (request, reply) => {
      if (!ctx.config) {
        return reply.code(400).send({ error: "Treasury not configured" });
      }
      const { id } = request.params as { id: string };
      try {
        return await ctx.paymentRequests.getSignWeight(id, ctx.config.threshold);
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.post(
    "/api/payment-requests/:id/broadcast",
    { preHandler: [auth, requireRoles("executor", "admin")] },
    async (request, reply) => {
      if (!ctx.config) {
        return reply.code(400).send({ error: "Treasury not configured" });
      }
      const { id } = request.params as { id: string };
      try {
        return await ctx.broadcast.broadcast({
          paymentRequestId: id,
          actorUserId: request.user!.id,
          threshold: ctx.config.threshold,
          configValid: ctx.configValid,
        });
      } catch (err) {
        return reply.code(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}

export async function registerAuditRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = createAuthHook(ctx.auth);

  app.get(
    "/api/audit-events",
    { preHandler: [auth, requireRoles("auditor", "admin")] },
    async (request) => {
      const query = request.query as { paymentRequestId?: string; limit?: string };
      return ctx.audit.list({
        paymentRequestId: query.paymentRequestId,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
  );
}

export async function registerHealthRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async () => ({
    status: "ok",
    configValid: ctx.configValid,
    treasuryConfigured: Boolean(ctx.config),
  }));

  app.get("/health/tron-rpc", async (_request, reply) => {
    try {
      if (ctx.config) {
        await ctx.tronRpc.getAccount(ctx.config.treasuryAddress);
      } else {
        await ctx.tronRpc.probeRpc();
      }
      return { status: "ok" };
    } catch (err) {
      return reply.code(503).send({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
