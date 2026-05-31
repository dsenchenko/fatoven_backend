import { AppError } from "./errors";

/** Subjective ratings in the spreadsheet are roughly 1–10. */
export function assertScore1to10(value: number | undefined | null, field: string): void {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new AppError(400, `${field} must be an integer from 1 to 10`, "validation_error");
  }
}
