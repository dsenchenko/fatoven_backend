import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import type { AuthService } from "./auth.service";
import { requireAuth } from "./auth.middleware";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const body = registerSchema.parse(req.body);
      const result = await authService.register(body.email, body.password, body.displayName);
      res.status(201).json(result);
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const body = loginSchema.parse(req.body);
      const result = await authService.login(body.email, body.password);
      res.json(result);
    }),
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await authService.getMe(req.userId!);
      res.json({ user });
    }),
  );

  return router;
}
