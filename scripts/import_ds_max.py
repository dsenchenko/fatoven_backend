#!/usr/bin/env python3
"""Import DS_Max.xlsx daily logs and weekly assessments for a Fatoven user."""

from __future__ import annotations

import math
import re
import sys
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch

USER_EMAIL = "mitchfreeze@gmail.com"
DEFAULT_XLSX = Path.home() / "Downloads" / "DS_Max.xlsx"
DATABASE_URL = "postgresql://fatoven:fatoven@localhost:5433/fatoven"


def parse_num(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, float):
        return int(v) if v.is_integer() else float(v)
    return v


def parse_measurement(text: str | None) -> float | None:
    if not isinstance(text, str):
        return None
    m = re.search(r":\s*([\d.]+)", text)
    return float(m.group(1)) if m else None


def row_has_metrics(row) -> bool:
    for col in ("кг", "шаги", "ккал", "Ж", "У", "Б", "ккал гармин"):
        if pd.notna(row.get(col)):
            return True
    return False


def monday_of(d: date) -> date:
    return d - pd.Timedelta(days=d.weekday())


def parse_daily_logs(df: pd.DataFrame) -> list[dict]:
    logs: list[dict] = []
    current_week: int | None = None

    for _, row in df.iterrows():
        if pd.notna(row.get("неделя")):
            current_week = int(row["неделя"])
        if pd.isna(row.get("дата")):
            continue
        if not row_has_metrics(row):
            continue

        d = pd.Timestamp(row["дата"]).date()
        logs.append(
            {
                "log_date": d,
                "week_number": current_week,
                "weight_kg": parse_num(row.get("кг")),
                "steps": parse_num(row.get("шаги")),
                "calories_kcal": parse_num(row.get("ккал")),
                "fat_grams": parse_num(row.get("Ж")),
                "carbs_grams": parse_num(row.get("У")),
                "protein_grams": parse_num(row.get("Б")),
                "garmin_calories_kcal": parse_num(row.get("ккал гармин")),
            }
        )
    return logs


def parse_weekly_assessments(df: pd.DataFrame) -> list[dict]:
    assessments: list[dict] = []

    for i in range(len(df)):
        row = df.iloc[i]
        c14 = row.get("Unnamed: 14")
        if not isinstance(c14, str) or "1. Замеры" not in c14:
            continue

        week_start: date | None = None
        week_num: int | None = None
        for j in range(i, max(-1, i - 15), -1):
            r = df.iloc[j]
            if pd.notna(r.get("дата")):
                week_start = pd.Timestamp(r["дата"]).date()
                if pd.notna(r.get("неделя")):
                    week_num = int(r["неделя"])
                break

        if week_start is None:
            continue

        week_start = monday_of(week_start).date() if hasattr(monday_of(week_start), "date") else monday_of(week_start)

        belly = neck = chest = None
        c15, c16, c17 = row.get("Unnamed: 15"), row.get("Unnamed: 16"), row.get("Unnamed: 17")

        if isinstance(c15, str):
            if "Пузо" in c15 or "пупку" in c15:
                belly = parse_measurement(c15)
            elif "Шея" in c15:
                neck = parse_measurement(c15)
        if isinstance(c16, str):
            if "Шея" in c16:
                neck = parse_measurement(c16)
            elif "Грудь" in c16:
                chest = parse_measurement(c16)
        if isinstance(c17, str) and "Грудь" in c17:
            chest = parse_measurement(c17)

        satiety = calorie_acc = sleep = wellbeing = stress = None
        notes_parts: list[str] = []

        for k in range(i + 1, min(len(df), i + 8)):
            r = df.iloc[k]
            label = r.get("Unnamed: 14")
            val = r.get("Unnamed: 15")
            if not isinstance(label, str):
                continue
            if "2." in label and "насыщения" in label:
                satiety = parse_num(val)
            elif "3." in label and "калорий" in label:
                calorie_acc = parse_num(val)
            elif label.strip().startswith("4."):
                sleep = parse_num(val)
            elif "5." in label and "качалке" in label:
                wellbeing = parse_num(val)
            elif "6." in label or "Стресс" in label:
                stress = parse_num(val)
                note = r.get("Unnamed: 16")
                if isinstance(note, str) and note.strip():
                    notes_parts.append(note.strip())

        if week_num is None:
            week_num = week_start.isocalendar()[1]

        assessments.append(
            {
                "week_start_date": week_start,
                "week_number": week_num,
                "belly_cm": belly,
                "neck_cm": neck,
                "chest_cm": chest,
                "satiety_score": satiety,
                "calorie_tracking_score": calorie_acc,
                "sleep_score": sleep,
                "wellbeing_score": wellbeing,
                "stress_score": stress,
                "notes": "; ".join(notes_parts) if notes_parts else None,
            }
        )

    return assessments


def main() -> None:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx_path.exists():
        print(f"File not found: {xlsx_path}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_excel(xlsx_path, sheet_name="Tracker", header=0)
    daily_logs = parse_daily_logs(df)
    assessments = parse_weekly_assessments(df)

    now = datetime.now(UTC)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (USER_EMAIL.lower(),))
            row = cur.fetchone()
            if not row:
                print(f"User not found: {USER_EMAIL}", file=sys.stderr)
                sys.exit(1)
            user_id = row[0]

            cur.execute("DELETE FROM daily_logs WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM weekly_assessments WHERE user_id = %s", (user_id,))

            daily_rows = [
                (
                    str(uuid.uuid4()),
                    user_id,
                    log["log_date"],
                    log["weight_kg"],
                    log["steps"],
                    log["calories_kcal"],
                    log["fat_grams"],
                    log["carbs_grams"],
                    log["protein_grams"],
                    log["garmin_calories_kcal"],
                    now,
                    now,
                )
                for log in daily_logs
            ]

            execute_batch(
                cur,
                """
                INSERT INTO daily_logs (
                  id, user_id, log_date, weight_kg, steps, calories_kcal,
                  fat_grams, carbs_grams, protein_grams, garmin_calories_kcal,
                  created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                daily_rows,
            )

            assessment_rows = [
                (
                    str(uuid.uuid4()),
                    user_id,
                    a["week_number"],
                    a["week_start_date"],
                    a["belly_cm"],
                    a["neck_cm"],
                    a["chest_cm"],
                    a["satiety_score"],
                    a["calorie_tracking_score"],
                    a["sleep_score"],
                    a["wellbeing_score"],
                    a["stress_score"],
                    a["notes"],
                    now,
                    now,
                )
                for a in assessments
            ]

            execute_batch(
                cur,
                """
                INSERT INTO weekly_assessments (
                  id, user_id, week_number, week_start_date,
                  belly_cm, neck_cm, chest_cm,
                  satiety_score, calorie_tracking_score, sleep_score,
                  wellbeing_score, stress_score, notes,
                  created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                assessment_rows,
            )

        conn.commit()
        print(f"Imported for {USER_EMAIL}:")
        print(f"  daily_logs: {len(daily_logs)}")
        print(f"  weekly_assessments: {len(assessments)}")
        if daily_logs:
            print(f"  date range: {daily_logs[0]['log_date']} .. {daily_logs[-1]['log_date']}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
