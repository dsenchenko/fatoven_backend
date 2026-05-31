import type { Express } from "express";
import type { Env } from "../config/env";
import { AuthService } from "./auth/auth.service";
import { createAuthMiddleware } from "./auth/auth.middleware";
import { createAuthRouter } from "./auth/auth.routes";
import { TrackingService } from "./tracking/tracking.service";
import { createTrackingRouter } from "./tracking/tracking.routes";
import { SpreadsheetService } from "./tracking/spreadsheet.service";
import { createStatsRouter } from "./stats/stats.routes";

export interface AppModules {
  authService: AuthService;
  trackingService: TrackingService;
  spreadsheetService: SpreadsheetService;
}

export function registerModules(app: Express, env: Env): AppModules {
  const authService = new AuthService(env);
  const trackingService = new TrackingService();
  const spreadsheetService = new SpreadsheetService(trackingService);

  app.use(createAuthMiddleware(authService));

  app.use("/api/v1/auth", createAuthRouter(authService));
  app.use("/api/v1/tracking", createTrackingRouter(trackingService, spreadsheetService));
  app.use("/api/v1/stats", createStatsRouter(authService, trackingService));

  return { authService, trackingService, spreadsheetService };
}
