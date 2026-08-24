import bcrypt from "bcryptjs";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { isValidTronAddress, ROLES, type Role } from "@tron-payments/shared";
import { db } from "../db/client.js";
import { users } from "../db/schema/index.js";
import type { AuditContext, AuditService } from "./audit.service.js";

export const MIN_PASSWORD_LENGTH = 10;
const BCRYPT_ROUNDS = 12;

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

export interface AdminUser {
  id: string;
  email: string;
  roles: Role[];
  signerAddress: string | null;
  createdAt: Date;
}

type UserRow = typeof users.$inferSelect;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertPassword(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new UserServiceError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400,
    );
  }
}

export function parseRoles(roles: unknown): Role[] {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new UserServiceError("At least one role is required", 400);
  }
  const allowed = new Set<string>(ROLES);
  const parsed: Role[] = [];
  for (const role of roles) {
    if (typeof role !== "string" || !allowed.has(role)) {
      throw new UserServiceError(`Unknown role: ${String(role)}`, 400);
    }
    if (!parsed.includes(role as Role)) {
      parsed.push(role as Role);
    }
  }
  return parsed;
}

export function normalizeSignerAddress(
  address: string | null | undefined,
): string | null {
  if (address == null) return null;
  const trimmed = address.trim();
  if (trimmed === "") return null;
  if (!isValidTronAddress(trimmed)) {
    throw new UserServiceError("Invalid signer address", 400);
  }
  return trimmed;
}

export function auditUserSnapshot(user: {
  id: string;
  email: string;
  roles: unknown;
  signerAddress: string | null;
  disabledAt?: Date | null;
}): {
  id: string;
  email: string;
  roles: unknown;
  signerAddress: string | null;
  disabledAt: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    signerAddress: user.signerAddress,
    disabledAt: user.disabledAt ? user.disabledAt.toISOString() : null,
  };
}

export function assertCanDisable(input: {
  actorId: string;
  target: { id: string; roles: string[]; disabledAt: Date | null };
  otherActiveAdminCount: number;
}): void {
  if (input.target.disabledAt) {
    throw new UserServiceError("User not found", 404);
  }
  if (input.actorId === input.target.id) {
    throw new UserServiceError("Cannot disable your own account", 403);
  }
  if (input.target.roles.includes("admin") && input.otherActiveAdminCount === 0) {
    throw new UserServiceError("Cannot disable the last admin", 403);
  }
}

export function assertCanChangeRoles(input: {
  currentRoles: string[];
  nextRoles: Role[];
  otherActiveAdminCount: number;
}): void {
  const wasAdmin = input.currentRoles.includes("admin");
  const staysAdmin = input.nextRoles.includes("admin");
  if (wasAdmin && !staysAdmin && input.otherActiveAdminCount === 0) {
    throw new UserServiceError("Cannot remove admin from the last admin", 403);
  }
}

export function validateCreateInput(input: {
  email: string;
  password: string;
  roles: unknown;
  signerAddress?: string | null;
}): {
  email: string;
  password: string;
  roles: Role[];
  signerAddress: string | null;
} {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserServiceError("Valid email is required", 400);
  }
  assertPassword(input.password);
  return {
    email,
    password: input.password,
    roles: parseRoles(input.roles),
    signerAddress: normalizeSignerAddress(input.signerAddress),
  };
}

function toAdminUser(user: UserRow): AdminUser {
  return {
    id: user.id,
    email: user.email,
    roles: user.roles as Role[],
    signerAddress: user.signerAddress,
    createdAt: user.createdAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code === "23505") return true;
  return isUniqueViolation((err as { cause?: unknown }).cause);
}

export class UserService {
  constructor(private readonly audit: AuditService) {}

  async list(): Promise<AdminUser[]> {
    const rows = await db
      .select()
      .from(users)
      .where(isNull(users.disabledAt))
      .orderBy(asc(users.email));
    return rows.map(toAdminUser);
  }

  async create(
    input: {
      email: string;
      password: string;
      roles: unknown;
      signerAddress?: string | null;
    },
    context: AuditContext,
  ): Promise<AdminUser> {
    const parsed = validateCreateInput(input);
    await this.assertEmailAvailable(parsed.email);
    await this.assertSignerAddressAvailable(parsed.signerAddress);

    const passwordHash = await bcrypt.hash(parsed.password, BCRYPT_ROUNDS);
    let created: UserRow;
    try {
      const [row] = await db
        .insert(users)
        .values({
          email: parsed.email,
          passwordHash,
          roles: parsed.roles,
          signerAddress: parsed.signerAddress,
        })
        .returning();
      created = row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new UserServiceError("Email already in use", 409);
      }
      throw err;
    }

    await this.audit.record("USER_CREATED", context, {
      after: auditUserSnapshot(created),
    });
    return toAdminUser(created);
  }

  async update(
    id: string,
    input: { roles?: unknown; signerAddress?: string | null },
    context: AuditContext,
  ): Promise<AdminUser> {
    const existing = await this.requireActive(id);
    const nextRoles =
      input.roles !== undefined ? parseRoles(input.roles) : (existing.roles as Role[]);
    const nextAddress =
      input.signerAddress !== undefined
        ? normalizeSignerAddress(input.signerAddress)
        : existing.signerAddress;

    const otherActiveAdminCount = await this.countOtherActiveAdmins(id);
    assertCanChangeRoles({
      currentRoles: existing.roles as string[],
      nextRoles,
      otherActiveAdminCount,
    });
    await this.assertSignerAddressAvailable(nextAddress, id);

    const [updated] = await db
      .update(users)
      .set({
        roles: nextRoles,
        signerAddress: nextAddress,
      })
      .where(and(eq(users.id, id), isNull(users.disabledAt)))
      .returning();

    if (!updated) {
      throw new UserServiceError("User not found", 404);
    }

    await this.audit.record("USER_UPDATED", context, {
      before: auditUserSnapshot(existing),
      after: auditUserSnapshot(updated),
    });
    return toAdminUser(updated);
  }

  async resetPassword(
    id: string,
    newPassword: string,
    context: AuditContext,
  ): Promise<void> {
    assertPassword(newPassword);
    const existing = await this.requireActive(id);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        credentialsUpdatedAt: now,
      })
      .where(and(eq(users.id, id), isNull(users.disabledAt)))
      .returning();

    if (!updated) {
      throw new UserServiceError("User not found", 404);
    }

    await this.audit.record("USER_PASSWORD_RESET", context, {
      before: auditUserSnapshot(existing),
      after: {
        ...auditUserSnapshot(updated),
        credentialsUpdatedAt: now.toISOString(),
      },
    });
  }

  async disable(id: string, actorId: string, context: AuditContext): Promise<void> {
    const existing = await this.requireActive(id);
    const otherActiveAdminCount = await this.countOtherActiveAdmins(id);
    assertCanDisable({
      actorId,
      target: {
        id: existing.id,
        roles: existing.roles as string[],
        disabledAt: existing.disabledAt,
      },
      otherActiveAdminCount,
    });

    const now = new Date();
    const [updated] = await db
      .update(users)
      .set({ disabledAt: now })
      .where(and(eq(users.id, id), isNull(users.disabledAt)))
      .returning();

    if (!updated) {
      throw new UserServiceError("User not found", 404);
    }

    await this.audit.record("USER_DISABLED", context, {
      before: auditUserSnapshot(existing),
      after: auditUserSnapshot(updated),
    });
  }

  private async requireActive(id: string): Promise<UserRow> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user || user.disabledAt) {
      throw new UserServiceError("User not found", 404);
    }
    return user;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      throw new UserServiceError("Email already in use", 409);
    }
  }

  private async assertSignerAddressAvailable(
    address: string | null,
    excludeUserId?: string,
  ): Promise<void> {
    if (!address) return;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        excludeUserId
          ? and(
              eq(users.signerAddress, address),
              isNull(users.disabledAt),
              ne(users.id, excludeUserId),
            )
          : and(eq(users.signerAddress, address), isNull(users.disabledAt)),
      )
      .limit(1);
    if (existing) {
      throw new UserServiceError("Signer address already assigned", 409);
    }
  }

  private async countOtherActiveAdmins(excludeUserId: string): Promise<number> {
    const rows = await db
      .select({ id: users.id, roles: users.roles })
      .from(users)
      .where(and(isNull(users.disabledAt), ne(users.id, excludeUserId)));
    return rows.filter((row) => (row.roles as string[]).includes("admin")).length;
  }
}
