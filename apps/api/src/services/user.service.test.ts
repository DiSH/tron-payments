import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client.js", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const handler = () => chain;
  for (const key of [
    "select",
    "from",
    "where",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "returning",
    "orderBy",
  ]) {
    chain[key] = vi.fn(handler);
  }
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([]);
  return { db: chain };
});

import { isTokenStale } from "./auth.service.js";
import {
  MIN_PASSWORD_LENGTH,
  UserServiceError,
  assertCanChangeRoles,
  assertCanDisable,
  assertPassword,
  auditUserSnapshot,
  normalizeEmail,
  normalizeSignerAddress,
  parseRoles,
  validateCreateInput,
} from "./user.service.js";

const VALID_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

describe("validateCreateInput", () => {
  it("normalizes email and accepts valid input", () => {
    const parsed = validateCreateInput({
      email: "  Admin@Example.COM ",
      password: "long-enough-password",
      roles: ["admin", "requester", "admin"],
      signerAddress: ` ${VALID_TRON} `,
    });
    expect(parsed.email).toBe("admin@example.com");
    expect(parsed.roles).toEqual(["admin", "requester"]);
    expect(parsed.signerAddress).toBe(VALID_TRON);
  });

  it("rejects empty or unknown roles", () => {
    expect(() =>
      validateCreateInput({
        email: "a@b.co",
        password: "long-enough-password",
        roles: [],
      }),
    ).toThrow(UserServiceError);

    try {
      validateCreateInput({
        email: "a@b.co",
        password: "long-enough-password",
        roles: ["not_a_role"],
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UserServiceError);
      expect((err as UserServiceError).statusCode).toBe(400);
      expect((err as UserServiceError).message).toMatch(/Unknown role/);
    }
  });

  it("rejects short passwords", () => {
    expect(() =>
      validateCreateInput({
        email: "a@b.co",
        password: "short",
        roles: ["requester"],
      }),
    ).toThrow(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it("rejects invalid signer address", () => {
    expect(() =>
      validateCreateInput({
        email: "a@b.co",
        password: "long-enough-password",
        roles: ["signer"],
        signerAddress: "not-an-address",
      }),
    ).toThrow("Invalid signer address");
  });

  it("treats empty signer address as null", () => {
    const parsed = validateCreateInput({
      email: "a@b.co",
      password: "long-enough-password",
      roles: ["requester"],
      signerAddress: "  ",
    });
    expect(parsed.signerAddress).toBeNull();
  });
});

describe("user policy helpers", () => {
  it("normalizes email", () => {
    expect(normalizeEmail(" Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  it("parseRoles requires at least one known role", () => {
    expect(parseRoles(["executor"])).toEqual(["executor"]);
    expect(() => parseRoles([])).toThrow(UserServiceError);
    expect(() => parseRoles("admin")).toThrow(UserServiceError);
  });

  it("assertPassword enforces minimum length", () => {
    expect(() => assertPassword("123456789")).toThrow(UserServiceError);
    expect(() => assertPassword("1234567890")).not.toThrow();
  });

  it("normalizeSignerAddress validates TRON Base58Check", () => {
    expect(normalizeSignerAddress(null)).toBeNull();
    expect(normalizeSignerAddress(VALID_TRON)).toBe(VALID_TRON);
    expect(() => normalizeSignerAddress("Tnotvalid")).toThrow(UserServiceError);
  });
});

describe("assertCanDisable", () => {
  it("rejects disabling yourself", () => {
    try {
      assertCanDisable({
        actorId: "me",
        target: { id: "me", roles: ["requester"], disabledAt: null },
        otherActiveAdminCount: 2,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UserServiceError);
      expect((err as UserServiceError).statusCode).toBe(403);
    }
  });

  it("rejects disabling the last admin", () => {
    try {
      assertCanDisable({
        actorId: "me",
        target: { id: "them", roles: ["admin"], disabledAt: null },
        otherActiveAdminCount: 0,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UserServiceError);
      expect((err as UserServiceError).message).toMatch(/last admin/);
      expect((err as UserServiceError).statusCode).toBe(403);
    }
  });

  it("allows disabling a non-admin when other admins remain", () => {
    expect(() =>
      assertCanDisable({
        actorId: "me",
        target: { id: "them", roles: ["requester"], disabledAt: null },
        otherActiveAdminCount: 0,
      }),
    ).not.toThrow();
  });

  it("treats already-disabled users as not found", () => {
    try {
      assertCanDisable({
        actorId: "me",
        target: {
          id: "them",
          roles: ["requester"],
          disabledAt: new Date(),
        },
        otherActiveAdminCount: 1,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as UserServiceError).statusCode).toBe(404);
    }
  });
});

describe("assertCanChangeRoles", () => {
  it("rejects removing admin from the last admin", () => {
    try {
      assertCanChangeRoles({
        currentRoles: ["admin"],
        nextRoles: ["requester"],
        otherActiveAdminCount: 0,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as UserServiceError).statusCode).toBe(403);
    }
  });

  it("allows removing admin when another admin exists", () => {
    expect(() =>
      assertCanChangeRoles({
        currentRoles: ["admin"],
        nextRoles: ["requester"],
        otherActiveAdminCount: 1,
      }),
    ).not.toThrow();
  });
});

describe("auditUserSnapshot", () => {
  it("never includes password or password hash", () => {
    const snapshot = auditUserSnapshot({
      id: "u1",
      email: "user@example.com",
      roles: ["admin"],
      signerAddress: null,
      disabledAt: null,
      passwordHash: "should-not-appear",
      password: "plaintext-secret",
    } as { id: string; email: string; roles: string[]; signerAddress: null; disabledAt: null });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("should-not-appear");
    expect(serialized).not.toContain("plaintext-secret");
    expect(snapshot).not.toHaveProperty("password");
    expect(snapshot).not.toHaveProperty("passwordHash");
    expect(Object.keys(snapshot).sort()).toEqual(
      ["disabledAt", "email", "id", "roles", "signerAddress"].sort(),
    );
  });
});

describe("isTokenStale", () => {
  it("rejects tokens issued before credentials_updated_at", () => {
    const updatedAt = new Date("2026-08-24T12:00:10.000Z");
    const iatBefore = Math.floor(Date.parse("2026-08-24T12:00:00.000Z") / 1000);
    expect(isTokenStale(iatBefore, updatedAt)).toBe(true);
  });

  it("accepts tokens issued in the same second as the update", () => {
    const updatedAt = new Date("2026-08-24T12:00:10.800Z");
    const iatSameSecond = Math.floor(updatedAt.getTime() / 1000);
    expect(isTokenStale(iatSameSecond, updatedAt)).toBe(false);
  });

  it("rejects missing iat", () => {
    expect(isTokenStale(undefined, new Date())).toBe(true);
  });
});
