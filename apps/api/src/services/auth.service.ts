import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { addressesEqual, isValidTronAddress, type Role } from "@tron-payments/shared";
import { TronWeb } from "tronweb";
import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { authChallenges, users } from "../db/schema/index.js";
import type { AuditService } from "./audit.service.js";

export interface AuthUser {
  id: string;
  email: string | null;
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

const CHALLENGE_TTL_MS = 5 * 60_000;
const CHALLENGE_DOMAIN = "TRON Payments login";

/** Reject JWTs issued before credentials_updated_at (second precision). */
export function isTokenStale(
  iat: number | undefined,
  credentialsUpdatedAt: Date,
): boolean {
  if (typeof iat !== "number") return true;
  return iat < Math.floor(credentialsUpdatedAt.getTime() / 1000);
}

export function buildLedgerChallengeMessage(nonce: string, issuedAtIso: string): string {
  // Keep under Ledger 255-byte personal-message limit.
  return `${CHALLENGE_DOMAIN}\n${nonce}\n${issuedAtIso}`;
}

export class AuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly audit?: AuditService,
  ) {}

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

    if (!user || user.disabledAt || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const authUser = this.toAuthUser(user);
    return { token: this.issueToken(authUser), user: authUser };
  }

  async createLedgerChallenge(): Promise<{
    challengeId: string;
    message: string;
    expiresAt: string;
  }> {
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const message = buildLedgerChallengeMessage(nonce, issuedAt.toISOString());

    const [row] = await db
      .insert(authChallenges)
      .values({ message, expiresAt })
      .returning();

    return {
      challengeId: row.id,
      message: row.message,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async verifyLedgerLogin(input: {
    challengeId: string;
    signature: string;
    expectedAddress?: string;
  }): Promise<{ token: string; user: AuthUser; created: boolean }> {
    const [challenge] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, input.challengeId))
      .limit(1);

    if (!challenge || challenge.consumedAt) {
      throw new Error("Invalid or consumed challenge");
    }
    if (challenge.expiresAt <= new Date()) {
      throw new Error("Challenge expired");
    }

    const recovered = await recoverAddressFromPersonalMessage(
      challenge.message,
      input.signature,
    );
    if (!isValidTronAddress(recovered)) {
      throw new Error("Could not recover signer address");
    }
    if (
      input.expectedAddress &&
      !addressesEqual(recovered, input.expectedAddress)
    ) {
      throw new Error("Recovered address does not match Ledger address");
    }

    const [consumed] = await db
      .update(authChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(eq(authChallenges.id, challenge.id), isNull(authChallenges.consumedAt)),
      )
      .returning();
    if (!consumed) {
      throw new Error("Invalid or consumed challenge");
    }

    const existing = await this.findActiveBySignerAddress(recovered);
    if (existing?.disabledAt) {
      throw new Error("Account disabled");
    }

    let user = existing;
    let created = false;
    if (!user) {
      const [inserted] = await db
        .insert(users)
        .values({
          email: null,
          passwordHash: null,
          roles: [],
          signerAddress: recovered,
        })
        .returning();
      user = inserted;
      created = true;
      await this.audit?.record(
        "USER_CREATED_LEDGER",
        { actorUserId: inserted.id },
        {
          after: {
            id: inserted.id,
            email: null,
            roles: [],
            signerAddress: recovered,
          },
        },
      );
    }

    const authUser = this.toAuthUser(user);
    await this.audit?.record(
      "AUTH_LEDGER_LOGIN",
      { actorUserId: authUser.id },
      {
        after: {
          userId: authUser.id,
          signerAddress: authUser.signerAddress,
          created,
        },
      },
    );

    return { token: this.issueToken(authUser), user: authUser, created };
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

  private issueToken(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email ?? user.signerAddress ?? "",
        roles: user.roles,
      },
      this.jwtSecret,
      { expiresIn: "8h" },
    );
  }

  private async findActiveBySignerAddress(address: string) {
    const rows = await db
      .select()
      .from(users)
      .where(isNull(users.disabledAt));
    return (
      rows.find(
        (row) =>
          row.signerAddress != null && addressesEqual(row.signerAddress, address),
      ) ?? null
    );
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

async function recoverAddressFromPersonalMessage(
  message: string,
  signature: string,
): Promise<string> {
  const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });
  const sig = signature.startsWith("0x") ? signature : `0x${signature}`;
  const recovered = await tronWeb.trx.verifyMessageV2(message, sig);
  return String(recovered);
}
