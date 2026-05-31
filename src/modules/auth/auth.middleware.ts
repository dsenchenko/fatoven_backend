import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "./auth.service";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = header.slice(7);
    try {
      const payload = authService.verifyToken(token);
      req.userId = payload.sub;
    } catch {
      // Invalid token on optional routes is ignored; requireAuth catches protected routes.
    }
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    _res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  next();
}
