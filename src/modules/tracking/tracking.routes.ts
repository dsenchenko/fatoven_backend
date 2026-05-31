import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { requireAuth } from "../auth/auth.middleware";
import type { TrackingService } from "./tracking.service";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const dailyLogBodySchema = z.object({
  logDate: dateString,
  weightKg: z.number().positive().max(500).optional(),
  steps: z.number().int().nonnegative().optional(),
  caloriesKcal: z.number().int().nonnegative().optional(),
  fatGrams: z.number().int().nonnegative().optional(),
  carbsGrams: z.number().int().nonnegative().optional(),
  proteinGrams: z.number().int().nonnegative().optional(),
  garminCaloriesKcal: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

const weeklyAssessmentBodySchema = z.object({
  weekStartDate: dateString,
  weekNumber: z.number().int().positive().optional(),
  restingPulseBpm: z.number().int().positive().max(250).optional(),
  bellyCm: z.number().positive().max(300).optional(),
  neckCm: z.number().positive().max(100).optional(),
  chestCm: z.number().positive().max(300).optional(),
  satietyScore: z.number().int().min(1).max(10).optional(),
  calorieTrackingScore: z.number().int().min(1).max(10).optional(),
  sleepScore: z.number().int().min(1).max(10).optional(),
  wellbeingScore: z.number().int().min(1).max(10).optional(),
  stressScore: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
});

export function createTrackingRouter(trackingService: TrackingService): Router {
  const router = Router();
  router.use(requireAuth);

  router.put(
    "/daily",
    asyncHandler(async (req, res) => {
      const body = dailyLogBodySchema.parse(req.body);
      const log = await trackingService.upsertDailyLog(req.userId!, body);
      res.json({ log });
    }),
  );

  router.get(
    "/daily",
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          from: dateString.optional(),
          to: dateString.optional(),
        })
        .parse(req.query);
      const logs = await trackingService.listDailyLogs(req.userId!, query.from, query.to);
      res.json({ logs });
    }),
  );

  router.get(
    "/daily/:date",
    asyncHandler(async (req, res) => {
      const date = dateString.parse(req.params.date);
      const log = await trackingService.getDailyLog(req.userId!, date);
      res.json({ log });
    }),
  );

  router.delete(
    "/daily/:date",
    asyncHandler(async (req, res) => {
      const date = dateString.parse(req.params.date);
      await trackingService.deleteDailyLog(req.userId!, date);
      res.status(204).send();
    }),
  );

  router.get(
    "/weekly/summaries",
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          from: dateString.optional(),
          to: dateString.optional(),
        })
        .parse(req.query);
      const summaries = await trackingService.getWeeklySummaries(
        req.userId!,
        query.from,
        query.to,
      );
      res.json({ summaries });
    }),
  );

  router.put(
    "/weekly/assessments",
    asyncHandler(async (req, res) => {
      const body = weeklyAssessmentBodySchema.parse(req.body);
      const assessment = await trackingService.upsertWeeklyAssessment(req.userId!, body);
      res.json({ assessment });
    }),
  );

  router.get(
    "/weekly/assessments",
    asyncHandler(async (req, res) => {
      const assessments = await trackingService.listWeeklyAssessments(req.userId!);
      res.json({ assessments });
    }),
  );

  router.get(
    "/weekly/assessments/:weekStartDate",
    asyncHandler(async (req, res) => {
      const weekStartDate = dateString.parse(req.params.weekStartDate);
      const assessment = await trackingService.getWeeklyAssessment(req.userId!, weekStartDate);
      res.json({ assessment });
    }),
  );

  return router;
}
