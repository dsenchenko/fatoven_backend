import * as XLSX from "xlsx";
import { formatDateOnly, getIsoWeekNumber, getWeekStartDate, parseDateOnly } from "../../shared/dates";
import type { DailyLogDto, WeeklyAssessmentDto, WeeklySummaryDto } from "./tracking.types";

export const TRACKER_SHEET = "Tracker";

export const TRACKER_HEADERS = [
  "неделя",
  "дата",
  "день",
  "кг",
  "шаги",
  "ккал",
  "Ж",
  "У",
  "Б",
  "ккал гармин",
  "ср кг",
  "ср шаги",
  "ср ккал",
  "ср ккал гармин",
] as const;

const COL = {
  week: 0,
  date: 1,
  day: 2,
  weight: 3,
  steps: 4,
  calories: 5,
  fat: 6,
  carbs: 7,
  protein: 8,
  garmin: 9,
  avgWeight: 10,
  avgSteps: 11,
  avgCalories: 12,
  avgGarmin: 13,
  assessLabel: 14,
  assessValue: 15,
  assessExtra: 16,
  assessExtra2: 17,
} as const;

const RU_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export type ParsedDailyLog = {
  logDate: string;
  weekNumber: number | null;
  weightKg: number | null;
  steps: number | null;
  caloriesKcal: number | null;
  fatGrams: number | null;
  carbsGrams: number | null;
  proteinGrams: number | null;
  garminCaloriesKcal: number | null;
};

export type ParsedWeeklyAssessment = {
  weekStartDate: string;
  weekNumber: number;
  bellyCm: number | null;
  neckCm: number | null;
  chestCm: number | null;
  satietyScore: number | null;
  calorieTrackingScore: number | null;
  sleepScore: number | null;
  wellbeingScore: number | null;
  stressScore: number | null;
  notes: string | null;
};

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseMeasurement(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const match = /:\s*([\d.]+)/.exec(text);
  return match ? Number(match[1]) : null;
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return parseDateOnly(iso);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  return null;
}

function rowHasMetrics(row: unknown[]): boolean {
  return [COL.weight, COL.steps, COL.calories, COL.fat, COL.carbs, COL.protein, COL.garmin].some(
    (i) => row[i] !== null && row[i] !== undefined && row[i] !== "",
  );
}

function mondayOf(date: Date): Date {
  return getWeekStartDate(date);
}

function toRowArray(row: unknown): unknown[] {
  if (Array.isArray(row)) return row;
  return [];
}

export function parseTrackerWorkbook(buffer: Buffer): {
  dailyLogs: ParsedDailyLog[];
  weeklyAssessments: ParsedWeeklyAssessment[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames.includes(TRACKER_SHEET)
    ? TRACKER_SHEET
    : workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const rows = rawRows.slice(1).map(toRowArray);
  return { dailyLogs: parseDailyLogs(rows), weeklyAssessments: parseWeeklyAssessments(rows) };
}

function parseDailyLogs(rows: unknown[][]): ParsedDailyLog[] {
  const logs: ParsedDailyLog[] = [];
  let currentWeek: number | null = null;

  for (const row of rows) {
    if (row[COL.week] !== null && row[COL.week] !== undefined && row[COL.week] !== "") {
      currentWeek = parseNum(row[COL.week]);
    }

    const date = parseExcelDate(row[COL.date]);
    if (!date || !rowHasMetrics(row)) continue;

    logs.push({
      logDate: formatDateOnly(date),
      weekNumber: currentWeek,
      weightKg: parseNum(row[COL.weight]),
      steps: parseNum(row[COL.steps]) !== null ? Math.trunc(parseNum(row[COL.steps])!) : null,
      caloriesKcal:
        parseNum(row[COL.calories]) !== null ? Math.trunc(parseNum(row[COL.calories])!) : null,
      fatGrams: parseNum(row[COL.fat]) !== null ? Math.trunc(parseNum(row[COL.fat])!) : null,
      carbsGrams: parseNum(row[COL.carbs]) !== null ? Math.trunc(parseNum(row[COL.carbs])!) : null,
      proteinGrams:
        parseNum(row[COL.protein]) !== null ? Math.trunc(parseNum(row[COL.protein])!) : null,
      garminCaloriesKcal:
        parseNum(row[COL.garmin]) !== null ? Math.trunc(parseNum(row[COL.garmin])!) : null,
    });
  }

  return logs;
}

function parseWeeklyAssessments(rows: unknown[][]): ParsedWeeklyAssessment[] {
  const assessments: ParsedWeeklyAssessment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = row[COL.assessLabel];
    if (typeof label !== "string" || !label.includes("1. Замеры")) continue;

    let weekStart: Date | null = null;
    let weekNum: number | null = null;
    for (let j = i; j >= Math.max(0, i - 15); j--) {
      const candidate = parseExcelDate(rows[j][COL.date]);
      if (candidate) {
        weekStart = mondayOf(candidate);
        const w = parseNum(rows[j][COL.week]);
        if (w !== null) weekNum = Math.trunc(w);
        break;
      }
    }
    if (!weekStart) continue;

    let belly: number | null = null;
    let neck: number | null = null;
    let chest: number | null = null;

    const v15 = row[COL.assessValue];
    const v16 = row[COL.assessExtra];
    const v17 = row[COL.assessExtra2];

    if (typeof v15 === "string") {
      if (v15.includes("Пузо") || v15.includes("пупку")) belly = parseMeasurement(v15);
      else if (v15.includes("Шея")) neck = parseMeasurement(v15);
    }
    if (typeof v16 === "string") {
      if (v16.includes("Шея")) neck = parseMeasurement(v16);
      else if (v16.includes("Грудь")) chest = parseMeasurement(v16);
    }
    if (typeof v17 === "string" && v17.includes("Грудь")) {
      chest = parseMeasurement(v17);
    }

    let satiety: number | null = null;
    let calorieAcc: number | null = null;
    let sleep: number | null = null;
    let wellbeing: number | null = null;
    let stress: number | null = null;
    const notes: string[] = [];

    for (let k = i + 1; k < Math.min(rows.length, i + 8); k++) {
      const r = rows[k];
      const rowLabel = r[COL.assessLabel];
      const rowVal = r[COL.assessValue];
      if (typeof rowLabel !== "string") continue;

      if (rowLabel.includes("2.") && rowLabel.includes("насыщения")) {
        satiety = parseNum(rowVal) !== null ? Math.trunc(parseNum(rowVal)!) : null;
      } else if (rowLabel.includes("3.") && rowLabel.includes("калорий")) {
        calorieAcc = parseNum(rowVal) !== null ? Math.trunc(parseNum(rowVal)!) : null;
      } else if (rowLabel.trim().startsWith("4.")) {
        sleep = parseNum(rowVal) !== null ? Math.trunc(parseNum(rowVal)!) : null;
      } else if (rowLabel.includes("5.") && rowLabel.includes("качалке")) {
        wellbeing = parseNum(rowVal) !== null ? Math.trunc(parseNum(rowVal)!) : null;
      } else if (rowLabel.includes("6.") || rowLabel.includes("Стресс")) {
        stress = parseNum(rowVal) !== null ? Math.trunc(parseNum(rowVal)!) : null;
        const note = r[COL.assessExtra];
        if (typeof note === "string" && note.trim()) notes.push(note.trim());
      }
    }

    if (weekNum === null) {
      weekNum = getIsoWeekNumber(weekStart);
    }

    assessments.push({
      weekStartDate: formatDateOnly(weekStart),
      weekNumber: weekNum,
      bellyCm: belly,
      neckCm: neck,
      chestCm: chest,
      satietyScore: satiety,
      calorieTrackingScore: calorieAcc,
      sleepScore: sleep,
      wellbeingScore: wellbeing,
      stressScore: stress,
      notes: notes.length ? notes.join("; ") : null,
    });
  }

  return assessments;
}

function ruDayName(date: Date): string {
  return RU_DAYS[date.getUTCDay()];
}

function emptyRow(): unknown[] {
  return new Array(TRACKER_HEADERS.length).fill(null);
}

function setAssessmentBlock(
  rows: unknown[][],
  startIndex: number,
  assessment: WeeklyAssessmentDto,
): void {
  const ensure = (offset: number): unknown[] => {
    while (rows.length <= startIndex + offset) rows.push(emptyRow());
    return rows[startIndex + offset]!;
  };

  const m0 = ensure(0);
  m0[COL.assessLabel] = "1. Замеры";
  if (assessment.bellyCm !== null) m0[COL.assessValue] = `Пузо по пупку: ${assessment.bellyCm}`;
  if (assessment.neckCm !== null) m0[COL.assessExtra] = `Шея: ${assessment.neckCm}`;
  if (assessment.chestCm !== null) m0[COL.assessExtra2] = `Грудь по соскам: ${assessment.chestCm}`;

  if (assessment.satietyScore !== null) {
    const r = ensure(1);
    r[COL.assessLabel] = "2. Чувство насыщения в течении недели";
    r[COL.assessValue] = assessment.satietyScore;
  }
  if (assessment.calorieTrackingScore !== null) {
    const r = ensure(2);
    r[COL.assessLabel] = "3. Точность записи калорий";
    r[COL.assessValue] = assessment.calorieTrackingScore;
  }
  if (assessment.sleepScore !== null) {
    const r = ensure(3);
    r[COL.assessLabel] = "4. Сон";
    r[COL.assessValue] = assessment.sleepScore;
  }
  if (assessment.wellbeingScore !== null) {
    const r = ensure(4);
    r[COL.assessLabel] = "5. Ощущения в качалке";
    r[COL.assessValue] = assessment.wellbeingScore;
  }
  if (assessment.stressScore !== null) {
    const r = ensure(5);
    r[COL.assessLabel] = "6. Стресс:";
    r[COL.assessValue] = assessment.stressScore;
    if (assessment.notes) r[COL.assessExtra] = assessment.notes;
  }
}

export function buildTrackerWorkbook(
  logs: DailyLogDto[],
  summaries: WeeklySummaryDto[],
  assessments: WeeklyAssessmentDto[],
): Buffer {
  const summaryByStart = new Map(summaries.map((s) => [s.weekStartDate, s]));
  const assessmentByStart = new Map(assessments.map((a) => [a.weekStartDate, a]));

  const byWeek = new Map<string, DailyLogDto[]>();
  for (const log of logs) {
    const weekStart = formatDateOnly(getWeekStartDate(parseDateOnly(log.logDate)));
    const list = byWeek.get(weekStart) ?? [];
    list.push(log);
    byWeek.set(weekStart, list);
  }

  const weekStarts = [...byWeek.keys()].sort();
  const rows: unknown[][] = [Array.from(TRACKER_HEADERS)];

  weekStarts.forEach((weekStart, index) => {
    const weekLogs = byWeek.get(weekStart)!.sort((a, b) => a.logDate.localeCompare(b.logDate));
    const summary = summaryByStart.get(weekStart);
    const assessment = assessmentByStart.get(weekStart);
    const weekNumber = index + 1;

    weekLogs.forEach((log, dayIndex) => {
      const row = emptyRow();
      const date = parseDateOnly(log.logDate);

      if (dayIndex === 0) {
        row[COL.week] = weekNumber;
        if (summary) {
          row[COL.avgWeight] = summary.averages.weightKg;
          row[COL.avgSteps] = summary.averages.steps;
          row[COL.avgCalories] = summary.averages.caloriesKcal;
          row[COL.avgGarmin] = summary.averages.garminCaloriesKcal;
        }
      }

      row[COL.date] = date;
      row[COL.day] = ruDayName(date);
      row[COL.weight] = log.weightKg;
      row[COL.steps] = log.steps;
      row[COL.calories] = log.caloriesKcal;
      row[COL.fat] = log.fatGrams;
      row[COL.carbs] = log.carbsGrams;
      row[COL.protein] = log.proteinGrams;
      row[COL.garmin] = log.garminCaloriesKcal;

      rows.push(row);
    });

    if (assessment) {
      const startIdx = rows.length - weekLogs.length;
      setAssessmentBlock(rows, startIdx, assessment);
    }
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = TRACKER_HEADERS.map(() => ({ wch: 14 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, TRACKER_SHEET);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
