import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/index.js";
import type { Role } from "@tron-payments/shared";

export interface AuthUser {
  id: string;
  email: string;
  roles: Role[];
  signerAddress: string | null;
}

export interface AuthUserRecord extends AuthUser {
  disabledAt: Date | null;
  credentialsUpdatedAt: Date;
}

export interface TokenPayload {
  id: string;
  email: string;
  roles: Role[];
  iat: number;
}

/** Reject JWTs issued before credentials_updated_at (second precision). */
export function isTokenStale(
  iat: number | undefined,
  credentialsUpdatedAt: Date,
): boolean {
  if (typeof iat !== "number") return true;
  return iat < Math.floor(credentialsUpdatedAt.getTime() / 1000);
}

export class AuthService {
  constructor(private readonly jwtSecret: string) {}

  async register(input: {
    email: string;
    password: string;
    roles: Role[];
    signerAddress?: string;
  }): Promise<AuthUser> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const [user] = await db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        roles: input.roles,
        signerAddress: input.signerAddress ?? null,
      })
      .returning();

    return this.toAuthUser(user);
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || user.disabledAt) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const authUser = this.toAuthUser(user);
    const token = jwt.sign(
      { sub: authUser.id, email: authUser.email, roles: authUser.roles },
      this.jwtSecret,
      { expiresIn: "8h" },
    );

    return { token, user: authUser };
  }

  verifyToken(token: string): TokenPayload {
    const payload = jwt.verify(token, this.jwtSecret) as {
      sub: string;
      email: string;
      roles: Role[];
      iat?: number;
    };
    if (typeof payload.iat !== "number") {
      throw new Error("Invalid token");
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      iat: payload.iat,
    };
  }

  async getUserRecord(id: string): Promise<AuthUserRecord | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ? this.toAuthUserRecord(user) : null;
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const record = await this.getUserRecord(id);
    if (!record || record.disabledAt) return null;
    return {
      id: record.id,
      email: record.email,
      roles: record.roles,
      signerAddress: record.signerAddress,
    };
  }

  hasRole(user: AuthUser, role: Role): boolean {
    return user.roles.includes(role) || user.roles.includes("admin");
  }

  private toAuthUser(user: typeof users.$inferSelect): AuthUser {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles as Role[],
      signerAddress: user.signerAddress,
    };
  }

  private toAuthUserRecord(user: typeof users.$inferSelect): AuthUserRecord {
    return {
      ...this.toAuthUser(user),
      disabledAt: user.disabledAt,
      credentialsUpdatedAt: user.credentialsUpdatedAt,
    };
  }
}
