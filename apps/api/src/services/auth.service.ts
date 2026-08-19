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

    if (!user) throw new Error("Invalid credentials");

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

  verifyToken(token: string): AuthUser {
    const payload = jwt.verify(token, this.jwtSecret) as {
      sub: string;
      email: string;
      roles: Role[];
    };
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      signerAddress: null,
    };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ? this.toAuthUser(user) : null;
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
}
