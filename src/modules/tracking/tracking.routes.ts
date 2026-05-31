import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../../shared/http";
import { requireAuth } from "../auth/auth.middleware";
import type { SpreadsheetService } from "./spreadsheet.service";
import type { TrackingService } from "./tracking.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls");
    if (ok) cb(null, true);
    else cb(new Error("Only .xlsx files are supported"));
  },
});

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

export function createTrackingRouter(
  trackingService: TrackingService,
  spreadsheetService: SpreadsheetService,
): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/export",
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          from: dateString.optional(),
          to: dateString.optional(),
        })
        .parse(req.query);
      const buffer = await spreadsheetService.exportSpreadsheet(
        req.userId!,
        query.from,
        query.to,
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", 'attachment; filename="fatoven-tracker.xlsx"');
      res.send(buffer);
    }),
  );

  router.post(
    "/import",
    (req, res, next) => {
      upload.single("file")(req, res, (err) => {
        if (err) {
          res.status(400).json({
            error: "invalid_file",
            message: err.message || "Invalid upload",
          });
          return;
        }
        next();
      });
    },
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          mode: z.enum(["merge", "replace"]).default("merge"),
        })
        .parse(req.query);

      if (!req.file?.buffer) {
        res.status(400).json({
          error: "missing_file",
          message: 'Upload an .xlsx file in the "file" field',
        });
        return;
      }

      const result = await spreadsheetService.importSpreadsheet(
        req.userId!,
        req.file.buffer,
        query.mode,
      );
      res.json(result);
    }),
  );

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
