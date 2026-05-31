import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { AppError } from "../../shared/errors";
import type { AuthTokenPayload, AuthUser } from "./auth.types";

const SALT_ROUNDS = 12;

export class AuthService {
  constructor(private readonly env: Env) {}

  async register(email: string, password: string, displayName?: string): Promise<{ user: AuthUser; token: string }> {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new AppError(409, "Email is already registered", "email_taken");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName ?? null,
      },
    });

    const token = this.signToken({ sub: user.id, email: user.email });
    return { user: this.toAuthUser(user), token };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new AppError(401, "Invalid email or password", "invalid_credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid email or password", "invalid_credentials");
    }

    const token = this.signToken({ sub: user.id, email: user.email });
    return { user: this.toAuthUser(user), token };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "User not found", "user_not_found");
    }
    return this.toAuthUser(user);
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.env.JWT_SECRET) as AuthTokenPayload;
      if (!payload.sub || !payload.email) {
        throw new AppError(401, "Invalid token", "invalid_token");
      }
      return payload;
    } catch {
      throw new AppError(401, "Invalid or expired token", "invalid_token");
    }
  }

  private signToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.env.JWT_SECRET, {
      expiresIn: this.env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
