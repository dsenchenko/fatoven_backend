export interface DailyLogDto {
  id: string;
  logDate: string;
  dayOfWeek: string;
  weekNumber: number;
  weightKg: number | null;
  steps: number | null;
  caloriesKcal: number | null;
  fatGrams: number | null;
  carbsGrams: number | null;
  proteinGrams: number | null;
  garminCaloriesKcal: number | null;
  notes: string | null;
}

export interface WeeklySummaryDto {
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  daysLogged: number;
  averages: {
    weightKg: number | null;
    steps: number | null;
    caloriesKcal: number | null;
    garminCaloriesKcal: number | null;
  };
}

export interface WeeklyAssessmentDto {
  id: string;
  weekNumber: number;
  weekStartDate: string;
  restingPulseBpm: number | null;
  bellyCm: number | null;
  neckCm: number | null;
  chestCm: number | null;
  satietyScore: number | null;
  calorieTrackingScore: number | null;
  sleepScore: number | null;
  wellbeingScore: number | null;
  stressScore: number | null;
  notes: string | null;
}
