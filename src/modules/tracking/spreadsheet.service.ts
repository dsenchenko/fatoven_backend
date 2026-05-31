import { prisma } from "../../db/prisma";
import { AppError } from "../../shared/errors";
import {
  buildTrackerWorkbook,
  parseTrackerWorkbook,
  type ParsedDailyLog,
  type ParsedWeeklyAssessment,
} from "./spreadsheet.format";
import type { TrackingService } from "./tracking.service";

export type ImportMode = "merge" | "replace";

export type ImportResult = {
  mode: ImportMode;
  imported: {
    dailyLogs: number;
    weeklyAssessments: number;
  };
  dateRange: { from: string | null; to: string | null };
};

export class SpreadsheetService {
  constructor(private readonly trackingService: TrackingService) {}

  async exportSpreadsheet(userId: string, from?: string, to?: string): Promise<Buffer> {
    const [logs, summaries, assessments] = await Promise.all([
      this.trackingService.listDailyLogs(userId, from, to),
      this.trackingService.getWeeklySummaries(userId, from, to),
      this.trackingService.listWeeklyAssessments(userId),
    ]);

    const filteredAssessments =
      from || to
        ? assessments.filter((a) => {
            if (from && a.weekStartDate < from) return false;
            if (to && a.weekStartDate > to) return false;
            return true;
          })
        : assessments;

    return buildTrackerWorkbook(logs, summaries, filteredAssessments);
  }

  async importSpreadsheet(
    userId: string,
    buffer: Buffer,
    mode: ImportMode = "merge",
  ): Promise<ImportResult> {
    let parsed: { dailyLogs: ParsedDailyLog[]; weeklyAssessments: ParsedWeeklyAssessment[] };
    try {
      parsed = parseTrackerWorkbook(buffer);
    } catch {
      throw new AppError(400, "Invalid spreadsheet file", "invalid_file");
    }

    if (parsed.dailyLogs.length === 0 && parsed.weeklyAssessments.length === 0) {
      throw new AppError(400, "No tracking data found in spreadsheet", "empty_file");
    }

    if (mode === "replace") {
      await prisma.$transaction([
        prisma.dailyLog.deleteMany({ where: { userId } }),
        prisma.weeklyAssessment.deleteMany({ where: { userId } }),
      ]);
    }

    for (const log of parsed.dailyLogs) {
      await this.trackingService.upsertDailyLog(userId, {
        logDate: log.logDate,
        ...(log.weightKg !== null && { weightKg: log.weightKg }),
        ...(log.steps !== null && { steps: log.steps }),
        ...(log.caloriesKcal !== null && { caloriesKcal: log.caloriesKcal }),
        ...(log.fatGrams !== null && { fatGrams: log.fatGrams }),
        ...(log.carbsGrams !== null && { carbsGrams: log.carbsGrams }),
        ...(log.proteinGrams !== null && { proteinGrams: log.proteinGrams }),
        ...(log.garminCaloriesKcal !== null && { garminCaloriesKcal: log.garminCaloriesKcal }),
      });
    }

    for (const assessment of parsed.weeklyAssessments) {
      await this.trackingService.upsertWeeklyAssessment(userId, {
        weekStartDate: assessment.weekStartDate,
        weekNumber: assessment.weekNumber,
        ...(assessment.bellyCm !== null && { bellyCm: assessment.bellyCm }),
        ...(assessment.neckCm !== null && { neckCm: assessment.neckCm }),
        ...(assessment.chestCm !== null && { chestCm: assessment.chestCm }),
        ...(assessment.satietyScore !== null && { satietyScore: assessment.satietyScore }),
        ...(assessment.calorieTrackingScore !== null && {
          calorieTrackingScore: assessment.calorieTrackingScore,
        }),
        ...(assessment.sleepScore !== null && { sleepScore: assessment.sleepScore }),
        ...(assessment.wellbeingScore !== null && { wellbeingScore: assessment.wellbeingScore }),
        ...(assessment.stressScore !== null && { stressScore: assessment.stressScore }),
        ...(assessment.notes && { notes: assessment.notes }),
      });
    }

    const dates = parsed.dailyLogs.map((l) => l.logDate).sort();

    return {
      mode,
      imported: {
        dailyLogs: parsed.dailyLogs.length,
        weeklyAssessments: parsed.weeklyAssessments.length,
      },
      dateRange: {
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
      },
    };
  }
}
