import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthService, AuthUser } from "../services/auth.service.js";
import type { Role } from "@tron-payments/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function createAuthHook(auth: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const tokenUser = auth.verifyToken(header.slice(7));
      const user = await auth.getUserById(tokenUser.id);
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      request.user = user;
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  };
}

export function requireRoles(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const allowed = roles.some(
      (role) => user.roles.includes(role) || user.roles.includes("admin"),
    );
    if (!allowed) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
