import type { DailyLog, WeeklyAssessment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../shared/errors";
import {
  formatDateOnly,
  getIsoWeekNumber,
  getWeekStartDate,
  parseDateOnly,
} from "../../shared/dates";
import { assertScore1to10 } from "../../shared/score";
import type { DailyLogDto, WeeklyAssessmentDto, WeeklySummaryDto } from "./tracking.types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type DailyLogInput = {
  logDate: string;
  weightKg?: number;
  steps?: number;
  caloriesKcal?: number;
  fatGrams?: number;
  carbsGrams?: number;
  proteinGrams?: number;
  garminCaloriesKcal?: number;
  notes?: string;
};

export type WeeklyAssessmentInput = {
  weekStartDate: string;
  weekNumber?: number;
  restingPulseBpm?: number;
  bellyCm?: number;
  neckCm?: number;
  chestCm?: number;
  satietyScore?: number;
  calorieTrackingScore?: number;
  sleepScore?: number;
  wellbeingScore?: number;
  stressScore?: number;
  notes?: string;
};

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null) return null;
  return Number(value);
}

function toDailyLogDto(log: DailyLog): DailyLogDto {
  const date = new Date(log.logDate);
  return {
    id: log.id,
    logDate: formatDateOnly(date),
    dayOfWeek: DAY_NAMES[date.getUTCDay()],
    weekNumber: getIsoWeekNumber(date),
    weightKg: decimalToNumber(log.weightKg),
    steps: log.steps,
    caloriesKcal: log.caloriesKcal,
    fatGrams: log.fatGrams,
    carbsGrams: log.carbsGrams,
    proteinGrams: log.proteinGrams,
    garminCaloriesKcal: log.garminCaloriesKcal,
    notes: log.notes,
  };
}

function toWeeklyAssessmentDto(row: WeeklyAssessment): WeeklyAssessmentDto {
  return {
    id: row.id,
    weekNumber: row.weekNumber,
    weekStartDate: formatDateOnly(new Date(row.weekStartDate)),
    restingPulseBpm: row.restingPulseBpm,
    bellyCm: decimalToNumber(row.bellyCm),
    neckCm: decimalToNumber(row.neckCm),
    chestCm: decimalToNumber(row.chestCm),
    satietyScore: row.satietyScore,
    calorieTrackingScore: row.calorieTrackingScore,
    sleepScore: row.sleepScore,
    wellbeingScore: row.wellbeingScore,
    stressScore: row.stressScore,
    notes: row.notes,
  };
}

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export class TrackingService {
  async upsertDailyLog(userId: string, input: DailyLogInput): Promise<DailyLogDto> {
    const logDate = parseDateOnly(input.logDate);

    const log = await prisma.dailyLog.upsert({
      where: { userId_logDate: { userId, logDate } },
      create: {
        userId,
        logDate,
        weightKg: input.weightKg ?? null,
        steps: input.steps ?? null,
        caloriesKcal: input.caloriesKcal ?? null,
        fatGrams: input.fatGrams ?? null,
        carbsGrams: input.carbsGrams ?? null,
        proteinGrams: input.proteinGrams ?? null,
        garminCaloriesKcal: input.garminCaloriesKcal ?? null,
        notes: input.notes ?? null,
      },
      update: {
        ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
        ...(input.steps !== undefined && { steps: input.steps }),
        ...(input.caloriesKcal !== undefined && { caloriesKcal: input.caloriesKcal }),
        ...(input.fatGrams !== undefined && { fatGrams: input.fatGrams }),
        ...(input.carbsGrams !== undefined && { carbsGrams: input.carbsGrams }),
        ...(input.proteinGrams !== undefined && { proteinGrams: input.proteinGrams }),
        ...(input.garminCaloriesKcal !== undefined && { garminCaloriesKcal: input.garminCaloriesKcal }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    return toDailyLogDto(log);
  }

  async getDailyLog(userId: string, logDate: string): Promise<DailyLogDto> {
    const date = parseDateOnly(logDate);
    const log = await prisma.dailyLog.findUnique({
      where: { userId_logDate: { userId, logDate: date } },
    });
    if (!log) {
      throw new AppError(404, "Daily log not found", "daily_log_not_found");
    }
    return toDailyLogDto(log);
  }

  async listDailyLogs(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<DailyLogDto[]> {
    const where: Prisma.DailyLogWhereInput = { userId };
    if (from || to) {
      where.logDate = {};
      if (from) where.logDate.gte = parseDateOnly(from);
      if (to) where.logDate.lte = parseDateOnly(to);
    }

    const logs = await prisma.dailyLog.findMany({
      where,
      orderBy: { logDate: "asc" },
    });
    return logs.map(toDailyLogDto);
  }

  async deleteDailyLog(userId: string, logDate: string): Promise<void> {
    const date = parseDateOnly(logDate);
    const result = await prisma.dailyLog.deleteMany({
      where: { userId, logDate: date },
    });
    if (result.count === 0) {
      throw new AppError(404, "Daily log not found", "daily_log_not_found");
    }
  }

  async getWeeklySummaries(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<WeeklySummaryDto[]> {
    const logs = await this.listDailyLogs(userId, from, to);
    const byWeek = new Map<string, DailyLogDto[]>();

    for (const log of logs) {
      const weekStart = getWeekStartDate(parseDateOnly(log.logDate));
      const key = formatDateOnly(weekStart);
      const list = byWeek.get(key) ?? [];
      list.push(log);
      byWeek.set(key, list);
    }

    const summaries: WeeklySummaryDto[] = [];
    for (const [weekStartDate, weekLogs] of byWeek) {
      const start = parseDateOnly(weekStartDate);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);

      summaries.push({
        weekNumber: weekLogs[0]?.weekNumber ?? getIsoWeekNumber(start),
        weekStartDate,
        weekEndDate: formatDateOnly(end),
        daysLogged: weekLogs.length,
        averages: {
          weightKg: avg(weekLogs.map((l) => l.weightKg)),
          steps: avg(weekLogs.map((l) => l.steps)),
          caloriesKcal: avg(weekLogs.map((l) => l.caloriesKcal)),
          garminCaloriesKcal: avg(weekLogs.map((l) => l.garminCaloriesKcal)),
        },
      });
    }

    return summaries.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }

  async upsertWeeklyAssessment(
    userId: string,
    input: WeeklyAssessmentInput,
  ): Promise<WeeklyAssessmentDto> {
    const weekStartDate = parseDateOnly(input.weekStartDate);
    const weekNumber = input.weekNumber ?? getIsoWeekNumber(weekStartDate);

    assertScore1to10(input.satietyScore, "satietyScore");
    assertScore1to10(input.calorieTrackingScore, "calorieTrackingScore");
    assertScore1to10(input.sleepScore, "sleepScore");
    assertScore1to10(input.wellbeingScore, "wellbeingScore");
    assertScore1to10(input.stressScore, "stressScore");

    const row = await prisma.weeklyAssessment.upsert({
      where: { userId_weekStartDate: { userId, weekStartDate } },
      create: {
        userId,
        weekNumber,
        weekStartDate,
        restingPulseBpm: input.restingPulseBpm ?? null,
        bellyCm: input.bellyCm ?? null,
        neckCm: input.neckCm ?? null,
        chestCm: input.chestCm ?? null,
        satietyScore: input.satietyScore ?? null,
        calorieTrackingScore: input.calorieTrackingScore ?? null,
        sleepScore: input.sleepScore ?? null,
        wellbeingScore: input.wellbeingScore ?? null,
        stressScore: input.stressScore ?? null,
        notes: input.notes ?? null,
      },
      update: {
        weekNumber,
        ...(input.restingPulseBpm !== undefined && { restingPulseBpm: input.restingPulseBpm }),
        ...(input.bellyCm !== undefined && { bellyCm: input.bellyCm }),
        ...(input.neckCm !== undefined && { neckCm: input.neckCm }),
        ...(input.chestCm !== undefined && { chestCm: input.chestCm }),
        ...(input.satietyScore !== undefined && { satietyScore: input.satietyScore }),
        ...(input.calorieTrackingScore !== undefined && {
          calorieTrackingScore: input.calorieTrackingScore,
        }),
        ...(input.sleepScore !== undefined && { sleepScore: input.sleepScore }),
        ...(input.wellbeingScore !== undefined && { wellbeingScore: input.wellbeingScore }),
        ...(input.stressScore !== undefined && { stressScore: input.stressScore }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    return toWeeklyAssessmentDto(row);
  }

  async listWeeklyAssessments(userId: string): Promise<WeeklyAssessmentDto[]> {
    const rows = await prisma.weeklyAssessment.findMany({
      where: { userId },
      orderBy: { weekStartDate: "asc" },
    });
    return rows.map(toWeeklyAssessmentDto);
  }

  async getWeeklyAssessment(userId: string, weekStartDate: string): Promise<WeeklyAssessmentDto> {
    const date = parseDateOnly(weekStartDate);
    const row = await prisma.weeklyAssessment.findUnique({
      where: { userId_weekStartDate: { userId, weekStartDate: date } },
    });
    if (!row) {
      throw new AppError(404, "Weekly assessment not found", "weekly_assessment_not_found");
    }
    return toWeeklyAssessmentDto(row);
  }
}
