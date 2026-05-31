import type { Express } from "express";
import type { Env } from "../config/env";
import { AuthService } from "./auth/auth.service";
import { createAuthMiddleware } from "./auth/auth.middleware";
import { createAuthRouter } from "./auth/auth.routes";
import { TrackingService } from "./tracking/tracking.service";
import { createTrackingRouter } from "./tracking/tracking.routes";

export interface AppModules {
  authService: AuthService;
  trackingService: TrackingService;
}

export function registerModules(app: Express, env: Env): AppModules {
  const authService = new AuthService(env);
  const trackingService = new TrackingService();

  app.use(createAuthMiddleware(authService));

  app.use("/api/v1/auth", createAuthRouter(authService));
  app.use("/api/v1/tracking", createTrackingRouter(trackingService));

  return { authService, trackingService };
}
