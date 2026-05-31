import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import type { AuthService } from "../auth/auth.service";
import { requireAuth } from "../auth/auth.middleware";
import type { TrackingService } from "../tracking/tracking.service";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const usernameParam = z
  .string()
  .regex(/^[a-z0-9_]{3,30}$/, "Invalid username");

export function createStatsRouter(
  authService: AuthService,
  trackingService: TrackingService,
): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/:username",
    asyncHandler(async (req, res) => {
      const username = usernameParam.parse(req.params.username);
      const profile = await authService.getPublicProfileByUsername(username);
      res.json({ profile });
    }),
  );

  router.get(
    "/:username/daily",
    asyncHandler(async (req, res) => {
      const username = usernameParam.parse(req.params.username);
      const query = z
        .object({
          from: dateString.optional(),
          to: dateString.optional(),
        })
        .parse(req.query);
      const userId = await authService.resolveUserIdByUsername(username);
      const logs = await trackingService.listDailyLogs(userId, query.from, query.to);
      res.json({ logs });
    }),
  );

  router.get(
    "/:username/weekly/summaries",
    asyncHandler(async (req, res) => {
      const username = usernameParam.parse(req.params.username);
      const query = z
        .object({
          from: dateString.optional(),
          to: dateString.optional(),
        })
        .parse(req.query);
      const userId = await authService.resolveUserIdByUsername(username);
      const summaries = await trackingService.getWeeklySummaries(userId, query.from, query.to);
      res.json({ summaries });
    }),
  );

  router.get(
    "/:username/weekly/assessments",
    asyncHandler(async (req, res) => {
      const username = usernameParam.parse(req.params.username);
      const userId = await authService.resolveUserIdByUsername(username);
      const assessments = await trackingService.listWeeklyAssessments(userId);
      res.json({ assessments });
    }),
  );

  router.get(
    "/:username/weekly/assessments/:weekStartDate",
    asyncHandler(async (req, res) => {
      const username = usernameParam.parse(req.params.username);
      const weekStartDate = dateString.parse(req.params.weekStartDate);
      const userId = await authService.resolveUserIdByUsername(username);
      const assessment = await trackingService.getWeeklyAssessment(userId, weekStartDate);
      res.json({ assessment });
    }),
  );

  return router;
}
